import { redirect } from "next/navigation";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@multitudes/ui/empty";
import { WorkspaceShell } from "@multitudes/ui/workspace-shell";

import { getSession } from "~/auth/server";
import { AuthShowcase } from "../_components/auth-showcase";

export const dynamic = "force-dynamic";

/** Account settings placeholder; signed-out visitors are sent to sign in. */
export default async function SettingsPage() {
  if (!(await getSession())) redirect("/sign-in");
  return (
    <WorkspaceShell
      links={[{ href: "/", label: "Workspace", icon: "chat" }]}
      account={<AuthShowcase />}
    >
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">
          Settings
        </h1>
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Nothing to configure yet</EmptyTitle>
            <EmptyDescription>
              Account and workspace preferences will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    </WorkspaceShell>
  );
}
