import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { z } from "zod/v4";

import type { AuthOptions } from "@multitudes/auth";
import { eq } from "@multitudes/db";
import { migrateDatabase } from "@multitudes/db/migrate";
import { user } from "@multitudes/db/schema";

import { freePort, interrupted, launch, root } from "./processes";
import { seed } from "./seed";

const profilePath = `${root}.local/profile.json`;
const profileSchema = z.object({
  project: z.string().regex(/^multitudes_[a-f0-9]+$/),
  dbPort: z.number().int(),
  webPort: z.number().int(),
  studioPort: z.number().int(),
  workerPort: z.number().int(),
  password: z.string().min(32),
  secret: z.string().min(32),
});
/** Local tooling never creates privileged test sessions against remote databases or production. */
if (process.env.NODE_ENV === "production")
  throw new Error("Local tooling is unavailable in production");
const command = process.argv[2] ?? "up";
let profile: z.infer<typeof profileSchema>;
try {
  profile = profileSchema.parse(
    JSON.parse(await readFile(profilePath, "utf8")),
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT" || command !== "up")
    throw error;
  profile = {
    project: `multitudes_${createHash("sha256").update(root).digest("hex").slice(0, 10)}`,
    dbPort: await freePort(),
    webPort: await freePort(),
    studioPort: await freePort(),
    workerPort: await freePort(),
    password: randomBytes(24).toString("hex"),
    secret: randomBytes(32).toString("hex"),
  };
  await mkdir(`${root}.local`, { recursive: true });
  await writeFile(profilePath, JSON.stringify(profile), { mode: 0o600 });
}
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "development",
  POSTGRES_URL: `postgres://multitudes:${profile.password}@127.0.0.1:${profile.dbPort}/${profile.project}`,
  WEBAPP_URL: `http://localhost:${profile.webPort}`,
  STUDIO_URL: `http://localhost:${profile.studioPort}`,
  AUTH_PRODUCTION_URL: `http://localhost:${profile.webPort}`,
  STUDIO_AUTH_PRODUCTION_URL: `http://localhost:${profile.studioPort}`,
  AUTH_SECRET: profile.secret,
  AGENT_CODE_VERSION: "local",
  PORT: String(profile.workerPort),
  OTEL_SDK_DISABLED: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? "false" : "true",
};
const compose = [
  "compose",
  "--project-name",
  profile.project,
  "-f",
  `${root}infra/local/compose.yaml`,
];
const composeEnv = {
  ...env,
  LOCAL_DB_PORT: String(profile.dbPort),
  LOCAL_DB_PASSWORD: profile.password,
  LOCAL_DB_NAME: profile.project,
};
if (command === "down") {
  const code = await launch("docker", [...compose, "down"], composeEnv).done;
  process.exitCode = code;
} else {
  if (
    command === "up" &&
    (await launch("docker", [...compose, "up", "-d", "--wait"], composeEnv)
      .done) !== 0
  )
    throw new Error("Docker Compose could not start local PostgreSQL");
  Object.assign(process.env, env);
  const { db, pool } = await import("@multitudes/db/client");
  let poolClosed = false;
  try {
    if (command === "login") {
      const app = z
        .enum(["webapp", "studio"])
        .parse(process.argv[3] ?? "studio");
      const role = z
        .enum(["admin", "evaluator", "viewer", "user"])
        .parse(process.argv[4] ?? "admin");
      const [identity] = await db
        .select()
        .from(user)
        .where(eq(user.id, `dev-${role}`));
      if (!identity) throw new Error("Run pnpm dev:up first");
      const baseUrl = app === "studio" ? env.STUDIO_URL : env.WEBAPP_URL;
      if (!baseUrl) throw new Error("Missing local app URL");
      const options: AuthOptions = {
        database: db,
        baseUrl,
        productionUrl: baseUrl,
        cookiePrefix: `multitudes-${app}`,
        secret: profile.secret,
      };
      const { createTestAuth } = await import("@multitudes/auth/testing");
      const { test } = await createTestAuth(options).$context;
      const cookies = await test.getCookies({
        userId: identity.id,
        domain: "localhost",
      });
      const token = randomBytes(32).toString("hex");
      let consumed = false;
      const server = createServer((request, response) => {
        if (
          consumed ||
          request.method !== "GET" ||
          request.url !== `/${token}`
        ) {
          response.writeHead(404).end();
          return;
        }
        consumed = true;
        response.writeHead(302, {
          location: baseUrl,
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "set-cookie": cookies.map(
            (cookie) =>
              `${cookie.name}=${cookie.value}; Path=/; HttpOnly; SameSite=Lax`,
          ),
        });
        response.end();
        server.close();
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Login server did not start");
      console.info(
        `Open this one-time local login link: http://localhost:${address.port}/${token}`,
      );
      const timer = setTimeout(() => server.close(), 120_000);
      await new Promise<void>((resolve) => server.once("close", resolve));
      clearTimeout(timer);
    } else if (command === "up") {
      if (
        (await launch(
          "pnpm",
          [
            "exec",
            "turbo",
            "run",
            "build",
            "--filter=@multitudes/backend...",
            "--filter=@multitudes/ui...",
          ],
          env,
        ).done) !== 0
      )
        throw new Error("Workspace dependencies did not build");
      await migrateDatabase(pool);
      await seed(db);
      await pool.end();
      poolClosed = true;
      const workerArgs = ["--import", "tsx"];
      if (!env.GEMINI_API_KEY) {
        workerArgs.push("--import", `${root}tooling/dev/src/fixture-google.ts`);
        env.GEMINI_API_KEY = "local-http-fixture";
        console.info(
          "Using deterministic Google HTTP fixtures. Set GEMINI_API_KEY for live model calls.",
        );
      }
      console.info(
        `Webapp: ${env.WEBAPP_URL}\nStudio: ${env.STUDIO_URL}\nSign in: pnpm dev:login studio admin`,
      );
      const processes = [
        launch(
          "pnpm",
          [
            "--filter",
            "@multitudes/webapp",
            "exec",
            "next",
            "dev",
            "--port",
            String(profile.webPort),
          ],
          env,
        ),
        launch(
          "pnpm",
          [
            "--filter",
            "@multitudes/studio",
            "exec",
            "next",
            "dev",
            "--port",
            String(profile.studioPort),
          ],
          env,
        ),
        launch(
          process.execPath,
          [...workerArgs, "src/bootstrap.ts"],
          env,
          `${root}apps/backend`,
        ),
      ];
      try {
        const exitCode = await Promise.race([
          ...processes.map((child) => child.done),
          interrupted.then(() => undefined),
        ]);
        if (exitCode !== undefined) {
          throw new Error(
            `A local application exited unexpectedly (code ${exitCode})`,
          );
        }
      } finally {
        await Promise.all(processes.map((child) => child.stop()));
      }
    } else throw new Error("Unknown local command");
  } finally {
    if (!poolClosed) await pool.end();
  }
}
