import { StudioShell } from "~/components/studio-shell";
import { requireStaff } from "~/server/access";

export const dynamic = "force-dynamic";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff();
  return (
    <StudioShell email={session.user.email}>
      <main className="studio-content">{children}</main>
    </StudioShell>
  );
}
