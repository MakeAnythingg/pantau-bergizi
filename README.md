# Pantau Bergizi

Rapor harian per dapur Makan Bergizi Gratis (MBG) dari pengalaman penerimanya. Siswa, guru, dan orang tua melapor lewat QR sekolah tanpa akun, dan laporan mereka menjadi sinyal dini per dapur yang dijawab secara publik oleh pengelola dapur.

Karya untuk **Web In Action — Multimedia In Action (MIA) 2026**. Subtema utama: Civic Reporting & Accountability, didampingi Public Service Tracking.

**Demo langsung:** https://pantau-bergizi.vercel.app

> **Data simulasi.** Semua dapur, sekolah, laporan, dan menu di "Kota Sukamaju" adalah SIMULASI. Pantau Bergizi adalah platform sipil independen, bukan sistem resmi BGN.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) + TypeScript + React 19
- Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com) + [Phosphor Icons](https://phosphoricons.com)
- PostgreSQL ([Neon](https://neon.com) di produksi) + [Drizzle ORM](https://orm.drizzle.team)
- Login petugas: cookie bertanda tangan (HMAC) + scrypt, tanpa penyedia auth eksternal
- [Bun](https://bun.sh) untuk instalasi, skrip, dan tes
- Deploy di [Vercel](https://vercel.com)

Standar teknis (lint, CI, keamanan, privasi, tes, bukti skala): [`docs/engineering-foundation.md`](docs/engineering-foundation.md).

## Cara menjalankan

Butuh [Bun](https://bun.sh) dan PostgreSQL lokal (mis. [Postgres.app](https://postgresapp.com)).

```bash
git clone https://github.com/MakeAnythingg/pantau-bergizi.git
cd pantau-bergizi
bun install
cp .env.example .env          # sesuaikan DATABASE_URL bila perlu
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
| `bun run db:reset --yes` | kosongkan lalu isi ulang data simulasi (hanya jika `DEMO_MODE=true`) |

Data simulasi hari ini ditambahkan otomatis setiap hari sekitar pukul 12.00 WIB lewat Vercel Cron (`/api/cron/top-up`). Proses ini tidak pernah menghapus laporan yang sudah ada.

### Demo offline (cadangan babak final)

```bash
# Postgres.app berjalan, .env menunjuk ke database lokal
bun run db:migrate && bun run db:reset --yes && bun run build && bun start
```

## Progress saat ini

- [x] Fondasi repo: Next.js 16, Tailwind, shadcn/ui, Bun
- [x] Database PostgreSQL (7 tabel) + migrasi + data simulasi Kota Sukamaju
- [x] Login petugas (moderator dan pengelola SPPG) dengan pemeriksaan peran di server
- [x] Semua halaman sesuai sitemap (masih kerangka)
- [x] Penambahan data simulasi harian
- [x] Beranda: papan status dapur hari ini
- [x] Rapor dapur: status, alasan, cakupan, tren 7 hari, sisa makanan, menu
- [x] Pengerasan: oxlint (type-aware + anti-slop), oxfmt, knip, CI GitHub Actions, header keamanan
- [ ] Login: batas percobaan, pencabutan sesi, log audit petugas
- [x] Tes end-to-end Playwright
- [ ] Form lapor dua jalur via QR + kode lacak
- [ ] Aturan sinyal + episode Prioritas
- [ ] Dasbor moderator dan pengelola SPPG
- [ ] Halaman Data nasional dan Metode

Spesifikasi produk lengkap: [`PRD_Pantau_Bergizi_V2_1.md`](PRD_Pantau_Bergizi_V2_1.md).
