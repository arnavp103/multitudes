import type { ReactNode } from "react";

import { cn } from "@multitudes/ui";

/**
 * A compact readout: what is measured, its current value, and the context
 * needed to trust it. Replaces tall "big number" cards with a dense panel
 * whose value uses the direction's readout face.
 */
export function Metric({
  label,
  value,
  detail,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground grid gap-1 rounded-xl border px-(--tc-panel-pad) py-[calc(var(--tc-panel-pad)*0.8)] shadow-sm backdrop-blur-(--tc-glass-blur)",
        className,
      )}
    >
      <p
        data-slot="metric-label"
        className="text-muted-foreground text-caption"
      >
        {label}
      </p>
      <p
        data-slot="metric-value"
        className="type-readout text-display leading-none"
      >
        {value}
      </p>
      {detail && (
        <p
          data-slot="metric-detail"
          className="text-muted-foreground text-caption mt-1"
        >
          {detail}
        </p>
      )}
    </div>
  );
}
