import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const ac = createAccessControl({
  ...defaultStatements,
  studio: ["view", "author", "execute", "users"],
} as const);
export const roles = {
  user: ac.newRole({}),
  viewer: ac.newRole({ studio: ["view"] }),
  evaluator: ac.newRole({ studio: ["view", "author", "execute"] }),
  admin: ac.newRole({
    studio: ["view", "author", "execute", "users"],
    user: ["list", "get", "set-role", "ban"],
    session: ["list", "revoke"],
  }),
};
export type StudioPermission = "view" | "author" | "execute" | "users";
export type AppRole = keyof typeof roles;
/** Check current account state even when a session predates a ban. Expired bans no longer apply. */
export function isUserBanned(
  user: { banned?: boolean | null; banExpires?: Date | null },
  now = Date.now(),
) {
  return (
    user.banned === true &&
    (!user.banExpires || user.banExpires.getTime() > now)
  );
}

/** Reuse the plugin's role definitions for application-owned server boundaries. */
export function canAccessStudio(
  role: string | null | undefined,
  permission: StudioPermission,
) {
  return (role ?? "user").split(",").some((name) => {
    if (!Object.hasOwn(roles, name)) return false;
    return roles[name as AppRole].authorize({ studio: [permission] }).success;
  });
}
