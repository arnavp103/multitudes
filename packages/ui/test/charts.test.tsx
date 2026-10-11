import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  axisTicks,
  formatBucket,
  formatValue,
  keepTopSeries,
  OTHER_SERIES,
  pivotRows,
  ratioOf,
  sumOf,
  withColors,
} from "../src/charts/data";
import {
  StackedBarChart,
  stackSegments,
} from "../src/charts/stacked-bar-chart";
import { TimeSeriesChart } from "../src/charts/time-series-chart";

const buckets = ["2026-10-08T00:00:00.000Z", "2026-10-09T00:00:00.000Z"];
const rows = [
  { bucket: buckets[0] ?? "", model: "b", cost: 2, passed: 1, graded: 2 },
  { bucket: buckets[0] ?? "", model: "a", cost: 1, passed: 0, graded: 0 },
  { bucket: buckets[0] ?? "", model: "a", cost: 3, passed: 1, graded: 1 },
];
const series = [
  { key: "agent", label: "Agent" },
  { key: "judge", label: "Judge" },
];
const data = [
  { x: buckets[0] ?? "", values: { agent: 0.5, judge: 0.25 } },
  { x: buckets[1] ?? "", values: { agent: 1, judge: 0 } },
];

describe("chart data helpers", () => {
  it("zero-fills sums, leaves empty rates null, and sorts series keys", () => {
    const options = {
      buckets,
      bucketOf: (row: (typeof rows)[number]) => row.bucket,
      seriesOf: (row: (typeof rows)[number]) => row.model,
    };
    const cost = pivotRows(rows, {
      ...options,
      aggregate: sumOf((row) => row.cost),
    });
    expect(cost.keys).toEqual(["a", "b"]);
    expect(cost.data).toEqual([
      { x: buckets[0], values: { a: 4, b: 2 } },
      { x: buckets[1], values: { a: 0, b: 0 } },
    ]);
    const rate = pivotRows(rows, {
      ...options,
      aggregate: ratioOf(
        (row) => row.passed,
        (row) => row.graded,
      ),
    });
    expect(rate.data[0]?.values).toEqual({ a: 1, b: 0.5 });
    expect(rate.data[1]?.values).toEqual({ a: null, b: null });
  });

  it("folds series beyond the palette into Other by weight", () => {
    const many = ["a", "b", "c", "d", "e", "f"].map((model, index) => ({
      model,
      cost: index,
    }));
    const keyOf = keepTopSeries(
      many,
      (row) => row.model,
      (row) => row.cost,
    );
    expect(many.map(keyOf)).toEqual([
      OTHER_SERIES,
      OTHER_SERIES,
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("takes colours from design tokens and formats gaps as gaps", () => {
    expect(withColors(series).map((item) => item.color)).toEqual([
      "var(--chart-1)",
      "var(--chart-3)",
    ]);
    expect(formatValue("usd", null)).toBe("—");
    expect(formatValue("usd", 0.0034)).toBe("$0.0034");
    expect(formatValue("percent", 0.834)).toBe("83%");
    expect(formatValue("tokens", 12_345)).toBe("12.3K");
    expect(
      axisTicks("usd", [0, 0.005, 0.01, 0.015]).map((tick) => tick.label),
    ).toEqual(["$0", "$0.005", "$0.010", "$0.015"]);
    expect(axisTicks("count", [0, 0.5, 1]).map((tick) => tick.label)).toEqual([
      "0",
      "1",
    ]);
    expect(formatBucket("2026-10-09T14:00:00.000Z", "hour")).toBe("14:00");
    expect(
      axisTicks("usd", [0, 0.005, 0.01, 0.015]).map((tick) => tick.label),
    ).toEqual(["$0", "$0.005", "$0.010", "$0.015"]);
    expect(axisTicks("count", [0, 0.5, 1]).map((tick) => tick.label)).toEqual([
      "0",
      "1",
    ]);
    expect(formatBucket(buckets[1] ?? "", "day")).toBe("Oct 9");
  });

  it("separates stacked segments with a surface gap and rounds only the top", () => {
    const segments = stackSegments(
      { x: "", values: { agent: 1, judge: 1, other: 0 } },
      withColors([...series, { key: "other", label: "Other" }]),
      (value) => 100 - value * 10,
    );
    expect(segments).toEqual([
      expect.objectContaining({ key: "agent", y: 90, height: 10, top: false }),
      expect.objectContaining({ key: "judge", y: 80, height: 8, top: true }),
    ]);
  });
});

describe("chart components", () => {
  it("labels a stacked chart, reads values by keyboard, and offers a table view", () => {
    render(
      <StackedBarChart
        title="Cost by purpose"
        data={data}
        series={series}
        granularity="day"
        format="usd"
      />,
    );
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getByText("Agent")).toBeTruthy();
    const chart = screen.getByRole("group", { name: /Cost by purpose/ });
    fireEvent.keyDown(chart, { key: "End" });
    expect(
      screen.getByText("Fri, Oct 9, Agent $1.00, Judge $0, Total $1.00"),
    ).toBeTruthy();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(
      screen.getByText("Thu, Oct 8, Agent $0.50, Judge $0.25, Total $0.75"),
    ).toBeTruthy();
    const table = screen.getByRole("table", { name: "Cost by purpose" });
    expect(within(table).getByText("$0.75")).toBeTruthy();
  });

  it("paints series with theme custom properties", () => {
    const { container } = render(
      <TimeSeriesChart
        title="Pass rate"
        data={data}
        series={series}
        granularity="day"
        format="percent"
        yDomain={[0, 1]}
      />,
    );
    const strokes = [...container.querySelectorAll("path")].map(
      (path) => path.style.stroke,
    );
    expect(strokes).toContain("var(--chart-1)");
    expect(strokes).toContain("var(--chart-3)");
  });

  it("renders explicit empty and loading states at the plot height", () => {
    const { rerender } = render(
      <TimeSeriesChart
        title="Tokens"
        data={[{ x: buckets[0] ?? "", values: { agent: 0 } }]}
        series={[series[0] ?? { key: "agent", label: "Agent" }]}
        granularity="day"
        format="tokens"
        emptyMessage="No model calls in this window."
      />,
    );
    expect(screen.getByText("No model calls in this window.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    rerender(
      <TimeSeriesChart
        title="Tokens"
        data={[]}
        series={series}
        granularity="day"
        format="tokens"
        loading
      />,
    );
    expect(screen.getByRole("status", { name: "Tokens" })).toBeTruthy();
  });
});
