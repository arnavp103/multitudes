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
);
