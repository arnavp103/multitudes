# Local development and authenticated testing

Use Node 24 (`nvm install` reads `.nvmrc`; `nvm use` only switches the current
shell), pnpm 10.34.6, and Docker Compose v2. Run `pnpm install`, then
`pnpm dev:up`. The command creates a worktree-specific PostgreSQL container and
volume, allocates independent loopback ports, applies both migration journals,
seeds demo data, and starts webapp, Studio, and the real worker. It prints the app
URLs. Ctrl-C stops every process the command started, at any stage, before it
exits; `pnpm dev:down` stops the database and telemetry containers without
deleting their volumes. Every checkout has its own profile, ports, and database.

Local credentials live only in ignored `.local/profile.json` (mode 0600). Do not
copy this profile between machines/worktrees. Profiles created before Grafana
LGTM are given its `grafanaPort`/`otlpPort` on the next command, keeping every
existing port and secret. The command uses its generated
local database URL; it never seeds the production `POSTGRES_URL`. On Windows,
run this workflow in WSL2 with Docker integration.

The default worker uses deterministic Google HTTP fixtures and makes no model
API calls. Set `GEMINI_API_KEY` in the invoking shell to opt into live, billable
Gemini calls. Auth and database secrets still remain local. The fixture is loaded
by the dev/test runner, never by production worker configuration.

## Local telemetry (Grafana LGTM)

`pnpm dev:up` also starts `grafana/otel-lgtm` (Grafana, Tempo, Loki, Prometheus
and an OpenTelemetry Collector in one container) and prints its URL next to the
app URLs. Webapp, Studio and the worker run with the OpenTelemetry SDK enabled
and export OTLP/HTTP straight to that container's collector, so traces, logs and
metrics are queryable as soon as the apps start. Open **Drilldown → Traces** (or
Logs/Metrics) in Grafana; Studio's `/admin` links there. Grafana allows anonymous
admin access, so both ports bind to loopback only. Its data lives in the
project's `lgtm` volume; `pnpm dev:down` keeps it.

Apps export to LGTM directly rather than through `infra/observability/collector.yaml`:
the image already contains a collector wired to its backends, and locally there
is nothing to batch, sample, or authenticate in between. The collector file
remains the starting point for deployed environments (see
[agent-platform.md](agent-platform.md#deployed-telemetry-grafana)). Telemetry is
best effort: if LGTM cannot start, dev:up warns and continues. Set
`OTEL_SDK_DISABLED=true` to turn exporting off, or `OTEL_EXPORTER_OTLP_ENDPOINT`
/ `GRAFANA_URL` in the invoking shell to use another backend.

The admin dashboard seeds 30 days of local demo history (production and eval
runs, agent/judge model calls, scores, cost gaps) on every `dev:up`. Its IDs are
derived from the UTC day, so re-running tops up recent days without duplicates.
Browser tests use only the minimal seed.

## Local sign-in without Discord

In another terminal, run `pnpm dev:login studio admin` or
`pnpm dev:login webapp user`. Other seeded roles are `viewer` and `evaluator`.
Open the printed one-time link within two minutes. A temporary loopback server
sets a real signed HttpOnly cookie and redirects to the app, then shuts down.
There is no test-login route in either Next app. The CLI rejects production mode
and only uses the generated local profile. Webapp and Studio use different cookie
prefixes even on localhost, where different ports otherwise share cookies.

## Testing

- `pnpm test:unit`: fast unit/component tests, no PostgreSQL or browser.
- `TEST_POSTGRES_URL=... pnpm test:integration`: real PostgreSQL tests, including
  auth sessions/permissions, concurrent submission deduplication, and migrations.
- `pnpm --filter @multitudes/dev exec playwright install --with-deps chromium`
  installs the browser once. Build with `CI=1 pnpm build:apps`, then run
  `TEST_POSTGRES_URL=... pnpm test:e2e` for authenticated browser journeys.

`TEST_POSTGRES_URL` must reference a disposable server with CREATEDB permission.
`packages/db/testing` creates a random database, migrates it, and drops that exact
database in cleanup. Simultaneous test commands do not share databases or ports.
The browser runner uses actual production Next builds and the actual queue/worker;
only Google HTTP is stubbed. It exercises lost submission responses, reloads,
owner isolation, auth denial, eval promotion, experiment completion, and admin
role/ban/session controls. CI stores browser traces/screenshots on failure.
An uncatchable process kill can leave a `multitudes_test_*` database behind.

`packages/auth/testing` exposes Better Auth testUtils through a separate auth
instance with statically inferred plugins. It is not imported by either app.
Use its signed cookies for browser tests; do not invent session table rows or
mock `getSession`. New test identities must be unique per test.

## Auth deployment and migrations

Set `WEBAPP_URL` and `STUDIO_URL` to the externally visible URLs. Each is its own
trusted origin. OAuth callbacks use that app's URL by default. Set
`AUTH_PRODUCTION_URL` / `STUDIO_AUTH_PRODUCTION_URL` only when deliberately using
the OAuth proxy for preview environments. Register the callback URLs with Discord.
Use one shared strong `AUTH_SECRET` of at least 32 characters. Cookies are scoped
per app; no cross-subdomain SSO is enabled. Sessions last seven days, refresh daily,
and remain authoritative database reads without cookie caching. Auth HTTP rate
limits use the shared PostgreSQL rate_limit table. Application submission quotas
and spending controls are separate work, not implemented by this change.

`pnpm db:migrate` now runs core and agent journals under an advisory lock. The
core baseline adopts the unchanged template auth/post tables with conditional
creation; it does not correct arbitrary pre-existing schema drift. Inspect a
schema-pushed database against the baseline before adopting it. A subsequent
migration adds admin fields and the database rate limiter. Agent journals and
existing data remain intact. Apply migrations before deploying the new apps.
Use `pnpm auth:generate` when changing plugins, then `pnpm db:generate`; review
and commit the resulting migrations. Do not use db:push for deployments.

Sign in once with your real verified account, then run
`pnpm auth:bootstrap-admin your-verified-email@example.com` against the intended
database. This explicit operator command only promotes an existing verified
identity; it never creates or verifies an account. Existing email allowlists no
longer grant access. Add further access in Studio `/users`:

| Role      | Access                                                              |
| --------- | ------------------------------------------------------------------- |
| user      | Own product runs only                                               |
| viewer    | Read Studio runs, evals, and stats                                  |
| evaluator | Viewer plus author evals, submit tasks, and launch experiments      |
| admin     | Evaluator plus list users, assign roles, ban/unban, revoke sessions |

Application actions enforce these permissions server-side. Admin roles have no
impersonation, deletion, or password-reset permission. Role changes made in Studio
revoke the affected user's sessions; bans use the plugin's session revocation.
The UI blocks changing your own role or ban status. Admin actions emit metadata
through Pino; a transactional business-event audit log is separate future work.

## Submission identity

SDK task submission requires an authenticated `ownerId` and caller-generated UUID
`requestKey`. The service hashes the validated input/configuration. Postgres claims
the key and commits its receipt, run IDs, experiment, and queue jobs atomically.
Concurrent retries share the receipt; a changed payload with the same key fails.
Keys are scoped to the actor and retained with the ledger. Work retries still use
the original run ID and its normal attempt/fencing logic.

Chat saves a pending key and draft in sessionStorage before the request, preserving
it through a lost response/reload; successful submissions remove it. Changing the
input or model configuration starts a new intent/key. Studio forms carry hidden
request keys, covering replay of the same form submission. Reloading a fresh form
creates a new intent. This is admission deduplication, not a guarantee of exactly-once
external tool side effects.
