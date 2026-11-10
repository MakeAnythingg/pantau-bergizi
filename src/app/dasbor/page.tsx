import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requestNow } from "@/lib/now";
import { requireRole } from "@/lib/session";
import { ManagerDashboard } from "./manager";
import { ModeratorDashboard } from "./moderator";

type Search = Record<string, string | string[] | undefined>;

function positiveInt(value: Search[string], max: number) {
  const parsed = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().positive().max(max))
    .safeParse(value);

  return parsed.data;
}

async function Dashboard({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireRole("moderator", "sppg_manager");
  const query = await searchParams;
  const now = await requestNow();

  if (session.role === "moderator") {
    return (
      <ModeratorDashboard
        now={now}
        queuePage={positiveInt(query.antrean, 100_000) ?? 1}
        followPage={positiveInt(query["tindak-lanjut"], 100_000) ?? 1}
        reportId={positiveInt(query.laporan, 2_147_483_647)}
      />
    );
  }

  if (session.sppgId === null) notFound();

  return <ManagerDashboard now={now} sppgId={session.sppgId} page={positiveInt(query.menunggu, 100_000) ?? 1} />;
}

export default function DasborPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-muted-foreground">Memuat…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
