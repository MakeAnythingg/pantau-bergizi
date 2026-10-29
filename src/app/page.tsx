import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Cups, STATUS_FILL, STATUS_SWATCH } from "@/components/tray";
import { type BoardKitchen, getBoard, searchSchools } from "@/db/board";
import { getDb } from "@/db/index";
import { formatDayWIB } from "@/lib/date";
import { STATUS_LABEL, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

const STATUS_NOTE: Record<Status, string | null> = {
  priority: null,
  attention: null,
  no_signal: null,
  no_data: "Bukan berarti baik",
};

export default function BerandaPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-2 pb-14 sm:px-8">
      <h1 className="font-heading text-[32px] leading-[1.05] font-bold tracking-tight sm:text-[52px]">
        Kondisi dapur MBG hari ini
      </h1>
      <Suspense fallback={<div className="mt-3 h-[60vh]" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Board({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const now = new Date();
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.trim() : "";
  const db = getDb();
  const [board, matches] = await Promise.all([getBoard(db, now), query ? searchSchools(db, query) : null]);
  const tally = (s: Status) => board.filter((k) => k.signal.status === s).length;

  return (
    <>
      <p className="mt-2.5 max-w-[68ch] text-ink-2 sm:text-base">
        Kota Sukamaju, {formatDayWIB(now)}. Disusun dari laporan siswa, guru, dan orang tua dalam 24 jam terakhir. Dapur
        yang perlu diperiksa lebih dulu ada di atas.
      </p>

      <div className="mt-6 mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form action="/" role="search" className="w-full lg:max-w-[440px]">
          <label className="flex items-center gap-3 rounded-full bg-white px-5 py-3.5 text-ink-3 shadow-[0_0_0_1px_rgb(24_36_44/0.06),0_2px_6px_-2px_rgb(24_36_44/0.14)] focus-within:ring-2 focus-within:ring-navy">
            <MagnifyingGlassIcon size={18} aria-hidden="true" />
            <span className="sr-only">Cari sekolah</span>
            <input
              name="q"
              type="search"
              defaultValue={query}
              maxLength={60}
              placeholder="Cari sekolah anak Anda"
              className="w-full bg-transparent text-ink outline-none placeholder:text-ink-3"
            />
          </label>
        </form>
        <ul className="flex flex-wrap gap-2 lg:flex-nowrap" aria-label="Jumlah dapur per status">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <li
              key={s}
              className="inline-flex items-center gap-2 rounded-full bg-rim py-1.5 pr-3.5 pl-2.5 text-[13px] font-semibold text-ink-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgb(24_36_44/0.08)]"
            >
              <i className={cn("size-2.5 rounded-[3px]", STATUS_SWATCH[s])} />
              {tally(s)} {STATUS_LABEL[s]}
            </li>
          ))}
        </ul>
      </div>

      {matches && (
        <section aria-label="Hasil pencarian" className="mb-8 rounded-[20px] bg-white px-6 py-4 shadow-sm">
          {matches.length === 0 ? (
            <p className="text-ink-2">Tidak ada sekolah dengan nama “{query}”. Coba ketik sebagian nama sekolah.</p>
          ) : (
            <ul className="divide-y divide-well">
              {matches.map((s) => (
                <li key={s.code}>
                  <Link href={`/sppg/${s.sppgId}`} className="flex flex-col py-2.5 hover:text-navy sm:flex-row sm:justify-between sm:gap-4">
                    <b className="font-semibold">{s.name}</b>
                    <span className="text-ink-2">dilayani {s.sppgName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ol className="flex flex-col gap-4">
        {board.map((k) => (
          <KitchenRow key={k.id} kitchen={k} />
        ))}
      </ol>
    </>
  );
}

function KitchenRow({ kitchen: k }: { kitchen: BoardKitchen }) {
  const note = k.signal.label ?? STATUS_NOTE[k.signal.status];
  return (
    <li>
      <Link
        href={`/sppg/${k.id}`}
        className="tray grid gap-2.5 transition-transform outline-none hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-navy md:grid-cols-[250px_1fr_250px]"
      >
        <div className={cn("well flex flex-col justify-center md:min-h-[104px]", STATUS_FILL[k.signal.status])}>
          <b className="font-heading text-[21px] leading-[1.05] font-bold md:text-[25px]">
            {STATUS_LABEL[k.signal.status]}
          </b>
          {note && <small className="mt-1.5 text-[13px] font-medium opacity-90">{note}</small>}
        </div>
        <div className="well">
          <div className="flex flex-wrap items-baseline gap-x-2.5 font-heading text-[21px] leading-tight font-bold tracking-tight md:text-[23px]">
            {k.name}
            <span className="font-sans text-sm font-medium text-ink-3">{k.district}</span>
          </div>
          <p className="mt-1.5 max-w-[58ch] text-ink-2">{k.signal.reason}</p>
        </div>
        <div className="well flex flex-col justify-center gap-2.5">
          <div className="flex items-baseline gap-2">
            <b className="text-[30px] leading-none font-bold tracking-tight">
              {k.reported}/{k.total}
            </b>
            <span className="text-[13px] font-semibold text-ink-3">sekolah melapor</span>
          </div>
          <Cups reported={k.reported} total={k.total} />
        </div>
      </Link>
    </li>
  );
}
