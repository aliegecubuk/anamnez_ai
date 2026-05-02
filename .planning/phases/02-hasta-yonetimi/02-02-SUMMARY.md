---
phase: 02-hasta-yonetimi
plan: 02
subsystem: api
tags: [patients, rest-api, tenant-isolation, kvkk, tc-masking]
dependency_graph:
  requires: [02-01]
  provides: [patients-api, patient-list-endpoint, patient-create-endpoint, patient-profile-endpoint]
  affects: [02-03, 02-04]
tech_stack:
  added: []
  patterns: [verifyTenantAccess, maskTc, RLS-double-layer, Clerk-JWT-Supabase-RLS]
key_files:
  created:
    - src/lib/patients/types.ts
    - src/app/api/orgs/[slug]/patients/route.ts
    - src/app/api/orgs/[slug]/patients/[id]/route.ts
  modified: []
decisions:
  - "verifyTenantAccess() duplicated in both route files (not extracted to shared helper) — avoids circular imports between API routes; acceptable at this scale"
  - "GET list uses Supabase relational embed for sessions to get last_session_at in one query — no separate sessions fetch"
  - "TC masking via maskTc() applied at response serialization time; raw tc_kimlik_no never appears in PatientListItem or PatientResponse"
  - "Numeric-only ?q= triggers TC prefix search (ILIKE '123%'); mixed/alpha triggers name ILIKE search"
  - "Pre-existing TS error in src/lib/supabase/server.ts (string | undefined argument) not introduced by this plan — left as-is per deviation scope boundary"
metrics:
  duration: ~10 minutes
  completed: 2026-05-02
---

# Phase 2 Plan 2: Patient API Routes Summary

Three REST API routes for patient management with Clerk JWT + Supabase RLS tenant isolation. TC kimlik no masked in all responses via maskTc() — raw value never serialized to JSON.

## What Was Built

### src/lib/patients/types.ts
- `PatientRow`, `SessionRow` — raw DB row interfaces matching migration columns
- `PatientListItem`, `PatientResponse`, `SessionSummary` — API response shapes (TC always masked)
- `maskTc(tc: string): string` — returns 9 bullet chars + last 2 digits; full mask for empty/short input

### src/app/api/orgs/[slug]/patients/route.ts
- `GET` — returns `PatientListItem[]` sorted by `full_name ASC`; supports `?q=` for name ILIKE or TC prefix search
- `POST` — validates `full_name` (non-empty) and `tc_kimlik_no` (11 numeric digits); 409 on duplicate TC in tenant; returns 201 + masked `PatientListItem`
- Both handlers call `verifyTenantAccess()` — 401 if unauthenticated, 403 if slug/org mismatch

### src/app/api/orgs/[slug]/patients/[id]/route.ts
- `GET` — returns `PatientResponse` with sessions sorted `started_at DESC`
- 404 when patient not found or RLS blocks cross-tenant access
- `verifyTenantAccess()` called before any DB query

## Deviations from Plan

### Pre-existing Issues (Out of Scope)

**1. Pre-existing TS error in src/lib/supabase/server.ts**
- `Argument of type 'string | undefined' is not assignable to parameter of type 'string'`
- Existed before this plan (confirmed via git stash check)
- Not caused by this plan's changes — left untouched per deviation scope boundary
- All new files (types.ts, both route.ts files) have zero TS errors

## Known Stubs

None — all routes are fully wired to Supabase with real tenant isolation.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All T-02-02-01 through T-02-02-05 mitigations are implemented:
- T-02-02-01 (IDOR): `verifyTenantAccess()` + Supabase RLS double layer
- T-02-02-02 (TC disclosure): `maskTc()` applied at every response serialization point
- T-02-02-03 (TC enumeration): auth-gated, org-scoped search only
- T-02-02-04 (DoS POST): accepted — auth guard in place
- T-02-02-05 (injection): Supabase parameterized queries

## Self-Check: PASSED

- [x] `src/lib/patients/types.ts` exists — commit 2f1f5a1
- [x] `src/app/api/orgs/[slug]/patients/route.ts` exists — commit d28f6d9
- [x] `src/app/api/orgs/[slug]/patients/[id]/route.ts` exists — commit 026ba9d
- [x] `maskTc` exported from types.ts
- [x] `PatientListItem`, `PatientResponse`, `SessionRow`, `SessionSummary` exported
- [x] GET and POST exported from patients/route.ts
- [x] GET exported from patients/[id]/route.ts
- [x] `verifyTenantAccess` checks both userId and orgId before DB access
- [x] `maskTc` called on every tc_kimlik_no before JSON response
- [x] `23505` duplicate constraint handled with 409
- [x] Sessions sorted DESC in profile route
- [x] No new TS errors introduced by plan files
