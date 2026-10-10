import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@multitudes/eslint-config/base";
import { nextjsConfig } from "@multitudes/eslint-config/nextjs";
import { reactConfig } from "@multitudes/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
  {
    // Every webapp module logs through `~/logger/*`; only that module builds loggers.
    // Repeats restrictEnvAccess's entry because rule options replace, not merge.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/logger/**", "**/env.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          name: "process",
          importNames: ["env"],
          message:
            "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
        {
          name: "@multitudes/observability/logger",
          message: "Import `logger` from `~/logger/server` instead.",
        },
        {
          name: "@multitudes/observability/browser",
          message: "Import from `~/logger/browser` instead.",
        },
      ],
    },
  },
);
