import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { nextCookies } from "better-auth/next-js";

import { initAuth } from "@multitudes/auth";
import { isUserBanned } from "@multitudes/auth/permissions";

import { env } from "~/env";

const baseUrl = env.WEBAPP_URL ?? "http://localhost:3000";
export const auth = initAuth({
  baseUrl,
  productionUrl: env.AUTH_PRODUCTION_URL ?? baseUrl,
  cookiePrefix: "multitudes-webapp",
  secret: env.AUTH_SECRET,
  extraPlugins: [nextCookies()],
});
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  return session && !isUserBanned(session.user) ? session : null;
});
