import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Message, TextBlock } from "@strands-agents/sdk";

import type { CallFinish } from "@multitudes/db/usage";

import { createModel, defaultModel } from "../src/index";

/** Exercise the native Google adapter over mocked HTTP, without credentials or billing. */
await test("Gemini AI Studio preserves cached and thinking token usage", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
  const payload = {
    candidates: [
      {
        content: { role: "model", parts: [{ text: "Hello" }] },
        finishReason: "STOP",
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 10,
      thoughtsTokenCount: 5,
      totalTokenCount: 115,
      cachedContentTokenCount: 20,
    },
  };
  const fetchMock = t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(
      new Response(`data: ${JSON.stringify(payload)}\n\n`, {
        headers: { "content-type": "text/event-stream" },
      }),
    ),
  );
  let recorded: CallFinish | undefined;
  const model = createModel(
    defaultModel,
    { runId: "fixture", attempt: 1, purpose: "judge" },
    {
      start: () => Promise.resolve(),
      finish: (_id, row) => {
        recorded = row;
        return Promise.resolve();
      },
    },
  );
  await Array.fromAsync(
    model.stream([
      new Message({ role: "user", content: [new TextBlock("hello")] }),
    ]),
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.ok(recorded?.usage);
  assert.equal(recorded.status, "completed");
  assert.equal(recorded.usage.inputTokens, 100);
  assert.equal(recorded.usage.outputTokens, 15);
  assert.equal(recorded.usage.cacheReadInputTokens, 20);
  assert.ok(Number(recorded.estimatedCostUsd) > 0);
});

await test("Google errors do not trigger hidden retries or fabricate zero cost", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
  const fetchMock = t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          error: {
            message: "fixture unavailable",
            code: 503,
            status: "UNAVAILABLE",
          },
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    ),
  );
  let recorded: CallFinish | undefined;
  const model = createModel(
    defaultModel,
    { runId: "fixture", attempt: 1, purpose: "agent" },
    {
      start: () => Promise.resolve(),
      finish: (_id, row) => {
        recorded = row;
        return Promise.resolve();
      },
    },
  );
  await assert.rejects(
    Array.fromAsync(
      model.stream([
        new Message({ role: "user", content: [new TextBlock("hello")] }),
      ]),
    ),
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.ok(recorded);
  assert.equal(recorded.status, "failed");
  assert.equal(recorded.estimatedCostUsd, null);
});

await test("legacy providers fail before creating a client, ledger row, or HTTP request", (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected HTTP request");
  });
  const start = mock.fn(() => Promise.resolve());
  for (const provider of ["deepseek", "openai", "bedrock"] as const) {
    assert.throws(
      () =>
        createModel(
          { provider, modelId: "historical-model" },
          { runId: "fixture", attempt: 1, purpose: "agent" },
          { start, finish: () => Promise.resolve() },
        ),
      /Unsupported provider/,
    );
  }
  assert.equal(start.mock.callCount(), 0);
  assert.equal(fetchMock.mock.callCount(), 0);
});
