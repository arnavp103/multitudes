import assert from "node:assert/strict";
import { test } from "node:test";

import { createFixtureServices } from "@multitudes/db/agent-service";

import { createTools } from "../src/tools";

await test("tool input cannot replace its server-supplied actor and returns the service result", async () => {
  let actor: string | undefined;
  const tools = createTools("trusted-owner", {
    getTaskStatus: async (owner, input) => {
      actor = owner;
      return Promise.resolve({
        id: input.runId,
        status: "completed" as const,
        attempts: 1,
        output: "done",
      });
    },
  });
  const lookup = tools[0];
  assert.ok(lookup);
  await lookup.invoke({ runId: "d054bf60-a2db-46b0-a207-3c27981a96fa" });
  assert.equal(actor, "trusted-owner");
});

await test("eval tools use frozen fixtures with production validation and result bounds", async () => {
  const id = "d054bf60-a2db-46b0-a207-3c27981a96fa";
  const service = createFixtureServices({
    [id]: { status: "completed", attempts: 2, output: "x".repeat(5000) },
  });
  const tools = createTools("eval-fixture", service);
  const lookup = tools[0];
  assert.ok(lookup);
  const result = await lookup.invoke({ runId: id });
  assert.ok(JSON.stringify(result).includes("completed"));
  assert.equal(
    (await service.getTaskStatus("eval-fixture", { runId: id })).output?.length,
    4000,
  );
  await assert.rejects(
    service.getTaskStatus("eval-fixture", {
      runId: "601179ff-4c54-42ee-bad3-26e4d3b87b1d",
    }),
    /Task not found/,
  );
  await assert.rejects(
    service.getTaskStatus(undefined, { runId: id }),
    /Authentication required/,
  );
  await assert.rejects(service.getTaskStatus("eval-fixture", { runId: "bad" }));
});
