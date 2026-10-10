import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { createLogger } from "@multitudes/observability/logger";

import * as schema from "./schema";

const globalDb = globalThis as typeof globalThis & { multitudesPool?: pg.Pool };

/** Reuse connections across Next.js development reloads and long-lived workers. */
export const pool =
  globalDb.multitudesPool ??
  new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 10,
  });
if (!globalDb.multitudesPool) {
  pool.on("error", (err) =>
    createLogger("multitudes-db").error(
      { err },
      "Idle database connection failed",
    ),
  );
}
globalDb.multitudesPool = pool;

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
