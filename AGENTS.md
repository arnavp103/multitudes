# Agents

Multitudes is a pnpm/Turborepo monorepo with a Next.js web app, shared TypeScript
packages, and workspace tooling.

## Golden rules

1. Prefer functional programming.
2. Always write good docstrings and clean code.
3. Always read the chain of `AGENTS.md` files from the current folder up through
   its parents to the repository root before working in that folder.

## File tree

```text
.
├── apps/
│   └── webapp/
├── packages/
│   ├── api/
│   ├── auth/
│   ├── db/
│   ├── ui/
│   └── validators/
└── tooling/
    ├── cli/
    ├── eslint/
    ├── github/
    ├── prettier/
    ├── tailwind/
    └── typescript/
```

Each workspace may have a more specific `AGENTS.md`; read all instructions from
the current folder up through the repository root before making changes.
