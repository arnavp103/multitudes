import Link from "next/link";

import type { DashboardDays } from "@multitudes/db/dashboard";
import {
  getDashboard,
  getEvalSeries,
  getUsageSeries,
} from "@multitudes/db/dashboard";
import { Badge } from "@multitudes/ui/badge";
import { buttonVariants } from "@multitudes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@multitudes/ui/card";
import { formatValue } from "@multitudes/ui/charts/data";
import { StackedBarChart } from "@multitudes/ui/charts/stacked-bar-chart";
import { TimeSeriesChart } from "@multitudes/ui/charts/time-series-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multitudes/ui/table";

import { readGrafanaUrl } from "~/env";
import { requireStaff } from "~/server/access";
import { evalCharts, usageCharts } from "./series";

const usd = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 4,
      }).format(value);
const rate = (passed: number, total: number) =>
  total ? `${((100 * passed) / total).toFixed(1)}%` : "—";
const WINDOWS: DashboardDays[] = [1, 7, 30];

/**
 * Grafana entry points for application performance. Paths are the Grafana
 * Drilldown apps bundled with grafana/otel-lgtm and Grafana Cloud.
 */
const grafanaLinks = (base: string) => [
  { label: "Traces", href: `${base}/a/grafana-exploretraces-app/explore` },
  { label: "Logs", href: `${base}/a/grafana-lokiexplore-app/explore` },
  {
    label: "Metrics",
    href: `${base}/a/grafana-metricsdrilldown-app/drilldown`,
  },
];

/**
 * Product metrics from the durable Postgres ledger: cost, tokens, and eval
 * quality by model and purpose. Application performance (latency, errors,
 * traces, logs) lives in Grafana, linked when GRAFANA_URL is configured.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const days = WINDOWS.find((value) => String(value) === params.days) ?? 7;
  const now = new Date();
  const [data, usage, evals] = await Promise.all([
    getDashboard(days, now),
    getUsageSeries(days, now),
    getEvalSeries(days, now),
  ]);
  const { buckets, granularity } = usage.window;
  const cost = usageCharts(buckets, usage.rows);
  const quality = evalCharts(buckets, evals.rows);
  const grafana = readGrafanaUrl();
  const completed = Number(data.runs?.completed ?? 0);
  const failed = Number(data.runs?.failed ?? 0);
  const graded = Number(data.evals?.graded ?? 0);
  const period =
    granularity === "hour"
      ? "Hourly, last 24 hours (UTC)"
      : `Daily, last ${days} days (UTC)`;
  const metrics = [
    [
      "Recorded model cost",
      usd(data.calls?.cost),
      `${data.calls?.total ?? 0} calls · ${formatValue("tokens", data.calls?.tokens ?? 0)} tokens · agent + judge`,
    ],
    [
      "Execution success",
      rate(completed, completed + failed),
      `${completed} completed · ${failed} failed`,
    ],
    [
      "Eval pass rate",
      rate(Number(data.evals?.passed ?? 0), graded),
      `${graded} graded / ${data.evals?.total ?? 0} eval runs`,
    ],
    [
      "P95 end-to-end latency",
      data.runs?.p95_ms == null
        ? "—"
        : `${(data.runs.p95_ms / 1000).toFixed(1)}s`,
      "Terminal runs · includes queue and judging",
    ],
  ];
  const common = { granularity, height: 220 } as const;
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">Operations / Admin</p>
          <h1>How your agents are doing</h1>
          <p className="muted">
            Quality and spending from the durable run ledger.
          </p>
        </div>
        <nav aria-label="Reporting period" className="flex gap-2">
          {WINDOWS.map((value) => (
            <Link
              key={value}
              aria-current={days === value ? "page" : undefined}
              className={buttonVariants({
                variant: days === value ? "secondary" : "ghost",
                size: "sm",
              })}
              href={`/admin?days=${value}`}
            >
              {value}d
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([title, value, detail]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-xs font-medium">
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">{value}</p>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                {detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="my-6 flex flex-wrap gap-3">
        <Badge variant="outline">{data.runs?.pending ?? 0} pending runs</Badge>
        <Badge variant="outline">{data.runs?.retried ?? 0} retried runs</Badge>
        <Badge variant="outline">
          {data.calls?.failed ?? 0} failed model calls
        </Badge>
        <Badge variant="outline">
          {data.calls?.unknown_cost ?? 0} calls with unknown cost
        </Badge>
        <Badge variant="outline">
          {data.calls?.stale ?? 0} unfinished calls older than 5m
        </Badge>
      </div>

      <section aria-labelledby="cost-heading" className="mt-10">
        <div className="section-title">
          <h2 id="cost-heading">Cost &amp; tokens</h2>
          <p className="muted">{period}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <StackedBarChart
            {...common}
            title="Estimated cost by model"
            description="Agent and judge calls, including retries. Unknown-rate calls show as — (a gap, not $0)."
            data={cost.costByModel}
            series={cost.models}
            format="usd"
            emptyMessage="No model calls in this window."
          />
          <StackedBarChart
            {...common}
            title="Estimated cost by purpose"
            description="Agent runs versus LLM-judge grading."
            data={cost.costByPurpose}
            series={cost.purposes}
            format="usd"
            emptyMessage="No model calls in this window."
          />
          <TimeSeriesChart
            {...common}
            title="Tokens by model"
            description="Provider-reported input, output and thinking tokens."
            data={cost.tokensByModel}
            series={cost.models}
            format="tokens"
            emptyMessage="No reported token usage in this window."
          />
          <TimeSeriesChart
            {...common}
            variant="area"
            title="Tokens by purpose"
            description="Where token volume goes: answering or grading."
            data={cost.tokensByPurpose}
            series={cost.purposes}
            format="tokens"
            emptyMessage="No reported token usage in this window."
          />
        </div>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Model usage</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Estimate</TableHead>
                  <TableHead>Cost gaps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.models.map((row) => (
                  <TableRow
                    key={`${row.provider}:${row.model_id}:${row.purpose}`}
                  >
                    <TableCell>
                      <span className="block font-medium">{row.model_id}</span>
                      <span className="text-muted-foreground text-xs">
                        {row.provider}
                      </span>
                    </TableCell>
                    <TableCell>{row.purpose}</TableCell>
                    <TableCell>{row.calls}</TableCell>
                    <TableCell>{row.tokens ?? "—"}</TableCell>
                    <TableCell>{usd(row.cost)}</TableCell>
                    <TableCell>{row.unknown_cost}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.models.length && (
              <p className="empty">
                Model usage will appear after your first run.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="eval-heading" className="mt-10">
        <div className="section-title">
          <h2 id="eval-heading">Eval quality</h2>
          <p className="muted">{period} · by run creation time</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TimeSeriesChart
            {...common}
            title="Pass rate by candidate model"
            description="Graded eval runs that passed every assertion and judge. Gaps mean nothing was graded."
            data={quality.passRate}
            series={quality.candidates}
            format="percent"
            yDomain={[0, 1]}
            empty={!quality.hasGraded}
            emptyMessage="No graded eval runs in this window."
          />
          <TimeSeriesChart
            {...common}
            title="Mean judge score by judge model"
            description="LLM-judge scores (0–1). Probabilistic: calibrate rubrics against human-reviewed cases."
            data={quality.judgeScore}
            series={quality.judges}
            format="score"
            yDomain={[0, 1]}
            empty={!quality.judges.length}
            emptyMessage="No judge verdicts in this window."
          />
          <StackedBarChart
            {...common}
            title="Eval outcomes"
            description="Failed checks are graded runs that missed an assertion or judge threshold; execution failures never reached grading."
            data={quality.outcomes}
            series={quality.outcomeSeries}
            format="count"
            emptyMessage="No eval runs in this window."
          />
          <Card>
            <CardHeader>
              <CardTitle>Evaluation summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{data.evals?.judged ?? 0} LLM-judged results</p>
              <p>
                Mean judge score:{" "}
                {data.evals?.judge_score == null
                  ? "—"
                  : data.evals.judge_score.toFixed(2)}
              </p>
              <p>{data.evals?.failed ?? 0} eval execution failures</p>
              <p className="text-muted-foreground text-xs leading-5">
                Pass rate counts graded runs only. Execution failures and
                pending runs are shown separately. Judge cost appears under the
                judge purpose above.
              </p>
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href="/experiments"
              >
                Review experiments
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {grafana && (
        <section aria-labelledby="performance-heading" className="mt-10">
          <Card>
            <CardHeader>
              <CardTitle id="performance-heading">
                Application performance
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-muted-foreground max-w-2xl text-sm">
                Request latency, errors, traces and logs from OpenTelemetry live
                in Grafana. Search a trace by run ID or build SHA there.
              </p>
              <div className="flex flex-wrap gap-2">
                {grafanaLinks(grafana).map((link) => (
                  <a
                    key={link.label}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <p className="text-muted-foreground mt-6 max-w-4xl text-xs leading-6">
        USD estimates use a rate snapshot captured at call start and
        provider-reported tokens, including cached input and thinking output
        where reported. They include retries and judge calls. Unknown pricing or
        missing usage is a cost gap, not zero. Unfinished requests can incur
        charges even when usage is unavailable. Free credits, discounts, and
        billing adjustments require reconciliation with provider invoices.
      </p>
    </>
  );
}
