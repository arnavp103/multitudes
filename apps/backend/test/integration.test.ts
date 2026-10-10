import assert from "node:assert/strict";
import { test } from "node:test";

import { APP_VERSION, GIT_SHA } from "@multitudes/observability/health";

import { startHealthServer } from "../src/health";

await test("worker health serves its baked identity and fails during startup/draining", async () => {
  let ready = false;
  const health = await startHealthServer({
    port: 0,
    host: "127.0.0.1",
    isReady: () => ready,
  });
  try {
    const address = health.server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/health`;
    assert.equal((await fetch(url)).status, 503);
    ready = true;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      status: "ok",
      version: APP_VERSION,
      sha: GIT_SHA,
    });
    assert.equal((await fetch(url, { method: "HEAD" })).status, 200);
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${url}/missing`)).status, 404);
    ready = false;
    assert.equal((await fetch(url)).status, 503);
  } finally {
    await health.close();
  }
});
