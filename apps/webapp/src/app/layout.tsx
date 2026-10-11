import type { Metadata, Viewport } from "next";

import { cn } from "@multitudes/ui";
import { tachyonFontVariables } from "@multitudes/ui/fonts";
import { TachyonDirectionScript } from "@multitudes/ui/tachyon";
import { ThemeProvider } from "@multitudes/ui/theme";
import { Toaster } from "@multitudes/ui/toast";

import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

const appUrl = env.WEBAPP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Multitudes",
  description: "Your agent workspace.",
  openGraph: {
    title: "Multitudes",
    description: "Your agent workspace.",
    url: appUrl,
    siteName: "Multitudes",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className={tachyonFontVariables} suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
        )}
      >
        <TachyonDirectionScript />
        <ThemeProvider>
          <TRPCReactProvider>{props.children}</TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
