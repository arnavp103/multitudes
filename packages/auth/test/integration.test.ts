import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { eq } from "@multitudes/db";
import { session as sessionTable } from "@multitudes/db/schema";
import { createTestDatabase } from "@multitudes/db/testing";

import { credentialAccount, provisionAccount } from "../src/credentials";
import { initAuth } from "../src/index";
import { canAccessStudio, isUserBanned } from "../src/permissions";
import { createTestAuth } from "../src/testing";

await test("real sessions enforce roles, expiry, revocation, bans, and cookie isolation", async () => {
  const database = await createTestDatabase();
  try {
    const options = {
      database: database.db,
      baseUrl: "http://localhost:4301",
      productionUrl: "http://localhost:4301",
      cookiePrefix: "multitudes-studio",
      secret: "integration-only-secret-at-least-32-characters",
    };
    const auth = createTestAuth(options);
    const { test: helpers } = await auth.$context;
    const identities = await Promise.all(
      ["user", "viewer", "evaluator", "admin"].map(async (role) => {
        const user = await helpers.saveUser(
          helpers.createUser({ email: `${randomUUID()}@example.test`, role }),
        );
        return { user, ...(await helpers.login({ userId: user.id })) };
      }),
    );
    const [regular, viewer, evaluator, admin] = identities;
    assert.ok(regular && viewer && evaluator && admin);
    const actual = await auth.api.getSession({ headers: viewer.headers });
    assert.equal(actual?.user.role, "viewer");
    assert.equal(canAccessStudio(actual.user.role, "view"), true);
    assert.equal(canAccessStudio(actual.user.role, "execute"), false);
    assert.equal(canAccessStudio("evaluator", "author"), true);
    assert.equal(canAccessStudio("evaluator", "users"), false);
    assert.equal(isUserBanned({ banned: true }), true);
    assert.equal(
      isUserBanned({ banned: true, banExpires: new Date(10) }, 11),
      false,
    );
    assert.equal(
      isUserBanned({ banned: true, banExpires: new Date(10) }, 9),
      true,
    );
    await assert.rejects(
      auth.api.setRole({
        headers: regular.headers,
        body: { userId: regular.user.id, role: "admin" },
      }),
    );
    await assert.rejects(
      auth.api.impersonateUser({
        headers: admin.headers,
        body: { userId: regular.user.id },
      }),
    );
    await auth.api.setRole({
      headers: admin.headers,
      body: { userId: regular.user.id, role: "viewer" },
    });
    assert.equal(
      (await auth.api.getSession({ headers: regular.headers }))?.user.role,
      "viewer",
    );
    await auth.api.revokeUserSessions({
      headers: admin.headers,
      body: { userId: viewer.user.id },
    });
    assert.equal(await auth.api.getSession({ headers: viewer.headers }), null);
    await database.db
      .update(sessionTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(sessionTable.token, evaluator.token));
    assert.equal(
      await auth.api.getSession({ headers: evaluator.headers }),
      null,
    );
    await auth.api.banUser({
      headers: admin.headers,
      body: { userId: regular.user.id },
    });
    assert.equal(await auth.api.getSession({ headers: regular.headers }), null);
    const production = initAuth(options);
    assert.equal("test" in (await production.$context), false);
    const webapp = initAuth({ ...options, cookiePrefix: "multitudes-webapp" });
    assert.equal(await webapp.api.getSession({ headers: admin.headers }), null);
    const response = await auth.handler(
      new Request(`${options.baseUrl}/api/auth/admin/set-role`, {
        method: "POST",
        headers: {
          cookie: admin.headers.get("cookie") ?? "",
          origin: "https://untrusted.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: regular.user.id, role: "admin" }),
      }),
    );
    assert.equal(response.status, 403);
  } finally {
    await database.close();
  }
});

await test("email/password sign-up is app-scoped and provisioned staff can sign in", async () => {
  const database = await createTestDatabase();
  try {
    const options = {
      database: database.db,
      baseUrl: "http://localhost:4302",
      productionUrl: "http://localhost:4302",
      secret: "integration-only-secret-at-least-32-characters",
    };
    const webapp = initAuth({
      ...options,
      cookiePrefix: "multitudes-webapp",
      allowSignUp: true,
    });
    const studio = initAuth({ ...options, cookiePrefix: "multitudes-studio" });
    const email = `${randomUUID()}@example.test`;
    const password = "correct horse battery";

    const created = await webapp.api.signUpEmail({
      body: { name: "Product user", email, password },
    });
    assert.equal(created.user.emailVerified, false);
    assert.equal(created.user.role, "user");
    await assert.rejects(
      studio.api.signUpEmail({
        body: {
          name: "Intruder",
          email: `${randomUUID()}@example.test`,
          password,
        },
      }),
    );
    await assert.rejects(
      webapp.api.signUpEmail({
        body: {
          name: "Short",
          email: `${randomUUID()}@example.test`,
          password: "short",
        },
      }),
    );
    await assert.rejects(
      webapp.api.signInEmail({ body: { email, password: "wrong password" } }),
    );
    const signedIn = await webapp.api.signInEmail({
      body: { email, password },
    });
    assert.ok(signedIn.token);

    // A self-registered, unverified address cannot be promoted without re-keying it.
    await assert.rejects(
      provisionAccount(database.db, { email, role: "admin" }),
      /verified/,
    );
    const operatorPassword = "operator chosen password";
    assert.equal(
      await provisionAccount(database.db, {
        email: email.toUpperCase(),
        role: "evaluator",
        password: operatorPassword,
      }),
      false,
    );
    // The first registrant's password is replaced and their sessions revoked.
    await assert.rejects(studio.api.signInEmail({ body: { email, password } }));
    assert.equal(
      (
        await database.db
          .select()
          .from(sessionTable)
          .where(eq(sessionTable.token, signedIn.token))
      ).length,
      0,
    );
    const staff = await studio.api.signInEmail({
      body: { email, password: operatorPassword },
    });
    assert.equal(staff.user.emailVerified, true);
    assert.equal(staff.user.role, "evaluator");

    const newEmail = `${randomUUID()}@example.test`;
    assert.equal(
      await provisionAccount(database.db, {
        email: newEmail,
        role: "admin",
        name: "New admin",
        password: operatorPassword,
      }),
      true,
    );
    const admin = await studio.api.signInEmail({
      body: { email: newEmail, password: operatorPassword },
    });
    assert.equal(admin.user.role, "admin");
    assert.equal(admin.user.name, "New admin");
    await assert.rejects(credentialAccount(admin.user.id, "short"));
  } finally {
    await database.close();
  }
});
