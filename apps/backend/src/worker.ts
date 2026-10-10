import { metrics } from "@opentelemetry/api";
import { configureLogging } from "@strands-agents/sdk";

import { createAgent } from "@multitudes/agent";
import { pool } from "@multitudes/db/client";
import { getQueue, RETRY_LIMIT, RUN_QUEUE } from "@multitudes/db/queue";
import {
  appendRunEvent,
  beginAttempt,
  failRun,
  finishRun,
  getCase,
  getRun,
  reconcileRuns,
  sessionStore,
} from "@multitudes/db/runs";
import { gradeOutput } from "@multitudes/evals";
import { withSpan } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

import { readEnv } from "./env";

/** Consume durable jobs; snapshots survive crashes and attempt fencing rejects stale writes. */
export async function startWorker() {
  const env = readEnv();
  const logger = createLogger("multitudes-agent-worker", env.LOG_LEVEL);
  configureLogging(logger.child({ component: "strands" }));
  const meter = metrics.getMeter("multitudes-agent-worker");
  const completed = meter.createCounter("agent.runs.completed");
  const duration = meter.createHistogram("agent.run.duration", { unit: "s" });
  const shutdown = new AbortController();
  const queue = await getQueue();
  await queue.work<{ runId: string }>(
    RUN_QUEUE,
    { batchSize: 1, localConcurrency: env.WORKER_CONCURRENCY },
    async ([job]) => {
      if (!job) return;
      const existing = await getRun(job.data.runId);
      if (!existing || existing.status === "completed") return;
      const attempt = job.retryCount + 1;
      const run = await beginAttempt(existing.id, attempt);
      if (!run) return;
      const started = performance.now();
      const log = logger.child({ run_id: run.id, attempt });
      await withSpan(
        "agent.run",
        {
          "run.id": run.id,
          "agent.mode": run.mode,
          "agent.model": run.configuration.modelId,
        },
        async () => {
          const record = (type: string, payload: Record<string, unknown>) =>
            appendRunEvent(run.id, attempt, type, payload);
          try {
            if (run.configuration.codeVersion !== env.AGENT_CODE_VERSION)
              throw new Error(
                "Run code version does not match this worker; deploy the matching revision",
              );
            await record("attempt.started", {
              codeVersion: env.AGENT_CODE_VERSION,
            });
            const storage = sessionStore(run.id, attempt);
            const receipt = await storage.read("result.json");
            let output: string;
            if (receipt) {
              output = new TextDecoder().decode(receipt);
            } else {
              const agent = createAgent({
                runId: run.id,
                configuration: run.configuration,
                storage,
                record,
              });
              try {
                await agent.initialize();
                const result = await agent.invoke(
                  agent.messages.length ? [] : run.input,
                  {
                    cancelSignal: AbortSignal.any([
                      job.signal,
                      shutdown.signal,
                      AbortSignal.timeout(240_000),
                    ]),
                    limits: { turns: 10, totalTokens: 50_000 },
                  },
                );
                if (
                  result.stopReason !== "endTurn" &&
                  result.stopReason !== "stopSequence"
                )
                  throw new Error(`Agent stopped: ${result.stopReason}`);
                output = result.lastMessage.content
                  .filter((block) => block.type === "textBlock")
                  .map((block) => block.text)
                  .join("\n");
                await storage.write(
                  "result.json",
                  new TextEncoder().encode(output),
                );
                await record("result", {
                  output,
                  stopReason: result.stopReason,
                  metrics: JSON.parse(
                    JSON.stringify(result.metrics ?? {}),
                  ) as Record<string, unknown>,
                });
              } finally {
                await agent.shutdown();
              }
            }
            const test = run.caseId ? await getCase(run.caseId) : undefined;
            if (run.caseId && !test) throw new Error("Eval case missing");
            await finishRun(
              run.id,
              attempt,
              output,
              test ? gradeOutput(output, test.assertions) : undefined,
            );
            completed.add(1, { mode: run.mode });
            log.info("Run completed");
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            await failRun(
              run.id,
              attempt,
              message,
              job.retryCount < RETRY_LIMIT,
            );
            log.error({ err: error }, "Run attempt failed");
            throw error;
          } finally {
            duration.record((performance.now() - started) / 1000, {
              mode: run.mode,
            });
          }
        },
        run.traceContext,
      );
    },
  );
  let reconciling = false;
  const reconcile = async () => {
    if (reconciling) return;
    reconciling = true;
    try {
      await reconcileRuns();
    } catch (err) {
      logger.error({ err }, "Run reconciliation failed");
    } finally {
      reconciling = false;
    }
  };
  await reconcile();
  const reconciliation = setInterval(() => {
    void reconcile();
  }, 30_000);
  logger.info("Agent worker ready");
  return async () => {
    clearInterval(reconciliation);
    shutdown.abort();
    await queue.stop({ graceful: true, timeout: 30_000 });
    await pool.end();
  };
}
