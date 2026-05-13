---
phase: 03-ses-boru-hatt
plan: 02
subsystem: stt-pipeline
tags: [api-routes, whisper, sse, session-lifecycle, kvkk]
dependency_graph:
  requires: [03-01]
  provides: [POST /api/sessions, PATCH /api/sessions/[id]/state, POST /api/sessions/[id]/chunks, GET /api/sessions/[id]/stream, GET /api/sessions/[id]/transcript]
  affects: [03-03-recorder-ui, 04-anamnesis-engine]
tech_stack:
  added: [openai@^6.37.0 (already installed)]
  patterns: [service-role + app-layer user_id filter, SSE ReadableStream, EventEmitter singleton, Postgres poll fallback]
key_files:
  created:
    - src/lib/openai/whisper.ts
    - src/lib/sessions/bus.ts
    - src/app/api/sessions/route.ts
    - src/app/api/sessions/[id]/state/route.ts
    - src/app/api/sessions/[id]/chunks/route.ts
    - src/app/api/sessions/[id]/stream/route.ts
    - src/app/api/sessions/[id]/transcript/route.ts
  modified:
    - .env.example
decisions:
  - "whisper-1 over gpt-4o-transcribe: stable broadly-available endpoint; swap is one line"
  - "SSE (not WebSocket) for server→client: one-way only, browser auto-reconnect, no upgrade handshake needed; audio upload stays as POST multipart"
  - "In-process EventEmitter + Postgres poll fallback (not Redis): Redis not yet provisioned; poll at 1.5s covers cross-instance at expected scale (~50 sessions/instance)"
  - "POST /api/sessions inserts with recorder_state='recording' directly: no separate start PATCH; idle→recording is a POST concern only"
  - "paused→paused is 200 noop (W-8): handles race between manual pause and W-8 auto-pause"
  - "dropped_chunks_increment bounded 0..1000 per call: telemetry field, v1 read-modify-write acceptable"
metrics:
  duration: "~25 min"
  completed_date: "2026-05-13"
  tasks_completed: 4
  files_created: 7
  files_modified: 1
---

# Phase 03 Plan 02: STT Server Routes + Whisper Integration Summary

One-liner: Five REST/SSE route handlers + OpenAI Whisper wrapper delivering Turkish live transcription with session lifecycle FSM, 24MB chunk guard, idempotent retry, and SSE fan-out via EventEmitter + Postgres poll fallback.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | openai SDK + Whisper wrapper | `04c2cb0` | `src/lib/openai/whisper.ts`, `.env.example` |
| 2 | Session lifecycle routes | `9901bf9` | `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/state/route.ts` |
| 3 | Chunk upload + Whisper transcription | `a00276a` | `src/app/api/sessions/[id]/chunks/route.ts`, `src/lib/sessions/bus.ts` |
| 4 | SSE stream + transcript fetch | `24826e7` | `src/app/api/sessions/[id]/stream/route.ts`, `src/app/api/sessions/[id]/transcript/route.ts` |

## Route Contracts

| Method | Path | Status codes | Notes |
|--------|------|--------------|-------|
| POST | /api/sessions | 201, 401, 404, 422, 500 | Creates session with `recorder_state='recording'`; validates patient ownership |
| PATCH | /api/sessions/[id]/state | 200, 401, 404, 409, 422, 500 | FSM transitions; W-8 paused→paused noop; W-2 dropped_chunks_increment |
| POST | /api/sessions/[id]/chunks | 201, 200, 401, 404, 409, 413, 422, 502, 500 | Whisper transcription; W-3 24MB two-layer guard; 23505 idempotent |
| GET | /api/sessions/[id]/stream | 200 SSE, 401, 404 | text/event-stream; backlog replay; 1.5s poll fallback; 15s heartbeat |
| GET | /api/sessions/[id]/transcript | 200, 401, 404, 500 | TranscriptSegmentDTO[] ordered by sequence ASC |

## Whisper Wrapper

`src/lib/openai/whisper.ts`:
- Lazy singleton `getOpenAIClient()` — not constructed at build/edge probe time
- `transcribeAudio(audio, format)` — normalizes Blob/ArrayBuffer/Uint8Array to `File` with extension; hardcoded `language: 'tr'`, `model: 'whisper-1'`
- `WhisperError` with codes: `missing_api_key | upstream_error | unsupported_format | empty_audio`
- Audio bytes never written to disk, never logged (KVKK least-data)

## W-2/W-3/W-6/W-8 Server-Side Surface

| Tag | Where | Implementation |
|-----|-------|----------------|
| W-2 | PATCH /[id]/state | `dropped_chunks_increment` body field; validated 0..1000; read-modify-write applied |
| W-3 | POST /[id]/chunks | Content-Length pre-flight (25MB) + post-parse Blob check (24MB); 413 + Turkish copy before any Whisper call |
| W-6 | GET /[id]/stream | 1.5s Postgres poll fallback; scaling note: ~50 concurrent sessions/instance ceiling before Redis migration |
| W-8 | PATCH /[id]/state | `paused → paused` returns 200 noop; TRANSITIONS table explicitly allows self-transition |

## KVKK / Security Notes

- Audio bytes: never stored in Postgres, never written to disk, never logged. Only transcript text persisted.
- `OPENAI_API_KEY`: no `NEXT_PUBLIC_` prefix; server-only module; never imported by client components (T-03-02-08 mitigated).
- Cross-border transfer (audio → OpenAI US, T-03-02-09): accepted for test mode per plan threat model; Phase 4 adds consent gate.
- All routes use `supabaseAdmin` + `.eq('user_id', userId)` — no row visible to another user (404, not 403, to avoid existence oracle — T-03-02-01 mitigated).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Uint8Array type incompatibility in whisper.ts**
- **Found during:** Task 1 tsc check
- **Issue:** `new Blob([uint8Array])` failed tsc — `Uint8Array<ArrayBufferLike>` not assignable to `BlobPart` due to `SharedArrayBuffer` incompatibility
- **Fix:** Cast `audio.buffer as ArrayBuffer` before passing to Blob constructor
- **Files modified:** `src/lib/openai/whisper.ts`
- **Commit:** `04c2cb0`

**2. [Architectural Note] openai already installed**
- `openai@^6.37.0` was already present in package.json (noted in context). No `npm install` needed. `package.json` unchanged.

**3. [Architectural Note] SSE vs WebSocket**
- CLAUDE.md mentions "WebSocket (audio upload)" in tech stack. This plan implements POST multipart for audio upload (simpler, no upgrade handshake, meets all STT requirements) and SSE for server→client only. Flagged for human review at Plan 03-04 checkpoint (W-1) as noted in plan.

## Known Stubs

None — all route handlers are fully wired to Supabase and OpenAI. No placeholder data.

## Threat Flags

None beyond what is already in the plan threat model.

## Self-Check: PASSED

Files exist:
- `src/lib/openai/whisper.ts` — FOUND
- `src/lib/sessions/bus.ts` — FOUND
- `src/app/api/sessions/route.ts` — FOUND
- `src/app/api/sessions/[id]/state/route.ts` — FOUND
- `src/app/api/sessions/[id]/chunks/route.ts` — FOUND
- `src/app/api/sessions/[id]/stream/route.ts` — FOUND
- `src/app/api/sessions/[id]/transcript/route.ts` — FOUND

Commits: `04c2cb0`, `9901bf9`, `a00276a`, `24826e7` — all in git log.
