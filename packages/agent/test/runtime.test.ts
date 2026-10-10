import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  BaseModelConfig,
  ModelStreamEvent,
  Storage,
} from "@strands-agents/sdk";
import { Model, ModelThrottledError } from "@strands-agents/sdk";

import { createAgent } from "../src/index";

/** Deterministic provider exercises the real Strands loop without external API calls. */
class TestModel extends Model {
  calls = 0;
  updateConfig(_config: BaseModelConfig) {
    /* This deterministic provider has no mutable configuration. */
  }
  getConfig() {
    return { modelId: "test-model" };
  }
  async *stream(): AsyncIterable<ModelStreamEvent> {
    this.calls++;
    await Promise.resolve();
    yield { type: "modelMessageStartEvent", role: "assistant" };
    yield { type: "modelContentBlockStartEvent" };
    yield {
      type: "modelContentBlockDeltaEvent",
      delta: { type: "textDelta", text: "Paris" },
    };
    yield { type: "modelContentBlockStopEvent" };
    yield { type: "modelMessageStopEvent", stopReason: "endTurn" };
  }
}

function memoryStorage(): Storage {
  const values = new Map<string, Uint8Array>();
  return {
    write: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
    read: (key) => Promise.resolve(values.get(key) ?? null),
    delete: (key) => {
      values.delete(key);
      return Promise.resolve();
    },
    list: (prefix) =>
      Promise.resolve(
        [...values.keys()].filter((key) => key.startsWith(prefix)).sort(),
      ),
  };
}
const configuration = {
  provider: "gemini" as const,
  modelId: "test-model",
  systemPrompt: "Answer briefly",
  codeVersion: "test",
};

await test("a fresh agent restores the saved conversation without another model call", async () => {
  const storage = memoryStorage();
  const model = new TestModel();
  const events: string[] = [];
  const options = {
    runId: "test-run",
    configuration,
    storage,
    model,
    record: (type: string) => {
      events.push(type);
      return Promise.resolve();
    },
  };
  const first = createAgent(options);
  const result = await first.invoke("Capital of France?");
  assert.equal(result.toString(), "Paris");
  assert.equal(first.messages.length, 2);
  await first.shutdown();
  const restored = createAgent(options);
  await restored.initialize();
  assert.equal(restored.messages.length, 2);
  assert.equal(model.calls, 1);
  assert.ok(events.includes("message"));
  assert.ok(events.includes("model.finished"));
  assert.deepEqual(
    restored.toolRegistry
      .list()
      .map((tool) => tool.name)
      .sort(),
    ["get_task_status"],
  );
  await restored.shutdown();
});

await test("trajectory persistence failure stops execution before spending a model call", async () => {
  const model = new TestModel();
  const agent = createAgent({
    runId: "failure",
    configuration,
    storage: memoryStorage(),
    model,
    record: () => Promise.reject(new Error("database unavailable")),
  });
  await assert.rejects(agent.invoke("hello"), /database unavailable/);
  assert.equal(model.calls, 0);
  await agent.shutdown();
});

await test("the real Agent does not retry throttling and records a versioned safe error", async () => {
  const model = new TestModel();
  model.stream = async function* () {
    this.calls++;
    yield* [];
    await Promise.resolve();
    throw new ModelThrottledError("private-provider-body");
  };
  const events: { type: string; payload: Record<string, unknown> }[] = [];
  const agent = createAgent({
    runId: "throttled",
    configuration,
    model,
    storage: memoryStorage(),
    record: (type, payload) => {
      events.push({ type, payload });
      return Promise.resolve();
    },
  });
  try {
    await assert.rejects(agent.invoke("hello"), ModelThrottledError);
    assert.equal(model.calls, 1);
    const finished = events.find((event) => event.type === "model.finished");
    assert.ok(finished);
    assert.equal(finished.payload.v, 1);
    assert.equal(finished.payload.attemptCount, 1);
    assert.deepEqual(Object.keys(finished.payload).sort(), [
      "attemptCount",
      "error",
      "stopReason",
      "v",
    ]);
    assert.ok(!JSON.stringify(events).includes("private-provider-body"));
  } finally {
    await agent.shutdown();
  }
});
