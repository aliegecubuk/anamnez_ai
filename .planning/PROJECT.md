# AnamnezAl

## What This Is

Hands-free dental anamnesis and charting web application for Turkish dental universities and clinics. The dentist speaks — the AI listens, transcribes, fills the form, and populates charts. No keyboard, no mouse, no cross-contamination.

**Core Value:** A dentist performing treatment must never touch a pen or computer. AnamnezAl makes the entire anamnesis and charting process voice-driven, eliminating cross-contamination risk while capturing more accurate, complete patient records than paper-based workflows.

## Problem

Current dental workflow: dentist treats patient → touches pen → writes on paper → touches computer → clicks teeth on chart. Every touch = contamination vector. Anamnesis forms have 60+ questions that vary by university and department. Doctors skip questions under time pressure. Critical drug interactions, systemic diseases, and allergies go unnoticed. Periodontology charts and pathology charts are filled manually with high error potential.

## Users

| Role | Responsibilities |
|------|-----------------|
| **Diş Hekimi** (Dentist) | Primary user. Records voice session, reviews filled form and charts, flags missing info |
| **Asistan / Öğrenci** | Uses under supervision, same interface as dentist |
| **Admin (Klinik Yöneticisi)** | Manages form templates per department, manages users, configures university settings |

## Context

- **Language**: Turkish (UI and STT)
- **Platform**: Web browser (Chrome-first)
- **Deployment**: Cloud (multi-tenant SaaS — one instance, multiple universities)
- **Data storage**: Cloud, patient profiles with history, digital-only (no PDF)
- **Compliance**: KVKK (Turkish data privacy law) required
- **Tooth numbering**: FDI system (11–18, 21–28, 31–38, 41–48)

## Core Features

### 1. STT — Voice to Text
- Microphone input in-browser
- Whisper API (OpenAI) — best Turkish accuracy, cost-effective
- Real-time or post-session transcription
- Dentist speaks naturally; AI segments the speech into question/answer pairs

### 2. Anamnesis Form Auto-Fill
- 60+ questions covering medications, systemic diseases, allergies, surgical history
- Question set varies per university and per department (configured by admin)
- AI maps transcribed speech to the correct form fields
- Displays filled table to dentist for review

### 3. Missing Information Alerts
- After filling, AI flags any question it could not populate
- Dentist prompted to revisit or manually fill missing fields
- Alert shown clearly before session is saved

### 4. Dental-Specific AI Descriptions (Click-to-expand)
- For every medication, systemic disease, and food allergy captured:
  - 3-line description, strictly dentistry-relevant
  - Examples: drug interaction with local anesthetic, bleeding risk, decay rate impact, anesthesia complication
  - General medical info is excluded — only dental/surgical relevance
- Accessed via click (collapsed by default, non-intrusive)
- Powered by LLM (Claude or GPT-4) with dental-specific prompt constraints

### 5. Periodontology Chart ⭐ CRITICAL
- FDI tooth numbering: 18→11, 21→28 (upper) / 48→41, 31→38 (lower)
- 6 measurement points per tooth: MB, B, DB, ML, L, DL
- Two rows per jaw: buccal measurements + palatal/lingual measurements
- **Pocket Depth** and **Attachment Loss** — both captured per tooth
- Doctor states: "diş 18, 2mm cep derinliği, 4mm ataşman kaybı"
- Unmentioned teeth = no problem = left blank (not zero, blank)
- **Accuracy requirement: tooth 18 must NEVER be recorded as 28. Zero tolerance.**
- Disambiguation strategy: AI confirms ambiguous numbers, uses phonetic + dental context

### 6. Pathology / Caries Chart ⭐ CRITICAL
- Visual interactive tooth chart (all 32 teeth displayed)
- Doctor states: "diş 22 çürük, diş 25 diş eti çekilmesi"
- AI highlights the stated tooth with the stated condition
- Multiple conditions per tooth supported
- Same accuracy requirement as perio chart — tooth number must be exact
- Visual: teeth turn color-coded based on condition type

### 7. Patient Profile System
- Patient created with name + TC kimlik (or clinic number)
- All sessions (forms + charts) stored under patient profile
- History viewable: past anamnesis, past charts, dates
- Doctor can open past session at any time

### 8. Multi-Tenant Form Templates
- Each university = separate tenant with own form templates
- Each department within a university can have different question sets
- Admin creates/edits question templates via UI
- Dentist selects their department template at session start

## Requirements

### Validated
(None yet — ship to validate)

### Active

**Authentication & Multi-tenancy**
- [ ] University/clinic registers as tenant
- [ ] Admin creates dentist and assistant accounts within their tenant
- [ ] Dentist logs in and selects department/template

**Anamnesis (Voice → Form)**
- [ ] Browser microphone capture + Whisper STT
- [ ] AI maps transcript to form fields (60+ questions)
- [ ] Real-time or end-of-session fill options
- [ ] Missing field detection and alert UI
- [ ] Dentist can manually edit any auto-filled field

**AI Dental Descriptions**
- [ ] Click-to-expand per medication, disease, allergy
- [ ] 3-line, dentistry-specific only
- [ ] Works for unknown/rare medications (AI researches active ingredient)

**Periodontology Chart**
- [ ] FDI grid: upper + lower jaw, 6 points per tooth
- [ ] Voice input: tooth number + pocket depth + attachment loss
- [ ] Blank (not zero) for unmentioned teeth
- [ ] Disambiguation for similar-sounding numbers (18/28, 14/24, etc.)
- [ ] Visual review before save

**Pathology / Caries Chart**
- [ ] Visual 32-tooth interactive chart
- [ ] Voice input: tooth number + condition
- [ ] Color-coded condition types (caries, gum recession, etc.)
- [ ] Multiple conditions per tooth

**Patient Management**
- [ ] Create patient profile (name, TC, clinic ID)
- [ ] Attach sessions to patient
- [ ] View patient history (past sessions)

**Form Template Management (Admin)**
- [ ] Admin creates question sets per department
- [ ] Question types: yes/no, text, multi-select, numeric
- [ ] Template versioning (change without breaking old records)

### Out of Scope

- PDF export — not requested
- Mobile native app — web only for now
- English language UI — Turkish only v1
- Integration with existing HIS/clinic software — not scoped
- Billing / appointment scheduling — not dental record focused

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Whisper API for STT | Best Turkish accuracy among available services, low cost, fast | — Pending validation |
| FDI tooth numbering | Confirmed by user — standard in Turkish dental universities | Locked |
| Cloud storage (not local) | Multi-university access, history, admin management | Locked |
| No PDF output | User requested digital-only, history in-app | Locked |
| Blank ≠ zero for perio chart | Unmentioned tooth = healthy = blank, not "0mm" | Locked |
| LLM for dental descriptions | Only AI can handle unknown drugs/diseases with dental-specific framing | — Provider TBD |

## Critical Constraints

1. **Tooth number accuracy is non-negotiable.** 18 ≠ 28. A misfiled tooth in a perio chart causes clinical harm. The system must have disambiguation, confirmation, and phonetic correction built in.
2. **Dental-only AI descriptions.** The LLM must not return general medical info. Prompts must enforce dental/surgical relevance strictly.
3. **KVKK compliance.** Patient data is health data under Turkish law — encryption, consent, data retention policies required.
4. **Hands-free first.** Every core workflow (anamnesis, perio chart, pathology chart) must be completable by voice alone. Mouse/keyboard is for review and correction only.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-01 after initialization*
