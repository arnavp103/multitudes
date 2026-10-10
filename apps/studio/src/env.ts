import { z } from "zod/v4";

/** Validate secrets at request time; building the studio requires no production access. */
export function readStudioEnv() {
  return z
    .object({
      STUDIO_URL: z.url().default("http://localhost:3001"),
      STUDIO_ALLOWED_EMAILS: z.string().default(""),
      AUTH_SECRET: z.string().min(32),
      AUTH_DISCORD_ID: z.string().min(1),
      AUTH_DISCORD_SECRET: z.string().min(1),
      AGENT_MODEL_ID: z.string().default(""),
      AGENT_PROVIDER: z.enum(["bedrock", "openai"]).default("bedrock"),
      AGENT_CODE_VERSION: z.string().min(1),
    })
    .parse(process.env);
}

/** Next initializes telemetry only in the Node server runtime. */
export function isNodeRuntime() {
  return process.env.NEXT_RUNTIME === "nodejs";
}
