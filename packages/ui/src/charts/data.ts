/**
 * Pure, serializable chart data helpers. Server components shape query rows with
 * these before handing plain props to the client chart components.
 */

/** Bucket resolution of a time axis; controls tick and tooltip labels. */
export type Granularity = "hour" | "day";

/** Named number formats. Functions cannot cross the server/client boundary; names can. */
export type ValueFormat = "usd" | "count" | "tokens" | "percent" | "score";

/** One plotted series. `color` defaults to the next `--chart-n` design token. */
export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

/** One time bucket: an ISO-8601 start and a value (or null for "no data") per series key. */
export interface ChartDatum {
  x: string;
  values: Record<string, number | null>;
}

/** Number of categorical colour tokens defined by the theme (`--chart-1` … `--chart-5`). */
export const CHART_PALETTE_SIZE = 5;

/** Key used for series folded together once the palette runs out. */
export const OTHER_SERIES = "__other__";

/**
 * Order in which series take the theme's `--chart-n` tokens. The current tokens
 * share one lightness, so neighbours alternate hue families (teal, violet,
 * amber, cyan, coral); in this order every adjacent pair clears the colour-vision
 * deficiency separation check in light and dark mode.
 */
const SLOT_ORDER = [1, 3, 4, 2, 5] as const;

/**
 * Categorical colour for a series slot, read from the design system's CSS custom
 * properties so the theme (and dark mode) owns the actual values. Slots past the
 * palette fold into a neutral "Other" colour rather than generating new hues.
 */
export function seriesColor(index: number) {
  const slot = SLOT_ORDER[index];
  return slot ? `var(--chart-${slot})` : "var(--muted-foreground)";
}

/** Resolve each series' colour: explicit colours win, then fixed token order; "Other" is neutral. */
export function withColors(series: readonly ChartSeries[]) {
  return series.map((item, index) => ({
    ...item,
    color:
      item.color ??
      (item.key === OTHER_SERIES
        ? "var(--muted-foreground)"
        : seriesColor(index)),
  }));
}

const formatters: Record<ValueFormat, Intl.NumberFormat> = {
  usd: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }),
  count: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
  tokens: new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }),
  percent: new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }),
  score: new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

const subCent = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumSignificantDigits: 2,
});

/** Format a value for axes, tooltips and tables; null renders as an em dash, never zero. */
export function formatValue(format: ValueFormat, value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (format === "usd" && value === 0) return "$0";
  // Sub-cent model costs keep two significant digits instead of rounding to $0.00.
  if (format === "usd" && Math.abs(value) < 0.01) return subCent.format(value);
  return formatters[format].format(value);
}

/**
 * Axis tick values for a scale: integer-only for counts, and labels with just
 * enough decimals that neighbouring ticks never read the same (e.g. $0.015 vs
 * $0.02 on a sub-cent axis).
 */
export function axisTicks(
  format: ValueFormat,
  ticks: readonly number[],
): { value: number; label: string }[] {
  const values =
    format === "count" ? ticks.filter(Number.isInteger) : [...ticks];
  const step = Math.abs((values[1] ?? 0) - (values[0] ?? 0));
  const decimals =
    step > 0 ? Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)) : 0;
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Math.max(2, decimals),
    maximumFractionDigits: Math.max(2, decimals),
  });
  return values.map((value) => ({
    value,
    label:
      format === "usd"
        ? value === 0
          ? "$0"
          : usd.format(value)
        : formatValue(format, value),
  }));
}

const bucketFormats = {
  hour: {
    axis: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }),
    full: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
      timeZoneName: "short",
    }),
  },
  day: {
    axis: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    full: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  },
} as const;

/**
 * Label a bucket start. A fixed locale and UTC keep server and client renders
 * identical (no hydration mismatch) and match the database's UTC bucketing.
 */
export function formatBucket(
  iso: string,
  granularity: Granularity,
  style: "axis" | "full" = "axis",
) {
  return bucketFormats[granularity][style].format(new Date(iso));
}

/**
 * Choose the most significant series keys by a weight (for example cost) and keep
 * them; everything else maps to {@link OTHER_SERIES}. Returns a key mapper.
 */
export function keepTopSeries<Row>(
  rows: readonly Row[],
  keyOf: (row: Row) => string,
  weightOf: (row: Row) => number,
  limit = CHART_PALETTE_SIZE,
) {
  const weights = rows.reduce(
    (totals, row) =>
      totals.set(keyOf(row), (totals.get(keyOf(row)) ?? 0) + weightOf(row)),
    new Map<string, number>(),
  );
  if (weights.size <= limit) return keyOf;
  const kept = new Set(
    [...weights]
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .slice(0, limit - 1)
      .map(([key]) => key),
  );
  return (row: Row) => (kept.has(keyOf(row)) ? keyOf(row) : OTHER_SERIES);
}

/**
 * Pivot sparse rows into one datum per bucket with a value per series. Every
 * bucket appears even with no rows; the aggregate decides what "no rows" means
 * (0 for sums, null for rates). Series keys are sorted so a model keeps its
 * colour slot when unrelated series come and go; "Other" always sorts last.
 */
export function pivotRows<Row>(
  rows: readonly Row[],
  options: {
    buckets: readonly string[];
    bucketOf: (row: Row) => string;
    seriesOf: (row: Row) => string;
    aggregate: (group: readonly Row[]) => number | null;
  },
): { data: ChartDatum[]; keys: string[] } {
  const groups = rows.reduce((map, row) => {
    const id = `${options.bucketOf(row)}\u0000${options.seriesOf(row)}`;
    return map.set(id, [...(map.get(id) ?? []), row]);
  }, new Map<string, Row[]>());
  const keys = [...new Set(rows.map(options.seriesOf))].sort((a, b) =>
    a === OTHER_SERIES ? 1 : b === OTHER_SERIES ? -1 : a.localeCompare(b),
  );
  const data = options.buckets.map((x) => ({
    x,
    values: Object.fromEntries(
      keys.map((key) => [
        key,
        options.aggregate(groups.get(`${x}\u0000${key}`) ?? []),
      ]),
    ),
  }));
  return { data, keys };
}

/** Sum a numeric field across rows (0 for an empty group). */
export const sumOf =
  <Row>(field: (row: Row) => number) =>
  (group: readonly Row[]) =>
    group.reduce((total, row) => total + field(row), 0);

/** Weighted ratio across rows; null when the denominator is zero ("no data", not 0%). */
export const ratioOf =
  <Row>(numerator: (row: Row) => number, denominator: (row: Row) => number) =>
  (group: readonly Row[]) => {
    const total = group.reduce((sum, row) => sum + denominator(row), 0);
    return total
      ? group.reduce((sum, row) => sum + numerator(row), 0) / total
      : null;
  };

/** True when no series has a non-zero value in any bucket. */
export function isEmptyChart(
  data: readonly ChartDatum[],
  series: readonly ChartSeries[],
) {
  return data.every((datum) => series.every(({ key }) => !datum.values[key]));
}

/** Per-bucket stack total, treating missing values as zero. */
export function stackTotal(datum: ChartDatum, series: readonly ChartSeries[]) {
  return series.reduce((total, { key }) => total + (datum.values[key] ?? 0), 0);
}
