import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, oAuthProxy } from "better-auth/plugins";

import { db } from "@multitudes/db/client";
import { createLogger } from "@multitudes/observability/logger";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password";
import { ac, roles } from "./permissions";

const logger = createLogger("multitudes-auth");
export interface AuthOptions {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  cookiePrefix: string;
  database?: typeof db;
  /**
   * Allow self-service email/password sign-up. Off by default: Studio staff are
   * provisioned with `pnpm auth:bootstrap-admin`, and only the webapp opts in.
   */
  allowSignUp?: boolean;
}

/** Preserve concrete plugin inference for admin APIs and separate test-only helpers. */
export function initAuth<const P extends BetterAuthPlugin[] = []>(
  options: AuthOptions & { extraPlugins?: P },
) {
  const config = {
    database: drizzleAdapter(options.database ?? db, {
      provider: "pg",
      transaction: true,
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    trustedOrigins: [options.baseUrl],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUp,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      // No email transport is configured, so addresses are not verified yet.
      // Studio still requires a verified address, which only an operator sets.
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
    advanced: { cookiePrefix: options.cookiePrefix },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database" as const,
      window: 60,
      max: 100,
    },
    plugins: [
      admin({ ac, roles, adminRoles: ["admin"], defaultRole: "user" }),
      ...(options.baseUrl !== options.productionUrl
        ? [oAuthProxy({ productionURL: options.productionUrl })]
        : []),
      ...(options.extraPlugins ?? ([] as unknown as P)),
    ],
    onAPIError: {
      onError(error) {
        logger.error({ err: error }, "Auth API failed");
      },
    },
  } satisfies BetterAuthOptions;
  return betterAuth(config);
}
type BaseAuth = ReturnType<typeof initAuth<[]>>;
/** Minimal contract consumed by API contexts, independent of framework cookie plugins. */
export interface Auth {
  api: Pick<BaseAuth["api"], "getSession">;
}
export type Session = BaseAuth["$Infer"]["Session"];
