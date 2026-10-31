import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QrCode } from "@/components/qr-code";
import { STATUS_SWATCH } from "@/components/tray";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getSchoolPage } from "@/db/board";
import { getDb } from "@/db/index";
import { getEnv } from "@/lib/env";
import { formUrl } from "@/lib/form-url";
import { requestNow } from "@/lib/now";
import { STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import { ShareActions } from "./share-actions";

export default function SekolahPage({ params }: PageProps<"/sekolah/[code]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-2 pb-14 sm:px-8 print:max-w-none print:p-0">
      <Suspense fallback={<div className="h-[70vh]" />}>
        <SekolahView params={params} />
      </Suspense>
    </main>
  );
}

async function SekolahView({ params }: Pick<PageProps<"/sekolah/[code]">, "params">) {
  const { code } = await params;

  if (code.length > 80) notFound();
  const now = await requestNow();
  const school = await getSchoolPage(getDb(), code, now);

  if (!school) notFound();
  const url = formUrl(school.code);
  const qrLabel = `QR form lapor ${school.name}`;

  return (
    <>
      <div className="print:hidden">
        <p className="mb-1.5 text-sm font-semibold text-ink-3">Halaman sekolah</p>
        <h1 className="font-heading text-[32px] leading-[1.05] font-bold tracking-tight sm:text-[44px]">
          {school.name}
        </h1>
        <Badge
          variant="outline"
          render={<Link href={`/sppg/${school.sppgId}`} />}
          className="mt-3 h-auto gap-2 bg-card py-1.5 pr-3.5 pl-2.5 text-sm font-semibold"
        >
          <i className={cn("size-2.5 rounded-[3px]", STATUS_SWATCH[school.signal.status])} />
          Dapur {school.sppgName}: {STATUS_LABEL[school.signal.status]}
        </Badge>

        <Link
          href={`/lapor/${school.code}`}
          className={cn(
            buttonVariants(),
            "mt-7 h-auto w-full flex-col items-start gap-0.5 rounded-2xl px-6 py-3.5 whitespace-normal shadow-md",
          )}
        >
          <b className="text-lg">Lapor makan siang hari ini</b>
          <span className="text-sm font-normal opacity-90">untuk siswa, guru, dan orang tua di sekolah ini</span>
        </Link>

        <section aria-label="QR sekolah" className="well mt-7 grid gap-5 sm:grid-cols-[200px_1fr] sm:items-center">
          <QrCode value={url} label={qrLabel} className="w-full max-w-[200px] rounded-xl" />
          <div>
            <p className="text-ink-2">
              Tempel QR ini di sekolah atau bagikan link-nya ke grup orang tua. Tidak perlu akun atau aplikasi.
            </p>
            <p className="mt-2 font-mono text-sm break-all text-ink-3">{url}</p>
            <div className="mt-4">
              <ShareActions url={url} schoolName={school.name} />
            </div>
          </div>
        </section>
      </div>

      {/* The A4 poster: shown only when printing. */}
      <div className="hidden min-h-[260mm] flex-col items-center justify-between text-center print:flex">
        <div>
          <p className="font-heading text-[40px] leading-tight font-bold">{school.name}</p>
          <p className="mt-2 text-lg">Dapur: {school.sppgName}</p>
        </div>
        <QrCode value={url} label={qrLabel} className="w-[150mm]" />
        <div>
          <p className="text-2xl font-bold">Scan untuk menilai makan siang atau melapor keluhan</p>
          <p className="mt-3 font-mono text-base break-all">{url}</p>
          {getEnv().DEMO_MODE && <p className="mt-6 text-sm">Data simulasi</p>}
        </div>
      </div>
    </>
  );
}
