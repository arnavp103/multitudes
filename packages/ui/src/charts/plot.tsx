"use client";

import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useLayoutEffect, useState } from "react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";

import type { ChartDatum, ChartSeries, Granularity, ValueFormat } from "./data";
import { axisTicks, formatBucket, formatValue } from "./data";

/** A numeric value → pixel scale, as produced by `scaleLinear`. */
export type LinearScale = ReturnType<typeof scaleLinear<number>>;

/** Space for axis labels around the plot area. */
export const MARGIN = { top: 12, right: 20, bottom: 28, left: 56 } as const;
/** Minimum horizontal room per x-axis label before labels are thinned. */
const TICK_SPACING = 72;
/** Width used for server rendering and the first client paint, before measuring. */
const INITIAL_WIDTH = 640;

/** Plot geometry handed to a chart's mark renderer. */
export interface PlotGeometry {
  innerWidth: number;
  innerHeight: number;
  /** Index of the hovered or keyboard-focused bucket, if any. */
  active: number | null;
  /** Pixel x of each bucket. */
  x: number[];
  y: LinearScale;
}

/**
 * Track an element's width: measured before first paint, then on every resize.
 * Unlike a debounced observer, the last resize always lands, so charts settle at
 * their final layout.
 */
function useMeasuredWidth(initial: number) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    if (!node) return;
    // The SVG is absolutely positioned, so measuring never feeds back into layout.
    const measure = () => {
      const measured = Math.round(node.getBoundingClientRect().width);
      if (measured > 0) setWidth(measured);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

/** Evenly thin bucket labels so they never collide, always keeping the last one. */
function tickIndices(count: number, innerWidth: number) {
  const step = Math.max(
    1,
    Math.ceil(count / Math.max(2, Math.floor(innerWidth / TICK_SPACING))),
  );
  return Array.from({ length: count }, (_, index) => index).filter(
    (index) => (count - 1 - index) % step === 0,
  );
}

/** Index of the bucket whose x position is nearest the pointer. */
function nearest(positions: readonly number[], x: number) {
  return positions.reduce(
    (best, position, index) =>
      Math.abs(position - x) < Math.abs((positions[best] ?? 0) - x)
        ? index
        : best,
    0,
  );
}

/**
 * Shared plotting surface: measures its container, draws gridlines and axes from
 * theme tokens, and owns the hover/keyboard cursor and tooltip. Arrow keys,
 * Home and End move between buckets; Escape dismisses. A polite live region
 * announces the same readout the tooltip shows. The SVG itself is hidden from
 * assistive technology because the readout and table view carry its data.
 */
export function ChartPlot({
  title,
  data,
  series,
  granularity,
  format,
  height,
  total,
  xPositions,
  yScale,
  children,
}: {
  title: string;
  data: readonly ChartDatum[];
  series: readonly Required<ChartSeries>[];
  granularity: Granularity;
  format: ValueFormat;
  height: number;
  /** Include a stack total row in the readout. */
  total?: boolean;
  /** Pixel x of each bucket within the plot area, for a given inner width. */
  xPositions: (innerWidth: number) => number[];
  yScale: (innerHeight: number) => LinearScale;
  children: (geometry: PlotGeometry) => ReactNode;
}) {
  const [parentRef, width] = useMeasuredWidth(INITIAL_WIDTH);
  const [active, setActive] = useState<number | null>(null);
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const x = xPositions(innerWidth);
  const y = yScale(innerHeight);
  const yTicks = axisTicks(format, y.ticks(4));
  const ticks = tickIndices(data.length, innerWidth);
  const datum = active == null ? undefined : data[active];

  const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
    const point = localPoint(event);
    if (point) setActive(nearest(x, point.x - MARGIN.left));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = data.length - 1;
    const moves: Record<string, () => number | null> = {
      ArrowLeft: () => Math.max(0, (active ?? last + 1) - 1),
      ArrowRight: () => Math.min(last, (active ?? -1) + 1),
      Home: () => 0,
      End: () => last,
      Escape: () => null,
    };
    const move = moves[event.key];
    if (!move || last < 0) return;
    event.preventDefault();
    setActive(move());
  };
  const readout = datum
    ? [
        formatBucket(datum.x, granularity, "full"),
        ...series.map(
          (item) =>
            `${item.label} ${formatValue(format, datum.values[item.key] ?? null)}`,
        ),
        ...(total
          ? [
              `Total ${formatValue(
                format,
                series.reduce(
                  (sum, item) => sum + (datum.values[item.key] ?? 0),
                  0,
                ),
              )}`,
            ]
          : []),
      ].join(", ")
    : "";
  const activeX = active == null ? undefined : x[active];
  const flip = activeX !== undefined && activeX > innerWidth / 2;

  return (
    <div ref={parentRef} className="relative w-full min-w-0" style={{ height }}>
      <div
        role="group"
        aria-roledescription="chart"
        aria-label={`${title}. ${data.length} ${granularity === "hour" ? "hourly" : "daily"} buckets. Use the arrow keys to read values.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="focus-visible:ring-ring/50 absolute inset-0 overflow-hidden rounded-md outline-none focus-visible:ring-[3px]"
      >
        <svg width={width} height={height} aria-hidden className="block">
          <Group left={MARGIN.left} top={MARGIN.top}>
            <GridRows
              scale={y}
              width={innerWidth}
              tickValues={yTicks.map((tick) => tick.value)}
              lineStyle={{ stroke: "var(--border)" }}
              strokeWidth={1}
            />
            {children({ innerWidth, innerHeight, active, x, y })}
            {activeX !== undefined && (
              <line
                x1={activeX}
                x2={activeX}
                y1={0}
                y2={innerHeight}
                className="stroke-muted-foreground/40 pointer-events-none"
                strokeWidth={1}
              />
            )}
            <AxisLeft
              scale={y}
              tickValues={yTicks.map((tick) => tick.value)}
              hideAxisLine
              hideTicks
              tickFormat={(_, index) => yTicks[index]?.label ?? ""}
              tickLabelProps={{
                className: "fill-muted-foreground tabular-nums",
                fontSize: 11,
                textAnchor: "end",
                dx: -4,
                dy: "0.33em",
              }}
            />
            <AxisBottom
              top={innerHeight}
              scale={scaleLinear({
                domain: [0, innerWidth],
                range: [0, innerWidth],
              })}
              tickValues={ticks.map((index) => x[index] ?? 0)}
              tickFormat={(_, index) => {
                const bucket = data[ticks[index] ?? 0];
                return bucket ? formatBucket(bucket.x, granularity) : "";
              }}
              hideTicks
              axisLineClassName="stroke-border"
              tickLabelProps={{
                className: "fill-muted-foreground tabular-nums",
                fontSize: 11,
                textAnchor: "middle",
              }}
            />
            <rect
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setActive(null)}
            />
          </Group>
        </svg>
      </div>
      {datum && activeX !== undefined && (
        <div
          aria-hidden
          className="bg-popover text-popover-foreground pointer-events-none absolute z-10 min-w-40 rounded-md border px-3 py-2 text-xs shadow-md"
          style={{
            top: MARGIN.top,
            left: MARGIN.left + activeX,
            transform: `translateX(${flip ? "calc(-100% - 12px)" : "12px"})`,
          }}
        >
          <p className="text-muted-foreground mb-1.5">
            {formatBucket(datum.x, granularity, "full")}
          </p>
          <ul className="grid gap-1">
            {series.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <span
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="font-semibold tabular-nums">
                  {formatValue(format, datum.values[item.key] ?? null)}
                </span>
                <span className="text-muted-foreground truncate">
                  {item.label}
                </span>
              </li>
            ))}
            {total && series.length > 1 && (
              <li className="mt-1 flex gap-2 border-t pt-1">
                <span className="w-3" />
                <span className="font-semibold tabular-nums">
                  {formatValue(
                    format,
                    series.reduce(
                      (sum, item) => sum + (datum.values[item.key] ?? 0),
                      0,
                    ),
                  )}
                </span>
                <span className="text-muted-foreground">Total</span>
              </li>
            )}
          </ul>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}
