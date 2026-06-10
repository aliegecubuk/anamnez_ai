---
plan: 04-04
status: complete
commits:
  - afd6e23: "feat(04-04): template picker at session start (TPLT-05)"
  - 22e3940: "feat(04-04): anamnesis API — AI mapping, answer persistence, consent-gated complete"
  - 1f1d0ef: "feat(04-04): anamnesis form UI + consent gate + missing alerts"
requirements: [TPLT-05, ANAM-01, ANAM-02, ANAM-03, ANAM-04, ANAM-05, ANAM-06]
key-files:
  created:
    - src/components/sessions/TemplatePicker.tsx
    - src/app/api/sessions/[id]/anamnesis/route.ts
    - src/app/api/sessions/[id]/complete/route.ts
    - src/components/sessions/AnamnesisForm.tsx
    - src/components/sessions/ConsentGate.tsx
  modified:
    - src/lib/sessions/types.ts
    - src/lib/templates/types.ts
    - src/app/api/sessions/route.ts
    - src/app/api/templates/route.ts
    - src/app/admin/templates/page.tsx
    - src/components/patients/StartSessionButton.tsx
    - src/components/sessions/SessionWorkspace.tsx
    - src/app/patients/[id]/sessions/[sessionId]/page.tsx
completed: 2026-06-11
duration: ~12 min
---

# Phase 4 Plan 04: Anamnesis UI End-to-End Summary

**One-liner:** Dentist-facing anamnesis flow wired end-to-end — published-template picker at session start binds an immutable version; after recording, GPT-4o fills the form with 3-tier confidence badges, fields are inline-editable (debounced PATCH, human-edited flag), unanswered required questions surface as click-to-focus alerts, and save is gated behind KVKK + informed-consent checkboxes plus a server 422 / DB CHECK backstop.

## What Was Built

### Task 1 — Template picker at session start (afd6e23)
- `src/lib/sessions/types.ts`: `CreateSessionBody.template_version_id?`; new `SessionTemplateInfo`.
- `POST /api/sessions`: validates `template_version_id` belongs to user (404 'Şablon sürümü bulunamadı.'), stores it, forces `form_type='anamnez'` when present.
- `GET /api/templates`: embeds `template_versions(id, version)` and resolves `latest_version_id` (the published version's id matching `current_version`, else null). Added `latest_version_id` to `TemplateListItem`.
- `TemplatePicker.tsx`: dialog listing only published templates (`latest_version_id != null`); returns the chosen version id or null (Şablonsuz Başlat).
- `StartSessionButton.tsx`: opens picker first; picker selection drives session creation with the version id, preserving codec negotiation + redirect.

### Task 2 — Anamnesis + complete API (22e3940)
- `POST /api/sessions/[id]/anamnesis` (`runtime='nodejs'`, `maxDuration=60`): auth+ownership; 422 'Bu seansa şablon atanmamış.' when no template; loads version questions; concatenates transcript segments ordered by sequence; `mapTranscriptToAnswers`; upserts answers `onConflict: 'session_id,question_id'`; returns `{ answers (ordered by position), missing (buildMissingAlerts), corrected_transcript }`; `AnamnesisMappingError` → 502 'AI form doldurma başarısız.'.
- `GET` loads saved answers ordered to snapshot positions + recomputes missing.
- `PATCH` (ANAM-03): `{ question_id, answer_value }`; ownership-checked; sets `edited_by_human=true`, `confidence=null`; 404 if not owned.
- `POST /api/sessions/[id]/complete` (ANAM-06): 422 'KVKK ve onam onayı gereklidir.' unless both flags true; sets `status='completed'`, `completed_at`, `recorder_state='completed'`; DB CHECK 23514 → 409 backstop.

### Task 3 — Form UI + consent gate + alerts (1f1d0ef)
- `ConsentGate.tsx` (~110 lines): two native styled checkboxes (KVKK + Aydınlatılmış onam); "Seansı Kaydet" disabled until both checked; POSTs /complete; `onSaved()` → router push; toast on error.
- `AnamnesisForm.tsx` (~290 lines): props `{ sessionId, patientId, questions, initialAnswers, initialMissing }`; AI fill POST on mount when no answers (spinner "AI form dolduruyor…"); per-type fields (yes_no segmented Evet/Hayır, text/numeric Input, multi_select toggle buttons) registered into a `Record<string, HTMLElement>` ref map; 3-tier confidence badge (≥0.8 Yüksek green / 0.5–0.8 Orta amber / <0.5 Düşük red), swapped to "Düzenlendi" when human-edited; editing → debounced PATCH; missing-alerts panel recomputed client-side, each entry focuses+scrolls its field (ANAM-05); renders `<ConsentGate>` at bottom.
- `SessionWorkspace.tsx`: completed/replay branch now renders transcript + `<AnamnesisForm>` when `templateVersionQuestions` non-empty; new props `templateVersionQuestions | null`, `initialAnswers`, `initialMissing`; draft recorder branch unchanged.
- `page.tsx`: selects `template_version_id`; when bound, loads `template_versions.questions` (sorted), `anamnesis_answers` mapped to ordered DTOs, computes `initialMissing` via `buildMissingAlerts`; passes the three new props.

## Deviations from Plan

1. **[Rule 3 — blocking dep] `src/app/admin/templates/page.tsx` updated:** making `TemplateListItem.latest_version_id` a required field (per plan) broke this pre-existing consumer (server page builds the DTO inline). Added `latest_version_id: null` to its mapper — the admin list view never uses it. Not a behavior change; kept the field required as the plan specified rather than weakening the type.
2. **`latest_version_id` resolution via embed, not left-join:** PostgREST cannot filter an embedded resource by a sibling column (`version = current_version`) declaratively, so the GET embeds `template_versions(id, version)` and picks the matching row in the mapper. Same result the plan described; avoids a second round-trip.
3. **No `ui/checkbox` and no `ui/dialog DialogTrigger` controlled usage:** ConsentGate uses native `<input type="checkbox">` (plan-specified). TemplatePicker uses the controlled `Dialog open/onOpenChange` pattern (matches existing CreateTemplateDialog) rather than a `DialogTrigger`, because the trigger is the existing StartSessionButton.

## Verification Results

| Check | Result |
|-------|--------|
| Task 1 automated (TemplatePicker file + 4 greps + tsc filter) | PASS |
| Task 2 automated (2 route files + mapTranscriptToAnswers/buildMissingAlerts/onConflict/consent/status greps) | PASS |
| Task 3 automated (2 files + disabled/kvkk/complete/confidence/focus/AnamnesisForm/template_version_id greps) | PASS |
| `npx tsc --noEmit -p .` full project | EXIT 0 (clean) |
| `npm test` (vitest) | PASS — 3 files, 20 tests (no regression) |
| Save blocked until both checkboxes (button `disabled={!bothChecked}`) AND server 422 without consent | PASS (code-verified) |
| Confidence badges + click-to-focus missing alerts | PASS (code-verified) |
| Live API/DB verification | DEFERRED — Supabase project PAUSED (04-01 blocker); migration SQL is schema source of truth |

## KVKK Consent Gate (ANAM-06) — defense in depth
1. UI: `ConsentGate` save button `disabled` until both checkboxes checked.
2. API: `POST /complete` returns 422 unless both `kvkk_consent` and `informed_consent` are `true`.
3. DB: `sessions_consent_required_when_completed` CHECK (04-01) blocks `status='completed'` without both flags → surfaced as 409.

## Known Stubs

None — all components wired to live API routes; AI fill, edit PATCH, and complete all hit real endpoints. Runtime behavior unverifiable only because the remote Supabase project is paused (pre-existing 04-01 blocker), not because of stubbed data.

## Threat Flags

None new — T-04-11 (server consent gate + DB CHECK), T-04-12 (auth + `.eq('user_id')` on every route), T-04-13 (`edited_by_human` persisted on PATCH + "Düzenlendi" badge), T-04-14 (user_id filter on all answer reads/writes) all implemented as specified. No surface beyond the plan's threat model.

## Self-Check: PASSED
- src/components/sessions/TemplatePicker.tsx — FOUND (afd6e23)
- src/app/api/sessions/[id]/anamnesis/route.ts — FOUND (22e3940)
- src/app/api/sessions/[id]/complete/route.ts — FOUND (22e3940)
- src/components/sessions/AnamnesisForm.tsx — FOUND (1f1d0ef)
- src/components/sessions/ConsentGate.tsx — FOUND (1f1d0ef)
- Commits afd6e23, 22e3940, 1f1d0ef — present in git log
