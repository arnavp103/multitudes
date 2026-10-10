import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { nextCookies } from "better-auth/next-js";

import type { StudioPermission } from "@multitudes/auth/permissions";
import { initAuth } from "@multitudes/auth";
import { canAccessStudio, isUserBanned } from "@multitudes/auth/permissions";
import { createLogger } from "@multitudes/observability/logger";

import { readStudioEnv } from "~/env";

let auth: ReturnType<typeof createStudioAuth> | undefined;

/** Separate auth origin and cookies; reuses the shared auth schema and accounts. */
function createStudioAuth() {
  const env = readStudioEnv();
  return initAuth({
    baseUrl: env.STUDIO_URL,
    productionUrl: env.STUDIO_AUTH_PRODUCTION_URL ?? env.STUDIO_URL,
    cookiePrefix: "multitudes-studio",
    secret: env.AUTH_SECRET,
    extraPlugins: [nextCookies()],
  });
}

export function studioAuth() {
  return (auth ??= createStudioAuth());
}

/** Authoritative session and permission checks for every Studio read and mutation. */
export async function requireStaff(permission: StudioPermission = "view") {
  const session = await studioAuth().api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) redirect("/login");
  if (
    isUserBanned(session.user) ||
    !session.user.emailVerified ||
    !canAccessStudio(session.user.role, permission)
  ) {
    createLogger("multitudes-studio").warn("Studio access denied");
    throw new Error(
      "This account does not have permission for this Studio action.",
    );
  }
  return session;
}
