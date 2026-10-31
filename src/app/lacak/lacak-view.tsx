"use client";

import { useActionState } from "react";
import type { TrackedReport } from "@/db/reports";
import { type LacakState, lacakAction } from "./actions";

const STATUS: Record<TrackedReport["status"], string> = {
  received: "Diterima, menunggu tinjauan moderator",
  reviewed: "Sudah ditinjau moderator",
  responded: "Sudah ditanggapi",
  closed: "Selesai",
  rejected: "Ditolak",
};

const AUTHOR: Record<TrackedReport["responses"][number]["authorKind"], string> = {
  sppg: "Tanggapan pengelola",
  moderator: "Moderator",
  reporter: "Perkembangan dari kamu",
};

const field = "w-full rounded-xl bg-white px-3.5 text-[15px] shadow-[0_0_0_1px_rgb(24_36_44/0.08)]";
const primary = "min-h-12 w-full rounded-xl bg-navy px-4 font-bold text-white disabled:opacity-60";

const when = (d: Date) =>
  d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const mealDay = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" });

export function LacakView() {
  const [state, action, pending] = useActionState<LacakState, FormData>(lacakAction, { status: "idle" });

  return (
    <>
      <form action={action} className="mt-6">
        <label className="block">
          <span className="mb-2 block text-[15px] font-bold">Kode lacak</span>
          <input
            name="code"
            required
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXXX-XXXXX"
            className={`${field} min-h-12 font-mono text-lg uppercase`}
          />
        </label>
        <button type="submit" disabled={pending} className={`${primary} mt-3`}>
          {pending ? "Mencari…" : "Lacak"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="alert" className="mt-4 rounded-xl bg-alarm-soft px-4 py-3 text-sm font-semibold text-alarm">
          {state.message}
        </p>
      )}

      {state.status === "found" && <Thread state={state} action={action} pending={pending} />}
    </>
  );
}

function Thread({
  state: { code, report, updateError },
  action,
  pending,
}: {
  state: Extract<LacakState, { status: "found" }>;
  action: (form: FormData) => void;
  pending: boolean;
}) {
  return (
    <section aria-label="Laporan kamu" className="well mt-6">
      <p className="text-sm font-semibold text-ink-3">
        {report.kind === "health" ? "Keluhan kesehatan" : "Penilaian menu"} · {report.schoolName}
      </p>
      <p className="mt-1 text-sm text-ink-2">Tanggal makan {mealDay(report.consumedOn)}</p>
      <p className="mt-3 text-lg font-bold">{STATUS[report.status]}</p>
      {report.status === "rejected" && report.rejectReason && (
        <p className="text-sm text-ink-2">Alasan: {report.rejectReason}</p>
      )}

      <ol className="mt-4 grid gap-2.5">
        {report.responses.map((r) => (
          <li key={r.id} className="rounded-xl bg-white px-3.5 py-2.5 text-sm">
            <b className="block text-xs text-ink-3">
              {AUTHOR[r.authorKind]}, {when(r.createdAt)}
            </b>
            {r.body}
          </li>
        ))}
      </ol>
      {report.responses.length === 0 && <p className="mt-2 text-sm text-ink-3">Belum ada tanggapan.</p>}

      <form action={action} className="mt-5">
        <input type="hidden" name="code" value={code} />
        <label className="block">
          <span className="mb-2 block text-[15px] font-bold">Tambahkan perkembangan</span>
          <textarea name="update" required maxLength={300} rows={3} className={`${field} py-2.5`} />
        </label>
        <p className="mt-1 text-xs text-ink-3">
          Hanya terlihat oleh kamu, moderator, dan pengelola dapur. Tidak tampil di halaman publik.
        </p>
        {updateError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-alarm">
            {updateError}
          </p>
        )}
        <button type="submit" disabled={pending} className={`${primary} mt-3`}>
          Kirim perkembangan
        </button>
      </form>
    </section>
  );
}
