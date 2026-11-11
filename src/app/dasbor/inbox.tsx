"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

export type InboxEntry = {
  key: string;
  label: string;
  /** A short line under the label, e.g. "Prioritas". */
  hint?: string | undefined;
  count?: string | undefined;
  pane: ReactNode;
};

/**
 * Kitchens (and the secondary lists) on the left, one pane on the right. The server renders every pane; only the
 * picked one shows. The pick is client state so it survives the refresh after an action, even when that action
 * changes the kitchens' ranking.
 */
export function Inbox({
  kitchens,
  lists,
  footer,
}: {
  kitchens: InboxEntry[];
  lists: InboxEntry[];
  footer?: ReactNode;
}) {
  const entries = [...kitchens, ...lists];
  const [picked, setPicked] = useState(entries[0]?.key);
  // A kitchen can drop out (queue cleared, next page); fall back to the top entry.
  const current = entries.some((entry) => entry.key === picked) ? picked : entries[0]?.key;

  const pick = (key: string) => {
    setPicked(key);

    // Stacked on small screens: bring the pane into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      document.getElementById("inbox-pane")?.scrollIntoView({ block: "start" });
    }
  };

  const item = (entry: InboxEntry) => {
    const active = entry.key === current;

    return (
      <button
        key={entry.key}
        type="button"
        onClick={() => {
          pick(entry.key);
        }}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors duration-150 ease-out",
          active ? "bg-navy text-white" : "hover:bg-well",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{entry.label}</span>
          {entry.hint && (
            <span className={cn("block text-xs font-bold", active ? "text-white/80" : "text-alarm")}>{entry.hint}</span>
          )}
        </span>
        {entry.count !== undefined && (
          <span
            className={cn(
              "min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold",
              active ? "bg-white/15" : "bg-cup text-ink-2",
            )}
          >
            {entry.count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="Daftar antrean" className="surface grid gap-1 p-2 lg:sticky lg:top-6">
        <p className="px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-ink-3 uppercase">Dapur</p>
        {kitchens.length === 0 && (
          <p className="px-3 pb-2 text-sm text-muted-foreground">Tidak ada laporan yang menunggu tinjauan.</p>
        )}
        {kitchens.map(item)}
        {footer && <div className="px-3 py-1">{footer}</div>}
        <div className="mx-3 my-1 h-px bg-cup" />
        {lists.map(item)}
      </nav>
      <div id="inbox-pane" className="min-w-0 scroll-mt-4">
        {entries.map((entry) => (
          <div key={entry.key} hidden={entry.key !== current}>
            {entry.pane}
          </div>
        ))}
      </div>
    </div>
  );
}
