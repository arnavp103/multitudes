import type { Metadata } from "next";

import { tachyonFontVariables } from "@multitudes/ui/fonts";
import { TachyonDirectionScript } from "@multitudes/ui/tachyon";
import { ThemeProvider } from "@multitudes/ui/theme";
import { Toaster } from "@multitudes/ui/toast";

import "./styles.css";

export const metadata: Metadata = {
  title: "Multitudes · Agent studio",
  robots: { index: false, follow: false },
};
export const runtime = "nodejs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={tachyonFontVariables} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <TachyonDirectionScript />
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
