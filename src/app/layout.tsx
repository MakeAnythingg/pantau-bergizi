import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pantau Bergizi",
  description: "Rapor harian per dapur MBG dari pengalaman penerimanya.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              Pantau Bergizi
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/data">Data</Link>
              <Link href="/metode">Metode</Link>
              <Link href="/masuk">Masuk</Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
          Data dapur, sekolah, dan laporan adalah SIMULASI. Pantau Bergizi adalah platform sipil independen, bukan
          sistem resmi BGN.
        </footer>
      </body>
    </html>
  );
}
