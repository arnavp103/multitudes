/** @type {import("next").NextConfig} */
export default {
  transpilePackages: [
    "@multitudes/auth",
    "@multitudes/ui",
    "@multitudes/db",
    "@multitudes/agent",
    "@multitudes/evals",
    "@multitudes/observability",
  ],
  serverExternalPackages: ["pg", "pg-boss", "pino", "@strands-agents/sdk"],
};
