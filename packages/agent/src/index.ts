import { createHash } from "node:crypto";
import type { Model, Storage } from "@strands-agents/sdk";
import {
  AfterModelCallEvent,
  AfterToolCallEvent,
  Agent,
  BeforeModelCallEvent,
  MessageAddedEvent,
  SessionManager,
  SlidingWindowConversationManager,
  TextBlock,
  ToolResultBlock,
} from "@strands-agents/sdk";
import { z } from "zod/v4";

import type { AgentConfiguration } from "@multitudes/db/schema";
import { createModel } from "@multitudes/ai";
import { enqueueRuns } from "@multitudes/db/runs";
import { captureTraceContext } from "@multitudes/observability/context";
import { createLogger, safeError } from "@multitudes/observability/logger";

import { SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION } from "./prompts/system";
import { createTools } from "./tools";

const logger = createLogger("multitudes-agent");

export const configurationSchema = z
  .object({
    provider: z.literal("gemini"),
    modelId: z.string().min(1).max(256),
    systemPrompt: z.string().min(1).max(32_000),
    codeVersion: z.string().min(1).max(128),
    promptVersion: z.string().min(1).max(128).optional(),
  })
  .transform((config) => ({
    ...config,
    promptVersion:
      config.promptVersion ??
      (config.systemPrompt === SYSTEM_PROMPT
        ? SYSTEM_PROMPT_VERSION
        : `sha256:${createHash("sha256").update(config.systemPrompt).digest("hex")}`),
  }));
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
  toolServices?: Parameters<typeof createTools>[1];
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
    tools: createTools(options.ownerId, options.toolServices),
    // pg-boss owns transient retries. No execution tools are registered.
    retryStrategy: null,
    sandbox: false,
    conversationManager: new SlidingWindowConversationManager({
      windowSize: 40,
      shouldTruncateResults: true,
      proactiveCompression: false,
    }),
    printer: false,
    sessionManager: new SessionManager({
      sessionId: options.runId,
      storage: options.storage,
      saveLatestOn: "message",
    }),
  });
  // Serialize public event data, excluding the agent reference and internal state.
  agent.addHook(MessageAddedEvent, (event) =>
    options.record("message", { v: 1, message: event.message.toJSON() }),
  );
  agent.addHook(BeforeModelCallEvent, () => {
    log.info("Model call started");
    return options.record("model.started", { v: 1, modelId: config.modelId });
  });
  agent.addHook(AfterModelCallEvent, (event) => {
    log.info("Model call finished");
    return options.record("model.finished", {
      v: 1,
      attemptCount: event.attemptCount,
      stopReason: event.stopData?.stopReason,
      error: event.error ? safeError(event.error) : undefined,
    });
  });
  agent.addHook(AfterToolCallEvent, (event) => {
    log.info("Tool call finished");
    if (event.error) {
      const message = ["Task not found", "Authentication required"].includes(
        event.error.message,
      )
        ? event.error.message
        : "Tool execution failed";
      event.result = new ToolResultBlock({
        toolUseId: event.toolUse.toolUseId,
        status: "error",
        content: [new TextBlock(message)],
      });
    }
    return options.record("tool.finished", {
      v: 1,
      toolUse: {
        name: event.toolUse.name,
        toolUseId: event.toolUse.toolUseId,
        input: event.toolUse.input,
      },
      result: event.result.toJSON(),
      error: event.error ? safeError(event.error) : undefined,
    });
  });
  return agent;
}

/** Public server-side SDK entrypoint; returns immediately with the durable run ID. */
export async function submitRun(input: {
  input: string;
  ownerId: string;
  requestKey: string;
  configuration: AgentConfiguration;
}) {
  const configuration = configurationSchema.parse(input.configuration);
  const text = inputSchema.parse(input.input);
  const requestKey = z.uuid().parse(input.requestKey);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ operation: "task", text, configuration }))
    .digest("hex");
  const [id] = await enqueueRuns(
    [
      {
        input: text,
        configuration,
        mode: "production",
        ownerId: input.ownerId,
        traceContext: captureTraceContext(),
      },
    ],
    undefined,
    {
      ownerId: z.string().min(1).parse(input.ownerId),
      key: requestKey,
      fingerprint,
    },
  );
  if (!id) throw new Error("Run was not created");
  logger.info({ run_id: id }, "Agent run submitted");
  return id;
}

export { AGENT_LIMITS, AGENT_TIMEOUT_MS, JUDGE_TIMEOUT_MS } from "./policy";
