import { createLogger } from "@multitudes/observability/logger";
import { startTelemetry } from "@multitudes/observability/node";

const logger = createLogger("multitudes-agent-worker");
const telemetry = startTelemetry("multitudes-agent-worker");
const { startWorker } = await import("./worker");
const { readEnv } = await import("./env");
const { startHealthServer } = await import("./health");
let ready = false;
let health: Awaited<ReturnType<typeof startHealthServer>> | undefined;

try {
  health = await startHealthServer({
    port: readEnv().PORT,
    isReady: () => ready,
  });
  const stop = await startWorker();
  ready = true;
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    ready = false;
    try {
      await stop();
    } finally {
      await health?.close();
      await telemetry.shutdown();
    }
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown().catch((error: unknown) => {
        logger.error({ err: error }, "Worker shutdown failed");
        process.exitCode = 1;
      });
    });
  }
} catch (error) {
  ready = false;
  logger.fatal({ err: error }, "Worker startup failed");
  await health?.close();
  await telemetry.shutdown();
  // A partially initialized queue/pool must not leave a failed process alive.
  process.exit(1);
}
