import type { ComponentProps } from "react";

import { cn } from "@multitudes/ui";

/**
 * One wave stroke of the mark, centred on y = 18 in a 64×64 box. The other
 * stripes reuse it with a vertical offset.
 */
const wave =
  "M10 18C10.61 17.47 12.44 15.57 13.67 14.82C14.89 14.07 16.11 13.5 17.33 13.5C18.56 13.5 19.78 14.07 21 14.82C22.22 15.57 23.44 16.94 24.67 18C25.89 19.06 27.11 20.43 28.33 21.18C29.56 21.93 30.78 22.5 32 22.5C33.22 22.5 34.44 21.93 35.67 21.18C36.89 20.43 38.11 19.06 39.33 18C40.56 16.94 41.78 15.56 43 14.82C44.22 14.07 45.44 13.5 46.67 13.5C47.89 13.5 49.11 14.07 50.33 14.82C51.56 15.57 53.39 17.47 54 18";

/**
 * Stripe colours. They read the `--brand-*` accent tokens once the brand
 * palette lands in the theme and fall back to existing theme colours until then.
 */
const stripes = [
  { offset: 0, color: "var(--brand-1, var(--primary))" },
  { offset: 14, color: "var(--brand-2, var(--chart-2))" },
  { offset: 28, color: "var(--brand-3, var(--chart-1))" },
];

/**
 * The Multitudes mark: stacked wave stripes.
 *
 * Provisional geometry (round-1 variant R1-01) while the logo direction is
 * being chosen; see `design/logo/` for the explorations. Decorative by
 * default; pass `aria-label` and `role="img"` when it stands alone.
 */
export function LogoMark({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {stripes.map(({ offset, color }) => (
        <path
          key={offset}
          d={wave}
          transform={offset ? `translate(0 ${offset})` : undefined}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** Mark plus "Multitudes" wordmark, as used in the app chrome. */
export function Logo({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="logo"
      className={cn(
        "flex items-center gap-2.5 text-base font-semibold tracking-tight",
        className,
      )}
      {...props}
    >
      <LogoMark className="size-7" />
      Multitudes
    </span>
  );
}
