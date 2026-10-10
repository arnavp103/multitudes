"use client";

import type { Logger } from "pino";
import pino from "pino";

import { APP_VERSION } from "./build-info.generated";

const levels: Record<number, { label: string; color: string }> = {
  10: { label: "TRACE", color: "gray" },
  20: { label: "DEBUG", color: "gray" },
  30: { label: "INFO", color: "#0d9488" },
  40: { label: "WARN", color: "#d97706" },
  50: { label: "ERROR", color: "#dc2626" },
  60: { label: "FATAL", color: "#dc2626" },
};

/**
 * Development-only console sink: a styled `LEVEL hh:mm:ss message` line, with
 * the remaining fields as an inspectable object instead of one opaque record.
 */
export function writeReadable(record: object, output: Console = console) {
  const {
    level = 30,
    time,
    msg,
    version: _version,
    ...fields
  } = record as Record<string, unknown> & { level?: number; time?: number };
  const { label, color } = levels[level] ?? { label: "LOG", color: "inherit" };
  const method =
    level >= 50
      ? "error"
      : level >= 40
        ? "warn"
        : level >= 30
          ? "info"
          : "debug";
  const clock = new Date(time ?? Date.now()).toLocaleTimeString();
  const line = [
    `%c${label}%c ${clock} ${typeof msg === "string" ? msg : ""}`,
    `color:${color};font-weight:bold`,
    "color:inherit",
  ];
  output[method](...line, ...(Object.keys(fields).length ? [fields] : []));
}

/**
 * Browser-only entrypoint: bounded metadata, no Node/OTel imports or network
 * transport. Development builds print readable console lines; every other build
 * keeps pino's structured record objects.
 */
export const browserLogger = pino({
  level: "info",
  base: { version: APP_VERSION },
  browser:
    process.env.NODE_ENV === "development"
      ? { asObject: true, write: (record) => writeReadable(record) }
      : { asObject: true },
});

/** Report a UI boundary failure without exposing user text, URLs, or server messages. */
export function reportClientError(
  component: string,
  error: unknown,
  logger: Logger = browserLogger,
) {
  logger.error(
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
