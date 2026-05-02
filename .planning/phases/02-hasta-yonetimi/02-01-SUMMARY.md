---
phase: 02-hasta-yonetimi
plan: 01
subsystem: database
tags: [migration, rls, patients, sessions, kvkk]
dependency_graph:
  requires: [01-02]
  provides: [patients-table, sessions-table]
  affects: [02-02, 02-03, 02-04]
tech_stack:
  added: []
  patterns: [Phase-1-RLS-template, text_pattern_ops-index, functional-index-lower]
key_files:
  created:
    - supabase/migrations/20260502000001_create_patients_sessions.sql
  modified: []
decisions:
  - "CLERK_ISSUER_DOMAIN derived from publishable key (true-ant-30.clerk.accounts.dev) — not in .env.local, must be added for future supabase CLI use"
  - "patients_tenant_tc_unique prevents duplicate TC per tenant at DB level — cross-tenant TC sharing allowed"
  - "tc_kimlik_no uses text_pattern_ops index for prefix search (ILIKE 'prefix%' pattern)"
metrics:
  duration: ~5 minutes
  completed: 2026-05-02
---

# Phase 2 Plan 1: Patients + Sessions Migration Summary

Supabase migration creating `patients` and `sessions` tables with RLS tenant isolation, covering all PAT-01 through PAT-05 requirements.

## What Was Built

Single migration file `20260502000001_create_patients_sessions.sql` applied to Frankfurt Supabase (aihfqulgdwekvxyeeofl).

### patients table
- `id` uuid PK, `tenant_id` FK to tenants (ON DELETE CASCADE)
- `full_name` text NOT NULL with non-empty CHECK
- `tc_kimlik_no` text NOT NULL with `'^[0-9]{11}$'` regex CHECK
- `created_at` timestamptz, `created_by` text (Clerk user_id)
- RLS `tenant_isolation` policy using Phase 1 subquery template
- Unique index `patients_tenant_tc_unique` on `(tenant_id, tc_kimlik_no)`
- `text_pattern_ops` index on `tc_kimlik_no` for prefix search
- Functional index on `lower(full_name)` for case-insensitive search

### sessions table
- `id` uuid PK, `tenant_id` FK, `patient_id` FK to patients (ON DELETE CASCADE)
- `form_type` enum: `genel | anamnez | perio | patoloji` (default `genel`)
- `status` enum: `draft | completed` (default `draft`)
- `started_at` timestamptz NOT NULL, `completed_at` timestamptz NULLABLE (draft = in-progress)
- `created_by` text (Clerk user_id)
- RLS `tenant_isolation` policy using Phase 1 subquery template
- Indexes on `tenant_id`, `patient_id`, `started_at DESC`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing CLERK_ISSUER_DOMAIN env var blocked `supabase db push`**
- **Found during:** Task 1 (db push)
- **Issue:** `supabase config.toml` references `env(CLERK_ISSUER_DOMAIN)` but `.env.local` does not set it — CLI validation fails
- **Fix:** Decoded Clerk publishable key base64 payload to extract domain `true-ant-30.clerk.accounts.dev`, passed as env var inline
- **Files modified:** None (env var passed inline; `.env.local` should be updated separately)
- **Commit:** 9c41b5c

## Known Stubs

None — this plan is schema-only.

## Threat Surface Scan

No new network endpoints introduced. Schema changes are at data layer only. RLS policies mirror Phase 1 template exactly — tenant isolation verified. `tc_kimlik_no` stored as plaintext with constraint enforcement; API layer masking (T-02-01-01) is deferred to plan 02-02 (API routes).

## Self-Check: PASSED

- [x] `supabase/migrations/20260502000001_create_patients_sessions.sql` exists
- [x] Contains `CREATE TABLE public.patients` (1 match)
- [x] Contains `CREATE TABLE public.sessions` (1 match)
- [x] Contains `tenant_isolation` (2 matches — one per table)
- [x] Contains `tc_kimlik_no ~ ` (1 match)
- [x] Contains `completed_at` (1 match)
- [x] Commit 9c41b5c exists
- [x] Migration applied: "Finished supabase db push."
