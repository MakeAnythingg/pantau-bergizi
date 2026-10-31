import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { STATUS_FILL } from "@/components/tray";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRapor, type Rapor } from "@/db/board";
import { getDb } from "@/db/index";
import { addDays, formatDayWIB, formatTimeWIB, formatWeekdayWIB, todayWIB } from "@/lib/date";
import { requestNow } from "@/lib/now";
import { STATUS_LABEL, type Status } from "@/lib/status";
import { LEFTOVER_MIN_REPORTS } from "@/lib/thresholds";
import { cn } from "@/lib/utils";

const RADAR_MBG_URL = "https://www.bgn.go.id/radar-mbg/";

const STATUS_HINT: Record<Status, string> = {
  priority: "Perlu diperiksa lebih dulu.",
  attention: "Ada laporan yang perlu dicermati.",
  no_signal: "Tidak ada aturan sinyal yang terpenuhi.",
  no_data: "Bukan berarti baik.",
};

type Latest = Rapor["latest"][number];

const ROLE: Record<Latest["reporterRole"], string> = { teacher: "Guru/UKS", student: "Siswa", parent: "Orang tua" };

const PLACE: Record<Latest["locationCheck"], string> = {
  inside: "di area sekolah",
  outside: "di luar area sekolah",
  unavailable: "lokasi tidak tersedia",
};

const SYMPTOM: Record<Latest["symptoms"][number], string> = {
  nausea: "Mual",
  diarrhea: "Diare",
  dizzy: "Pusing",
  other: "Keluhan lain",
};

const PROBLEM: Record<Latest["problems"][number], string | null> = {
  stale: "basi",
  foreign_object: "ada benda asing",
  small_portion: "porsi kurang",
  late: "terlambat",
  none: null,
};

const LEFTOVER: Record<NonNullable<Latest["leftover"]>, string> = {
  none: "habis",
  little: "sisa sedikit",
  lots: "sisa banyak",
};

const REVIEWED: ReadonlySet<Latest["status"]> = new Set(["reviewed", "responded", "closed"]);

const decimal = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });

/** "hari ini 11.05", "kemarin 11.05", or "Sel 11.05". */
function whenWIB(d: Date, now: Date) {
  const today = todayWIB(now);
  const day = todayWIB(d);
  const label = day === today ? "hari ini" : day === addDays(today, -1) ? "kemarin" : formatWeekdayWIB(d);

  return `${label} ${formatTimeWIB(d)}`;
}

const hoursSince = (from: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - from.getTime()) / 3_600_000));

export default function RaporDapurPage({ params }: PageProps<"/sppg/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-2 pb-14 sm:px-8">
      <Suspense fallback={<div className="h-[70vh]" />}>
        <RaporView params={params} />
      </Suspense>
    </main>
  );
}

async function RaporView({ params }: Pick<PageProps<"/sppg/[id]">, "params">) {
  const { id } = await params;

  if (!/^\d{1,9}$/.test(id)) notFound();
  const now = await requestNow();
  const rapor = await getRapor(getDb(), Number(id), now);

  if (!rapor) notFound();
  const { kitchen, signal, schools, menu, experience, perMenu, trend, latest } = rapor;
  const reported = schools.filter((s) => s.reported).length;

  return (
    <>
      <p className="mb-1.5 text-sm font-semibold text-ink-3">
        <Link href="/" className="text-navy hover:underline">
          Semua dapur
        </Link>{" "}
        / Rapor harian, {formatDayWIB(now)}
      </p>
      <h1 className="font-heading text-[32px] leading-[1.05] font-bold tracking-tight sm:text-[52px]">
        {kitchen.name}
      </h1>
      <p className="mt-1.5 mb-6 text-ink-2">
        {kitchen.district}, melayani {schools.length} sekolah
      </p>

      <div className="tray grid grid-cols-1 gap-2.5 lg:grid-cols-6">
        <section
          aria-label="Status hari ini"
          className={cn(
            "well grid gap-6 p-6 lg:col-span-6 lg:grid-cols-[330px_1fr] lg:items-center lg:gap-9 lg:px-8 lg:py-7",
            STATUS_FILL[signal.status],
          )}
        >
          <div className="font-heading text-5xl leading-[0.9] font-bold tracking-tight lg:text-[64px]">
            {STATUS_LABEL[signal.status]}
            <small className="mt-3 block max-w-[28ch] font-sans text-[15px] leading-snug font-medium tracking-normal opacity-95">
              {STATUS_HINT[signal.status]}
              {signal.label && ` ${signal.label}.`}
            </small>
          </div>
          <dl className="grid gap-4 sm:grid-cols-[1.7fr_1fr] sm:border-l sm:border-current/25">
            <div className="sm:px-6">
              <dt className="text-[13px] font-semibold opacity-80">Alasan</dt>
              <dd className="mt-1 text-base leading-snug font-semibold">{signal.reason}</dd>
            </div>
            <div className="sm:border-l sm:border-current/25 sm:px-6">
              <dt className="text-[13px] font-semibold opacity-80">Cakupan</dt>
              <dd className="mt-1 text-base leading-snug font-semibold">
                {reported} dari {schools.length} sekolah melapor dalam 24 jam
              </dd>
            </div>
          </dl>
        </section>

        <Cell title="Menu hari ini, dilaporkan pengelola" className="lg:col-span-3">
          {menu ? (
            <>
              <p className="font-heading text-[26px] leading-tight font-bold tracking-tight">{menu.name}</p>
              <ul className="my-3 flex flex-wrap gap-1.5">
                {menu.composition.split(",").map((item) => (
                  <li
                    key={item}
                    className="rounded-full first-letter:uppercase bg-white px-3 py-1 text-[13px] font-medium shadow-sm"
                  >
                    {item.trim()}
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-ink-3">Diperbarui pukul {formatTimeWIB(menu.updatedAt)}</p>
            </>
          ) : (
            <p className="text-ink-2">Menu belum diisi pengelola.</p>
          )}
          <a
            href={RADAR_MBG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block border-b-[1.5px] border-navy/30 font-bold text-navy"
          >
            Bandingkan di Radar MBG ↗
          </a>
        </Cell>

        <Cell title="Pengalaman penerima" className="lg:col-span-3">
          <div className="grid grid-cols-3 gap-3.5">
            <Num
              value={experience.rating === null ? "–" : decimal(experience.rating)}
              label={
                experience.rating === null
                  ? "belum ada nilai hari ini"
                  : `nilai rata-rata dari ${experience.rated} laporan`
              }
            />
            <Num
              value={experience.leftoverLots === null ? "–" : `${Math.round(experience.leftoverLots * 100)}%`}
              label={
                experience.leftoverLots === null
                  ? "sisa makanan: data belum cukup"
                  : "laporan “sisa banyak” dalam 7 hari"
              }
            />
            <Num
              value={String(experience.health)}
              label="keluhan kesehatan dalam 24 jam"
              alarm={experience.health > 0}
            />
          </div>
        </Cell>

        <Cell title="Laporan per hari, 7 hari terakhir. Merah berarti ada keluhan kesehatan." className="lg:col-span-4">
          <Trend trend={trend} />
        </Cell>

        <Cell title="Sekolah yang dilayani" className="lg:col-span-2">
          <ul className="grid gap-2">
            {schools.map((s) => (
              <li key={s.id} className={cn("flex items-center gap-2.5 text-sm", !s.reported && "text-ink-3")}>
                <i className={cn("h-4 w-[22px] flex-none rounded-[5px]", s.reported ? "cup-full" : "cup")} />
                <Link href={`/sekolah/${s.code}`} className="hover:underline">
                  {s.name}
                </Link>
                {!s.reported && <span>belum melapor</span>}
              </li>
            ))}
          </ul>
        </Cell>
      </div>

      <PerMenu perMenu={perMenu} />

      <h2 className="mt-9 font-heading text-[26px] leading-tight font-bold tracking-tight">Laporan terbaru</h2>
      <p className="text-sm text-ink-3">Catatan pelapor tampil setelah ditinjau moderator.</p>
      <div className="mt-3.5 rounded-[20px] bg-white px-6 py-1 shadow-[0_0_0_1px_rgb(24_36_44/0.05),0_6px_18px_-12px_rgb(24_36_44/0.35)]">
        {latest.length === 0 ? (
          <p className="py-5 text-ink-2">Belum ada laporan dalam 7 hari terakhir.</p>
        ) : (
          <ul className="divide-y divide-well">
            {latest.map((r) => (
              <ReportRow key={r.id} report={r} now={now} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

const shortDay = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const percent = (share: number) => `${Math.round(share * 100)}%`;

function PerMenu({ perMenu: { days, mostLeftover } }: { perMenu: Rapor["perMenu"] }) {
  return (
    <section aria-labelledby="per-menu" className="mt-9">
      <h2 id="per-menu" className="font-heading text-[26px] leading-tight font-bold tracking-tight">
        7 hari terakhir per menu
      </h2>
      <p className="text-sm text-ink-3">
        Menurut tanggal makan. Sisa makanan tampil jika ada minimal {LEFTOVER_MIN_REPORTS} jawaban hari itu.
      </p>
      {mostLeftover && (
        <p className="mt-2 font-semibold">
          Sisa tertinggi: {mostLeftover.menu ?? "menu belum diisi"}, {shortDay(mostLeftover.day)} ·{" "}
          {percent(mostLeftover.leftoverLots)} laporan
        </p>
      )}
      <div className="mt-3.5 rounded-[20px] bg-white px-4 py-1 shadow-[0_0_0_1px_rgb(24_36_44/0.05),0_6px_18px_-12px_rgb(24_36_44/0.35)] sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal makan</TableHead>
              <TableHead className="max-sm:hidden">Menu</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead>Sisa banyak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((d) => (
              <TableRow key={d.day}>
                <TableCell className="whitespace-normal">
                  <b className="font-semibold whitespace-nowrap">{shortDay(d.day)}</b>
                  {/* On a phone the menu sits under its date instead of in its own column. */}
                  <span className={cn("block sm:hidden", d.menu === null ? "text-ink-3" : "text-ink-2")}>
                    {d.menu ?? "menu belum diisi"}
                  </span>
                </TableCell>
                <TableCell className={cn("max-sm:hidden", d.menu === null && "text-ink-3")}>
                  {d.menu ?? "menu belum diisi"}
                </TableCell>
                <TableCell className="text-ink-2 max-sm:whitespace-normal">
                  {d.rating === null ? "–" : `${decimal(d.rating)} · ${d.rated} laporan`}
                </TableCell>
                <TableCell className="text-ink-2 max-sm:whitespace-normal">
                  {d.leftoverLots === null ? "–" : `${percent(d.leftoverLots)} laporan`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function Cell({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn("well", className)}>
      <h3 className="mb-3 text-[13px] font-bold text-ink-2">{title}</h3>
      {children}
    </section>
  );
}

function Num({ value, label, alarm }: { value: string; label: string; alarm?: boolean }) {
  return (
    <div>
      <b
        className={cn("block text-[34px] leading-none font-bold tracking-tight sm:text-[40px]", alarm && "text-alarm")}
      >
        {value}
      </b>
      <span className="mt-1.5 block text-[13px] leading-snug text-ink-2">{label}</span>
    </div>
  );
}

function Trend({ trend }: { trend: Rapor["trend"] }) {
  const max = Math.max(1, ...trend.map((d) => d.reports));

  return (
    <ol className="grid grid-cols-7 gap-2">
      {trend.map((d, i) => {
        const weekday = formatWeekdayWIB(new Date(`${d.day}T12:00:00+07:00`));
        const today = i === trend.length - 1;

        return (
          <li key={d.day} className="flex flex-col items-stretch gap-1.5">
            <span className="flex h-[74px] items-end" aria-hidden="true">
              <i
                className={cn(
                  "w-full rounded-[7px_7px_3px_3px] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]",
                  d.health ? "bg-alarm" : "bg-ink-3/45",
                )}
                style={{ height: `${Math.max(4, (d.reports / max) * 100)}%` }}
              />
            </span>
            <span className={cn("text-center text-xs", today ? "font-bold text-ink" : "text-ink-3")}>{weekday}</span>
            <span className="sr-only">
              {d.reports} laporan{d.health ? ", ada keluhan kesehatan" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ReportRow({ report: r, now }: { report: Latest; now: Date }) {
  const health = r.kind === "health";

  const summary = health
    ? [
        r.symptoms.map((s) => SYMPTOM[s]).join(", "),
        r.subject === "group" && `pengamatan kelompok, perkiraan ${r.affectedCount ?? "?"} terdampak`,
      ]
    : [
        r.rating !== null && `Nilai ${r.rating}`,
        ...r.problems.map((p) => PROBLEM[p]),
        r.leftover && LEFTOVER[r.leftover],
      ];

  return (
    <li className="grid gap-2 py-4 md:grid-cols-[230px_1fr_290px] md:gap-6">
      <div>
        <b className="font-semibold">{r.schoolName}</b>
        <p className="text-[13px] text-ink-3">
          {ROLE[r.reporterRole]}, {PLACE[r.locationCheck]}, {whenWIB(r.receivedAt, now)}
        </p>
      </div>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex-none rounded-md px-2 py-0.5 text-xs font-bold",
            health ? "bg-alarm-soft text-alarm" : "bg-well text-ink-2",
          )}
        >
          {health ? "Kesehatan" : "Menu"}
        </span>
        <span>
          {summary.filter(Boolean).join(", ")}
          {r.note && REVIEWED.has(r.status) && <q className="mt-1 block text-ink-2">{r.note}</q>}
        </span>
      </div>
      <ReportState report={r} now={now} />
    </li>
  );
}

function ReportState({ report: r, now }: { report: Latest; now: Date }) {
  if (r.reply) {
    return (
      <div className="rounded-xl bg-calm-soft px-3.5 py-2.5 text-sm">
        <b className="block text-xs text-calm">Tanggapan pengelola, {whenWIB(r.reply.createdAt, now)}</b>
        {r.reply.body}
      </div>
    );
  }

  if (r.status === "received") return <p className="text-sm text-ink-3">Menunggu tinjauan moderator</p>;

  if (r.status === "closed") return <p className="text-sm text-ink-3">Selesai</p>;

  return <p className="text-sm font-bold text-alarm">Belum ditanggapi · {hoursSince(r.receivedAt, now)} jam</p>;
}
