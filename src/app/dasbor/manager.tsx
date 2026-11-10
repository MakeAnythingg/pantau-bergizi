import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import { getManagerDashboard } from "@/db/staff";
import { formatDayWIB, formatTimeWIB, hoursSince, todayWIB, wibTime } from "@/lib/date";
import { STATUS_LABEL } from "@/lib/status";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";
import { cn } from "@/lib/utils";
import { managerAction } from "./actions";
import { DashboardForm } from "./dashboard-form";
import { DashboardHeader, NoteField, Pagination } from "./dashboard-layout";
import { PROBLEMS, ReplyList, ROLES, SYMPTOMS } from "./report-card";

type Dashboard = Awaited<ReturnType<typeof getManagerDashboard>>;

const STATUS_TONE = {
  priority: "bg-alarm text-white",
  attention: "bg-caution text-ink",
  no_signal: "bg-calm text-white",
  no_data: "bg-cup text-ink",
};

const at = (d: Date) => `${formatDayWIB(d)} ${formatTimeWIB(d)} WIB`;

/** One numbered step. Finished steps fold to a one-line summary with a check; `more` keeps them editable. */
function Task({
  n,
  title,
  done,
  urgent,
  summary,
  more,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  urgent?: string | undefined;
  summary?: ReactNode;
  more?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("surface overflow-hidden", urgent && "ring-2 ring-alarm/30")}>
      <header className="flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold",
            done ? "bg-calm text-white" : urgent ? "bg-alarm text-white" : "bg-cup text-ink-2",
          )}
        >
          {done ? <CheckIcon weight="bold" /> : n}
        </span>
        <h2 className={cn("flex-1 font-semibold", done && "text-ink-3")}>
          {title}
          {done && <span className="sr-only"> (selesai)</span>}
        </h2>
        {urgent && <span className="text-xs font-bold text-alarm">{urgent}</span>}
      </header>
      {done ? (
        <div className="grid gap-2 border-t px-4 py-3 text-sm text-ink-2">
          {summary}
          {more}
        </div>
      ) : (
        <div className="grid gap-3 border-t px-4 py-4">{children}</div>
      )}
    </section>
  );
}

function MenuFields({ menu }: { menu: Dashboard["todayMenu"] }) {
  return (
    <>
      <label htmlFor="menu-name" className="grid w-full gap-1 text-sm font-medium">
        Nama menu
        <Input id="menu-name" name="name" required maxLength={NOTE_MAX_CHARS} defaultValue={menu?.name} />
      </label>
      <label htmlFor="menu-composition" className="grid w-full gap-1 text-sm font-medium">
        Komposisi
        <Textarea
          id="menu-composition"
          name="composition"
          required
          maxLength={NOTE_MAX_CHARS}
          rows={2}
          defaultValue={menu?.composition}
        />
      </label>
    </>
  );
}

function what(item: Dashboard["items"][number]) {
  const parts =
    item.kind === "health"
      ? item.symptoms.map((symptom) => SYMPTOMS[symptom])
      : [
          ...(item.rating === null ? [] : [`Nilai ${item.rating}`]),
          ...item.problems.filter((p) => p !== "none").map((p) => PROBLEMS[p]),
        ];

  return parts.join(" · ") || (item.kind === "health" ? "Keluhan kesehatan" : "Penilaian menu");
}

export async function ManagerDashboard({ now, sppgId, page }: { now: Date; sppgId: number; page: number }) {
  const { kitchen, signal, open, replies, todayMenu, unreviewed, items, hasMore } = await getManagerDashboard(
    getDb(),
    sppgId,
    now,
    page,
  );

  const servedOn = todayWIB(now);
  const lastReply = replies.at(-1);
  const menuAction = managerAction.bind(null, { kind: "menu", id: sppgId, servedOn });
  const steps = [open ? "episode" : null, "menu", "reports"].filter((s) => s !== null);
  const number = (step: string) => steps.indexOf(step) + 1;
  const allDone = (!open || replies.length > 0) && todayMenu !== undefined && items.length === 0 && page === 1;

  return (
    <div className="mx-auto grid max-w-2xl gap-3">
      <DashboardHeader>Pengelola SPPG · {kitchen?.name ?? "—"}</DashboardHeader>

      <section aria-label="Status dapur" className={cn("rounded-2xl px-5 py-4", STATUS_TONE[signal.status])}>
        <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Status dapur di Rapor publik</p>
        <p className="font-heading text-2xl font-extrabold">{STATUS_LABEL[signal.status]}</p>
        <p className="mt-1 text-sm opacity-90">{signal.reason}</p>
        {lastReply && (
          <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-sm">
            <b className="block text-xs opacity-80">Tanggapan Anda di Rapor · {at(lastReply.createdAt)}</b>
            {lastReply.body}
          </p>
        )}
        <Link href={`/sppg/${sppgId}`} className="mt-3 inline-block text-sm font-semibold underline">
          Lihat Rapor publik
        </Link>
      </section>

      <p className="px-1 pt-2 text-sm font-semibold text-ink-2">
        {allDone ? "Semua beres untuk hari ini." : "Yang perlu Anda lakukan hari ini"}
      </p>

      {open && (
        <Task
          n={number("episode")}
          title="Jawab episode Prioritas"
          done={replies.length > 0}
          urgent={open.overdueHours === null ? undefined : `Terlambat · ${open.overdueHours} jam`}
          summary={<p>Jawaban Anda tampil di Rapor publik dan dibaca semua pelapor di Lacak.</p>}
          more={
            <details>
              <summary className="cursor-pointer font-semibold text-navy">Tambah tanggapan</summary>
              <div className="mt-3 grid gap-3">
                <ReplyList replies={replies} />
                <DashboardForm
                  action={managerAction.bind(null, { kind: "episode", id: open.id })}
                  label="Kirim tanggapan episode"
                  primary
                >
                  <NoteField label="Tanggapan episode" />
                </DashboardForm>
              </div>
            </details>
          }
        >
          {open.overdueHours !== null && (
            <p className="text-sm font-semibold text-alarm">
              Saat ini Rapor publik menampilkan: Dapur belum menjawab · {open.overdueHours} jam.
            </p>
          )}
          <p className="text-sm text-ink-2">
            Jelaskan apa yang sudah dapur lakukan. Jawaban ini dibaca semua orang di Rapor dan oleh pelapor di Lacak.
          </p>
          <DashboardForm
            action={managerAction.bind(null, { kind: "episode", id: open.id })}
            label="Kirim tanggapan episode"
            primary
          >
            <NoteField label="Tanggapan episode" />
          </DashboardForm>
        </Task>
      )}

      <Task
        n={number("menu")}
        title="Menu hari ini"
        done={todayMenu !== undefined}
        summary={
          todayMenu && (
            <p>
              <b className="text-ink">{todayMenu.name}</b> · {todayMenu.composition}
            </p>
          )
        }
        more={
          <details>
            <summary className="cursor-pointer font-semibold text-navy">Ubah menu</summary>
            <div className="mt-3">
              <DashboardForm action={menuAction} label="Simpan menu">
                <MenuFields menu={todayMenu} />
              </DashboardForm>
            </div>
          </details>
        }
      >
        <p className="text-sm text-ink-2">
          Menu tampil di halaman sekolah dan Rapor, agar pelapor menilai menu yang benar.
        </p>
        <DashboardForm action={menuAction} label="Simpan menu" primary>
          <MenuFields menu={todayMenu} />
        </DashboardForm>
      </Task>

      <Task
        n={number("reports")}
        title={items.length > 0 ? `Tanggapi ${items.length}${hasMore ? "+" : ""} laporan` : "Tanggapi laporan"}
        done={items.length === 0 && page === 1}
        summary={<p>Tidak ada laporan yang menunggu tanggapan Anda.</p>}
      >
        <p className="text-sm text-ink-2">Tanggapan laporan hanya dibaca pelapornya di Lacak.</p>
        <ol className="grid gap-3">
          {items.map((item) => {
            const update = item.thread.findLast((reply) => reply.authorKind === "reporter");
            const hours = hoursSince(update?.createdAt ?? item.receivedAt, now);

            return (
              <li key={item.id}>
                <article aria-label={`${item.schoolName} #${item.id}`} className="grid gap-3 rounded-xl bg-well p-3.5">
                  <div className="text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase",
                          item.kind === "health" ? "bg-alarm text-white" : "bg-cup text-ink-2",
                        )}
                      >
                        {item.kind === "health" ? "Kesehatan" : "Menu"}
                      </span>
                      <b>{item.schoolName}</b>
                      <span className="text-xs text-ink-3">
                        makan {formatDayWIB(wibTime(item.consumedOn))} · #{item.id}
                      </span>
                    </p>
                    <p className="mt-0.5 text-ink-2">
                      {what(item)} · {ROLES[item.reporterRole]}
                    </p>
                    {item.note && <p className="mt-1 break-words whitespace-pre-wrap">“{item.note}”</p>}
                  </div>
                  <ReplyList replies={item.thread} />
                  <p className={cn("text-xs font-semibold", hours >= 24 ? "text-alarm" : "text-ink-2")}>
                    {update ? "Ada perkembangan baru" : "Menunggu tanggapan"} · {hours} jam
                  </p>
                  <DashboardForm
                    action={managerAction.bind(null, { kind: "report", id: item.id, seen: item.status })}
                    label="Kirim tanggapan laporan"
                    primary
                  >
                    <NoteField label="Tanggapan laporan" />
                  </DashboardForm>
                </article>
              </li>
            );
          })}
        </ol>
        <Pagination page={page} hasMore={hasMore} parameter="menunggu" />
      </Task>

      <p className="px-1 pt-1 text-xs text-ink-3">
        {unreviewed} laporan lain sedang dicek moderator. Yang perlu tanggapan Anda akan muncul di daftar ini.
      </p>
    </div>
  );
}
