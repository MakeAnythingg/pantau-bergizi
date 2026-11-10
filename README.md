# Pantau Bergizi

Rapor harian per dapur Makan Bergizi Gratis (MBG) dari pengalaman penerimanya. Siswa, guru, dan orang tua melapor lewat QR sekolah tanpa akun, dan laporan mereka menjadi sinyal dini per dapur yang dijawab secara publik oleh pengelola dapur.

Karya untuk **Web In Action — Multimedia In Action (MIA) 2026**. Subtema utama: Civic Reporting & Accountability, didampingi Public Service Tracking.

**Demo langsung:** https://pantau-bergizi.vercel.app

**First Draft MIA 2026:** [snapshot kode dan README pada tag `first-draft`](https://github.com/MakeAnythingg/pantau-bergizi/tree/first-draft). [Checklist pengumpulan dan verifikasi Final](https://github.com/MakeAnythingg/pantau-bergizi/issues/9).

> **Data simulasi.** Semua dapur, sekolah, laporan, dan menu di "Kota Sukamaju" adalah SIMULASI. Pantau Bergizi adalah platform sipil independen, bukan sistem resmi BGN.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) + TypeScript + React 19
- Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com) + [Phosphor Icons](https://phosphoricons.com)
- PostgreSQL ([Neon](https://neon.com) di produksi) + [Drizzle ORM](https://orm.drizzle.team)
- Login petugas: cookie bertanda tangan (HMAC) + scrypt, tanpa penyedia auth eksternal; batas percobaan login dan log audit di Postgres
- [Bun](https://bun.sh) untuk instalasi, skrip, dan tes unit/integrasi; [Playwright](https://playwright.dev) untuk tes end-to-end
- Kualitas kode: [oxlint](https://oxc.rs) (type-aware + anti-slop), oxfmt, knip; CI di GitHub Actions
- Deploy di [Vercel](https://vercel.com)

Standar teknis (lint, CI, keamanan, privasi, tes, bukti skala): [`docs/engineering-foundation.md`](docs/engineering-foundation.md).

## Cara menjalankan

Butuh [Bun](https://bun.sh) dan PostgreSQL lokal (mis. [Postgres.app](https://postgresapp.com)).

```bash
git clone https://github.com/MakeAnythingg/pantau-bergizi.git
cd pantau-bergizi
bun install
cp .env.example .env          # sesuaikan DATABASE_URL; ganti semua secret (openssl rand -base64 48)
createdb pantau_bergizi
bun run db:migrate
bun run db:seed
bun dev
```

Buka http://localhost:3000.

### Akun demo

Kata sandi semua akun: `demo1234` (juga tertulis di halaman `/masuk`).

| Email | Peran |
|---|---|
| `moderator@pantaubergizi.id` | Moderator |
| `sppg-melati@pantaubergizi.id` | Pengelola SPPG Melati 01 |
| `sppg-kenanga@pantaubergizi.id` | Pengelola SPPG Kenanga 02 |

### Skrip

| Perintah | Fungsi |
|---|---|
| `bun run check` | format + lint + typecheck + knip + tes |
| `bun test` | tes unit/integrasi (butuh database `pantau_bergizi_test`, lihat `.env.test`) |
| `bun run e2e` | tes Playwright pada build produksi (butuh database `pantau_bergizi_e2e`; sekali: `bunx playwright install chromium`) |
| `bun run format` | rapikan format dengan oxfmt |
| `bun run db:migrate` | terapkan migrasi ke `DATABASE_URL` |
| `bun run db:seed` | isi data simulasi (hanya jika `DEMO_MODE=true`) |
| `bun run db:seed:scale` | buat data skala nasional di database kosong pada localhost |
| `bun run db:bench:scale` | ukur kueri aplikasi pada data skala nasional |
| `bun run db:reset --yes` | kosongkan lalu isi ulang data simulasi (hanya jika `DEMO_MODE=true`) |

Data simulasi hari ini ditambahkan otomatis setiap hari sekitar pukul 12.00 WIB lewat Vercel Cron (`/api/cron/top-up`). Proses ini tidak pernah menghapus laporan yang sudah ada.

### Demo offline (cadangan babak final)

```bash
# Postgres.app berjalan, .env menunjuk ke database lokal
bun run db:migrate && bun run db:reset --yes && bun run build && bun start
```

Siapkan dependensi dan jalankan build saat masih terhubung ke internet agar font tersedia. Dengan PostgreSQL lokal dan hasil build tersebut, `bun start` dapat menyajikan Beranda dan Rapor saat koneksi terputus. Pengiriman laporan lewat formulir publik memerlukan koneksi ke Cloudflare Turnstile.

### Bukti skala nasional

Gunakan database PostgreSQL lokal yang baru dan konfigurasi lokal dari `.env.example`. Siapkan ruang disk untuk data, indeks, dan WAL. Seed mengisi 30.000 SPPG di 500 wilayah, 300.000 sekolah, dan 5 juta laporan dalam 30 hari, lengkap dengan menu, episode, dan tanggapan. Seed menolak database yang sudah berisi SPPG. Kedua skrip skala hanya menerima `DATABASE_URL` dengan host `localhost` dan menolak eksekusi di CI.

```bash
createdb -h localhost pantau_bergizi_scale
export DATABASE_URL=postgres://localhost:5432/pantau_bergizi_scale
DATABASE_URL_UNPOOLED="$DATABASE_URL" bun run db:migrate
bun run db:seed:scale
bun run db:bench:scale --plans > scale-plans.txt
```

Pakai `IP_HASH_SECRET` lokal yang sama saat seed dan benchmark agar kode lacak uji dapat ditemukan. Skrip memakai waktu acuan tetap **10 November 2026, 13.00 WIB**. Untuk Beranda, kueri yang sama dipakai oleh rute `/?wilayah=Kabupaten%20Simulasi%201`.

Benchmark menghangatkan database dengan menjalankan fungsi aplikasi, lalu menjalankan `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` pada semua statement yang dipakai oleh tiap alur. Satu sampel adalah jumlah waktu eksekusi SQL untuk alur tersebut. Ketiga sampel harus di bawah target. Opsi `--plans` mencetak rencana tiap statement pada sampel pertama.

#### Hasil pengukuran

Pengukuran lokal pada PostgreSQL 17.6, Windows x64, Ryzen 5 4600H, dan `shared_buffers=2GB`. Database berisi 30.000 SPPG, 300.000 sekolah, 5.000.000 laporan dari 12 Oktober sampai 10 November 2026, dan 1.200 episode. Beranda memakai satu wilayah berisi 60 SPPG. Antrean moderator dan dasbor SPPG memakai halaman pertama.

| Alur | Statement | Sampel waktu eksekusi (ms) | Target (ms) | Rencana utama pada sampel pertama |
| --- | ---: | --- | ---: | --- |
| Beranda satu wilayah | 5 | 5,762 / 4,411 / 4,419 | < 200 | Bitmap index scan pada `sppg_district_index`, index-only scan untuk cakupan sekolah, dan index scan pada `report_school_id_received_at_index` untuk laporan terbaru |
| Rapor dapur dan tabel per menu | 9 | 0,824 / 0,871 / 0,858 | < 100 | Indeks unik menu per SPPG dan tanggal, `report_school_id_received_at_index` untuk laporan tujuh hari, dan indeks episode per SPPG |
| Antrean moderator | 3 | 1,765 / 1,897 / 2,538 | < 100 | `report_review_queue_priority_idx` untuk antrean terurut, `report_school_id_kind_consumed_on_index` untuk kandidat duplikat, dan `report_duplicate_of_index` untuk pemeriksaan tautan duplikat |
| Dasbor SPPG | 8 | 1,771 / 1,531 / 1,542 | < 100 | `school_sppg_id_index` dan indeks laporan per sekolah membatasi cakupan. `response_report_id_created_at_index` mencari tanggapan terbaru |
| Pencarian kode lacak | 3 | 0,178 / 0,183 / 0,180 | < 10 | `report_tokenHash_unique` mencari laporan. Indeks respons per laporan dan episode mengambil tanggapan |

Kelima alur memenuhi target pada ketiga sampel. Semua statement pada sampel pertama mencatat nol `Shared Read Blocks`.

## Progress saat ini

- [x] Fondasi repo: Next.js 16, Tailwind, shadcn/ui, Bun
- [x] Database PostgreSQL (7 tabel produk + rate_limit + audit_log) + migrasi + data simulasi Kota Sukamaju
- [x] Login petugas (moderator dan pengelola SPPG) dengan pemeriksaan peran di server
- [x] Semua halaman sesuai sitemap (masih kerangka)
- [x] Penambahan data simulasi harian
- [x] Beranda: papan status dapur hari ini
- [x] Rapor dapur: status, alasan, cakupan, tren 7 hari, sisa makanan, menu
- [x] Pengerasan: oxlint (type-aware + anti-slop), oxfmt, knip, CI GitHub Actions, header keamanan
- [x] Login: batas percobaan, pencabutan sesi, log audit petugas (append-only)
- [x] Tes end-to-end Playwright
- [x] Halaman sekolah: QR cetak A4, bagikan ke WhatsApp, tabel rapor per menu
- [x] Form lapor dua jalur via QR + kode lacak (`/lacak`), Turnstile, batas per perangkat dan per IP
- [x] Aturan sinyal + episode Prioritas: pembukaan, tinjauan, riwayat, dan penutupan
- [x] Dasbor moderator dan pengelola SPPG
- [x] Halaman Data nasional dan Metode
- [x] Bukti skala nasional untuk lima alur kueri

Spesifikasi produk lengkap: [`PRD_Pantau_Bergizi_V2_1.md`](PRD_Pantau_Bergizi_V2_1.md).
