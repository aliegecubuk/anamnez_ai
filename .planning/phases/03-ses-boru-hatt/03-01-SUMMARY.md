---
phase: 03-ses-boru-hatt
plan: "01"
subsystem: database-schema
tags: [migration, supabase, typescript, stt, transcript, sessions]
dependency_graph:
  requires: []
  provides: [transcript_segments-table, sessions-stt-columns, session-types]
  affects: [03-02, 03-03, 03-04]
tech_stack:
  added: []
  patterns: [append-only-segments, RLS-defense-in-depth, service-role-app-layer-isolation]
key_files:
  created:
    - supabase/migrations/20260508000001_create_transcript_segments.sql
    - src/lib/sessions/types.ts
  modified:
    - src/lib/supabase/server.ts
decisions:
  - "audio_format is per-session (not per-chunk): MediaRecorder cannot mid-stream switch mimetypes"
  - "No audio_chunks table: audio bytes ephemeral per KVKK least-data principle"
  - "No Redis in Plan 03-01: Postgres sufficient for single-user test mode; ~50 concurrent sessions ceiling documented in 03-02"
  - "dropped_chunks is observability-only: never used for auth or routing decisions"
metrics:
  duration: "~10 min"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 01: DB Migration + Session Types Summary

`transcript_segments` tablosu ve `sessions` STT kolonları — Plans 02-04'ün inşa ettiği kalıcı katman.

## What Was Built

### Migration: `20260508000001_create_transcript_segments.sql`

Applied to remote Supabase (Frankfurt eu-central-1).

**`public.transcript_segments` table:**
- `id` uuid PK, `user_id` text NOT NULL, `session_id` uuid FK → sessions(id) ON DELETE CASCADE
- `sequence` integer CHECK >= 0, `content` text, `started_at` / `ended_at` timestamptz
- `created_at` timestamptz DEFAULT now()
- RLS `user_isolation` policy (USING + WITH CHECK: `user_id = auth.jwt() ->> 'sub'`)
- 3 indexes: user_id, (session_id, sequence), (session_id, created_at)
- UNIQUE INDEX (session_id, sequence) — idempotent chunk retry safety (23505 → Plan 03-02 returns 200)

**`public.sessions` new columns:**
- `audio_format text` — CHECK whitelist (6 values + NULL allowed); codec fixed at recording start
- `recorder_state text NOT NULL DEFAULT 'idle'` — CHECK FSM: idle/recording/paused/stopped/completed
- `dropped_chunks integer NOT NULL DEFAULT 0 CHECK (>= 0)` — W-2 observability counter

### Types: `src/lib/sessions/types.ts`

Exports: `RecorderState`, `AudioFormat`, `FormType`, `SessionStatus`, `SessionRow`, `TranscriptSegmentRow`, `TranscriptSegmentDTO`, `CreateSessionBody`, `UpdateRecorderStateBody`, `ChunkUploadFields`

Key invariants:
- `SessionRow.audio_format: AudioFormat | null` (nullable — not set until recorder starts)
- `SessionRow.recorder_state: RecorderState` (non-null, DB default 'idle')
- `SessionRow.dropped_chunks: number` (non-null, DB default 0)
- `UpdateRecorderStateBody.dropped_chunks_increment?: number` (optional W-2 telemetry)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TS2345 in src/lib/supabase/server.ts**
- **Found during:** Task 2 (`npx tsc --noEmit`)
- **Issue:** `supabaseUrl` and `supabaseAnonKey` typed as `string | undefined` even after runtime guard — TypeScript couldn't narrow through the `throw` branch
- **Fix:** Added `const _supabaseUrl = supabaseUrl as string` / `_supabaseAnonKey` after the guard; used in `createClient()` call
- **Files modified:** `src/lib/supabase/server.ts`
- **Commit:** `201b3b9`

## Threat Coverage

All T-03-01 threats from plan addressed:
- T-03-01-01 (PII disclosure): RLS + app-layer `.eq('user_id', userId)` documented in types
- T-03-01-02 (duplicate sequence): UNIQUE INDEX enforces at DB level
- T-03-01-03/04 (invalid format/state): CHECK constraints on both columns
- T-03-01-05 (cross-user UUID guess): UUIDv4 + app-layer filter
- T-03-01-06 (audio bytes): no storage — ephemeral only
- T-03-01-07 (dropped_chunks inflation): accept — observability-only

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths introduced in this plan.

## Self-Check: PASSED

- `supabase/migrations/20260508000001_create_transcript_segments.sql` — exists, applied
- `src/lib/sessions/types.ts` — exists, all 10 exports present
- Commits: `354404e` (migration), `201b3b9` (types + server.ts fix)
- `npx tsc --noEmit` — clean (0 errors)
- `npx supabase db push` — "Finished supabase db push"
