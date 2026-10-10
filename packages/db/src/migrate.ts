import { fileURLToPath } from "node:url";
import type pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/** Serialize migration runners, then apply independent core and agent journals. */
export async function migrateDatabase(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(771034, 1)");
    for (const name of ["core", "agents"]) {
      await migrate(drizzle(client), {
        migrationsFolder: fileURLToPath(
          new URL(`../migrations/${name}`, import.meta.url),
        ),
        migrationsSchema: "drizzle",
        migrationsTable:
          name === "agents" ? "agent_migrations" : "core_migrations",
      });
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(771034, 1)");
    client.release();
  }
}
