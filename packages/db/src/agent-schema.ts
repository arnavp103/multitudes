import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

/** Immutable run snapshot. Legacy provider values remain readable, but cannot execute. */
export interface AgentConfiguration {
  provider: "gemini" | "deepseek" | "bedrock" | "openai";
  modelId: string;
  systemPrompt: string;
  codeVersion: string;
  promptVersion?: string;
}

export interface EvalAssertion {
  kind: "contains" | "not_contains";
  value: string;
}

/** Frozen historical rubric; new cases only accept Gemini. */
export interface JudgeConfig {
  provider: "gemini" | "deepseek";
  modelId: string;
  rubric: string;
  threshold: number;
  promptVersion: string;
}

/** Frozen tool responses: absent IDs behave like an authorized lookup miss. */
export type TaskFixtures = Record<
  string,
  {
    status: "queued" | "running" | "completed" | "failed";
    attempts: number;
    output: string | null;
  }
>;

/** Every eval case is a frozen input/expectation pair, optionally sourced from a run. */
export const EvalCase = pgTable("eval_case", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),
  name: t.text().notNull(),
  dataset: t.text().notNull(),
  input: t.text().notNull(),
  assertions: t.jsonb().$type<EvalAssertion[]>().notNull(),
  judge: t.jsonb().$type<JudgeConfig>(),
  sourceRunId: t.uuid(),
  toolFixtures: t.jsonb().$type<TaskFixtures>().notNull().default({}),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const EvalExperiment = pgTable("eval_experiment", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),
  name: t.text().notNull(),
  configuration: t.jsonb().$type<AgentConfiguration>().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const AgentRun = pgTable(
  "agent_run",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    input: t.text().notNull(),
    ownerId: t.text(),
    configuration: t.jsonb().$type<AgentConfiguration>().notNull(),
    mode: t.text({ enum: ["production", "eval"] }).notNull(),
    status: t
      .text({ enum: ["queued", "running", "completed", "failed"] })
      .default("queued")
      .notNull(),
    output: t.text(),
    error: t.text(),
    attempts: t.integer().default(0).notNull(),
    traceContext: t.jsonb().$type<Record<string, string>>().notNull(),
    experimentId: t.uuid().references(() => EvalExperiment.id),
    caseId: t.uuid().references(() => EvalCase.id),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [
    index("agent_run_status_updated_idx").on(t.status, t.updatedAt, t.id),
    index("agent_run_created_idx").on(t.createdAt),
    index("agent_run_experiment_idx").on(t.experimentId),
  ],
);

/** Ordered durable trajectory, independent of telemetry sampling and retention. */
export const RunEvent = pgTable(
  "run_event",
  (t) => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    runId: t
      .uuid()
      .notNull()
      .references(() => AgentRun.id, { onDelete: "cascade" }),
    type: t.text().notNull(),
    payload: t.jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [index("run_event_run_idx").on(t.runId, t.id)],
);

export const EvalScore = pgTable("eval_score", (t) => ({
  runId: t
    .uuid()
    .primaryKey()
    .references(() => AgentRun.id, { onDelete: "cascade" }),
  passed: t.boolean().notNull(),
  details: t
    .jsonb()
    .$type<{ assertion: EvalAssertion; passed: boolean }[]>()
    .notNull(),
  evaluatorVersion: t.text().notNull(),
  judge: t.jsonb().$type<{
    score: number;
    reason: string;
    passed: boolean;
    promptVersion: string;
  }>(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

/** Opaque SDK session bytes; keys are scoped to one run, never shared across users. */
export const SessionObject = pgTable(
  "agent_session_object",
  (t) => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    runId: t
      .uuid()
      .notNull()
      .references(() => AgentRun.id, { onDelete: "cascade" }),
    key: t.text().notNull(),
    value: t.text().notNull(),
  }),
  (t) => [uniqueIndex("agent_session_object_key_idx").on(t.runId, t.key)],
);

/** Unsampled, per-attempt model usage ledger. Missing usage/cost stays null, never zero. */
export const ModelCall = pgTable(
  "model_call",
  (t) => ({
    id: t.uuid().primaryKey(),
    runId: t
      .uuid()
      .notNull()
      .references(() => AgentRun.id, { onDelete: "cascade" }),
    attempt: t.integer().notNull(),
    purpose: t.text({ enum: ["agent", "judge"] }).notNull(),
    provider: t.text().notNull(),
    modelId: t.text().notNull(),
    status: t.text({ enum: ["started", "completed", "failed"] }).notNull(),
    usage: t.jsonb().$type<{
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cacheReadInputTokens?: number;
    }>(),
    estimatedCostUsd: t.doublePrecision(),
    pricing: t.jsonb().$type<{
      version: string;
      input: number;
      cachedInput: number;
      output: number;
      note: string;
    }>(),
    errorType: t.text(),
    durationMs: t.integer(),
    startedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    finishedAt: t.timestamp({ withTimezone: true }),
  }),
  (t) => [
    index("model_call_run_idx").on(t.runId),
    index("model_call_started_idx").on(t.startedAt),
  ],
);

/** Admission receipt: a committed request key always resolves to the same jobs. */
export const Submission = pgTable(
  "submission",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    ownerId: t.text().notNull(),
    key: t.uuid().notNull(),
    fingerprint: t.text().notNull(),
    runIds: t.uuid().array().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (t) => [uniqueIndex("submission_owner_key_idx").on(t.ownerId, t.key)],
);
