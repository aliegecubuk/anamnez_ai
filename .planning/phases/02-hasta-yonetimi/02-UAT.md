---
status: testing
phase: 02-hasta-yonetimi
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
  - 02-03-SUMMARY.md
  - 02-04-SUMMARY.md
started: 2026-05-07T02:57:00+03:00
updated: 2026-05-07T23:11:00+03:00
notes:
  - Routes pivoted from /orgs/<slug>/patients → /patients (flat user-scoped). See .planning/pivot/PIVOT-PLAN.md.
  - Test 14 (multi-tenant isolation) replaced by flat per-user RLS isolation test.
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Fresh `npm run dev`. Server boots without errors, Next.js compiles, navigating to `/patients` (signed in) returns a live page (200) with no runtime errors in browser console or server log. Unauthenticated visit redirects to `/sign-in`.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Fresh `npm run dev`. Server boots clean. `/patients` loads 200 when signed in; redirects to `/sign-in` when not. No console/server errors.
result: [PASS — 2026-05-07 23:11] dev server booted in 1602ms; /sign-in & /sign-up return 200; /, /dashboard, /patients, /superadmin return 307 → /sign-in (correct unauth gating). No errors in dev log.

### 2. Patient List Page Loads
expected: Visit `/patients` while signed in. Page shows "Yeni Hasta" button (top right), search input, and either patient table (Ad Soyad, TC Kimlik No, Son Seans, İşlemler columns) or "Henüz hasta kaydı yok" empty state.
result: [pending]

### 3. Create Patient — Happy Path
expected: Click "Yeni Hasta". Dialog opens. Fill `Ad Soyad` (e.g., "Test Hasta") + `TC Kimlik No` (11 digits, e.g., "12345678901"). Live X/11 counter updates. Submit. Dialog closes. New row appears in table. TC column shows masked format `•••••••••01` (9 bullets + last 2 digits), font-mono.
result: [pending]

### 4. TC Validation — Client-side
expected: Open create dialog. Try TC with letters or fewer than 11 digits. Submit blocked, inline validation error shown below TC field. Counter shows current length / 11.
result: [pending]

### 5. Duplicate TC — 409 Inline Error
expected: Try to create patient with same TC as an existing patient owned by this user. Server returns 409. Inline error appears BELOW the TC field (not as toast). Dialog stays open.
result: [pending]

### 6. Search by Name (debounced)
expected: Type partial name (e.g., "Tes") in search input. ~300ms after typing stops, list filters to matching names (case-insensitive). No request fires per keystroke.
result: [pending]

### 7. Search by TC Prefix (numeric)
expected: Type all-numeric query (e.g., "123") in search input. List filters to patients whose TC starts with that prefix. Debounce ~300ms.
result: [pending]

### 8. Empty States
expected: With no patients owned by user: "Henüz hasta kaydı yok". With patients but no search match: "Eşleşen hasta bulunamadı".
result: [pending]

### 9. Row Click → Patient Profile
expected: Click any row (or Görüntüle link). Navigates to `/patients/<id>`. Profile page loads with breadcrumb "Hastalar › <patient name>", initials avatar (40×40 circle, first letters of first+last word, max 2 chars uppercase), name (text-xl), TC masked font-mono.
result: [pending]

### 10. Session History — Empty
expected: New patient profile shows separator, "Seans Geçmişi" heading with count badge "0", and empty state "Henüz seans yok" centered with body text.
result: [pending]

### 11. Disabled Stub Buttons
expected: On profile page, "Yeni Seans Başlat" button visible but disabled (Phase 3 stub). If session rows exist, "Görüntüle" buttons disabled (Phase 4/6 stub). Hover shows title attribute hint.
result: [pending]

### 12. KVKK — No PII in Browser Tab Title
expected: On `/patients/<id>`, browser tab title does NOT contain patient full name or TC. Generic app name only.
result: [pending]

### 13. KVKK — Raw TC Never on Wire
expected: Open DevTools → Network. Trigger any patient API call (list, profile, create). Inspect JSON response: only `tc_kimlik_no_masked` field present, NO `tc_kimlik_no` raw field.
result: [pending]

### 14. Per-User RLS Isolation (replaces multi-tenant isolation)
expected: User A creates a patient. User B signs in (different account), visits `/patients` — User A's patient is NOT visible. User B calling `/api/patients/<userA_patient_id>` returns 404 (RLS hides the row, app surfaces as not-found). DB-level test: SELECT * FROM patients with User B's JWT context returns only B's rows.
result: [pending]

## Summary

total: 14
passed: 1
issues: 0
pending: 13
skipped: 0
blocked: 0

## Gaps

[none yet]
