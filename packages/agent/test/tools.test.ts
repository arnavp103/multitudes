import assert from "node:assert/strict";
import { test } from "node:test";

import { createTools } from "../src/tools";

await test("tool input cannot replace its server-supplied actor and returns the service result", async () => {
  let actor: string | undefined;
  const tools = createTools("trusted-owner", {
    getAgentCapabilities: () => ({
      tools: [],
      canSendEmail: false,
      canExecuteCode: false,
      persistentMemory: false,
    }),
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
