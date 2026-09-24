# LykkeCup App — Project Context

**Last updated:** 2026-09-24

This document helps a new AI coding agent continue development without prior chat history. Prefer verifying against the codebase over assuming.

**Evidence legend used below**

| Tag | Meaning |
|-----|---------|
| **Confirmed** | Visible in current source / migrations |
| **Inferred** | Strongly implied by code structure or usage |
| **Conversation / intent** | From recent agent work or docs; may not be fully shipped |
| **Unverified** | Not visible in repo (e.g. remote Supabase schema, Vercel settings) |

---

## 1. Project purpose and primary user groups

**Confirmed**

LykkeCup is a football (soccer) event for LykkeLiga. This monorepo is a **Next.js** app that serves two surfaces:

1. **KontrolCenter** — staff tool for planning and running LykkeCup 2026: players, coaches, clubs, team formation, tournament pools/schedule, match program, feedback, lists/exports, analytics, ticket sales overview, and Galla QR check-in analytics.
2. **Public LykkeCup26 app** (`/lykkecup26`, also rewritten from `/`) — participant-facing PWA-style site: program, practical info, find venue, news, support/fundraising, player/coach public profiles, “Mit LykkeCup”, guest guestbook, messages.

**Primary users**

| Group | Surface | Access |
|-------|---------|--------|
| Organizers / staff | KontrolCenter (`/admin`, `/spillere`, …) | Supabase Auth login |
| Admins | Same + Lockdown toggle, some RLS | `app_metadata.role = "admin"` |
| Entrance staff (Galla) | `/hemmeliglykkescanner` | Public secret URL (+ optional access code); no login |
| Players / coaches / guests | `/lykkecup26/*` | Public (anon) |
| Club contacts | `/coach-feedback` | Public feedback form |

**Hard-coded event UUID (KontrolCenter / LC26 data):**  
`ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf` — exported as `LYKKECUP_EVENT_ID` / `TURNERING_EVENT_ID` / `LYKKECUP26_EVENT_ID` in `lib/players.ts`, `lib/turnering.ts`, `lib/lykkecup26-public.ts`.

**Galla (WordPress Event Tickets) event id:** `16899` (`GALLA_EVENT_ID` in `lib/galla-scanner-config.ts`).

---

## 2. Overall architecture and folder structure

**Confirmed**

```
LykkeCup_App/
├── app/                      # Next.js App Router
│   ├── (app)/                # Authenticated KontrolCenter shell (layout + AppShell)
│   ├── lykkecup26/           # Public participant app
│   ├── api/                  # Route handlers
│   ├── hemmeliglykkescanner/ # Galla QR scanner (public)
│   ├── login|glemt-kode|nulstil-kode/
│   ├── coach-feedback/       # Public club feedback
│   ├── kontrolcenter-dashboard/  # Currently disabled (see §10)
│   ├── print/teams/          # Printable team lists
│   └── status/               # Simple public status page
├── components/               # UI by domain (holddannelse, turnering, lykkecup26, galla-scanner, …)
├── lib/                      # Domain logic, server/browser data access, schedulers
├── types/                    # App-level TS models (not generated Supabase types)
├── supabase/
│   ├── migrations/           # Incremental DDL (44 files as of this write)
│   ├── scripts/              # Manual SQL helpers
│   └── *.sql                 # Storage bucket setup (outside migrations/)
├── docs/GALLA_SCANNER.md     # Galla scanner ops guide
├── proxy.ts                  # Auth gate / public path rules (Next middleware role)
├── AGENTS.md / CLAUDE.md     # Point agents to Next.js docs in node_modules
└── public/                   # Static assets, SW, logos
```

**Request flow (inferred + confirmed)**

- `proxy.ts` runs on matched routes: session via `@supabase/ssr`, public allowlist, rewrite `/` → `/lykkecup26`, redirect unauthenticated users to `/login`.
- There is **no** `middleware.ts` file; **Confirmed** that auth logic lives in `proxy.ts` (Next.js 16 project convention — see `AGENTS.md`).
- KontrolCenter pages under `app/(app)/` wrap children in `AppShell` + planning Lockdown + player modal providers (`app/(app)/layout.tsx`).
- Data access: browser `lib/supabase.ts` / `lib/auth-browser.ts` (anon key) and server `createServerSupabase()` in `lib/auth-server.ts`. No service-role key in app code (**Confirmed**).

---

## 3. Technologies, frameworks, libraries

**Confirmed** (`package.json`)

| Layer | Choice |
|-------|--------|
| Framework | Next.js **16.2.3** (App Router) |
| UI | React **19.2.4**, Tailwind CSS **4**, Lucide icons |
| Backend / DB | Supabase JS **2.x**, `@supabase/ssr` |
| Charts | `@nivo/bar`, `@nivo/line`, `@nivo/pie` |
| QR scanning | `@zxing/browser` |
| Map zoom | `react-zoom-pan-pinch` |
| Analytics (product) | `@vercel/analytics` |
| Language | TypeScript 5 |

**Agent note (Confirmed):** `AGENTS.md` — this Next.js version may differ from training data; check `node_modules/next/dist/docs/` before novel API usage.

---

## 4. Supabase architecture

### 4.1 Tables

#### Core / legacy tables (used heavily; **CREATE not in this repo**)

**Confirmed usage; Unverified full DDL** (assumed created earlier in Supabase):

| Table | Role |
|-------|------|
| `players` | Participants (level, club, age, ticket_id, …) |
| `coaches` | Coaches |
| `teams` | Teams (`nickname`, `is_completed` added via SQL in repo) |
| `team_members` | Player ↔ team |
| `team_coaches` | Coach ↔ team |
| `pools` | Tournament pools (`period_id`, `is_closed`) |
| `matches` | Scheduled matches |
| `venues` | Locations |
| `courts` | Courts (`court_type` enum: mini/kort/stor) |
| `court_availability` | Court open windows |
| `court_breaks` | Court breaks |
| `level_schedule_settings` | Per-level planning (duration, pool targets, …) |
| `profiles` | Auth user profile (`full_name`, `avatar_url`) |
| `club_feedback` | Club/coach feedback tickets |

#### Tables created in `supabase/migrations/` (**Confirmed**)

| Table | Purpose |
|-------|---------|
| `lc26_public_messages` | Staff-published messages for public app |
| `lc26_guest_messages` | Public guestbook / guest posts |
| `lc_analytics_page_views` | Page view events (insert-only; read via RPC) |
| `player_change_log` / `coach_change_log` | Audit of field edits |
| `club_feedback_internal_messages` | Internal staff thread on feedback |
| `lykkecup26_clubs` | Normalized club directory + sync triggers |
| `lc26_page_content` | CMS for public pages (`page_key`, jsonb `content`) |
| `holddannelse_chat_messages` / `_likes` | Cup Chat |
| `level_court_settings` | Which court types a level may use |
| `tournament_periods` | Named time periods for pools/schedule |
| `kontrolcenter_event_settings` | Per-event planning Lockdown flag |
| `galla_tickets` | Galla QR tickets + check-in state |
| `galla_tickets_staging` | Text staging for CSV import |

### 4.2 Relationships (**Confirmed** / **Inferred**)

- Almost all domain rows filter by `event_id` = LykkeCup UUID above.
- `team_members.player_id` → `players`; `team_coaches.coach_id` → `coaches`; both link `team_id` → `teams`.
- `teams.pool_id` → `pools`; `pools.period_id` → `tournament_periods`.
- `matches` reference `pool_id`, `team_a_id` / `team_b_id`, `court_id`.
- `courts.venue_id` → `venues`.
- `players` / `coaches` / `club_feedback` → optional `club_id` → `lykkecup26_clubs` (sync triggers keep `home_club` aligned).
- Galla tickets are **separate** from Supabase `players` (WordPress attendee ids / security codes).

### 4.3 RLS (**Confirmed** in migrations)

High level:

- **Authenticated** can manage most planning tables (`matches`, `pools`, courts, periods, chat, CMS, etc.) where policies exist.
- **Anon** can SELECT public LC26 data: messages, page content, matches (scheduled), pools, courts, venues (event-scoped).
- **Anon** can INSERT `lc26_guest_messages` and `lc_analytics_page_views`.
- **`kontrolcenter_event_settings`**: SELECT for authenticated; INSERT/UPDATE only if JWT `app_metadata.role = 'admin'`.
- **`galla_tickets`**: authenticated SELECT only; check-in **only** via `galla_check_in_ticket` RPC (no client UPDATE policies).
- Many legacy tables (`players`, `teams`, …): **no RLS policies in this repo** — **Unverified** whether RLS is enabled remotely or left open to authenticated/anon via grants.

### 4.4 Functions, triggers, RPCs (**Confirmed**)

| Name | Notes |
|------|--------|
| `galla_check_in_ticket(...)` | SECURITY DEFINER; GRANT to `authenticated` + `anon` |
| `galla_import_staging_to_tickets()` | CSV staging → `galla_tickets` |
| `get_lc_analytics_summary()` | Authenticated; LC26 paths |
| `get_lc_analytics_hourly_views(p_day)` | Authenticated |
| Change-log triggers on `players` / `coaches` | SECURITY DEFINER |
| Club sync triggers on players/coaches/feedback | SECURITY DEFINER |
| `*_set_updated_at` triggers | Several tables |

App `.rpc()` usage: `galla_check_in_ticket`, `get_lc_analytics_summary`, `get_lc_analytics_hourly_views`.

### 4.5 Storage buckets (**Confirmed** in `supabase/*.sql`, outside `migrations/`)

| Bucket | Public |
|--------|--------|
| `lc26_message_avatars` | yes |
| `lc26_page_content_images` | yes |

`next.config.ts` allows images from `*.supabase.co` storage public URLs.

**Unverified:** whether these bucket scripts have been applied on production.

### 4.6 Migrations

**Confirmed:** 44 files under `supabase/migrations/` (dated roughly 2026-02 → 2026-06). Latest Galla-related:

- `20260602120000_galla_tickets.sql`
- `20260602130000_galla_tickets_staging_import.sql`
- `20260603120000_galla_scanner_anon_check_in.sql`

Also loose files: `supabase/add_teams_is_completed.sql`, storage SQL — may need **manual** apply if not in migration runner.

---

## 5. Authentication, roles, permissions

**Confirmed**

- Supabase Auth email/password (`components/auth/login-form.tsx`, `/login`, `/glemt-kode`, `/nulstil-kode`).
- Session cookies via `@supabase/ssr` in `proxy.ts` and `lib/auth-server.ts`.
- Role from `user.app_metadata.role`: `"admin" | "user" | null` (`lib/auth-server.ts`).
- **Admin-only UI behavior:** planning Lockdown toggle (`components/kontrolcenter-lockdown-context.tsx`); DB write to Lockdown requires admin JWT (RLS).
- **Planning Lockdown:** when `kontrolcenter_event_settings.planning_lockdown` is true, paths under `/holddannelse`, `/turnering`, `/kampprogram` are write-gated in UI (`isPlanningLockdownPath` in `lib/kontrolcenter-lockdown-shared.ts`). Admins can toggle.
- **Public routes** listed in `proxy.ts` (`PUBLIC_PATHS` + `/lykkecup26/*` + Galla check-in APIs). Authenticated users hitting `/login` or `/glemt-kode` redirect to `/admin`.
- Galla scanner: **no login**; optional `NEXT_PUBLIC_GALLA_SCANNER_ACCESS_CODE` session gate (`lib/galla-scanner-config.ts`).

**Inferred:** Non-admin authenticated users can use most KontrolCenter features except Lockdown control (and whatever remote RLS still allows). Exact remote grants for `players` etc. are **Unverified**.

---

## 6. Major features and how they work

### KontrolCenter (`app/(app)/`)

| Area | Routes | Notes |
|------|--------|-------|
| Overblik | `/admin` | Hub |
| Spillere / Trænere / Klubber | `/spillere`, `/traenere`, `/klubber` | CRUD-ish admin UIs |
| Kommentarer | `/kommentarer` | `club_feedback` + internal messages; badge count in shell |
| Holddannelse | `/holddannelse`, `/[level]`, `/alle-hold`, `/hold-chat` | Team builder, completion, Cup Chat |
| Turnering | `/turnering`, `/puljer`, `/plan`, `/baner` | Pools, schedule generation (`lib/turnering-scheduler.ts` ~4.4k lines), venues/courts |
| Kampprogram | `/kampprogram`, `/kampprogram/check` | Match board + LykkeCup Check consistency |
| Lister | `/lister` | Exports |
| Analyse | `/analyse` | LC26 analytics (RPC + Nivo) |
| Billetsalg | `/billetsalg` | Live ticket breakdown via WordPress API proxy |
| App-indhold | `/app-indhold` | CMS for public pages |
| Beskeder | `/beskeder` | Public message admin |
| Cup Chat | `/cup-chat` | Staff chat |
| Scanalytics | `/scanalytics` | Galla check-in analytics (**not** in main nav as of this write — visit URL directly) |

### Public LC26 (`app/lykkecup26/`)

Home, side-1/2/3 program, practical info, MCH map, news, støt/fundraising, lykke-og-lagkage, player/coach public pages, mit (saved profile), beskeder/guestbook. Service worker / webmanifest present under `public/`.

### Galla QR scanner (**Confirmed** + recent work)

- UI: `/hemmeliglykkescanner` → `components/galla-scanner/galla-scanner-client.tsx`.
- Check-in path: browser → `POST /api/galla-check-in` → RPC `galla_check_in_ticket` with `checked_in_by` label built from **client IP** + **browser UUID** (`lib/galla-scanner-device.ts`, `lib/request-client-ip.ts`).
- Device id endpoint: `GET /api/galla-scanner-device`.
- Ops guide: `docs/GALLA_SCANNER.md`.
- Analytics: `/scanalytics` aggregates `galla_tickets` (minute timeline, identified browsers vs legacy `"scanner"` rows).

### Other APIs

| Route | Behavior |
|-------|----------|
| `/api/live-tickets` | Proxies WordPress tickets-breakdown |
| `/api/public-dashboard` | **Returns 404** (disabled) |
| `/api/galla-check-in` | Public check-in |
| `/api/galla-scanner-device` | Public IP helper |

---

## 7. Important technical and product decisions

| Decision | Why (Confirmed / Inferred) |
|----------|----------------------------|
| Single Next app for KontrolCenter + public app | Shared types/data, one Vercel deploy |
| Hard-coded event UUID | Single-event product for LC26 |
| Anon key only in client; SECURITY DEFINER RPCs for sensitive writes | Avoid shipping service role |
| Galla check-in via Next API + RPC (not direct table update) | Capture IP server-side; enforce ticket rules in DB |
| Secret URL + optional access code for scanner | Staff phones without KontrolCenter accounts |
| Staging table for CSV import | WordPress CSV empty booleans break direct import (`docs/GALLA_SCANNER.md`) |
| Planning Lockdown | Freeze schedule edits during event |
| `/` rewrite to `/lykkecup26` (not redirect) | Social crawlers / Open Graph (`proxy.ts` comment) |
| Large client-side scheduler | Tournament generation lives in `lib/turnering-scheduler.ts` |
| Browser device id in `localStorage` for scanners | Distinguish phones even on same Wi‑Fi IP |

**Conversation / intent (implemented in code as of this write):** Scanalytics minute charts; separate count of auto-identified browsers vs legacy scans that only stored `checked_in_by = "scanner"` — those **cannot** be split retroactively.

---

## 8. Integrations

| Service | Use | Evidence |
|---------|-----|----------|
| **Vercel** | Hosting / deploy (inferred from project + `@vercel/analytics`) | package.json; README; **Unverified** project settings |
| **Supabase** | Auth, Postgres, Realtime, Storage | Throughout |
| **WordPress / lykkeliga.dk** | Ticket sales breakdown JSON | `app/api/live-tickets/route.ts` |
| **OnlineFundraising** | Support + donation links | `lib/lc26-fundraising.ts` |
| **GitHub** | Source | `origin` → `github.com/espensen-mik/LykkeCup_App.git` |

---

## 9. Environment variables (names only)

**Required for app auth/DB (Confirmed in code):**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Optional / feature-specific (Confirmed):**

- `NEXT_PUBLIC_GALLA_SCANNER_ACCESS_CODE` — scanner UI gate
- `NEXT_PUBLIC_SITE_URL` — absolute URLs / OG (`lib/lc26-public-site-metadata.ts`; default site URL in code if unset)
- `NEXT_PUBLIC_FB_APP_ID` — Facebook app id for meta tags
- `LL_WP_BASE_URL` — WordPress base (default `https://lykkeliga.dk`)
- `LL_WP_TICKETS_KEY` — tickets API key query param (code has a **fallback string** if unset — treat as config smell)
- `LL_WP_EVENT_ID` — WP event id (default `16899`)

**Do not commit** `.env*` (see `.gitignore`). Never put secret values in this file or in git.

**Unverified:** whether a Supabase service role is used only in dashboard/CLI outside this repo.

---

## 10. Known bugs, limitations, technical debt, fragile areas

**Confirmed / strongly confirmed**

1. **Legacy Galla scans** store undifferentiated `checked_in_by` (e.g. `"scanner"`). Distinct phone/browser counts for those rows are **impossible** after the fact. Only post-deploy API check-ins with `IP · browserId` format are countable.
2. **`/scanalytics` not linked** in `components/app-shell.tsx` “Mere” menu (only `/lister`, `/analyse`, `/billetsalg`). Easy to miss.
3. **`GallaManualSearch`** component exists but is **not** imported by the current scanner page (**Confirmed** grep) — dead/orphan UI unless rewired.
4. **`/api/public-dashboard` and kontrolcenter-dashboard** intentionally return/not serve live data (404 / disabled comments).
5. **Base schema not in migrations** — new environments cannot be rebuilt from `supabase/migrations` alone.
6. **Storage SQL outside migrations** — easy to forget on new projects.
7. **`lib/turnering-scheduler.ts`** is very large and central — high regression risk.
8. **RLS for core tables Unverified** — do not assume anon cannot read/write `players` without checking remote policies.
9. **WordPress tickets key fallback** in source if env missing — prefer setting `LL_WP_TICKETS_KEY` explicitly.
10. **Default README** is still create-next-app boilerplate — not project-specific.
11. **No automated test suite** in `package.json` (only `dev` / `build` / `start` / `lint`).

---

## 11. Planned / unfinished / partial

| Item | Status |
|------|--------|
| Public kontrolcenter dashboard | Disabled (**Confirmed**) |
| Manual Galla search in scanner UI | Code present, not wired (**Confirmed**) |
| Scanalytics nav entry | Missing (**Confirmed**) |
| Backfill device IDs for old galla scans | Not possible without historical data (**Confirmed**) |
| Multi-event support | Not designed — event UUID hard-coded (**Inferred**) |
| Full schema-as-code / generated Database types | Absent (**Confirmed**) |

---

## 12. Install, run, test, build, deploy

**Confirmed**

```bash
# Install
npm install

# Local env: create .env.local with at least
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Dev
npm run dev

# Lint / production build
npm run lint
npm run build
npm start
```

**Database:** Apply pending files from `supabase/migrations/` (and storage SQL if needed) to the target Supabase project. Galla: follow `docs/GALLA_SCANNER.md` for CSV import + anon grant migration.

**Deploy:** Typical flow is git push → Vercel (**Inferred**). Set the same env vars in Vercel. Ensure Galla migrations are applied on production before relying on scanner/scanalytics.

**Testing:** Manual; no CI test script in repo. Build (`npm run build`) is the main compile check.

---

## 13. Conventions for future AI agents

1. Read `AGENTS.md` / Next docs under `node_modules/next/dist/docs/` before using unfamiliar Next APIs.
2. Prefer existing patterns: `lib/*-server.ts` for server data, domain folders under `components/`, Danish UI copy for staff/public Danish users.
3. Scope data by `LYKKECUP_EVENT_ID` / `TURNERING_EVENT_ID` unless intentionally changing event model.
4. Do not add service-role keys to the browser or commit secrets.
5. For Galla: check-in must stay RPC (+ optional Next API for IP); do not open table UPDATE to anon.
6. Planning Lockdown: respect `isPlanningLockdownPath` and admin-only toggle.
7. Keep diffs focused; do not rewrite the tournament scheduler unless the task requires it.
8. When documenting or changing env usage, **names only** in git-tracked docs.
9. Distinguish public (`proxy.ts` allowlist) vs authenticated routes carefully — forgetting to allowlist breaks scanner/public APIs.
10. User-facing product language is often Danish; code identifiers are often Danish path names (`holddannelse`, `kampprogram`, `spillere`).

---

## 14. Concise timeline (from git + migrations)

**Confirmed via `git log` and migration filenames** (dates are commit/migration stamps, not business calendar):

| When | Milestone |
|------|-----------|
| 2026-04-12 | Initial Next app; KontrolCenter shell, spillere, holddannelse, dashboard |
| 2026-04-13–15 | Dashboard, matches, login, comments, baner, coaches, roles |
| 2026-04–05 | Public LC26 app, analytics, guest messages, CMS, fundraising, Open Graph, PWA tips |
| 2026-05 | Tournament periods, match RLS, planning Lockdown, courts/venues anon select, Cup Chat |
| 2026-06-02–04 | Galla tickets + scanner + staging import |
| 2026-06-07 | Scanalytics + device/IP identification for new scans |

Commit messages are often terse (`scan`, `sfdsf`); treat migration names as more reliable for schema history.

---

## 15. Current state (2026-09-24)

### What works (**Confirmed**)

- KontrolCenter auth + shell navigation for core planning domains.
- Public LC26 site and participant flows (subject to remote data/RLS).
- Tournament/holddannelse/kampprogram tooling (complex; Lockdown-aware).
- Galla QR scanner page + RPC check-in; Next API path for IP + browser id on **new** scans.
- Scanalytics: totals, minute timeline, identified-browser counts, legacy-scan warning.
- Analytics page for LC26 via RPCs.
- Ticket sales live breakdown proxy (when WP env/config ok).

### In progress / recently changed

- Device identification for scanners (IP + localStorage UUID) and Scanalytics messaging about legacy scans.
- Galla docs and migrations present; production apply status **Unverified**.

### Suggested next work (practical)

1. Confirm production has Galla migrations + CSV imported; deploy latest scanner/API/scanalytics code.
2. Add `/scanalytics` (and maybe scanner deep-link) to KontrolCenter nav under “Mere”.
3. Wire or remove `GallaManualSearch`.
4. After event night: rely on identified-browser metrics for staffing insights; ignore legacy bucket for device counts.
5. Longer term: export/document base schema or generate `Database` types; add minimal smoke tests for check-in API and Lockdown.

---

## Important file index

| Path | Why |
|------|-----|
| `proxy.ts` | Auth + public routes |
| `app/(app)/layout.tsx` | KontrolCenter providers |
| `components/app-shell.tsx` | Nav IA |
| `lib/auth-server.ts` | Session + roles |
| `lib/players.ts` | Event UUID |
| `lib/turnering-scheduler.ts` | Schedule engine |
| `lib/kontrolcenter-lockdown-shared.ts` | Lockdown paths |
| `docs/GALLA_SCANNER.md` | Scanner ops |
| `app/api/galla-check-in/route.ts` | Check-in + IP |
| `app/(app)/scanalytics/page.tsx` | Scan analytics UI |
| `supabase/migrations/` | Schema evolution |

---

## Unverified checklist (do not invent answers)

- [ ] Live Supabase RLS/grants on `players`, `teams`, `matches`, etc.
- [ ] Whether all migrations + storage SQL are applied on production
- [ ] Vercel project env completeness and domain mapping
- [ ] Exact production ticket CSV row count / Galla event readiness
- [ ] Whether `GallaManualSearch` was intentionally removed from UI
- [ ] Presence of any private runbooks outside this repo
