# Transactional business events

`event` answers what the application and its users committed over time. It is
separate from the semantic agent trajectory (`run_event`), authoritative run state
(`agent_run`), and unsampled spend ledger (`model_call`). It is not event sourcing:
workers and UI continue to read state from the existing domain tables.

## Contract and ownership

`packages/events/src/registry.ts` maps each `name@version` to a strict Zod payload,
subject type, and one-line description. Preserve old entries and add a new version
when changing a payload's meaning or shape. Unknown names/versions, extra payload
fields, mismatched subjects, and invalid trace IDs fail before insertion.

The fixed envelope contains `id` (UUIDv7), `name`, `version`, `occurredAt`, nullable
`actorId`, `subjectType`, `subjectId`, nullable `runId` and `traceId`, typed `payload`,
and nullable unique `idempotencyKey`. UUIDv7 comes from the already locked `uuid`
library. `occurredAt` is captured at emission inside the transaction, not an exact
commit timestamp. No historical events are synthesized by the migration.

| Event (all version 1)   | Meaning and transactional owner                             |
| ----------------------- | ----------------------------------------------------------- |
| `task.submitted`        | `enqueueRuns`: run, queue job, admission receipt, and event |
| `task.started`          | `beginAttempt`: successful fenced attempt acquisition       |
| `task.retry_scheduled`  | `failRun`: an attempt failed and the run returned to queued |
| `task.completed`        | `finishRun`: result and optional eval score committed       |
| `task.failed`           | Final `failRun`, or fenced queue reconciliation             |
| `eval.case_created`     | `createCase`: new immutable case, including manual cases    |
| `task.promoted_to_eval` | `createCase`: source run linked to the newly authored case  |
| `experiment.launched`   | `enqueueRuns`: experiment and all trial runs/jobs committed |

Submission/promotion actors come from trusted server identity. Worker/reconciler
mutations have a null actor because the system performed them. Payloads contain
bounded metadata; prompts, answers, tool arguments, judge reasons, and raw error
messages stay out. Auth/admin account changes are not covered by these initial
events: integrating Better Auth's mutations requires its own transaction design.

## Transaction boundary

All SQL stays in `packages/db`. `packages/events` supplies the registry, validation,
UUIDs, and an `emit(transaction, input)` port without importing the DB package.
This keeps the dependency direction `db → events → observability` acyclic.

Service code uses `withEvents((tx, emit) => ...)` in `packages/db/src/events.ts`.
Both the domain writes and emitted facts use that Drizzle transaction. The enqueue
path uses `transactionEvents(transaction)` on the existing checked-out PostgreSQL
client so pg-boss jobs also share the transaction. Its `publish()` is called only
after `COMMIT`. Do not adapt a pool/autocommit connection or publish before commit.

```ts
await withEvents(async (tx, emit) => {
  // Perform the state mutation with tx, checking the existing attempt/owner fence.
  await emit({
    name: "task.completed",
    version: 1,
    actorId: null,
    subjectType: "run",
    subjectId: runId,
    runId,
    idempotencyKey: `task.terminal:${runId}`,
    payload: { mode: run.mode, attempt, evalPassed: score?.passed ?? null },
  });
});
```

Event insertion failure aborts the state mutation. Failed/rolled-back transactions
produce neither a durable event nor a committed-event telemetry notification.
Retries of an identical idempotency key return the original row. Different name,
version, actor, subject, run, or payload under the same key rejects the transaction.
Object key order is irrelevant. New trace/timestamp/UUID metadata on a replay does
not replace the original fact. Task/experiment admission receipts still deduplicate
the whole operation; event keys alone do not make arbitrary service calls idempotent.
Creating two new eval case IDs creates two facts, even if their content is identical.

After commit, the same `event.name` appears as a span event and Pino message with
`event.id`, version, subject, run ID, and trace correlation. `traceId` is captured
from the active OTel context even if the span is unsampled; it is null without a
valid context. Event payloads and actor IDs are not exported in these notifications.
A crash after commit can lose telemetry; it cannot lose the committed database row.
Telemetry failure cannot turn successful durable work into a reported failure.

## Retention and deployment

Apply agent migration `0005_modern_revanche.sql` before deploying the producer,
worker, and Studio changes. It creates the table, indexes, unique key, and mutation
triggers. The migration does not backfill history or change existing trajectories.
During a mixed-version rollout, old binaries still omit business events; use the
fully upgraded deployment as the start of complete funnel reporting.

The run FK explicitly uses `ON DELETE RESTRICT`. Deleting a referenced run fails;
there is no cascade or automatic rewrite to null. `UPDATE`, `DELETE`, and `TRUNCATE`
on `event` are rejected by PostgreSQL triggers. These guards prevent accidental
application mutations, not a privileged database owner changing schema. A future
retention/export process needs an explicit policy/migration. Do not simply disable
the triggers as part of routine application cleanup.

## Querying a funnel

Postgres is the runtime analytics store. The name/time, subject, actor/time, and
run indexes support bounded reports. For example, this reports unique run IDs per
stage **occurring within** a seven-day window (not a cohort conversion rate):

```sql
SELECT name, count(DISTINCT subject_id) AS runs
FROM event
WHERE occurred_at >= now() - interval '7 days'
  AND subject_type = 'run'
  AND name IN ('task.submitted', 'task.completed', 'task.promoted_to_eval')
GROUP BY name;
```

A true conversion funnel should select a submitted cohort, join later stages by
`subject_id`, and choose the allowed observation window. Include mode/product
source filters as appropriate; repeated eval promotions count once per source run
in the query above. New deployment history starts with this migration.

DuckDB is not in the runtime dependency graph. A future export can snapshot
`event`, `model_call`, and `agent_run` into versioned Parquet files for offline
analysis, using explicit access, retention, and export watermark policies.

## Tests

- `pnpm --filter @multitudes/events run test:unit`: strict envelope/payload checks,
  UUIDv7 generation, and post-commit notification scheduling.
- `TEST_POSTGRES_URL=... pnpm --filter @multitudes/db run test:integration`:
  real PostgreSQL/pg-boss transactions, concurrent replay, key collisions, failed
  event insertion rolling back state/score, admission rollback, lifecycle coverage,
  trace/log correlation, append-only enforcement, and restrictive run deletion.

The database helper creates and drops isolated test databases; never point it at
an application database. Full CI also exercises the existing browser journeys so
promotion and experiment submission use the new contracts through the real apps.
