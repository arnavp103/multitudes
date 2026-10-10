"use client";

import pino from "pino";

/** Browser-only entrypoint: bounded metadata, no Node/OTel imports or network transport. */
export const browserLogger = pino({
  level: "info",
  browser: { asObject: true },
});

/** Report a UI boundary failure without exposing user text, URLs, or server messages. */
export function reportClientError(component: string, error: unknown) {
  browserLogger.error(
    {
      component,
      error_type: error instanceof Error ? error.name : "UnknownError",
      digest:
        error instanceof Error &&
        "digest" in error &&
        typeof error.digest === "string"
          ? error.digest
          : undefined,
    },
    "UI operation failed",
  );
}
