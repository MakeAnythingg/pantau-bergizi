import type { Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/** A lens over an Isi Piringku plate. Same geometry as app/icon.svg, minus its dark-tab halo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-6", className)}>
      <path d="M22.2 22.2 28.6 28.6" stroke="#18242C" strokeWidth="4.4" strokeLinecap="round" />
      <circle cx="13" cy="13" r="11" fill="#F4F6F8" stroke="#18242C" strokeWidth="2.8" />
      <path d="M12.1 5.35A7.7 7.7 0 0 0 12.1 20.65Z" fill="#B3312A" />
      <path d="M13.9 12.1V5.35A7.7 7.7 0 0 1 20.65 12.1ZM13.9 13.9H20.65A7.7 7.7 0 0 1 13.9 20.65Z" fill="#C9D1D8" />
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
