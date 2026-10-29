import { type ReactNode, Suspense } from "react";

/** Placeholder for a page whose feature isn't built yet. */
export function StubPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children && (
        <Suspense>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{children}</p>
        </Suspense>
      )}
      <p className="mt-4 text-muted-foreground">Segera hadir.</p>
    </main>
  );
}
