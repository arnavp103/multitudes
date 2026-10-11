/** @type {import("next").NextConfig} */
export default {
  /** Keep generated Next.js agent rules out of the hand-written AGENTS.md. */
  agentRules: false,
  experimental: { useTypeScriptCli: true },
  transpilePackages: [
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
