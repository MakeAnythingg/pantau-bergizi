"use client";

import { HandWavingIcon, PhoneIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { STATUS_SWATCH } from "@/components/tray";
import { STATUS_LABEL, STATUSES } from "@/lib/status";
import {
  PRIORITY_MIN_HEALTH_REPORTS,
  PRIORITY_MIN_INSIDE,
  PRIORITY_MIN_SCHOOLS,
  RESPONSE_OVERDUE_HOURS,
  SIGNAL_WINDOW_HOURS,
} from "@/lib/thresholds";
import { cn } from "@/lib/utils";

const SHORT = {
  priority: "perlu diperiksa duluan",
  attention: "ada keluhan, belum cukup untuk Prioritas",
  no_signal: "ada laporan, tidak ada pola keluhan",
  no_data: "belum ada laporan",
};

const QA: { q: string; a: ReactNode[] }[] = [
  {
    q: "Warna di Rapor artinya apa?",
    a: [
      "Ada 4 warna. Makin merah, makin perlu dicek duluan.",
      <ul key="warna" className="grid gap-1.5">
        {STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", STATUS_SWATCH[s])} />
            <span>
              <b>{STATUS_LABEL[s]}</b>: {SHORT[s]}
            </span>
          </li>
        ))}
      </ul>,
      "Tidak ada sinyal bukan berarti makanan pasti aman.",
    ],
  },
  {
    q: "Kapan dapur jadi Prioritas?",
    a: [
      `Kalau dalam ${SIGNAL_WINDOW_HOURS} jam terakhir ada:`,
      <span key="aturan" className="flex flex-wrap gap-1.5">
        {[
          `≥${PRIORITY_MIN_HEALTH_REPORTS} keluhan kesehatan`,
          `dari ≥${PRIORITY_MIN_SCHOOLS} sekolah`,
          `≥${PRIORITY_MIN_INSIDE} dikirim dari area sekolah`,
        ].map((part) => (
          <span key={part} className="rounded-full bg-alarm px-2.5 py-1 text-xs font-bold text-white">
            {part}
          </span>
        ))}
      </span>,
      "Atau guru/UKS melaporkan banyak siswa sakit, dan moderator sudah mengecek.",
    ],
  },
  {
    q: "Prioritas berarti makanannya beracun?",
    a: ["Belum tentu. Prioritas artinya dapur perlu diperiksa duluan. Kami tidak melakukan uji lab."],
  },
  {
    q: "Nama saya disimpan?",
    a: ["Tidak. Kami tidak meminta nama, nomor HP, atau foto, dan tidak menyimpan titik lokasimu."],
  },
  {
    q: "Dapur bisa menjawab?",
    a: [
      `Bisa, dan harus. Jawabannya tampil di Rapor. Lewat ${RESPONSE_OVERDUE_HOURS} jam tanpa jawaban, Rapor menulis “Dapur belum menjawab”.`,
    ],
  },
  {
    q: "Bagaimana dengan laporan palsu?",
    a: ["Moderator mengecek laporan, menolak yang palsu, dan menggabungkan yang ganda. Yang ditolak tidak dihitung."],
  },
];

type Line = { id: number; mine: boolean; body: ReactNode };

/** Metode as a guided chat: fixed questions as buttons, each answered in a few short bubbles. */
export function TanyaPantau() {
  const [lines, setLines] = useState<Line[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (lines.length > 0) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  const line = (mine: boolean, body: ReactNode): Line => {
    nextId.current += 1;

    return { id: nextId.current, mine, body };
  };

  const ask = (q: string, a: ReactNode[]) => {
    setAsked((x) => [...x, q]);
    setLines((x) => [...x, line(true, q), ...a.map((body) => line(false, body))]);
  };

  const left = QA.filter((x) => !asked.includes(x.q));

  return (
    <div className="grid gap-4">
      <div role="log" aria-label="Tanya Pantau" className="grid gap-2.5 rounded-[32px] bg-card p-4 shadow-sm sm:p-5">
        <Bubble>
          <HandWavingIcon weight="duotone" className="mb-1 size-7 text-caution" />
          <b className="block text-base">Hai! Aku Pantau.</b>
          Aku merangkum laporan warga tentang Makan Bergizi Gratis di sekolah. Pilih pertanyaan di bawah.
        </Bubble>
        <Bubble>
          <span className="flex flex-wrap items-center gap-2">
            Ada yang sakit sekarang? Hubungi UKS, Puskesmas, atau
            <a
              href="tel:119"
              className="inline-flex items-center gap-1.5 rounded-full bg-alarm px-3 py-1.5 text-sm font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <PhoneIcon weight="fill" aria-hidden="true" />
              119
            </a>
          </span>
        </Bubble>
        {lines.map((l) => (
          <Bubble key={l.id} mine={l.mine}>
            {l.body}
          </Bubble>
        ))}
        <div ref={end} />
      </div>

      {left.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {left.map(({ q, a }) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                ask(q, a);
              }}
              className="rounded-full border-2 border-navy/15 bg-card px-4 py-2 text-sm font-semibold text-navy transition-[transform,background-color] duration-150 ease-out hover:bg-well active:scale-[0.97]"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Bubble({ mine = false, children }: { mine?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[85%] animate-in rounded-[22px] px-4 py-3 text-[15px] leading-snug duration-200 ease-out fade-in slide-in-from-bottom-1 motion-reduce:animate-none",
        mine ? "ml-auto rounded-br-md bg-navy text-white" : "rounded-bl-md bg-well text-ink",
      )}
    >
      {children}
    </div>
  );
}
