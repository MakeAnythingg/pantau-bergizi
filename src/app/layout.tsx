import type { Metadata } from "next";
import { Nunito, Zilla_Slab } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/tray";
import { hasStaffCookie } from "@/lib/session";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const zillaSlab = Zilla_Slab({
  variable: "--font-zilla",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Pantau Bergizi",
  description: "Rapor harian per dapur MBG dari pengalaman penerimanya.",
};

function StaffLink({ signedIn }: { signedIn: boolean }) {
  return (
    <Link href={signedIn ? "/dasbor" : "/masuk"} className="text-navy">
      {signedIn ? "Dasbor" : "Masuk"}
    </Link>
  );
}

/** Per-request hole in the cached shell: staff see "Dasbor" instead of "Masuk". */
async function HeaderStaffLink() {
  return <StaffLink signedIn={await hasStaffCookie()} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${nunito.variable} ${zillaSlab.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mb-6 border-b bg-card print:hidden">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
            <Link
              href="/"
              className="flex items-center gap-2 font-brand text-lg font-bold tracking-tight whitespace-nowrap sm:gap-2.5 sm:text-xl"
            >
              <BrandMark />
              Pantau Bergizi
            </Link>
            <div className="flex gap-3 text-sm font-semibold text-ink-2 sm:gap-7 sm:text-[15px]">
              <Link href="/data" className="max-sm:hidden">
                Data
              </Link>
              <Link href="/lacak">Lacak</Link>
              <Link href="/metode">Metode</Link>
              <Suspense fallback={<StaffLink signedIn={false} />}>
                <HeaderStaffLink />
              </Suspense>
            </div>
          </nav>
        </header>
        {children}
        <footer className="px-4 py-6 text-center text-xs text-ink-3 print:hidden">
          Data dapur, sekolah, dan laporan adalah SIMULASI. Pantau Bergizi adalah platform sipil independen, bukan
          sistem resmi BGN.
        </footer>
      </body>
    </html>
  );
}
