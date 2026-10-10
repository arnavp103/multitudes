import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Enables hot reloading for local packages without a build step */
  experimental: { useTypeScriptCli: true },
  transpilePackages: [
    "@multitudes/ai",
    "@multitudes/api",
    "@multitudes/agent",
    "@multitudes/observability",
    "@multitudes/auth",
    "@multitudes/db",
    "@multitudes/ui",
    "@multitudes/validators",
  ],

  serverExternalPackages: [
    "pg",
    "pg-boss",
    "pino",
    "pino-pretty",
    "@strands-agents/sdk",
  ],
};

export default config;
