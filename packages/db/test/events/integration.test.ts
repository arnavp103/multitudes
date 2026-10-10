import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { withSpan } from "@multitudes/observability/context";
import { startTelemetry } from "@multitudes/observability/node";

import { createTestDatabase } from "../../src/testing";

/** Exercise the actual service transactions, queue, event ledger and post-commit telemetry. */
await test("business facts commit atomically, deduplicate, correlate, and remain append-only", async () => {
  const database = await createTestDatabase();
  process.env.POSTGRES_URL = database.url;
  const records: { body: unknown; attributes: Record<string, unknown> }[] = [];
  const spanEvents: string[] = [];
  let telemetryAvailable = true;
  const sdk = startTelemetry("events-integration", {
    instrumentations: [],
    metricReader: undefined,
    metricReaders: [],
    logRecordProcessors: [
      {
        onEmit(record) {
          if (!telemetryAvailable)
            throw new Error("test telemetry unavailable");
          records.push({
            body: record.body,
            attributes: { ...record.attributes },
          });
        },
        forceFlush: () => Promise.resolve(),
        shutdown: () => Promise.resolve(),
      },
    ],
    spanProcessors: [
      {
        onStart() {
          /* The test only observes completed spans. */
        },
        onEnd(span) {
          spanEvents.push(...span.events.map((event) => event.name));
        },
        forceFlush: () => Promise.resolve(),
        shutdown: () => Promise.resolve(),
      },
    ],
  });
  const { pool, db } = await import("../../src/client");
  const { AgentRun, Event, EvalScore } = await import("../../src/agent-schema");
  const { and, eq } = await import("drizzle-orm");
  const { withEvents } = await import("../../src/events");
  const { enqueueRuns, beginAttempt, finishRun, failRun, getRun, createCase } =
    await import("../../src/runs");
  const { getQueue, RUN_QUEUE } = await import("../../src/queue");
  const queue = await getQueue();
  const eventsFor = (id: string) =>
    db.select().from(Event).where(eq(Event.runId, id));
  const notifications = () =>
    records.filter(
      (record) => typeof record.attributes["event.name"] === "string",
    );
  const value = {
    input: "private-task-content",
    ownerId: "alice",
    mode: "production" as const,
    traceContext: {},
    configuration: {
      provider: "gemini" as const,
      modelId: "test",
      systemPrompt: "private-system",
      codeVersion: "test",
      promptVersion: "assistant/v1",
    },
  };
  try {
    let sourceId = "";
    await withSpan("submission-and-completion", {}, async () => {
      const receipt = {
        ownerId: "alice",
        key: randomUUID(),
        fingerprint: "same-task",
      };
      const attempts = await Promise.all(
        Array.from({ length: 8 }, () =>
          enqueueRuns([value], undefined, receipt),
        ),
      );
      const id = attempts[0]?.[0];
      assert.ok(id);
      sourceId = id;
      assert.ok(attempts.every((ids) => ids[0] === id));
      assert.ok(await queue.getJobById(RUN_QUEUE, id));
      const submitted = await eventsFor(id);
      assert.equal(submitted.length, 1);
      const submittedEvent = submitted[0];
      assert.ok(submittedEvent);
      assert.equal(submittedEvent.name, "task.submitted");
      assert.match(submittedEvent.traceId ?? "", /^[a-f0-9]{32}$/);
      const log = notifications().find(
        (record) => record.attributes["event.id"] === submittedEvent.id,
      );
      assert.ok(log);
      assert.equal(log.attributes.trace_id, submittedEvent.traceId);
      assert.equal(log.body, "task.submitted");
      await beginAttempt(id, 1);
      assert.equal(await beginAttempt(id, 1), undefined);
      await failRun(id, 1, "private-provider-error", true);
      await beginAttempt(id, 2);
      await assert.rejects(finishRun(id, 1, "stale"), /superseded/);
      const completions = await Promise.allSettled([
        finishRun(id, 2, "private-answer"),
        finishRun(id, 2, "private-answer"),
      ]);
      assert.equal(
        completions.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const facts = await eventsFor(id);
      assert.equal(
        facts.filter((event) => event.name === "task.completed").length,
        1,
      );
      assert.equal(
        facts.filter((event) => event.name === "task.retry_scheduled").length,
        1,
      );
      assert.equal((await getRun(id))?.status, "completed");
    });
    assert.ok(spanEvents.includes("task.submitted"));
    assert.ok(spanEvents.includes("task.completed"));

    const testCase = await createCase(
      {
        name: "Case",
        dataset: "regression",
        input: "private-eval-input",
        assertions: [{ kind: "contains", value: "answer" }],
        sourceRunId: sourceId,
      },
      "staff",
    );
    const promotion = (await eventsFor(sourceId)).find(
      (event) => event.name === "task.promoted_to_eval",
    );
    assert.equal(promotion?.actorId, "staff");
    assert.equal(promotion.payload.caseId, testCase.id);
    const experimentId = randomUUID();
    const trial = {
      ...value,
      mode: "eval" as const,
      ownerId: "staff",
      caseId: testCase.id,
      experimentId,
    };
    await enqueueRuns(
      [trial, trial],
      {
        id: experimentId,
        name: "Experiment",
        configuration: value.configuration,
      },
      { ownerId: "staff", key: randomUUID(), fingerprint: "experiment" },
    );
    const [experiment] = await db
      .select()
      .from(Event)
      .where(
        and(
          eq(Event.name, "experiment.launched"),
          eq(Event.subjectId, experimentId),
        ),
      );
    assert.ok(experiment);
    assert.deepEqual(experiment.payload, { trialCount: 2, caseCount: 1 });

    const beforeEvents = await db.select().from(Event);
    const beforeRuns = await db.select().from(AgentRun);
    const beforeJobs = await queue.findJobs(RUN_QUEUE);
    const beforeNotifications = notifications().length;
    await assert.rejects(
      enqueueRuns([value, { ...value, caseId: randomUUID() }], undefined, {
        ownerId: "alice",
        key: randomUUID(),
        fingerprint: "rolled-back",
      }),
    );
    assert.equal((await db.select().from(Event)).length, beforeEvents.length);
    assert.equal((await db.select().from(AgentRun)).length, beforeRuns.length);
    assert.equal((await queue.findJobs(RUN_QUEUE)).length, beforeJobs.length);
    assert.equal(
      notifications().length,
      beforeNotifications,
      "rollback must not publish committed telemetry",
    );

    const [blockedId] = await enqueueRuns([value]);
    assert.ok(blockedId);
    await beginAttempt(blockedId, 1);
    // Force event storage to fail after the state and score writes, proving shared rollback.
    await pool.query(
      `CREATE FUNCTION reject_test_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = 'task.completed' THEN RAISE EXCEPTION 'test event sink unavailable'; END IF; RETURN NEW; END; $$`,
    );
    await pool.query(
      "CREATE TRIGGER reject_test_completion BEFORE INSERT ON event FOR EACH ROW EXECUTE FUNCTION reject_test_completion()",
    );
    const beforeFailure = notifications().length;
    await assert.rejects(
      finishRun(blockedId, 1, "private-answer", {
        passed: true,
        details: [],
        evaluatorVersion: "test",
      }),
    );
    assert.equal((await getRun(blockedId))?.status, "running");
    assert.equal(
      (await db.select().from(EvalScore).where(eq(EvalScore.runId, blockedId)))
        .length,
      0,
    );
    assert.equal(notifications().length, beforeFailure);
    await pool.query("DROP TRIGGER reject_test_completion ON event");
    await pool.query("DROP FUNCTION reject_test_completion()");
    await failRun(blockedId, 1, "private-error", false);
    assert.equal(
      await beginAttempt(blockedId, 2),
      undefined,
      "terminal failure cannot be revived",
    );
    assert.equal(
      (await eventsFor(blockedId)).filter(
        (event) => event.name === "task.failed",
      ).length,
      1,
    );

    const replay = {
      name: "experiment.launched" as const,
      version: 1 as const,
      subjectType: "experiment" as const,
      subjectId: experimentId,
      actorId: "staff",
      idempotencyKey: `experiment.launched:${experimentId}`,
      payload: { caseCount: 1, trialCount: 2 },
    };
    const beforeReplay = notifications().length;
    const replays = await Promise.all(
      Array.from({ length: 5 }, () => withEvents((_tx, emit) => emit(replay))),
    );
    assert.ok(replays.every((event) => event.id === experiment.id));
    assert.equal(notifications().length, beforeReplay);
    await assert.rejects(
      withEvents(async (tx, emit) => {
        await tx
          .update(AgentRun)
          .set({ output: "should-rollback" })
          .where(eq(AgentRun.id, sourceId));
        await emit({ ...replay, actorId: "different-actor" });
      }),
      /different fact/,
    );
    assert.equal((await getRun(sourceId))?.output, "private-answer");

    await assert.rejects(
      pool.query("UPDATE event SET version = 2 WHERE id = $1", [experiment.id]),
      /append-only/,
    );
    await assert.rejects(
      pool.query("DELETE FROM event WHERE id = $1", [experiment.id]),
      /append-only/,
    );
    await assert.rejects(
      pool.query("DELETE FROM agent_run WHERE id = $1", [sourceId]),
      /foreign key/,
    );
    await assert.rejects(pool.query("TRUNCATE event"), /append-only/);
    assert.ok((await eventsFor(sourceId)).length > 0);
    assert.ok(
      !JSON.stringify(await db.select().from(Event)).includes("private-"),
    );
    assert.ok(!JSON.stringify(notifications()).includes("private-"));
    telemetryAvailable = false;
    const offlineCase = await createCase(
      {
        name: "Without telemetry",
        dataset: "regression",
        input: "input",
        assertions: [{ kind: "contains", value: "ok" }],
      },
      "staff",
    );
    const offlineFacts = await db
      .select()
      .from(Event)
      .where(eq(Event.subjectId, offlineCase.id));
    assert.equal(
      offlineFacts.length,
      1,
      "telemetry failure cannot roll back a committed fact",
    );
    telemetryAvailable = true;
  } finally {
    await queue.stop();
    await pool.end();
    await sdk.shutdown();
    await database.close();
  }
});
