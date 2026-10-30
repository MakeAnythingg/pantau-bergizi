# Pantau Bergizi — Report Form and Tracking

**Written:** 2026-10-30
**Product spec:** [`PRD_Pantau_Bergizi_V2_1.md`](../PRD_Pantau_Bergizi_V2_1.md) F1 (form), F8 (anti-abuse), and the privacy rules in section 2 define *what*. [`engineering-foundation.md`](engineering-foundation.md) defines the shared building blocks (rate limiter, keyed hash, env, tests). This doc only covers *how* `/lapor/[code]` and `/lacak` are built. If the two disagree, fix the PRD; don't restate it here.

## Intent

Recipients (teachers/UKS, students, parents) scan a school's QR, submit an experience survey or a health complaint without an account, get a tracking code, and later use that code on `/lacak` to see what happened and add updates. A new report only has to land correctly in `report`. Signal rules, Prioritas episodes, and status recomputation come in the next spec.

## Goals

1. Path A (experience) can be completed on a phone in under 20 seconds.
2. No report is lost to location denial, a missing menu, or a repeat health report.
3. One experience survey per device per school per consumption date, enforced by the database.
4. Nothing identifying stored raw: no coordinates, no IPs, no tracking codes.

## Non-goals

- Signal rules, episodes, and status changes caused by new reports.
- The IP surge flag for moderators (moderator dashboard spec). The form only stores `ip_hash`.
- Showing the menu on the form (menus live on Rapor dapur, F5).
- Editing a submitted report. Corrections are reporter updates.
- Working without JavaScript. Turnstile and the location check both need it.
- `audit_log` rows. Audit covers staff mutations, and these are anonymous.

## Anti-goals

- A report silently dropped, including a repeat health report.
- A tracking code in a URL, query string, log, or `localStorage`.
- Raw coordinates reaching the database or a log line, including inside a thrown error.
- A shared school wifi blocking a class (PRD: "IP tidak memblokir").

## Decisions

### Form: `/lapor/[code]`

- **One scrollable screen per path**, as in the PRD wireframe. Step 1 (who you are + consumption date) is at the top, then the path's questions, then submit. One Server Action per submit, no client-side step state. Touch targets ≥44 px.
- Unknown school `code` → `notFound()`.
- **Consumption date:** native `<input type="date">` with `min`/`max` set to WIB today minus `CONSUMED_ON_MAX_BACKDATE_DAYS` and WIB today (`todayWIB`, `addDays`), defaulting to today. The server re-validates the range.
- **"Kelompok" is offered to Guru/UKS only.** Students and parents only see "saya / anak saya". The server rejects `subject = group` from any other role. `affected_count` is required (≥1) exactly when `subject = group`.
- **"Tidak ada masalah"** (`none`) can't be combined with other problems, enforced on both client and server.
- `note` ≤ `NOTE_MAX_CHARS`, trimmed; empty becomes null.
- All input is parsed with one Zod schema per path (a discriminated union on `kind`) that maps directly onto the existing `report` enums. No new columns.

### Location

- Requested **on tapping "Kirim"**, with a 5 s timeout. Denied, timed out, or unsupported → the form submits without coordinates.
- The client sends `lat`/`lng` as form fields once. The server computes the haversine distance to `school.lat/lng` and stores only `location_check`: `inside` (≤ `LOCATION_RADIUS_METERS`), `outside`, or `unavailable` (missing or invalid coordinates). The coordinates are dropped after that comparison and never logged or put in errors.

### Bot check

- Cloudflare Turnstile, **managed/invisible** widget (no puzzle for normal users). The token is verified server-side in the Server Action before anything else touches the database. A missing or failed token returns a retry message and the user's answers stay on screen.
- Env: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` added to `env.ts` and `.env.example`. Tests use Cloudflare's always-pass test keys. The CSP already allows `challenges.cloudflare.com`.

### Device and duplicates

- **Device cookie `pb_device`:** 32 random bytes (base64url), `HttpOnly`, `Secure` in production, `SameSite=Lax`, 1-year lifetime, set on the first submit if absent. `device_hash = keyedHash(cookie value)`.
- **Experience:** a second survey from the same device for the same school and consumption date is rejected with a clear message ("Kamu sudah menilai makanan tanggal ini. Untuk koreksi, tambahkan perkembangan lewat kode lacak."). This is enforced by a **partial unique index** on `report(device_hash, school_id, consumed_on) where kind = 'experience'` (race-proof, and it serves the lookup). A unique violation maps to that message.
- **Health:** if the device already sent a health report for this school and date, the form shows a notice ("Kamu sudah melapor untuk tanggal ini. Punya kode lacak? Tambahkan perkembangan di /lacak.") plus a **"Tetap kirim sebagai laporan baru"** button. Confirming submits it normally. Moderators can later see the repeat from the shared `device_hash`, and no column is added for it.

### Tracking code

- 10 characters from a CSPRNG over a 31-character alphabet without `0 O 1 I L` (~50 bits), shown as `XXXXX-XXXXX`. Input is normalized (uppercase, strip `-` and spaces) before hashing.
- Stored only as `token_hash = keyedHash(normalized code)`.
- **Shown once** on the success screen with a copy button and a "simpan atau screenshot kode ini" hint. Nothing is stored on the device.
- **Path B success screen** also shows static help: *hubungi UKS / Puskesmas terdekat; keadaan darurat: 119.* The same line goes on `/metode`.

### Lookup: `/lacak`

- The code is entered in a form and **sent by POST** (Server Action). It never appears in the URL, query string, or history. A wrong code gets a generic "kode tidak ditemukan".
- Shows: kind, school, consumption date, status (plus `reject_reason` when rejected), and responses on this report in time order: dapur, moderator, and the reporter's own updates. Episode-level responses are out of scope until episodes exist.
- **Add an update:** a textarea (≤ `NOTE_MAX_CHARS`) that inserts a `response` with `author_kind = reporter`, `author_user_id = null`. It does not change `status`. The action re-sends the code and re-verifies it, so no session or cookie identifies the report. Updates are free text, so they are not public before review (PRD privacy).

### Rate limits

New entries in `thresholds.ts`. Both keys go through the shared limiter by extending `RateKey`.

| Key | Rule | Counts |
|---|---|---|
| `report:ip:{ipHash}` | 120 per 10 min | every form submit (foundation doc) |
| `lacak:ip:{ipHash}` | 30 per 10 min | every lookup and every update |

The limit is checked after Turnstile and before any other DB work. When throttled, the user sees "terlalu banyak percobaan, coba lagi beberapa menit lagi".

## Data

- No new tables or columns. `report` already has every field. New rows get `simulated = false` and `status = received`, and `received_at` is set by the server.
- Migration: the partial unique index above, plus a plain index on `report(device_hash, school_id, consumed_on)` for the health-repeat check (the partial index can't serve `kind = 'health'`).
- Seed/top-up already write random `device_hash` values, so the new unique index must not collide with simulated data (verify with `db:reset`).

## Tests

These are the acceptance criteria. Nothing beyond them.

**Integration (`bun test`, real Postgres):**
- Consumption date outside WIB today−30…today is rejected; the bounds themselves are accepted.
- `none` combined with another problem is rejected; `subject = group` from a non-teacher is rejected; `group` without `affected_count` is rejected.
- A second experience survey from the same device, school, and date is rejected with the clear message; a different date or school is accepted.
- A repeat health report from the same device returns the notice, and is stored once confirmed.
- Two devices on the same IP can both submit.
- Location: inside, outside, and missing coordinates map to `inside`, `outside`, and `unavailable`; no coordinates are written.
- Tracking code: the hash of the issued code finds the report, normalization accepts lowercase and dashes, and a wrong code finds nothing.
- `report:ip` and `lacak:ip` limits trip at their thresholds.

**Playwright:**
1. Path A on a mobile viewport with geolocation denied → success screen with a code.
2. Path B → success screen shows the help text.
3. That code on `/lacak` shows the report and accepts an update, which then appears in the list.
4. A second survey from the same browser for the same school and date shows the rejection message.

This replaces foundation spec 5 ("Report submit → tracking code → lookup").

## Left to the builder

- Component structure and copy beyond the strings quoted here.
- How the Zod union is shared between client hints and server parsing.
- Exact layout of the success and `/lacak` screens, within the PRD's mobile-first rules.
