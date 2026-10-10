# Review of the proposed observability follow-up

Status: the business-event ledger is now implemented; see `business-events.md`
for its registry, transaction boundary, retention semantics, and tests. The rest
of this document remains a design review. No telemetry vendor, error package,
Result framework, MCP connection, or read-only production role is provisioned.

The proposed three-store model fits the platform: sampled telemetry explains
execution, the transactional agent ledger owns run outcomes/costs, and typed
business events support analytics across runs, users, and experiments.
The collector currently exports only debug output; selecting/configuring the
queryable backend remains the first observability step. A Sentry connection in
another conversation is not evidence that this project has a configured Sentry
project or credentials.

Implementation details to carry into that follow-up:

- Preserve one NodeSDK/provider owner. A vendor's skipOpenTelemetrySetup option
  alone may not complete interoperability; validate its context manager,
  propagator, processors, filtering, and browser/server correlation against the
  selected SDK version before integrating it. Retain OTLP portability.
- Keep event schemas in a small versioned registry. Write events through the same
  database transaction/client as the state mutation, and reject incompatible
  reuse of an idempotency key. Actor IDs come from trusted server context.
- Log the committed event after commit. A span event emitted before commit can
  describe an attempted mutation, but must not claim that it committed. This is
  intentionally not a reliable telemetry dual-write protocol or event sourcing.
- A nullable run foreign key with no delete action defaults to restricting run
  deletion. Choose retention deliberately: preserve an unbound run identifier or
  use ON DELETE SET NULL if runs can be pruned. Avoid cascade deletion of audit
  facts. Decide what personal data is allowed in actor IDs and typed payloads.
- Stable error codes, scope, retryability, and safe user messages are useful
  under our redaction policy. Preserve the distinction between a provider error,
  cancellation, unknown billing, and a negative eval verdict. Keep detailed raw
  causes outside exported logs unless explicitly sanitized.
- Introduce Result values only where expected failures are routinely branched on.
  Strands uses async iterable model streams; cancellation, stream cleanup, and
  ledger finalization must still work. Do not wrap the entire stream in a Result
  or add neverthrow merely to rename exceptions.
- Named read-only reports are a good first investigation interface. Implement
  them through packages/db with bounded time windows and stable JSON schemas.
  Keep credentials server-side and expose only the required reports through an
  authenticated CLI/API; do not promise an MCP server makes access read-only.
- UUIDv7 and semantic-convention constants are reasonable when introducing their
  use sites. Pin the gen_ai convention version because those attributes evolve.
  Knip can follow separately with an intentional public-entrypoint configuration.

Once a backend is chosen, the first deliverable should prove that a failed run
can be located from its run ID/build SHA, inspected with correlated logs/spans,
and compared with the durable cost ledger. Document registry/error/report
contracts in AGENTS.md when those contracts exist.
