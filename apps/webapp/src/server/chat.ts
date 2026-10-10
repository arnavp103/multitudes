"use server";

import { z } from "zod/v4";

import { submitRun } from "@multitudes/agent";
import { SYSTEM_PROMPT } from "@multitudes/agent/prompts";
import { getOwnedRun } from "@multitudes/db/runs";
import { withSpan } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

import { getSession } from "~/auth/server";
import { env } from "~/env";

const logger = createLogger("multitudes-webapp");

/** Use server-selected configuration and the authenticated owner, never client identity. */
export async function sendTask(input: string, requestKey: string) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to start a task");
  return withSpan("webapp.submit_task", {}, async () => {
    const id = await submitRun({
      input,
      requestKey,
      ownerId: session.user.id,
      configuration: {
        provider: env.AGENT_PROVIDER,
        modelId: env.AGENT_MODEL_ID,
        codeVersion: env.AGENT_CODE_VERSION,
        systemPrompt: SYSTEM_PROMPT,
      },
    });
    logger.info({ run_id: id }, "Chat task queued");
    return { id };
  });
}

/** Return only the current user's display data; never expose private configuration or errors. */
export async function pollTask(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to view a task");
  const run = await getOwnedRun(z.uuid().parse(id), session.user.id);
  if (!run) throw new Error("Task not found");
  return {
    id: run.id,
    status: run.status,
    input: run.input,
    output: run.output,
    error:
      run.status === "failed"
        ? "The task failed. Start a new task to try again."
        : null,
  };
}
