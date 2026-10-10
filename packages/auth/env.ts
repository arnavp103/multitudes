import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(32)
          : z.string().min(32).optional(),
      NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}

/** Test helpers must fail closed when loaded in a production process. */
export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}
