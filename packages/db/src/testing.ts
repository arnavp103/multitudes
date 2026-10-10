import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { migrateDatabase } from "./migrate";
import * as schema from "./schema";

/** Create a unique, migrated database. Callers must explicitly supply a disposable test server. */
export async function createTestDatabase(
  connectionString = process.env.TEST_POSTGRES_URL,
) {
  if (!connectionString)
    throw new Error(
      "TEST_POSTGRES_URL must point to a disposable server with CREATEDB permission",
    );
  const admin = new pg.Pool({ connectionString });
  const name = `multitudes_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(connectionString);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString() });
  let created = false;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      await pool.end();
    } finally {
      try {
        if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      } finally {
        await admin.end();
      }
    }
  };
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    await migrateDatabase(pool);
    return {
      name,
      url: url.toString(),
      pool,
      db: drizzle({ client: pool, schema, casing: "snake_case" }),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
