import Link from "next/link";

import { requireStaff } from "~/server/access";

export const dynamic = "force-dynamic";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff();
  return (
    <>
      <header>
        <Link href="/" className="brand">
          MULTITUDES <span>Agent studio</span>
        </Link>
        <nav>
          <Link href="/">Runs</Link>
          <Link href="/cases">Cases</Link>
          <Link href="/experiments">Experiments</Link>
        </nav>
        <span className="muted">{session.user.email}</span>
      </header>
      <main>{children}</main>
    </>
  );
}
