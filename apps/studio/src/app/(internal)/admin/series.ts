import type { EvalRow, UsageRow } from "@multitudes/db/dashboard";
import type { ChartSeries } from "@multitudes/ui/charts/data";
import {
  keepTopSeries,
  OTHER_SERIES,
  pivotRows,
  ratioOf,
  sumOf,
} from "@multitudes/ui/charts/data";

/** Fixed purpose order, so agent and judge take the same colours in every chart. */
const PURPOSES: ChartSeries[] = [
  { key: "agent", label: "Agent" },
  { key: "judge", label: "Judge" },
];

const modelKey = (provider: string, modelId: string) =>
  `${provider}/${modelId}`;

/** Label a model series; folded long-tail models read as "Other models". */
const modelSeries = (keys: readonly string[]): ChartSeries[] =>
  keys.map((key) => ({
    key,
    label: key === OTHER_SERIES ? "Other models" : key,
  }));

/**
 * Cost and token time series, broken down by model and by purpose. Models
 * beyond the palette fold into "Other models", ranked by window tokens (which,
 * unlike cost, also counts models without a known rate).
 */
export function usageCharts(buckets: readonly string[], rows: UsageRow[]) {
  const byModel = keepTopSeries(
    rows,
    (row) => modelKey(row.provider, row.modelId),
    (row) => row.totalTokens,
  );
  const model = {
    buckets,
    bucketOf: (row: UsageRow) => row.bucket,
    seriesOf: byModel,
  };
  const purpose = {
    buckets,
    bucketOf: (row: UsageRow) => row.bucket,
    seriesOf: (row: UsageRow) => row.purpose,
  };
  // Calls whose cost is entirely unknown are a gap ("—"), never $0.
  const cost = (group: readonly UsageRow[]) =>
    group.length && group.every((row) => row.costUsd == null)
      ? null
      : sumOf<UsageRow>((row) => row.costUsd ?? 0)(group);
  const tokens = sumOf<UsageRow>((row) => row.totalTokens);
  const costByModel = pivotRows(rows, { ...model, aggregate: cost });
  return {
    models: modelSeries(costByModel.keys),
    purposes: PURPOSES,
    costByModel: costByModel.data,
    costByPurpose: pivotRows(rows, { ...purpose, aggregate: cost }).data,
    tokensByModel: pivotRows(rows, { ...model, aggregate: tokens }).data,
    tokensByPurpose: pivotRows(rows, { ...purpose, aggregate: tokens }).data,
  };
}

/** Eval outcome categories, stacked in reading order from success to not-yet-graded. */
const OUTCOMES: ChartSeries[] = [
  { key: "passed", label: "Passed" },
  { key: "failedGrading", label: "Failed checks" },
  { key: "failed", label: "Execution failures" },
  { key: "pending", label: "Pending" },
];

const outcomeValue: Record<string, (row: EvalRow) => number> = {
  passed: (row) => row.passed,
  failedGrading: (row) => row.graded - row.passed,
  failed: (row) => row.failed,
  pending: (row) => row.pending,
};

/**
 * Eval quality time series: candidate pass rate by agent model, judge mean score
 * by judge model, and outcome volumes. Rates are recomputed from sums so buckets
 * are weighted by graded runs, never averages of averages; buckets without graded
 * runs are gaps, not 0%.
 */
export function evalCharts(buckets: readonly string[], rows: EvalRow[]) {
  const bucketOf = (row: EvalRow) => row.bucket;
  const candidates = keepTopSeries(
    rows,
    (row) => modelKey(row.provider, row.modelId),
    (row) => row.runs,
  );
  const judgedRows = rows.filter(
    (row): row is EvalRow & { judgeProvider: string; judgeModelId: string } =>
      row.judgeProvider != null && row.judgeModelId != null && row.judged > 0,
  );
  const judges = keepTopSeries(
    judgedRows,
    (row) => modelKey(row.judgeProvider, row.judgeModelId),
    (row) => row.judged,
  );
  const passRate = pivotRows(rows, {
    buckets,
    bucketOf,
    seriesOf: candidates,
    aggregate: ratioOf(
      (row) => row.passed,
      (row) => row.graded,
    ),
  });
  const judgeScore = pivotRows(judgedRows, {
    buckets,
    bucketOf,
    seriesOf: judges,
    aggregate: ratioOf(
      (row) => row.judgeScoreSum,
      (row) => row.judged,
    ),
  });
  const outcomes = buckets.map((x) => {
    const group = rows.filter((row) => row.bucket === x);
    return {
      x,
      values: Object.fromEntries(
        OUTCOMES.map(({ key }) => [
          key,
          group.reduce((sum, row) => sum + (outcomeValue[key]?.(row) ?? 0), 0),
        ]),
      ),
    };
  });
  return {
    candidates: modelSeries(passRate.keys),
    passRate: passRate.data,
    hasGraded: rows.some((row) => row.graded > 0),
    judges: modelSeries(judgeScore.keys),
    judgeScore: judgeScore.data,
    outcomeSeries: OUTCOMES,
    outcomes,
  };
}
