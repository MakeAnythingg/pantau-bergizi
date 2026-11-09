import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";

export function DashboardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold">{children}</h1>
      <form action="/keluar" method="post">
        <Button type="submit" variant="outline">
          Keluar
        </Button>
      </form>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid min-w-0 gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function NoteField({ label, required = true, value }: { label: string; required?: boolean; value?: string }) {
  return (
    <label className="grid w-full gap-1 text-sm font-medium">
      {label}
      <Textarea name="note" required={required} maxLength={NOTE_MAX_CHARS} defaultValue={value} />
    </label>
  );
}

export function Pagination({
  page,
  hasMore,
  parameter,
  other,
}: {
  page: number;
  hasMore: boolean;
  parameter: string;
  other?: { name: string; page: number };
}) {
  if (page === 1 && !hasMore) return null;

  const url = (next: number) => ({
    pathname: "/dasbor",
    query: { [parameter]: next, ...(other && { [other.name]: other.page }) },
  });

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {page > 1 && (
        <Link className="underline" href={url(page - 1)}>
          Sebelumnya
        </Link>
      )}
      <span className="text-muted-foreground">Halaman {page}</span>
      {hasMore && (
        <Link className="underline" href={url(page + 1)}>
          Berikutnya
        </Link>
      )}
    </div>
  );
}
