# Agent platform

The existing `apps/webapp` remains the product app. `apps/studio` is a separate,
allowlisted Next.js application on port 3001. `apps/backend` is a long-lived Node
worker. Production integrations and eval trials use the same `packages/agent`
factory. No sandbox provider, shell/file tool, vector store, or long-term memory
is configured.

## Start locally

1. Run PostgreSQL 17 or connect to a development database. Set `POSTGRES_URL` in
   your local environment using the repository's existing dotenvx workflow.
2. Run `pnpm install`, then `pnpm db:migrate` to create the agent tables. On a
   fresh database, run `pnpm db:push` afterwards to initialize the existing
   auth/template tables. Apply migrations before `db:push` so the initial
   migration does not encounter tables already created by schema push.
3. Set `AUTH_SECRET` (32+ characters), Discord credentials, `STUDIO_URL`,
   `STUDIO_ALLOWED_EMAILS`, `AGENT_PROVIDER`, `AGENT_MODEL_ID`, and
   `AGENT_CODE_VERSION`. Use the same code version in the studio and worker;
   locally `local` is sufficient. Production should use the deployed Git SHA.
4. Register `http://localhost:3001/api/auth/callback/discord` with Discord as an
   additional redirect URL. The product app retains its own callback URL.
5. Configure AWS credentials/region for Bedrock or `OPENAI_API_KEY` for OpenAI.
6. Run `pnpm dev:backend` and `pnpm dev:studio` in separate terminals. Open
   http://localhost:3001 and sign in with an allowlisted, verified email.

The studio denies access when the allowlist is empty. Every page query and
server action checks access; hiding navigation is not the authorization boundary.
The studio uses Node runtime, not Edge. Production secrets stay server-side.
The studio is internal and should have a separately restricted deployment.

`pnpm db:generate` generates migrations only for `agent-schema.ts`. They use a
separate migration journal (`drizzle.agent_migrations`) so adopting this platform
does not pretend the existing template/auth tables have a migration baseline.
The existing `db:push`/auth generation workflow remains available. The initial
agent migration adds only new tables. pg-boss manages its own `pgboss` schema at
startup, requiring a database role with schema/table creation privileges.

## Use the backend as an SDK

```ts
import { submitRun } from "@multitudes/agent";

const runId = await submitRun({
  input: "Summarize this request...",
  configuration: {
    provider: "bedrock", // or "openai"
    modelId: configuredModelId,
    systemPrompt: configuredPrompt,
    codeVersion: deployedGitSha,
  },
});
```

Call this from a trusted, authenticated server entrypoint. `submitRun` is a
server-side SDK, not a public unauthenticated HTTP API. It returns after the run
and job commit atomically. The browser can disconnect while work continues.
Use `getRun`/`getRunEvents` from `@multitudes/db/runs` to read durable progress.
The studio polls only while jobs are pending.

The worker validates the frozen code version against its own deployment version.
Drain old work before replacing a deployment; this starter has one queue and does
not route jobs to multiple simultaneously deployed code versions.

## Production data to evals

Open a run, choose **Create eval case**, review/sanitize the copied input, and
write expected/forbidden text. Production output is reference material, never an
automatic expected answer. Cases are immutable; save a new case to revise one.
Group cases by dataset, choose a provider/model/prompt, and launch an experiment
with 1–5 trials per case. Inspect per-assertion results and compare against another
experiment by case ID. Scores distinguish execution failures from assertion
failures and pending work. The evaluator version is stored with every score.

This first slice supports single-input text tasks and case-sensitive `contains`
and `not_contains` assertions. The grader boundary in `packages/evals` is where
LLM judges or Python Strands Evals can be added. It does not yet import historical
external traces, author multi-turn/environment fixtures, calculate statistical
significance, or optimize prompts automatically. Captured trajectories support
review and regression testing; recording them alone is not self-learning.

## Recovery semantics

- pg-boss persists jobs, heartbeats, expirations and bounded retries (three total
  attempts). Runs are inserted in the same SQL transaction as their queue jobs.
- Strands saves its opaque session bytes in Postgres after each message. Recreated
  agents load the same conversation and resume without appending the user input
  a second time. A model call interrupted before its checkpoint can repeat and
  incur another model charge.
- Attempt numbers fence session/event/result writes. Once a newer attempt starts,
  an old worker cannot overwrite its state. This does not make external effects
  exactly once. No side-effecting tools are shipped; adding one requires an
  idempotency key and reconciliation for the executed-but-not-recorded window.
- A persisted result receipt avoids repeating model work if only grading or
  committing the final run status needs a retry. Run completion and eval score
  commit together. Cancellation, truncation and non-final stop reasons are
  failures, not successful answers.
- SIGTERM/SIGINT abort active model calls, drain the queue, close DB connections,
  then flush telemetry. A hard kill leaves work for queue recovery.
- A periodic reconciler marks runs failed when the queue has exhausted retries or
  cancelled work after a hard crash. Run status therefore converges even when the
  last worker cannot record its own failure.
- Each invocation has a 240-second cancellation deadline, ten-turn budget and
  50,000-token soft cap; providers cap generated output at 4,096 tokens per call.

## Observability

`packages/observability` exports `/logger`, `/node`, and `/context`. Each Node
process initializes one OTel SDK before importing the application. Strands uses
those global providers; it must not register a second set. The worker connects
Strands' internal logger to a Pino child logger. Next's instrumentation entrypoint
initializes providers in both web apps. tRPC emits correlated timing logs.

Pino emits JSON to stdout **and** sends the redacted JSON records to the OTel log
provider. Traces, logs and metrics export over OTLP/HTTP, configured using standard
`OTEL_*` environment variables. Do not also ingest the same stdout logs into the
same backend, or they will be duplicated. Use `LOG_LEVEL` for worker log verbosity.
`run_id`, trace IDs and span IDs belong on logs/spans, not metric labels. The queue
payload carries W3C context so worker spans can continue the initiating trace.

For local collection, run an OpenTelemetry Collector with
`infra/observability/collector.yaml` mounted as its configuration and publish port 4318. The supplied debug exporter confirms receipt; it is not a persistent UI.
Replace it with your chosen backend's exporter for searchable telemetry. Set
`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`. No collector or database is
deployed by this PR. With no collector running, telemetry export is best effort;
agent state is independently persisted in Postgres.

Durable `run_event` rows capture full messages and semantic model/tool boundaries,
not token-by-token logs. Treat these and SDK trace content as sensitive application
data. Pino field redaction does not scrub arbitrary text inside prompts or native
Strands trace attributes; configure retention, restricted access, and any required
content filtering before sending production data to an external telemetry service.

## Validation

`pnpm test` runs model-free Strands checkpoint tests, deterministic grader tests,
and an in-memory OTel export/correlation/redaction test. The persistence integration
test requires `TEST_POSTGRES_URL` pointing at a **disposable empty database** and
creates the agent tables. CI supplies PostgreSQL 17 and checks transactional queue
rollback, checkpoint byte round-trips, and stale-attempt fencing. It must never
point at production. A live model/provider smoke test requires your credentials.
