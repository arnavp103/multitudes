# Agent platform

The existing `apps/webapp` remains the product app. `apps/studio` is a separate,
role-protected Next.js application on port 3001. `apps/backend` is a long-lived Node
worker. Production integrations and eval trials use the same `packages/agent`
factory. No sandbox provider, shell/file tool, vector store, or long-term memory
is configured.

## Start locally

Run `pnpm install`, then `pnpm dev:up`. This starts an isolated Postgres database,
webapp, Studio, and worker for the current checkout. Sign in with
`pnpm dev:login studio admin`. See [development.md](development.md) for prerequisites,
fixture/live model modes, concurrent worktrees, and authenticated browser tests.

For manually managed environments, set `POSTGRES_URL`, app URLs, a 32+ character
`AUTH_SECRET`, Discord credentials, `GEMINI_API_KEY`, and `AGENT_CODE_VERSION`.
Run `pnpm db:migrate` before deployment. It applies both the core/auth baseline
and additive agent migrations, using separate journals. Existing schema-pushed
installations must be checked against the baseline before adoption. pg-boss still
manages its own `pgboss` schema at startup. Bootstrap a verified administrator
with `pnpm auth:bootstrap-admin <email>`; runtime email allowlists are no longer used.

Every Studio page query and server action checks role permissions. Apps and worker
share the same agent code version. Studio uses the Node runtime and keeps secrets
server-side; treat it as an internal deployment.

## Use the backend as an SDK

```ts
import { submitRun } from "@multitudes/agent";

const runId = await submitRun({
  ownerId: session.user.id,
  requestKey, // caller UUID: reuse for retries of this exact user intent
  input: "Summarize this request...",
  configuration: {
    provider: "gemini",
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

Single-input text tasks support case-sensitive `contains`/`not_contains` assertions
and tool-free LLM judges with a versioned rubric and pass threshold. The grader
boundary lives in `packages/evals`. This starter does not import historical
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
- Each agent invocation has a 180-second deadline, ten-turn budget and
  50,000-token soft cap. Judges have a separate 60-second deadline. Providers cap
  generated output at 4,096 tokens per call.

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

`pnpm dev:up` collects locally into Grafana LGTM (see
[development.md](development.md#local-telemetry-grafana-lgtm)). For a bare
receipt check without Grafana, run an OpenTelemetry Collector with
`infra/observability/collector.yaml` mounted as its configuration, publish port
4318 and set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`; its debug
exporter prints what arrives. With no collector running, telemetry export is
best effort; agent state is independently persisted in Postgres.

### Deployed telemetry (Grafana)

Product metrics (cost, tokens, eval quality) are read from Postgres by Studio's
`/admin`. Application performance (latency, errors, traces, logs) belongs in
Grafana. Nothing is provisioned by this repository; choose one of:

- **Grafana Cloud.** In the stack's _OpenTelemetry_ connection tile, generate a
  token and copy the OTLP gateway endpoint. For a single service the apps can
  export straight to it:

  ```sh
  OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-<region>.grafana.net/otlp
  OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64 instance-id:token>"
  ```

- **Self-hosted** Grafana with Tempo, Loki and Mimir/Prometheus (for example
  the LGTM Helm charts), each accepting OTLP.

For production, prefer a collector next to the apps: it batches, retries and
memory-limits exports, can tail-sample or filter sensitive attributes, and keeps
the backend credential out of application processes. Start from
`infra/observability/collector.yaml` (OpenTelemetry Collector _contrib_
distribution, for `basicauth`) and replace the `debug` exporter:

```yaml
extensions:
  basicauth/grafana:
    client_auth:
      username: ${env:GRAFANA_OTLP_INSTANCE_ID}
      password: ${env:GRAFANA_OTLP_TOKEN}
exporters:
  otlphttp/grafana:
    endpoint: ${env:GRAFANA_OTLP_ENDPOINT}
    auth:
      authenticator: basicauth/grafana
service:
  extensions: [basicauth/grafana]
  # ...and use [otlphttp/grafana] as each pipeline's exporter.
```

Point the apps at that collector with `OTEL_EXPORTER_OTLP_ENDPOINT`, and set
`GRAFANA_URL` (for example `https://<stack>.grafana.net`) on Studio so `/admin`
links to Traces, Logs and Metrics Drilldown. Studio hides the links when it is
unset. Review the retention and access warnings below before exporting
production content.

Durable `run_event` rows capture full messages and semantic model/tool boundaries,
not token-by-token logs. Treat these and SDK trace content as sensitive application
data. Pino field redaction does not scrub arbitrary text inside prompts or native
Strands trace attributes; configure retention, restricted access, and any required
content filtering before sending production data to an external telemetry service.

## Validation

`pnpm test:unit` runs model-free runtime, judge parsing, metering, email, UI, CLI,
and telemetry tests. `pnpm test:integration` runs real provider adapters against
HTTP fixtures plus persistence tests using PostgreSQL 17. The database test account
needs CREATEDB permission on a disposable test server; tests migrate and drop their
own isolated database. Never point it at production. Live provider smoke tests
require your credentials and are not part of these suites.

## Shared UI and chat

Both Next.js apps use `@multitudes/ui`, a shared charcoal/teal theme, and
`next-themes` (dark by default; light and system are available in the sidebar).
Theme preference is persisted under `multitudes-theme`. The provider injects its
initialization script before hydration to avoid a theme flash.

The UI package contains source-owned components from the official shadcn
`new-york-v4` registry and Vercel AI Elements (conversation, message, suggestions,
reasoning, tools, code blocks, shimmer). `packages/ui/components.json` configures
the shared CSS and the `@ai-elements` registry. Add components from that package:

```sh
cd packages/ui
pnpm dlx shadcn@latest add @ai-elements/conversation
```

Registry sources: https://ui.shadcn.com/r/styles/new-york-v4/{name}.json and
https://registry.ai-sdk.dev/{name}.json. Local adaptations use workspace imports,
repo formatting/lint rules, and current AI SDK types. AI SDK is used for UI types;
Strands remains the agent runtime. No AI Gateway key is required by these views.

The product app replaces the template post screen with authenticated task chat.
Studio adds `/playground` with provider/model/prompt controls and a trajectory link.
Each task is a fresh run, not a persistent multi-turn conversation. Results update
when persisted by the worker; this is not token streaming. The `run` URL parameter
lets the UI reconnect after a reload without enqueueing again. Poll failures pause
and offer Reconnect. A lost submission response is ambiguous: check studio before
retrying. No automatic resubmission is performed.

Product reads enforce `agent_run.owner_id` against the authenticated session. Old
runs without an owner remain visible only through staff-protected studio routes.
Run the new additive migration before using product chat. Studio pages and actions
continue to require the verified-account role checks; there is no development bypass.

## Logging conventions

Use `createLogger("multitudes-<service>")` from `@multitudes/observability/logger`
for Node code. `LOG_LEVEL` is honored centrally. Child bindings carry run IDs and
attempt numbers; the active OTel trace/span is added automatically. Pino writes
JSON to stdout and forwards the same redacted records to the OTel log provider.
Next.js request errors, auth failures, tRPC requests, DB/queue failures, submissions,
worker lifecycle/model calls, and eval authoring/launching have structured logs.

Use `reportClientError(component, error)` from the separate `/browser` entrypoint
for UI boundaries. It uses Pino's browser implementation and logs only error type
and the Next.js digest to the browser console. It does not ship Node exporters or
transmit client logs. Pure validators and UI primitives do not log every render or
keystroke. Prompt/response/trajectory content belongs in the protected run store,
not application logs. Never log request headers, cookies, forms, or provider bodies.
Error serialization excludes messages/causes because they can contain SQL values
or model data; safe error types/codes and stack frames remain useful diagnostics.

## Test commands

- `pnpm test` / `pnpm test:unit`: model-free runtime/eval/telemetry unit tests, CLI
  tests, and jsdom UI tests. No Postgres or provider credentials required.
- `TEST_POSTGRES_URL=postgres://... pnpm test:integration`: separate
  `packages/ai/test/integration.test.ts` (HTTP fixtures) and
  `packages/db/test/integration.test.ts`. Database tests fail if the URL is absent. The
  account needs CREATEDB permission on a **disposable test server**. Each invocation
  creates and migrates a uniquely named database, exercises enqueue/rollback,
  ownership isolation, checkpoints, attempt fencing, and recovery, then drops it.
  Repeated/concurrent runs do not share tables or pg-boss jobs. Never supply a
  production connection. A forcibly killed test can leave its temporary database.

CI runs unit and integration suites in distinct jobs and builds both Next.js apps.

## Models, costs, and the admin dashboard

`packages/ai` owns model construction and metering. Agents and LLM judges use the
native Strands `GoogleModel` with `@google/genai`, `vertexai: false`, and
`GEMINI_API_KEY`. The default model is `gemini-3.8-flash`; Studio lets you edit the
Gemini model ID. No VercelModel or AI SDK adapter is involved in execution, so
UI AI SDK dependencies can evolve independently.

The Google client makes one HTTP attempt per metered invocation; harness/worker
retries remain visible in the ledger. New requests only accept `gemini`.
Historical configurations and cost snapshots remain readable. Before deploying
this change, drain pending non-Gemini runs with the previous worker. To rerun an
old experiment or use a legacy judge, author a new Gemini configuration/case;
legacy providers fail explicitly and are never silently reinterpreted.

Every agent or judge model invocation creates a `model_call` row **before** network
work. It records purpose, provider, model, attempt, timestamps, reported token
usage and a USD rate snapshot. Usage metadata is persisted as soon as it arrives.
Finalization updates the same row, so it cannot double-count a completed call.
Real repeated invocations get distinct rows; superseded attempts still retain
actual costs. A hard kill, lost provider response, or missing usage leaves a cost
gap. Telemetry sampling does not affect the ledger. Provider-side retries or
charges without reported usage still need invoice reconciliation.

`/admin` in studio aggregates 1/7/30-day windows: execution success, pending and
retried runs, p95 queue-to-finish latency, eval pass rate, judge mean score, model
usage by purpose, estimates, and unknown-cost/unfinished-call counts. Charts show
estimated cost and tokens by model and by purpose (agent vs judge), candidate
pass rate by model, mean judge score by judge model, and eval outcomes over time.
Windows align to whole UTC buckets (24 hourly buckets for 1d, otherwise daily),
so cards, charts and tables cover the same rows. The bounded queries live in
`@multitudes/db/dashboard` (`getDashboard`, `getUsageSeries`, `getEvalSeries`);
rates are recomputed from sums, and buckets without graded runs are gaps, not 0%.
It is protected by the same verified-account role checks as the rest of studio.
When `GRAFANA_URL` is set, it also links to Grafana for application performance.

Reusable visx charts live in `@multitudes/ui/charts/*`: `TimeSeriesChart`
(line/area), `StackedBarChart`, shared frame/legend/tooltip, and pure helpers in
`charts/data` (`pivotRows`, `keepTopSeries`, formatters). Pass plain data and a
named `format`; server components cannot pass functions to these client charts.
Colours come only from the theme's `--chart-1`…`--chart-5` custom properties, in
a fixed slot order; more than five series fold into a neutral "Other". Each chart
has a legend, hover/keyboard (arrow keys) readout, a visible data table, and
explicit empty/loading states.

Prices live in `packages/ai/src/pricing.ts`; snapshots are never retroactively
rewritten. Verified 2026-10-10 against:

- https://ai.google.dev/gemini-api/docs/pricing (paid standard text, including
  thinking; scheduled January 2027 rate change included).

The UI labels these **estimates**, not invoices. Free-tier credits, discounts,
cache storage, and unknown model rates are not invented. Add a rate entry and a
pricing boundary test whenever adding a model preset. No billable built-in search,
code-execution, or grounding tools are configured.

## Harness development loop

- Edit `packages/agent/src/prompts/system.ts`; bump its version and the deployed
  `AGENT_CODE_VERSION`. Each run freezes its actual system prompt and configuration.
- Keep budgets in `packages/agent/src/policy.ts`. Timeouts, cancellation, turn and
  token limits are explicit. Token budgets are soft at model-call boundaries.
- Add application behavior in `packages/api/src/agent-service.ts` (or a domain
  service), enforcing identity there. The tRPC router and `packages/agent/src/tools.ts`
  wrap the same service. Models never supply their own actor ID. Existing tools
  are read-only: capabilities and the authenticated user's task status/result.
- Inject the service object in tool tests. For future side effects, require a stable
  idempotency key and durable receipt before registering the tool. Never retry a
  side effect based only on an LLM's claim. No shell, filesystem, or sandbox tools.
- Promote production failures into immutable cases; write expectations independently
  of the candidate. Run repeated trials, review failed trajectories, then compare
  a baseline experiment before promoting a prompt/model change. There is no
  automatic prompt self-modification in production.
- Eval tasks have no production actor by default. The status tool denies access;
  inject explicit fixture services when extending evals to private tool workflows.
  Do not grant a judge or evaluator blanket production access.

## LLM judges

Case authoring supports an optional rubric, Gemini judge model, and a
0–1 pass threshold. Cases can use assertions, a judge, or both; when both are
configured, **both must pass**. The judge prompt is independently editable at
`packages/evals/src/prompts/judge.ts` and versioned. A tool-free judge receives the
rubric, original input, and candidate as data and must emit a strict JSON verdict.
Invalid JSON, out-of-range scores, timeouts, or provider failures are execution
failures, never passes. Review/calibrate rubrics using human-scored examples;
model grading is probabilistic and susceptible to adversarial candidate text.

The candidate result and judge verdict have separate durable receipts. Retrying
DB completion does not rerun a successfully saved judge. Failed/incomplete judge
calls may repeat, each with its own cost record. Costs are displayed separately
as `agent` and `judge`. The initial judge evaluates final text; tool-sequence and
multi-turn/environment graders should be added as explicit new evaluator versions.

## Full server telemetry

Both apps now conditionally load `instrumentation.node.ts` from Next's
`instrumentation.ts`, enable `NEXT_OTEL_VERBOSE=1`, and use the shared NodeSDK.
This is Next's supported manual setup, equivalent to registering `@vercel/otel`;
registering both would create competing providers. Next contributes request,
render, routing, and fetch spans. Node adds HTTP/undici (outbound fetch), Postgres,
and runtime instrumentation. Application spans cover tRPC, queue context, tools,
models, evals and email. Root Next request spans generate Pino access logs and
HTTP counters/duration metrics, not just error logs. These span-derived signals
follow trace sampling; use unsampled collection or infrastructure metrics for
complete traffic counts. Query strings are removed
from exported URL attributes. Client errors use the browser-only Pino entrypoint;
there is no configured browser log ingestion service.

## Email

`packages/email` uses React Email for HTML and plain-text rendering. Run
`pnpm dev:email` for template previews on port 3002. `createMailer(transport)`
accepts a small provider-neutral interface; no provider, API key, or automatic
sending is configured. Calling `send` without an adapter throws explicitly.
The caller must pass an idempotency key; future adapters must forward or enforce
it. There are no implicit retries after ambiguous send failures. Recipient
addresses, subject, and email content are excluded from logs.

## Deployment identity and health

Use `pnpm build` or `pnpm build:apps` to build deployable applications. The build
wrapper resolves `APP_VERSION` from the full Git commit SHA before Turbo hashes
its tasks, then generates `packages/observability/src/build-info.generated.ts`.
This ignored file is a required build artifact: Next bundles it into both server
and browser code, and the source-based worker imports it at runtime. Include it
when packaging the worker; do not regenerate it in the runtime image. A changed
SHA changes Turbo's cache key even if source files are otherwise identical.

Git-less build contexts must supply the full commit SHA explicitly:

```sh
APP_VERSION="$CI_COMMIT_SHA" pnpm install --frozen-lockfile
APP_VERSION="$CI_COMMIT_SHA" pnpm build:apps
```

`APP_VERSION` must be a full 40- or 64-character hexadecimal SHA. An absent Git
checkout without an explicit version fails the build instead of inventing a
version. Runtime `APP_VERSION` and `OTEL_RESOURCE_ATTRIBUTES` cannot replace the
baked identity. `version` in Pino (including browser logs), OTel `service.version`
and `version`, and the health response are identical. OTel also exposes the full
SHA as `vcs.ref.head.revision`. Keep `AGENT_CODE_VERSION` aligned with this revision
when deploying the worker and producer apps; it remains the execution-compatibility
check for durable jobs.

All three apps serve public `GET /api/health` with `Cache-Control: no-store`:

```json
{ "status": "ok", "version": "<full Git SHA>", "sha": "<full Git SHA>" }
```

The Next endpoints return 200 without requiring authentication or downstream
connections. The worker listens on `PORT` (default 8080), returning 503 with
`status: "unavailable"` before its queue is ready and during graceful draining.
These are process checks, not database/provider availability or queue-progress
checks; use the existing operational metrics for those dependencies.

- App Runner: choose an HTTP health check with path `/api/health` on the app port.
- ALB target group: path `/api/health`, success matcher `200`, traffic port.
- Docker: after building/copying the artifact, use a probe that fails on non-200:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
```

Set the container `PORT` to match its server (Next defaults to 3000; Studio dev
uses 3001; the worker defaults to 8080). No AWS resources are provisioned here.
`pnpm test:health` starts both built Next apps and verifies public health and
runtime-override resistance. The separate backend integration test exercises
startup/ready/draining states on a real HTTP socket.

## TypeScript 7 and ESLint 10

Workspace compilation and type checking use TypeScript 7.0.2's native `tsc`.
VS Code recommends Microsoft's TypeScript 7 extension and uses the workspace
native language server instead of the removed JavaScript tsserver path.
Next enables `experimental.useTypeScriptCli` so its build check uses the same
compiler. ESLint 10 uses the shared flat config; legacy plugin rule APIs are
adapted with the official `@eslint/compat` helpers.

The ESLint-config workspace alone retains `typescript` as an alias to Microsoft's
`@typescript/typescript6` compatibility API because typescript-eslint currently
requires it. Its separate `@typescript/native` alias supplies the same TypeScript
7 compiler, without competing `tsc` executables. This is a tooling compatibility
bridge, not an application compiler downgrade. See Microsoft's migration guidance:
https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ .
