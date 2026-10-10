import { Writable } from "node:stream";
import { context, isSpanContextValid, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import pino from "pino";

import { APP_VERSION } from "./build-info.generated";

/** Create JSON logs and export the same redacted records through the OTel provider. */
export function createLogger(
  service: string,
  level = process.env.LOG_LEVEL ?? "info",
) {
  const otel = logs.getLogger(service);
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      try {
        const record = JSON.parse(chunk.toString()) as Record<string, unknown>;
        const { msg, level: severity, time, ...fields } = record;
        otel.emit({
          body: typeof msg === "string" ? msg : "",
          severityNumber:
            severity === 60
              ? 21
              : severity === 50
                ? 17
                : severity === 40
                  ? 13
                  : severity === 30
                    ? 9
                    : 5,
          timestamp: typeof time === "number" ? new Date(time) : new Date(),
          context: context.active(),
          attributes: Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
              key,
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
                ? value
                : JSON.stringify(value),
            ]),
          ),
        });
      } catch {
        // Export failures must not interrupt the application or recurse into logging.
      }
      callback();
    },
  });
  return pino(
    {
      level,
      base: { service, version: APP_VERSION },
      serializers: { err: safeError },
      redact: {
        paths: [
          "authorization",
          "cookie",
          "password",
          "apiKey",
          "token",
          "secret",
          "input",
          "output",
          "systemPrompt",
          "messages",
          "*.authorization",
          "*.cookie",
          "*.password",
          "*.apiKey",
          "*.token",
          "*.secret",
          "*.input",
          "*.output",
          "*.systemPrompt",
          "*.messages",
          "req.headers.authorization",
          "req.headers.cookie",
        ],
        censor: "[REDACTED]",
      },
      mixin() {
        const span = trace.getSpan(context.active())?.spanContext();
        return span && isSpanContextValid(span)
          ? { trace_id: span.traceId, span_id: span.spanId }
          : {};
      },
    },
    pino.multistream([
      { stream: process.stdout, level: "trace" },
      { stream: sink, level: "trace" },
    ]),
  );
}

/** Error messages/causes can contain SQL parameters, provider bodies, or secrets. */
export function safeError(error: unknown) {
  if (!(error instanceof Error)) return { type: "UnknownError" };
  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  return {
    type: error.name,
    code,
    frames: error.stack
      ?.split("\n")
      .filter((line) => /^\s+at /.test(line))
      .join("\n"),
  };
}
