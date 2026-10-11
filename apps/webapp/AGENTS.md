# @multitudes/webapp

The product Next.js app: authenticated task chat over the durable agent queue.
Nothing imports it.

## File tree

```text
apps/webapp/
├── src/
│   ├── app/
│   │   ├── page.tsx                # workspace shell + chat
│   │   ├── _components/
│   │   │   ├── chat.tsx            # AgentChat wired to the server actions
│   │   │   └── auth-showcase.tsx   # Discord sign-in / sign-out
│   │   ├── api/auth/[...all]/      # Better Auth handler
│   │   ├── api/trpc/[trpc]/        # @multitudes/api over fetch, same-origin only
│   │   ├── api/health/             # public health check
│   │   └── error.tsx               # reportClientError boundary
│   ├── server/chat.ts              # sendTask / pollTask server actions
│   ├── auth/
│   │   ├── server.ts               # auth instance, cached getSession() (server-only)
│   │   └── client.ts               # better-auth React client (not yet used)
│   ├── trpc/                       # React Query client, RSC caller, HydrateClient
│   ├── env.ts                      # t3-env schema extending authEnv()
│   └── instrumentation*.ts         # Node-only OTel registration
└── next.config.js                  # loads src/env.ts, so config load validates env
```

## Conventions

- Env is validated whenever `next.config.js` loads (build and dev) via
  `src/env.ts`; `CI` or the lint script skip it. Read env through
  `import { env } from "~/env"`; ESLint forbids `process.env` elsewhere.
- Use `getSession()` from `~/auth/server`. It bypasses the cookie cache and
  returns `null` for banned users; calling `auth.api.getSession` directly skips
  the ban check.
- Server actions take identity from the session and configuration from env.
  Clients send only input and `requestKey`; `ownerId`, model, and prompt are
  chosen on the server.
- Product reads go through owner-scoped queries (`getOwnedRun`) and return a
  fixed projection. Failed runs show a generic message, never the stored error.
- Chat uses server actions, not tRPC. The tRPC route serves `packages/api`;
  keep it same-origin with no CORS headers.
- Cookies use the `multitudes-webapp` prefix so sessions stay separate from Studio.
- Keep `transpilePackages` in `next.config.js` listing every workspace package
  this app imports.
- Run locally with `pnpm dev:up` and sign in with `pnpm dev:login webapp user`.
