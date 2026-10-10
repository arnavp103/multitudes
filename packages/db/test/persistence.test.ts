import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/** CI supplies a dedicated, disposable PostgreSQL database, never a production URL. */
await test(
  "atomic enqueue, attempt fencing and checkpoint persistence",
  { skip: !process.env.TEST_POSTGRES_URL },
  async () => {
    process.env.POSTGRES_URL = process.env.TEST_POSTGRES_URL;
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
    } = await import("../src/runs");
    let queue: Awaited<ReturnType<typeof getQueue>> | undefined;
    try {
      await pool.query(
        await readFile(
          new URL(
            "../migrations/agents/0000_glorious_namora.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      queue = await getQueue();
      const value = {
        input: "hello",
        configuration: {
          provider: "bedrock" as const,
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
    }
  },
);
