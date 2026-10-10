/** @type {import("next").NextConfig} */
export default {
  experimental: { useTypeScriptCli: true },
  transpilePackages: [
    "@multitudes/events",
    "@multitudes/ai",
    "@multitudes/auth",
    "@multitudes/ui",
    "@multitudes/db",
    "@multitudes/agent",
    "@multitudes/evals",
    "@multitudes/observability",
  ],
  serverExternalPackages: ["pg", "pg-boss", "pino", "@strands-agents/sdk"],
};
