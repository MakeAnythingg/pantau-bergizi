# Roadmap to the Final (1–11 Nov 2026)

**Goal:** ship every feature the PRD §7 demo video needs, record the video, and submit the Final on **11 Nov**, with the live site working every day in between.

**Scope source:** each issue links its spec in `docs/`. This roadmap only adds dates, gates, and cut lines. It does not restate scope. Tracking issue: #10.

## Rules for the whole run

- `main` deploys automatically to https://pantau-bergizi.vercel.app, so it has to stay demo-ready. Work on one branch per issue, and merge only when the spec's Tests section passes, `bun run check` is green, and sol-loop has run.
- Follow the build order in the issues: #3 → #4 → #5 → #6. #7 can run in parallel.
- Each issue gets its own implementation plan in `docs/superpowers/plans/` (one per subsystem), written the day work on it starts.
- Push nothing to `main` until the `first-draft` tag exists and the First Draft is submitted.

## Why this order

The §7 video follows one story, and each step needs one issue:

| Video beat | Needs |
|---|---|
| Scan the school QR, rate the meal | #3 school page + QR, #4 experience path |
| Nausea reports from 2 schools trigger Prioritas | #4 health path, #5 episodes |
| Teacher group report, moderator review | #4 kelompok, #6 moderator queue |
| Kitchen answers publicly | #6 SPPG dashboard |
| Reporter opens the tracking code and sees the answer | #4 `/lacak` (+ #6 responses) |
| Closing on `/metode` + `/data` | #7 |

#8 (scale proof) isn't in the video, so it moves to **after the Final, before the 28 Nov pitch**.

## Schedule

| Date | Work | Gate at end of day |
|---|---|---|
| **1 Nov** | Submit the First Draft (#9): tag `first-draft`, take screenshots of Beranda and Rapor dapur, PDF ≤10 pages, repo + README | Submitted |
| 2 Nov | #3 school page, QR, print poster, WhatsApp share, Rapor per-menu table | #3 merged |
| 3–4 Nov | #4 report form (both paths), Turnstile, device cookie, tracking code, `/lacak` | #4 merged |
| 5–6 Nov | #5 episodes, `lockKitchen`, `syncEpisode`, `closeEpisode`, Beranda/Rapor episode UI. Start #7 `national.ts` figure re-check in parallel. | **Checkpoint:** #5 merged, otherwise trim #6 (see cut lines) |
| 7–8 Nov | #6 moderator and SPPG dashboards, "Belum ditanggapi" counter | #6 merged |
| 8 Nov | #7 `/data` + `/metode`. Praffi approves the Indonesian copy. | #7 merged |
| 9 Nov | Walk the PRD "Yang harus diverifikasi sebelum Final" checklist on the live site. Run the 20 s phone user test. Reset the demo data. Record the video (≤5 min, §7 flow). | Video recorded |
| 10 Nov | Proposal ≤30 pages, originality letter, update the README progress list | Docs done |
| **11 Nov** | Submit the Final | Submitted |
| 12–27 Nov | #8 scale proof (results go in the README), pitch deck ≤15 slides, offline demo rehearsal | Pitch ready |
| **28 Nov** | Onsite pitch | — |

The buffer is thin: 9 and 10 Nov are the only slack days. If an issue runs over, apply the cut lines below instead of pushing the video later.

## Cut lines (if behind, trim in this order)

1. **#8**: already moved to after the Final.
2. **#7**: ship `/data` with the verified figures and a shorter `/metode` that still interpolates `thresholds.ts`. Finish the full 10 sections after the Final.
3. **#6**: keep the review queue (Tinjau · Tolak · Gabung duplikat), episode close, and the SPPG episode response, because the video and the Final checklist need them. Defer the surge panel, the follow-up list, the demo reset button (`db:reset` covers it), and the SPPG menu editing.
4. **#3**: defer the A4 print poster styling. The QR, the link, and the WhatsApp share stay.

Never cut: anything on the PRD Final verification checklist, server-side role and ownership checks, Turnstile and rate limits, or the tracking code being shown only once.

## Per-issue definition of done

Same for every issue, taken from #10:

- [ ] The spec's Tests section passes (integration + Playwright specs listed in the issue)
- [ ] `bun run check` is green
- [ ] sol-loop has run, and the PR body is written with the `pr` skill
- [ ] Merged to `main`, and the live site has been checked once after deploy
- [ ] The issue's box is ticked in #10, and the README progress list is updated

## Next step

Write the implementation plan for #3 (`docs/school-page.md`), then #4 (`docs/report-form.md`), and start #3 on 2 Nov.
