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
  - remote-schema-applied (PENDING — awaiting Task 2 human-action checkpoint)

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

**Supabase CLI initialized with two foundation migrations: tenants table (RLS, clerk_org_id index, RLS template) and login_audit_log (D-07, service-role-only, 2 indexes); remote db push pending user-action checkpoint.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02 (Task 1 complete; Task 2 awaiting checkpoint)
- **Tasks:** 1/2 complete (Task 2 blocked at human-action checkpoint)
- **Files modified:** 4

## Accomplishments

- `supabase init` — config.toml created, supabase/ directory initialized
- Two migration files created with exact schema from RESEARCH.md (tenants + login_audit_log)
- RLS enabled on both tables with zero user-facing policies (T-02-01 and T-02-02 mitigated at schema level)
- Seed data with two isolated test tenants for AUTH-07 cross-tenant isolation testing

## Task Commits

1. **Task 1: Initialize Supabase CLI + Create Migration Files** - `68bc479` (feat)
2. **Task 2: Link Supabase Project + Push Schema** - PENDING (human-action checkpoint)

## Files Created/Modified

- `supabase/config.toml` — Supabase project config (created by supabase init)
- `supabase/migrations/20260501000001_create_tenants.sql` — tenants table, RLS enabled, clerk_org_id index, RLS template comment
- `supabase/migrations/20260501000002_create_audit_log.sql` — login_audit_log table, RLS enabled, 2 performance indexes
- `supabase/seed.sql` — 2 test tenants (org_test_tenant_a, org_test_tenant_b) for local dev isolation testing

## Decisions Made

- Supabase project ref: `aihfqulgdwekvxyeeofl` (from .env.local NEXT_PUBLIC_SUPABASE_URL)
- Confirmed Supabase region: eu-central-1 Frankfurt (from project setup and STATE.md)
- Migration IDs applied (pending push): 20260501000001, 20260501000002
- No errors during Task 1 (file creation only — push not yet attempted)

## Deviations from Plan

None — Task 1 executed exactly as written. Task 2 correctly returned as human-action checkpoint per plan design.

## User Setup Required

**Task 2 requires manual terminal commands.**

Run in project root (`C:\Users\Gaming\Desktop\AnamnezAl`):

```powershell
# Step 1: Link to remote Supabase project
npx supabase link --project-ref aihfqulgdwekvxyeeofl
# When prompted: enter your Supabase database password
# (Find it: Supabase Dashboard → Settings → Database → Database password)

# Step 2: Push migrations to remote Frankfurt database
npx supabase db push
# Expected output:
# Applying migration 20260501000001_create_tenants.sql...
# Applying migration 20260501000002_create_audit_log.sql...
# Finished supabase db push.

# Step 3: Verify no schema drift
npx supabase db diff
# Expected: No schema changes found
```

After push, verify in Supabase Dashboard:
- Table Editor: `public.tenants` (5 columns) and `public.login_audit_log` (7 columns) exist
- Authentication → Policies: both tables show RLS enabled, 0 policies listed

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

- Migration files ready to push once Task 2 checkpoint is cleared
- After db push: Plan 01-03 (Clerk middleware + auth pages) can proceed
- Plans 01-04+ depend on login_audit_log table existing in remote DB

---
*Phase: 01-temel-altyapi*
*Completed: 2026-05-02*
