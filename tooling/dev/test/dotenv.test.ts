import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { readDotenvSettings, withoutDotenvSettings } from "../src/dotenv";

const dotenvxCli = join(
  dirname(
    createRequire(import.meta.url).resolve("@dotenvx/dotenvx/package.json"),
  ),
  "src/cli/dotenvx.js",
);

/** Creates an encrypted `.env` whose private key lives only in a sibling `.env.keys` file. */
async function encryptedEnv(entries: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), "multitudes-dotenv-"));
  const path = join(dir, ".env");
  await writeFile(path, "");
  for (const [key, value] of Object.entries(entries))
    execFileSync(process.execPath, [
      dotenvxCli,
      "set",
      key,
      value,
      "-f",
      path,
      "-fk",
      join(dir, ".env.keys"),
      "--no-native",
      "--no-armor",
      "--quiet",
    ]);
  return { dir, path };
}

await test("decrypts dev settings with the sibling .env.keys from any cwd", async (t) => {
  const { dir, path } = await encryptedEnv({
    GEMINI_API_KEY: "live-key",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector",
    AUTH_DISCORD_ID: "",
    POSTGRES_URL: "postgres://remote",
  });
  t.after(() => rm(dir, { recursive: true }));
  assert.deepEqual(readDotenvSettings(path), {
    GEMINI_API_KEY: "live-key",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector",
  });
  assert.equal(process.env.GEMINI_API_KEY, undefined);
});

await test("falls back to no settings without a private key or file", async (t) => {
  const { dir, path } = await encryptedEnv({ GEMINI_API_KEY: "live-key" });
  t.after(() => rm(dir, { recursive: true }));
  await rm(join(dir, ".env.keys"));
  assert.deepEqual(readDotenvSettings(path), {});
  assert.deepEqual(readDotenvSettings(join(dir, "missing.env")), {});
});

await test("strips shell-provided dev settings and keeps the rest", () => {
  assert.deepEqual(
    withoutDotenvSettings({
      PATH: "/bin",
      GEMINI_API_KEY: "shell-key",
      AUTH_DISCORD_SECRET: "shell-secret",
      OTEL_EXPORTER_OTLP_HEADERS: "x",
    }),
    { PATH: "/bin" },
  );
});
