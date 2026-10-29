import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { sppg } from "@/db/schema";
import { requireRole } from "@/lib/session";

async function Dashboard() {
  const session = await requireRole("moderator", "sppg_manager");
  const kitchen = session.sppgId
    ? await getDb().query.sppg.findFirst({ where: eq(sppg.id, session.sppgId) })
    : undefined;
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold">
        {session.role === "moderator" ? "Moderator" : `Pengelola SPPG · ${kitchen?.name ?? "—"}`}
      </h1>
      <form action="/keluar" method="post">
        <Button type="submit" variant="outline">
          Keluar
        </Button>
      </form>
    </div>
  );
}

export default function DasborPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
