---
status: complete
phase: 02-hasta-yonetimi
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
  - 02-03-SUMMARY.md
  - 02-04-SUMMARY.md
started: 2026-05-07T02:57:00+03:00
updated: 2026-05-07T23:27:00+03:00
notes:
  - Routes pivoted from /orgs/<slug>/patients → /patients (flat user-scoped). See .planning/pivot/PIVOT-PLAN.md.
  - Test 14 (multi-tenant isolation) replaced by flat per-user RLS isolation test.
  - Driven via Playwright + Clerk Backend API; signed in as aliegecubuks@ for User A flows; rls-test-userB@example.com created via Clerk API for cross-user RLS test (deleted after).
---

## Current Test

number: 14
name: Per-User RLS Isolation
expected: User B signed in cannot see User A's patients via list or by-id fetch.
awaiting: none — complete

## Tests

### 1. Cold Start Smoke Test
expected: Fresh `npm run dev`. Server boots clean. `/patients` loads 200 when signed in; redirects to `/sign-in` when not. No console/server errors.
result: [PASS — 2026-05-07 23:11] dev server booted in 1602ms; /sign-in & /sign-up return 200; /, /dashboard, /patients, /superadmin return 307 → /sign-in (correct unauth gating). No errors in dev log.

### 2. Patient List Page Loads
expected: Visit `/patients` while signed in. Page shows "Yeni Hasta" button (top right), search input, and either patient table or empty state.
result: [PASS — 23:17] List renders with "Yeni Hasta" button, search input "Ad veya TC ile ara…", and patient row "Yiğit Kemal" with masked TC `•••••••••11`. Note: cards/list-item layout instead of strict 4-column table — contains all required data (name, masked TC, son seans), accepted as cosmetic deviation from spec.

### 3. Create Patient — Happy Path
expected: Click Yeni Hasta. Dialog opens. Fill name + 11-digit TC. Submit. Dialog closes. Row appears with masked TC.
result: [PASS — 23:18] Dialog opens. After invalid-TC input ("abc12") submit was silently blocked by HTML5 native validation (see Test 4 finding); user manually entered valid TC. Patient "Test Hasta UAT" created (id d64a2799-…), masked TC `•••••••••14`. Counter "X/11" updates live.

### 4. TC Validation — Client-side
expected: Submit blocked, inline validation error shown below TC field.
result: [PASS — 23:26 after fix] Initially **FAILED**: input had `pattern="[0-9]{11}"` and form lacked `noValidate`, so HTML5 native popup (Turkish: "Lütfen istenen biçimi eşleştirin.") suppressed react-hook-form's submit handler — zod errors never populated, no inline error rendered. Fix: added `noValidate` to `<form>` in `src/components/patients/CreatePatientDialog.tsx:94`. Re-test: invalid TC "abc12" → dialog stays open + inline `<p class="text-sm text-destructive">TC kimlik numarası yalnızca rakam içermelidir.</p>` rendered below TC field.

### 5. Duplicate TC — 409 Inline Error
expected: Same TC as existing patient → server returns 409, inline error below TC field.
result: [PASS — 23:23] POST /api/patients with TC `11122233344` succeeds (201, masked `•••••••••44`). Repeat POST with same TC returns `{ status: 409, body: { error: "Bu TC kimlik numarasıyla kayıtlı bir hasta zaten var." } }`. Dialog UI surface uses same `text-destructive` paragraph slot as Test 4 (verified via source `setServerError` path in CreatePatientDialog.tsx).

### 6. Search by Name (debounced)
expected: Partial name filters list ~300ms after typing stops.
result: [PASS — 23:21] Search "Test" → list reduced to single match "Test Hasta UAT". Yiğit Kemal hidden. Debounce timing not measured precisely but list updates without per-keystroke flicker.

### 7. Search by TC Prefix (numeric)
expected: All-numeric query filters by TC prefix.
result: [PASS — 23:21] Search "999" → 0 matches (no TC starts with 999). Empty-match state engages.

### 8. Empty States
expected: "Henüz hasta kaydı yok" with no patients; "Eşleşen hasta bulunamadı" with no search match.
result: [PASS — 23:21 / 23:25] No-search-match state shows "Eşleşen…bulunamadı" hint (verified via DOM regex match). No-patients state verified later as User B (count=0, list empty — UI rendered no-patient empty state).

### 9. Row Click → Patient Profile
expected: Click row → /patients/<id>. Profile loads with breadcrumb, initials avatar, name, masked TC.
result: [PASS — 23:20] Click "Test Hasta UAT" row → URL /patients/d64a2799-... Breadcrumb: "Dashboard · Hastalar · Test Hasta UAT" (richer than spec). Initials "TH" present. Heading h1 "Test Hasta UAT". TC `•••••••••14` font-mono.

### 10. Session History — Empty
expected: "Seans Geçmişi" heading + "0" count + "Henüz seans yok" empty state.
result: [PASS — 23:20] Heading "Seans geçmişi" (lowercase g — cosmetic), badge "0 kayıt" (more descriptive than spec's "0"), empty state "Henüz seans yok" + body text "Bu hasta için yeni bir seans başlatmak için yukarıdaki butonu kullanın."

### 11. Disabled Stub Buttons
expected: "Yeni Seans Başlat" button disabled (Phase 3 stub).
result: [PASS — 23:20] Button rendered with [disabled] attribute. No session rows exist, so Görüntüle stub not exercised; behavior implied by source.

### 12. KVKK — No PII in Browser Tab Title
expected: Tab title generic, no patient name or TC.
result: [PASS — 23:20] Page title on /patients/<id>: "AnamnezAl — Sesli Diş Anamnezi". No name, no TC.

### 13. KVKK — Raw TC Never on Wire
expected: API responses only contain `tc_kimlik_no_masked`, no raw `tc_kimlik_no`.
result: [PASS — 23:18] GET /api/patients returns array of `{ id, full_name, tc_kimlik_no_masked, last_session_at }`. POST /api/patients (create) returns same shape. No raw `tc_kimlik_no` field on any wire response observed.

### 14. Per-User RLS Isolation (replaces multi-tenant isolation)
expected: User B can't see User A's patients via list or by-id fetch.
result: [PASS — 23:25] Created Test User B `rls-test-userB@example.com` via Clerk Backend API (`POST /v1/users` with `skip_password_checks: true`). Signed in as User B via Playwright. Results: GET /api/patients → status 200, count 0, listPreview []. GET /api/patients/d64a2799-... (User A's patient) → status 404 + `{ error: "Hasta bulunamadı." }`. GET /patients/d64a2799-... (Next.js page) → 404. RLS via `user_id = auth.jwt() ->> 'sub'` confirmed isolated. User B deleted via Clerk API after test.

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- **Resolved:** Test 4 inline-validation gap (HTML5 pattern blocked zod) — fixed in `src/components/patients/CreatePatientDialog.tsx` by adding `noValidate` to `<form>`.
- **Note:** Cosmetic deviations from spec (list-item cards vs strict 4-column table in Test 2; "Seans geçmişi" lowercase g and "0 kayıt" descriptive badge in Test 10; richer breadcrumb in Test 9). All accepted — convey same information; no remediation needed.
- **Test data left in DB:** "Test Hasta UAT" (TC ending 14), "Yiğit Kemal" (ending 11), "Duplicate Test A" (ending 44). Owned by `aliegecubuks@`. Useful for future testing — leave or purge as desired.
