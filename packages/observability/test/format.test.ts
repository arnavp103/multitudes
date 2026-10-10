import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { writeReadable } from "../src/browser";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

/** Log one record in a fresh process, since the stdout format is fixed per process. */
function logOnce(nodeEnv: string) {
  return execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      'const { createLogger } = await import("./src/logger.ts"); createLogger("format-test").info({ run_id: "r1", password: "hidden" }, "hello");',
    ],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: nodeEnv, LOG_LEVEL: "info" },
    },
  );
}

await test("server stdout is JSON outside development and pretty in development", () => {
  const record = JSON.parse(logOnce("production").trim()) as Record<
    string,
    unknown
  >;
  assert.equal(record.msg, "hello");
  assert.equal(record.service, "format-test");
  assert.equal(record.password, "[REDACTED]");

  // eslint-disable-next-line no-control-regex
  const pretty = logOnce("development").replace(/\u001b\[[0-9;]*m/g, "");
  assert.throws(() => JSON.parse(pretty.trim()) as unknown);
  assert.match(pretty, /INFO.*\[format-test\] hello/);
  assert.match(pretty, /run_id: "r1"/);
  assert.match(pretty, /password: "\[REDACTED\]"/);
});

await test("development browser records print a styled line plus inspectable fields", () => {
  const calls: { method: string; args: unknown[] }[] = [];
  const output = Object.fromEntries(
    ["debug", "info", "warn", "error"].map((method) => [
      method,
      (...args: unknown[]) => calls.push({ method, args }),
    ]),
  ) as unknown as Console;
  writeReadable(
    { level: 50, time: 0, msg: "UI failed", version: "abc", component: "chat" },
    output,
  );
  writeReadable({ level: 30, msg: "RPC activity" }, output);
  const [failure, activity] = calls;
  assert.ok(failure && activity);
  assert.equal(failure.method, "error");
  assert.match(String(failure.args[0]), /^%cERROR%c .* UI failed$/);
  assert.deepEqual(failure.args.at(-1), { component: "chat" });
  assert.equal(activity.method, "info");
  assert.equal(activity.args.length, 3);
});
