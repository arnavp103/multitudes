import { z } from "zod/v4";

/** Runtime-only validation keeps CI builds independent of credentials. */
export function readEnv() {
  return z
    .object({
      PORT: z.coerce.number().int().min(1).max(65535).default(8080),
      POSTGRES_URL: z.url(),
      LOG_LEVEL: z.string().default("info"),
      WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
      AGENT_CODE_VERSION: z.string().min(1),
    })
    .parse(process.env);
}
