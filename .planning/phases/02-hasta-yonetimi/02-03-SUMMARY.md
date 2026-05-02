---
phase: 02-hasta-yonetimi
plan: 03
subsystem: ui
tags: [patients, patient-list, create-dialog, kvkk, tc-masking, react-hook-form, zod]
dependency_graph:
  requires: [02-02]
  provides: [patient-list-page, patient-table-component, create-patient-dialog]
  affects: [02-04]
tech_stack:
  added: []
  patterns: [react-hook-form+zod, debounced-search, server-component-shell, client-component-interactivity]
key_files:
  created:
    - src/app/orgs/[slug]/patients/page.tsx
    - src/components/patients/PatientTable.tsx
    - src/components/patients/CreatePatientDialog.tsx
  modified: []
decisions:
  - "Button asChild not available (uses @base-ui/react/button, not Radix) — used buttonVariants + Link directly for Görüntüle column"
  - "Görüntüle uses cn(buttonVariants({ variant: 'link' })) on Link component — achieves same visual result without asChild prop"
  - "debounce useEffect fires on both query change and mount (initial load via separate useEffect with empty q)"
  - "Row click uses router.push(); cell-level onClick stopPropagation prevents double-navigation for Görüntüle link"
metrics:
  duration: ~15 minutes
  completed: 2026-05-02
---

# Phase 2 Plan 3: Patient List UI Summary

Patient list page with search, debounce, masked TC table, and create dialog. Server component shell at /orgs/[slug]/patients with two client components for interactivity.

## What Was Built

### src/app/orgs/[slug]/patients/page.tsx
- Server component shell; awaits `params` Promise (Next.js 15 pattern)
- Renders `<PatientTable slug={slug} />` — no data fetching at server layer
- No `<title>` tag with PII (KVKK T-02-03-02)

### src/components/patients/PatientTable.tsx
- `'use client'` component with `useState` for patients, query, loading, createDialogOpen
- `fetchPatients(q)` calls `GET /api/orgs/${slug}/patients?q=...`
- 300ms debounce via `useEffect` + `setTimeout`/`clearTimeout`
- Four-column table: Ad Soyad (flex), TC Kimlik No (w-40, font-mono), Son Seans (w-36), İşlemler (w-24)
- `tc_kimlik_no_masked` rendered directly — raw TC never held in client state
- Two empty states: "Henüz hasta kaydı yok" (no patients) and "Eşleşen hasta bulunamadı" (no search results)
- Row click: `useRouter().push()` to `/orgs/${slug}/patients/${p.id}`
- Görüntüle: `Link` with `buttonVariants({ variant: 'link' })` styling

### src/components/patients/CreatePatientDialog.tsx
- `'use client'` with `react-hook-form` + `zodResolver`
- Zod schema: `full_name` (min 1, max 100) + `tc_kimlik_no` (numeric regex + length(11))
- TC input: `type="text"`, `inputMode="numeric"`, `className="font-mono"`, `maxLength=11`
- Live X/11 length counter via `watch('tc_kimlik_no')`
- 409 duplicate TC shown inline below TC field (not toast)
- Other server errors: `toast.error(...)` from sonner, dialog stays open
- Success: `onSuccess(patient)` → `reset()` → `onOpenChange(false)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Button asChild prop not available**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `Button` uses `@base-ui/react/button` (not Radix Slot) — `asChild` prop does not exist on the type
- **Fix:** Used `cn(buttonVariants({ variant: 'link' }))` applied directly to `<Link>` component
- **Files modified:** src/components/patients/PatientTable.tsx
- **Commit:** 9672ee4 (included in initial commit)

### Pre-existing Issues (Out of Scope)

**1. src/lib/supabase/server.ts TS2345**
- `Argument of type 'string | undefined'` — pre-existing, documented in 02-02-SUMMARY.md
- Not caused by this plan, not fixed per deviation scope boundary

## Known Stubs

None — all components are fully wired to real API endpoints from 02-02.

## Threat Flags

No new threat surface. All T-02-03-01 through T-02-03-05 mitigations confirmed:
- T-02-03-01: `tc_kimlik_no_masked` rendered directly from API; raw TC never in PatientTable state
- T-02-03-02: page.tsx has no `<title>` with patient data
- T-02-03-03: Routes use UUID; search query stays in controlled state (not reflected in URL)
- T-02-03-04: All patient data via JSX; no `dangerouslySetInnerHTML`
- T-02-03-05: `query` state is user's own input, not DB data

## Self-Check: PASSED

- [x] `src/app/orgs/[slug]/patients/page.tsx` exists — commit 9672ee4
- [x] `src/components/patients/PatientTable.tsx` exists — commit 9672ee4
- [x] `src/components/patients/CreatePatientDialog.tsx` exists — commit 211a49c
- [x] PatientTable has `'use client'`, Yeni Hasta, search, tc_kimlik_no_masked, Görüntüle, both empty states
- [x] CreatePatientDialog has `'use client'`, zodResolver, type="text", font-mono, Oluşturuluyor, İptal
- [x] `npx tsc --noEmit` — only pre-existing server.ts error; zero new errors from this plan's files
