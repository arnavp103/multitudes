# Agents

Multitudes is a pnpm/Turborepo monorepo with a Next.js web app, shared TypeScript
packages, and workspace tooling.

## Golden rules

1. Prefer functional programming.
2. Always write good docstrings and clean code.
3. Always read the chain of `AGENTS.md` files from the current folder up through
   its parents to the repository root before working in that folder.

## File tree

```text
.
├── apps/                # deployable processes
│   ├── webapp/          # product Next.js app: task chat
│   ├── studio/          # internal Next.js app: runs, evals, admin
│   └── backend/         # pg-boss worker running agents and graders
├── packages/            # shared libraries, consumed from source
│   ├── ai/              # Gemini model factory and cost metering
│   ├── email/           # React Email rendering, transport-injected mailer
│   ├── agent/           # Strands agent factory, submitRun, prompts, tools
│   ├── evals/           # eval cases, experiments, graders, LLM judge
│   ├── observability/   # Pino, OpenTelemetry, health payload
│   ├── api/             # tRPC router for the webapp
│   ├── auth/            # Better Auth factory and roles
│   ├── db/              # schema, queries, migrations, queue, test databases
│   ├── ui/              # shared shadcn/AI Elements components
│   └── validators/      # placeholder for shared Zod schemas
├── tooling/             # workspace configuration and scripts
│   ├── cli/             # `multitudes` CLI
│   ├── dev/             # dev:up/login/down and Playwright e2e runner
│   ├── eslint/          # shared flat configs
│   ├── github/          # CI setup action
│   ├── prettier/        # shared Prettier config
│   ├── tailwind/        # theme CSS and PostCSS config
│   ├── typescript/      # shared tsconfig bases
│   └── version.mjs      # stamps the Git SHA build identity
├── infra/               # local Postgres Compose file, OTel Collector config
├── docs/                # platform, development, and design-review docs
├── turbo/generators/    # `turbo gen init` package scaffold
└── .agents/skills/      # vendored agent skills
```

Each workspace may have a more specific `AGENTS.md`; read all instructions from
the current folder up through the repository root before making changes.

## Auth, testing, and local development

- Read `docs/development.md` before changing auth or test infrastructure.
- Role definitions live in `packages/auth/src/permissions.ts`; enforce them in
  server actions as well as pages. Test helpers must never be imported by apps.
- All SQL, migrations, and isolated test database lifecycle helpers live in
  `packages/db`. Keep the core and agent migration journals separate.
- Use a fresh UUID request key per user intent; retries reuse it. Never replace
  database admission receipts with browser-only deduplication.
- `pnpm dev:up` starts an isolated local stack. `pnpm dev:login studio admin`
  creates a short-lived loopback sign-in link. These commands are development-only.
- Unit tests, integration tests, and Playwright journeys have separate commands.
  Browser tests run actual apps/worker with explicit process-local Google fixtures.
- The observability proposal in `docs/observability-roadmap.md` is a design review,
  not an implemented events/error/report API. Do not invent those contracts.

- Skills are vendored as ordinary files in `.agents/skills`; keep the MIT license
  and companion documents. Never recreate a skills submodule.
