"use client";

import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";

import type { ChartProps } from "./frame";
import { isEmptyChart, withColors } from "./data";
import { ChartFrame } from "./frame";
import { ChartPlot } from "./plot";

/** Marker radius (≥ 8px diameter) and its surface-coloured ring. */
const MARKER_RADIUS = 4;
const RING = 2;

/** Pixel x of each uniformly spaced bucket; a lone bucket sits in the middle. */
const evenly = (count: number) => (innerWidth: number) =>
  Array.from({ length: count }, (_, index) =>
    count < 2 ? innerWidth / 2 : (index * innerWidth) / (count - 1),
  );

/**
 * Change over time for one or more series, as 2px lines or lines over a 10%
 * area wash. Missing values (null) are skipped and the line joins the samples
 * either side; sparse series then show a marker at every sample so readers can
 * see where data actually exists. Values share one y-axis; never mix units.
 */
export function TimeSeriesChart({
  variant = "line",
  yDomain,
  ...props
}: ChartProps & {
  variant?: "line" | "area";
  /** Fixed y extent, e.g. [0, 1] for rates; otherwise 0 → max, rounded. */
  yDomain?: [number, number];
}) {
  const series = withColors(props.series);
  const height = props.height ?? 220;
  const { data } = props;
  const max = Math.max(
    0,
    ...data.flatMap((datum) => series.map(({ key }) => datum.values[key] ?? 0)),
  );
  return (
    <ChartFrame
      {...props}
      series={series}
      height={height}
      empty={props.empty ?? isEmptyChart(data, series)}
      mark={variant === "area" ? "swatch" : "line"}
    >
      <ChartPlot
        title={props.title}
        data={data}
        series={series}
        granularity={props.granularity}
        format={props.format}
        height={height}
        xPositions={evenly(data.length)}
        yScale={(innerHeight) =>
          scaleLinear({
            domain: yDomain ?? [0, max || 1],
            range: [innerHeight, 0],
            nice: !yDomain,
          })
        }
      >
        {({ active, x, y }) =>
          series.map((item) => {
            const points = data
              .map((datum, index) => ({
                x: x[index] ?? 0,
                value: datum.values[item.key] ?? null,
                index,
              }))
              .filter(
                (point): point is typeof point & { value: number } =>
                  point.value != null,
              );
            const sparse = points.length < data.length;
            const markers = sparse ? points : points.slice(-1);
            const activePoint = points.find((point) => point.index === active);
            return (
              <g key={item.key}>
                {variant === "area" && (
                  <AreaClosed
                    data={points}
                    x={(point) => point.x}
                    y={(point) => y(point.value)}
                    yScale={y}
                    style={{ fill: item.color, fillOpacity: 0.1 }}
                  />
                )}
                <LinePath
                  data={points}
                  x={(point) => point.x}
                  y={(point) => y(point.value)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  style={{ stroke: item.color }}
                />
                {[...markers, ...(activePoint ? [activePoint] : [])].map(
                  (point, index) => (
                    <circle
                      key={`${point.index}-${index}`}
                      cx={point.x}
                      cy={y(point.value)}
                      r={MARKER_RADIUS}
                      strokeWidth={RING}
                      style={{ fill: item.color, stroke: "var(--card)" }}
                    />
                  ),
                )}
              </g>
            );
          })
        }
      </ChartPlot>
    </ChartFrame>
  );
}
