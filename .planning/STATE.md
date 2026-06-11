---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: complete
last_updated: "2026-06-11T04:04:00.000Z"
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# AnamnezAl — Project State

## ✅ MILESTONE v1.0 COMPLETE

All 7 phases implemented. Pending: Supabase migration batch apply + production deployment checklist.

### Pre-production checklist

- [ ] Apply batched migrations to Supabase (project currently paused): `20260611000001`, `20260611000002`, `20260611000003`
- [ ] VERBİS registration complete
- [ ] OpenAI DPA signed
- [ ] Supabase DPA signed (Pro plan)
- [ ] Vercel functions pinned to `fra1` in `vercel.json`
- [ ] KVKK + onam consent language reviewed by Turkish legal counsel
- [ ] Cross-border transfer disclosure (OpenAI US) in consent form

## Phase Status

| # | Phase | Status | Key commit |
|---|-------|--------|------------|
| 1 | Temel Altyapı | ✅ Complete | pre-pivot |
| 2 | Hasta Yönetimi | ✅ Complete | `9e56ae8` |
| 3 | Ses Boru Hattı | ✅ Complete | `2ac2251` |
| 4 | Anamnez Motoru | ✅ Complete | `1f1d0ef` |
| 5 | Dental AI Açıklamaları | ✅ Complete | `0a6e27d` |
| 6a | Periodontoloji Chartı | ✅ Complete | `1224445` |
| 6b | Patoloji Chartı | ✅ Complete | `1224445` |

## Architecture decisions (locked)

| Layer | Choice |
|-------|--------|
| Audio transport | POST multipart per chunk |
| STT model | gpt-4o-transcribe, language: tr |
| Server→client | SSE EventSource |
| Chunking | 5s stop/restart MediaRecorder |
| Silence filter | <10KB blob skipped |
| LLM | GPT-4o Structured Outputs |
| Form mapping | Strict json_schema response_format |
| Description cache | dental_descriptions (user-scoped, UNIQUE term_key+category) |
| Perio chart | perio_charts + perio_measurements (immutable after status=saved) |
| Pathology chart | tooth_conditions (upsert on conflict) |
| Disambiguation | <70% confidence → DisambiguationModal queue |

## Test Mode (active since 2026-05-07)

Flat single-user, no orgs. RLS via `user_id = auth.jwt() ->> 'sub'`.
Routes: `/dashboard`, `/patients`, `/patients/[id]`. APIs: `/api/patients/*`, `/api/sessions/*`, `/api/descriptions`.
