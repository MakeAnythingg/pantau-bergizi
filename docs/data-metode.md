# Pantau Bergizi — Data Nasional and Metode

**Written:** 2026-10-31
**Product spec:** [`PRD_Pantau_Bergizi_V2_1.md`](../PRD_Pantau_Bergizi_V2_1.md) §1.1 (figures and sources), §1.3 (difference from Radar MBG), §1.4 (limits of what we claim), and F9 define *what*. The rules this page explains are defined in [`signals.md`](signals.md), [`report-form.md`](report-form.md), and [`dashboards.md`](dashboards.md). This doc only covers *how* `/data` and `/metode` are built. If the two disagree, fix the PRD; don't restate it here.

## Intent

`/data` shows why the tool is needed, using real, sourced national figures. `/metode` shows exactly how a status is reached and what it does *not* claim. Both count directly toward the content-accuracy score, so every number has a source and a date, and every threshold comes from code.

## Goals

1. Every national figure shows its source, its publication date, and the date we accessed it.
2. Every threshold on `/metode` is read from `thresholds.ts`, never typed by hand.
3. Both pages are static: no DB access, prerendered.

## Non-goals

- A CMS, a DB table, or an admin form for figures.
- Live aggregates of the simulated Kota Sukamaju data on these pages.
- Archived copies of sources.

## Anti-goals

- A number without a source and date.
- A threshold on `/metode` that differs from the one the code enforces.
- Simulated data that reads as real, or a figure that reads as an official BGN statement when it is press coverage.

## Decisions

### Figures: `src/content/national.ts`

- One typed array. Each entry has: `label`, `value` (display string), `period` (what the value covers, e.g. "Jan–Sep 2025"), `source` (publisher + context, e.g. "Metro TV, rapat BGN–Komisi IX"), `url`, `publishedOn`, `accessedOn`. All fields required.
- **Entries:** the four PRD §1.1 figures:
  - incident victims;
  - number of kitchens (SPPG);
  - the 2026 budget;
  - the IPB leftover study (35,8% of a portion, SMPN 4 Garut).
- **Freshness:** every figure is re-checked against the latest available source before the Final (11 Nov). Where a newer figure exists, it replaces the old one with its own source and dates, and PRD §1.1 is updated to match. The victims figure (Jan–Sep 2025, published 1 Oct 2025) is the first candidate. The source research is a build step, not part of this doc.

### `/data`

- One block per entry: the value, the label, the period, and a line "Sumber: <source>, <publishedOn> · diakses <accessedOn>" with the source link.
- A short intro tying the figures to the problem (PRD §1.1), and a closing link to `/metode`.

### `/metode`

The sections and the facts each must state are below. The final Indonesian copy is written during the build and Praffi reviews it before merge.

1. **Status labels:** what Prioritas / Perlu perhatian / Tidak ada sinyal / Belum ada data mean. "Tidak ada sinyal" is not "aman" (safe), and "Belum ada data" is never good news.
2. **Signal rules in plain words:**
   - both Prioritas paths (automatic multi-school, and a reviewed Guru/UKS group report);
   - the Perlu perhatian conditions;
   - the 24 h window by server receive time;
   - only meals from today or yesterday count.
   Every number is interpolated from `thresholds.ts` (e.g. `≥{PRIORITY_MIN_HEALTH_REPORTS} keluhan kesehatan dari ≥{PRIORITY_MIN_SCHOOLS} sekolah`).
3. **Episodes:** Prioritas holds until a moderator closes it with a note; it closes automatically if rejected reports remove the evidence, and the reason is kept. "Dapur belum menjawab" appears after `RESPONSE_OVERDUE_HOURS` with no kitchen response.
4. **Quality indicators:** the rating and leftover share are quality feedback only and never trigger a safety status; the leftover share appears only with ≥ `LEFTOVER_MIN_REPORTS` reports over `LEFTOVER_WINDOW_DAYS` days, and is a share of reports, not of food weight.
5. **Moderation and abuse handling:**
   - one survey per device per school per meal date;
   - IP is only flagged, never blocks;
   - location is checked within `LOCATION_RADIUS_METERS` m and only the result is stored;
   - moderators review, reject with a reason, and merge duplicates;
   - "Selesai" (closed) means the follow-up is closed, not that the food is safe.
6. **Privacy:**
   - no name, student ID, phone number, or photo is collected;
   - the tracking code is stored only as a hash;
   - coordinates are never stored;
   - report notes are public only after review, and reporter updates are never public.
7. **Limits of what we claim:** every PRD §1.4 point.
8. **Sources:** the `national.ts` entries, and how our data source differs from Radar MBG, stated neutrally (PRD §1.3).
9. **Help:** "Ada yang sakit? Hubungi UKS / Puskesmas terdekat; keadaan darurat: 119."
10. **SIMULASI note:** visible near the top: only Kota Sukamaju (kitchens, schools, reports, menus) is simulated; the national figures are real and sourced.

### Rendering

- Both pages are fully static: no DB, prerendered under `cacheComponents`.
- External links use `target="_blank" rel="noopener noreferrer"`.
- They replace the current `StubPage` usages.

## Tests

These are the acceptance criteria. Nothing beyond them.

**Playwright:**
1. `/metode` shows the Prioritas rule containing the current `PRIORITY_MIN_HEALTH_REPORTS` and `PRIORITY_MIN_SCHOOLS` values (imported by the test, so hard-coded copy fails), and the 119 help line.
2. `/data` shows every `national.ts` entry with its source link, publication date, and access date.

**Manual, before the Final:** every figure is re-checked against its source. This is listed in the PRD's "Yang harus diverifikasi sebelum Final".

## Left to the builder

- Page layout and typography, within PRD §6.
- Exact Indonesian copy (Praffi reviews).
