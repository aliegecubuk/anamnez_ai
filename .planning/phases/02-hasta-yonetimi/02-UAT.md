---
status: testing
phase: 02-hasta-yonetimi
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
  - 02-03-SUMMARY.md
  - 02-04-SUMMARY.md
started: 2026-05-07T02:57:00+03:00
updated: 2026-05-07T02:57:00+03:00
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running dev server. Clear caches/lock files if any. Start `npm run dev` from scratch. Server boots without errors, Next.js compiles, navigating to `/orgs/<your-slug>/patients` returns a live page (200) with no runtime errors in browser console or server log.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Fresh `npm run dev`. Server boots clean. `/orgs/<slug>/patients` loads 200, no console/server errors.
result: [pending]

### 2. Patient List Page Loads
expected: Visit `/orgs/<slug>/patients`. Page shows "Yeni Hasta" button (top right), search input, and either patient table (Ad Soyad, TC Kimlik No, Son Seans, İşlemler columns) or "Henüz hasta kaydı yok" empty state.
result: [pending]

### 3. Create Patient — Happy Path
expected: Click "Yeni Hasta". Dialog opens. Fill `Ad Soyad` (e.g., "Test Hasta") + `TC Kimlik No` (11 digits, e.g., "12345678901"). Live X/11 counter updates. Submit. Dialog closes. New row appears in table. TC column shows masked format `•••••••••01` (9 bullets + last 2 digits), font-mono.
result: [pending]

### 4. TC Validation — Client-side
expected: Open create dialog. Try TC with letters or fewer than 11 digits. Submit blocked, inline validation error shown below TC field. Counter shows current length / 11.
result: [pending]

### 5. Duplicate TC — 409 Inline Error
expected: Try to create patient with same TC as an existing patient in this tenant. Server returns 409. Inline error appears BELOW the TC field (not as toast). Dialog stays open.
result: [pending]

### 6. Search by Name (debounced)
expected: Type partial name (e.g., "Tes") in search input. ~300ms after typing stops, list filters to matching names (case-insensitive). No request fires per keystroke.
result: [pending]

### 7. Search by TC Prefix (numeric)
expected: Type all-numeric query (e.g., "123") in search input. List filters to patients whose TC starts with that prefix. Debounce ~300ms.
result: [pending]

### 8. Empty States
expected: With no patients in tenant: "Henüz hasta kaydı yok". With patients but no search match: "Eşleşen hasta bulunamadı".
result: [pending]

### 9. Row Click → Patient Profile
expected: Click any row (or Görüntüle link). Navigates to `/orgs/<slug>/patients/<id>`. Profile page loads with breadcrumb "Hastalar › <patient name>", initials avatar (40×40 circle, first letters of first+last word, max 2 chars uppercase), name (text-xl), TC masked font-mono.
result: [pending]

### 10. Session History — Empty
expected: New patient profile shows separator, "Seans Geçmişi" heading with count badge "0", and empty state "Henüz seans yok" centered with body text.
result: [pending]

### 11. Disabled Stub Buttons
expected: On profile page, "Yeni Seans Başlat" button visible but disabled (Phase 3 stub). If session rows exist, "Görüntüle" buttons disabled (Phase 4/6 stub). Hover shows title attribute hint.
result: [pending]

### 12. KVKK — No PII in Browser Tab Title
expected: On `/orgs/<slug>/patients/<id>`, browser tab title does NOT contain patient full name or TC. Generic app name only.
result: [pending]

### 13. KVKK — Raw TC Never on Wire
expected: Open DevTools → Network. Trigger any patient API call (list, profile, create). Inspect JSON response: only `tc_kimlik_no_masked` field present, NO `tc_kimlik_no` raw field.
result: [pending]

### 14. Tenant Isolation — Cross-org Block
expected: While signed in to tenant A, manually visit `/orgs/<tenant-B-slug>/patients` (or call API directly). Returns 403 (or notFound on profile page). No tenant B data leaks.
result: [pending]

## Summary

total: 14
passed: 0
issues: 0
pending: 14
skipped: 0
blocked: 0

## Gaps

[none yet]
