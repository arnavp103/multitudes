import { defineConfig } from "eslint/config";

import { baseConfig } from "@multitudes/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
);
