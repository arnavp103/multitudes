"use client";

import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, BarRounded } from "@visx/shape";

import type { ChartDatum, ChartSeries } from "./data";
import type { ChartProps } from "./frame";
import { isEmptyChart, stackTotal, withColors } from "./data";
import { ChartFrame } from "./frame";
import { ChartPlot } from "./plot";

/** Bars never fill their slot: thin marks, leftover band is air. */
const MAX_BAR_WIDTH = 24;
/** Surface-coloured gap between stacked segments, instead of drawn borders. */
const SEGMENT_GAP = 2;
/** Rounded data end; the baseline stays square. */
const DATA_END_RADIUS = 4;

/** One drawable stack segment in pixel space. */
interface Segment {
  key: string;
  color: string;
  y: number;
  height: number;
  top: boolean;
}

/**
 * Lay out one bucket's stack bottom-up in series order. Each segment above the
 * first gives up {@link SEGMENT_GAP} pixels at its base so a surface gap
 * separates neighbours; only the topmost segment gets the rounded data end.
 */
export function stackSegments(
  datum: ChartDatum,
  series: readonly Required<ChartSeries>[],
  y: (value: number) => number,
): Segment[] {
  const visible = series.filter(({ key }) => (datum.values[key] ?? 0) > 0);
  return visible.reduce<{ base: number; segments: Segment[] }>(
    ({ base, segments }, item, index) => {
      const value = datum.values[item.key] ?? 0;
      const top = y(base + value);
      const bottom = y(base) - (index === 0 ? 0 : SEGMENT_GAP);
      return {
        base: base + value,
        segments: [
          ...segments,
          {
            key: item.key,
            color: item.color,
            y: top,
            height: Math.max(0, bottom - top),
            top: index === visible.length - 1,
          },
        ],
      };
    },
    { base: 0, segments: [] },
  ).segments;
}

/**
 * Composition over time: one column per bucket, stacked by series, with a total
 * in the tooltip and table. The whole bucket column is the hover target, and the
 * hovered column stays at full strength while the others recede.
 */
export function StackedBarChart(props: ChartProps) {
  const series = withColors(props.series);
  const height = props.height ?? 220;
  const { data } = props;
  const max = Math.max(0, ...data.map((datum) => stackTotal(datum, series)));
  const band = (innerWidth: number) =>
    scaleBand({
      domain: data.map((datum) => datum.x),
      range: [0, innerWidth],
      paddingInner: 0.3,
      paddingOuter: 0.15,
    });
  return (
    <ChartFrame
      {...props}
      series={series}
      height={height}
      empty={props.empty ?? isEmptyChart(data, series)}
      mark="swatch"
      total
    >
      <ChartPlot
        title={props.title}
        data={data}
        series={series}
        granularity={props.granularity}
        format={props.format}
        height={height}
        total
        xPositions={(innerWidth) => {
          const scale = band(innerWidth);
          return data.map(
            (datum) => (scale(datum.x) ?? 0) + scale.bandwidth() / 2,
          );
        }}
        yScale={(innerHeight) =>
          scaleLinear({
            domain: [0, max || 1],
            range: [innerHeight, 0],
            nice: true,
          })
        }
      >
        {({ innerWidth, active, x, y }) => {
          const width = Math.min(MAX_BAR_WIDTH, band(innerWidth).bandwidth());
          return data.map((datum, index) => (
            <g
              key={datum.x}
              opacity={active == null || active === index ? 1 : 0.55}
            >
              {stackSegments(datum, series, y).map((segment) => {
                const left = (x[index] ?? 0) - width / 2;
                const style = { fill: segment.color };
                return segment.top ? (
                  <BarRounded
                    key={segment.key}
                    x={left}
                    y={segment.y}
                    width={width}
                    height={segment.height}
                    radius={Math.min(
                      DATA_END_RADIUS,
                      segment.height / 2,
                      width / 2,
                    )}
                    top
                    style={style}
                  />
                ) : (
                  <Bar
                    key={segment.key}
                    x={left}
                    y={segment.y}
                    width={width}
                    height={segment.height}
                    style={style}
                  />
                );
              })}
            </g>
          ));
        }}
      </ChartPlot>
    </ChartFrame>
  );
}
