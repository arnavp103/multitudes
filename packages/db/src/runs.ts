import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import type { AgentConfiguration, EvalAssertion } from "./agent-schema";
import {
  AgentRun,
  EvalCase,
  EvalExperiment,
  EvalScore,
  RunEvent,
  SessionObject,
} from "./agent-schema";
import { db, pool } from "./client";
import { getQueue, RUN_QUEUE } from "./queue";

export type Run = typeof AgentRun.$inferSelect;
export type NewRun = Pick<
  Run,
  "input" | "configuration" | "mode" | "traceContext"
> &
  Partial<Pick<Run, "experimentId" | "caseId">>;

/** Insert runs and queue jobs on the same Postgres connection/transaction. */
export async function enqueueRuns(
  runs: NewRun[],
  experiment?: { id: string; name: string; configuration: AgentConfiguration },
) {
  const queue = await getQueue();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const transaction = drizzle({ client, casing: "snake_case" });
    if (experiment) await transaction.insert(EvalExperiment).values(experiment);
    const ids: string[] = [];
    for (const run of runs) {
      const id = randomUUID();
      await transaction.insert(AgentRun).values({ ...run, id });
      const job = await queue.send(
        RUN_QUEUE,
        { runId: id },
        {
          id,
          db: { executeSql: (text, values) => client.query(text, values) },
        },
      );
      if (!job) throw new Error("Queue rejected run");
      ids.push(id);
    }
    await client.query("COMMIT");
    return ids;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Fetch a bounded recent history for the internal studio. */
export function listRuns() {
  return db
    .select()
    .from(AgentRun)
    .orderBy(desc(AgentRun.createdAt))
    .limit(100);
}
export async function getRun(id: string) {
  return (await db.select().from(AgentRun).where(eq(AgentRun.id, id)))[0];
}
export function getRunEvents(id: string) {
  return db
    .select()
    .from(RunEvent)
    .where(eq(RunEvent.runId, id))
    .orderBy(asc(RunEvent.id));
}
export function listCases() {
  return db
    .select()
    .from(EvalCase)
    .orderBy(desc(EvalCase.createdAt))
    .limit(500);
}
export async function getCase(id: string) {
  return (await db.select().from(EvalCase).where(eq(EvalCase.id, id)))[0];
}
export async function createCase(value: {
  name: string;
  dataset: string;
  input: string;
  assertions: EvalAssertion[];
  sourceRunId?: string;
}) {
  const [result] = await db.insert(EvalCase).values(value).returning();
  return result;
}
export function listExperiments() {
  return db
    .select()
    .from(EvalExperiment)
    .orderBy(desc(EvalExperiment.createdAt))
    .limit(100);
}
export function getExperimentRuns(id: string) {
  return db
    .select({ run: AgentRun, score: EvalScore })
    .from(AgentRun)
    .leftJoin(EvalScore, eq(EvalScore.runId, AgentRun.id))
    .where(eq(AgentRun.experimentId, id))
    .orderBy(asc(AgentRun.createdAt));
}

/** Retry count is a fencing token: older workers cannot write after a newer attempt starts. */
export async function beginAttempt(id: string, attempt: number) {
  const [run] = await db
    .update(AgentRun)
    .set({
      attempts: attempt,
      status: "running",
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(AgentRun.id, id),
        sql`${AgentRun.attempts} < ${attempt}`,
        sql`${AgentRun.status} <> 'completed'`,
      ),
    )
    .returning();
  return run;
}

async function withAttempt<T>(
  runId: string,
  attempt: number,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select({ id: AgentRun.id })
      .from(AgentRun)
      .where(
        and(
          eq(AgentRun.id, runId),
          eq(AgentRun.attempts, attempt),
          eq(AgentRun.status, "running"),
        ),
      )
      .for("update");
    if (!run) throw new Error("Run attempt superseded");
    return fn(tx);
  });
}

/** Persist semantic events (not individual streaming tokens) before advancing the agent. */
export async function appendRunEvent(
  runId: string,
  attempt: number,
  type: string,
  payload: Record<string, unknown>,
) {
  await withAttempt(runId, attempt, async (tx) => {
    await tx
      .insert(RunEvent)
      .values({ runId, type, payload: { ...payload, attempt } });
  });
}
export async function finishRun(
  runId: string,
  attempt: number,
  output: string,
  score?: {
    passed: boolean;
    details: { assertion: EvalAssertion; passed: boolean }[];
    evaluatorVersion: string;
  },
) {
  await withAttempt(runId, attempt, async (tx) => {
    if (score)
      await tx
        .insert(EvalScore)
        .values({ runId, ...score })
        .onConflictDoUpdate({ target: EvalScore.runId, set: score });
    await tx
      .update(AgentRun)
      .set({ status: "completed", output, error: null, updatedAt: new Date() })
      .where(eq(AgentRun.id, runId));
  });
}
export async function failRun(
  runId: string,
  attempt: number,
  error: string,
  retry: boolean,
) {
  await withAttempt(runId, attempt, async (tx) => {
    await tx
      .update(AgentRun)
      .set({
        status: retry ? "queued" : "failed",
        error,
        updatedAt: new Date(),
      })
      .where(eq(AgentRun.id, runId));
  });
}

/** Raw storage operations used by the Strands session adapter. */
export function sessionStore(runId: string, attempt: number) {
  return {
    async write(key: string, value: Uint8Array) {
      const data = Buffer.from(value).toString("base64");
      await withAttempt(runId, attempt, async (tx) => {
        await tx
          .insert(SessionObject)
          .values({ runId, key, value: data })
          .onConflictDoUpdate({
            target: [SessionObject.runId, SessionObject.key],
            set: { value: data },
          });
      });
    },
    async read(key: string) {
      const [row] = await db
        .select()
        .from(SessionObject)
        .where(and(eq(SessionObject.runId, runId), eq(SessionObject.key, key)));
      return row ? new Uint8Array(Buffer.from(row.value, "base64")) : null;
    },
    async delete(key: string) {
      await withAttempt(runId, attempt, async (tx) => {
        await tx
          .delete(SessionObject)
          .where(
            and(eq(SessionObject.runId, runId), eq(SessionObject.key, key)),
          );
      });
    },
    async list(prefix: string) {
      const rows = await db
        .select({ key: SessionObject.key })
        .from(SessionObject)
        .where(eq(SessionObject.runId, runId))
        .orderBy(asc(SessionObject.key));
      return rows.map((row) => row.key).filter((key) => key.startsWith(prefix));
    },
  };
}

/** Reconcile hard-killed final attempts, which cannot update their own run status. */
export async function reconcileRuns() {
  const candidates = await db
    .select({ id: AgentRun.id, attempts: AgentRun.attempts })
    .from(AgentRun)
    .where(
      and(
        sql`${AgentRun.status} in ('queued', 'running')`,
        sql`${AgentRun.updatedAt} < now() - interval '30 seconds'`,
      ),
    )
    .orderBy(asc(AgentRun.updatedAt))
    .limit(100);
  if (!candidates.length) return;
  const queue = await getQueue();
  for (const run of candidates) {
    const job = await queue.getJobById(RUN_QUEUE, run.id);
    if (job && ["failed", "cancelled", "completed"].includes(job.state)) {
      await db
        .update(AgentRun)
        .set({
          status: "failed",
          error: `Queue reached ${job.state} without a committed run result`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(AgentRun.id, run.id),
            eq(AgentRun.attempts, run.attempts),
            sql`${AgentRun.status} in ('queued', 'running')`,
          ),
        );
    }
  }
}
