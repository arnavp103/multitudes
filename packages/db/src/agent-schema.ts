import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

/** Immutable configuration selected when a run is enqueued. */
export interface AgentConfiguration {
  provider: "bedrock" | "openai";
  modelId: string;
  systemPrompt: string;
  codeVersion: string;
}

export interface EvalAssertion {
  kind: "contains" | "not_contains";
  value: string;
}

/** Every eval case is a frozen input/expectation pair, optionally sourced from a run. */
export const EvalCase = pgTable("eval_case", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),
  name: t.text().notNull(),
  dataset: t.text().notNull(),
  input: t.text().notNull(),
  assertions: t.jsonb().$type<EvalAssertion[]>().notNull(),
  sourceRunId: t.uuid(),
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
