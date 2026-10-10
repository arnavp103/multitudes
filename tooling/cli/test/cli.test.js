import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));

test("multitudes help prints the available command", () => {
  const output = execFileSync(process.execPath, [cliPath, "help"], {
    encoding: "utf8",
  });

  assert.equal(
    output,
    "Usage: multitudes <command>\n\nCommands:\n  help  Show this help message\n",
  );
});
