"use client";

import type { ReactNode } from "react";
import {
  ActivityIcon,
  FlaskConicalIcon,
  GaugeIcon,
  LayersIcon,
  MessageSquareIcon,
  PanelLeftIcon,
  ShapesIcon,
  SwatchBookIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@multitudes/ui";

import { Badge } from "./badge";
import { Button } from "./button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./sheet";
import { DirectionSwitcher } from "./tachyon";
import { TachyonBackdrop } from "./tachyon-backdrop";
import { ThemeToggle } from "./theme";

const icons = {
  chat: MessageSquareIcon,
  runs: ActivityIcon,
  cases: LayersIcon,
  experiments: FlaskConicalIcon,
  dashboard: GaugeIcon,
  users: UsersIcon,
  system: SwatchBookIcon,
};
export interface WorkspaceLink {
  href: string;
  label: string;
  icon: keyof typeof icons;
  active?: boolean;
}

/**
 * Responsive workspace chrome shared by the product and evaluation studio.
 * Every region carries a `data-slot` so Tachyon directions can restyle the
 * chrome from CSS without forking this component.
 */
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
      <a
        href="/"
        data-slot="shell-brand"
        className="flex h-(--tc-header-h) shrink-0 items-center gap-2.5 px-2"
      >
        <span
          data-slot="shell-mark"
          className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md"
        >
          <ShapesIcon className="size-4" />
        </span>
        <span className="type-display text-lead leading-none">Multitudes</span>
        {studio && (
          <span className="text-muted-foreground text-caption mt-0.5">
            Studio
          </span>
        )}
      </a>
      <nav
        aria-label="Workspace navigation"
        data-slot="shell-nav"
        className="mt-4 flex flex-col gap-0.5"
      >
        {links.map(({ href, label, icon, active }) => {
          const Icon = icons[icon];
          return (
            <a
              key={href}
              href={href}
              data-slot="shell-nav-item"
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:text-foreground text-body relative isolate flex h-(--tc-nav-h) items-center gap-2.5 rounded-md px-2.5 transition-colors",
                "hover:bg-[color-mix(in_oklab,var(--tc-ink)_5%,transparent)]",
                active && "bg-accent text-foreground font-medium",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </a>
          );
        })}
      </nav>
      <div
        data-slot="shell-footer"
        className="mt-auto flex items-center justify-between gap-1 border-t py-3"
      >
        <DirectionSwitcher />
        <ThemeToggle />
      </div>
    </>
  );
  return (
    <div
      data-slot="shell"
      className="min-h-dvh md:grid md:grid-cols-[var(--tc-sidebar-w)_minmax(0,1fr)]"
    >
      <TachyonBackdrop />
      <aside
        data-slot="shell-sidebar"
        className="bg-sidebar sticky top-0 z-20 hidden h-dvh flex-col border-r px-3 backdrop-blur-(--tc-glass-blur) md:flex"
      >
        {navigation}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header
          data-slot="shell-header"
          className="sticky top-0 z-10 flex h-(--tc-header-h) items-center justify-between gap-4 border-b bg-[color-mix(in_oklab,var(--tc-paper)_var(--tc-chrome-alpha),transparent)] px-5 backdrop-blur-(--tc-glass-blur) md:px-(--tc-page-px)"
        >
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
              <SheetContent side="left" className="flex w-64 flex-col px-3">
                <SheetTitle className="sr-only">
                  Workspace navigation
                </SheetTitle>
                {navigation}
              </SheetContent>
            </Sheet>
            <span className="text-muted-foreground text-body">
              {studio ? "Agent studio" : "Agent workspace"}
            </span>
            <Badge variant="outline">{studio ? "Internal" : "Preview"}</Badge>
          </div>
          <div className="text-muted-foreground text-caption truncate">
            {account}
          </div>
        </header>
        <div data-slot="shell-content" className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
