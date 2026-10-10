import Link from "next/link";

import { getDashboard } from "@multitudes/db/dashboard";
import { Badge } from "@multitudes/ui/badge";
import { buttonVariants } from "@multitudes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@multitudes/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multitudes/ui/table";

import { requireStaff } from "~/server/access";

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

/** Internal operational view. Durable DB records remain visible even when traces are sampled. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const days = params.days === "1" ? 1 : params.days === "30" ? 30 : 7;
  const data = await getDashboard(days);
  const completed = Number(data.runs?.completed ?? 0);
  const failed = Number(data.runs?.failed ?? 0);
  const graded = Number(data.evals?.graded ?? 0);
  const metrics = [
    [
      "Recorded model cost",
      usd(data.calls?.cost),
      `${data.calls?.total ?? 0} calls · agent + judge`,
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
  const max = Math.max(1, ...data.daily.map((item) => Number(item.calls)));
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">Operations / Admin</p>
          <h1>How your agents are doing</h1>
          <p className="muted">
            Quality, reliability, and spending in one place.
          </p>
        </div>
        <nav aria-label="Reporting period" className="flex gap-2">
          {[1, 7, 30].map((value) => (
            <Link
              key={value}
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
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
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
        <Card>
          <CardHeader>
            <CardTitle>Evaluation quality</CardTitle>
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
              Pass rate counts graded runs only. Execution failures and pending
              runs are shown separately. Judge scores are probabilistic;
              calibrate rubrics against human-reviewed cases.
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
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Model calls by day · UTC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.daily.map((day) => (
            <div
              key={day.day}
              className="grid grid-cols-[90px_1fr_110px] items-center gap-4 text-xs"
            >
              <span className="text-muted-foreground">{day.day}</span>
              <div className="bg-muted h-3 rounded">
                <div
                  className="bg-primary h-3 rounded"
                  style={{ width: `${(Number(day.calls) / max) * 100}%` }}
                />
              </div>
              <span className="text-right">
                {day.calls} · {usd(day.cost)}
              </span>
            </div>
          ))}
          {!data.daily.length && (
            <p className="muted">No model calls in this window.</p>
          )}
        </CardContent>
      </Card>
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
