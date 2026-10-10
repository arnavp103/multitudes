import { testUtils } from "better-auth/plugins";

import type { AuthOptions } from "./index";
import { isProductionRuntime } from "../env";
import { initAuth } from "./index";

/** Privileged helpers for isolated test processes and the loopback-only dev CLI. Never import from an app. */
export function createTestAuth(options: AuthOptions) {
  if (isProductionRuntime())
    throw new Error("Test auth is unavailable in production");
  return initAuth({ ...options, extraPlugins: [testUtils()] });
}
