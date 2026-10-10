import { WorkspaceShell } from "@multitudes/ui/workspace-shell";

import { getSession } from "~/auth/server";
import { AuthShowcase } from "./_components/auth-showcase";
import { Chat } from "./_components/chat";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  return (
    <WorkspaceShell
      links={[{ href: "/", label: "Workspace", icon: "chat", active: true }]}
      account={<AuthShowcase />}
    >
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <p className="text-primary mb-3 text-[10px] font-medium tracking-[0.2em] uppercase">
          Think it through. Make it happen.
        </p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">
          A little direction. A lot of possibility.
        </h1>
        <p className="text-muted-foreground mb-8 max-w-xl text-sm leading-6">
          A focused space to work with your agent, from the first question to a
          finished result.
        </p>
        <Chat signedIn={!!session} />
      </main>
    </WorkspaceShell>
  );
}
