import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const root = new URL("../", import.meta.url);
const source = readFileSync(
  new URL("packages/observability/src/build-info.generated.ts", root),
  "utf8",
);
const sha = /APP_VERSION = "([a-f0-9]+)"/.exec(source)?.[1];
assert.ok(sha);

for (const [index, app] of ["webapp", "studio"].entries()) {
  await test(
    `${app}: public health exposes the built SHA even when runtime APP_VERSION differs`,
    { timeout: 90000 },
    async () => {
      const cwd = new URL(`apps/${app}/`, root);
      const require = createRequire(new URL("package.json", cwd));
      const port = 4300 + index;
      let output = "";
      const child = spawn(
        process.execPath,
        [
          require.resolve("next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        {
          cwd,
          env: {
            ...process.env,
            CI: "true",
            OTEL_SDK_DISABLED: "true",
            APP_VERSION: "0".repeat(40),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        output += String(chunk);
      });
      const exited = new Promise((resolve) => child.once("exit", resolve));
      try {
        let response;
        for (let attempt = 0; attempt < 150; attempt++) {
          if (child.exitCode !== null)
            throw new Error(`Next exited: ${output}`);
          try {
            response = await fetch(`http://127.0.0.1:${port}/api/health`, {
              signal: AbortSignal.timeout(2000),
              redirect: "manual",
            });
            break;
          } catch {
            await delay(200);
          }
        }
        assert.ok(response, `Health endpoint did not start: ${output}`);
        assert.equal(response.status, 200, output);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.deepEqual(await response.json(), {
          status: "ok",
          version: sha,
          sha,
        });
      } finally {
        child.kill("SIGTERM");
        const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
        await exited;
        clearTimeout(timer);
      }
    },
  );
}
