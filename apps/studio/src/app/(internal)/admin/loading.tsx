import { StackedBarChart } from "@multitudes/ui/charts/stacked-bar-chart";
import { TimeSeriesChart } from "@multitudes/ui/charts/time-series-chart";

const placeholder = {
  data: [],
  series: [],
  granularity: "day",
  height: 220,
  loading: true,
} as const;

/** First-visit placeholder; switching windows keeps the current frame until data arrives. */
export default function AdminLoading() {
  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">Operations / Admin</p>
          <h1>How your agents are doing</h1>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <StackedBarChart
          {...placeholder}
          title="Estimated cost by model"
          format="usd"
        />
        <StackedBarChart
          {...placeholder}
          title="Estimated cost by purpose"
          format="usd"
        />
        <TimeSeriesChart
          {...placeholder}
          title="Tokens by model"
          format="tokens"
        />
        <TimeSeriesChart
          {...placeholder}
          title="Tokens by purpose"
          format="tokens"
        />
      </div>
    </>
  );
}
