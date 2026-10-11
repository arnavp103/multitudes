# @multitudes/auth

Better Auth factory, role and permission definitions, and the shared auth env
schema. Used by webapp, Studio, `packages/api`, and `tooling/dev`.

## File tree

```text
packages/auth/
├── src/
│   ├── index.ts            # initAuth(): Discord OAuth, admin plugin, DB rate limit, sessions
│   ├── permissions.ts      # access-control roles, canAccessStudio, isUserBanned
│   └── testing.ts          # createTestAuth() with testUtils; throws in production
├── script/
│   ├── auth-cli.ts         # config read only by `pnpm auth:generate`
│   └── bootstrap-admin.ts  # promote an existing verified account to admin
├── env.ts                  # authEnv(): t3-env schema the webapp env extends
└── test/integration.test.ts
```

## Conventions

- Source-only package: exports point at `.ts` files and there is no build step.
- `initAuth` takes every URL, secret, and cookie prefix as options and reads no
  environment. Each app creates its own instance with its own `cookiePrefix`
  (`multitudes-webapp`, `multitudes-studio`) and adds `nextCookies()` itself.
- Sessions are authoritative database reads: `cookieCache` stays disabled and
  callers pass `query: { disableCookieCache: true }`, so bans, role changes, and
  revocations apply on the next request.
- A valid session alone grants nothing. Callers also check `isUserBanned(user)`
  (a ban can postdate the session) and, for Studio, `canAccessStudio(role, permission)`.
  Roles are stored as a comma-separated string.
- A new Studio capability is a new `studio` statement in `ac`, granted in `roles`
  and checked with `canAccessStudio`. Keep the role table in `docs/development.md`
  in step.
- `auth:generate` reads `script/auth-cli.ts`, which calls `initAuth`, so schema
  follows the shared plugin list. Add schema-affecting plugins in `initAuth`;
  plugins an app passes through `extraPlugins` never reach the generated schema.
  Then run `pnpm db:generate` (see `packages/db/AGENTS.md`).
- `oAuthProxy` is added only when `productionUrl` differs from `baseUrl`; the
  Discord callback always uses `productionUrl`.
- Verify with `TEST_POSTGRES_URL=... pnpm -F @multitudes/auth test:integration`,
  which uses real signed sessions on a throwaway database.
