# Pantau Bergizi — Moderator and SPPG Dashboards

**Written:** 2026-10-31
**Product spec:** [`PRD_Pantau_Bergizi_V2_1.md`](../PRD_Pantau_Bergizi_V2_1.md) F4 (kitchen responses, report status flow), F5 (menu), F6 (dashboards), F7 (role checks), and F8 (flags, rejection) define *what*. [`engineering-foundation.md`](engineering-foundation.md) covers sessions, `audit()`, and the scale budgets. [`signals.md`](signals.md) defines `syncEpisode` and `closeEpisode`, which this doc wires to forms. This doc only covers *how* `/dasbor` is built. If the two disagree, fix the PRD; don't restate it here.

## Intent

The moderator turns raw reports into trusted signals: review, reject, merge, close, and forward. The kitchen manager answers in public and keeps the menu current. Every action is a role-checked Server Action that commits together with its audit row and its episode re-sync.

## Goals

1. Moderation effort goes only where there is risk or free text. Positive surveys never wait on a human.
2. No mutation without a server-side role check; a manager can only touch their own kitchen.
3. Every staff mutation commits atomically with `syncEpisode` (when it can change a signal) and its `audit_log` row.
4. Concurrent moderators can't silently overwrite each other.

## Non-goals

- Undo for moderator actions (the audit log and the demo reset cover mistakes).
- Editing or deleting responses.
- Menu photos, and menus for any day but today.
- Editing a report's content.
- Notifications to agencies (PRD roadmap).
- Data nasional and Metode (their own spec).

## Anti-goals

- A mutating action reachable without the right role, or a manager acting on another kitchen.
- A double-reject or reject-after-review because two moderators acted at once.
- Reporter free text shown publicly: report notes before review, and reporter updates ever.
- A moderator writing a response as the kitchen.

## Decisions

### Route and access

- One route, **`/dasbor`**, rendering the moderator view or the manager view by session role (`requireRole("moderator", "sppg_manager")`).
- Every mutation is a Server Action that calls `requireRole` itself and, for managers, checks `session.sppgId` against the target's kitchen next to the data access (foundation doc pattern). No middleware gating.
- **Optimistic concurrency:** every status change is a conditional update (`WHERE id = ? AND status = <status the user saw>`; the form carries the seen status). If 0 rows change, the action rolls back and shows "Laporan ini sudah diubah moderator lain, muat ulang." Closing an already-closed episode behaves the same way.
- **Layout:** desktop-first, two columns as in the PRD wireframes; stacks into one column below 768 px; usable at 375 px.

### Moderator: review queue

- **Contents:** `received` reports that are health complaints, or experience reports with `stale` / `foreign_object`, or experience reports with a note. Plain experience surveys with no note never enter the queue; they stay `received` and count normally.
- **Order:**
  1. Guru/UKS group reports with ≥ `TEACHER_GROUP_MIN_AFFECTED` affected, each with a timer since `received_at` ("14 mnt");
  2. other health reports;
  3. the rest.
  Oldest first within each group. 20 per page.
- **Each item shows:** school, kitchen, role, kind, consumption date (with the "makan [tanggal]" badge for older meals), symptoms/problems, affected count, note, location result, flags, and the reporter's updates from `/lacak`.

### Moderator: actions on a report

| Action | From → to | Requires | Audit |
|---|---|---|---|
| **Tinjau** | `received` → `reviewed` | — | `report.status_changed` |
| **Tolak** | any non-rejected → `rejected` | reason (1–`NOTE_MAX_CHARS`), saved to `reject_reason` | `report.status_changed` |
| **Gabung duplikat** | sets `duplicate_of` | a target with the same school, kind, and `consumed_on` that is not itself a duplicate (no chains) | `report.merged` |
| **Selesai** | `reviewed` / `responded` → `closed` | — | `report.status_changed` |

- Each action runs in one transaction: `lockKitchen(tx, sppgId)` → conditional update → `syncEpisode(tx, sppgId, now)` → `audit()`. The lock comes first ([`signals.md`](signals.md) Concurrency).
- The merge form lists only valid candidates.
- "Selesai" means the follow-up is closed, not that the food is safe (PRD F4). The UI copy says so.

### Moderator: flags ("Ditandai mencurigakan")

Derived at read time. No columns, and flags never block or change status.

| Flag | Rule |
|---|---|
| **Lonjakan IP** (IP surge) | ≥ `SURGE_MIN_REPORTS` (6) reports with the same `ip_hash` within `SURGE_WINDOW_MINUTES` (5) |
| **Perangkat berulang** (repeat device) | the same `device_hash` sent more than one health report for the same school and `consumed_on` |
| **Di luar area** (outside the area) | `location_check = outside` |

Flags show as badges on queue items. A **"Ditandai lonjakan"** panel lists the surge groups from the last 24 h (count, time span, schools) with links to their reports. Both numbers go in `thresholds.ts`.

### Moderator: episodes

- **Open episodes** across all kitchens, in Beranda order (overdue first, then oldest detection). Each shows:
  - the reason, detected-at, review label, and overdue label;
  - the attached reports, linked to their queue entries;
  - the **forwarding control**;
  - a **close form** with a required note that calls `closeEpisode`.
- **Forwarding:** `none` / `simulated_puskesmas` / `forwarded_by_officer`. The last one requires `forwarding_note`. Writes `episode.forwarding_changed`. The copy never claims a notification was sent.
- Below: the last 10 closed episodes, read-only.

### Moderator: follow-up list ("Dalam tindak lanjut")

- `reviewed` and `responded` reports, most recent activity first (latest response, or `received_at`), 20 per page. Each shows the full thread (kitchen and moderator responses, reporter updates) and the **Selesai** and **Tolak** actions. Without it, a reviewed report could never be closed and a later reporter update would reach no one.

### Moderator: demo reset

A "Reset data demo" button, rendered and accepted only when `DEMO_MODE=true`, behind a typed confirmation (`RESET`). It runs the same reset as `bun run db:reset`, and the `demo.reset` audit row records the moderator as actor.

### SPPG manager

- **Status:** their kitchen's status, using the same function as Beranda.
- **Open episode:** reason, detected-at, overdue timer, and an **episode response form**.
- **Waiting for a response:** their kitchen's `reviewed` and `responded` reports whose latest non-moderator response is **not** from `sppg`. That means the report has never been answered, or the reporter added an update after the kitchen's last answer ("Ada perkembangan baru"). Each shows an "N jam" timer since `received_at` (or since the reporter's update), the thread including reporter updates, and a **report response form**.
- **Unreviewed reports:** shown only as a count ("N laporan menunggu tinjauan moderator"), with no content.
- **Menu today:** name + composition, upserting `menu(sppg_id, served_on = today WIB)`, and writing `menu.updated` with before/after. Any other date is refused.

### Responses

- Append-only, 1–`NOTE_MAX_CHARS`, `author_kind = sppg`, `author_user_id` = the manager. Writes `response.created`.
- A report response moves the report `reviewed` → `responded` (conditional update). A response on an already-`responded` report adds to the thread without a status change.
- An episode response clears "Dapur belum menjawab" ([`signals.md`](signals.md)).
- Moderators cannot write `sppg` responses.

### Public effects

- **Per-report counter:** reviewed reports show "Belum ditanggapi · N jam", counted from `received_at`, on Rapor and `/lacak` until an `sppg` response exists.
- **`/lacak`** also shows responses on the report's episode, labelled "Tanggapan pengelola untuk episode ini" (see [`report-form.md`](report-form.md)).
- **Reporter updates** (`author_kind = reporter`) are never public. They appear only on `/lacak` (to the code holder), to moderators, and to the report's own kitchen manager.

## Data

One migration:

| Change | Why |
|---|---|
| `audit_action` gets `report.status_changed`, `report.merged`, `response.created`, `menu.updated`, `episode.forwarding_changed`, with typed shapes in `audit.ts` | every staff mutation is audited |
| index `report(received_at) where status = 'received'` | the review queue |
| index `report(ip_hash, received_at)` | surge flags |
| `SURGE_MIN_REPORTS`, `SURGE_WINDOW_MINUTES` in `thresholds.ts` | flags |

The repeat-device flag reuses `report(device_hash, school_id, consumed_on)` from [`report-form.md`](report-form.md). Moderator queue and SPPG dashboard queries must meet the foundation doc's < 100 ms budgets in the scale proof.

## Tests

These are the acceptance criteria. Nothing beyond them.

**Integration (`bun test`, real Postgres):**
- Every dashboard action refuses no session and the wrong role. A manager can't respond to another kitchen's report or episode, or edit its menu.
- Tinjau / Tolak / Gabung / Selesai only allow their legal transitions, and Tolak requires a reason. A merge refuses a target from a different school, kind, or date, and refuses chains. A stale status gives the conflict message and changes nothing.
- Reviewing a teacher group report opens an episode (the `syncEpisode` wiring).
- Every mutation writes its audit row, and a failure rolls both back.
- The queue holds exactly health, safety-problem, and with-note `received` reports, in the agreed order, paginated.
- The surge, repeat-device, and outside flags trip at their thresholds.
- The manager view shows unreviewed reports only as a count.
- A report response moves the report to `responded`, and an episode response clears the overdue label.
- A reporter update added after the kitchen's response puts the report back in the manager's waiting list, and it stays visible in the moderator's follow-up list, where Selesai closes it.
- The menu upsert works for today; other dates are refused.
- `forwarded_by_officer` without a note is refused.
- Reset is refused unless `DEMO_MODE=true` and `RESET` is typed.
- Reporter updates never appear on Rapor.

**Playwright** (fulfils the foundation doc's spec 6):
1. A Guru/UKS group report (≥5 affected) is submitted through the form, keeping its code → the moderator reviews it → the kitchen turns Prioritas on Beranda → the moderator sets forwarding to the simulated Puskesmas → the manager answers the episode → the response shows on `/lacak` for that code.
2. On the seeded **overdue** episode, Rapor shows "Dapur belum menjawab" → its manager answers the episode → the label is gone.
3. The moderator rejects a report with a reason → it leaves the Rapor counts.

## Left to the builder

- Pagination style (keyset or offset) within the 20-per-page queue.
- How the seen status travels with each form.
- Component structure and copy beyond the strings quoted here.
