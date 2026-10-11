# @multitudes/agent

Strands agent factory (`createAgent`) and the server-side submission SDK
(`submitRun`). Used by the backend worker, `packages/evals`, and both Next apps'
server actions.

## File tree

```text
packages/agent/
├── src/
│   ├── index.ts           # configurationSchema, inputSchema, createAgent, submitRun
│   ├── prompts/system.ts  # SYSTEM_PROMPT and SYSTEM_PROMPT_VERSION (`./prompts` export)
│   ├── policy.ts          # turn/token budgets and timeouts
│   └── tools.ts           # tool allowlist over @multitudes/db/agent-service
└── test/                  # runtime and tool tests with injected models and services
```

## Conventions

- Prompt change: edit `prompts/system.ts`, bump `SYSTEM_PROMPT_VERSION`, and bump
  the deployed `AGENT_CODE_VERSION`. Runs freeze their prompt and version; custom
  prompts get a `sha256:` version automatically.
- `policy.ts` values are applied by `apps/backend/src/worker.ts`, not by
  `createAgent`. Token budgets are soft and checked at model-call boundaries.
- `retryStrategy: null` is deliberate: pg-boss owns retries and every model call
  is metered. Keep agent-level retries off.
- Tools receive the actor from `createTools(actorId)`, set from the run owner.
  Tool input schemas carry only task arguments, never identity.
- Tool callbacks delegate to an injectable service object; tests and eval
  fixtures pass their own. Existing tools are read-only. A side-effecting tool
  needs a stable idempotency key and durable receipt first (see the harness loop
  in `docs/agent-platform.md`). Execution, shell, and filesystem tools need a
  separate isolation design; `sandbox: false` does not sandbox anything.
- Tool errors reach conversation history as `Tool execution failed` unless the
  message is on the allowlist in `index.ts` (`Task not found`,
  `Authentication required`). Add a message there only if it is safe for the model.
- `submitRun` is the only way to start a production run. Call it from
  authenticated server code with the session user as `ownerId` and the client's
  `requestKey`. It returns once the run and job commit; it never waits for output.
