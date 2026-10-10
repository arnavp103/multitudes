import type { NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import { metrics } from "@opentelemetry/api";

import { createLogger } from "./logger";

type Processor = NonNullable<NodeSDKConfiguration["spanProcessors"]>[number];

/** Turn Next.js root request spans into correlated Pino access logs and HTTP metrics. */
export function requestObserver(serviceName: string): Processor {
  const logger = createLogger(serviceName);
  return {
    onStart() {
      /* Next owns the request span and its lifecycle. */
    },
    onEnd(span) {
      // Strip query strings before subsequent export processors see the ended span.
      for (const key of ["http.url", "url.full", "http.target"]) {
        const value = span.attributes[key];
        if (typeof value === "string")
          span.attributes[key] = value.split("?")[0] ?? "";
      }
      delete span.attributes["url.query"];
      if (span.attributes["next.span_type"] !== "BaseServer.handleRequest")
        return;
      const route = String(
        span.attributes["next.route"] ??
          span.attributes["http.route"] ??
          "unknown",
      );
      const status = Number(
        span.attributes["http.status_code"] ??
          span.attributes["http.response.status_code"] ??
          0,
      );
      const method = String(
        span.attributes["http.method"] ??
          span.attributes["http.request.method"] ??
          "unknown",
      );
      const durationMs = span.duration[0] * 1000 + span.duration[1] / 1_000_000;
      const ids = span.spanContext();
      const fields = {
        route,
        method,
        status,
        duration_ms: durationMs,
        trace_id: ids.traceId,
        span_id: ids.spanId,
      };
      logger[status >= 500 ? "error" : "info"](
        fields,
        "HTTP request completed",
      );
      // Resolve after NodeSDK.start(); meters created during construction would be no-ops.
      const meter = metrics.getMeter("multitudes-http");
      meter
        .createCounter("http.server.requests")
        .add(1, { route, method, status });
      meter
        .createHistogram("http.server.duration", { unit: "ms" })
        .record(durationMs, { route, method, status });
    },
    forceFlush() {
      return Promise.resolve();
    },
    shutdown() {
      return Promise.resolve();
    },
  };
}
