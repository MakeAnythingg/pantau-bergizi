import type { Metadata } from "next";
import Link from "next/link";
import { NATIONAL_FIGURES } from "@/content/national";

export const metadata: Metadata = { title: "Data nasional | Pantau Bergizi" };

export default function DataPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-2 pb-14 sm:px-8">
      <h1 className="font-heading text-[32px] leading-[1.05] font-bold tracking-tight sm:text-[52px]">Data nasional</h1>
      <p className="mt-3 max-w-[68ch] leading-relaxed text-ink-2">
        Makan Bergizi Gratis (MBG) berjalan dalam skala besar. Angka program, laporan insiden, dan studi sisa makanan di
        bawah memberi konteks untuk membaca pengalaman penerima. Setiap angka punya cakupan dan periode sendiri.
      </p>
      <ul className="mt-7 grid gap-4 sm:grid-cols-2">
        {NATIONAL_FIGURES.map((figure) => (
          <li key={figure.label} className="flex flex-col rounded-[20px] border bg-card p-5 sm:p-6">
            <h2 className="order-2 mt-2 text-base font-semibold">{figure.label}</h2>
            <p className="order-1 font-heading text-4xl leading-none font-bold text-navy sm:text-5xl">{figure.value}</p>
            <p className="order-3 mt-2 mb-4 text-sm text-ink-2">{figure.period}</p>
            <p className="order-4 mt-auto border-t pt-3 text-sm leading-relaxed text-ink-2">
              Sumber:{" "}
              <a
                className="font-semibold text-navy underline underline-offset-4"
                href={figure.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {figure.source}
              </a>
              , {figure.publishedOn} · diakses {figure.accessedOn}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-7 text-ink-2">
        Pelajari cara membaca rapor dapur di{" "}
        <Link href="/metode" className="font-semibold text-navy underline underline-offset-4">
          halaman Metode
        </Link>
        .
      </p>
    </main>
  );
}
