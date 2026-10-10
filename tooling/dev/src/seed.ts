import type { db } from "@multitudes/db/client";
import { eq } from "@multitudes/db";
import { AgentRun, EvalCase, user } from "@multitudes/db/schema";

export const fixtureConfiguration = {
  provider: "gemini" as const,
  modelId: "gemini-3.8-flash",
  systemPrompt: "Complete the task briefly.",
  codeVersion: "local",
};
/** Stable keys make repeated seeding safe; existing users and their access are never overwritten. */
export async function seed(database: typeof db) {
  for (const role of ["admin", "evaluator", "viewer", "user"]) {
    await database
      .insert(user)
      .values({
        id: `dev-${role}`,
        email: `${role}@multitudes.test`,
        name: `Local ${role}`,
        role,
        emailVerified: true,
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
