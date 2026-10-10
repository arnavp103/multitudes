"use client";

import { usePathname } from "next/navigation";

import { WorkspaceShell } from "@multitudes/ui/workspace-shell";

/** Resolve active navigation on the client without coupling the shared UI to Next.js. */
export function StudioShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
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
          icon: "runs",
          active: path === "/admin",
        },
        {
          href: "/",
          label: "Overview",
          icon: "runs",
          active: path === "/" || path.startsWith("/runs"),
        },
        {
          href: "/playground",
          label: "Playground",
          icon: "chat",
          active: path === "/playground",
        },
        {
          href: "/cases",
          label: "Eval cases",
          icon: "cases",
          active: path.startsWith("/cases"),
        },
        {
          href: "/experiments",
          label: "Experiments",
          icon: "experiments",
          active: path.startsWith("/experiments"),
        },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
