"use client";

import type { ReactNode } from "react";
import {
  ActivityIcon,
  FlaskConicalIcon,
  LayersIcon,
  MessageSquareIcon,
  PanelLeftIcon,
} from "lucide-react";

import { cn } from "@multitudes/ui";

import { Badge } from "./badge";
import { Button } from "./button";
import { Logo } from "./logo";
import { Separator } from "./separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./sheet";
import { ThemeToggle } from "./theme";

const icons = {
  chat: MessageSquareIcon,
  runs: ActivityIcon,
  cases: LayersIcon,
  experiments: FlaskConicalIcon,
};
export interface WorkspaceLink {
  href: string;
  label: string;
  icon: keyof typeof icons;
  active?: boolean;
}

/** Responsive workspace chrome shared by the product and evaluation studio. */
export function WorkspaceShell({
  children,
  links,
  studio = false,
  account,
}: {
  children: ReactNode;
  links: WorkspaceLink[];
  studio?: boolean;
  account?: ReactNode;
}) {
  const navigation = (
    <>
      <a href="/" aria-label="Multitudes home" className="flex px-3 py-6">
        <Logo />
      </a>
      <div className="text-muted-foreground mt-6 mb-3 px-3 text-[10px] font-medium tracking-[0.18em] uppercase">
        {studio ? "Development" : "Workspace"}
      </div>
      <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
        {links.map(({ href, label, icon, active }) => {
          const Icon = icons[icon];
          return (
            <a
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active && "bg-accent text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto space-y-4 py-5">
        <Separator />
        <div className="text-muted-foreground flex items-center justify-between gap-2 px-2 text-xs">
          <span>{studio ? "Internal studio" : "Your agent workspace"}</span>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
  return (
    <div className="bg-background min-h-dvh md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="bg-sidebar sticky top-0 hidden h-dvh flex-col border-r px-3 md:flex">
        {navigation}
      </aside>
      <div className="min-w-0">
        <header className="bg-background/95 flex h-16 items-center justify-between gap-4 border-b px-5 md:px-10">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  className="md:hidden"
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                >
                  <PanelLeftIcon className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 flex-col px-4">
                <SheetTitle className="sr-only">
                  Workspace navigation
                </SheetTitle>
                {navigation}
              </SheetContent>
            </Sheet>
            <span className="text-muted-foreground text-sm">
              {studio ? "Agent studio" : "Agent workspace"}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {studio ? "INTERNAL" : "PREVIEW"}
            </Badge>
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {account}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
