# @multitudes/api

tRPC router served by the webapp at `/api/trpc` and called from its React Server
Components. Studio does not use it.

## File tree

```text
packages/api/src/
├── trpc.ts          # context (session, db), timing span/log middleware, procedures
├── root.ts          # appRouter: `auth`, `agent`
├── router/
│   ├── auth.ts      # getSession, projected to id/name/image
│   └── agent.ts     # capabilities, taskStatus via @multitudes/db/agent-service
└── index.ts         # AppRouter, RouterInputs, RouterOutputs
```

## Conventions

- Keep routers thin. Authorization and data access live in a service in
  `packages/db` (see `agent-service.ts`) that takes `ctx.session.user.id` as the
  actor, so agent tools in `packages/agent` reuse the same checks and result shape.
- `createTRPCContext` nulls the session of banned users, so `protectedProcedure`
  means "signed in and not banned", not any role. Check roles with
  `@multitudes/auth/permissions` inside the procedure.
- The context depends on the minimal `Auth` interface (`api.getSession`); the
  webapp passes its own auth instance in. Keep app code out of this package.
- Return explicit projections. Session data leaves as id, name, and image only.
- Product chat submits and polls through webapp server actions
  (`apps/webapp/src/server/chat.ts`), not tRPC.
