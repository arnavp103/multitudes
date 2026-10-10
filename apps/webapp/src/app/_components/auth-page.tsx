import type { ReactNode } from "react";

/** Minimal centred layout for signed-out account pages. */
export function AuthPage({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-16">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mb-8 text-sm">{description}</p>
      {children}
      <p className="text-muted-foreground mt-6 text-sm">{footer}</p>
    </main>
  );
}
