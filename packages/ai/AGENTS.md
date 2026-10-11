# @multitudes/ai

Model construction and cost metering for agents and judges. Used by
`packages/agent` and `packages/evals`.

## File tree

```text
packages/ai/
├── src/
│   ├── index.ts    # createModel (native Strands GoogleModel), meterModel decorator
│   └── pricing.ts  # dated USD-per-million-token rates, estimateCost
└── test/
    ├── metering.test.ts     # unit: ledger rows, interruption, pricing
    └── integration.test.ts  # GoogleModel over mocked HTTP, no key or database
```

## Conventions

- Only `gemini` executes. Other `Provider` values exist so historical runs stay
  readable; `createModel` rejects them before creating a client or ledger row.
- Every call is wrapped by `meterModel`. The `model_call` row is written before
  any network request, and a ledger failure stops the call. Usage is checkpointed
  as soon as metadata arrives, then finalised on the same row.
- The Google client makes one HTTP attempt (`retryOptions.attempts: 1`) and
  output is capped with `maxOutputTokens: 4096`. Retries belong to pg-boss.
- `estimateCost` returns `null` for unknown cost. Leave it `null`; zero means free.
- Adding a model preset: add its rate in `pricing.ts` with a new `version`, source
  URL, and verified date in `docs/agent-platform.md`, plus a pricing boundary test.
  Rates are snapshotted per call; add dated entries instead of editing past ones.
- This package uses the Strands `GoogleModel` with `@google/genai`; the AI SDK in
  `packages/ui` is for UI types only.
