import assert from "node:assert/strict";
import { test } from "node:test";

import type { CallFinish } from "@multitudes/db/usage";

import { judgeOutput } from "../src/judge";

/** Exercise judge policy through the real Agent and native Google adapter over mocked HTTP. */
await test("judge requests structured JSON and never retries a provider outage inside the Agent", async (t) => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-key";
  t.after(() => {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  });
  let requestBody: Record<string, unknown> = {};
  let failing = false;
  let starts = 0;
  const finishes: CallFinish[] = [];
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (
      input: Parameters<typeof globalThis.fetch>[0],
      init?: RequestInit,
    ) => {
      requestBody = (await new Request(input, init).json()) as Record<
        string,
        unknown
      >;
      if (failing)
        return new Response(
          JSON.stringify({
            error: {
              code: 503,
              status: "UNAVAILABLE",
              message: "fixture outage",
            },
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        );
      return new Response(
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  { text: '{"score":1,"reason":"Evidence satisfies rubric"}' },
                ],
              },
              finishReason: "STOP",
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 10,
            totalTokenCount: 110,
          },
        })}\n\n`,
        { headers: { "content-type": "text/event-stream" } },
      );
    },
  );
  const options = {
    runId: "fixture",
    attempt: 1,
    input: "task",
    output: "candidate",
    config: {
      provider: "gemini" as const,
      modelId: "gemini-3.8-flash",
      rubric: "Accurate",
      threshold: 0.8,
      promptVersion: "llm-judge/v1",
    },
    signal: AbortSignal.timeout(5000),
    usageStore: {
      start: () => {
        starts++;
        return Promise.resolve();
      },
      finish: (_id: string, value: CallFinish) => {
        finishes.push(value);
        return Promise.resolve();
      },
    },
  };
  const verdict = await judgeOutput(options);
  assert.equal(verdict.passed, true);
  assert.equal(fetch.mock.callCount(), 1);
  const generation = requestBody.generationConfig as Record<string, unknown>;
  assert.equal(generation.maxOutputTokens, 4096);
  assert.equal(generation.temperature, 0);
  assert.equal(generation.responseMimeType, "application/json");
  assert.ok(generation.responseJsonSchema);
  assert.ok(Number(finishes.at(-1)?.estimatedCostUsd) > 0);
  failing = true;
  await assert.rejects(judgeOutput(options));
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(starts, 2);
  assert.equal(finishes.at(-1)?.status, "failed");
  assert.equal(finishes.at(-1)?.estimatedCostUsd, null);
});
