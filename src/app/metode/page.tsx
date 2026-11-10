import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_SWATCH } from "@/components/tray";
import { NATIONAL_FIGURES } from "@/content/national";
import { type Status, STATUS_LABEL } from "@/lib/status";
import {
  LEFTOVER_MIN_REPORTS,
  LEFTOVER_WINDOW_DAYS,
  LOCATION_RADIUS_METERS,
  LOW_RATING_MIN_REPORTS,
  LOW_RATING_THRESHOLD,
  PRIORITY_MIN_HEALTH_REPORTS,
  PRIORITY_MIN_INSIDE,
  PRIORITY_MIN_SCHOOLS,
  REPORT_IP_LIMIT,
  RESPONSE_OVERDUE_HOURS,
  SIGNAL_WINDOW_HOURS,
  TEACHER_GROUP_MIN_AFFECTED,
} from "@/lib/thresholds";
import { cn } from "@/lib/utils";
import { TanyaPantau } from "./tanya-pantau";

export const metadata: Metadata = { title: "Metode | Pantau Bergizi" };

const linkClass = "font-semibold text-navy underline underline-offset-4";

/** Checked top to bottom; the first rule that holds sets the status. */
const RULES: [Status, string][] = [
  [
    "priority",
    `≥${PRIORITY_MIN_HEALTH_REPORTS} keluhan kesehatan dari ≥${PRIORITY_MIN_SCHOOLS} sekolah, ≥${PRIORITY_MIN_INSIDE} dikirim dari area sekolah. Otomatis.`,
  ],
  [
    "priority",
    `Laporan kelompok Guru/UKS dengan perkiraan ≥${TEACHER_GROUP_MIN_AFFECTED} orang terdampak, setelah ditinjau moderator.`,
  ],
  ["attention", "Ada keluhan kesehatan, tetapi syarat Prioritas belum terpenuhi."],
  ["attention", "Laporan makanan basi atau benda asing dari area sekolah, atau yang sudah ditinjau moderator."],
  ["attention", `Rata-rata nilai menu di bawah ${LOW_RATING_THRESHOLD} dari ≥${LOW_RATING_MIN_REPORTS} laporan.`],
  ["no_signal", "Ada laporan, tetapi tidak ada aturan di atas yang terpenuhi."],
  ["no_data", `Tidak ada laporan yang dihitung dalam ${SIGNAL_WINDOW_HOURS} jam.`],
];

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="font-heading text-lg font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  );
}

export default function MetodePage() {
  return (
    <main className="mx-auto grid w-full max-w-lg flex-1 content-start gap-5 px-4 pt-2 pb-14">
      <header>
        <h1 className="font-heading text-[32px] leading-[1.05] font-extrabold tracking-tight">Metode</h1>
        <p className="mt-1.5 text-ink-2">Cara Pantau Bergizi membaca laporan warga, dalam beberapa pertanyaan.</p>
      </header>

      <TanyaPantau />

      <details className="group rounded-[24px] bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex-1">
            <b className="block">Aturan lengkap</b>
            <span className="text-sm text-ink-2">Untuk jurnalis, peneliti, dan juri</span>
          </span>
          <CaretDownIcon className="size-5 text-ink-3 transition-transform duration-200 ease-out group-open:rotate-180" />
        </summary>

        <div className="grid gap-6 border-t px-5 py-5 text-sm leading-relaxed text-ink-2">
          <Part title="Aturan status">
            <p>
              Dihitung dari laporan yang diterima dalam {SIGNAL_WINDOW_HOURS} jam terakhir, untuk makanan hari ini atau
              kemarin (WIB). Laporan semua sekolah yang dilayani satu dapur dibaca bersama. Aturan diperiksa dari atas;
              yang pertama terpenuhi menentukan status.
            </p>
            <ol className="grid gap-2">
              {RULES.map(([status, rule]) => (
                <li key={rule} className="rounded-xl bg-well px-3 py-2.5">
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <span aria-hidden="true" className={cn("size-2.5 rounded-full", STATUS_SWATCH[status])} />
                    {STATUS_LABEL[status]}
                  </span>
                  {rule}
                </li>
              ))}
            </ol>
            <p>
              Nilai menu dan sisa makanan hanya mengukur mutu dan tidak pernah memicu Prioritas. Persentase “sisa
              banyak” tampil bila ada ≥{LEFTOVER_MIN_REPORTS} jawaban tentang sisa makanan dalam {LEFTOVER_WINDOW_DAYS}{" "}
              hari.
            </p>
          </Part>

          <Part title="Episode Prioritas">
            <p>
              Prioritas membuka episode yang bertahan walau jendela laporan bergeser. Rapor menampilkan “Dapur belum
              menjawab” jika lebih dari {RESPONSE_OVERDUE_HOURS} jam berlalu tanpa tanggapan pengelola. Moderator
              menutup episode dengan catatan; episode juga tertutup otomatis jika penolakan atau penggabungan duplikat
              membuat bukti tidak lagi memenuhi aturan.
            </p>
          </Part>

          <Part title="Moderasi dan penyalahgunaan">
            <ul className="list-disc space-y-1 pl-5">
              <li>Satu survei menu per perangkat, per sekolah, per tanggal makan.</li>
              <li>
                IP bersama tidak otomatis ditolak. Lonjakan ditandai untuk ditinjau; pengiriman massal dibatasi{" "}
                {REPORT_IP_LIMIT.limit} kiriman per IP dalam {REPORT_IP_LIMIT.windowSeconds / 60} menit.
              </li>
              <li>
                Jika lokasi diizinkan, sistem memeriksa radius {LOCATION_RADIUS_METERS} meter dari sekolah. Tanpa
                lokasi, laporan tetap diterima.
              </li>
              <li>
                Laporan yang ditolak dan duplikat yang digabung tidak dihitung. Status “Selesai” hanya menandai tindak
                lanjut ditutup, bukan bahwa makanan aman.
              </li>
            </ul>
          </Part>

          <Part title="Privasi">
            <p>
              Tidak ada nama, nomor induk, nomor telepon, atau foto. Kode lacak disimpan sebagai hash, koordinat tidak
              disimpan. Catatan laporan tampil di Rapor setelah ditinjau; kabar di Lacak bersifat privat.
            </p>
          </Part>

          <Part title="Batas penafsiran">
            <ul className="list-disc space-y-1 pl-5">
              <li>Laporan sukarela bisa bias; Rapor menyertakan jumlah laporan dan cakupan sekolah.</li>
              <li>Lokasi browser bisa ditolak atau dipalsukan, dan tidak memverifikasi identitas.</li>
              <li>Peran, termasuk Guru/UKS, dipilih sendiri tanpa akun.</li>
              <li>Tanpa uji laboratorium. Sistem tidak menyimpulkan bahwa menu menyebabkan gejala.</li>
              <li>Beberapa laporan bisa merujuk orang yang sama; jumlah laporan bukan jumlah korban unik.</li>
            </ul>
          </Part>

          <Part title="Sumber data">
            <p>
              <b className="text-ink">Simulasi.</b> Dapur, sekolah, laporan, dan menu di Kota Sukamaju adalah data
              simulasi. Menu dan dapur resmi per sekolah ada di{" "}
              <a
                href="https://www.bgn.go.id/radar-mbg/"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Radar MBG
              </a>
              . Angka pembanding di{" "}
              <Link href="/data" className={linkClass}>
                Data nasional
              </Link>{" "}
              bersumber dari:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {NATIONAL_FIGURES.map((figure) => (
                <li key={figure.label}>
                  <a href={figure.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {figure.source}
                  </a>
                </li>
              ))}
            </ul>
          </Part>
        </div>
      </details>
    </main>
  );
}
