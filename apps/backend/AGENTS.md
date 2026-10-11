# @multitudes/backend

Long-lived Node worker that consumes the pg-boss `agent-run` queue, runs agents
and graders, and reconciles crashed runs. Nothing imports it.

## File tree

```text
apps/backend/
├── src/
│   ├── bootstrap.ts   # entry: start OTel, then dynamic-import the app, signal handling
│   ├── worker.ts      # job handler, scoring, 30 s reconciler, graceful stop
│   ├── env.ts         # readEnv(), validated at runtime only
│   └── health.ts      # GET/HEAD /api/health on PORT; 503 until ready and while draining
└── test/integration.test.ts  # health states over a real socket
```

## Conventions

- Runs from source with `tsx`; there is no emitted build (`build` only
  type-checks). Package the source plus the generated
  `packages/observability/src/build-info.generated.ts`.
- `bootstrap.ts` starts telemetry before anything else loads. Import application
  modules there with `await import()` only; a static import would load before the
  SDK and miss instrumentation.
- A job is skipped when its run is missing or completed, or when `beginAttempt`
  finds a newer attempt. The attempt number (`retryCount + 1`) fences every write.
- The worker refuses runs whose frozen `codeVersion` differs from its
  `AGENT_CODE_VERSION`. Drain the queue before deploying a new version.
- `result.json` and `judge.json` in the session store are receipts: a retry after
  a saved result skips the model, and a saved verdict skips the judge.
- Every model call gets a cancel signal combining the job signal, shutdown, and
  the policy timeout. Keep new long-running work on that combined signal.
- Shutdown order: mark not ready, abort model calls, stop the queue gracefully,
  close the pool, close health, flush telemetry.
- Local runs: `pnpm dev:up` starts this worker with deterministic Google fixtures
  unless `GEMINI_API_KEY` is set in your shell.
