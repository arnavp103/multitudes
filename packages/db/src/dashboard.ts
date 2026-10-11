import { sql } from "drizzle-orm";

import { db } from "./client";

/** Reporting periods offered by the Studio admin dashboard. */
export type DashboardDays = 1 | 7 | 30;

/** Time-series resolution: hourly for the one-day view, daily otherwise. */
export type Granularity = "hour" | "day";

/** A bounded reporting window and the UTC bucket starts that tile it exactly. */
export interface DashboardWindow {
  days: DashboardDays;
  granularity: Granularity;
  /** Inclusive start: the first bucket's start. */
  since: Date;
  /** Exclusive end: the time the window was computed. */
  until: Date;
  /** ISO-8601 UTC bucket starts, oldest first, including the current partial bucket. */
  buckets: string[];
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Align a window to whole UTC buckets so every chart, card, and table covers the
 * same rows: 24 hourly buckets for one day, otherwise `days` daily buckets. The
 * last bucket is the current, still-filling hour or day.
 */
export function dashboardWindow(
  days: DashboardDays,
  now = new Date(),
): DashboardWindow {
  const granularity: Granularity = days === 1 ? "hour" : "day";
  const step = granularity === "hour" ? HOUR_MS : DAY_MS;
  const count = granularity === "hour" ? 24 : days;
  const current = Math.floor(now.getTime() / step) * step;
  const buckets = Array.from({ length: count }, (_, index) =>
    new Date(current - (count - 1 - index) * step).toISOString(),
  );
  return {
    days,
    granularity,
    since: new Date(current - (count - 1) * step),
    until: now,
    buckets,
  };
}

/** Postgres returns epoch milliseconds; charts and tests compare ISO strings. */
const isoBucket = (milliseconds: number) =>
  new Date(milliseconds).toISOString();

/** Summary aggregates over an explicit window, including every attempt and judge call. */
export async function getDashboard(days: DashboardDays, now = new Date()) {
  const window = dashboardWindow(days, now);
  const since = window.since.toISOString();
  const until = window.until.toISOString();
  const [runs, calls, models, evals] = await Promise.all([
    db.execute<{
      total: string;
      completed: string;
      failed: string;
      pending: string;
      retried: string;
      p95_ms: number | null;
    }>(sql`
      select count(*)::text as total,
        count(*) filter (where status = 'completed')::text as completed,
        count(*) filter (where status = 'failed')::text as failed,
        count(*) filter (where status in ('queued','running'))::text as pending,
        count(*) filter (where attempts > 1)::text as retried,
        percentile_cont(0.95) within group (order by extract(epoch from (updated_at-created_at))*1000)
          filter (where status in ('completed','failed')) as p95_ms
      from agent_run where created_at >= ${since}::timestamptz and created_at < ${until}::timestamptz`),
    db.execute<{
      total: string;
      cost: number | null;
      tokens: number | null;
      unknown_cost: string;
      stale: string;
      failed: string;
    }>(sql`
      select count(*)::text as total, sum(estimated_cost_usd) as cost,
        sum((usage->>'totalTokens')::bigint)::float8 as tokens,
        count(*) filter (where estimated_cost_usd is null)::text as unknown_cost,
        count(*) filter (where status='started' and started_at < now()-interval '5 minutes')::text as stale,
        count(*) filter (where status='failed')::text as failed
      from model_call where started_at >= ${since}::timestamptz and started_at < ${until}::timestamptz`),
    db.execute<{
      provider: string;
      model_id: string;
      purpose: string;
      calls: string;
      tokens: string | null;
      cost: number | null;
      unknown_cost: string;
    }>(sql`
      select provider, model_id, purpose, count(*)::text as calls,
        sum((usage->>'totalTokens')::bigint)::text as tokens, sum(estimated_cost_usd) as cost,
        count(*) filter (where estimated_cost_usd is null)::text as unknown_cost
      from model_call where started_at >= ${since}::timestamptz and started_at < ${until}::timestamptz
      group by provider, model_id, purpose order by cost desc nulls last`),
    db.execute<{
      graded: string;
      passed: string;
      judged: string;
      judge_score: number | null;
      total: string;
      failed: string;
    }>(sql`
      select count(*)::text as total, count(s.run_id)::text as graded,
        count(*) filter(where s.passed)::text as passed,
        count(*) filter(where s.judge is not null)::text as judged,
        avg((s.judge->>'score')::double precision) as judge_score,
        count(*) filter(where r.status='failed')::text as failed
      from agent_run r left join eval_score s on s.run_id=r.id
      where r.mode='eval' and r.created_at >= ${since}::timestamptz and r.created_at < ${until}::timestamptz`),
  ]);
  return {
    runs: runs.rows[0],
    calls: calls.rows[0],
    models: models.rows,
    evals: evals.rows[0],
  };
}

/** Model-call totals for one bucket × provider × model × purpose. Absent combinations are zero. */
export interface UsageRow {
  bucket: string;
  provider: string;
  modelId: string;
  purpose: "agent" | "judge";
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Sum of known estimates; null when no call in the group has an estimate. */
  costUsd: number | null;
  /** Calls whose cost is unknown (no rate or no reported usage): a gap, not zero. */
  unknownCost: number;
}

/**
 * Sparse cost and token ledger rows per bucket, bounded to the window. One query
 * serves both the by-model and by-purpose breakdowns; callers pivot it.
 */
export async function getUsageSeries(days: DashboardDays, now = new Date()) {
  const window = dashboardWindow(days, now);
  const result = await db.execute<{
    bucket_ms: number;
    provider: string;
    model_id: string;
    purpose: "agent" | "judge";
    calls: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: number | null;
    unknown_cost: number;
  }>(sql`
    select (extract(epoch from date_trunc(${window.granularity}, started_at, 'UTC')) * 1000)::float8 as bucket_ms,
      provider, model_id, purpose, count(*)::int as calls,
      coalesce(sum((usage->>'inputTokens')::bigint), 0)::float8 as input_tokens,
      coalesce(sum((usage->>'outputTokens')::bigint), 0)::float8 as output_tokens,
      coalesce(sum((usage->>'totalTokens')::bigint), 0)::float8 as total_tokens,
      sum(estimated_cost_usd) as cost,
      count(*) filter (where estimated_cost_usd is null)::int as unknown_cost
    from model_call
    where started_at >= ${window.since.toISOString()}::timestamptz
      and started_at < ${window.until.toISOString()}::timestamptz
    group by 1, provider, model_id, purpose
    order by 1, provider, model_id, purpose`);
  const rows: UsageRow[] = result.rows.map((row) => ({
    bucket: isoBucket(row.bucket_ms),
    provider: row.provider,
    modelId: row.model_id,
    purpose: row.purpose,
    calls: row.calls,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    costUsd: row.cost,
    unknownCost: row.unknown_cost,
  }));
  return { window, rows };
}

/**
 * Eval outcomes for one bucket × candidate model × judge model. Sums, not rates,
 * so callers can re-aggregate along either dimension without averaging averages.
 */
export interface EvalRow {
  bucket: string;
  /** Candidate (agent) model frozen in the run configuration. */
  provider: string;
  modelId: string;
  /** Judge model from the case rubric; null for assertion-only cases. */
  judgeProvider: string | null;
  judgeModelId: string | null;
  runs: number;
  /** Runs with a committed score; the pass-rate denominator. */
  graded: number;
  passed: number;
  /** Execution failures, distinct from failed assertions or judge verdicts. */
  failed: number;
  pending: number;
  judged: number;
  judgePassed: number;
  /** Sum of judge scores (0–1); divide by `judged` for the mean. */
  judgeScoreSum: number;
}

/** Sparse eval-quality rows per bucket of run creation, bounded to the window. */
export async function getEvalSeries(days: DashboardDays, now = new Date()) {
  const window = dashboardWindow(days, now);
  const result = await db.execute<{
    bucket_ms: number;
    provider: string;
    model_id: string;
    judge_provider: string | null;
    judge_model_id: string | null;
    runs: number;
    graded: number;
    passed: number;
    failed: number;
    pending: number;
    judged: number;
    judge_passed: number;
    judge_score_sum: number;
  }>(sql`
    select (extract(epoch from date_trunc(${window.granularity}, r.created_at, 'UTC')) * 1000)::float8 as bucket_ms,
      r.configuration->>'provider' as provider, r.configuration->>'modelId' as model_id,
      c.judge->>'provider' as judge_provider, c.judge->>'modelId' as judge_model_id,
      count(*)::int as runs,
      count(s.run_id)::int as graded,
      count(*) filter (where s.passed)::int as passed,
      count(*) filter (where r.status = 'failed')::int as failed,
      count(*) filter (where r.status in ('queued','running'))::int as pending,
      count(s.judge)::int as judged,
      count(*) filter (where (s.judge->>'passed')::boolean)::int as judge_passed,
      coalesce(sum((s.judge->>'score')::float8), 0)::float8 as judge_score_sum
    from agent_run r
      left join eval_score s on s.run_id = r.id
      left join eval_case c on c.id = r.case_id
    where r.mode = 'eval'
      and r.created_at >= ${window.since.toISOString()}::timestamptz
      and r.created_at < ${window.until.toISOString()}::timestamptz
    group by 1, 2, 3, 4, 5
    order by 1, 2, 3, 4, 5`);
  const rows: EvalRow[] = result.rows.map((row) => ({
    bucket: isoBucket(row.bucket_ms),
    provider: row.provider,
    modelId: row.model_id,
    judgeProvider: row.judge_provider,
    judgeModelId: row.judge_model_id,
    runs: row.runs,
    graded: row.graded,
    passed: row.passed,
    failed: row.failed,
    pending: row.pending,
    judged: row.judged,
    judgePassed: row.judge_passed,
    judgeScoreSum: row.judge_score_sum,
  }));
  return { window, rows };
}
