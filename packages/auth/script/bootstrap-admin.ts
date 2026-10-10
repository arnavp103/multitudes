import { eq } from "@multitudes/db";
import { db, pool } from "@multitudes/db/client";
import { user } from "@multitudes/db/schema";

/** Promote one existing verified account; never create an identity or bypass verification. */
try {
  const email = process.argv[2];
  if (!email)
    throw new Error("Usage: pnpm auth:bootstrap-admin <verified-email>");
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(user)
      .where(eq(user.email, email))
      .for("update");
    if (!account?.emailVerified)
      throw new Error(
        "Sign in with a verified identity before bootstrapping access",
      );
    await tx.update(user).set({ role: "admin" }).where(eq(user.id, account.id));
  });
  console.info("Administrator access granted to the verified account");
} finally {
  await pool.end();
}
