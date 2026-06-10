---
plan: 04-02
status: complete
commits:
  - fcc99d2: "feat(04-02): template + question CRUD API routes"
  - 7443ab8: "feat(04-02): publish route — immutable template_versions snapshot"
  - 530d0ec: "feat(04-02): admin template builder UI"
requirements: [TPLT-01, TPLT-02, TPLT-03, TPLT-04]
key-files:
  created:
    - src/app/api/templates/route.ts
    - src/app/api/templates/[id]/route.ts
    - src/app/api/templates/[id]/questions/route.ts
    - src/app/api/templates/[id]/questions/[questionId]/route.ts
    - src/app/api/templates/[id]/publish/route.ts
    - src/app/admin/layout.tsx
    - src/app/admin/templates/page.tsx
    - src/app/admin/templates/[id]/page.tsx
    - src/components/templates/TemplateList.tsx
    - src/components/templates/CreateTemplateDialog.tsx
    - src/components/templates/QuestionEditor.tsx
completed: 2026-06-11
duration: ~10 min
---

# Phase 4 Plan 02: Template CRUD API + Admin Builder UI Summary

**One-liner:** Superadmin-gated template/question CRUD API (5 routes) with insert-only publish snapshots into template_versions, plus the /admin/templates builder UI (list, create dialog, question editor with all 4 types + reorder + publish).

## What Was Built

### Task 1 — CRUD API routes (fcc99d2)
- `GET/POST /api/templates` — list non-archived with `question_count` via `template_questions(count)`; create draft (422 'Şablon adı zorunludur.' / 'Geçersiz bölüm.')
- `GET/PATCH/DELETE /api/templates/[id]` — header + ordered questions; name/department update with `updated_at = now()`; DELETE is SOFT (`is_archived = true`) so template_versions referenced by sessions survive
- `GET/POST/PATCH /api/templates/[id]/questions` — POST assigns `position = max+1`, retries once on 23505 then 409; PATCH reorder validates id set then two-phase write (+1000 offset, then final indices) to keep UNIQUE(template_id, position) satisfied throughout (T-04-07)
- `PATCH/DELETE /api/templates/[id]/questions/[questionId]` — partial update re-validates multi_select options against the EFFECTIVE post-update state; clears stale options when type changes away from multi_select; hard delete from draft set only
- Every handler: `auth()` → 401, `getRole() !== 'superadmin'` → 403 'Yetkisiz erişim.' (T-04-05), `supabaseAdmin` + `.eq('user_id', userId)` ownership

### Task 2 — Publish route (7443ab8)
- `POST /api/templates/[id]/publish`: loads header (404) + questions; 422 'Yayınlamak için en az bir soru ekleyin.' on empty; builds `SnapshotQuestion[]`; INSERT-only into `template_versions` (never update/delete — TPLT-04/T-04-06); 23505 on (template_id, version) → 409 'Bu sürüm zaten yayınlanmış.'; bumps `form_templates.current_version`; returns `{ version, template_version_id, question_count }` 201

### Task 3 — Admin builder UI (530d0ec)
- `src/app/admin/layout.tsx` — server-side `metadata?.role !== 'superadmin'` → redirect('/sign-in') (copied from superadmin layout)
- `/admin/templates` (force-dynamic server page) — supabaseAdmin fetch, breadcrumb `Dashboard · Admin · Şablonlar`, `<CreateTemplateDialog />` in header
- `TemplateList` — shadcn Table: Ad, Bölüm (Badge), Sürüm (v{n} / 'Taslak'), Soru sayısı, Güncellendi; row click → `/admin/templates/{id}`; exports `DEPARTMENT_LABELS`
- `CreateTemplateDialog` — RHF + zod (`noValidate` form per STATE.md note), name Input + native department `<select>`, POST /api/templates, toast on error, `router.refresh()` on success
- `/admin/templates/[id]` — server page, notFound on missing, renders header badges + QuestionEditor
- `QuestionEditor` (~400 lines) — add form (prompt + type select with Turkish labels + required checkbox + dynamic multi_select options editor), inline edit, delete, up/down reorder (optimistic + rollback, PATCH `{ order }`), publish button `Yayınla (v{next})` → toast `vN yayınlandı` + refresh; all failures → `toast.error`

## Deviations from Plan

1. **Publish button placement:** plan described a "Yayınla (v{next})" button on the [id] page AND in QuestionEditor. Both require client interactivity; rendered once inside QuestionEditor's toolbar (receives `currentVersion`) to avoid a 7th unplanned client component. Functionally identical.
2. **CreateTemplateDialog is self-contained** (own trigger button + open state) rather than controlled-props like CreatePatientDialog — parent list page is a server component, so controlled props were impossible without an extra client wrapper. Uses `router.refresh()` per plan.
3. **No `select.tsx` UI primitive exists** (plan's interfaces note listed it) — used native `<select>` styled to match Input, which the task action itself specified. Not a behavior change.

## Verification Results

| Check | Result |
|-------|--------|
| Task 1 automated (4 files + VALID_QUESTION_TYPES + getRole greps + tsc) | PASS |
| Task 2 automated (insert-only publish greps, no update/delete on template_versions) | PASS |
| Task 3 automated (6 files + gating/fetch/publish greps + tsc) | PASS |
| `npx tsc --noEmit -p .` full project | EXIT 0 (clean) |
| Live API/DB verification | DEFERRED — Supabase project PAUSED (04-01 blocker); migration SQL used as schema source of truth |

## Known Stubs

None — all components wired to live API routes; no placeholder data.

## Threat Flags

None beyond the plan's threat model — all new endpoints are covered by T-04-05/06/07 mitigations as specified.

## Self-Check: PASSED
- All 11 created files exist on disk
- Commits fcc99d2, 7443ab8, 530d0ec present in git log
