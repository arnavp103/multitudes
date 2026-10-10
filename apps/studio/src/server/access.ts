import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { nextCookies } from "better-auth/next-js";

import { initAuth } from "@multitudes/auth";
import { createLogger } from "@multitudes/observability/logger";

import { readStudioEnv } from "~/env";

let auth: ReturnType<typeof initAuth> | undefined;

/** Separate OAuth origin; reuses the existing auth schema and identity provider. */
export function studioAuth() {
  const env = readStudioEnv();
  auth ??= initAuth({
    baseUrl: env.STUDIO_URL,
    productionUrl: env.STUDIO_URL,
    secret: env.AUTH_SECRET,
    discordClientId: env.AUTH_DISCORD_ID,
    discordClientSecret: env.AUTH_DISCORD_SECRET,
    extraPlugins: [nextCookies()],
  });
  return auth;
}

/** Every read and mutation is restricted to the explicit internal email allowlist. */
export async function requireStaff() {
  const session = await studioAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");
  const allowed = readStudioEnv()
    .STUDIO_ALLOWED_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    !session.user.emailVerified ||
    !allowed.includes(session.user.email.toLowerCase())
  ) {
    createLogger("multitudes-studio").warn("Studio access denied");
    throw new Error(
      "This account does not have studio access. Ask an administrator to add its verified email to STUDIO_ALLOWED_EMAILS.",
    );
  }
  return session;
}
