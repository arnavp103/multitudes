import { metrics } from "@opentelemetry/api";
import { configureLogging } from "@strands-agents/sdk";

import {
  AGENT_LIMITS,
  AGENT_TIMEOUT_MS,
  createAgent,
  JUDGE_TIMEOUT_MS,
} from "@multitudes/agent";
import { createFixtureServices } from "@multitudes/db/agent-service";
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
import { gradeOutput, judgeOutput } from "@multitudes/evals";
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
  const queue = await getQueue("worker");
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
            appendRunEvent(run.id, attempt, type, { ...payload, v: 1 });
          try {
            if (run.configuration.codeVersion !== env.AGENT_CODE_VERSION)
              throw new Error(
                "Run code version does not match this worker; deploy the matching revision",
              );
            await record("attempt.started", {
              codeVersion: env.AGENT_CODE_VERSION,
            });
            const test = run.caseId ? await getCase(run.caseId) : undefined;
            if (run.mode === "eval" && !test)
              throw new Error("Eval case missing");
            const storage = sessionStore(run.id, attempt);
            const receipt = await storage.read("result.json");
            let output: string;
            if (receipt) {
              output = new TextDecoder().decode(receipt);
            } else {
              const agent = createAgent({
                runId: run.id,
                attempt,
                ownerId:
                  run.mode === "eval"
                    ? "eval-fixture"
                    : (run.ownerId ?? undefined),
                toolServices:
                  run.mode === "eval" && test
                    ? createFixtureServices(test.toolFixtures)
                    : undefined,
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
                      AbortSignal.timeout(AGENT_TIMEOUT_MS),
                    ]),
                    limits: AGENT_LIMITS,
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
            let score;
            if (test) {
              const assertions = test.assertions.length
                ? gradeOutput(output, test.assertions)
                : {
                    passed: true,
                    details: [],
                    evaluatorVersion: "text-assertions/v1",
                  };
              let judge;
              if (test.judge) {
                const saved = await storage.read("judge.json");
                if (saved) {
                  const { parseVerdict } = await import("@multitudes/evals");
                  const raw = JSON.parse(new TextDecoder().decode(saved)) as {
                    score: number;
                    reason: string;
                  };
                  judge = parseVerdict(
                    JSON.stringify({ score: raw.score, reason: raw.reason }),
                    test.judge,
                  );
                } else {
                  judge = await judgeOutput({
                    runId: run.id,
                    attempt,
                    input: run.input,
                    output,
                    config: test.judge,
                    signal: AbortSignal.any([
                      job.signal,
                      shutdown.signal,
                      AbortSignal.timeout(JUDGE_TIMEOUT_MS),
                    ]),
                  });
                  await storage.write(
                    "judge.json",
                    new TextEncoder().encode(JSON.stringify(judge)),
                  );
                  await record("judge.result", judge);
                }
              }
              score = {
                ...assertions,
                passed: assertions.passed && (judge?.passed ?? true),
                evaluatorVersion: judge
                  ? "text-and-judge/v1"
                  : assertions.evaluatorVersion,
                judge,
              };
            }
            await finishRun(run.id, attempt, output, score);
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
    logger.info("Worker stopping");
    shutdown.abort();
    await queue.stop({ graceful: true, timeout: 30_000 });
    await pool.end();
  };
}
