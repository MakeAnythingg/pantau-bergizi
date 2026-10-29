import type { Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/** The ompreng (lunch tray) mark: one red compartment, two empty. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 22" aria-hidden="true" className={cn("h-[22px] w-[30px]", className)}>
      <rect x="1" y="1" width="28" height="20" rx="6" fill="#F4F6F8" stroke="#18242C" strokeWidth="1.6" />
      <rect x="4.5" y="4.5" width="10" height="13" rx="3" fill="#B3312A" />
      <rect x="17" y="4.5" width="8.5" height="5.5" rx="2.4" fill="#D3DAE0" />
      <rect x="17" y="12" width="8.5" height="5.5" rx="2.4" fill="#D3DAE0" />
    </svg>
  );
}

export const STATUS_FILL: Record<Status, string> = {
  priority: "fill-priority",
  attention: "fill-attention",
  no_signal: "fill-no_signal",
  no_data: "fill-no_data",
};

export const STATUS_SWATCH: Record<Status, string> = {
  priority: "bg-alarm",
  attention: "bg-caution",
  no_signal: "bg-calm",
  no_data: "bg-ink-3/60",
};

/** One cup per school: full when it reported in the signal window. */
export function Cups({ reported, total, className }: { reported: number; total: number; className?: string }) {
  return (
    <div className={cn("flex gap-[5px]", className)} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={cn("h-5 flex-1", i < reported ? "cup-full" : "cup")} />
      ))}
    </div>
  );
}
