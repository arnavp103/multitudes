import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

const globalDb = globalThis as typeof globalThis & { multitudesPool?: pg.Pool };

/** Reuse connections across Next.js development reloads and long-lived workers. */
export const pool =
  globalDb.multitudesPool ??
  new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 10,
  });
globalDb.multitudesPool = pool;

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
