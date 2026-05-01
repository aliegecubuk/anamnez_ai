# AnamnezAl — Project Guide

## Project

Hands-free dental anamnesis + charting web app for Turkish dental universities.
Voice → Whisper STT → GPT-4o form fill + FDI tooth charts. Cross-contamination prevention.

See `.planning/PROJECT.md` for full context.

## GSD Workflow

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
| Auth | Clerk Organizations |
| STT | OpenAI Whisper API (`language: "tr"`) |
| LLM | GPT-4o Structured Outputs |
| Hosting | Vercel Pro (fra1 region) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Realtime | SSE (server→client) + WebSocket (audio upload) |
| Session state | Redis hot + Postgres cold |

## Before any production deployment

- [ ] VERBİS registration complete
- [ ] OpenAI DPA signed
- [ ] Supabase DPA signed (Pro plan)
- [ ] Vercel functions pinned to `fra1` in `vercel.json`
- [ ] KVKK + onam consent language reviewed by Turkish legal counsel
- [ ] Cross-border transfer disclosure (OpenAI US) in consent form
