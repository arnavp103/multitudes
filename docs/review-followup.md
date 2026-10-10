# Harness review follow-up

Reviewed against main after PR #2. This change addresses the eight verified
security/runtime findings and closely related privacy and maintenance defects.
It does not introduce a new hosting provider, telemetry backend, or spending policy.

## Addressed

- The tRPC session projection returns only user id/name/image. The template post
  router, secret-message procedure, and post UI are removed. The unused Post table
  remains to avoid destructive data migration. Wildcard CORS grants are removed.
- Model Markdown cannot render images or raw HTML. Links must be HTTPS and retain
  Streamdown's external-link confirmation. The installed Streamdown API uses
  `disallowedElements` and `urlTransform`, not the suggested prefix props.
- Native Google requests set `params.maxOutputTokens=4096`. Both agent and judge
  explicitly disable Strands transient retries; the Google client makes one HTTP
  attempt. pg-boss still owns up to three job attempts. Context-window recovery
  remains part of the explicit sliding-window conversation manager, not a provider
  outage retry policy. Every actual model call is still metered.
- Eval cases freeze task fixtures. Worker eval tools reuse production service
  validation and response limits against those fixtures, never live task rows.
  Missing fixture IDs mean an authorized lookup miss, not an anonymous call.
  Existing cases receive empty fixtures and should be re-authored when they need
  task lookup responses. Experiment runs also record the submitting owner.
- Reconciliation handles missing retained jobs and pages through the full eligible
  backlog using a fixed cutoff and a timestamp/id cursor. Updates fence against
  changes to attempt, timestamp, or status. PostgreSQL timestamp precision is
  preserved. An index supports the status/time query.
- Agent semantic events have app-owned `v: 1` envelopes. Model/tool exceptions
  exclude messages and causes. Unexpected tool failures are sanitized before
  entering conversation history. Full successful messages/tool data intentionally
  remain in the protected domain ledger and session checkpoints.
- An OTel processor strips model content from span attributes/events before
  exporters. Exception messages, stack traces, and status descriptions are always
  omitted. Nested Pino fields and child bindings are recursively redacted. Log
  messages must remain static text; arbitrary free text cannot be safely scrubbed.
- New run/experiment configuration stores prompt version (or a content hash for
  custom prompts). The conversation window is explicitly 40 messages. No execution
  tools are registered; `sandbox: false` is explicit and does not sandbox a future
  tool. Registering execution tools would require a separate isolation design.
- The judge requests schema-constrained JSON at temperature zero and resolves a
  case's frozen prompt version from a retained prompt registry. Cases already
  stored prompt versions before this change; the problem was the global equality
  gate. Old prompt entries must be retained when adding new versions.
- Task services now live in `packages/db`, removing agent → API layering. Next
  transpilation lists cover AI; Studio no longer pulls in API through the agent. Existing queue settings are updated
  at startup; queue supervision runs in the dedicated worker, not producers.
- All 21 selected skills and their companion documents/license are ordinary Git
  files in `.agents/skills`. Claude links resolve within a normal clone. The
  submodule and `.gitmodules` are gone. Node/pnpm engines are enforced. Postinstall
  only stamps the version; the separately run workspace linter is pinned.

Apply the new agent migration before deploying: it adds fixture JSON to eval cases
and the reconciler index. No tables or historical trajectories are dropped.

## Already addressed or qualified

PR #2 already added database-backed Better Auth rate limits, distinct app cookie
prefixes, conditional OAuth proxy configuration, consistent strong-secret
validation, real exports, roles/admin controls, and authenticated test tooling.
Trusted client-IP headers remain deployment-specific: configure them only once
an actual trusted reverse proxy strips untrusted incoming values.

The CI pull-request `branches` filter matches the **target** branch, not the source
branch. Feature branches targeting main are already covered; `"*"` would exclude
nested target branch names. The rest of the CI hardening suggestions remain useful.

## Remaining work

These are real gaps or design proposals, not claims of completion:

- Admission kill switch, per-owner concurrency/daily quotas, a ledger-backed
  cross-attempt spending ceiling, and experiment cost preview/confirmation.
  Invocation budgets still reset on a queue retry. Unknown cost is not zero.
- Distinguish product/playground/eval source in dashboards and stored runs.
- Persist judge execution errors as a distinct score state and classify retryable
  versus permanent failures. Structured output reduces malformed responses but
  does not eliminate execution errors; job retries may still repeat a failed judge.
- Dataset releases, pass@k/confidence intervals, baseline comparisons, and a CLI/CI
  regression gate. More complete SDK event-shape upgrade snapshots are also useful;
  this change tests the current mapped boundary and privacy contract.
- Queue dead-letter policy; consistent explicit migration URLs; DB status/mode
  checks and source-run referential policy; Next shutdown flushing; async span links.
- A queryable telemetry backend, rich safe error
  taxonomy, read-only reports, and selective Result adoption remain the separate
  `observability-roadmap.md` proposal. No telemetry provider has been selected.
- Studio access-denial UX/request caching, pinned CI actions and install/cache
  optimization, generator catalog use, shared validator cleanup, and dead-code tooling.
- Keep deployment infrastructure under top-level `infra/<provider>`. Pulumi versus
  Alchemy and infrastructure workspaces can be decided when a target is selected.

## Business-events follow-up

The previously deferred business-event ledger is now implemented in
`packages/events` and the `event` table. See `business-events.md` for the eight
initial event names, atomic emissions, post-commit telemetry, and retention rules.
The telemetry backend, Docker/deployment images, and error taxonomy remain separate.
