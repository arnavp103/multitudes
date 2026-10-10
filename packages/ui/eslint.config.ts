import { defineConfig } from "eslint/config";

import { baseConfig } from "@multitudes/eslint-config/base";
import { reactConfig } from "@multitudes/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
