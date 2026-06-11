---
phase: 03-ses-boru-hatt
created: 2026-05-13
status: complete
---

# Phase 3 Handoff — Ses Boru Hattı (STT Pipeline)

## Status: COMPLETE ✅

User-approved 2026-05-13. E2E test passed: record → transcript → pause → resume → stop → redirect → history.

---

## What was built

| Commit | What |
|--------|------|
| `354404e` | DB migration: transcript_segments + sessions STT columns |
| `201b3b9` | Session/transcript TypeScript types |
| `04c2cb0` | Plan 03-01 docs |
| `9901bf9` | POST /api/sessions + PATCH /[id]/state routes |
| `a00276a` | POST /[id]/chunks (Whisper transcription + segment insert) |
| `24826e7` | GET /[id]/stream (SSE) + GET /[id]/transcript |
| `bdcd0e8` | Codec selection helper (Chrome webm/opus → Safari mp4/AAC) |
| `8ce464e` | useChunkedRecorder + useTranscriptStream hooks |
| `4a7679f` | MicPermissionGate + LiveTranscript + RecordingPanel components |
| `8d14233` | StartSessionButton component |
| `dc695ab` | Session detail page + SessionWorkspace |
| `69fa220` | Patient profile + SessionHistoryTable wired |
| `9e47b6c` | BUG FIX: recorder_state 'recording'→'idle' on mount |
| Session 2 | Queue overflow → sequential queue, stop/restart MediaRecorder, VAD, resume fix |

---

## Architecture decisions (locked)

| Decision | Choice | Reason |
|----------|--------|--------|
| Audio transport | POST multipart (not WebSocket) | Simpler, Vercel-native |
| STT model | gpt-4o-transcribe, language: tr | Better Turkish than whisper-1 |
| Server→client | SSE EventSource | Browser-native auto-reconnect |
| Chunking | 5s stop/restart MediaRecorder | Each stop() = complete valid WebM |
| Silence filter | VAD (Web Audio API RMS ≥ 0.05) | Prevents hallucination on ambient noise |
| Upload queue | Sequential, MAX_QUEUE_SIZE=6 | No audio loss, backpressure auto-pause |
| Upload timeout | 30s per attempt, 2 retries | Handles slow Whisper under load |
| Audio retention | None | Audio bytes never persisted |
| Session bus | In-process EventEmitter + 1.5s Postgres poll | Redis deferred; ~50 concurrent ceiling |

---

## Known STT limitations (deferred to Phase 4)

| Issue | Root cause | Phase 4 fix |
|-------|-----------|------------|
| Word cut at 5s boundary | Hard chunk split mid-word | Overlap-stitch last 0.5s as context |
| Proper noun drift | Whisper limitation | GPT-4o structured output correction |
| Turkish number sequences | Whisper tokenizer | GPT-4o post-processing |

---

## Phase 4: Anamnez Motoru

**Goal:** Admin form template UI + GPT-4o transcript→form mapping, missing-info alerts, KVKK/consent gates.

**Requirements:** TPLT-01..05, ANAM-01..06 (11 total)

**Start:** `/gsd-plan-phase 4`

### Phase 4 success criteria
1. Admin creates department form template (yes/no, text, multi-select, numeric)
2. Admin can add/edit/reorder/delete questions without breaking saved sessions
3. Dentist selects template before session; correct question set loads
4. After recording, GPT-4o maps transcript → form fields with confidence indicator
5. Dentist can manually edit any AI-filled field
6. Session end: AI lists unanswered questions as alerts
7. Cannot save without KVKK + informed consent checkboxes

### Key design questions for Phase 4 planning
- Template storage: separate `form_templates` + `template_questions` tables
- GPT-4o call: one shot (full transcript → all fields) vs streaming
- Structured output schema: one Zod schema per template or dynamic
- Confidence indicator: GPT-4o logprobs or confidence field in response
- KVKK consent: checkbox gate before any AI processing or before save only?
