import assert from "node:assert/strict";
import { test } from "node:test";

import { APP_VERSION, GIT_SHA, healthResponse } from "../src/health";

await test("health has a build identity and ignores runtime version overrides", async () => {
  process.env.APP_VERSION = "runtime-must-not-relabel-the-build";
  const response = healthResponse();
  assert.match(APP_VERSION, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    status: "ok",
    version: APP_VERSION,
    sha: GIT_SHA,
  });
  assert.equal(healthResponse(false).status, 503);
});
