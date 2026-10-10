import { z } from "zod/v4";

import { withSpan } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

import type { TaskFixtures } from "./agent-schema";
import { getOwnedRun } from "./runs";

/** Same service for HTTP/tRPC and agent tools. Identity is supplied by the trusted caller. */
export async function getTaskStatus(
  actorId: string | undefined,
  input: { runId: string },
  lookup: (
    id: string,
    actorId: string,
  ) => Promise<
    ({ id: string } & TaskFixtures[string]) | undefined
  > = getOwnedRun,
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

/** Validated immutable fixture data shared by authoring and worker admission. */
export const taskFixturesSchema = z
  .record(
    z.uuid(),
    z.object({
      status: z.enum(["queued", "running", "completed", "failed"]),
      attempts: z.number().int().min(0).max(100),
      output: z.string().max(64_000).nullable(),
    }),
  )
  .refine(
    (fixtures) => Object.keys(fixtures).length <= 100,
    "At most 100 task fixtures",
  );

/** Eval tools reuse service validation and response bounds; they never query production runs. */
export function createFixtureServices(input: TaskFixtures) {
  const fixtures = taskFixturesSchema.parse(input);
  return {
    getAgentCapabilities,
    getTaskStatus: (actorId: string | undefined, input: { runId: string }) =>
      getTaskStatus(actorId, input, (id) =>
        Promise.resolve(
          Object.hasOwn(fixtures, id) && fixtures[id]
            ? { id, ...fixtures[id] }
            : undefined,
        ),
      ),
  };
}
