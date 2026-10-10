"use client";

import {
  browserLogger,
  reportClientError,
} from "@multitudes/observability/browser";

/**
 * The webapp's one client-side logger: import this from client components
 * instead of using `@multitudes/observability/browser` directly. Use
 * `~/logger/server` from server code.
 */
export const logger = browserLogger.child({ service: "multitudes-webapp" });

/** Report a UI boundary failure with bounded metadata through the webapp logger. */
export function reportError(component: string, error: unknown) {
  reportClientError(component, error, logger);
}
