import type { Config } from "drizzle-kit";

/** Agent tables have their own migration journal; existing template tables are untouched. */
export default {
  schema: "./src/agent-schema.ts",
  out: "./migrations/agents",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "postgres://localhost/multitudes",
  },
  migrations: { table: "agent_migrations", schema: "drizzle" },
  casing: "snake_case",
} satisfies Config;
