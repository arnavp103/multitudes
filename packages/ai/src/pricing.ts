import type { Usage } from "@strands-agents/sdk";

export interface Price {
  version: string;
  input: number;
  cachedInput: number;
  output: number;
  note: string;
}
/** USD per million tokens; snapshot the selected rates on every call, never rewrite history. */
export function getPrice(
  provider: string,
  modelId: string,
  date = new Date(),
): Price | null {
  if (
    provider === "gemini" &&
    ["gemini-3.8-flash", "gemini-3.6-flash"].includes(modelId)
  ) {
    const promotional = date < new Date("2027-01-01T00:00:00Z");
    return {
      version: promotional
        ? "google-standard-2026-10-10"
        : "google-standard-2027-01-01",
      input: promotional ? 0.75 : 1.5,
      cachedInput: promotional ? 0.075 : 0.15,
      output: promotional ? 3.75 : 7.5,
      note: "Paid standard text tokens, including thinking. Excludes free-tier credits and cache storage.",
    };
  }
  return null;
}

/** Null means unknown. Normalize inclusive cache counters without billing them twice. */
export function estimateCost(usage: Usage | undefined, price: Price | null) {
  if (!usage || !price || (usage.cacheWriteInputTokens ?? 0) > 0) return null;
  const values = [
    usage.inputTokens,
    usage.outputTokens,
    usage.totalTokens,
    usage.cacheReadInputTokens ?? 0,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const cached = usage.cacheReadInputTokens ?? 0;
  const included = usage.inputTokens + usage.outputTokens === usage.totalTokens;
  const uncached = included ? usage.inputTokens - cached : usage.inputTokens;
  if (uncached < 0) return null;
  return (
    (uncached * price.input +
      cached * price.cachedInput +
      usage.outputTokens * price.output) /
    1_000_000
  );
}
