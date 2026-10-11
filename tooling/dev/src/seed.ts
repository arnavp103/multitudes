import { createHash } from "node:crypto";

import type { db } from "@multitudes/db/client";
import type { AgentConfiguration } from "@multitudes/db/schema";
import { eq } from "@multitudes/db";
import {
  AgentRun,
  EvalCase,
  EvalExperiment,
  EvalScore,
  ModelCall,
  user,
} from "@multitudes/db/schema";

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

/** Deterministic 0–1 value per seed string, so demo data is stable across re-seeding. */
const unit = (seed: string) =>
  Number.parseInt(
    createHash("sha256").update(seed).digest("hex").slice(0, 8),
    16,
  ) /
  2 ** 32;
/** Deterministic UUID-shaped identifier per seed string. */
const demoId = (seed: string) => {
  const hex = createHash("sha256").update(`demo:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const DAY_MS = 86_400_000;
const demoConfiguration = (
  modelId: string,
  provider: AgentConfiguration["provider"] = "gemini",
): AgentConfiguration => ({ ...fixtureConfiguration, provider, modelId });
/** Promotional Gemini Flash rates (USD per million tokens), as in packages/ai pricing. */
const DEMO_PRICE = {
  version: "google-standard-2026-10-10",
  input: 0.75,
  cachedInput: 0.075,
  output: 3.75,
  note: "Local demo data.",
};
const judgedCaseId = "00000000-0000-4000-8000-0000000000d1";
const assertedCaseId = "00000000-0000-4000-8000-0000000000d2";
const experimentId = "00000000-0000-4000-8000-0000000000d3";
/** Daily demo eval trials, alternating between two candidate models. */
const EVAL_TRIALS = 12;

/**
 * Local-only demo history for the Studio admin dashboard: 30 days of production
 * and eval runs with agent/judge model calls, scores, a legacy model with unknown
 * cost, and a few execution failures. Identifiers derive from the UTC day, so
 * re-running dev:up tops up recent days without duplicating older ones. Only
 * terminal runs are created, so the worker and reconciler never pick them up.
 * Not used by browser tests, whose assertions rely on the minimal seed above.
 */
export async function seedDemoUsage(database: typeof db, now = new Date()) {
  await database
    .insert(EvalCase)
    .values([
      {
        id: judgedCaseId,
        name: "Demo: summary quality",
        dataset: "demo",
        input: "Summarize this support ticket in two sentences.",
        assertions: [{ kind: "not_contains", value: "As an AI" }],
        judge: {
          provider: "gemini",
          modelId: "gemini-3.6-flash",
          rubric: "Accurate, concise, and mentions the customer's request.",
          threshold: 0.7,
          promptVersion: "demo",
        },
      },
      {
        id: assertedCaseId,
        name: "Demo: refund policy",
        dataset: "demo",
        input: "What is the refund window?",
        assertions: [{ kind: "contains", value: "30 days" }],
      },
    ])
    .onConflictDoNothing();
  await database
    .insert(EvalExperiment)
    .values({
      id: experimentId,
      name: "Demo: nightly regression",
      configuration: demoConfiguration("gemini-3.8-flash"),
    })
    .onConflictDoNothing();
  const today = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  const plans = Array.from({ length: 30 }, (_, ago) => today - ago * DAY_MS)
    .flatMap((day) => {
      const date = new Date(day).toISOString().slice(0, 10);
      const age = (today - day) / DAY_MS;
      const production = 3 + Math.floor(unit(date) * 4);
      // Production traffic, then a daily experiment of trials split across two candidates.
      return Array.from({ length: production + EVAL_TRIALS }, (_, n) => {
        const seed = `${date}:${n}`;
        const createdAt = new Date(
          day + Math.floor(unit(`${seed}:time`) * DAY_MS),
        );
        const trial = n - production;
        const isEval = trial >= 0;
        const legacy = !isEval && age >= 18 && unit(`${seed}:legacy`) < 0.3;
        const modelId = legacy
          ? "deepseek-chat"
          : (isEval ? trial % 2 === 0 : unit(`${seed}:model`) < 0.7)
            ? "gemini-3.8-flash"
            : "gemini-3.6-flash";
        const caseId = !isEval
          ? null
          : trial % 4 < 2
            ? judgedCaseId
            : assertedCaseId;
        return { seed, createdAt, age, isEval, legacy, modelId, caseId };
      });
    })
    .filter((plan) => plan.createdAt < now);
  for (const plan of plans) {
    const id = demoId(`run:${plan.seed}`);
    const failed = unit(`${plan.seed}:failed`) < 0.07;
    const { caseId } = plan;
    const agentCalls = 1 + Math.floor(unit(`${plan.seed}:calls`) * 3);
    const calls: (typeof ModelCall.$inferInsert)[] = Array.from(
      { length: agentCalls },
      (_, index) => {
        const callSeed = `${plan.seed}:call:${index}`;
        const inputTokens = 1200 + Math.floor(unit(`${callSeed}:in`) * 4800);
        const outputTokens = 150 + Math.floor(unit(`${callSeed}:out`) * 750);
        const lost = failed && index === agentCalls - 1;
        const priced = !plan.legacy && !lost;
        return {
          id: demoId(callSeed),
          runId: id,
          attempt: 1,
          purpose: "agent" as const,
          provider: plan.legacy ? "deepseek" : "gemini",
          modelId: plan.modelId,
          status: lost ? ("failed" as const) : ("completed" as const),
          usage: lost
            ? null
            : {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
              },
          estimatedCostUsd: priced
            ? (inputTokens * DEMO_PRICE.input +
                outputTokens * DEMO_PRICE.output) /
              1_000_000
            : null,
          pricing: plan.legacy ? null : DEMO_PRICE,
          errorType: lost ? "DemoTimeout" : null,
          durationMs: 2000 + Math.floor(unit(`${callSeed}:ms`) * 6000),
          startedAt: new Date(plan.createdAt.getTime() + index * 8000),
          finishedAt: new Date(plan.createdAt.getTime() + index * 8000 + 6000),
        };
      },
    );
    const judged = caseId === judgedCaseId && !failed;
    // Candidate quality differs by model and improves over the month.
    const quality =
      (plan.modelId === "gemini-3.8-flash" ? 0.78 : 0.62) +
      (30 - plan.age) * 0.004 +
      (unit(`${plan.seed}:quality`) - 0.5) * 0.3;
    const judgeScore = Math.min(1, Math.max(0, Number(quality.toFixed(2))));
    if (judged) {
      const inputTokens = 900 + Math.floor(unit(`${plan.seed}:jin`) * 1600);
      const outputTokens = 60 + Math.floor(unit(`${plan.seed}:jout`) * 140);
      calls.push({
        id: demoId(`${plan.seed}:judge`),
        runId: id,
        attempt: 1,
        purpose: "judge",
        provider: "gemini",
        modelId: "gemini-3.6-flash",
        status: "completed",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        estimatedCostUsd:
          (inputTokens * DEMO_PRICE.input + outputTokens * DEMO_PRICE.output) /
          1_000_000,
        pricing: DEMO_PRICE,
        durationMs: 1500,
        startedAt: new Date(plan.createdAt.getTime() + agentCalls * 8000),
        finishedAt: new Date(
          plan.createdAt.getTime() + agentCalls * 8000 + 1500,
        ),
      });
    }
    const finishedAt = new Date(
      plan.createdAt.getTime() + calls.length * 8000 + 2000,
    );
    await database
      .insert(AgentRun)
      .values({
        id,
        input: plan.isEval
          ? "Demo eval trial"
          : "Demo: summarize a customer conversation",
        ownerId: plan.isEval ? null : "dev-user",
        configuration: demoConfiguration(
          plan.modelId,
          plan.legacy ? "deepseek" : "gemini",
        ),
        mode: plan.isEval ? "eval" : "production",
        status: failed ? "failed" : "completed",
        output: failed ? null : "Demo result.",
        error: failed ? "Demo: model call timed out" : null,
        attempts: 1,
        traceContext: {},
        experimentId: plan.isEval ? experimentId : null,
        caseId,
        createdAt: plan.createdAt,
        updatedAt: finishedAt,
      })
      .onConflictDoNothing();
    await database.insert(ModelCall).values(calls).onConflictDoNothing();
    if (plan.isEval && !failed) {
      const assertionPassed = unit(`${plan.seed}:assert`) < quality + 0.1;
      const judgePassed = judgeScore >= 0.7;
      await database
        .insert(EvalScore)
        .values({
          runId: id,
          passed: assertionPassed && (!judged || judgePassed),
          details: [],
          evaluatorVersion: "demo",
          judge: judged
            ? {
                score: judgeScore,
                reason: "Demo verdict.",
                passed: judgePassed,
                promptVersion: "demo",
              }
            : null,
          createdAt: finishedAt,
        })
        .onConflictDoNothing();
    }
  }
}
