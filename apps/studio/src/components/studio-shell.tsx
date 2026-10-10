"use client";

import { usePathname } from "next/navigation";

import { canAccessStudio } from "@multitudes/auth/permissions";
import { WorkspaceShell } from "@multitudes/ui/workspace-shell";

/** Resolve active navigation on the client without coupling the shared UI to Next.js. */
export function StudioShell({
  children,
  email,
  role,
}: {
  children: React.ReactNode;
  email: string;
  role?: string | null;
}) {
  const path = usePathname();
  return (
    <WorkspaceShell
      studio
      account={email}
      links={[
        {
          href: "/admin",
          label: "Dashboard",
          icon: "runs" as const,
          active: path === "/admin",
        },
        {
          href: "/",
          label: "Overview",
          icon: "runs" as const,
          active: path === "/" || path.startsWith("/runs"),
        },
        {
          href: "/playground",
          label: "Playground",
          icon: "chat" as const,
          active: path === "/playground",
          permission: "execute" as const,
        },
        {
          href: "/cases",
          label: "Eval cases",
          icon: "cases" as const,
          active: path.startsWith("/cases"),
        },
        {
          href: "/experiments",
          label: "Experiments",
          icon: "experiments" as const,
          active: path.startsWith("/experiments"),
        },
        {
          href: "/users",
          label: "Users",
          icon: "runs" as const,
          active: path === "/users",
          permission: "users" as const,
        },
      ].filter(
        (link) => !link.permission || canAccessStudio(role, link.permission),
      )}
    >
      {children}
    </WorkspaceShell>
  );
}
