---
phase: 02-hasta-yonetimi
plan: 04
subsystem: ui
tags: [patient-profile, server-component, session-history, kvkk, tc-masking]
dependency_graph:
  requires: [02-02]
  provides: [patient-profile-page, patient-profile-header, session-history-table]
  affects: [02-03]
tech_stack:
  added: []
  patterns: [server-component-cookie-forwarding, shadcn-badge-variants, initials-avatar]
key_files:
  created:
    - src/app/orgs/[slug]/patients/[id]/page.tsx
    - src/components/patients/PatientProfileHeader.tsx
    - src/components/patients/SessionHistoryTable.tsx
  modified: []
decisions:
  - "PatientProfileHeader uses pre-masked tcMasked prop from API — raw TC never enters client component state (T-02-04-02)"
  - "page.tsx does not export metadata with patient name — prevents PII in browser tab title (T-02-04-01 KVKK)"
  - "patoloji badge uses inline style for #D97706 — Tailwind v4 CSS-based config does not generate arbitrary color utilities from CSS vars in all contexts"
  - "'Görüntüle' button is disabled stub — Phase 4/6a/6b will replace with Link to session view route"
  - "'Yeni Seans Başlat' button is disabled stub — Phase 3 will wire real handler"
  - "SessionHistoryTable has no 'use client' directive — server-compatible, Link-based navigation only"
metrics:
  duration: ~10 minutes
  completed: 2026-05-02
---

# Phase 2 Plan 4: Patient Profile Page Summary

Patient profile page at /orgs/[slug]/patients/[id]: server component fetches PatientResponse, renders header card with initials avatar + masked TC, separator, "Seans Geçmişi" heading with count badge, and session history table with badge variants.

## What Was Built

### src/app/orgs/[slug]/patients/[id]/page.tsx
- Server component; fetches PatientResponse from same-origin API with cookie forwarding
- Breadcrumb "Hastalar" (link) › patient name (truncated max-w-[30ch])
- Renders PatientProfileHeader, Separator, section heading with session count badge, SessionHistoryTable
- notFound() on 404 or non-ok API response
- No `metadata` export with patient name — KVKK T-02-04-01 compliance

### src/components/patients/PatientProfileHeader.tsx
- Card layout: initials avatar (40×40px circle, bg-secondary), name (text-xl font-semibold), masked TC in font-mono
- getInitials() fn: splits on whitespace, takes first char of each word, max 2 chars, uppercase
- "Yeni Seans Başlat" button: disabled stub, min-h-[44px], title attribute for accessibility
- tcMasked prop receives pre-masked string from API — raw TC never in client state

### src/components/patients/SessionHistoryTable.tsx
- Server-compatible (no 'use client')
- Empty state: "Henüz seans yok" + body text (exact UI-SPEC copy), py-12 centered
- Table: 4 columns — Tarih (160px, tr-TR locale dd.MM.yyyy HH:mm), Form Tipi (140px), Durum (120px), İşlemler (100px)
- FormTypeBadge variants: anamnez=default, perio=outline+text-primary, patoloji=outline+#D97706 inline style, genel=secondary
- StatusBadge: completed="Tamamlandı" (secondary), draft="Taslak" (outline)
- Row height h-12 (48px per UI-SPEC touch target)
- "Görüntüle" disabled stub button (Phase 4/6a/6b wires it)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| "Yeni Seans Başlat" button — `disabled` | PatientProfileHeader.tsx | Phase 3 will wire session creation handler |
| "Görüntüle" button — `disabled` | SessionHistoryTable.tsx | Phase 4/6a/6b will implement session view routes |

Both stubs are intentional per plan spec. They do NOT prevent the plan goal (patient profile view) — the page fully renders patient data and session history.

## Threat Flags

No new threat surface beyond plan's threat model. All T-02-04-01 through T-02-04-05 mitigations implemented:
- T-02-04-01: No `metadata` export with fullName; page title is app name only
- T-02-04-02: PatientProfileHeader receives `tcMasked` prop (pre-masked from API); raw TC never in component state
- T-02-04-03: notFound() on 404/403 — cross-tenant URL guessing reveals nothing (API calls verifyTenantAccess + RLS)
- T-02-04-04: fullName rendered as JSX text child — React escapes HTML entities
- T-02-04-05: baseUrl is NEXT_PUBLIC_APP_URL (same-origin) — cookies forwarded only to own API routes

## Self-Check: PASSED

- [x] `src/app/orgs/[slug]/patients/[id]/page.tsx` exists — commit fc30ca5
- [x] `src/components/patients/PatientProfileHeader.tsx` exists — commit fc30ca5
- [x] `src/components/patients/SessionHistoryTable.tsx` exists — commit 1b58e6b
- [x] Breadcrumb "Hastalar" link + patient name in page.tsx
- [x] PatientProfileHeader: getInitials, font-mono, disabled button, min-h-[44px]
- [x] SessionHistoryTable: Henüz seans yok, Tamamlandı, Taslak, FormTypeBadge, tr-TR, h-12
- [x] notFound() on 404 and non-ok responses
- [x] No metadata export with PII
- [x] npx tsc --noEmit: only pre-existing server.ts error (documented in 02-02-SUMMARY.md), zero new errors
