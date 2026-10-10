import { sql } from "drizzle-orm";

import { db } from "./client";

/** Server-side aggregates over an explicit window, including every attempt and judge call. */
export async function getDashboard(days: 1 | 7 | 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [runs, calls, models, daily, evals] = await Promise.all([
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
      from agent_run where created_at >= ${since}::timestamptz`),
    db.execute<{
      total: string;
      cost: number | null;
      unknown_cost: string;
      stale: string;
      failed: string;
    }>(sql`
      select count(*)::text as total, sum(estimated_cost_usd) as cost,
        count(*) filter (where estimated_cost_usd is null)::text as unknown_cost,
        count(*) filter (where status='started' and started_at < now()-interval '5 minutes')::text as stale,
        count(*) filter (where status='failed')::text as failed
      from model_call where started_at >= ${since}::timestamptz`),
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
      from model_call where started_at >= ${since}::timestamptz
      group by provider, model_id, purpose order by cost desc nulls last`),
    db.execute<{ day: string; calls: string; cost: number | null }>(sql`
      select to_char(started_at at time zone 'UTC', 'YYYY-MM-DD') as day,
        count(*)::text as calls, sum(estimated_cost_usd) as cost
      from model_call where started_at >= ${since}::timestamptz group by day order by day`),
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
      where r.mode='eval' and r.created_at >= ${since}::timestamptz`),
  ]);
  return {
    runs: runs.rows[0],
    calls: calls.rows[0],
    models: models.rows,
    daily: daily.rows,
    evals: evals.rows[0],
  };
}
