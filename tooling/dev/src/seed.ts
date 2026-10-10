import type { db } from "@multitudes/db/client";
import { credentialAccount } from "@multitudes/auth/credentials";
import { eq } from "@multitudes/db";
import { account, AgentRun, EvalCase, user } from "@multitudes/db/schema";

export const fixtureConfiguration = {
  provider: "gemini" as const,
  modelId: "gemini-3.8-flash",
  systemPrompt: "Complete the task briefly.",
  codeVersion: "local",
};
/**
 * Shared password for the seeded `<role>@multitudes.test` accounts. These only
 * exist in the generated local and per-run e2e databases, never in a deployment.
 */
export const DEV_PASSWORD = "multitudes-local";

/** Stable keys make repeated seeding safe; existing users and their access are never overwritten. */
export async function seed(database: typeof db) {
  for (const role of ["admin", "evaluator", "viewer", "user"]) {
    const id = `dev-${role}`;
    await database
      .insert(user)
      .values({
        id,
        email: `${role}@multitudes.test`,
        name: `Local ${role}`,
        role,
        emailVerified: true,
      })
      .onConflictDoNothing();
    await database
      .insert(account)
      .values({
        ...(await credentialAccount(id, DEV_PASSWORD)),
        id: `${id}-credential`,
      })
      .onConflictDoNothing();
  }
  await database
    .insert(AgentRun)
    .values({
      id: "00000000-0000-4000-8000-000000000001",
      input: "Summarize our platform",
      ownerId: "dev-user",
      configuration: fixtureConfiguration,
      mode: "production",
      status: "completed",
      output: "Fixture result: your task completed.",
      traceContext: {},
    })
    .onConflictDoNothing();
  await database
    .insert(EvalCase)
    .values({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Local smoke case",
      dataset: "local",
      input: "Say hello",
      assertions: [{ kind: "contains", value: "Fixture result" }],
    })
    .onConflictDoNothing();
  return (
    await database.select().from(user).where(eq(user.id, "dev-admin"))
  )[0];
}
