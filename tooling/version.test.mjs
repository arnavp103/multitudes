import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { resolveVersion, stampVersion } from "./version.mjs";

await test("build identity uses a verified CI SHA or Git, never a fabricated version", () => {
  const sha = "a".repeat(40);
  assert.equal(
    resolveVersion({}, () => sha),
    sha,
  );
  assert.equal(
    resolveVersion({ APP_VERSION: sha.toUpperCase() }, () => {
      throw new Error("Git unavailable");
    }),
    sha,
  );
  for (const APP_VERSION of ["", "latest", "abc123", "v1.2.3"])
    assert.throws(() => resolveVersion({ APP_VERSION }), /full Git SHA/);
  assert.throws(
    () =>
      resolveVersion({}, () => {
        throw new Error("Git unavailable");
      }),
    /Git unavailable/,
  );
});

await test("baked artifact is deterministic and does not read runtime environment", () => {
  const dir = mkdtempSync(join(tmpdir(), "multitudes-version-"));
  try {
    const file = join(dir, "build-info.ts");
    stampVersion("a".repeat(40), file);
    const first = readFileSync(file, "utf8");
    stampVersion("a".repeat(40), file);
    assert.equal(readFileSync(file, "utf8"), first);
    assert.ok(!first.includes("process.env"));
    stampVersion("b".repeat(40), file);
    assert.ok(readFileSync(file, "utf8").includes("b".repeat(40)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
