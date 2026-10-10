import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. Sign-in and sign-up go through the HTTP endpoints, so
 * Better Auth's origin checks and per-IP rate limits apply to every attempt.
 */
export const authClient = createAuthClient();
