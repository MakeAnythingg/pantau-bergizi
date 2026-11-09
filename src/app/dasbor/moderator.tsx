import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import { getEnv } from "@/lib/env";
import { moderatorAction } from "./actions";
import { DashboardForm } from "./dashboard-form";
import { DashboardHeader, NoteField, Pagination, Panel } from "./dashboard-layout";
import { ReportCard } from "./report-card";

type Candidate = NonNullable<Awaited<ReturnType<typeof getStaffReport>>>["candidates"][number];

type OpenEpisode = Awaited<ReturnType<typeof getModeratorEpisodes>>["open"][number];

const FORWARDING = {
  none: "Belum diteruskan",
  simulated_puskesmas: "Simulasi Puskesmas",
  forwarded_by_officer: "Diteruskan oleh petugas",
};

const selectClass = "w-full min-w-0 rounded-md border border-input bg-background p-2 text-sm";

function ReportActions({ item, candidates = [] }: { item: StaffReport; candidates?: Candidate[] }) {
  if (item.status === "rejected" || item.duplicateOf !== null) return null;
  const target = { id: item.id, seen: item.status };

  return (
    <div className="grid gap-3 border-t pt-3">
      {item.status === "received" && (
        <DashboardForm action={moderatorAction.bind(null, { kind: "review", ...target })} label="Tinjau" />
      )}
      {(item.status === "reviewed" || item.status === "responded") && (
        <DashboardForm action={moderatorAction.bind(null, { kind: "finish", ...target })} label="Selesai">
          <p className="text-xs text-muted-foreground">
            Menutup tindak lanjut laporan tanpa penilaian keamanan makanan.
          </p>
        </DashboardForm>
      )}
      <details className="space-y-2">
        <summary className="cursor-pointer text-sm font-medium">Tolak laporan</summary>
        <DashboardForm action={moderatorAction.bind(null, { kind: "reject", ...target })} label="Tolak" danger>
          <NoteField label="Alasan penolakan" />
        </DashboardForm>
      </details>
      {candidates.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-medium">Gabung duplikat</summary>
          <DashboardForm action={moderatorAction.bind(null, { kind: "merge", ...target })} label="Gabung duplikat">
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
          </DashboardForm>
        </details>
      )}
    </div>
  );
}

function ReportLink({ id, children }: { id: number; children: string }) {
  return (
    <Link className="underline" href={`/dasbor?laporan=${id}`}>
      {children}
    </Link>
  );
}

function EpisodeCard({ item }: { item: OpenEpisode }) {
  const forward = moderatorAction.bind(null, {
    kind: "forward",
    id: item.id,
    seen: item.forwarding,
    seenNote: item.forwardingNote ?? "",
  });

  return (
    <article className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">{item.kitchenName}</h3>
      <p className="text-sm">{item.signal.reason}</p>
      <Badge variant="secondary">{item.signal.label}</Badge>
      {item.overdueHours !== null && (
        <p className="text-sm font-semibold text-alarm">Dapur belum menjawab · {item.overdueHours} jam</p>
      )}
      <ul className="space-y-1 text-sm">
        {item.reports.map((row) => (
          <li key={row.id}>
            <ReportLink id={row.id}>{`${row.schoolName} · #${row.id}`}</ReportLink>
          </li>
        ))}
      </ul>
      <div className="border-t pt-3">
        <p className="mb-2 text-sm font-medium">{FORWARDING[item.forwarding]}</p>
        <DashboardForm key={`${item.forwarding}-${item.forwardingNote}`} action={forward} label="Simpan penerusan">
          <label className="grid w-full gap-1 text-sm">
            Status penerusan
            <select name="forwarding" className={selectClass} defaultValue={item.forwarding}>
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
            value={item.forwardingNote ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Status ini mencatat proses penerusan. Aplikasi tidak mengirim pemberitahuan.
          </p>
        </DashboardForm>
      </div>
      <div className="border-t pt-3">
        <DashboardForm action={moderatorAction.bind(null, { kind: "close", id: item.id })} label="Tutup episode" danger>
          <NoteField label="Catatan penutupan" />
        </DashboardForm>
      </div>
    </article>
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

  return (
    <>
      <DashboardHeader>Moderator</DashboardHeader>
      {reportId !== undefined && (
        <div className="mb-4">
          <Panel title={`Rincian laporan #${reportId}`}>
            {selected ? (
              <ReportCard item={selected} now={now}>
                <ReportActions item={selected} candidates={selected.candidates} />
              </ReportCard>
            ) : (
              <p className="text-sm text-muted-foreground">Laporan tidak ditemukan.</p>
            )}
            <Link className="text-sm underline" href="/dasbor">
              Kembali ke dasbor
            </Link>
          </Panel>
        </div>
      )}
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 gap-4">
          <Panel title="Antrean tinjauan">
            {queue.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada laporan di halaman ini.</p>
            )}
            {queue.items.map((item) => (
              <ReportCard key={item.id} item={item} now={now} flags={item} reviewTimer>
                <ReportActions item={item} candidates={item.candidates} />
              </ReportCard>
            ))}
            <Pagination
              page={queuePage}
              hasMore={queue.hasMore}
              parameter="antrean"
              other={{ name: "tindak-lanjut", page: followPage }}
            />
          </Panel>
          <Panel title="Dalam tindak lanjut">
            {followUp.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada laporan di halaman ini.</p>
            )}
            {followUp.items.map((item) => (
              <ReportCard key={item.id} item={item} now={now}>
                <ReportActions item={item} />
              </ReportCard>
            ))}
            <Pagination
              page={followPage}
              hasMore={followUp.hasMore}
              parameter="tindak-lanjut"
              other={{ name: "antrean", page: queuePage }}
            />
          </Panel>
        </div>
        <div className="grid min-w-0 gap-4">
          <Panel title="Episode Prioritas">
            {episodes.open.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada episode terbuka.</p>}
            {episodes.open.map((item) => (
              <EpisodeCard key={item.id} item={item} />
            ))}
            {episodes.closed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Terakhir ditutup</h3>
                {episodes.closed.map((item) => (
                  <div className="rounded-md bg-muted p-3 text-sm" key={item.id}>
                    <p className="font-medium">
                      {item.kitchenName} · #{item.id}
                    </p>
                    {item.closedAt && <p className="text-muted-foreground">{episodeTime(item.closedAt)}</p>}
                    <p className="break-words">{item.note}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Ditandai lonjakan">
            {surges.length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada lonjakan dalam 24 jam terakhir.</p>
            )}
            {surges.map((item) => (
              <div key={item.ids[0]} className="space-y-1 rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {item.count} laporan · {item.schools.join(", ")}
                </p>
                <p className="text-muted-foreground">
                  {episodeTime(new Date(item.startAt))} – {episodeTime(new Date(item.endAt))}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.ids.map((id) => (
                    <ReportLink key={id} id={id}>{`#${id}`}</ReportLink>
                  ))}
                </div>
              </div>
            ))}
          </Panel>
          {getEnv().DEMO_MODE && (
            <Panel title="Reset data demo">
              <DashboardForm action={moderatorAction.bind(null, { kind: "reset" })} label="Reset data demo" danger>
                <label htmlFor="reset-confirmation" className="grid w-full gap-1 text-sm">
                  Ketik RESET untuk mengembalikan data ke kondisi awal demo
                  <Input id="reset-confirmation" name="confirmation" required autoComplete="off" />
                </label>
              </DashboardForm>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
