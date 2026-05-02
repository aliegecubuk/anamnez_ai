# AnamnezAl — Roadmap

**Project:** Hands-free dental anamnesis + charting web application
**Milestone:** v1
**Granularity:** Standard
**Coverage:** 55/55 v1 requirements mapped ✓
**Last updated:** 2026-05-02

---

## Phases

- [x] **Phase 1: Temel Altyapı** — Next.js 15 + Supabase (Frankfurt) + Clerk multi-tenant auth, RLS, KVKK baseline (4/4 plans complete)
- [ ] **Phase 2: Hasta Yönetimi** — Patient profile CRUD, search, session shell, history view
- [ ] **Phase 3: Ses Boru Hattı** — Browser mic → Whisper API (Turkish) → real-time transcript, Safari/Chrome compat
- [ ] **Phase 4: Anamnez Motoru** — Admin form template UI + GPT-4o transcript→form mapping, missing-info alerts, KVKK/consent gates
- [ ] **Phase 5: Dental AI Açıklamaları** — Click-to-expand dental-specific AI descriptions for meds/diseases/allergies
- [ ] **Phase 6a: Periodontoloji Chartı** — FDI 32-tooth 6-point grid, voice fill, disambiguation, NULL≠0, review+save
- [ ] **Phase 6b: Patoloji Chartı** — 32-tooth visual SVG chart, voice-driven condition highlighting, multi-condition, review

---

## Phase Details

### Phase 1: Temel Altyapı
**Goal**: Dentists and admins can securely log in to their tenant — data is isolated, encrypted, and KVKK-compliant from day one
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. An admin can register a new university/clinic tenant and access their isolated workspace
  2. Admin can create dentist and assistant accounts within their tenant and assign roles
  3. A dentist can log in with email/password and remain logged in across browser refreshes
  4. A dentist can reset a forgotten password via email link
  5. Tenant A cannot see or access any data belonging to Tenant B (RLS enforced, verified at DB level)
**Plans**: TBD
**UI hint**: yes

### Phase 2: Hasta Yönetimi
**Goal**: Dentists can create, find, and open patient records, and attach new sessions to a patient
**Depends on**: Phase 1
**Requirements**: PAT-01, PAT-02, PAT-03, PAT-04, PAT-05
**Success Criteria** (what must be TRUE):
  1. Dentist can create a new patient profile with full name and TC identity number
  2. Dentist can search for an existing patient by name or TC number and open their profile
  3. Patient profile lists all past sessions with date and form type
  4. Dentist can open and read any past session in full
  5. Dentist can select a patient and start a new session from their profile
**Plans**: 4 plans
Plans:
- [ ] 02-01-PLAN.md — Supabase migration: patients + sessions tables with RLS
- [ ] 02-02-PLAN.md — API routes: list/search patients, create patient, patient profile + sessions
- [ ] 02-03-PLAN.md — Patient list UI: search table + create patient dialog (Screen 1 + Screen 2)
- [ ] 02-04-PLAN.md — Patient profile UI: header card + session history table (Screen 3)
**UI hint**: yes

### Phase 3: Ses Boru Hattı
**Goal**: Dentists can speak into the browser and see their words transcribed in real time — session audio is never lost
**Depends on**: Phase 2
**Requirements**: STT-01, STT-02, STT-03, STT-04, STT-05, STT-06
**Success Criteria** (what must be TRUE):
  1. Dentist can grant microphone permission and start recording from the browser without installing anything
  2. Spoken Turkish is transcribed live on screen as the dentist speaks (Whisper API)
  3. Dentist can pause, resume, and stop recording at any time
  4. Full transcript is saved to the server as it arrives — closing the tab does not lose it
  5. Recording and transcription work correctly on both Chrome and Safari (MediaRecorder format differences handled)
**Plans**: TBD

### Phase 4: Anamnez Motoru
**Goal**: Admins can build form templates per department, and AI auto-fills the anamnesis form from the transcript — with alerts for missing answers and KVKK consent before saving
**Depends on**: Phase 3
**Requirements**: TPLT-01, TPLT-02, TPLT-03, TPLT-04, TPLT-05, ANAM-01, ANAM-02, ANAM-03, ANAM-04, ANAM-05, ANAM-06
**Success Criteria** (what must be TRUE):
  1. Admin can create a department form template with yes/no, text, multi-select, and numeric question types
  2. Admin can add, edit, reorder, and delete questions on a template without breaking existing saved sessions
  3. Dentist selects a department template before starting a session and the correct question set loads
  4. After recording, AI maps the transcript to form fields and displays each answer with a confidence indicator
  5. Dentist can manually edit any AI-filled field before saving
  6. At session end, AI lists all unanswered questions as alerts; clicking an alert focuses the corresponding field
  7. Session cannot be saved until KVKK data processing consent and informed consent checkboxes are checked
**Plans**: TBD
**UI hint**: yes

### Phase 5: Dental AI Açıklamaları
**Goal**: Every captured medication, systemic disease, and food allergy has an expandable dental-specific AI description with a legal disclaimer
**Depends on**: Phase 4
**Requirements**: DESC-01, DESC-02, DESC-03, DESC-04, DESC-05, DESC-06
**Success Criteria** (what must be TRUE):
  1. Each medication, disease, and allergy in the filled form has a click-to-expand button (collapsed by default, non-intrusive)
  2. Expanded description is exactly 3 lines: dental/surgical/anesthetic impact, risk level, recommended precaution
  3. Description contains only dental/surgical relevance — no general medical information
  4. For an unknown or rare drug, the system generates a description via active ingredient lookup
  5. Every description ends with the legal disclaimer: "Bu bilgi klinik karar desteği değildir"
**Plans**: TBD
**UI hint**: yes

### Phase 6a: Periodontoloji Chartı
**Goal**: Dentists can voice-fill a 6-point-per-tooth periodontal chart with zero tolerance for tooth number errors, review before saving, and leave unmentioned teeth blank (not zero)
**Depends on**: Phase 4
**Requirements**: PERIO-01, PERIO-02, PERIO-03, PERIO-04, PERIO-05, PERIO-06, PERIO-07, PERIO-08, REVIEW-01, REVIEW-02, REVIEW-03, REVIEW-04
**Success Criteria** (what must be TRUE):
  1. Dentist sees a full FDI 32-tooth periodontal grid (upper + lower jaw, buccal + palatal/lingual rows) with all 6 measurement points (MB, B, DB, ML, L, DL) per tooth
  2. Dentist can say "diş 18, 2mm cep, 4mm ataşman kaybı" and the correct tooth's fields are populated — tooth 18 is never entered as 28
  3. When a tooth number is ambiguous (e.g. 18 vs 28), the system displays an explicit confirmation step before writing any value
  4. Teeth never mentioned by the dentist remain NULL/blank — not zero — in the saved record
  5. At session end, dentist sees the completed form + perio chart together, can edit any cell, and must confirm KVKK + consent before saving
  6. Session with unsaved measurements cannot be saved without a visible warning
  7. Saved sessions are immutable (audit trail) — only an addendum note can be appended afterward
**Plans**: TBD
**UI hint**: yes

### Phase 6b: Patoloji Chartı
**Goal**: Dentists can voice-drive a visual 32-tooth pathology chart, mark multiple color-coded conditions per tooth, and review before the session is finalized
**Depends on**: Phase 4
**Requirements**: PATH-01, PATH-02, PATH-03, PATH-04, PATH-05, PATH-06, PATH-07, REVIEW-05
**Success Criteria** (what must be TRUE):
  1. Dentist sees a visual SVG 32-tooth chart with all teeth displayed in FDI numbering
  2. Dentist can say "diş 22 çürük, diş 25 diş eti çekilmesi" and each tooth is highlighted with the correct color-coded condition
  3. Multiple distinct conditions can be applied to the same tooth simultaneously
  4. All condition types are supported: çürük, diş eti çekilmesi, dolgu, kanal, köprü, eksik diş, diğer
  5. When a tooth number is ambiguous, the same disambiguation confirmation step used in Phase 6a fires before writing
  6. Dentist can click any marked tooth to delete or edit its condition
  7. Completed session appears in the patient's history list with date and form type
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Temel Altyapı | 4/4 | Complete | 2026-05-02 |
| 2. Hasta Yönetimi | 0/4 | In Progress | - |
| 3. Ses Boru Hattı | 0/? | Not started | - |
| 4. Anamnez Motoru | 0/? | Not started | - |
| 5. Dental AI Açıklamaları | 0/? | Not started | - |
| 6a. Periodontoloji Chartı | 0/? | Not started | - |
| 6b. Patoloji Chartı | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Complete (01-03) |
| AUTH-04 | Phase 1 | Complete (01-03, 01-04) |
| AUTH-05 | Phase 1 | Complete (01-03, 01-04) |
| AUTH-06 | Phase 1 | Complete (01-04) |
| AUTH-07 | Phase 1 | Complete (01-02, 01-03) |
| PAT-01 | Phase 2 | Planned (02-01, 02-02, 02-03) |
| PAT-02 | Phase 2 | Planned (02-01, 02-02, 02-03) |
| PAT-03 | Phase 2 | Planned (02-01, 02-02, 02-04) |
| PAT-04 | Phase 2 | Planned (02-01, 02-02, 02-04) |
| PAT-05 | Phase 2 | Planned (02-01, 02-02, 02-04) |
| STT-01 | Phase 3 | Pending |
| STT-02 | Phase 3 | Pending |
| STT-03 | Phase 3 | Pending |
| STT-04 | Phase 3 | Pending |
| STT-05 | Phase 3 | Pending |
| STT-06 | Phase 3 | Pending |
| TPLT-01 | Phase 4 | Pending |
| TPLT-02 | Phase 4 | Pending |
| TPLT-03 | Phase 4 | Pending |
| TPLT-04 | Phase 4 | Pending |
| TPLT-05 | Phase 4 | Pending |
| ANAM-01 | Phase 4 | Pending |
| ANAM-02 | Phase 4 | Pending |
| ANAM-03 | Phase 4 | Pending |
| ANAM-04 | Phase 4 | Pending |
| ANAM-05 | Phase 4 | Pending |
| ANAM-06 | Phase 4 | Pending |
| DESC-01 | Phase 5 | Pending |
| DESC-02 | Phase 5 | Pending |
| DESC-03 | Phase 5 | Pending |
| DESC-04 | Phase 5 | Pending |
| DESC-05 | Phase 5 | Pending |
| DESC-06 | Phase 5 | Pending |
| PERIO-01 | Phase 6a | Pending |
| PERIO-02 | Phase 6a | Pending |
| PERIO-03 | Phase 6a | Pending |
| PERIO-04 | Phase 6a | Pending |
| PERIO-05 | Phase 6a | Pending |
| PERIO-06 | Phase 6a | Pending |
| PERIO-07 | Phase 6a | Pending |
| PERIO-08 | Phase 6a | Pending |
| REVIEW-01 | Phase 6a | Pending |
| REVIEW-02 | Phase 6a | Pending |
| REVIEW-03 | Phase 6a | Pending |
| REVIEW-04 | Phase 6a | Pending |
| PATH-01 | Phase 6b | Pending |
| PATH-02 | Phase 6b | Pending |
| PATH-03 | Phase 6b | Pending |
| PATH-04 | Phase 6b | Pending |
| PATH-05 | Phase 6b | Pending |
| PATH-06 | Phase 6b | Pending |
| PATH-07 | Phase 6b | Pending |
| REVIEW-05 | Phase 6b | Pending |

**Total v1 requirements:** 55 mapped across 7 phases ✓

---
*Roadmap created: 2026-05-01*
*Last updated: 2026-05-02 — Phase 2 plans finalized (4 plans)*
