import assert from "node:assert/strict";
import { test } from "node:test";

import { caseSchema, gradeOutput } from "../src/index";

await test("a forbidden phrase fails an otherwise passing answer", () => {
  const result = gradeOutput("Paris. Guaranteed accuracy.", [
    { kind: "contains", value: "Paris" },
    { kind: "not_contains", value: "Guaranteed" },
  ]);
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.details.map((item) => item.passed),
    [true, false],
  );
  assert.equal(result.evaluatorVersion, "text-assertions/v1");
});

await test("empty expectations cannot accidentally produce a passing eval", () => {
  assert.throws(() => gradeOutput("anything", []));
  assert.equal(
    caseSchema.safeParse({
      name: "case",
      dataset: "test",
      input: "hello",
      assertions: [],
    }).success,
    false,
  );
});
