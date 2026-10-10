import { mkdir } from "node:fs/promises";

import { createTestDatabase } from "@multitudes/db/testing";

import { freePort, launch, root, waitHealthy } from "./processes";
import { seed } from "./seed";

/** One migrated database and independent ports per invocation; tests share no production state. */
const database = await createTestDatabase();
const processes: ReturnType<typeof launch>[] = [];
const webPort = await freePort();
const studioPort = await freePort();
const workerPort = await freePort();
const env = {
  ...process.env,
  CI: "1",
  POSTGRES_URL: database.url,
  NODE_ENV: "production",
  WEBAPP_URL: `http://localhost:${webPort}`,
  STUDIO_URL: `http://localhost:${studioPort}`,
  AUTH_SECRET: "e2e-only-auth-secret-never-use-in-production",
  AUTH_DISCORD_ID: "fixture",
  AUTH_DISCORD_SECRET: "fixture",
  AGENT_CODE_VERSION: "e2e",
  GEMINI_API_KEY: "http-fixture",
  PORT: String(workerPort),
  OTEL_SDK_DISABLED: "true",
};
try {
  await seed(database.db);
  await seed(database.db);
  const web = launch(
    "pnpm",
    [
      "--filter",
      "@multitudes/webapp",
      "exec",
      "next",
      "start",
      "--port",
      String(webPort),
    ],
    env,
  );
  const studio = launch(
    "pnpm",
    [
      "--filter",
      "@multitudes/studio",
      "exec",
      "next",
      "start",
      "--port",
      String(studioPort),
    ],
    env,
  );
  const worker = launch(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      `${root}tooling/dev/src/fixture-google.ts`,
      "src/bootstrap.ts",
    ],
    env,
    `${root}apps/backend`,
  );
  processes.push(web, studio, worker);
  await Promise.all([
    waitHealthy(`${env.WEBAPP_URL}/api/health`, web),
    waitHealthy(`${env.STUDIO_URL}/api/health`, studio),
    waitHealthy(`http://localhost:${workerPort}/api/health`, worker),
  ]);
  await mkdir(`${root}tooling/dev/test-results`, { recursive: true });
  const browser = launch(
    "pnpm",
    ["exec", "playwright", "test"],
    { ...env, NODE_ENV: "test" },
    `${root}tooling/dev`,
  );
  processes.push(browser);
  process.exitCode = await browser.done;
} finally {
  await Promise.all(processes.map((child) => child.stop()));
  await database.close();
}
