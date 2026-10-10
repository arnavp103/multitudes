import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";

import { createMailer, renderEmail } from "../src/index";
import RunCompleted from "../src/templates/run-completed";

await test("renders HTML and plain text and delegates only to the injected transport", async () => {
  const react = createElement(RunCompleted, { title: "Review <this>" });
  const rendered = await renderEmail(react);
  assert.match(rendered.html, /Review &lt;this&gt;/);
  assert.match(rendered.text, /Review <this>/i);
  const input = {
    from: "agent@example.com",
    to: ["reader@example.com"],
    subject: "Task ready",
    idempotencyKey: "run-1",
    react,
  };
  await assert.rejects(createMailer().send(input), /not configured/);
  const mailer = createMailer({
    name: "test",
    send: async (message) => {
      assert.equal(message.idempotencyKey, "run-1");
      assert.equal(message.html, rendered.html);
      return Promise.resolve({ messageId: "test-only" });
    },
  });
  assert.deepEqual(await mailer.send(input), { messageId: "test-only" });
  await assert.rejects(mailer.send({ ...input, subject: "header\ninjection" }));
});
