import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { createTestDatabase } from "../src/testing";

const now = new Date("2026-10-10T15:30:00Z");
const at = (iso: string) => new Date(iso);
const configuration = (modelId: string) => ({
  provider: "gemini" as const,
  modelId,
  systemPrompt: "test",
  codeVersion: "test",
});

/** Window bounds, bucket alignment and both breakdowns, against a real isolated database. */
await test("dashboard series are bucketed in UTC and bounded by the window", async () => {
  const database = await createTestDatabase();
  process.env.POSTGRES_URL = database.url;
  const { pool } = await import("../src/client");
  const { AgentRun, EvalCase, EvalScore, ModelCall } =
    await import("../src/schema");
  const { dashboardWindow, getDashboard, getEvalSeries, getUsageSeries } =
    await import("../src/dashboard");
  try {
    const hourly = dashboardWindow(1, now);
    assert.equal(hourly.granularity, "hour");
    assert.equal(hourly.buckets.length, 24);
    assert.equal(hourly.buckets[0], "2026-10-09T16:00:00.000Z");
    assert.equal(hourly.buckets.at(-1), "2026-10-10T15:00:00.000Z");
    const weekly = dashboardWindow(7, now);
    assert.equal(weekly.granularity, "day");
    assert.deepEqual(
      [weekly.buckets[0], weekly.buckets.at(-1), weekly.buckets.length],
      ["2026-10-04T00:00:00.000Z", "2026-10-10T00:00:00.000Z", 7],
    );
    assert.equal(dashboardWindow(30, now).buckets.length, 30);

    const run = async (
      createdAt: string,
      values: Partial<typeof AgentRun.$inferInsert> = {},
    ) => {
      const id = randomUUID();
      await database.db.insert(AgentRun).values({
        id,
        input: "test",
        configuration: configuration("gemini-3.8-flash"),
        mode: "production",
        status: "completed",
        traceContext: {},
        createdAt: at(createdAt),
        updatedAt: at(createdAt),
        ...values,
      });
      return id;
    };
    const productionRun = await run("2026-10-03T00:00:00Z");
    const call = (
      startedAt: string,
      values: Partial<typeof ModelCall.$inferInsert> = {},
    ) =>
      database.db.insert(ModelCall).values({
        id: randomUUID(),
        runId: productionRun,
        attempt: 1,
        purpose: "agent",
        provider: "gemini",
        modelId: "gemini-3.8-flash",
        status: "completed",
        usage: { inputTokens: 800, outputTokens: 200, totalTokens: 1000 },
        estimatedCostUsd: 0.01,
        startedAt: at(startedAt),
        ...values,
      });
    await call("2026-10-10T15:05:00Z");
    await call("2026-10-10T15:20:00Z", {
      usage: { inputTokens: 1500, outputTokens: 500, totalTokens: 2000 },
      estimatedCostUsd: 0.02,
    });
    // A judge call with no reported usage is a cost gap, never zero cost.
    await call("2026-10-10T09:00:00Z", {
      purpose: "judge",
      modelId: "gemini-3.6-flash",
      status: "failed",
      usage: null,
      estimatedCostUsd: null,
    });
    await call("2026-10-05T12:00:00Z", { estimatedCostUsd: 0.5 });
    await call("2026-10-03T23:59:59Z", { estimatedCostUsd: 9 });
    await call("2026-10-10T15:31:00Z", { estimatedCostUsd: 7 });

    const day = await getUsageSeries(1, now);
    assert.deepEqual(day.window.buckets, hourly.buckets);
    assert.deepEqual(
      day.rows.map((row) => [
        row.bucket,
        row.purpose,
        row.modelId,
        row.calls,
        row.totalTokens,
        row.costUsd,
        row.unknownCost,
      ]),
      [
        [
          "2026-10-10T09:00:00.000Z",
          "judge",
          "gemini-3.6-flash",
          1,
          0,
          null,
          1,
        ],
        [
          "2026-10-10T15:00:00.000Z",
          "agent",
          "gemini-3.8-flash",
          2,
          3000,
          0.03,
          0,
        ],
      ],
    );
    assert.equal(day.rows[1]?.inputTokens, 2300);
    assert.equal(day.rows[1].outputTokens, 700);

    const week = await getUsageSeries(7, now);
    assert.deepEqual(
      week.rows.map((row) => [row.bucket, row.purpose, row.calls]),
      [
        ["2026-10-05T00:00:00.000Z", "agent", 1],
        ["2026-10-10T00:00:00.000Z", "judge", 1],
        ["2026-10-10T00:00:00.000Z", "agent", 2],
      ],
      "calls before the first bucket or after the window end are excluded",
    );
    const summary = await getDashboard(7, now);
    assert.equal(summary.calls?.total, "4");
    assert.equal(summary.calls.unknown_cost, "1");
    assert.equal(summary.calls.tokens, 4000);
    assert.equal(summary.calls.cost?.toFixed(2), "0.53");

    const [judgedCase, assertionCase] = [randomUUID(), randomUUID()];
    await database.db.insert(EvalCase).values([
      {
        id: judgedCase,
        name: "judged",
        dataset: "test",
        input: "test",
        assertions: [],
        judge: {
          provider: "gemini",
          modelId: "gemini-3.6-flash",
          rubric: "test",
          threshold: 0.5,
          promptVersion: "test",
        },
      },
      {
        id: assertionCase,
        name: "asserted",
        dataset: "test",
        input: "test",
        assertions: [{ kind: "contains", value: "ok" }],
      },
    ]);
    const evalRun = (
      createdAt: string,
      caseId: string,
      values: Partial<typeof AgentRun.$inferInsert> = {},
    ) => run(createdAt, { mode: "eval", caseId, ...values });
    const score = (runId: string, passed: boolean, judgeScore?: number) =>
      database.db.insert(EvalScore).values({
        runId,
        passed,
        details: [],
        evaluatorVersion: "test",
        judge:
          judgeScore === undefined
            ? null
            : {
                score: judgeScore,
                reason: "test",
                passed: judgeScore >= 0.5,
                promptVersion: "test",
              },
      });
    await score(await evalRun("2026-10-10T10:00:00Z", judgedCase), true, 0.9);
    await score(await evalRun("2026-10-10T11:15:00Z", judgedCase), false, 0.3);
    await evalRun("2026-10-10T12:00:00Z", assertionCase, {
      configuration: configuration("gemini-3.6-flash"),
      status: "failed",
    });
    await evalRun("2026-10-09T08:00:00Z", assertionCase, { status: "queued" });

    const evalsToday = await getEvalSeries(1, now);
    assert.deepEqual(
      evalsToday.rows.map((row) => [
        row.bucket,
        row.modelId,
        row.judgeModelId,
        row.graded,
        row.passed,
        row.failed,
        row.judged,
        row.judgePassed,
        row.judgeScoreSum,
      ]),
      [
        [
          "2026-10-10T10:00:00.000Z",
          "gemini-3.8-flash",
          "gemini-3.6-flash",
          1,
          1,
          0,
          1,
          1,
          0.9,
        ],
        [
          "2026-10-10T11:00:00.000Z",
          "gemini-3.8-flash",
          "gemini-3.6-flash",
          1,
          0,
          0,
          1,
          0,
          0.3,
        ],
        [
          "2026-10-10T12:00:00.000Z",
          "gemini-3.6-flash",
          null,
          0,
          0,
          1,
          0,
          0,
          0,
        ],
      ],
    );
    const evalsWeek = await getEvalSeries(7, now);
    const flash = evalsWeek.rows.filter(
      (row) => row.modelId === "gemini-3.8-flash",
    );
    assert.deepEqual(
      flash.map((row) => [row.bucket, row.runs, row.graded, row.pending]),
      [
        ["2026-10-09T00:00:00.000Z", 1, 0, 1],
        ["2026-10-10T00:00:00.000Z", 2, 2, 0],
      ],
    );
    assert.equal(flash[1]?.judgeScoreSum.toFixed(1), "1.2");
    const evalSummary = (await getDashboard(7, now)).evals;
    assert.deepEqual(
      [evalSummary?.total, evalSummary?.graded, evalSummary?.passed],
      ["4", "2", "1"],
    );
  } finally {
    await pool.end();
    await database.close();
  }
});
