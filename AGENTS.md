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
├── apps/
│   ├── webapp/
│   ├── studio/
│   └── backend/
├── packages/
│   ├── ai/
│   ├── email/
│   ├── agent/
│   ├── evals/
│   ├── events/
│   ├── observability/
│   ├── api/
│   ├── auth/
│   ├── db/
│   ├── ui/
│   └── validators/
└── tooling/
    ├── cli/
    ├── eslint/
    ├── github/
    ├── prettier/
    ├── tailwind/
    └── typescript/
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
- Business event names/versions and strict payloads live in
  `packages/events/src/registry.ts`. Read `docs/business-events.md` before adding
  events. Use `packages/db/src/events.ts` inside the state-changing transaction;
  telemetry is published only after commit. Never emit business facts from UI code.
- `event` is append-only analytics/audit history, not event sourcing. `agent_run`,
  `run_event`, and `model_call` remain the execution/state/cost ledgers. Event run
  foreign keys restrict deletion; do not cascade-delete or rewrite audit facts.
- Errors, reports, and the telemetry backend in `docs/observability-roadmap.md`
  remain proposals. Do not invent contracts that have not been implemented.

- Skills are vendored as ordinary files in `.agents/skills`; keep the MIT license
  and companion documents. Never recreate a skills submodule.
