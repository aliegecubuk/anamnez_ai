# AnamnezAl — Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Diş hekimi sesle anamnez + chart doldurur, hiçbir şeye dokunmaz
**Current focus:** Phase 1 — Temel Altyapı

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Temel Altyapı | In Progress |
| 2 | Hasta Yönetimi | Not Started |
| 3 | Ses Boru Hattı | Not Started |
| 4 | Anamnez Motoru | Not Started |
| 5 | Dental AI Açıklamaları | Not Started |
| 6a | Periodontoloji Chartı | Not Started |
| 6b | Patoloji Chartı | Not Started |

## Current Position

**Phase:** 1 — Temel Altyapı
**Plan:** 01-02 (checkpoint — awaiting supabase db push)
**Status:** In Progress — Human Action Required
**Progress:** [=------] 1/7 phases (Plan 1 of 4 complete in Phase 1; Plan 2 Task 1 done)

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 Requirements | 56 |
| Phases | 7 |
| Plans complete | 1 |
| Phases complete | 0 |
| Duration (01-01) | ~13 minutes |

## Accumulated Context

### Key Decisions (from PROJECT.md)
- FDI tooth numbering locked (Turkish dental university standard)
- Whisper API for STT (best Turkish accuracy)
- Cloud storage, no PDF output, digital-only
- Blank ≠ zero for perio chart (NULL = no problem recorded)
- KVKK compliance required from Phase 1
- Supabase region: Frankfurt (EU data residency for KVKK)

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
- Run supabase link + db push (Task 2 of 01-02 — human-action checkpoint)
- After db push confirmed: run 01-03-PLAN.md (Clerk middleware + auth pages)

## Session Continuity

- Roadmap initialized: 2026-05-01
- Requirements finalized: 56 v1 requirements, 0 orphans
- Phase 1 Plan 1 complete: 2026-05-01 (commit e262049)
- Phase 1 Plan 2 Task 1 complete: 2026-05-02 (commit 68bc479) — migration files created
- Phase 1 Plan 2 Task 2: PENDING human-action — user must run supabase link + db push
- Next.js 15.2.4 scaffold with shadcn/ui, Clerk, Supabase pattern established
- shadcn/ui uses @base-ui/react primitives (not @radix-ui) — future component authors must use @base-ui imports
- .env.local has real credentials; Supabase project ref: aihfqulgdwekvxyeeofl
- RLS template established in 20260501000001 — all future tables must follow this pattern

## Next Action

Complete Plan 01-02 Task 2: run `npx supabase link --project-ref aihfqulgdwekvxyeeofl` then `npx supabase db push` in terminal.
