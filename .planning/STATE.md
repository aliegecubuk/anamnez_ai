# AnamnezAl — Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Diş hekimi sesle anamnez + chart doldurur, hiçbir şeye dokunmaz
**Current focus:** Phase 1 — Temel Altyapı

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Temel Altyapı | Not Started |
| 2 | Hasta Yönetimi | Not Started |
| 3 | Ses Boru Hattı | Not Started |
| 4 | Anamnez Motoru | Not Started |
| 5 | Dental AI Açıklamaları | Not Started |
| 6a | Periodontoloji Chartı | Not Started |
| 6b | Patoloji Chartı | Not Started |

## Current Position

**Phase:** 1 — Temel Altyapı
**Plan:** None started
**Status:** Not Started
**Progress:** [-------] 0/7 phases complete

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 Requirements | 56 |
| Phases | 7 |
| Plans complete | 0 |
| Phases complete | 0 |

## Accumulated Context

### Key Decisions (from PROJECT.md)
- FDI tooth numbering locked (Turkish dental university standard)
- Whisper API for STT (best Turkish accuracy)
- Cloud storage, no PDF output, digital-only
- Blank ≠ zero for perio chart (NULL = no problem recorded)
- KVKK compliance required from Phase 1
- Supabase region: Frankfurt (EU data residency for KVKK)

### Critical Constraints
- Tooth number accuracy is zero-tolerance: 18 MUST NOT be recorded as 28
- Disambiguation + confirmation required before any tooth value is written in Phases 6a and 6b
- KVKK consent gates block save in Phases 4 and 6a
- All core workflows (anamnesis, perio chart, pathology chart) must be completable by voice alone
- AI descriptions must be dental-only — no general medical information

### Blockers
None at project start.

### Todos
- Run `/gsd-plan-phase 1` to begin Phase 1 planning

## Session Continuity

- Roadmap initialized: 2026-05-01
- Requirements finalized: 56 v1 requirements, 0 orphans
- Phase 6a and 6b depend on Phase 4 (not Phase 3 — voice pipeline feeds anamnesis engine, charts are separate consumers)
- Phase 5 (Dental AI Descriptions) depends on Phase 4 (descriptions attach to anamnesis form fields)
- Phases 6a and 6b can be developed in parallel after Phase 4 completes

## Next Action

Run `/gsd-plan-phase 1` to begin Phase 1 planning.
