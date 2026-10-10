import { startTelemetry } from "@multitudes/observability/node";

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
        console.error(error);
        process.exitCode = 1;
      });
    });
  }
} catch (error) {
  await telemetry.shutdown();
  throw error;
}
