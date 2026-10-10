import { z } from "zod/v4";

import { getOwnedRun } from "@multitudes/db/runs";
import { withSpan } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

/** Same service for HTTP/tRPC and agent tools. Identity is supplied by the trusted caller. */
export async function getTaskStatus(
  actorId: string | undefined,
  input: { runId: string },
  lookup = getOwnedRun,
) {
  if (!actorId) throw new Error("Authentication required");
  const { runId } = z.object({ runId: z.uuid() }).parse(input);
  return withSpan("api.task_status", {}, async () => {
    const run = await lookup(runId, actorId);
    if (!run) throw new Error("Task not found");
    createLogger("multitudes-api").debug({ run_id: runId }, "Task status read");
    return {
      id: run.id,
      status: run.status,
      attempts: run.attempts,
      output: run.output?.slice(0, 4000) ?? null,
    };
  });
}

/** Public capability metadata; no credentials, environment values, or private data. */
export function getAgentCapabilities() {
  return {
    tools: ["get_task_status", "get_agent_capabilities"],
    canSendEmail: false,
    canExecuteCode: false,
    persistentMemory: false,
  };
}
