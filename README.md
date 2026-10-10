# Web app monorepo

A pnpm and Turborepo workspace for a Next.js application and shared TypeScript packages.

## Requirements

- Node.js `^24.0.0`
- pnpm `^10.34.6`
- TypeScript 7.0.2 and ESLint 10 (installed through the workspace catalog)

## Getting started

For the isolated local stack, install dependencies and run `pnpm dev:up`
(Docker Compose v2 required). In another terminal, run `pnpm dev:login studio admin`.
See [local development](docs/development.md) for fixtures and browser testing.
The steps below configure an existing database and OAuth provider instead.

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create the environment files from the commented template:

   ```sh
   cp .env.example .env
   cp .env.example .env.staging
   cp .env.example .env.production
   ```

   Uncomment and set `POSTGRES_URL` to your Postgres connection string, along with `AUTH_SECRET` and the Discord OAuth credentials. Generate an auth secret with `openssl rand -base64 32`.

   Run commands with a selected environment file using `pnpm exec dotenvx run -f .env.staging -- <command>` or `pnpm exec dotenvx run -f .env.production -- <command>`. Encrypt files before committing them with `pnpm exec dotenvx encrypt -f .env.staging -f .env.production`; keep `.env.keys*` private and provide the matching `DOTENV_PRIVATE_KEY_*` values to deployment environments.

   The pre-commit hook blocks unencrypted dotenv files and scans staged changes with Gitleaks. Install Gitleaks locally with `go install github.com/zricethezav/gitleaks/v8@v8.30.1`.

3. Apply the versioned auth and agent database migrations:

   ```sh
   pnpm db:migrate
   ```

4. Start the web app:

   ```sh
   pnpm dev:webapp
   ```

## Workspace layout

- `apps/webapp` — Next.js app with tRPC, Better Auth, and the shared UI
- `apps/studio` — internal playground, eval authoring, trajectories and reliability/cost dashboard
- `apps/backend` — durable Strands worker
- `packages/ai` — metered Gemini AI Studio through native Strands GoogleModel
- `packages/agent` — SDK, API tools and editable system prompt
- `packages/evals` — assertions and LLM judges
- `packages/observability` — Pino and OpenTelemetry for every server app
- `packages/email` — React Email templates and provider-neutral delivery interface
- `packages/api` — tRPC routers and context
- `packages/auth` — Better Auth configuration
- `packages/db` — Drizzle schema, client, and database scripts
- `packages/ui` — shared React UI components
- `packages/validators` — shared validation schemas
- `tooling/cli` — the `multitudes` command-line tool
- `tooling` — shared ESLint, Prettier, Tailwind CSS, TypeScript, and GitHub Actions configuration

## Common commands

| Command                     | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `pnpm dev:webapp`           | Run the web app and its workspace dependencies               |
| `pnpm build:apps`           | Build both Next apps and the worker with a Git version stamp |
| `pnpm test:health`          | Smoke-test health endpoints after building                   |
| `pnpm build`                | Build all workspaces                                         |
| `pnpm lint`                 | Lint all workspaces                                          |
| `pnpm test:unit`            | Run unit and UI tests                                        |
| `pnpm test:integration`     | Run HTTP adapter and isolated PostgreSQL tests               |
| `pnpm dev:email`            | Preview React Email templates on port 3002                   |
| `pnpm typecheck`            | Type-check all workspaces                                    |
| `pnpm format:fix`           | Format all workspaces                                        |
| `pnpm db:push`              | Push the Drizzle schema to the configured database           |
| `pnpm db:studio`            | Open Drizzle Studio                                          |
| `pnpm exec multitudes help` | Show CLI help                                                |
| `pnpm syncpack`             | Check dependency version consistency                         |

## Commit messages

Use Conventional Commit messages with a non-empty scope, for example `feat(webapp): add account settings` or `fix(repo): correct workspace metadata`. Commit messages are checked automatically by a Husky `commit-msg` hook.

## Before deploying

Configure the environment variables in your hosting provider, including the database connection, auth secret, and OAuth credentials. Set up the OAuth provider's callback URL for your deployed app. Update the app metadata and deployment settings in `apps/webapp` for your domain.

The `@multitudes/*` package scope is a placeholder; replace it with your own scope when you customize the workspace.

## Agent runtime and evaluation studio

The product app remains in `apps/webapp`. A separate Next.js app in `apps/studio`
provides internal run inspection, eval case authoring, and experiment comparisons.
`apps/backend` runs the shared Strands SDK agent on a durable Postgres queue.
Pino and OpenTelemetry live in `packages/observability`.

See [the setup and operating guide](docs/agent-platform.md) for migrations,
credentials, studio access, telemetry, and recovery limits. Start the applications
with `pnpm dev:studio` (port 3001) and `pnpm dev:backend`. No sandboxes are configured.

See [development and authenticated testing](docs/development.md) for one-command local setup, role bootstrap, auth migrations, and browser tests. The [observability proposal review](docs/observability-roadmap.md) records the separate follow-up design.
