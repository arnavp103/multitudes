import { z } from "zod/v4";

/** Validate secrets at request time; building the studio requires no production access. */
export function readStudioEnv() {
  return z
    .object({
      STUDIO_URL: z.url().default("http://localhost:3001"),
      STUDIO_AUTH_PRODUCTION_URL: z.url().optional(),
      AUTH_SECRET: z.string().min(32),
      AGENT_MODEL_ID: z.string().default("gemini-3.8-flash"),
      AGENT_PROVIDER: z.literal("gemini").default("gemini"),
      AGENT_CODE_VERSION: z.string().min(1),
    })
    .parse(process.env);
}

/** Next initializes telemetry only in the Node server runtime. */
export function isNodeRuntime() {
  return process.env.NEXT_RUNTIME === "nodejs";
}
