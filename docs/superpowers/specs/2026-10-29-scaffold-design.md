# Pantau Bergizi — Repo Scaffold Design

**Date:** 2026-10-29
**Product spec:** [`PRD_Pantau_Bergizi_V2_1.md`](../../../PRD_Pantau_Bergizi_V2_1.md) (the source of truth for features; this doc covers only the foundation)

## Intent

Pantau Bergizi is a competition entry (Web In Action, MIA 2026). We start a fresh repo from zero; the old `../web` folder was a one-shot prototype and is reference only — nothing is copied from it.

The scaffold is the foundation every feature writes onto: tooling, database, auth plumbing, route skeleton, seed data, and a live deploy. Features (report form, signal engine, rapor, dashboards) are separate plans that come after.

**Why this shape:** it's a competition, so the priorities are *fastest to build* and *free to run*, while meeting the PRD's hard requirements (permanent PostgreSQL, signed-cookie login without an external auth provider, server-side role checks, demo reset).

## Goals

1. A Next.js app that runs locally with Bun and deploys to Vercel from a public GitHub repo.
2. PostgreSQL schema for the PRD's 7 tables, migrated and seeded with "Kota Sukamaju" simulation data and demo accounts.
3. Working login/logout for the two staff roles, with a `requireRole()` helper every future server action uses.
4. Every route from the PRD sitemap exists as a stub page.
5. Signal thresholds live as constants in one file.
6. README that satisfies the competition's First Draft rules.

## Non-goals (later plans)

- Any feature logic from PRD §4 (form, signal computation, episodes, rapor, dashboards, menu card, responses, tracking, anti-abuse, /data and /metode content).
- Rate limiting for tracking-code lookup (decided in the tracking feature plan).
- A demo-reset **button** in the UI — the scaffold ships a reset **script**; the button comes with the moderator dashboard.
- Real Beranda / Rapor pages. There's no agreed visual direction yet, so building them now would mean a random design. Order after the scaffold: **(1) design direction pass** — a few mockups of Beranda + Rapor for Praffi to pick from, **(2) build those two pages** for the 1 Nov screenshots, (3) the rest of the features.
- Visual design system / theming beyond shadcn defaults (PRD §6 direction is applied in feature work).
- CI pipeline. Vercel's build is the deploy gate; `bun run check` runs locally.

## Anti-goals (failure even if it "works")

- Anything that pushes the **1 Nov** First Draft (public repo + README + live site) off schedule.
- A live site that loses data on redeploy/restart.
- Secrets (DB URL, session secret) committed to the public repo.
- An auth setup where any mutating action can run without a server-side role check.

## Constraints

| Constraint | Source |
|---|---|
| PostgreSQL, permanent, before Final (11 Nov) | PRD F10 |
| Signed cookie session, no external auth provider | PRD F7 |
| Every server action checks role server-side; SPPG manager limited to own `sppg_id` | PRD F7 |
| Demo accounts' credentials shown on `/masuk` and in README (intentionally public) | PRD F7 |
| Demo reset only enabled in demo environment | PRD F7 |
| Public GitHub repo with README: title + 1–2 sentence description, tech stack, clone → install → run, current progress | MIA First Draft rules |
| Prototype accessible online; offline backup recommended for onsite final | MIA Final rules |
| Free tiers only | Praffi |

## Stack (decided)

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions), TypeScript strict, React 19 |
| Package manager / scripts | **Bun** (`bun.lock`). App runs on Vercel's Node runtime. |
| Styling / UI | Tailwind CSS 4 + **shadcn/ui** with `"iconLibrary": "phosphor"` |
| Icons | **Phosphor** (`@phosphor-icons/react`) |
| Hosting | Vercel Hobby |
| Database | Neon Postgres (free: 0.5 GB, 100 CU-h/month, scale-to-zero after 5 min) |
| DB access | Drizzle ORM + drizzle-kit migrations |
| DB driver | `postgres` (postgres.js) over TCP — *my call*: same driver works against Neon (pooled URL) and a local Postgres, which gives us the offline backup for free. |
| Validation | Zod (env + every server action input) |
| Auth | Hand-rolled: HMAC-SHA256 signed cookie + `node:crypto` scrypt password hashes |
| Tests | `bun test` |
| QR | `qrcode` (installed when the school page feature lands, not in scaffold) |

Rejected: Supabase (free projects pause after a week idle — risky during judging), Prisma (heavier, codegen), auth libraries (PRD forbids external provider; 2 roles don't need one), monorepo/Docker (no second app).

## Repo layout

The repo root is this folder (`pantau-bergizi/`). Single app at the root.

```
pantau-bergizi/
├─ PRD_Pantau_Bergizi_V2_1.md
├─ docs/superpowers/specs/          # design docs
├─ drizzle/                         # generated SQL migrations (committed)
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                   # /            Beranda (stub)
│  │  ├─ sppg/[id]/page.tsx         # /sppg/[id]   Rapor dapur (stub)
│  │  ├─ sekolah/[code]/page.tsx    # /sekolah/[code] (stub)
│  │  ├─ lapor/[code]/page.tsx      # /lapor/[code] (stub)
│  │  ├─ lacak/page.tsx             # /lacak (stub)
│  │  ├─ data/page.tsx              # /data (stub)
│  │  ├─ metode/page.tsx            # /metode (stub)
│  │  ├─ masuk/page.tsx             # /masuk — working login form + demo credentials
│  │  └─ dasbor/page.tsx            # /dasbor — protected; shows role + sppg name (stub content)
│  ├─ components/ui/                # shadcn components
│  ├─ db/
│  │  ├─ schema.ts                  # 7 tables + enums
│  │  ├─ index.ts                   # drizzle client (server-only)
│  │  └─ seed.ts                    # Kota Sukamaju simulation data + demo users
│  └─ lib/
│     ├─ env.ts                     # Zod-parsed env, fails fast
│     ├─ auth.ts                    # password hash/verify, session sign/verify, getSession, requireRole
│     ├─ thresholds.ts              # all signal constants from PRD F2/F3/F4
│     └─ utils.ts                   # shadcn cn()
├─ .env.example
└─ README.md
```

Not committed: `PPT Technical Meeting MIA 2026.pdf` (57 MB competition material) — gitignored. *My call.*

## Naming

- Code, DB tables/columns, and enum keys in **English**. Routes and all UI copy in **Indonesian** (routes come from the PRD sitemap). *My call.*
- Status keys: `priority | attention | no_signal | no_data`, mapped to the PRD labels Prioritas / Perlu perhatian / Tidak ada sinyal / Belum ada data in one place.

## Database schema

Seven tables, as PRD F10. Postgres enums via Drizzle `pgEnum`. All timestamps `timestamptz`; `consumed_on` is a `date` (WIB calendar day).

| Table | Columns |
|---|---|
| `sppg` | `id`, `name`, `district` |
| `school` | `id`, `name`, `code` (unique, used in QR URL), `lat`, `lng`, `sppg_id` → sppg |
| `menu` | `id`, `sppg_id`, `served_on` (date), `name`, `composition`, `photo_url` (nullable), `updated_at`; unique (`sppg_id`, `served_on`) |
| `report` | `id`, `school_id`, `simulated` (bool, default false — true for seed/top-up rows; lets reset and top-up target only simulation data), `reporter_role` (teacher/student/parent), `kind` (experience/health), `consumed_on`, `received_at`, `rating` (1–5, nullable), `leftover` (none/little/lots, nullable), `problems` (enum array: stale/foreign_object/small_portion/late/none), `symptoms` (enum array: nausea/diarrhea/dizzy/other), `subject` (self/group, nullable), `affected_count` (nullable), `note` (≤300), `location_check` (inside/outside/unavailable), `status` (received/reviewed/responded/closed/rejected), `reject_reason`, `duplicate_of` → report, `token_hash` (unique), `device_hash`, `ip_hash` |
| `response` | `id`, `report_id` (nullable) **or** `episode_id` (nullable, check: exactly one set), `body`, `created_at`, `author_kind` (sppg/moderator/reporter), `author_user_id` (nullable — null for reporter updates) |
| `episode` | `id`, `sppg_id`, `first_detected_at`, `rule` (auto_multi_school/teacher_group_reviewed), `forwarding` (none/simulated_puskesmas/forwarded_by_officer), `forwarding_note`, `closed_at` |
| `user` | `id`, `email` (unique), `password_hash`, `role` (moderator/sppg_manager), `sppg_id` (nullable; required when role = sppg_manager, enforced by check) |

Indexes the obvious query paths: `report(school_id, received_at)`, `report(status)`, `school(sppg_id)`, `episode(sppg_id) where closed_at is null`.

Feature plans may add columns; the 7-table shape is fixed.

## Auth

- **Passwords:** `scrypt` (Node crypto) with a random 16-byte salt, stored as `salt:hash` hex. Verify with `timingSafeEqual`.
- **Session cookie** `pb_session`: base64url JSON payload `{ uid, role, sppgId, exp }` + `.` + HMAC-SHA256 signature with `SESSION_SECRET`. `httpOnly`, `secure` in production, `sameSite=lax`, `path=/`, 8-hour expiry.
- `getSession()` — reads + verifies cookie (signature via `timingSafeEqual`, expiry), returns typed session or `null`. No DB hit per request.
- `requireRole(...roles)` — returns the session or redirects to `/masuk` (pages) / throws (actions). SPPG ownership checks (`session.sppgId === target.sppgId`) are done in each feature action; the scaffold provides the session shape that makes it a one-liner.
- Login and logout are server actions. Login failure message is generic ("Email atau kata sandi salah").
- No middleware/proxy-based gating — checks live next to the data access, where they can't be bypassed by a route matcher mistake.

**Accepted tradeoff:** demo credentials are public (PRD requires it for judges), so anyone can act as moderator on the live site. Mitigation is the demo reset.

## Environment

`src/lib/env.ts` parses with Zod at import; missing values fail the build/boot loudly.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled URL in prod; local Postgres URL for dev/offline |
| `SESSION_SECRET` | ≥32 chars, HMAC key |
| `DEMO_MODE` | `"true"` enables reset (script refuses otherwise) |
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …` to the cron route; route rejects anything else |

`.env.example` committed; `.env*` (except example) gitignored.

## Seed data ("Kota Sukamaju", all SIMULASI)

- 4 SPPG in named kecamatan (e.g., SPPG Melati 01 — Kec. Cempaka), 12–15 schools spread across them with plausible coordinates, mixed SD/SMP/SMA/SMK.
- Menus for the last 7 days for most SPPG; at least one SPPG with today's menu missing (exercises "Menu belum diisi pengelola").
- Reports over the last 7 days: mostly positive experience reports (the denominator), plus enough variety that once the signal engine exists, the board shows each of the four statuses. Seed must be deterministic (fixed data, dates relative to "today" in WIB).
- Demo users: `moderator@pantaubergizi.id`, `sppg-melati@pantaubergizi.id`, and a second manager `sppg-kenanga@pantaubergizi.id` (needed to verify "manager can't touch another kitchen"). One shared demo password, documented in README and `/masuk`.

The exact demo scenario in PRD §7 is tuned in the feature plans; the scaffold seed just has to be realistic and cover every status.

## Keeping the live demo fresh (decided)

Seeded reports age out of the 24h window, so without help the live board turns "Belum ada data" a day after seeding. Praffi chose **daily top-up, manual reset**:

- **Daily top-up:** a Vercel Cron job (once a day at 12:00 WIB, `0 5 * * *` UTC, so simulated reports spread over 10:00–12:00 lunch hours; Hobby allows daily crons and may fire anywhere within the hour) calls `GET /api/cron/top-up`. It appends a fresh batch of simulated reports (`simulated = true`) for today's date. **It never deletes or edits anything**, so reports submitted by judges are kept (PRD F10). Idempotent: if today's simulated batch already exists, it does nothing.
- **Manual reset only:** `bun run db:reset` is run by hand (e.g. before recording the video or before the onsite final). It refuses unless `DEMO_MODE=true` **and** it's passed `--yes`, and prints the target DB host before truncating.
- Top-up and seed share one generator function, so the shape of simulated data lives in one place.

## Thresholds file

`src/lib/thresholds.ts` exports named constants for every number in PRD F2–F4 and F8: window 24h, ≥3 health complaints, ≥2 schools, ≥1 inside area, teacher group ≥5 affected, low rating < 3 from ≥5 reports, leftover min 10 reports over 7 days, response overdue 24h, location radius 150 m, backdate limit 30 days, note max 300 chars. Nothing else reads magic numbers.

## Scripts

| Script | Does |
|---|---|
| `bun dev` / `bun run build` / `bun start` | Next.js |
| `bun run lint` | ESLint (Next config) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | tests |
| `bun run check` | lint + typecheck + test |
| `bun run db:generate` | drizzle-kit generate |
| `bun run db:migrate` | apply migrations to `DATABASE_URL` |
| `bun run db:seed` | seed (idempotent on empty DB) |
| `bun run db:reset` | requires `DEMO_MODE=true` and `--yes`; prints DB host, truncates all tables, seeds |

Migrations are applied manually (`db:migrate` against Neon) before deploying a schema change — not in the Vercel build. Keeps builds free of DB side effects.

## Deploy

1. Public GitHub repo `pantau-bergizi` under Praffi's account.
2. Neon project (free) — region closest to Indonesia (AWS Singapore).
3. Vercel project linked to the repo; region `sin1`; env vars set in Vercel.
4. `db:migrate` + `db:seed` against Neon, then deploy. Push to `main` = deploy.

**Offline backup (onsite final):** local Postgres + `.env` pointing at it → `bun run db:migrate && bun run db:reset && bun run build && bun start`. Documented in README.

## Tests in scope for the scaffold

Focused, no smoke tests:
- `auth`: signed session round-trips; tampered payload rejected; tampered signature rejected; expired rejected; password hash verifies correct and rejects wrong.
- `env`: missing `SESSION_SECRET` throws.
- `cron/top-up`: rejects a request without the right bearer secret; a second run on the same day inserts nothing.

The PRD's "verify before Final" list belongs to the feature plans (mostly signal-engine unit tests).

## Done when

- `bun run check` passes; `bun run build` passes.
- Fresh clone → `bun install` → set `.env` → `db:migrate` → `db:seed` → `bun dev` works, following only the README.
- Live Vercel URL: all stub routes render; login as each demo user reaches `/dasbor` showing role (and SPPG for managers); logged-out `/dasbor` redirects to `/masuk`.
- Data survives a redeploy.
- The cron job is registered in Vercel and a manual trigger appends today's simulated reports once.
- README meets the MIA First Draft checklist.

## Left to the builder

- Exact shadcn components to add initially (only what `/masuk` needs: button, input, label, card).
- Seed names, coordinates, and report texts (Indonesian, realistic, marked simulation).
- Drizzle config details, ESLint tweaks, tsconfig path alias (`@/*`).
- Stub page copy.
