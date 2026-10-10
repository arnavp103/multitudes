import type { Metadata } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "Multitudes · Agent studio",
  robots: { index: false, follow: false },
};
export const runtime = "nodejs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
