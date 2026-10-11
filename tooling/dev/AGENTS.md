# @multitudes/dev

Development-only runners behind `pnpm dev:up`, `dev:login`, `dev:down`, and
`test:e2e`. Nothing imports it; production code never loads it.

## File tree

```text
tooling/dev/
├── src/
│   ├── local.ts           # up / login / down: per-checkout profile, Compose DB, apps, login link
│   ├── e2e.ts             # throwaway DB + production Next builds + worker, then Playwright
│   ├── processes.ts       # freePort, launch (process groups), waitHealthy, Ctrl-C teardown
│   ├── seed.ts            # idempotent dev-<role> users, a sample run, a smoke eval case
│   └── fixture-google.ts  # fetch stub for generativelanguage.googleapis.com, --import only
├── test/platform.test.ts  # Playwright journeys: chat, eval promotion, access control, admin
└── playwright.config.ts   # single worker, traces and screenshots on failure
```

## Conventions

- `local.ts` builds the whole environment itself (generated `POSTGRES_URL`, app
  URLs, `AUTH_SECRET`, ports) from `.local/profile.json` and runs `next dev` and
  the worker directly, bypassing each app's dotenvx `dev` script. Add new
  required env vars to the `env` objects in both `local.ts` and `e2e.ts`.
- The Compose project name hashes the checkout path and ports are allocated once
  into the profile, so worktrees never share a database or port.
- Every child runs in its own detached process group so one signal stops the
  whole Next/pnpm tree. Start every new child with `launch()` so Ctrl-C and
  failures tear it down.
- `seed()` must stay idempotent (`onConflictDoNothing`, stable IDs): `dev:up`
  reruns it and `e2e.ts` calls it twice on purpose.
- The Google fixture is loaded only with `--import` into the worker process.
- Browser tests mint real signed sessions with `@multitudes/auth/testing` and a
  unique user per test.
- `local.ts` refuses `NODE_ENV=production`; `login` reuses the profile's secret
  and serves a one-time link on loopback for two minutes.
- `test:e2e` needs production builds first (`CI=1 pnpm build:apps`); see
  `docs/development.md`.
