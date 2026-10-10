import type { Attributes } from "@opentelemetry/api";
import {
  context,
  propagation,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";

import { safeError } from "./logger";

/** Serialize W3C context into a durable job payload. */
export function captureTraceContext() {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/** Restore queued context and close the span on every success or failure path. */
export function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T>,
  carrier?: Record<string, string>,
): Promise<T> {
  const parent = carrier
    ? propagation.extract(context.active(), carrier)
    : context.active();
  return context.with(parent, () =>
    trace
      .getTracer("multitudes")
      .startActiveSpan(name, { attributes }, async (span) => {
        try {
          return await fn();
        } catch (error) {
          const safe = safeError(error);
          span.recordException({
            name: safe.type,
            message: "Operation failed; inspect correlated logs",
            stack: "frames" in safe ? safe.frames : undefined,
          });
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      }),
  );
}
