"use client";

import { useCallback, useSyncExternalStore } from "react";
import { LayersIcon } from "lucide-react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/** Round-1 Tachyon exploration directions, keyed by `data-direction` on <html>. */
export const TACHYON_DIRECTIONS = [
  {
    id: "d1",
    name: "Cyanotype",
    summary: "Chart paper and blueprint linework",
  },
  { id: "d2", name: "Field", summary: "Particle field behind frosted glass" },
  { id: "d3", name: "Xeno", summary: "Alien OS: chamfers, orbits, dot-matrix" },
  { id: "d4", name: "Cel", summary: "Cel-shaded, outlined, lived-in" },
] as const;

export type TachyonDirection = (typeof TACHYON_DIRECTIONS)[number]["id"];

const STORAGE_KEY = "tachyon-direction";
const DEFAULT_DIRECTION: TachyonDirection = "d1";
const ids = TACHYON_DIRECTIONS.map((direction) => direction.id);

/**
 * Inline, render-blocking script that applies the stored direction before
 * first paint (same approach as next-themes). `?direction=d3` in the URL
 * selects and remembers a direction, which makes review links shareable.
 */
const directionScript = `(()=>{const k=${JSON.stringify(STORAGE_KEY)},ok=${JSON.stringify(ids)};let d=${JSON.stringify(DEFAULT_DIRECTION)};try{const q=new URLSearchParams(location.search).get("direction");if(q&&ok.includes(q))localStorage.setItem(k,q);const s=localStorage.getItem(k);if(s&&ok.includes(s))d=s}catch{}document.documentElement.dataset.direction=d})()`;

/** Place once at the top of <body> in each app layout. */
export function TachyonDirectionScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: directionScript }}
    />
  );
}

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-direction", "class"],
  });
  return () => observer.disconnect();
};

const readDirection = (): TachyonDirection => {
  const value = document.documentElement.dataset.direction;
  return ids.includes(value as TachyonDirection)
    ? (value as TachyonDirection)
    : DEFAULT_DIRECTION;
};

/** Current direction plus a setter that persists it; SSR renders the default. */
export function useTachyonDirection() {
  const direction = useSyncExternalStore(
    subscribe,
    readDirection,
    () => DEFAULT_DIRECTION,
  );
  const setDirection = useCallback((next: TachyonDirection) => {
    document.documentElement.dataset.direction = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  }, []);
  return [direction, setDirection] as const;
}

/** Review-only control for switching directions while comparing them. */
export function DirectionSwitcher() {
  const [direction, setDirection] = useTachyonDirection();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Change design direction"
          className="text-muted-foreground gap-1.5 px-2"
        >
          <LayersIcon className="size-3.5" />
          <span className="type-data text-caption">
            {direction.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-caption font-normal">
          Tachyon direction
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={direction}
          onValueChange={(value) => setDirection(value as TachyonDirection)}
        >
          {TACHYON_DIRECTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              className="items-start"
            >
              <span className="grid gap-0.5">
                <span>
                  <span className="type-data text-caption text-muted-foreground mr-2">
                    {option.id.toUpperCase()}
                  </span>
                  {option.name}
                </span>
                <span className="text-muted-foreground text-caption">
                  {option.summary}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
