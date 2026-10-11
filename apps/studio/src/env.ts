import { z } from "zod/v4";

/** Validate secrets at request time; building the studio requires no production access. */
export function readStudioEnv() {
  return z
    .object({
      STUDIO_URL: z.url().default("http://localhost:3001"),
      STUDIO_AUTH_PRODUCTION_URL: z.url().optional(),
      AUTH_SECRET: z.string().min(32),
      AUTH_DISCORD_ID: z.string().min(1),
      AUTH_DISCORD_SECRET: z.string().min(1),
      AGENT_MODEL_ID: z.string().default("gemini-3.8-flash"),
      AGENT_PROVIDER: z.literal("gemini").default("gemini"),
      AGENT_CODE_VERSION: z.string().min(1),
    })
    .parse(process.env);
}

/**
 * Optional base URL of the Grafana instance holding application performance data
 * (traces, logs, latency and error metrics). Studio links to it only when set.
 */
export function readGrafanaUrl() {
  const url = z
    .url({ protocol: /^https?$/ })
    .optional()
    .parse(process.env.GRAFANA_URL || undefined);
  return url?.replace(/\/+$/, "");
}

/** Next initializes telemetry only in the Node server runtime. */
export function isNodeRuntime() {
  return process.env.NEXT_RUNTIME === "nodejs";
}
