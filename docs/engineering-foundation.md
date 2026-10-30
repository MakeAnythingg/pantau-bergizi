# Pantau Bergizi — Engineering Foundation

**Restated:** 2026-10-30 (replaces the 2026-10-29 scaffold design)
**Product spec:** [`PRD_Pantau_Bergizi_V2_1.md`](../PRD_Pantau_Bergizi_V2_1.md) is the source of truth for features. This doc covers how the app is built: stack, tooling, security, privacy, tests, and the order of work.

## Intent

Pantau Bergizi is a competition entry (Web In Action, MIA 2026). Nobody operates it after the onsite final on 28 Nov.

The first scaffold was built "fastest to build, free to run", and that was the wrong bar. We now build it **as if real children's health reports flow through it**: no shortcuts on security, data integrity, abuse handling, or tests. We skip what only a real operator would need: on-call, extra backups, legal or privacy review, and paid services.

## Goals

1. Tooling that rejects sloppy code before review: strict types, type-aware lint, a formatter, and dead-code checks.
2. CI that gates `main`: nothing merges without lint, types, tests, e2e tests, a dependency audit, and a migration drift check.
3. A hardened staff login and security headers on every response.
4. Privacy by default for anonymous reporters, and an audit trail for every staff action.
5. A data model that would hold national scale, proven by a local load seed with timing budgets.

## Non-goals

- Observability (Sentry, Vercel Analytics/Speed Insights, health endpoint, uptime monitor). Deferred; revisit only if time allows after Final.
- Infrastructure for national scale (queues, caches, read replicas). We prove the design scales; we don't run it at scale.
- Git hooks. CI is the gate.
- Automated production migrations. Migrations against Neon stay manual.
- A demo-reset **button** before the moderator dashboard exists.

## Anti-goals (failure even if it "works")

- A live site that loses data on redeploy or restart.
- Secrets (DB URL, session/HMAC keys) in the public repo or in GitHub Actions.
- Any mutating action that runs without a server-side role check, or a manager touching another kitchen's data.
- A rate limit that blocks a whole class reporting from one school wifi (PRD: "IP tidak memblokir").
- Raw IPs, raw GPS coordinates, or raw tracking codes stored anywhere.
- A staff change that isn't in `audit_log`.

## Constraints

| Constraint | Source |
|---|---|
| PostgreSQL, permanent, before Final (11 Nov) | PRD F10 |
| Signed cookie session, no external auth provider | PRD F7 |
| Every server action checks role server-side; SPPG manager limited to own `sppg_id` | PRD F7 |
| Demo accounts' credentials shown on `/masuk` and in README (intentionally public) | PRD F7 |
| Demo reset only enabled in demo environment | PRD F7 |
| Tracking code from a CSPRNG, stored hashed, lookup rate-limited; no coordinates stored | PRD anti-abuse, privacy |
| IP only flags surges to moderators, never blocks | PRD anti-abuse |
| Public GitHub repo with README: title, description, tech stack, clone → install → run, current progress | MIA First Draft rules |
| Prototype online; offline backup recommended for onsite final | MIA Final rules |
| Free tiers only | Praffi |

## Stack

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, `cacheComponents`), React 19, TypeScript |
| Package manager / scripts | Bun (`bun.lock`). App runs on Vercel's Node runtime. |
| Styling / UI | Tailwind CSS 4 + shadcn/ui (Base UI) with Phosphor icons |
| Hosting | Vercel Hobby, region `sin1` |
| Database | Neon Postgres free tier (ap-southeast-1) |
| DB access | Drizzle ORM + drizzle-kit migrations, `postgres` (postgres.js) driver. The same driver works against Neon and a local Postgres, which gives the offline backup. |
| Validation | Zod (env + every server action input) |
| Auth | Hand-rolled HMAC-SHA256 signed cookie + `node:crypto` scrypt |
| Bot check | Cloudflare Turnstile (free), on the report form |
| Tests | `bun test` (unit + integration on real Postgres), Playwright (e2e) |
| QR | `qrcode`, installed with the school page feature |

Rejected: Supabase (free projects pause when idle), Prisma (heavier, codegen), auth libraries (PRD forbids an external provider), Upstash/Vercel Firewall for rate limiting (Postgres already does it, and stays testable), monorepo/Docker (no second app).

## Code quality tooling

**oxlint is the only linter.** ESLint, `eslint-config-next`, and `eslint.config.mjs` are removed. Run `@oxlint/migrate` on the current ESLint config first so no rule silently drops.

- Config in `oxlint.config.ts`. Plugins: `typescript`, `react` (includes `rules-of-hooks` and `exhaustive-deps`), `nextjs`, `jsx-a11y`, `import`, `unicorn`.
- **Type-aware rules on** (`oxlint --type-aware`, tsgolint): `no-floating-promises`, `no-misused-promises`, `no-unsafe-*`, `no-unnecessary-condition`, and the rest of what typescript-eslint `strict-type-checked` would give us.
- **[anti-slop](https://github.com/dmmulroy/anti-slop)** vendored under `tools/oxlint/anti-slop/` and loaded through `jsPlugins`, all rules `error`, plus `oxc/no-accumulating-spread`. Pin `@oxlint/plugins` to the same version as `oxlint`.
- **oxfmt** formats. CI fails on unformatted files.
- **knip** finds unused files, exports, and dependencies.
- **Stricter tsconfig:** add `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` on top of `strict`.

Everything existing code fails on is fixed at the source, not suppressed. A disable comment needs a one-line reason.

## CI

GitHub Actions (free for public repos), on every PR and push to `main`:

1. `bun install --frozen-lockfile`
2. `oxfmt --check`, `oxlint --type-aware`, `bun run typecheck`, `knip`
3. Migration drift: fail if `src/db/schema.ts` and `drizzle/` disagree (`drizzle-kit check`, plus a `drizzle-kit generate` that must produce no new file)
4. `bun audit`
5. `bun test` against a Postgres service container
6. Playwright against `bun run build && bun start` with a migrated, seeded DB

`main` is protected: PRs only, CI must pass. Dependabot is on for **security updates only**. No production secret lives in GitHub. Neon migrations are run by hand (see [Deploy](#deploy)).

## Security

### Headers

Static headers from `next.config.ts` `headers()` on every route. *Accepted trade-off:* a nonce CSP would force every page to render dynamically and defeat `cacheComponents`, so scripts allow `'unsafe-inline'`.

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=()` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |

### Staff login

- **Passwords:** scrypt with a random 16-byte salt, stored as `salt:hash`, verified with `timingSafeEqual`.
- **Session cookie** `pb_session`: base64url JSON `{ uid, role, sppgId, ver, exp }` + `.` + HMAC-SHA256 with `SESSION_SECRET`. `HttpOnly`, `Secure` in production, `SameSite=Lax`, `path=/`. Lifetime shortened from 8 hours to **4 hours** (*my call*).
- **Revocation:** `user.session_version` (int). The session carries `ver`; `getSession()` checks it (plus role and `sppg_id`) against the DB on every staff page and action, so bumping it, or deleting/changing the account, logs that user out everywhere immediately. One indexed lookup per staff request; worth it.
- **Throttling:** failed logins are limited through the shared rate limiter: 5 per 15 min per (email, IP) pair and 20 per 15 min per IP (*my call*). Keying on the pair, not the email alone, means a stranger can't lock a public demo account for the judges; a distributed attacker still meets scrypt and the per-IP limit. Throttled attempts skip the password check; a success clears that pair's failures. An unknown email still runs scrypt against a dummy hash so timing doesn't reveal which accounts exist. The failure message stays generic.
- `requireRole(...roles)` returns the session or redirects (pages) / throws (actions). Ownership checks (`session.sppgId === target.sppgId`) live in each feature action, next to the data access. No proxy/middleware gating.

*Accepted trade-off:* demo credentials are public (PRD), so anyone can act as moderator on the live site. Mitigations: the demo reset, and `audit_log` shows exactly what was done.

### Rate limiter

One Postgres-backed limiter in `src/lib/rate-limit.ts`, used by login, the report form, and tracking-code lookup. Table `rate_limit(key, window_start, count)` with a fixed window; one upsert per check. Keys are namespaced (`login:email-ip:…`, `login:ip:…`, later `report:ip:…`, `lacak:ip:…`). The part after the prefix is always a `keyedHash` (a branded type, so a raw IP or email can't be passed by mistake). Rows older than 24 hours are deleted by the daily cron.

For the report form, the **per-device** limit (one experience survey per device per school per consumption date, from the PRD) does the real work. The **per-IP** limit only stops automated floods and must be high enough that a full class on one school wifi passes (*my call:* 120 per 10 min). Turnstile handles bots.

## Privacy

- **IP:** never stored raw. `ip_hash = HMAC-SHA256(IP_HASH_SECRET, ip)`. A plain SHA of an IPv4 address can be reversed by brute force; a keyed hash can't. It appears in `rate_limit` keys (deleted after 24h) and in `report.ip_hash`, which the PRD needs for flagging surges to moderators.
- **Location:** the browser sends coordinates once; the server compares them with the school's coordinates (150 m radius) and stores only `inside | outside | unavailable`. Raw coordinates are never written or logged.
- **Tracking code:** 10+ characters from a CSPRNG in an unambiguous alphabet, shown once, stored only as a hash (`report.token_hash`). Lookup is rate-limited.
- **Device:** `device_hash` from a random first-party cookie, used only for the one-survey-per-device rule.

## Audit trail

Table `audit_log(id, at, actor_user_id, action, entity, entity_id, before jsonb, after jsonb)`, append-only. One helper, `audit(tx, …)`, takes the open Drizzle transaction, so every staff mutation and its audit row commit or roll back together. Typed `action` values (e.g. `report.status_changed`, `episode.forwarding_changed`, `response.created`, `menu.updated`, `demo.reset`); no free-form strings.

The demo reset truncates every table **except** `audit_log`, then writes a `demo.reset` row.

## Database schema

Postgres enums via Drizzle `pgEnum`. All timestamps `timestamptz`; `consumed_on` / `served_on` are `date` (WIB calendar day). The PRD's 7 product tables plus 2 infrastructure tables (`rate_limit`, `audit_log`).

| Table | Columns |
|---|---|
| `sppg` | `id`, `name`, `district` |
| `school` | `id`, `name`, `code` (unique, used in QR URL), `lat`, `lng`, `sppg_id` → sppg |
| `menu` | `id`, `sppg_id`, `served_on`, `name`, `composition`, `photo_url` (nullable), `updated_at`; unique (`sppg_id`, `served_on`) |
| `report` | `id`, `school_id`, `simulated`, `reporter_role`, `kind`, `consumed_on`, `received_at`, `rating`, `leftover`, `problems[]`, `symptoms[]`, `subject`, `affected_count`, `note` (≤300), `location_check`, `status`, `reject_reason`, `duplicate_of` → report, `token_hash` (unique), `device_hash`, `ip_hash` |
| `response` | `id`, `report_id` **or** `episode_id` (check: exactly one), `body`, `created_at`, `author_kind`, `author_user_id` (nullable) |
| `episode` | `id`, `sppg_id`, `first_detected_at`, `rule`, `forwarding`, `forwarding_note`, `closed_at` |
| `user` | `id`, `email` (unique), `password_hash`, `role`, `sppg_id` (check: required for `sppg_manager`), `session_version` (default 0) |
| `rate_limit` | `key`, `window_start`, `count`; primary key (`key`, `window_start`) |
| `audit_log` | see [Audit trail](#audit-trail) |

Every board, Rapor, dashboard, and list query is served by an index, and every list that can grow is paginated. Existing indexes: `report(school_id, received_at)`, `report(status)`, `school(sppg_id)`, `episode(sppg_id) where closed_at is null`. Feature work adds indexes alongside the queries that need them, and the scale proof checks them.

## Scale proof

`bun run db:seed:scale` (local only, refuses unless `DATABASE_URL` points to localhost) generates national volume: ~30k SPPG, ~300k schools, ~5M reports over 30 days. It never runs in CI or on Neon (0.5 GB limit).

Budgets, measured with `EXPLAIN (ANALYZE, BUFFERS)` on a warm local DB:

| Query | Budget |
|---|---|
| Beranda board (statuses for one city/district page) | < 200 ms |
| Rapor dapur (one SPPG: status, 7-day trend, leftovers) | < 100 ms |
| Moderator queue page | < 100 ms |
| SPPG dashboard | < 100 ms |
| Tracking-code lookup | < 10 ms |

Results (plans + timings) go in the README. Runs last, once all feature queries exist.

## Environment

`src/lib/env.ts` parses with Zod on first use (`getEnv()`, cached), not at import, so `next build` runs without runtime secrets; missing values fail loudly on the first request that needs them.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled URL in prod; local Postgres for dev/offline |
| `SESSION_SECRET` | ≥32 chars, session HMAC key |
| `IP_HASH_SECRET` | ≥32 chars, keyed IP hash. Separate from `SESSION_SECRET` so rotating one doesn't affect the other. |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to `/api/cron/top-up` |
| `DEMO_MODE` | `"true"` enables seed/reset |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Added with the report form. Tests use Cloudflare's documented always-pass test keys. |

`.env.example` committed; every other `.env*` gitignored.

## Demo data

- **Seed ("Kota Sukamaju", all SIMULASI):** 4 SPPG, 12–15 schools, 7 days of menus (one SPPG missing today's), reports covering every status, deterministic with dates relative to today in WIB. Demo users `moderator@`, `sppg-melati@`, `sppg-kenanga@pantaubergizi.id`, one shared password shown on `/masuk` and in the README.
- **Daily top-up:** Vercel Cron at 12:00 WIB (`0 5 * * *` UTC) calls `/api/cron/top-up`. It appends today's simulated reports, never deletes or edits, and is idempotent. The same run deletes `rate_limit` rows older than 24h.
- **Manual reset:** `bun run db:reset --yes`, refused unless `DEMO_MODE=true`; prints the target host first. Seed and top-up share one generator.

## Thresholds

`src/lib/thresholds.ts` holds every number from PRD F2–F4 and F8. Nothing else reads magic numbers, and `/metode` shows them verbatim.

## Tests

Focused, no smoke tests, no tests for deleted code.

- **Unit / integration (`bun test`, real Postgres):** auth (sign/verify, tamper, expiry, password), env, session revocation via `session_version`, rate limiter (window, reset, the shared-wifi case), `audit()` rolls back with its transaction, top-up idempotency and cron auth, signal rules, plus each feature's own logic.
- **Playwright (≈6 specs, before 1 Nov for existing pages; more with each feature):**
  1. Login as each role; logged-out `/dasbor` redirects to `/masuk`
  2. A manager cannot act on another kitchen
  3. Login throttling kicks in after repeated failures
  4. Beranda and Rapor dapur render on a mobile viewport
  5. Report submit → tracking code → lookup *(with the form)*
  6. Moderator review flow *(with the dashboard)*
- Every bug fix lands with a test that fails without it.

## Scripts

| Script | Does |
|---|---|
| `bun dev` / `bun run build` / `bun start` | Next.js |
| `bun run lint` | `next typegen && oxlint --type-aware` (route types must exist for type-aware rules) |
| `bun run format` | `oxfmt` |
| `bun run typecheck` | `next typegen && tsc --noEmit` |
| `bun run knip` | unused files/exports/deps |
| `bun test` | unit + integration |
| `bun run e2e` | Playwright |
| `bun run check` | format check + lint + typecheck + knip + test (e2e runs separately) |
| `bun run db:generate` / `db:migrate` | drizzle-kit |
| `bun run db:seed` / `db:reset --yes` | demo data (`DEMO_MODE=true` only) |
| `bun run db:seed:scale` | national-volume seed, localhost only |

## Deploy

- GitHub `MakeAnythingg/pantau-bergizi` (public). Merging to `main` deploys to Vercel (`pantau-bergizi.vercel.app`, `sin1`).
- Neon is connected through Vercel Storage. Before merging a schema change, run `bun run db:migrate` by hand against the **unpooled** Neon URL.
- **Offline backup (onsite final):** local Postgres + `.env` → `bun run db:migrate && bun run db:reset --yes && bun run build && bun start`.

## Repo layout

```
pantau-bergizi/
├─ PRD_Pantau_Bergizi_V2_1.md
├─ docs/
│  ├─ engineering-foundation.md   # this doc
│  └─ design/mockups/             # visual direction mockups
├─ drizzle/                       # generated SQL migrations (committed)
├─ e2e/                           # Playwright specs
├─ tools/oxlint/anti-slop/        # vendored oxlint plugin
├─ .github/workflows/ci.yml
├─ scripts/                       # db seed/reset/seed:scale
└─ src/
   ├─ app/                        # routes from the PRD sitemap (Indonesian)
   ├─ components/                 # ui/ = shadcn
   ├─ db/                         # schema, client, seed, simulate, top-up, queries
   └─ lib/                        # env, auth, session, rate-limit, audit, thresholds, signal
```

Naming: code, tables, and enum keys in English; routes and UI copy in Indonesian. Status keys `priority | attention | no_signal | no_data` map to the PRD labels in one place.

## Order of work

**Before 1 Nov (First Draft), all of it:**

1. Tooling: oxlint (+ type-aware, anti-slop) replacing ESLint, oxfmt, knip, stricter tsconfig; fix everything they flag.
2. CI + `main` protection + Dependabot security updates.
3. Security headers.
4. Rate limiter + login throttling + `session_version` + 4h cookie + `IP_HASH_SECRET` (simulated reports use the keyed hash; existing rows are all simulated, so reseed instead of migrating).
5. Playwright setup + specs 1–4.
6. `audit_log` + `audit()` helper; reset keeps the log.
7. README: stack, scripts, progress, link to this doc.

**With each feature after 1 Nov:** the report form brings Turnstile, form/lookup rate limits, the hashed tracking code, and the server-side location check; dashboards write audit rows; each feature brings its e2e spec and its indexes.

**Last:** the scale proof and its README section.

## Left to the builder

- Exact oxlint rule severities beyond the plugins and rules named here.
- Exact `knip` ignores for Next.js entry points.
- The Playwright DB lifecycle (one seeded DB per run is enough).
- How `before`/`after` snapshots are shaped per audit action, as long as they're typed.
