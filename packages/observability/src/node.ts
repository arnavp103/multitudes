import type { NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import {
  defaultResource,
  envDetector,
  hostDetector,
  processDetector,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import { APP_VERSION, GIT_SHA } from "./build-info.generated";
import { requestObserver } from "./requests";

let sdk: NodeSDK | undefined;

/** Register one application-owned provider for all three signals before app imports. */
export function startTelemetry(
  serviceName: string,
  overrides: Partial<NodeSDKConfiguration> = {},
) {
  if (sdk) return sdk;
  const buildResource = resourceFromAttributes({
    "service.version": APP_VERSION,
    version: APP_VERSION,
    "vcs.ref.head.revision": GIT_SHA,
  });
  sdk = new NodeSDK({
    serviceName,
    spanProcessors: [
      requestObserver(serviceName),
      new BatchSpanProcessor(new OTLPTraceExporter()),
    ],
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
      new PgInstrumentation({
        enhancedDatabaseReporting: false,
        requireParentSpan: true,
      }),
      new RuntimeNodeInstrumentation(),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 15_000,
    }),
    ...overrides,
    resource: (overrides.resource ?? defaultResource()).merge(buildResource),
    // The last detector keeps runtime OTEL_RESOURCE_ATTRIBUTES from replacing the baked identity.
    resourceDetectors: [
      ...(overrides.resourceDetectors ?? [
        envDetector,
        processDetector,
        hostDetector,
      ]),
      { detect: () => buildResource },
    ],
    ...(overrides.traceExporter && !overrides.spanProcessors
      ? {
          spanProcessors: [
            requestObserver(serviceName),
            new BatchSpanProcessor(overrides.traceExporter),
          ],
        }
      : {}),
  });
  sdk.start();
  return sdk;
}
