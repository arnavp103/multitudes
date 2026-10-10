import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Message, TextBlock } from "@strands-agents/sdk";

import type { CallFinish } from "@multitudes/db/usage";

import { createModel } from "../src/index";

/** Real provider adapters, mocked HTTP: validates usage normalization without credentials or billing. */
await test("Gemini AI Studio and DeepSeek preserve cached and thinking token usage", async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  process.env.DEEPSEEK_API_KEY = "test-only-key";
  for (const provider of ["gemini", "deepseek"] as const) {
    const payload =
      provider === "gemini"
        ? [
            {
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
            },
          ]
        : [
            {
              id: "fixture",
              created: 1,
              model: "deepseek-flash",
              object: "chat.completion.chunk",
              choices: [
                {
                  index: 0,
                  delta: { role: "assistant", content: "Hello" },
                  finish_reason: null,
                },
              ],
            },
            {
              id: "fixture",
              created: 1,
              model: "deepseek-flash",
              object: "chat.completion.chunk",
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 15,
                total_tokens: 115,
                prompt_cache_hit_tokens: 20,
                prompt_cache_miss_tokens: 80,
              },
            },
          ];
    const fetchMock = mock.method(globalThis, "fetch", () =>
      Promise.resolve(
        new Response(
          payload.map((item) => `data: ${JSON.stringify(item)}\n\n`).join("") +
            (provider === "deepseek" ? "data: [DONE]\n\n" : ""),
          { headers: { "content-type": "text/event-stream" } },
        ),
      ),
    );
    let recorded: CallFinish | undefined;
    try {
      const model = createModel(
        {
          provider,
          modelId:
            provider === "gemini" ? "gemini-3.8-flash" : "deepseek-flash",
        },
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
      assert.ok(recorded);
      assert.ok(recorded.usage);
      assert.equal(recorded.status, "completed");
      assert.equal(recorded.usage.inputTokens, 100);
      assert.equal(recorded.usage.outputTokens, 15);
      assert.equal(recorded.usage.cacheReadInputTokens, 20);
      assert.ok(Number(recorded.estimatedCostUsd) > 0);
    } finally {
      fetchMock.mock.restore();
    }
  }
});

await test("provider errors do not trigger hidden retries or fabricate zero cost", async () => {
  for (const provider of ["gemini", "deepseek"] as const) {
    const fetchMock = mock.method(globalThis, "fetch", () =>
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
    try {
      const model = createModel(
        {
          provider,
          modelId:
            provider === "gemini" ? "gemini-3.8-flash" : "deepseek-flash",
        },
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
    } finally {
      fetchMock.mock.restore();
    }
  }
});
