import { randomUUID } from "node:crypto";
import type {
  BaseModelConfig,
  Message,
  ModelStreamEvent,
  StreamOptions,
  Usage,
} from "@strands-agents/sdk";
import { context, metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { Model } from "@strands-agents/sdk";
import { GoogleModel } from "@strands-agents/sdk/models/google";

import { finishModelCall, startModelCall } from "@multitudes/db/usage";
import { createLogger, safeError } from "@multitudes/observability/logger";

import { estimateCost, getPrice } from "./pricing";

/** Legacy identities remain readable; only Gemini may execute new calls. */
export type Provider = "gemini" | "deepseek" | "openai" | "bedrock";
export interface ModelIdentity {
  provider: Provider;
  modelId: string;
}
export interface CallContext {
  runId: string;
  attempt: number;
  purpose: "agent" | "judge";
}
export const defaultModel: ModelIdentity = {
  provider: "gemini",
  modelId: "gemini-3.8-flash",
};
/** Use the native Google adapter for agents and judges, with one metered HTTP attempt. */
export function createModel(
  identity: ModelIdentity,
  call: CallContext,
  store?: UsageStore,
) {
  if (identity.provider !== "gemini") {
    throw new Error(
      "Unsupported provider: create a new Gemini run or eval case",
    );
  }
  const delegate = new GoogleModel({
    modelId: identity.modelId,
    maxTokens: 4096,
    apiKey: process.env.GEMINI_API_KEY,
    clientConfig: {
      vertexai: false,
      httpOptions: { retryOptions: { attempts: 1 } },
    },
  });
  return meterModel(delegate, identity, call, store);
}

export interface UsageStore {
  start: typeof startModelCall;
  finish: typeof finishModelCall;
}
/** Decorate the SDK stream contract once so agents, retries, and judges share accounting. */
export function meterModel(
  delegate: Model,
  identity: ModelIdentity,
  call: CallContext,
  store: UsageStore = { start: startModelCall, finish: finishModelCall },
): Model {
  // The SDK's abstract Model class is the adapter boundary; application services stay functional.
  return new (class extends Model {
    getConfig() {
      return delegate.getConfig();
    }
    updateConfig(config: BaseModelConfig) {
      delegate.updateConfig(config);
    }
    async *stream(
      messages: Message[],
      options?: StreamOptions,
    ): AsyncIterable<ModelStreamEvent> {
      const id = randomUUID();
      const started = Date.now();
      const pricing = getPrice(
        identity.provider,
        identity.modelId,
        new Date(started),
      );
      const logger = createLogger("multitudes-ai").child({
        call_id: id,
        run_id: call.runId,
        purpose: call.purpose,
        provider: identity.provider,
        model: identity.modelId,
      });
      await store.start({ id, ...call, ...identity, pricing });
      const span = trace
        .getTracer("multitudes-ai")
        .startSpan("gen_ai.generate", {
          attributes: {
            "gen_ai.provider.name": identity.provider,
            "gen_ai.request.model": identity.modelId,
            "gen_ai.operation.name": "chat",
            "run.id": call.runId,
            "call.id": id,
            "call.purpose": call.purpose,
          },
        });
      const ctx = trace.setSpan(context.active(), span);
      let usage: Usage | undefined;
      let completed = false;
      let errorType: string | undefined;
      let iterator: AsyncIterator<ModelStreamEvent> | undefined;
      try {
        iterator = delegate.stream(messages, options)[Symbol.asyncIterator]();
        logger.info("Model request started");
        while (true) {
          const activeIterator = iterator;
          const event = await context.with(ctx, () => activeIterator.next());
          if (event.done) {
            completed = true;
            break;
          }
          if (event.value.type === "modelMetadataEvent" && event.value.usage) {
            usage = event.value.usage;
            // Checkpoint usage immediately, before the consumer can abort the generator.
            await store.finish(id, {
              status: "completed",
              usage,
              estimatedCostUsd: estimateCost(usage, pricing),
              durationMs: Date.now() - started,
            });
          }
          yield event.value;
        }
      } catch (error) {
        errorType = safeError(error).type;
        span.setStatus({ code: SpanStatusCode.ERROR });
        logger.error({ err: error }, "Model request failed");
        throw error;
      } finally {
        try {
          await iterator?.return?.();
        } finally {
          if (!completed) span.setStatus({ code: SpanStatusCode.ERROR });
          const durationMs = Date.now() - started;
          const cost = estimateCost(usage, pricing);
          try {
            await store.finish(id, {
              status: completed ? "completed" : "failed",
              usage,
              estimatedCostUsd: cost,
              durationMs,
              errorType: completed ? undefined : (errorType ?? "Interrupted"),
            });
            const meter = metrics.getMeter("multitudes-ai");
            const attributes = {
              provider: identity.provider,
              model: identity.modelId,
              purpose: call.purpose,
            };
            meter.createCounter("gen_ai.calls").add(1, {
              ...attributes,
              status: completed ? "completed" : "failed",
            });
            meter
              .createHistogram("gen_ai.duration", { unit: "ms" })
              .record(durationMs, attributes);
            if (usage) {
              span.setAttribute("gen_ai.usage.input_tokens", usage.inputTokens);
              span.setAttribute(
                "gen_ai.usage.output_tokens",
                usage.outputTokens,
              );
            }
            if (cost !== null)
              meter
                .createCounter("gen_ai.estimated_cost", { unit: "USD" })
                .add(cost, attributes);
            logger.info(
              {
                duration_ms: durationMs,
                estimated_cost_usd: cost,
                usage_known: !!usage,
              },
              "Model request recorded",
            );
          } finally {
            span.end();
          }
        }
      }
    }
  })();
}
export { estimateCost, getPrice } from "./pricing";
