import type { Config } from "drizzle-kit";

/** Auth and template tables use a separate journal from the existing agent migrations. */
export default {
  schema: ["./src/auth-schema.ts", "./src/post-schema.ts"],
  out: "./migrations/core",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "postgres://localhost/multitudes",
  },
  migrations: { table: "core_migrations", schema: "drizzle" },
  casing: "snake_case",
} satisfies Config;
