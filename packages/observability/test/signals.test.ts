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
  const sdk = startTelemetry("signals-test", {
    sampler: {
      shouldSample: () => ({ decision: 2 }),
      toString: () => "TestAlwaysOn",
    },
    traceExporter: {
      export(spans, done) {
        spanNames.push(...spans.map((span) => span.name));
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
            { apiKey: "private-test-value", run_id: "test-run" },
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
    assert.equal(records[0].attributes.apiKey, "[REDACTED]");
    assert.ok(!JSON.stringify(records).includes("private-test-value"));
    const collected = await reader.collect();
    assert.ok(
      collected.resourceMetrics.scopeMetrics.some((scope) =>
        scope.metrics.some((metric) => metric.descriptor.name === "test.runs"),
      ),
    );
  } finally {
    await sdk.shutdown();
  }
  assert.deepEqual(spanNames.sort(), ["enqueue", "worker"]);
});
