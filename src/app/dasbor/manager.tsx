import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import { getManagerDashboard } from "@/db/staff";
import { hoursSince, todayWIB } from "@/lib/date";
import { STATUS_LABEL } from "@/lib/status";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";
import { managerAction } from "./actions";
import { DashboardForm } from "./dashboard-form";
import { DashboardHeader, NoteField, Pagination, Panel } from "./dashboard-layout";
import { ReplyList, ReportCard } from "./report-card";

export async function ManagerDashboard({ now, sppgId, page }: { now: Date; sppgId: number; page: number }) {
  const { kitchen, signal, open, replies, todayMenu, unreviewed, items, hasMore } = await getManagerDashboard(
    getDb(),
    sppgId,
    now,
    page,
  );

  const servedOn = todayWIB(now);

  return (
    <>
      <DashboardHeader>Pengelola SPPG · {kitchen?.name ?? "—"}</DashboardHeader>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Menunggu tanggapan">
          <p className="text-sm text-muted-foreground">{unreviewed} laporan menunggu tinjauan moderator</p>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Tidak ada laporan yang menunggu tanggapan di halaman ini.</p>
          )}
          {items.map((item) => {
            const update = item.thread.findLast((reply) => reply.authorKind === "reporter");
            const action = managerAction.bind(null, { kind: "report", id: item.id, seen: item.status });

            return (
              <ReportCard key={item.id} item={item} now={now}>
                <p className="text-sm font-semibold">
                  {update ? "Ada perkembangan baru" : "Menunggu tanggapan"} ·{" "}
                  {hoursSince(update?.createdAt ?? item.receivedAt, now)} jam
                </p>
                <DashboardForm action={action} label="Kirim tanggapan laporan">
                  <NoteField label="Tanggapan laporan" />
                </DashboardForm>
              </ReportCard>
            );
          })}
          <Pagination page={page} hasMore={hasMore} parameter="menunggu" />
        </Panel>
        <div className="grid min-w-0 gap-4">
          <Panel title="Status dapur">
            <Badge variant={signal.status === "priority" ? "destructive" : "secondary"}>
              {STATUS_LABEL[signal.status]}
            </Badge>
            <p className="text-sm">{signal.reason}</p>
            {open && (
              <div className="grid gap-3 border-t pt-3">
                <h3 className="text-sm font-semibold">Episode Prioritas</h3>
                {open.overdueHours !== null && (
                  <p className="text-sm font-semibold text-alarm">Dapur belum menjawab · {open.overdueHours} jam</p>
                )}
                <ReplyList replies={replies} />
                <DashboardForm
                  action={managerAction.bind(null, { kind: "episode", id: open.id })}
                  label="Kirim tanggapan episode"
                >
                  <NoteField label="Tanggapan episode" />
                  <p className="text-xs text-muted-foreground">
                    Tanggapan ini tampil di Rapor dan dapat dibaca pelapor di Lacak.
                  </p>
                </DashboardForm>
              </div>
            )}
          </Panel>
          <Panel title="Menu hari ini">
            <DashboardForm
              action={managerAction.bind(null, { kind: "menu", id: sppgId, servedOn })}
              label="Simpan menu"
            >
              <label htmlFor="menu-name" className="grid w-full gap-1 text-sm">
                Nama menu
                <Input id="menu-name" name="name" required maxLength={NOTE_MAX_CHARS} defaultValue={todayMenu?.name} />
              </label>
              <label htmlFor="menu-composition" className="grid w-full gap-1 text-sm">
                Komposisi
                <Textarea
                  id="menu-composition"
                  name="composition"
                  required
                  maxLength={NOTE_MAX_CHARS}
                  defaultValue={todayMenu?.composition}
                />
              </label>
            </DashboardForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
