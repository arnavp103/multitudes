import { createLogger } from "@multitudes/observability/logger";
import { startTelemetry } from "@multitudes/observability/node";

const logger = createLogger("multitudes-agent-worker");

const telemetry = startTelemetry("multitudes-agent-worker");
const { startWorker } = await import("./worker");

try {
  const stop = await startWorker();
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await stop();
    await telemetry.shutdown();
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
  logger.fatal({ err: error }, "Worker startup failed");
  await telemetry.shutdown();
  throw error;
}
