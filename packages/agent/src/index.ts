import type { Model, Storage } from "@strands-agents/sdk";
import {
  AfterModelCallEvent,
  AfterToolCallEvent,
  Agent,
  BeforeModelCallEvent,
  MessageAddedEvent,
  SessionManager,
} from "@strands-agents/sdk";
import { BedrockModel } from "@strands-agents/sdk/models/bedrock";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod/v4";

import type { AgentConfiguration } from "@multitudes/db/schema";
import { enqueueRuns } from "@multitudes/db/runs";
import { captureTraceContext } from "@multitudes/observability/context";

export const configurationSchema = z.object({
  provider: z.enum(["bedrock", "openai"]),
  modelId: z.string().min(1).max(256),
  systemPrompt: z.string().min(1).max(32_000),
  codeVersion: z.string().min(1).max(128),
});
export const inputSchema = z.string().min(1).max(64_000);

/** Shared factory for production and evals. No memory, shell, file tools, or sandboxes. */
export function createAgent(options: {
  runId: string;
  configuration: AgentConfiguration;
  storage: Storage;
  record: (type: string, payload: Record<string, unknown>) => Promise<void>;
  model?: Model;
}) {
  const config = configurationSchema.parse(options.configuration);
  const model =
    options.model ??
    (config.provider === "openai"
      ? new OpenAIModel({ modelId: config.modelId, maxTokens: 4096 })
      : new BedrockModel({ modelId: config.modelId, maxTokens: 4096 }));
  const agent = new Agent({
    id: "multitudes",
    model,
    systemPrompt: config.systemPrompt,
    tools: [],
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
  agent.addHook(BeforeModelCallEvent, () =>
    options.record("model.started", { modelId: config.modelId }),
  );
  agent.addHook(AfterModelCallEvent, (event) =>
    options.record(
      "model.finished",
      JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    ),
  );
  agent.addHook(AfterToolCallEvent, (event) =>
    options.record(
      "tool.finished",
      JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    ),
  );
  return agent;
}

/** Public server-side SDK entrypoint; returns immediately with the durable run ID. */
export async function submitRun(input: {
  input: string;
  configuration: AgentConfiguration;
}) {
  const [id] = await enqueueRuns([
    {
      input: inputSchema.parse(input.input),
      configuration: configurationSchema.parse(input.configuration),
      mode: "production",
      traceContext: captureTraceContext(),
    },
  ]);
  if (!id) throw new Error("Run was not created");
  return id;
}
