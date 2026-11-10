import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db";
import { episodeTime } from "@/db/episodes";
import {
  getFollowUp,
  getModeratorEpisodes,
  getReviewQueue,
  getStaffReport,
  getSurges,
  type StaffReport,
} from "@/db/staff";
import { formatDayWIB, wibTime } from "@/lib/date";
import { getEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { moderatorAction } from "./actions";
import { DashboardForm } from "./dashboard-form";
import { DashboardHeader, NoteField, Pagination, Panel } from "./dashboard-layout";
import { DialogAction } from "./dialog-action";
import { isTeacherGroup, LOCATION, PROBLEMS, ReplyList, ROLES, SYMPTOMS } from "./report-card";

type Candidate = NonNullable<Awaited<ReturnType<typeof getStaffReport>>>["candidates"][number];

type OpenEpisode = Awaited<ReturnType<typeof getModeratorEpisodes>>["open"][number];

type Item = StaffReport & { candidates?: Candidate[]; surge?: boolean; repeated?: boolean };

type Group = { sppgId: number; kitchenName: string; episode: OpenEpisode | undefined; items: Item[] };

const FORWARDING = {
  none: "Belum diteruskan",
  simulated_puskesmas: "Simulasi Puskesmas",
  forwarded_by_officer: "Diteruskan oleh petugas",
};

const selectClass = "w-full min-w-0 rounded-md border border-input bg-background p-2 text-sm";

const ago = (minutes: number) =>
  minutes < 60
    ? `${minutes} mnt`
    : minutes < 60 * 24
      ? `${Math.floor(minutes / 60)} jam`
      : `${Math.floor(minutes / 60 / 24)} hari`;

const more = (n: number, hasMore: boolean) => `${n}${hasMore ? "+" : ""}`;

const minutesSince = (at: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));

function what(item: StaffReport) {
  const parts =
    item.kind === "health"
      ? item.symptoms.map((symptom) => SYMPTOMS[symptom])
      : [
          ...(item.rating === null ? [] : [`Nilai ${item.rating}`]),
          ...item.problems.filter((p) => p !== "none").map((p) => PROBLEMS[p]),
        ];

  return parts.join(" · ") || (item.kind === "health" ? "Keluhan kesehatan" : "Penilaian menu");
}

/**
 * Kitchens needing a moderator first: a teacher group observation waiting to open Prioritas, then open episodes
 * (overdue answers first), then the rest by their oldest waiting report.
 */
function groupByKitchen(items: Item[], episodes: OpenEpisode[]): Group[] {
  const groups = new Map<number, Group>();

  for (const episode of episodes) {
    groups.set(episode.sppgId, {
      sppgId: episode.sppgId,
      kitchenName: episode.kitchenName ?? `SPPG #${episode.sppgId}`,
      episode,
      items: [],
    });
  }

  for (const item of items) {
    const group = groups.get(item.sppgId) ?? {
      sppgId: item.sppgId,
      kitchenName: item.kitchenName,
      episode: undefined,
      items: [],
    };

    group.items.push(item);
    groups.set(item.sppgId, group);
  }

  const rank = (g: Group): [number, number, number] => [
    g.items.some(isTeacherGroup) ? 0 : 1,
    g.episode ? (g.episode.overdueHours === null ? 1 : 0) : 2,
    Math.min(...g.items.map((item) => item.receivedAt.getTime()), Number.MAX_SAFE_INTEGER),
  ];

  return [...groups.values()].toSorted((a, b) => {
    const [x, y] = [rank(a), rank(b)];

    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
}

function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: "alarm" | "caution" | "muted" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
        tone === "alarm" && "bg-alarm-soft text-alarm",
        tone === "caution" && "bg-caution/15 text-[#8a6100]",
        tone === "muted" && "bg-cup text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

function KindBadge({ item }: { item: StaffReport }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase",
        item.kind === "health" ? "bg-alarm text-white" : "bg-cup text-ink-2",
      )}
    >
      {item.kind === "health" ? "Kesehatan" : "Menu"}
    </span>
  );
}

function ReportActions({ item, candidates = [] }: { item: StaffReport; candidates?: Candidate[] }) {
  if (item.status === "rejected" || item.duplicateOf !== null) return null;
  const target = { id: item.id, seen: item.status };
  const subject = `${item.schoolName} · ${what(item)}`;

  return (
    <div className="flex flex-wrap gap-2">
      {candidates.length > 0 && (
        <DialogAction
          trigger="Gabung duplikat"
          title={`Gabung duplikat #${item.id}`}
          description={`${subject}. Duplikat keluar dari hitungan sinyal.`}
          action={moderatorAction.bind(null, { kind: "merge", ...target })}
          label="Gabung"
        >
          <label className="grid w-full gap-1 text-sm">
            Laporan induk
            <select name="targetId" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                Pilih laporan induk
              </option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  #{candidate.id} · {episodeTime(candidate.at)}
                </option>
              ))}
            </select>
          </label>
        </DialogAction>
      )}
      <DialogAction
        trigger="Tolak"
        title={`Tolak laporan #${item.id}`}
        description={`${subject}. Alasan ini dibaca pelapor di Lacak.`}
        action={moderatorAction.bind(null, { kind: "reject", ...target })}
        label="Tolak laporan"
        danger
      >
        <NoteField label="Alasan penolakan" />
      </DialogAction>
    </div>
  );
}

/** One report as a compact row; details and the less common actions open in place. */
function ReportRow({ item, now }: { item: Item; now: Date }) {
  const teacher = isTeacherGroup(item);

  return (
    <article aria-label={`${item.schoolName} #${item.id}`} className="flex items-start gap-3 border-t px-4 py-3">
      <details className="group min-w-0 flex-1">
        <summary className="cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <KindBadge item={item} />
            <span className="truncate font-semibold">{item.schoolName}</span>
            <span className="shrink-0 text-xs text-ink-3">{ago(minutesSince(item.receivedAt, now))}</span>
            <CaretDownIcon
              aria-hidden="true"
              className="ml-auto size-3.5 shrink-0 text-ink-3 transition-transform duration-200 ease-out group-open:rotate-180"
            />
          </span>
          <span className="mt-0.5 block text-ink-2">
            {what(item)} · {ROLES[item.reporterRole]}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {teacher && <Chip tone="alarm">{item.affectedCount} terdampak · kelompok Guru/UKS</Chip>}
            {item.locationCheck === "outside" && <Chip tone="alarm">{LOCATION.outside}</Chip>}
            {item.surge && <Chip tone="caution">Lonjakan IP</Chip>}
            {item.repeated && <Chip tone="caution">Perangkat berulang</Chip>}
            {(item.candidates?.length ?? 0) > 0 && <Chip>Mungkin duplikat</Chip>}
            {item.duplicateOf !== null && <Chip>Duplikat #{item.duplicateOf}</Chip>}
          </span>
        </summary>
        <div className="mt-3 grid gap-3 rounded-lg bg-well p-3 text-sm">
          {item.note && <p className="break-words whitespace-pre-wrap">“{item.note}”</p>}
          <p className="text-ink-2">
            #{item.id} · makan {formatDayWIB(wibTime(item.consumedOn))} · masuk {episodeTime(item.receivedAt)} ·{" "}
            {LOCATION[item.locationCheck]}
            {item.affectedCount !== null && ` · ${item.affectedCount} terdampak`}
          </p>
          {item.rejectReason && <p className="break-words">Alasan penolakan · {item.rejectReason}</p>}
          <ReplyList replies={item.thread} />
          <ReportActions item={item} candidates={item.candidates ?? []} />
        </div>
      </details>
      {item.status === "received" && item.duplicateOf === null && (
        <DashboardForm
          action={moderatorAction.bind(null, { kind: "review", id: item.id, seen: item.status })}
          label="Tinjau"
          primary
        />
      )}
      {(item.status === "reviewed" || item.status === "responded") && (
        <DialogAction
          trigger="Selesai"
          title={`Selesaikan laporan #${item.id}`}
          description="Menutup tindak lanjut laporan tanpa penilaian keamanan makanan."
          action={moderatorAction.bind(null, { kind: "finish", id: item.id, seen: item.status })}
          label="Selesai"
        />
      )}
    </article>
  );
}

function EpisodeHeader({ episode, kitchenName }: { episode: OpenEpisode; kitchenName: string }) {
  const forward = moderatorAction.bind(null, {
    kind: "forward",
    id: episode.id,
    seen: episode.forwarding,
    seenNote: episode.forwardingNote ?? "",
  });

  return (
    <div className="mt-2 grid gap-2 text-sm">
      <p>
        <b className="text-alarm">Prioritas</b> · {episode.signal.reason}
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-ink-2">
        <span>{episode.signal.label}</span>
        <span>{FORWARDING[episode.forwarding]}</span>
        {episode.overdueHours !== null && (
          <span className="text-alarm">Dapur belum menjawab · {episode.overdueHours} jam</span>
        )}
      </p>
      {episode.forwardingNote && <p className="text-xs text-ink-2">Catatan penerusan: {episode.forwardingNote}</p>}
      <p className="flex flex-wrap gap-x-2 text-xs text-ink-2">
        Bukti:
        {episode.reports.map((row) => (
          <Link key={row.id} className="underline" href={`/dasbor?laporan=${row.id}`}>
            #{row.id}
          </Link>
        ))}
      </p>
      <div className="flex flex-wrap gap-2">
        <DialogAction
          key={`${episode.forwarding}-${episode.forwardingNote}`}
          trigger="Penerusan"
          title="Penerusan episode"
          description="Status ini mencatat proses penerusan. Aplikasi tidak mengirim pemberitahuan."
          action={forward}
          label="Simpan penerusan"
        >
          <label className="grid w-full gap-1 text-sm">
            Status penerusan
            <select name="forwarding" className={selectClass} defaultValue={episode.forwarding}>
              {Object.entries(FORWARDING).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <NoteField
            label="Catatan penerusan (wajib jika diteruskan oleh petugas)"
            required={false}
            value={episode.forwardingNote ?? ""}
          />
        </DialogAction>
        <DialogAction
          trigger="Tutup episode"
          title={`Tutup episode ${kitchenName}`}
          description="Status Prioritas dapur berakhir. Catatan ini tampil di riwayat episode Rapor."
          action={moderatorAction.bind(null, { kind: "close", id: episode.id })}
          label="Tutup episode"
          danger
        >
          <NoteField label="Catatan penutupan" />
        </DialogAction>
      </div>
    </div>
  );
}

function KitchenGroup({ group, now }: { group: Group; now: Date }) {
  const teacher = group.items.find(isTeacherGroup);

  return (
    <section
      aria-label={group.kitchenName}
      className={cn("surface overflow-hidden", (group.episode || teacher) && "ring-2 ring-alarm/30")}
    >
      <header className={cn("px-4 py-3", group.episode || teacher ? "bg-alarm-soft" : "bg-well")}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-extrabold">
            <Link href={`/sppg/${group.sppgId}`} className="hover:underline">
              {group.kitchenName}
            </Link>
          </h2>
          <span className="shrink-0 text-xs font-semibold text-ink-2">
            {group.items.length === 0 ? "Antrean bersih" : `${group.items.length} menunggu`}
          </span>
        </div>
        {teacher && (
          <p className="mt-1 text-sm font-semibold text-alarm">
            Tinjau untuk Prioritas · laporan kelompok Guru/UKS menunggu {ago(minutesSince(teacher.receivedAt, now))}
          </p>
        )}
        {group.episode ? (
          <EpisodeHeader episode={group.episode} kitchenName={group.kitchenName} />
        ) : (
          !teacher && <p className="mt-1 text-sm text-ink-2">Tidak ada episode Prioritas.</p>
        )}
      </header>
      {group.items.map((item) => (
        <ReportRow key={item.id} item={item} now={now} />
      ))}
    </section>
  );
}

function Summary({ stats }: { stats: [string, string, boolean][] }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map(([label, value, alarm]) => (
        <div key={label} className="surface rounded-[20px] px-4 py-3">
          <p className={cn("font-heading text-3xl font-extrabold", alarm && "text-alarm")}>{value}</p>
          <p className="text-xs font-medium text-ink-2">{label}</p>
        </div>
      ))}
    </div>
  );
}

export async function ModeratorDashboard({
  now,
  queuePage,
  followPage,
  reportId,
}: {
  now: Date;
  queuePage: number;
  followPage: number;
  reportId: number | undefined;
}) {
  const db = getDb();

  const [queue, followUp, episodes, surges, selected] = await Promise.all([
    getReviewQueue(db, queuePage),
    getFollowUp(db, followPage),
    getModeratorEpisodes(db, now),
    getSurges(db, now),
    reportId ? getStaffReport(db, reportId) : undefined,
  ]);

  const groups = groupByKitchen(queue.items, episodes.open);

  return (
    <>
      <DashboardHeader>Moderator</DashboardHeader>
      <Summary
        stats={[
          ["Menunggu tinjauan", more(queue.items.length, queue.hasMore), false],
          ["Episode Prioritas terbuka", String(episodes.open.length), episodes.open.length > 0],
          ["Lonjakan 24 jam", String(surges.length), false],
          ["Dalam tindak lanjut", more(followUp.items.length, followUp.hasMore), false],
        ]}
      />

      {reportId !== undefined && (
        <div className="mb-5">
          <Panel title={`Rincian laporan #${reportId}`}>
            {selected ? (
              <div className="-mx-4 -mb-4">
                <ReportRow item={selected} now={now} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Laporan tidak ditemukan.</p>
            )}
            <Link className="text-sm underline" href="/dasbor">
              Tutup rincian
            </Link>
          </Panel>
        </div>
      )}

      <section aria-label="Antrean tinjauan" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Antrean per dapur</h2>
          <span className="text-xs text-ink-3">Prioritas dan laporan Guru/UKS di atas</span>
        </div>
        {groups.length === 0 && (
          <p className="surface p-6 text-center text-sm text-muted-foreground">
            Tidak ada laporan yang menunggu tinjauan.
          </p>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <KitchenGroup key={group.sppgId} group={group} now={now} />
          ))}
        </div>
        <Pagination
          page={queuePage}
          hasMore={queue.hasMore}
          parameter="antrean"
          other={{ name: "tindak-lanjut", page: followPage }}
        />
      </section>

      <div className="mt-8 grid items-start gap-4 lg:grid-cols-3">
        <section aria-label="Dalam tindak lanjut" className="surface overflow-hidden lg:col-span-2">
          <h2 className="px-4 py-3 text-base font-semibold">Dalam tindak lanjut</h2>
          {followUp.items.length === 0 && (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">Tidak ada laporan di halaman ini.</p>
          )}
          {followUp.items.map((item) => (
            <ReportRow key={item.id} item={item} now={now} />
          ))}
          <div className="px-4 py-3">
            <Pagination
              page={followPage}
              hasMore={followUp.hasMore}
              parameter="tindak-lanjut"
              other={{ name: "antrean", page: queuePage }}
            />
          </div>
        </section>

        <div className="grid gap-4">
          <Panel title="Ditandai lonjakan">
            {surges.length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada lonjakan dalam 24 jam terakhir.</p>
            )}
            {surges.map((item) => (
              <div key={item.ids[0]} className="space-y-1 rounded-lg bg-well p-3 text-sm">
                <p className="font-medium">
                  {item.count} laporan · {item.schools.join(", ")}
                </p>
                <p className="text-muted-foreground">
                  {episodeTime(new Date(item.startAt))} – {episodeTime(new Date(item.endAt))}
                </p>
                <p className="flex flex-wrap gap-2">
                  {item.ids.map((id) => (
                    <Link key={id} className="underline" href={`/dasbor?laporan=${id}`}>
                      #{id}
                    </Link>
                  ))}
                </p>
              </div>
            ))}
          </Panel>
          {episodes.closed.length > 0 && (
            <Panel title="Episode terakhir ditutup">
              {episodes.closed.map((item) => (
                <div className="rounded-lg bg-well p-3 text-sm" key={item.id}>
                  <p className="font-medium">{item.kitchenName}</p>
                  {item.closedAt && <p className="text-muted-foreground">{episodeTime(item.closedAt)}</p>}
                  <p className="break-words">{item.note}</p>
                </div>
              ))}
            </Panel>
          )}
        </div>
      </div>

      {getEnv().DEMO_MODE && (
        <div className="mt-8 max-w-md">
          <Panel title="Reset data demo">
            <DashboardForm action={moderatorAction.bind(null, { kind: "reset" })} label="Reset data demo" danger>
              <label htmlFor="reset-confirmation" className="grid w-full gap-1 text-sm">
                Ketik RESET untuk mengembalikan data ke kondisi awal demo
                <Input id="reset-confirmation" name="confirmation" required autoComplete="off" />
              </label>
            </DashboardForm>
          </Panel>
        </div>
      )}
    </>
  );
}
