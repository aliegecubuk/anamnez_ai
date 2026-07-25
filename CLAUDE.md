# AnamnezAl — Project Guide

## Project

Hands-free anamnesis + charting web app for Turkish clinics — dental (persistent records)
and hospital poliklinik/acil (ephemeral) modules. Voice → STT → GPT-4o form fill + FDI tooth charts.
Cross-contamination prevention.

See `.planning/PROJECT.md` for full context.

## Test Mode (active 2026-05-07)

**Pivoted to flat single-user.** Multi-tenant orgs deferred until post-validation.

- Open registration: anyone signs up via `/sign-up`, creates patients immediately.
- Each user sees only their own patients (RLS via `user_id = auth.jwt() ->> 'sub'`).
- No Clerk Organizations. No subdomain routing. No tenants table.
- Forward-compat: `clinic_id` nullable column reserved on patients/sessions for future grouping.
- See `.planning/pivot/PIVOT-PLAN.md` for full pivot scope.

Routes: `/modules` (module picker), `/dashboard` (diş), `/hospital` (poliklinik/acil), `/patients`, `/patients/[id]`. APIs: `/api/patients/*`, `/api/sessions/*`, `/api/hospital/*`. Superadmin retained at `/superadmin` (user list + login audit + role assign).

## Modules (v1.1)

- **Diş** (`/dashboard`) — persistent patient records, 10-section structured anamnesis (Hacettepe), perio + pathology charts, medication cards, AI report, PDF export.
- **Hastane** (`/hospital`) — fully ephemeral: no DB rows, identity (name/TC/phone) stays on device and is masked (`***`) in the transcript. Two modes: `hizli` (Acil — critical items only) / `detayli` (Poliklinik — comprehensive). Output: Medula-ready text + PDF, then full wipe.
- **Terapist** — planned (disabled stub on `/modules`).
- Module-level KVKK consent via `KvkkGate` (localStorage, text version v1 — still draft, legal review pending).

**Workflow ekol:** ARAŞTIR → PLANLA → EXECUTE → REVIEW → NEXT. GSD slash-command'ları çağırma — token israfı.

## GSD Workflow (paused — re-enable post-pivot)

This project uses the Get Shit Done (GSD) workflow.

### Key commands

| Command | When to use |
|---------|-------------|
| `/gsd-discuss-phase N` | Before planning a phase — gather context |
| `/gsd-plan-phase N` | Create execution plan for a phase |
| `/gsd-execute-phase N` | Execute the plan |
| `/gsd-verify-work` | After execution — verify phase goal achieved |
| `/gsd-progress` | Check current status |

### Current state

See `.planning/STATE.md` for current phase and next action.

### Phase order

```
1 (Foundation) → 2 (Patients) → 3 (STT) → 4 (Anamnesis) → 5 (AI Descriptions)
                                                              ↓
                                                    6a (Perio Chart) ← parallel → 6b (Pathology Chart)
```

## Frontend execution standard

For any phase with frontend components (UI pages, components), after `gsd-execute-phase` completes:
1. Run `/impeccable` — code quality pass on changed files
2. Run `/frontend-design` — visual/UX audit against UI-SPEC

These two skills are **mandatory** for every frontend phase before `/gsd-verify-work`.

## Critical constraints

1. **Tooth number accuracy** — 18 ≠ 28. Zero tolerance. Disambiguation modal mandatory for any non-high-confidence tooth mention.
2. **KVKK compliance** — Patient health data is special category under Turkish law. RLS from day one. VERBİS registration before any prod data.
3. **Hands-free first** — Every core flow completable by voice alone. Keyboard/mouse = review and correction only.
4. **NULL ≠ 0 in perio chart** — Blank tooth means healthy. Zero means measured-as-zero. Schema must enforce this.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router |
| Database | Supabase PostgreSQL (Frankfurt eu-central-1) |
| Auth | Clerk (flat users; Organizations deferred) |
| STT | OpenAI gpt-4o-mini-transcribe (`language: "tr"`, dental domain prompt) |
| LLM | GPT-4o Structured Outputs |
| Hosting | Vercel Pro (fra1 region) |
| UI | shadcn/ui + Tailwind CSS v4 |
| PDF | pdfmake (`src/lib/pdf/`) |
| Audio transport | POST multipart per chunk, pause-aware segmentation, 3 parallel uploads |
| Realtime | SSE (server→client, replay/backup) + chunk POST response (instant render) |
| Session state | Postgres (`sessions.recorder_state`) |

## Before any production deployment

- [ ] VERBİS registration complete
- [ ] OpenAI DPA signed
- [ ] Supabase DPA signed (Pro plan)
- [ ] Vercel functions pinned to `fra1` in `vercel.json`
- [ ] KVKK + onam consent language reviewed by Turkish legal counsel
- [ ] Cross-border transfer disclosure (OpenAI US) in consent form
