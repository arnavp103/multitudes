import type { Instrumentation } from "next";

/** Register once before application imports; Next emits its own render, fetch and request spans. */
export async function register() {
  // Next statically removes Node dependencies from the edge instrumentation bundle.
  // eslint-disable-next-line no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  // eslint-disable-next-line no-restricted-properties
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { createLogger } = await import("@multitudes/observability/logger");
  createLogger("multitudes-studio").error(
    { err: error, route: context.routePath, router: context.routerKind },
    "Request failed",
  );
};
