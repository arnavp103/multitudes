import assert from "node:assert/strict";
import { test } from "node:test";

import { caseSchema, parseVerdict } from "../src/index";

const config = {
  provider: "gemini" as const,
  modelId: "gemini-3.8-flash",
  rubric: "Answers the question accurately",
  threshold: 0.8,
  promptVersion: "llm-judge/v1",
};
await test("judge verdict is strict and combines a numeric score with a frozen threshold", () => {
  assert.equal(
    parseVerdict('{"score":0.8,"reason":"Correct evidence"}', config).passed,
    true,
  );
  assert.equal(
    parseVerdict('{"score":0.7,"reason":"Missing evidence"}', config).passed,
    false,
  );
  for (const bad of [
    "not json",
    '{"score":2,"reason":"pass"}',
    '{"score":"1","reason":"pass"}',
    '{"score":1,"reason":"pass","override":true}',
  ])
    assert.throws(() => parseVerdict(bad, config));
});
await test("judge-only cases require a rubric and accept no implicit empty pass", () => {
  assert.equal(
    caseSchema.safeParse({
      name: "judge",
      dataset: "regression",
      input: "task",
      assertions: [],
      judge: config,
    }).success,
    true,
  );
  assert.equal(
    caseSchema.safeParse({
      name: "judge",
      dataset: "regression",
      input: "task",
      assertions: [],
    }).success,
    false,
  );
});
