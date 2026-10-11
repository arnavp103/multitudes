# @multitudes/observability

Pino logging, OpenTelemetry setup, trace-context helpers, and the health payload
for all three apps. Most packages import `/logger` and `/context`.

## File tree

```text
packages/observability/src/
├── logger.ts                  # createLogger (stdout + OTel logs), safeError, redaction
├── node.ts                    # startTelemetry(): the single NodeSDK per process
├── context.ts                 # withSpan, captureTraceContext for queued jobs
├── browser.ts                 # reportClientError via browser Pino, no transport
├── health.ts                  # healthSnapshot/healthResponse with the baked version
├── privacy.ts                 # span processor stripping model content
├── requests.ts                # Next root spans -> access logs and HTTP metrics
└── build-info.generated.ts    # APP_VERSION/GIT_SHA, written by tooling/version.mjs (ignored)
```

## Conventions

- Entrypoints split by runtime. Client components import only `/browser`; it
  has no Node or OTel imports. `/node` is loaded once per process before the app
  (Next `instrumentation.node.ts`, `apps/backend/src/bootstrap.ts`). Libraries
  such as Strands use the global providers; never register a second SDK or
  `@vercel/otel`.
- `build-info.generated.ts` comes from `tooling/version.mjs` on install, build,
  and dev. If it is missing, run `pnpm version:stamp`. Runtime `APP_VERSION` or
  `OTEL_RESOURCE_ATTRIBUTES` cannot override it, by design.
- Log messages are static strings; put variables in structured fields. Keys in
  the redaction set (`input`, `output`, `messages`, `token`, `cookie`, ...) are
  redacted recursively. Extend that set when adding a new sensitive field name.
- Errors serialize through `safeError`: type, code, and stack frames only, never
  message or cause. Pass errors as `{ err }`.
- Run IDs and trace IDs go on logs and spans. Metric attributes stay
  low-cardinality.
- Model content is stripped from spans unless `OTEL_CAPTURE_MODEL_CONTENT=true`.
  Prompt and response content belongs in the run ledger, not logs.
- Use `createLogger("multitudes-<service>")`; it honours `LOG_LEVEL`.
