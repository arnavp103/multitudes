# @multitudes/studio

Internal, role-protected Next.js app for run review, eval authoring, experiments,
the playground, the cost dashboard, and user administration. Nothing imports it.

## File tree

```text
apps/studio/
├── src/
│   ├── app/
│   │   ├── (internal)/          # every staff page; layout.tsx calls requireStaff()
│   │   │   ├── page.tsx         # recent runs and a quick task form
│   │   │   ├── runs/[id]/       # trajectory view, "Create eval case"
│   │   │   ├── cases/           # case list and cases/new authoring form
│   │   │   ├── experiments/     # launch, results, comparison
│   │   │   ├── playground/      # AgentChat with editable model/prompt
│   │   │   ├── admin/           # cost and quality dashboard
│   │   │   └── users/           # roles, bans, session revocation
│   │   ├── login/page.tsx       # Discord sign-in on the Studio origin
│   │   ├── api/auth/[...all]/   # Better Auth handler
│   │   ├── api/health/          # public health check
│   │   └── error.tsx            # reportClientError boundary
│   ├── server/
│   │   ├── access.ts            # lazy studioAuth(), requireStaff(permission)
│   │   ├── actions.ts           # server actions: runs, cases, experiments, playground
│   │   └── users.ts             # manageUser admin action
│   ├── components/              # Studio-only client pieces (shell, playground, form fields)
│   ├── env.ts                   # readStudioEnv(), validated per request
│   └── instrumentation*.ts      # Node-only OTel registration
└── next.config.js
```

## Conventions

- Every page and every server action calls `requireStaff(permission)` itself with
  the narrowest permission (`view`, `author`, `execute`, `users`). The layout's
  check covers rendering only; server actions are separately reachable.
- Env is validated at request time by `readStudioEnv()`, so `next build` needs no
  secrets. Read config through it rather than at module scope, and create auth
  lazily via `studioAuth()`.
- Studio has no tRPC: pages read `@multitudes/db/*` directly and mutate through
  server actions in `src/server/`.
- Forms that enqueue work render a hidden `requestKey` from `randomUUID()` on the
  server; the playground passes its configuration as `submissionScope`.
- Production run output is reference material for case authoring, never an
  automatic expected answer.
- Cookies use the `multitudes-studio` prefix so Studio and webapp sessions stay
  separate on one host.
- Keep `transpilePackages` in `next.config.js` listing every workspace package
  this app imports.
- Run locally with `pnpm dev:up` and sign in with `pnpm dev:login studio <role>`.
  Studio pages have no development auth bypass.
