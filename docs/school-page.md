# Pantau Bergizi — School Page and Rapor Menu Table

**Written:** 2026-10-31
**Product spec:** [`PRD_Pantau_Bergizi_V2_1.md`](../PRD_Pantau_Bergizi_V2_1.md) §3 (Halaman sekolah) and F3 (quality indicators) define *what*. [`engineering-foundation.md`](engineering-foundation.md) covers env, thresholds, and scale budgets. This doc only covers *how* `/sekolah/[code]` and the Rapor per-menu table are built. If the two disagree, fix the PRD; don't restate it here.

## Intent

The school page is how people reach the form: a printed QR on the wall and a link in the parents' WhatsApp group. The Rapor addition closes the rest of F3: the average rating per menu and date, and the menu with the most leftovers.

## Goals

1. A school can print one A4 QR poster and share one WhatsApp link, with no account and nothing to install.
2. The QR always points at the canonical site.
3. Rapor shows rating and leftovers per menu and meal date, without showing small-sample percentages.

## Non-goals

- Server-side PDF generation.
- QR per tray/ompreng (PRD roadmap).
- Any WhatsApp API or account.
- New signal or threshold rules.

## Anti-goals

- A QR or share link built from request headers, which could be spoofed into a poster pointing elsewhere.
- A leftover percentage from fewer than `LEFTOVER_MIN_REPORTS` answers.

## Decisions

### `/sekolah/[code]`

- Unknown code → `notFound()`.
- **Shows:**
  - the school name;
  - its kitchen, as a **status badge** linking to Rapor (the same status function as Beranda, so an open episode shows Prioritas);
  - the PRD's report button, labelled "untuk siswa, guru, dan orang tua di sekolah ini", linking to `/lapor/<code>`;
  - the QR, a print button, and the share buttons.
- The form URL is `${PUBLIC_BASE_URL}/lapor/<code>`. It's built in one helper and used by the QR, the share text, and the printed URL.

### QR

- Generated **server-side as inline SVG** by a small, dependency-free QR library. Pick it at build time after checking its current docs, and record the choice in the PR.
- It encodes the form URL above. Error correction is medium or higher so a slightly damaged print still scans.

### Printing

- A "Cetak QR" button calls `window.print()`. An `@media print` stylesheet hides everything else and lays out one A4 poster:
  - the school name and its kitchen;
  - a large QR;
  - "Scan untuk menilai makan siang atau melapor keluhan";
  - the form URL as text;
  - a "Data simulasi" footer while `DEMO_MODE=true`.

### Sharing

- **"Bagikan ke grup WhatsApp":** `https://wa.me/?text=` + `encodeURIComponent("Laporkan pengalaman makan MBG di <sekolah>: <form URL>")`, opened with `target="_blank" rel="noopener noreferrer"`.
- **"Salin link":** copies the form URL and confirms with "Link disalin".

### Rapor: "7 hari terakhir per menu"

- **Seven rows**, one per **meal date** (`consumed_on`), today back 6 days, newest first. Only counting reports are included (not rejected, not merged).
- **Each row:**
  - the date;
  - the menu name, or "menu belum diisi";
  - the average rating with its count ("3,8 · 24 laporan"), or "–" when there are no ratings;
  - the "sisa banyak" share as "% laporan", shown only when that day has ≥ `LEFTOVER_MIN_REPORTS` leftover answers, otherwise "–".
- **Above the table:** "Sisa tertinggi: <menu>, <tanggal> · <x>% laporan", taken from the qualifying days only (ties go to the most recent day), and hidden when no day qualifies.
- The existing 7-day "sisa banyak" figure and the report-count chart stay as they are.
- **Scale:** the query must stay within the Rapor dapur budget (< 100 ms) in the scale proof. If `EXPLAIN` shows it needs one, add an index on `report(school_id, consumed_on)` in the same change.

## Data

- New env `PUBLIC_BASE_URL`: the URL with scheme and no trailing slash. Validated in `env.ts` and listed in `.env.example` and the foundation env table.
- No schema change unless the scale check above adds the index.

## Tests

These are the acceptance criteria. Nothing beyond them.

**Integration (`bun test`, real Postgres):**
- A day under `LEFTOVER_MIN_REPORTS` shows "–" for leftovers and still shows its rating with the count.
- "Sisa tertinggi" picks the highest qualifying day and is absent when no day qualifies.
- Rows group by `consumed_on`, not `received_at`.
- The form URL comes from `PUBLIC_BASE_URL`, never from request headers.

**Playwright:**
1. `/sekolah/<seeded code>` shows the school, its kitchen's status badge, an SVG QR, and a WhatsApp link whose `text` contains `/lapor/<code>`. Following the report button opens the form.
2. An unknown code returns 404.

## Left to the builder

- Which QR library to use (recorded in the PR).
- Page and poster layout, within PRD §6.
- Copy beyond the strings quoted here.
