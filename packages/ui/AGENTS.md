# @multitudes/ui

Shared React components for webapp and Studio: shadcn primitives, Vercel AI
Elements, the theme, the workspace shell, and the durable task chat.

## File tree

```text
packages/ui/
├── src/
│   ├── index.ts            # cn() only
│   ├── agent-chat.tsx      # AgentChat (submit/poll/reconnect), RunConversation transcript
│   ├── workspace-shell.tsx # responsive app chrome shared by both apps
│   ├── theme.tsx           # ThemeProvider (dark default, key multitudes-theme), ThemeToggle
│   ├── toast.tsx           # sonner Toaster
│   ├── ai-elements/        # AI Elements: conversation, message, reasoning, tool, code-block...
│   └── *.tsx               # shadcn new-york primitives, one per file
├── test/                   # vitest + jsdom; setup.ts stubs browser APIs jsdom lacks
├── components.json         # shadcn config: theme CSS path, @ai-elements registry
└── vitest.config.ts
```

## Conventions

- Source-only package: `@multitudes/ui/<file>` resolves to `src/<file>.tsx` and
  `@multitudes/ui/ai-elements/<file>` to `src/ai-elements/`. A new file is
  importable without editing `exports`.
- Add components with the shadcn CLI from this folder
  (`pnpm dlx shadcn@latest add @ai-elements/<name>`) or `pnpm ui-add` at the root,
  then adapt them to workspace imports and repo lint rules. Theme tokens live in
  `tooling/tailwind/theme.css`, not here.
- Both apps' `styles.css` `@source` only `packages/ui/src/**`; Tailwind classes
  must be literal strings inside `src/` to be generated.
- Stay framework-neutral: no `next/*` imports. Apps pass hrefs, active state,
  and server actions in as props (see `StudioShell` and the webapp `Chat`).
- Model Markdown in `ai-elements/message.tsx` renders no images and only HTTPS
  links. `test/message.test.tsx` guards this; keep it passing.
- `AgentChat` keeps only the run ID in the URL and the pending input plus request
  key in `sessionStorage` (`multitudes:pending:<path>`). It never resubmits on
  reload or reconnect. A different input or `submissionScope` gets a new key, so
  callers whose configuration can change pass it as the scope.
- Report UI failures with `reportClientError` from
  `@multitudes/observability/browser`; never log user text.
- When a component needs a browser API jsdom lacks, add the stub to
  `test/setup.ts`.
