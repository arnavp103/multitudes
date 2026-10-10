import { startTelemetry } from "@multitudes/observability/node";

// Include Next's rendering and routing spans as well as root requests.
// eslint-disable-next-line no-restricted-properties
process.env.NEXT_OTEL_VERBOSE ??= "1";
startTelemetry("multitudes-studio");
