"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod/v4";

import { createLogger } from "@multitudes/observability/logger";

import { requireStaff, studioAuth } from "./access";

/** Admin APIs perform their own permission checks in addition to the Studio boundary. */
export async function manageUser(form: FormData) {
  const actor = await requireStaff("users");
  const userId = z.string().min(1).parse(form.get("userId"));
  const operation = z
    .enum(["role", "ban", "unban", "revoke"])
    .parse(form.get("operation"));
  if (userId === actor.user.id && operation !== "revoke")
    throw new Error("Use another administrator to change your own access");
  const requestHeaders = await headers();
  const api = studioAuth().api;
  if (operation === "role") {
    const role = z
      .enum(["user", "viewer", "evaluator", "admin"])
      .parse(form.get("role"));
    await api.setRole({ headers: requestHeaders, body: { userId, role } });
    await api.revokeUserSessions({ headers: requestHeaders, body: { userId } });
  } else if (operation === "ban") {
    await api.banUser({
      headers: requestHeaders,
      body: { userId, banReason: "Access suspended by an administrator" },
    });
  } else if (operation === "unban") {
    await api.unbanUser({ headers: requestHeaders, body: { userId } });
  } else {
    await api.revokeUserSessions({ headers: requestHeaders, body: { userId } });
  }
  createLogger("multitudes-studio").info(
    { actor_id: actor.user.id, subject_id: userId, operation },
    "User access changed",
  );
  revalidatePath("/users");
}
