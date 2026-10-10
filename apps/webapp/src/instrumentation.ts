import { isNodeRuntime } from "./env";

/** Register providers before server requests import the shared application packages. */
export async function register() {
  if (isNodeRuntime()) {
    const { startTelemetry } = await import("@multitudes/observability/node");
    startTelemetry("multitudes-webapp");
  }
}
