import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import type { EventInput, EventRecord, EventTransaction } from "../src/index";
import { emit, prepareEvent } from "../src/index";

const id = randomUUID();
const input = {
  name: "task.started",
  version: 1,
  subjectType: "run",
  subjectId: id,
  runId: id,
  actorId: null,
  idempotencyKey: `started:${id}:1`,
  payload: { mode: "production", attempt: 1 },
} satisfies EventInput;

await test("event envelope uses UUIDv7 and validates registry/version/subject and strict payloads", () => {
  const first = prepareEvent(input);
  const second = prepareEvent(input);
  assert.equal(first.id[14], "7");
  assert.ok(first.id < second.id);
  assert.ok(first.occurredAt instanceof Date);
  assert.equal(first.traceId, null);
  for (const bad of [
    { ...input, name: "unregistered.fact" },
    { ...input, version: 2 },
    { ...input, subjectType: "experiment" },
    { ...input, runId: randomUUID() },
    { ...input, payload: { ...input.payload, prompt: "private-prompt" } },
    { ...input, payload: { mode: "production", attempt: 0 } },
    { ...input, traceId: "0".repeat(32) },
    { ...input, traceId: "not-a-trace" },
    { ...input, unexpected: true },
  ])
    assert.throws(() => prepareEvent(bad as EventInput));
});

await test("emit validates before insertion and only schedules new facts for post-commit publication", async () => {
  const rows: EventRecord[] = [];
  const notifications: (() => void)[] = [];
  let inserted = true;
  const transaction: EventTransaction = {
    insert: (event) => {
      rows.push(event);
      return Promise.resolve({ event, inserted });
    },
    afterCommit: (callback) => notifications.push(callback),
  };
  await assert.rejects(
    emit(transaction, {
      ...input,
      payload: { mode: "production", attempt: -1 },
    }),
  );
  assert.equal(rows.length, 0);
  const event = await emit(transaction, input);
  assert.equal(rows[0]?.id, event.id);
  assert.equal(notifications.length, 1);
  inserted = false;
  await emit(transaction, input);
  assert.equal(
    notifications.length,
    1,
    "deduplication does not announce another committed fact",
  );
});
