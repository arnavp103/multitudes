import { PgBoss } from "pg-boss";

import { createLogger } from "@multitudes/observability/logger";

export const RUN_QUEUE = "agent-run";
export const RETRY_LIMIT = 2;
const globalQueue = globalThis as typeof globalThis & {
  multitudesQueue?: Promise<PgBoss>;
};

/** Share one initialized queue per process, including Next.js development reloads. */
export function getQueue() {
  globalQueue.multitudesQueue ??= (async () => {
    const queue = new PgBoss({ connectionString: process.env.POSTGRES_URL });
    const logger = createLogger("agent-queue");
    queue.on("error", (err) => logger.error({ err }, "Queue error"));
    try {
      await queue.start();
      await queue.createQueue(RUN_QUEUE, {
        retryLimit: RETRY_LIMIT,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 300,
        heartbeatSeconds: 30,
      });
      return queue;
    } catch (error) {
      await queue.stop();
      throw error;
    }
  })().catch((error: unknown) => {
    globalQueue.multitudesQueue = undefined;
    throw error;
  });
  return globalQueue.multitudesQueue;
}
