import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { createTestDatabase } from "../src/testing";

/** CI supplies a dedicated, disposable PostgreSQL database, never a production URL. */
await test("atomic enqueue, attempt fencing and checkpoint persistence", async () => {
  const database = await createTestDatabase();
  process.env.POSTGRES_URL = database.url;
  const { pool } = await import("../src/client");
  const { getQueue, RUN_QUEUE } = await import("../src/queue");
  const {
    enqueueRuns,
    beginAttempt,
    sessionStore,
    appendRunEvent,
    getRunEvents,
    finishRun,
    reconcileRuns,
    getRun,
    getOwnedRun,
  } = await import("../src/runs");
  let queue: Awaited<ReturnType<typeof getQueue>> | undefined;
  try {
    queue = await getQueue();
    const value = {
      input: "hello",
      ownerId: "alice",
      configuration: {
        provider: "gemini" as const,
        modelId: "test",
        systemPrompt: "test",
        codeVersion: "test",
      },
      mode: "production" as const,
      traceContext: {},
    };
    const [id] = await enqueueRuns([value]);
    assert.ok(id);
    assert.ok(await queue.getJobById(RUN_QUEUE, id));
    assert.equal((await getOwnedRun(id, "alice"))?.id, id);
    assert.equal(await getOwnedRun(id, "bob"), undefined);
    await beginAttempt(id, 1);
    await sessionStore(id, 1).write(
      "checkpoint",
      new Uint8Array([0, 255, 128, 42]),
    );
    await beginAttempt(id, 2);
    assert.deepEqual(
      await sessionStore(id, 2).read("checkpoint"),
      new Uint8Array([0, 255, 128, 42]),
    );
    await assert.rejects(
      sessionStore(id, 1).write("checkpoint", new Uint8Array([1])),
      /superseded/,
    );
    await assert.rejects(appendRunEvent(id, 1, "stale", {}), /superseded/);
    await appendRunEvent(id, 2, "resumed", {});
    assert.equal((await getRunEvents(id)).length, 1);
    const { startModelCall, finishModelCall } = await import("../src/usage");
    const { getDashboard } = await import("../src/dashboard");
    const callId = randomUUID();
    await startModelCall({
      id: callId,
      runId: id,
      attempt: 2,
      purpose: "agent",
      provider: "gemini",
      modelId: "fixture",
      pricing: null,
    });
    const callResult = {
      status: "completed" as const,
      usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      estimatedCostUsd: 0.125,
      durationMs: 100,
    };
    await finishModelCall(callId, callResult);
    await finishModelCall(callId, callResult);
    await assert.rejects(
      startModelCall({
        id: randomUUID(),
        runId: id,
        attempt: 1,
        purpose: "judge",
        provider: "gemini",
        modelId: "fixture",
        pricing: null,
      }),
      /superseded/,
    );
    const dashboard = await getDashboard(7);
    assert.equal(dashboard.calls?.total, "1");
    assert.equal(dashboard.calls.cost, 0.125);
    assert.equal(dashboard.models[0]?.purpose, "agent");
    assert.equal(dashboard.models[0].tokens, "110");
    await finishRun(id, 2, "done");
    assert.equal((await getRun(id))?.status, "completed");
    assert.equal(await beginAttempt(id, 3), undefined);
    const before = await pool.query<{ count: string }>(
      "select count(*)::text as count from agent_run",
    );
    await assert.rejects(
      enqueueRuns([value, { ...value, caseId: randomUUID() }]),
    );
    const after = await pool.query<{ count: string }>(
      "select count(*)::text as count from agent_run",
    );
    assert.equal(after.rows[0]?.count, before.rows[0]?.count);
    const jobs = await queue.findJobs(RUN_QUEUE);
    assert.equal(
      jobs.length,
      1,
      "failed transaction must not leave an orphan queue job",
    );
    const key = randomUUID();
    const receipt = { ownerId: "alice", key, fingerprint: "same-request" };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => enqueueRuns([value], undefined, receipt)),
    );
    assert.equal(
      new Set(results.map(([id]) => id)).size,
      1,
      "concurrent retries must share one run",
    );
    assert.deepEqual(
      await enqueueRuns([value], undefined, receipt),
      results[0],
      "lost response replay returns the original run",
    );
    await assert.rejects(
      enqueueRuns([value], undefined, { ...receipt, fingerprint: "changed" }),
      /different request/,
    );
    const otherOwner = await enqueueRuns(
      [{ ...value, ownerId: "bob" }],
      undefined,
      { ...receipt, ownerId: "bob" },
    );
    assert.notDeepEqual(otherOwner, results[0]);
    const failedKey = randomUUID();
    await assert.rejects(
      enqueueRuns([{ ...value, experimentId: randomUUID() }], undefined, {
        ...receipt,
        key: failedKey,
      }),
    );
    const retried = await enqueueRuns([value], undefined, {
      ...receipt,
      key: failedKey,
    });
    assert.equal(
      retried.length,
      1,
      "rolled-back admission key remains reusable",
    );
    const queued = await queue.findJobs(RUN_QUEUE);
    assert.equal(queued.filter((job) => job.id === results[0]?.[0]).length, 1);
    const [cancelledId] = await enqueueRuns([value]);
    assert.ok(cancelledId);
    await beginAttempt(cancelledId, 1);
    await queue.cancel(RUN_QUEUE, cancelledId);
    await pool.query(
      "update agent_run set updated_at = now() - interval '1 minute' where id = $1",
      [cancelledId],
    );
    await reconcileRuns();
    assert.equal((await getRun(cancelledId))?.status, "failed");
    await assert.rejects(
      sessionStore(cancelledId, 1).write("late", new Uint8Array([1])),
      /superseded/,
    );
  } finally {
    await queue?.stop();
    await pool.end();
    await database.close();
  }
});
