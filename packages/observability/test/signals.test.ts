import assert from "node:assert/strict";
import { test } from "node:test";
import { metrics, trace } from "@opentelemetry/api";
import {
  InMemoryLogRecordExporter,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";

import { captureTraceContext, withSpan } from "../src/context";
import { APP_VERSION, GIT_SHA } from "../src/health";
import { createLogger } from "../src/logger";
import { startTelemetry } from "../src/node";

await test("correlates traces, exports redacted Pino logs and collects metrics", async () => {
  const logExporter = new InMemoryLogRecordExporter();
  const logProcessor = new SimpleLogRecordProcessor({ exporter: logExporter });
  const reader = new PeriodicExportingMetricReader({
    exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
    exportIntervalMillis: 60_000,
  });
  const spanNames: string[] = [];
  let exportedUrl: unknown;
  process.env.OTEL_RESOURCE_ATTRIBUTES =
    "service.version=runtime-override,version=runtime-override";
  const sdk = startTelemetry("signals-test", {
    sampler: {
      shouldSample: () => ({ decision: 2 }),
      toString: () => "TestAlwaysOn",
    },
    traceExporter: {
      export(spans, done) {
        spanNames.push(...spans.map((span) => span.name));
        for (const span of spans) {
          assert.equal(
            span.resource.attributes["service.version"],
            APP_VERSION,
          );
          assert.equal(span.resource.attributes.version, APP_VERSION);
          if (span.name === "GET /tasks")
            exportedUrl = span.attributes["http.url"];
        }
        done({ code: 0 });
      },
      shutdown() {
        return Promise.resolve();
      },
    },
    logRecordProcessors: [logProcessor],
    metricReader: reader,
  });
  try {
    const logger = createLogger("signals-test");
    let traceId = "";
    await withSpan("enqueue", {}, async () => {
      traceId = trace.getActiveSpan()?.spanContext().traceId ?? "";
      const carrier = captureTraceContext();
      assert.ok(carrier.traceparent);
      await withSpan(
        "worker",
        {},
        () => {
          assert.equal(trace.getActiveSpan()?.spanContext().traceId, traceId);
          logger.info(
            {
              apiKey: "private-test-value",
              run_id: "test-run",
              input: "private-prompt",
              config: { systemPrompt: "private-system" },
              err: new Error("private-error-body"),
            },
            "attempt completed",
          );
          metrics.getMeter("test").createCounter("test.runs").add(1);
          return Promise.resolve();
        },
        carrier,
      );
    });
    await logProcessor.forceFlush();
    const records = logExporter.getFinishedLogRecords();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.spanContext.traceId, traceId);
    assert.equal(records[0].attributes.version, APP_VERSION);
    assert.equal(
      records[0].resource.attributes["service.version"],
      APP_VERSION,
    );
    assert.equal(
      records[0].resource.attributes["vcs.ref.head.revision"],
      GIT_SHA,
    );
    assert.equal(records[0].attributes.apiKey, "[REDACTED]");
    for (const secret of [
      "private-test-value",
      "private-prompt",
      "private-system",
      "private-error-body",
    ]) {
      assert.ok(!JSON.stringify(records).includes(secret));
    }
    const request = trace.getTracer("next-test").startSpan("GET /tasks", {
      attributes: {
        "next.span_type": "BaseServer.handleRequest",
        "next.route": "/tasks",
        "http.method": "GET",
        "http.status_code": 200,
        "http.url": "https://example.com/tasks?token=private",
      },
    });
    request.end();
    await logProcessor.forceFlush();
    const access = logExporter
      .getFinishedLogRecords()
      .find((record) => record.body === "HTTP request completed");
    assert.ok(access);
    assert.equal(access.attributes.route, "/tasks");
    assert.equal(access.attributes.trace_id, request.spanContext().traceId);
    const collected = await reader.collect();
    assert.equal(
      collected.resourceMetrics.resource.attributes["service.version"],
      APP_VERSION,
    );
    assert.ok(
      collected.resourceMetrics.scopeMetrics.some((scope) =>
        scope.metrics.some(
          (metric) => metric.descriptor.name === "http.server.requests",
        ),
      ),
    );
    assert.ok(
      collected.resourceMetrics.scopeMetrics.some((scope) =>
        scope.metrics.some((metric) => metric.descriptor.name === "test.runs"),
      ),
    );
  } finally {
    await sdk.shutdown();
  }
  assert.deepEqual(spanNames.sort(), ["GET /tasks", "enqueue", "worker"]);
  assert.equal(exportedUrl, "https://example.com/tasks");
});
