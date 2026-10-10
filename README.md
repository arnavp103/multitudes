# Web app monorepo

A pnpm and Turborepo workspace for a Next.js application and shared TypeScript packages.

## Requirements

- Node.js `^24.0.0`
- pnpm `^10.34.6`

## Getting started

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

3. Generate the Better Auth database schema and push the Drizzle schema:

   ```sh
   pnpm auth:generate
   pnpm db:push
   ```

4. Start the web app:

   ```sh
   pnpm dev:webapp
   ```

## Workspace layout

- `apps/webapp` — Next.js app with tRPC, Better Auth, and the shared UI
- `packages/api` — tRPC routers and context
- `packages/auth` — Better Auth configuration
- `packages/db` — Drizzle schema, client, and database scripts
- `packages/ui` — shared React UI components
- `packages/validators` — shared validation schemas
- `tooling/cli` — the `multitudes` command-line tool
- `tooling` — shared ESLint, Prettier, Tailwind CSS, TypeScript, and GitHub Actions configuration

## Common commands

| Command                     | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `pnpm dev:webapp`           | Run the web app and its workspace dependencies     |
| `pnpm build`                | Build all workspaces                               |
| `pnpm lint`                 | Lint all workspaces                                |
| `pnpm typecheck`            | Type-check all workspaces                          |
| `pnpm format:fix`           | Format all workspaces                              |
| `pnpm db:push`              | Push the Drizzle schema to the configured database |
| `pnpm db:studio`            | Open Drizzle Studio                                |
| `pnpm exec multitudes help` | Show CLI help                                      |
| `pnpm syncpack`             | Check dependency version consistency               |

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
