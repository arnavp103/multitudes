import type { ReactNode } from "react";
import { useId } from "react";

import { cn } from "@multitudes/ui";

import type { ChartDatum, ChartSeries, Granularity, ValueFormat } from "./data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import { Skeleton } from "../skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";
import { formatBucket, formatValue, stackTotal } from "./data";

/** Props shared by every chart: identity, data, and the three render states. */
export interface ChartProps {
  title: string;
  description?: ReactNode;
  data: readonly ChartDatum[];
  series: readonly ChartSeries[];
  granularity: Granularity;
  format: ValueFormat;
  /** Plot height in CSS pixels, excluding header, legend and table toggle. */
  height?: number;
  /** Render a skeleton while data is unavailable. */
  loading?: boolean;
  /** Override the default "all values are zero or null" emptiness test. */
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
}

/** Legend keys mirror their mark: a swatch for filled marks, a short stroke for lines. */
export function ChartLegend({
  series,
  mark,
}: {
  series: readonly Required<ChartSeries>[];
  mark: "line" | "swatch";
}) {
  if (series.length < 2) return null;
  return (
    <ul
      aria-label="Legend"
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "inline-block shrink-0",
              mark === "line"
                ? "h-0.5 w-3 rounded-full"
                : "size-2.5 rounded-sm",
            )}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Visible table view: every value is reachable without hovering or seeing colour. */
function ChartDataTable({
  title,
  data,
  series,
  granularity,
  format,
  total,
}: Pick<ChartProps, "title" | "data" | "series" | "granularity" | "format"> & {
  total: boolean;
}) {
  return (
    <details className="text-xs">
      <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer select-none">
        Show data table
      </summary>
      <Table className="mt-2 text-xs tabular-nums">
        <caption className="sr-only">{title}</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              {granularity === "hour" ? "Hour (UTC)" : "Day (UTC)"}
            </TableHead>
            {series.map((item) => (
              <TableHead key={item.key} scope="col" className="text-right">
                {item.label}
              </TableHead>
            ))}
            {total && (
              <TableHead scope="col" className="text-right">
                Total
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((datum) => (
            <TableRow key={datum.x}>
              <TableHead scope="row" className="font-normal">
                {formatBucket(datum.x, granularity, "full")}
              </TableHead>
              {series.map((item) => (
                <TableCell key={item.key} className="text-right">
                  {formatValue(format, datum.values[item.key] ?? null)}
                </TableCell>
              ))}
              {total && (
                <TableCell className="text-right font-medium">
                  {formatValue(format, stackTotal(datum, series))}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

/**
 * Card chrome shared by every chart: title, description, legend, plot area, and
 * table view, with loading and empty states that keep the plot's height so the
 * layout never jumps.
 */
export function ChartFrame({
  title,
  description,
  data,
  series,
  granularity,
  format,
  height = 220,
  loading,
  empty,
  emptyMessage = "No data in this window.",
  className,
  mark,
  total = false,
  children,
}: ChartProps & {
  series: readonly Required<ChartSeries>[];
  mark: "line" | "swatch";
  total?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Card className={cn("min-w-0 gap-4", className)}>
      <CardHeader>
        <CardTitle id={titleId}>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid min-w-0 grid-cols-1 gap-4">
        {loading ? (
          <div aria-busy="true" aria-labelledby={titleId} role="status">
            <Skeleton className="w-full" style={{ height }} />
            <span className="sr-only">Loading chart</span>
          </div>
        ) : empty ? (
          <div
            className="text-muted-foreground grid place-items-center rounded-md border border-dashed text-sm"
            style={{ height }}
          >
            {emptyMessage}
          </div>
        ) : (
          <>
            <ChartLegend series={series} mark={mark} />
            {children}
            <ChartDataTable
              title={title}
              data={data}
              series={series}
              granularity={granularity}
              format={format}
              total={total}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
