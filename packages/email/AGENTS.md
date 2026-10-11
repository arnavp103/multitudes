# @multitudes/email

Provider-neutral React Email rendering and a transport-injected mailer. No
workspace imports it yet, and no provider or sending is configured.

## File tree

```text
packages/email/
├── src/
│   ├── index.ts                    # renderEmail, createMailer, EmailTransport contract
│   └── templates/run-completed.tsx # example template; default export = preview
└── test/render.test.ts
```

## Conventions

- Each template is a default-exported component in `src/templates/` with a
  preview default for every prop, so `pnpm dev:email` (port 3002) can render it.
  Consumers import it through the `./templates/*` export.
- Provider adapters implement `EmailTransport` in the composing app, which owns
  credentials. `createMailer()` without a transport throws on `send`.
- Callers pass an `idempotencyKey`; adapters forward it to the provider. Sends are
  never retried automatically, since a failure may still have delivered.
- Recipient addresses, subjects, and bodies stay out of logs and spans; log
  counts and provider message IDs only.
- Links in templates must be HTTPS; `run-completed.tsx` throws otherwise.
