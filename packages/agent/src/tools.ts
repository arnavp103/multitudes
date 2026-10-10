import { tool } from "@strands-agents/sdk";
import { z } from "zod/v4";

import { getTaskStatus } from "@multitudes/db/agent-service";
import { withSpan } from "@multitudes/observability/context";

/** Capability allowlist. Tool arguments cannot choose their identity or bypass service authorization. */
export function createTools(actorId?: string, api = { getTaskStatus }) {
  return [
    tool({
      name: "get_task_status",
      description:
        "Read the status and bounded result of a task belonging to the current user. Only use an exact run UUID supplied by the user; do not guess IDs.",
      inputSchema: z.object({ runId: z.uuid() }),
      callback: (input) =>
        withSpan("agent.tool.get_task_status", {}, () =>
          api.getTaskStatus(actorId, input),
        ),
    }),
  ];
}
