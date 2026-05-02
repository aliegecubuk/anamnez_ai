# AnamnezAl — Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Diş hekimi sesle anamnez + chart doldurur, hiçbir şeye dokunmaz
**Current focus:** Phase 1 — Temel Altyapı

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Temel Altyapı | Complete |
| 2 | Hasta Yönetimi | Not Started |
| 3 | Ses Boru Hattı | Not Started |
| 4 | Anamnez Motoru | Not Started |
| 5 | Dental AI Açıklamaları | Not Started |
| 6a | Periodontoloji Chartı | Not Started |
| 6b | Patoloji Chartı | Not Started |

## Current Position

**Phase:** 2 — Hasta Yönetimi
**Plan:** 02-01 (next — Phase 2 planning)
**Status:** In Progress
**Progress:** [=------] 1/7 phases (Phase 1 complete — 4/4 plans)

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 Requirements | 56 |
| Phases | 7 |
| Plans complete | 4 |
| Phases complete | 1 |
| Duration (01-01) | ~13 minutes |

## Accumulated Context

### Key Decisions (from PROJECT.md)
- FDI tooth numbering locked (Turkish dental university standard)
- Whisper API for STT (best Turkish accuracy)
- Cloud storage, no PDF output, digital-only
- Blank ≠ zero for perio chart (NULL = no problem recorded)
- KVKK compliance required from Phase 1
- Supabase region: Frankfurt (EU data residency for KVKK)

### Decisions from Plan 01-04
- reset_password_email_code is the correct Clerk strategy for password reset — sends code via email, Clerk hosted page handles actual change
- CardFooter in base-nova shadcn has border-t + bg-muted/50 by default — suppress with border-t-0 bg-transparent for login/auth pages
- Auth routes live under src/app/(auth)/ route group — all unauthenticated pages inherit centered layout from (auth)/layout.tsx

### Decisions from Plan 01-03
- sessionClaims.metadata typed as Record<string, unknown> via cast — Clerk v6 types metadata as {} requiring runtime cast
- Clerk webhook (CLERK_WEBHOOK_SECRET) configuration deferred to post-deploy — route implemented and ready
- session.created confirmed as correct Clerk webhook event for login detection

### Decisions from Plan 01-02
- tenants table has no user-facing RLS policies — service_role only; anon key returns 0 rows (T-02-01)
- login_audit_log has no user-facing policies — only supabaseAdmin can INSERT/SELECT (T-02-02, D-07)
- clerk_org_id index on tenants is critical — used in every future RLS subquery
- seed.sql uses fake org IDs only — safe to commit
- Task 2 (supabase link + db push) requires user to run terminal commands (database password needed)

### Decisions from Plan 01-01
- @clerk/nextjs v6.39.3 used (v7.3.0 requires next>=15.2.8, incompatible with pinned next@15.2.4)
- shadcn/ui v4.6.0 uses base-nova style with @base-ui/react (not @radix-ui) — form.tsx written manually
- Supabase URL corrected in .env.local (dashboard URL → API URL: https://aihfqulgdwekvxyeeofl.supabase.co)

### Critical Constraints
- Tooth number accuracy is zero-tolerance: 18 MUST NOT be recorded as 28
- Disambiguation + confirmation required before any tooth value is written in Phases 6a and 6b
- KVKK consent gates block save in Phases 4 and 6a
- All core workflows (anamnesis, perio chart, pathology chart) must be completable by voice alone
- AI descriptions must be dental-only — no general medical information

### Blockers
None.

### Todos
- Plan Phase 2: Hasta Yönetimi (patient profile CRUD, search, session shell)

## Session Continuity

- Roadmap initialized: 2026-05-01
- Requirements finalized: 56 v1 requirements, 0 orphans
- Phase 1 Plan 1 complete: 2026-05-01 (commit e262049)
- Phase 1 Plan 2 Task 1 complete: 2026-05-02 (commit 68bc479) — migration files created
- Phase 1 Plan 2 complete: 2026-05-02 — migrations applied to Frankfurt (aihfqulgdwekvxyeeofl), "Remote database is up to date."
- Phase 1 Plan 3 complete: 2026-05-02 — middleware (subdomain routing, org activation, superadmin guard), tenant+superadmin layout guards (CVE-2025-29927), Clerk webhook (login audit log)
- Phase 1 Plan 4 complete: 2026-05-02 — login UI (/sign-in), password reset (/reset-password), root redirect, auth layout
- Phase 1 COMPLETE: 2026-05-02 — all 4 plans executed
- Next.js 15.2.4 scaffold with shadcn/ui, Clerk, Supabase pattern established
- shadcn/ui uses @base-ui/react primitives (not @radix-ui) — future component authors must use @base-ui imports
- .env.local has real credentials; Supabase project ref: aihfqulgdwekvxyeeofl
- RLS template established in 20260501000001 — all future tables must follow this pattern

## Next Action

Plan Phase 2: Hasta Yönetimi — patient profile CRUD, search, session shell, history view. Run `/gsd-plan-phase 2`.
