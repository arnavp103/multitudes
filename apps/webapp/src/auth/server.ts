import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { nextCookies } from "better-auth/next-js";

import { initAuth } from "@multitudes/auth";

import { env } from "~/env";

const baseUrl = env.WEBAPP_URL ?? "http://localhost:3000";
export const auth = initAuth({
  baseUrl,
  productionUrl: env.AUTH_PRODUCTION_URL ?? baseUrl,
  cookiePrefix: "multitudes-webapp",
  secret: env.AUTH_SECRET,
  discordClientId: env.AUTH_DISCORD_ID,
  discordClientSecret: env.AUTH_DISCORD_SECRET,
  extraPlugins: [nextCookies()],
});
export const getSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  }),
);
