# Web app monorepo

A pnpm and Turborepo workspace for a Next.js application and shared TypeScript packages.

## Requirements

- Node.js `^22.21.0`
- pnpm `^10.19.0`

## Getting started

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create a local environment file and configure its values:

   ```sh
   cp .env.example .env
   ```

   Set `POSTGRES_URL` to your Postgres connection string, along with `AUTH_SECRET` and the Discord OAuth credentials. Generate an auth secret with `openssl rand -base64 32`.

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

## Commit messages

Use Conventional Commit messages with a non-empty scope, for example `feat(webapp): add account settings` or `fix(repo): correct workspace metadata`. Commit messages are checked automatically by a Husky `commit-msg` hook.

## Before deploying

Configure the environment variables in your hosting provider, including the database connection, auth secret, and OAuth credentials. Set up the OAuth provider's callback URL for your deployed app. Update the app metadata and deployment settings in `apps/webapp` for your domain.

The `@multitudes/*` package scope is a placeholder; replace it with your own scope when you customize the workspace.
