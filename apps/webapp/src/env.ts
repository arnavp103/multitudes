import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

import { authEnv } from "@multitudes/auth/env";

export const env = createEnv({
  extends: [authEnv()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    POSTGRES_URL: z.url(),
    WEBAPP_URL: z.url().default("http://localhost:3000"),
    AUTH_PRODUCTION_URL: z.url().optional(),
    AGENT_PROVIDER: z.literal("gemini").default("gemini"),
    AGENT_MODEL_ID: z.string().default("gemini-3.8-flash"),
    AGENT_CODE_VERSION: z.string().default("local"),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,

    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});

/** Next initializes telemetry only in the Node server runtime. */
export function isNodeRuntime() {
  return process.env.NEXT_RUNTIME === "nodejs";
}
