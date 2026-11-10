import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_SWATCH } from "@/components/tray";
import { NATIONAL_FIGURES } from "@/content/national";
import { STATUS_LABEL, STATUSES } from "@/lib/status";
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

export const metadata: Metadata = { title: "Metode | Pantau Bergizi" };

const statusDescription = {
  priority: "Ada pola keluhan kesehatan yang perlu diperiksa lebih dulu atau episode Prioritas masih terbuka.",
  attention: "Ada keluhan atau masukan mutu yang perlu ditinjau.",
  no_signal:
    "Ada laporan, tetapi belum ada pola yang memenuhi aturan sinyal. Keamanan makanan tetap belum bisa dipastikan.",
  no_data: "Belum ada laporan yang bisa dihitung dalam jendela sinyal. Kondisi dapur belum bisa dinilai dari laporan.",
};

const linkClass = "font-semibold text-navy underline underline-offset-4";

function MethodSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border bg-card p-5 sm:p-6">
      <h2 className="font-heading text-2xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function MetodePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-2 pb-14 sm:px-8">
      <h1 className="font-heading text-[32px] leading-[1.05] font-bold tracking-tight sm:text-[52px]">Metode</h1>
      <p className="mt-3 max-w-[68ch] leading-relaxed text-ink-2">
        Pantau Bergizi merangkum laporan penerima Makan Bergizi Gratis (MBG) per dapur untuk membantu menentukan dapur
        mana yang perlu diperiksa lebih dulu.
      </p>
      <p className="mt-5 rounded-xl border bg-card p-4 leading-relaxed text-ink-2">
        <strong className="text-ink">SIMULASI.</strong> Dapur, sekolah, laporan, dan menu di Kota Sukamaju adalah data
        simulasi. Angka di halaman{" "}
        <Link href="/data" className={linkClass}>
          Data nasional
        </Link>{" "}
        berasal dari sumber yang dicantumkan di sana.
      </p>

      <div className="mt-6 space-y-4">
        <MethodSection title="Arti status dapur">
          <dl className="grid gap-3 sm:grid-cols-2">
            {STATUSES.map((status) => (
              <div key={status} className="rounded-xl bg-well p-3.5">
                <dt className="flex items-center gap-2 font-semibold text-ink">
                  <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", STATUS_SWATCH[status])} />
                  {STATUS_LABEL[status]}
                </dt>
                <dd className="mt-1">{statusDescription[status]}</dd>
              </div>
            ))}
          </dl>
        </MethodSection>

        <MethodSection title="Cara menentukan sinyal">
          <p>
            Sistem menghitung laporan yang diterima server dalam {SIGNAL_WINDOW_HOURS} jam terakhir, untuk makanan yang
            dikonsumsi hari ini atau kemarin menurut WIB. Laporan dari sekolah yang dilayani dapur yang sama dibaca
            bersama.
          </p>
          <p className="font-semibold text-ink">Prioritas bisa muncul lewat dua jalur</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Otomatis jika ada ≥{PRIORITY_MIN_HEALTH_REPORTS} keluhan kesehatan dari ≥{PRIORITY_MIN_SCHOOLS} sekolah,
              dengan sedikitnya {PRIORITY_MIN_INSIDE} laporan dikirim dari area sekolah.
            </li>
            <li>
              Setelah moderator meninjau laporan kelompok Guru/UKS dengan perkiraan sedikitnya{" "}
              {TEACHER_GROUP_MIN_AFFECTED} orang terdampak.
            </li>
          </ul>
          <p className="font-semibold text-ink">Perlu perhatian muncul jika ada salah satu kondisi berikut</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Ada keluhan kesehatan dan syarat Prioritas belum terpenuhi, termasuk laporan kelompok yang masih ditinjau.
            </li>
            <li>
              Ada laporan makanan basi atau benda asing yang dikirim dari area sekolah atau sudah ditinjau moderator.
            </li>
            <li>
              Rata-rata nilai menu di bawah {LOW_RATING_THRESHOLD} dari sedikitnya {LOW_RATING_MIN_REPORTS} laporan
              bernilai.
            </li>
          </ul>
        </MethodSection>

        <MethodSection title="Episode Prioritas dan tanggapan dapur">
          <p>
            Episode mempertahankan status Prioritas walaupun jendela laporan sudah bergeser. Moderator menutup episode
            dengan catatan. Episode juga ditutup otomatis dengan alasan yang tercatat jika penolakan laporan atau
            penggabungan duplikat membuat bukti tidak lagi memenuhi aturan.
          </p>
          <p>
            Rapor menampilkan “Dapur belum menjawab” jika lebih dari {RESPONSE_OVERDUE_HOURS} jam berlalu sejak episode
            terdeteksi dan pengelola belum memberikan tanggapan.
          </p>
        </MethodSection>

        <MethodSection title="Mutu menu dan sisa makanan">
          <p>
            Nilai menu dan sisa makanan menggambarkan pengalaman makan. Nilai rendah bisa memicu Perlu perhatian untuk
            mutu. Kedua indikator ini tidak memicu Prioritas atau sinyal keamanan pangan.
          </p>
          <p>
            Ringkasan “sisa banyak” tampil bila ada sedikitnya {LEFTOVER_MIN_REPORTS} laporan yang menjawab pertanyaan
            sisa makanan dalam {LEFTOVER_WINDOW_DAYS} hari terakhir. Persentasenya dihitung dari jawaban yang memilih
            “sisa banyak” dibagi semua jawaban tentang sisa makanan pada periode itu.
          </p>
        </MethodSection>

        <MethodSection title="Moderasi dan pencegahan penyalahgunaan">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Setiap perangkat bisa mengirim satu survei pengalaman menu per sekolah untuk tanggal makan yang sama.
            </li>
            <li>
              IP bersama tidak otomatis membuat laporan ditolak. Lonjakan laporan ditandai untuk ditinjau. Sistem juga
              membatasi pengiriman massal hingga {REPORT_IP_LIMIT.limit} kiriman per IP dalam{" "}
              {REPORT_IP_LIMIT.windowSeconds / 60} menit.
            </li>
            <li>
              Jika pelapor mengizinkan lokasi, sistem memeriksa radius {LOCATION_RADIUS_METERS} meter dari sekolah dan
              menyimpan hasil pemeriksaannya. Laporan tetap diterima jika lokasi tidak tersedia.
            </li>
            <li>
              Moderator dapat meninjau laporan, menolak dengan alasan, dan menggabungkan duplikat. Laporan yang ditolak
              dan duplikat yang sudah digabung dikeluarkan dari hitungan. Status “Selesai” hanya menandai penutupan
              tindak lanjut. Keamanan makanan tetap memerlukan pemeriksaan tersendiri.
            </li>
          </ul>
        </MethodSection>

        <MethodSection title="Privasi pelapor">
          <p>
            Formulir laporan tidak meminta nama, nomor induk siswa, nomor telepon, atau foto. Sistem menyimpan kode
            lacak dalam bentuk hash dan tidak menyimpan koordinat pelapor.
          </p>
          <p>
            Catatan laporan baru bisa tampil di rapor setelah ditinjau. Pembaruan dari pelapor di halaman Lacak bersifat
            privat.
          </p>
        </MethodSection>

        <MethodSection title="Batas penafsiran">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Laporan sukarela dapat bias. Rapor menyertakan jumlah laporan dan cakupan sekolah untuk memberi konteks.
            </li>
            <li>
              Lokasi dari browser bisa ditolak atau dipalsukan. Lokasi membantu membaca bukti dan tidak memverifikasi
              identitas.
            </li>
            <li>Pelapor memilih sendiri perannya tanpa akun, termasuk peran Guru/UKS.</li>
            <li>
              Laporan warga tidak melalui uji laboratorium. Prioritas menunjukkan perlunya pemeriksaan. Sistem tidak
              mendiagnosis atau menyimpulkan bahwa menu MBG menyebabkan gejala.
            </li>
            <li>
              Beberapa laporan dapat merujuk pada orang yang sama. Jumlah laporan tidak menunjukkan jumlah korban unik.
            </li>
            <li>Sisa makanan menggambarkan mutu menu dan tidak digunakan untuk menilai keamanan pangan.</li>
          </ul>
        </MethodSection>

        <MethodSection title="Sumber data">
          <p>
            <a href="https://www.bgn.go.id/radar-mbg/" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Radar MBG
            </a>{" "}
            menampilkan menu dan dapur penyedia per sekolah dari data BGN. Pantau Bergizi mengolah laporan sukarela dari
            siswa, guru, dan orang tua menjadi rapor per dapur.
          </p>
          <p>
            Sumber angka pembanding di halaman{" "}
            <Link href="/data" className={linkClass}>
              Data nasional
            </Link>
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
        </MethodSection>

        <MethodSection title="Ada yang sakit?">
          <p>
            Hubungi UKS atau Puskesmas terdekat. Untuk keadaan darurat, hubungi{" "}
            <a href="tel:119" className={linkClass}>
              119
            </a>
            .
          </p>
        </MethodSection>
      </div>
    </main>
  );
}
