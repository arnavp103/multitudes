import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { migrateDatabase } from "./migrate";
import * as schema from "./schema";

/** Drop only after clients drain; a leaked client is a cleanup failure. */
async function dropTestDatabase(admin: pg.Pool, name: string) {
  // Pool shutdown can resolve before PostgreSQL observes the socket closing.
  // Do not force-kill a draining client: that emits an asynchronous FATAL
  // into the test that just passed. Leaked clients must fail cleanup.
  for (let attempt = 0; ; attempt++) {
    try {
      await admin.query(`DROP DATABASE "${name}"`);
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== "55006" || attempt >= 9)
        throw error;
      await setTimeout(100);
    }
  }
}

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
        if (created) await dropTestDatabase(admin, name);
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
