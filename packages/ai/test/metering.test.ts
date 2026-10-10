import assert from "node:assert/strict";
import { test } from "node:test";
import type { BaseModelConfig, ModelStreamEvent } from "@strands-agents/sdk";
import { Model } from "@strands-agents/sdk";

import type { CallFinish, CallStart } from "@multitudes/db/usage";

import { meterModel } from "../src/index";
import { estimateCost, getPrice } from "../src/pricing";

const identity = { provider: "deepseek" as const, modelId: "deepseek-flash" };
const call = { runId: "fixture", attempt: 1, purpose: "judge" as const };
class FixtureModel extends Model {
  calls = 0;
  getConfig() {
    return {};
  }
  updateConfig(_config: BaseModelConfig) {
    /* Fixture config is immutable. */
  }
  async *stream(): AsyncIterable<ModelStreamEvent> {
    this.calls++;
    await Promise.resolve();
    const metadata: ModelStreamEvent = {
      type: "modelMetadataEvent",
      usage: {
        inputTokens: 1000,
        outputTokens: 200,
        totalTokens: 1200,
        cacheReadInputTokens: 100,
      },
    };
    yield metadata;
    yield metadata;
  }
}

await test("each actual invocation gets one ledger row; repeated cumulative metadata does not add spend twice", async () => {
  const starts: CallStart[] = [];
  const rows = new Map<string, CallFinish>();
  const model = meterModel(new FixtureModel(), identity, call, {
    start: (row) => {
      starts.push(row);
      return Promise.resolve();
    },
    finish: (id, row) => {
      rows.set(id, row);
      return Promise.resolve();
    },
  });
  await Array.fromAsync(model.stream([]));
  await Array.fromAsync(model.stream([]));
  assert.equal(starts.length, 2);
  assert.equal(rows.size, 2);
  for (const row of rows.values()) {
    assert.equal(row.status, "completed");
    assert.ok(Number(row.estimatedCostUsd) > 0);
  }
  assert.equal(starts[0]?.purpose, "judge");
});

await test("ledger failure stops the provider before spending", async () => {
  const delegate = new FixtureModel();
  const model = meterModel(delegate, identity, call, {
    start: () => Promise.reject(new Error("db offline")),
    finish: () => Promise.resolve(),
  });
  await assert.rejects(Array.fromAsync(model.stream([])), /db offline/);
  assert.equal(delegate.calls, 0);
});

await test("pricing distinguishes cached input, unknown usage, peak hours, and future Gemini rates", () => {
  const weekday = getPrice(
    "deepseek",
    "deepseek-flash",
    new Date("2026-10-12T02:00:00Z"),
  );
  const weekend = getPrice(
    "deepseek",
    "deepseek-flash",
    new Date("2026-10-10T02:00:00Z"),
  );
  assert.equal(weekday?.input, 0.3);
  assert.equal(weekend?.input, 0.15);
  assert.equal(
    estimateCost(
      {
        inputTokens: 1000,
        cacheReadInputTokens: 500,
        outputTokens: 200,
        totalTokens: 1200,
      },
      weekday,
    ),
    (500 * 0.3 + 500 * 0.006 + 200 * 1.2) / 1e6,
  );
  assert.equal(estimateCost(undefined, weekday), null);
  assert.equal(getPrice("gemini", "unknown"), null);
  assert.equal(
    getPrice("gemini", "gemini-3.8-flash", new Date("2027-01-01T00:00:00Z"))
      ?.input,
    1.5,
  );
});

await test("consumer interruption retains reported spend and marks the call failed", async () => {
  const rows: CallFinish[] = [];
  const model = meterModel(new FixtureModel(), identity, call, {
    start: () => Promise.resolve(),
    finish: (_id, row) => {
      rows.push(row);
      return Promise.resolve();
    },
  });
  for await (const _event of model.stream([])) break;
  const final = rows.at(-1);
  assert.ok(final);
  assert.equal(final.status, "failed");
  assert.equal(final.errorType, "Interrupted");
  assert.ok(Number(final.estimatedCostUsd) > 0);
});
