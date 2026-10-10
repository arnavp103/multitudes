# Multitudes CLI

`@multitudes/cli` is the workspace's small command-line entry point. It uses
TypeScript, Node.js ESM, and the shared `@multitudes/tsconfig` base config. It
has no runtime dependencies; tests use Node's built-in test runner.

## File tree

```text
tooling/cli/
├── src/
│   └── index.ts
├── test/
│   └── cli.test.js
├── AGENTS.md
└── tsconfig.json
```

Read the repository-root `AGENTS.md` as well as this file before making changes.
