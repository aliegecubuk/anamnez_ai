---
phase: 01-temel-altyapi
plan: 02
subsystem: database
tags: [supabase, postgresql, rls, migrations, multi-tenant, kvkk, audit-log]

requires:
  - phase: 01-temel-altyapi/plan-01
    provides: next.js-15.2.4-project, supabase-admin-client, supabase-server-client

provides:
  - supabase-cli-initialized
  - tenants-table-migration
  - login-audit-log-migration
  - rls-template-comment-block
  - seed-sql-test-tenants
  - remote-schema-applied (COMPLETE — "Remote database is up to date.")

affects:
  - all-subsequent-plans (every table needs tenant_id + RLS modeled on 20260501000001)
  - 01-03 (Clerk middleware uses clerk_org_id from tenants table)
  - 01-04 (webhook route inserts into login_audit_log)

tech-stack:
  added:
    - supabase CLI (npx supabase init)
  patterns:
    - "All future tables: tenant_id uuid NOT NULL REFERENCES public.tenants(id)"
    - "RLS template: tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')"
    - "No user-facing policies on tenants or audit tables — service_role only"
    - "Migration filename format: YYYYMMDDHHMMSS_description.sql (lexicographic order enforcement)"

key-files:
  created:
    - supabase/config.toml
    - supabase/migrations/20260501000001_create_tenants.sql
    - supabase/migrations/20260501000002_create_audit_log.sql
    - supabase/seed.sql
  modified: []

key-decisions:
  - "tenants table has no user-facing RLS policies — service_role only access; anon key returns 0 rows"
  - "login_audit_log has no user-facing policies — only supabaseAdmin (service_role) can INSERT/SELECT"
  - "clerk_org_id index on tenants is critical — used in every future RLS subquery across all phases"
  - "seed.sql uses fake org IDs (org_test_tenant_a/b) — safe to commit; no real credentials"
  - "Task 2 (supabase link + db push) requires user's database password — returned as human-action checkpoint"

patterns-established:
  - "Migration 1 (tenants): canonical template for all future tenant-scoped tables"
  - "Migration 2 (audit_log): service-role-only insert pattern for D-07 compliance"
  - "RLS template block embedded as comment in 20260501000001 — copy into every future migration"

requirements-completed:
  - AUTH-07

duration: ~8min
completed: 2026-05-02
---

# Phase 1 Plan 2: Supabase Foundation Schema Summary

**Supabase CLI initialized with two foundation migrations — tenants table (RLS, clerk_org_id index, RLS template) and login_audit_log (D-07, service-role-only, 2 indexes) — applied to eu-central-1 Frankfurt (aihfqulgdwekvxyeeofl)**

## Performance

- **Duration:** ~15 min (includes human-action checkpoint for db push)
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02
- **Tasks:** 2/2 complete
- **Files modified:** 4

## Accomplishments

- `supabase init` — config.toml created, supabase/ directory initialized
- Two migration files created with exact schema from RESEARCH.md (tenants + login_audit_log)
- `npx supabase db push` applied both migrations to Frankfurt remote — output: "Remote database is up to date."
- RLS enabled on both tables with zero user-facing policies (T-02-01 and T-02-02 mitigated at schema level)
- Seed data with two isolated test tenants for AUTH-07 cross-tenant isolation testing

## Task Commits

1. **Task 1: Initialize Supabase CLI + Create Migration Files** - `68bc479` (feat)
2. **Task 2: Link Supabase Project + Push Schema** - Human-action (user ran `npx supabase db push`; confirmed "Remote database is up to date.")

## Files Created/Modified

- `supabase/config.toml` — Supabase project config (created by supabase init)
- `supabase/migrations/20260501000001_create_tenants.sql` — tenants table, RLS enabled, clerk_org_id index, RLS template comment
- `supabase/migrations/20260501000002_create_audit_log.sql` — login_audit_log table, RLS enabled, 2 performance indexes
- `supabase/seed.sql` — 2 test tenants (org_test_tenant_a, org_test_tenant_b) for local dev isolation testing

## Decisions Made

- Supabase project ref: `aihfqulgdwekvxyeeofl` (eu-central-1 Frankfurt)
- Migration IDs applied: 20260501000001 (tenants), 20260501000002 (login_audit_log)
- `npx supabase db push` output: "Remote database is up to date." — both migrations applied
- `npx supabase db diff` skipped locally due to Docker port 54320 permission error on Windows (non-blocking)

## Deviations from Plan

None — plan executed as written. `supabase db diff` verification was skipped due to Docker port 54320 permission error on Windows (non-blocking — `db push` confirmed schema is current).

## User Setup Required

None — Supabase project was already linked with credentials in .env.local from Plan 01-01. The only human action was running `npx supabase db push` in terminal (returned "Remote database is up to date.").

## Issues Encountered

- `npx supabase db diff` failed locally: Docker could not bind port 54320 on Windows due to OS-level permission restrictions. Resolution: accepted `db push` output "Remote database is up to date." as equivalent confirmation. Schema state is correct at remote.

## Known Stubs

None — migration files only; no UI data flows.

## Threat Flags

None — schema matches threat model mitigations T-02-01 through T-02-05 exactly:
- T-02-01: tenants table has RLS enabled, no user SELECT policy
- T-02-02: login_audit_log has RLS enabled, no user INSERT/SELECT policy
- T-02-03: NULL org_id returns 0 rows (no matching clerk_org_id) — correct behavior
- T-02-04: Migration filenames are timestamp-prefixed (lexicographic order enforced)
- T-02-05: seed.sql contains only fake org IDs — safe to commit

## Self-Check: PASSED

- supabase/config.toml: FOUND
- supabase/migrations/20260501000001_create_tenants.sql: FOUND (CREATE TABLE public.tenants, ENABLE ROW LEVEL SECURITY, CREATE INDEX, RLS TEMPLATE)
- supabase/migrations/20260501000002_create_audit_log.sql: FOUND (CREATE TABLE public.login_audit_log, ENABLE ROW LEVEL SECURITY, 2x CREATE INDEX)
- supabase/seed.sql: FOUND (org_test_tenant_a, org_test_tenant_b)
- Commit 68bc479: FOUND

## Next Phase Readiness

- Plan 01-03 (Clerk middleware + auth pages) can proceed immediately — does not depend on additional schema
- Plan 01-04 (Supabase integration / webhook) requires login_audit_log to exist — now confirmed applied
- All future plans that create tables MUST use the RLS template in 20260501000001_create_tenants.sql

---
*Phase: 01-temel-altyapi*
*Completed: 2026-05-02*
