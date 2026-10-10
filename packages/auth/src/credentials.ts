import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

import type { db } from "@multitudes/db/client";
import { and, eq } from "@multitudes/db";
import { account, session, user } from "@multitudes/db/schema";

import type { AppRole } from "./permissions";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password";

/** Better Auth stores email/password logins as an account with this provider ID. */
export const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * Build the `account` row for an email/password login, hashed exactly as Better
 * Auth's sign-up does so that its sign-in endpoint can verify it.
 *
 * For operator and local-seed provisioning only; apps use Better Auth's endpoints.
 */
export async function credentialAccount(userId: string, password: string) {
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  )
    throw new Error(
      `Passwords must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`,
    );
  return {
    id: randomUUID(),
    accountId: userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    userId,
    password: await hashPassword(password),
  };
}

export interface ProvisionRequest {
  email: string;
  role: AppRole;
  /** Display name for a newly created account; also renames an existing one. */
  name?: string;
  /** Set this email/password login, creating and verifying the account if needed. */
  password?: string;
}

/**
 * Operator-only Studio provisioning behind `pnpm auth:bootstrap-admin`.
 *
 * Without a password, only promotes an existing verified account. With one, the
 * operator asserts control of the address: the account is created or marked
 * verified, any earlier password is replaced, and existing sessions are revoked
 * so whoever registered the address first loses access.
 *
 * @returns whether a new account was created.
 */
export async function provisionAccount(
  database: typeof db,
  { email, role, name, password }: ProvisionRequest,
) {
  const normalized = email.toLowerCase();
  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(user)
      .where(eq(user.email, normalized))
      .for("update");
    if (!password) {
      if (!existing?.emailVerified)
        throw new Error(
          "No verified account has this email. Re-run with --password to set a password and verify it.",
        );
      await tx.update(user).set({ role }).where(eq(user.id, existing.id));
      return false;
    }
    const userId = existing?.id ?? randomUUID();
    const credential = await credentialAccount(userId, password);
    if (existing) {
      await tx
        .update(user)
        .set({ role, emailVerified: true, ...(name ? { name } : {}) })
        .where(eq(user.id, userId));
      await tx
        .delete(account)
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, CREDENTIAL_PROVIDER_ID),
          ),
        );
      await tx.delete(session).where(eq(session.userId, userId));
    } else {
      await tx.insert(user).values({
        id: userId,
        email: normalized,
        name: name ?? normalized.split("@")[0] ?? normalized,
        emailVerified: true,
        role,
      });
    }
    await tx.insert(account).values(credential);
    return !existing;
  });
}
