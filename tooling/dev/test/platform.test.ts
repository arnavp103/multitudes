import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { createTestAuth } from "@multitudes/auth/testing";
import { eq } from "@multitudes/db";
import { db, pool } from "@multitudes/db/client";
import { session as sessionTable, user } from "@multitudes/db/schema";

import { DEV_PASSWORD } from "../src/seed";

const webUrl = process.env.WEBAPP_URL ?? "http://localhost:3000";
const studioUrl = process.env.STUDIO_URL ?? "http://localhost:3001";
/** Use real signed sessions; only the external identity-provider interaction is bypassed. */
async function identity(
  app: "studio" | "webapp",
  role: string,
  verified = true,
) {
  const baseUrl = app === "studio" ? studioUrl : webUrl;
  const auth = createTestAuth({
    database: db,
    baseUrl,
    productionUrl: baseUrl,
    cookiePrefix: `multitudes-${app}`,
    secret: process.env.AUTH_SECRET,
  });
  const { test: helpers } = await auth.$context;
  const account = await helpers.saveUser(
    helpers.createUser({
      name: `Browser ${role}`,
      email: `${randomUUID()}@example.test`,
      role,
      emailVerified: verified,
    }),
  );
  const login = await helpers.login({ userId: account.id });
  return { account, login, auth };
}
test.afterAll(async () => {
  await pool.end();
});

test("product chat completes through the real queue/worker and reconnects after reload", async ({
  page,
  context,
}) => {
  const regular = await identity("webapp", "user");
  await context.addCookies(regular.login.cookies);
  const sessionResponse = await context.request.get(
    `${webUrl}/api/trpc/auth.getSession`,
    {
      headers: { origin: "https://untrusted.example" },
    },
  );
  expect(sessionResponse.status()).toBe(200);
  expect(
    sessionResponse.headers()["access-control-allow-origin"],
  ).toBeUndefined();
  const sessionBody = (await sessionResponse.json()) as {
    result: { data: { json: unknown } };
  };
  expect(sessionBody.result.data.json).toEqual({
    user: {
      id: regular.account.id,
      name: regular.account.name,
      image: regular.account.image,
    },
  });
  expect(JSON.stringify(sessionBody)).not.toContain(regular.login.token);
  const removed = await context.request.get(`${webUrl}/api/trpc/post.all`);
  expect(removed.status()).toBe(404);
  await page.goto(webUrl);
  await page
    .getByRole("textbox", { name: "Task" })
    .fill("Complete an E2E task");
  let loseResponse = true;
  await page.route("**/*", async (route) => {
    if (
      loseResponse &&
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    ) {
      loseResponse = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Send task" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Task" })).toHaveValue(
    "Complete an E2E task",
  );
  await page.getByRole("button", { name: "Send task" }).click();
  await expect(page).toHaveURL(/\?run=/);
  await expect(
    page.getByText("Fixture result: your task completed.", { exact: true }),
  ).toBeVisible();
  const runId = new URL(page.url()).searchParams.get("run");
  await page.reload();
  await expect(
    page.getByText("Fixture result: your task completed.", { exact: true }),
  ).toBeVisible();
  const rows = await pool.query(
    "SELECT id FROM agent_run WHERE owner_id = $1",
    [regular.account.id],
  );
  expect(rows.rows.map((row: { id: string }) => row.id)).toEqual([runId]);
  await context.clearCookies();
  const stranger = await identity("webapp", "user");
  await context.addCookies(stranger.login.cookies);
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("Fixture result: your task completed.", { exact: true }),
  ).toHaveCount(0);
});

test("product users sign up, sign out, and sign back in with a password", async ({
  page,
}) => {
  const email = `${randomUUID()}@example.test`;
  const password = "correct horse battery";
  await page.goto(webUrl);
  await page.getByRole("link", { name: "Sign up" }).click();
  await page.getByLabel("Name").fill("Password person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${webUrl}/`);
  await expect(page.getByText("Password person")).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Nothing to configure yet")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.goto(`${webUrl}/settings`);
  await expect(page).toHaveURL(`${webUrl}/sign-in`);
  await page.goto(webUrl);
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${webUrl}/`);
  await expect(page.getByText("Password person")).toBeVisible();
});

test("seeded staff sign in to Studio with a password; Studio has no sign-up", async ({
  page,
  context,
}) => {
  const signUp = await context.request.post(
    `${studioUrl}/api/auth/sign-up/email`,
    {
      headers: { origin: studioUrl },
      data: {
        name: "Self-service staff",
        email: `${randomUUID()}@example.test`,
        password: "correct horse battery",
      },
    },
  );
  expect(signUp.ok()).toBe(false);
  await page.goto(studioUrl);
  await expect(page).toHaveURL(`${studioUrl}/login`);
  await page.getByLabel("Email").fill("admin@multitudes.test");
  await page.getByLabel("Password").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Agent runs", exact: true }),
  ).toBeVisible();
});

test("staff promotes production input to an eval and observes a completed experiment", async ({
  page,
  context,
}) => {
  const evaluator = await identity("studio", "evaluator");
  await context.addCookies(evaluator.login.cookies);
  await page.goto(`${studioUrl}/playground`);
  await page.getByRole("textbox", { name: "Task" }).fill("An input to promote");
  await page.getByRole("button", { name: "Send task" }).click();
  await expect(
    page.getByText("Fixture result: your task completed.", { exact: true }),
  ).toBeVisible();
  const runId = new URL(page.url()).searchParams.get("run");
  await page.goto(`${studioUrl}/runs/${runId}`);
  await page.getByRole("link", { name: "Create eval case" }).click();
  await expect(
    page.getByRole("textbox", { name: "Input", exact: true }),
  ).toHaveValue("An input to promote");
  await page.getByLabel("Name", { exact: true }).fill("Browser regression");
  await page.getByLabel("Output must contain").fill("Fixture result");
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page).toHaveURL(`${studioUrl}/cases`);
  await page.goto(`${studioUrl}/experiments`);
  await page.getByLabel("Name", { exact: true }).fill("Browser experiment");
  await page.getByLabel("regression / Browser regression").check();
  await page.getByRole("button", { name: "Queue experiment" }).click();
  await expect(page).toHaveURL(/\/experiments\//);
  await expect
    .poll(async () => {
      await page.reload();
      return page.locator("body").innerText();
    })
    .toContain("completed");
  await expect(page.getByText("Pass", { exact: true }).first()).toBeVisible();
});

test("anonymous, regular, unverified, expired and banned accounts cannot view Studio data", async ({
  page,
  context,
}) => {
  await page.goto(studioUrl);
  await expect(page).toHaveURL(`${studioUrl}/login`);
  for (const state of ["regular", "unverified", "expired", "banned"]) {
    await context.clearCookies();
    const person = await identity(
      "studio",
      state === "regular" ? "user" : "admin",
      state !== "unverified",
    );
    if (state === "expired")
      await db
        .update(sessionTable)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessionTable.token, person.login.token));
    if (state === "banned")
      await db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, person.account.id));
    await context.addCookies(person.login.cookies);
    await page.goto(`${studioUrl}/admin`);
    if (state === "expired") await expect(page).toHaveURL(`${studioUrl}/login`);
    else
      await expect(
        page.getByText("Unable to load this page", { exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How your agents are doing" }),
    ).toHaveCount(0);
    // A protected page must not disclose the dashboard or its queries after denial.
    await expect(page.getByText("Model usage", { exact: true })).toHaveCount(0);
  }
});

test("viewer cannot mutate; admin manages users and revokes sessions", async ({
  page,
  context,
}) => {
  const viewer = await identity("studio", "viewer");
  await context.addCookies(viewer.login.cookies);
  await page.goto(studioUrl);
  await expect(
    page.getByRole("heading", { name: "Agent runs", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Queue run" })).toHaveCount(0);
  await page.goto(`${studioUrl}/users`);
  await expect(
    page.getByRole("heading", { name: "Users and sessions" }),
  ).toHaveCount(0);
  const denied = await context.request.post(
    `${studioUrl}/api/auth/admin/set-role`,
    {
      headers: { origin: studioUrl },
      data: { userId: viewer.account.id, role: "admin" },
    },
  );
  expect(denied.status()).toBe(403);
  await context.clearCookies();
  const admin = await identity("studio", "admin");
  await context.addCookies(admin.login.cookies);
  await page.goto(`${studioUrl}/users`);
  await expect(
    page.getByRole("heading", { name: "Users and sessions" }),
  ).toBeVisible();
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: viewer.account.email });
  await card
    .getByLabel(`Role for ${viewer.account.email}`)
    .selectOption("evaluator");
  await card.getByRole("button", { name: "Update role" }).click();
  await expect
    .poll(
      async () =>
        (await db.select().from(user).where(eq(user.id, viewer.account.id)))[0]
          ?.role,
    )
    .toBe("evaluator");
  expect(
    await viewer.auth.api.getSession({ headers: viewer.login.headers }),
  ).toBeNull();
  await card.getByRole("button", { name: "Ban", exact: true }).click();
  await expect(card.getByText("Banned", { exact: true })).toBeVisible();
});
