# @multitudes/validators

Placeholder for Zod schemas shared between server and browser code. The webapp
lists it as a dependency but imports nothing from it yet.

## File tree

```text
packages/validators/src/
└── index.ts   # placeholder export only
```

## Conventions

- Validation currently lives next to its owner: run and config schemas in
  `packages/agent`, eval schemas in `packages/evals`, table-derived schemas via
  `drizzle-zod` in `packages/db`. Put a schema here only when browser and server
  code both need it and it has no database or Node dependency.
- Import Zod as `zod/v4`, like the rest of the repo.
