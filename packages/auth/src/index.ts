import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, oAuthProxy } from "better-auth/plugins";

import { db } from "@multitudes/db/client";
import { createLogger } from "@multitudes/observability/logger";

import { ac, roles } from "./permissions";

const logger = createLogger("multitudes-auth");
export interface AuthOptions {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  cookiePrefix: string;
  discordClientId: string;
  discordClientSecret: string;
  database?: typeof db;
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
    socialProviders: {
      discord: {
        clientId: options.discordClientId,
        clientSecret: options.discordClientSecret,
        redirectURI: `${options.productionUrl}/api/auth/callback/discord`,
      },
    },
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
