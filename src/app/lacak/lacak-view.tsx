"use client";

import {
  ChatCircleTextIcon,
  CheckIcon,
  CookingPotIcon,
  type Icon,
  PaperPlaneTiltIcon,
  StorefrontIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TrackedReport } from "@/db/reports";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";
import { useFieldErrors } from "@/lib/use-field-errors";
import { cn } from "@/lib/utils";
import { type LacakState, lacakAction } from "./actions";

/** The report form's success screen leaves the fresh code here for one read, so /lacak opens on it. */
export const LACAK_HANDOFF_KEY = "lacak-handoff";

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
  const codeId = useId();
  const { errors, formProps } = useFieldErrors();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let code: string | null = null;

    try {
      code = sessionStorage.getItem(LACAK_HANDOFF_KEY);
      sessionStorage.removeItem(LACAK_HANDOFF_KEY);
    } catch {
      // Storage blocked: the visitor types the code instead.
    }

    if (code && input.current) {
      input.current.value = code;
      form.current?.requestSubmit();
    }
  }, []);

  return (
    <>
      <form ref={form} action={action} {...formProps} className="mt-6">
        <Field data-invalid={errors.code !== undefined}>
          <FieldLabel htmlFor={codeId}>Kode lacak</FieldLabel>
          <Input
            ref={input}
            id={codeId}
            name="code"
            required
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXXX-XXXXX"
            className="h-14 rounded-2xl bg-card font-mono text-lg uppercase shadow-sm"
            aria-invalid={errors.code !== undefined}
          />
          <FieldError>{errors.code}</FieldError>
        </Field>
        <Button type="submit" disabled={pending} className="mt-3 h-14 w-full rounded-2xl text-base">
          {pending ? "Mencari…" : "Lacak"}
        </Button>
      </form>

      {state.status === "error" && (
        <Alert variant="destructive" className="mt-4">
          <WarningIcon aria-hidden="true" />
          <AlertDescription className="font-semibold text-destructive">{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "found" && <Status state={state} action={action} pending={pending} />}
    </>
  );
}

type Tone = "navy" | "calm" | "alarm";

type Message = {
  id: string;
  who: string;
  body: string;
  at: Date;
  fromKitchen: boolean;
  forEpisode: boolean;
  mine: boolean;
};

const STEPS = ["Terkirim", "Dicek moderator", "Dijawab dapur"];

/** One headline for "what is happening now", then what comes next. Copy follows docs/signals.md: reports count from arrival. */
type Headline = { tone: Tone; title: string; body: string; next: string };

function headline(report: TrackedReport, kitchenReply: Message | undefined, waitingHours: number | null): Headline {
  const kitchen = report.kitchenName;
  const waiting = waitingHours === null ? "" : ` Dapur belum menjawab · ${waitingHours} jam.`;

  if (report.status === "rejected")
    return {
      tone: "alarm",
      title: "Laporan ini tidak dihitung",
      body: report.rejectReason ? `Alasan moderator: ${report.rejectReason}` : "Moderator menolak laporan ini.",
      next: "Jika menurutmu keliru, kirim laporan baru dengan data yang benar.",
    };

  if (report.status === "closed")
    return {
      tone: "calm",
      title: "Tindak lanjut selesai",
      body: `Moderator menutup tindak lanjut laporan ini. Laporanmu tetap tercatat di Rapor ${kitchen}.`,
      next: "Masih ada keluhan? Tambahkan kabar di bawah atau kirim laporan baru.",
    };

  if (kitchenReply)
    return {
      tone: "calm",
      title: `${kitchen} sudah menjawab`,
      body: kitchenReply.forEpisode ? `Untuk semua laporan terkait: “${kitchenReply.body}”` : `“${kitchenReply.body}”`,
      next: "Masih ada keluhan? Tambahkan kabar di bawah.",
    };

  if (report.status === "reviewed" || report.status === "responded")
    return {
      tone: "navy",
      title: "Laporanmu sudah dicek",
      body: `Moderator sudah memeriksa laporanmu, dan laporan ini dihitung di Rapor ${kitchen}.${waiting}`,
      next: "Berikutnya: pengelola dapur diminta menjawab. Jawabannya tampil di sini dan di Rapor.",
    };

  return {
    tone: "navy",
    title: "Laporanmu sudah masuk",
    body: `Laporanmu ikut dihitung di Rapor ${kitchen}. Moderator sedang memastikan laporan asli dan tidak ganda.`,
    next: "Berikutnya: setelah dicek moderator, pengelola dapur diminta menjawab.",
  };
}

const TONE: Record<Tone, { hero: string; accent: string; node: string; Icon: Icon }> = {
  navy: { hero: "bg-[#e7eefb]", accent: "text-navy", node: "border-[#142a44] bg-navy", Icon: PaperPlaneTiltIcon },
  calm: { hero: "bg-calm-soft", accent: "text-calm", node: "border-[#1f5c3e] bg-calm", Icon: CookingPotIcon },
  alarm: { hero: "bg-alarm-soft", accent: "text-alarm", node: "border-[#7d221d] bg-alarm", Icon: WarningIcon },
};

const DETAIL_TINT = ["bg-alarm-soft", "bg-[#e7eefb]", "bg-[#fdf3dc]", "bg-calm-soft", "bg-well"];

function Status({
  state: { code, report, waitingHours, updateError },
  action,
  pending,
}: {
  state: Extract<LacakState, { status: "found" }>;
  action: (form: FormData) => void;
  pending: boolean;
}) {
  const updateId = useId();
  const { errors, formProps } = useFieldErrors();
  const error = errors.update ?? updateError;
  const who = { sppg: report.kitchenName, moderator: "Moderator", reporter: "Kamu" };

  const messages: Message[] = [
    ...report.responses.map((r) => ({
      id: `r${r.id}`,
      who: who[r.authorKind],
      body: r.body,
      at: r.createdAt,
      fromKitchen: r.authorKind === "sppg",
      forEpisode: false,
      mine: r.authorKind === "reporter",
    })),
    ...report.episodeReplies.map((r) => ({
      id: `e${r.id}`,
      who: `${report.kitchenName}, untuk semua laporan terkait`,
      body: r.body,
      at: r.createdAt,
      fromKitchen: true,
      forEpisode: true,
      mine: false,
    })),
  ].toSorted((a, b) => a.at.getTime() - b.at.getTime());

  const kitchenReply = messages.findLast((m) => m.fromKitchen);
  const h = headline(report, kitchenReply, waitingHours);
  const tone = TONE[h.tone];
  // Each step reflects this report alone: a kitchen reply to the episode does not mean a moderator checked it.
  const done = [true, report.status !== "received", kitchenReply !== undefined || report.status === "closed"];
  const current = done.indexOf(false);

  const [writing, setWriting] = useState(error !== null);

  return (
    <section aria-label="Laporan kamu" className="mt-6 grid gap-4">
      <div className={cn("rounded-[28px] p-5", tone.hero)}>
        <span className="grid size-14 place-items-center rounded-2xl bg-white shadow-sm">
          <tone.Icon weight="duotone" aria-hidden="true" className={cn("size-8", tone.accent)} />
        </span>
        <p className={cn("mt-3 text-sm font-extrabold", tone.accent)}>Status laporanmu</p>
        <h2 className="font-heading text-[26px] leading-tight font-black">{h.title}</h2>
        <p className="mt-3 rounded-2xl rounded-tl-md bg-white px-4 py-3 text-[15px] font-semibold break-words shadow-sm">
          {h.body}
        </p>
        <p className={cn("mt-3 text-sm font-bold", tone.accent)}>{h.next}</p>

        {report.status !== "rejected" && (
          <ol className="mt-5 flex items-start">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === current ? "step" : undefined}
                className="relative grid flex-1 justify-items-center gap-1.5 text-center"
              >
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-[18px] right-1/2 h-1 w-full rounded-full",
                      done[i] === true ? "bg-current opacity-40" : "bg-cup",
                      tone.accent,
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 grid size-10 place-items-center rounded-full border-b-4 text-sm font-black",
                    done[i] === true ? cn(tone.node, "text-white") : "border-cup bg-white text-ink-3",
                  )}
                >
                  {done[i] === true ? <CheckIcon weight="bold" aria-hidden="true" className="size-4" /> : i + 1}
                </span>
                <span className={cn("text-xs font-extrabold", done[i] === true ? tone.accent : "text-ink-3")}>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/sppg/${report.kitchenId}`}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 gap-2 rounded-2xl text-[15px]")}
        >
          <StorefrontIcon weight="duotone" aria-hidden="true" className="size-5" /> Rapor dapur
        </Link>
        <Button
          type="button"
          onClick={() => {
            setWriting((w) => !w);
          }}
          aria-expanded={writing}
          className="h-14 gap-2 rounded-2xl text-[15px]"
        >
          <ChatCircleTextIcon weight="fill" aria-hidden="true" className="size-5" /> Tambah kabar
        </Button>
      </div>

      {writing && (
        <form action={action} {...formProps} className="surface p-4">
          <input type="hidden" name="code" value={code} />
          <Field data-invalid={error !== null}>
            <FieldLabel htmlFor={updateId} className="font-extrabold">
              Tambahkan perkembangan
            </FieldLabel>
            <Textarea
              id={updateId}
              name="update"
              required
              maxLength={NOTE_MAX_CHARS}
              rows={3}
              placeholder="Contoh: anak saya sudah membaik, atau ada teman lain yang ikut sakit."
              aria-invalid={error !== null}
            />
            <FieldDescription>Hanya terlihat oleh kamu, moderator, dan pengelola dapur.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" disabled={pending} className="mt-3 h-12 w-full rounded-2xl text-base">
            Kirim perkembangan
          </Button>
        </form>
      )}

      {messages.length > 0 && (
        <div className="surface grid gap-3 p-4">
          <h3 className="px-1 font-heading text-lg font-black">Obrolan laporanmu</h3>
          <ol className="grid gap-3">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex items-end gap-2", m.mine && "flex-row-reverse")}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-xs font-black",
                    m.mine
                      ? "bg-navy text-white"
                      : m.fromKitchen
                        ? "bg-calm-soft text-calm"
                        : "bg-[#fdf3dc] text-[#8a6200]",
                  )}
                >
                  {m.mine ? "K" : m.fromKitchen ? "D" : "M"}
                </span>
                <div
                  className={cn(
                    "max-w-[80%] rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug font-semibold",
                    m.mine
                      ? "rounded-br-md bg-navy text-white"
                      : m.fromKitchen
                        ? "rounded-bl-md bg-calm-soft"
                        : "rounded-bl-md bg-well",
                  )}
                >
                  <span className="block text-[11px] font-extrabold opacity-70">
                    {m.who} · {when(m.at)}
                  </span>
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2.5">
        {(
          [
            ["Jenis", report.kind === "health" ? "Keluhan kesehatan" : "Penilaian menu"],
            ["Sekolah", report.schoolName],
            ["Tanggal makan", mealDay(report.consumedOn)],
            ["Dikirim", when(report.receivedAt)],
            ["Dapur", report.kitchenName],
          ] as const
        ).map(([k, v], i) => (
          <div key={k} className={cn("rounded-[20px] px-3.5 py-3 last:col-span-2", DETAIL_TINT[i])}>
            <dt className="text-xs font-bold text-ink-2">{k}</dt>
            <dd className="font-extrabold">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
