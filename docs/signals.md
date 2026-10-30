# Pantau Bergizi — Signals and Prioritas Episodes

**Written:** 2026-10-31
**Product spec:** [`PRD_Pantau_Bergizi_V2_1.md`](../PRD_Pantau_Bergizi_V2_1.md) F2 (safety signal, episodes, forwarding) and F4 (the "Dapur belum menjawab" label) define *what*. [`engineering-foundation.md`](engineering-foundation.md) defines the shared building blocks (`thresholds.ts`, `audit()`, tests). This doc only covers *how* episodes are opened, kept, shown, and closed. If the two disagree, fix the PRD; don't restate it here.

## Intent

`computeSignal` (`src/lib/signal.ts`) already applies the F2 rules live to the last 24 h of reports. What's missing is memory: today a kitchen that reaches Prioritas turns quiet again as soon as its reports leave the window, whether or not anyone acted. An **episode** makes Prioritas stick until a moderator closes it, keeps the reports that caused it, and makes an unanswered outbreak visible.

**Key property.** A sliding window can only *remove* reports, so Prioritas can only *start* at write time (a report is inserted, or a moderator changes one). Episodes are therefore opened only on the write path, never on read and never by cron.

## Goals

1. Prioritas holds while an episode is open, no matter how the 24 h window moves.
2. Every episode records its first detection time and its reports, and a closed episode records why and by whom.
3. A rejection that removes the evidence closes the episode automatically, with the reason saved.
4. "Dapur belum menjawab" appears when an open episode goes unanswered for `RESPONSE_OVERDUE_HOURS`.

## Non-goals

- Moderator and SPPG UI: review/reject/merge buttons, the close-episode form, the forwarding form, the episode response form, the IP surge flag, and the per-report public counter ("Belum ditanggapi · 18 jam"). These go in the dashboard spec, which wires forms to the functions defined here.
- Data nasional and Metode (their own content spec).
- The F3 "menu dengan sisa tertinggi" gap (Rapor polish).
- Changing the F2 thresholds or the rules inside `computeSignal`.

## Anti-goals

- A Prioritas kitchen turning quiet because time passed.
- Two open episodes for one kitchen.
- The same evidence opening a second episode after a moderator closed the first.
- A status drop with no saved reason.
- Episode writes during a GET.

## Decisions

### Which reports feed the signal

- **Counting** = not rejected and not a merged duplicate (existing `counts`).
- **Feeds today's signal** = counting, received within `SIGNAL_WINDOW_HOURS`, and meal date (`consumed_on`) today or yesterday in WIB (existing `feedsSignal`). Older-meal reports are stored and shown on Rapor with a "makan [tanggal]" badge, but never count toward the signal, attach to an episode, or open one.
- **Excluded from the Prioritas rules:** reports attached to a **closed** episode. They still count for Perlu perhatian, coverage, and ratings. So after a close, the kitchen shows Perlu perhatian until those reports leave the window, and only new reports that reach the threshold on their own can open a new episode.

### Kitchen status

```
open episode            → Prioritas (reason from the episode, see below)
otherwise               → computeSignal(signal reports, with closed-episode reports kept out of the Prioritas rules)
```

How `computeSignal` learns which reports to keep out of the Prioritas rules is left to the builder. Its output must not change for kitchens with no closed episodes.

### `syncEpisode(tx, sppgId, now)`

One function, called inside the transaction of **every write that can change a signal**: report insert (the form and the cron top-up), and moderator review, reject, and merge (wired in the dashboard spec). It runs in this order:

1. **Open episode exists:**
   - Attach every counting signal report of this kitchen that isn't attached yet (`report.episode_id`).
   - Re-run the rules over the episode's **counting attached reports with no time window**. If they no longer reach Prioritas, close it automatically: `closed_at = now`, `closed_by_user_id = null`, `closed_note = "Ditutup otomatis: laporan ditolak — <alasan tolak>"` (the reject reason of the report that tipped it; for a merge, "laporan digabung sebagai duplikat"), and an `episode.closed` audit row with a null actor.
2. **No open episode, and the live signal is Prioritas:** insert an episode with `rule` = `auto_multi_school` or `teacher_group_reviewed` (whichever rule fired) and attach the reports that fired it. `first_detected_at` defaults to now.

Without a time window, the re-check in step 1 can only close an episode because a report was rejected or merged, never because time passed.

**Concurrency.** The open-episode index becomes **unique** (`episode(sppg_id) where closed_at is null`). If a concurrent insert loses the race, it catches the unique violation, re-reads the open episode, and attaches to it, so the report is never lost.

### `closeEpisode(tx, episodeId, note, actorUserId)`

- Takes a moderator user. `note` is required (trimmed, 1–`NOTE_MAX_CHARS`). It sets `closed_at`, `closed_note`, `closed_by_user_id`, and writes `episode.closed` with before/after. Closing an already-closed episode throws.
- The role check sits in the dashboard action that calls it. This function assumes the caller is authorized.

### What an episode shows

All of it is derived. No snapshot columns.

- **Reason:** `computeSignal` over the episode's counting attached reports (no window), plus "Terdeteksi <tanggal jam> WIB" from `first_detected_at`.
- **Review label:** for `auto_multi_school` episodes, *Otomatis, belum ditinjau moderator* while any counting attached report is `received`, otherwise *Ditinjau moderator*. A newly attached report flips it back. `teacher_group_reviewed` episodes are always *Ditinjau moderator*.
- **Overdue:** "Dapur belum menjawab · N jam" when the episode is open, older than `RESPONSE_OVERDUE_HOURS`, and has no `response` with `episode_id` = this episode and `author_kind = sppg`. Only a response to the episode counts; a reply to one of its reports doesn't.
- **Forwarding:** the existing `forwarding` / `forwarding_note`, shown as the PRD's three labels (the setter is in the dashboard spec).

### Beranda

- Prioritas kitchens sort first: overdue first, then oldest `first_detected_at`, then name. Other statuses keep the existing order.
- A Prioritas row shows the episode reason, the review label, and the overdue label when it applies.

### Rapor dapur

- **Open episode block:** reason, detected-at, review label, forwarding, overdue label, and the kitchen's episode response(s) when present.
- **"Riwayat episode":** the last 5 closed episodes (detected at, closed at, close note, time to first kitchen episode response, or "tidak dijawab"). No pagination.
- Older-meal reports in "Laporan terbaru" get the "makan [tanggal]" badge.

## Data

One migration:

| Change | Why |
|---|---|
| `report.episode_id` → `episode`, nullable, plus index `report(episode_id)` | attach, re-check, review label |
| `episode.closed_note text` | the saved reason (manual and automatic) |
| `episode.closed_by_user_id` → `user`, nullable (null = system) | who closed it |
| `episode(sppg_id) where closed_at is null` becomes **unique** | at most one open episode per kitchen |
| index `response(episode_id)` | the overdue check |
| `audit_action` gets `episode.closed`, with its typed shape in `audit.ts` | closes are audited |

**Seed (Kota Sukamaju):**
- one **open, overdue** episode with no kitchen response;
- one open episode the kitchen has answered;
- one closed episode with a moderator note;
- one quiet kitchen with 2 qualifying complaints already seeded (e2e 2 sends the third).

The top-up calls `syncEpisode` for each kitchen it writes to.

## Tests

These are the acceptance criteria. Nothing beyond them.

**Integration (`bun test`, real Postgres):**
- 3 health complaints from 2 schools, 1 inside → exactly one episode, with those reports attached. A 4th complaint attaches to it. Two concurrent qualifying inserts still produce one episode and lose no report.
- A Guru/UKS group report with ≥5 affected → Perlu perhatian and no episode. After it's reviewed → a `teacher_group_reviewed` episode.
- At now + 25 h the open episode still makes the kitchen Prioritas.
- Rejecting an attached report so the rule fails → closed automatically, with the note, a null `closed_by_user_id`, and a system audit row; the status drops. Merging a duplicate re-checks the episode the same way.
- `closeEpisode` rejects an empty note and writes `episode.closed`. After a close, the same reports neither reopen an episode nor show Prioritas (the kitchen shows Perlu perhatian), and new reports that reach the threshold on their own open a new episode.
- Overdue shows after 24 h with no episode response. An `sppg` episode response clears it, and an `sppg` reply to a single report doesn't.
- A meal from 2+ days ago never attaches and never triggers.
- The review label flips from *belum ditinjau* to *Ditinjau* as attached reports get reviewed, and back again when a new one attaches.
- Beranda order: overdue Prioritas, then oldest detection, then the other statuses.

**Playwright:**
1. On a fresh seed, Rapor for the overdue kitchen shows Prioritas, "Dapur belum menjawab", and "Riwayat episode".
2. Sending a 3rd qualifying complaint through the real form (2 already seeded for a quiet kitchen) turns that kitchen Prioritas on Beranda.

## Left to the builder

- How `computeSignal` is told which reports to keep out of the Prioritas rules.
- Query shape for Beranda/Rapor, as long as each is served by an index and stays inside the foundation doc's scale budgets.
- Exact copy beyond the strings quoted here.
