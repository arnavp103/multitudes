import type { Model, Storage } from "@strands-agents/sdk";
import {
  AfterModelCallEvent,
  AfterToolCallEvent,
  Agent,
  BeforeModelCallEvent,
  MessageAddedEvent,
  SessionManager,
} from "@strands-agents/sdk";
import { z } from "zod/v4";

import type { AgentConfiguration } from "@multitudes/db/schema";
import { createModel } from "@multitudes/ai";
import { enqueueRuns } from "@multitudes/db/runs";
import { captureTraceContext } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

import { createTools } from "./tools";

const logger = createLogger("multitudes-agent");

export const configurationSchema = z.object({
  provider: z.literal("gemini"),
  modelId: z.string().min(1).max(256),
  systemPrompt: z.string().min(1).max(32_000),
  codeVersion: z.string().min(1).max(128),
});
export const inputSchema = z.string().min(1).max(64_000);

/** Shared factory for production and evals. Only allowlisted API tools; no memory or sandboxes. */
export function createAgent(options: {
  runId: string;
  configuration: AgentConfiguration;
  storage: Storage;
  record: (type: string, payload: Record<string, unknown>) => Promise<void>;
  model?: Model;
  attempt?: number;
  ownerId?: string;
}) {
  const config = configurationSchema.parse(options.configuration);
  const log = logger.child({ run_id: options.runId, model: config.modelId });
  log.debug("Agent initialized");
  const model =
    options.model ??
    createModel(config, {
      runId: options.runId,
      attempt: options.attempt ?? 1,
      purpose: "agent",
    });
  const agent = new Agent({
    id: "multitudes",
    model,
    systemPrompt: config.systemPrompt,
    tools: createTools(options.ownerId),
    printer: false,
    sessionManager: new SessionManager({
      sessionId: options.runId,
      storage: options.storage,
      saveLatestOn: "message",
    }),
  });
  // Serialize public event data, excluding the agent reference and internal state.
  agent.addHook(MessageAddedEvent, (event) =>
    options.record("message", { message: event.message.toJSON() }),
  );
  agent.addHook(BeforeModelCallEvent, () => {
    log.info("Model call started");
    return options.record("model.started", { modelId: config.modelId });
  });
  agent.addHook(AfterModelCallEvent, (event) => {
    log.info("Model call finished");
    return options.record(
      "model.finished",
      JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    );
  });
  agent.addHook(AfterToolCallEvent, (event) => {
    log.info("Tool call finished");
    return options.record(
      "tool.finished",
      JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    );
  });
  return agent;
}

/** Public server-side SDK entrypoint; returns immediately with the durable run ID. */
export async function submitRun(input: {
  input: string;
  ownerId?: string;
  configuration: AgentConfiguration;
}) {
  const [id] = await enqueueRuns([
    {
      input: inputSchema.parse(input.input),
      configuration: configurationSchema.parse(input.configuration),
      mode: "production",
      ownerId: input.ownerId,
      traceContext: captureTraceContext(),
    },
  ]);
  if (!id) throw new Error("Run was not created");
  logger.info({ run_id: id }, "Agent run submitted");
  return id;
}

export { AGENT_LIMITS, AGENT_TIMEOUT_MS, JUDGE_TIMEOUT_MS } from "./policy";
