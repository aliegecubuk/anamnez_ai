---
phase: 03-ses-boru-hatt
created: 2026-05-13
status: checkpoint-pending
---

# Phase 3 Handoff — Ses Boru Hattı (STT Pipeline)

## Where we are

All 4 plans executed. Code is complete. Phase 3 is blocked on:
1. **OpenAI billing** (required to actually transcribe audio)
2. **E2E user approval** at the `checkpoint:human-verify` gate in Plan 03-04 Task 4

---

## STEP 1 — Fix OpenAI billing (5 min)

Account currently has $0 spend limit → Whisper API returns 401/429 → chunk uploads fail.

1. Go to `platform.openai.com/settings/billing`
2. Add payment method
3. Set monthly spending limit ≥ $5
4. Whisper-1 costs $0.006/minute — a full session of ~10 min = $0.06

---

## STEP 2 — Run E2E test

```bash
npm run dev
```

### Chrome test (required)
1. Open a patient profile (`/patients/[id]`)
2. Click **"Yeni Seans Başlat"** → browser should ask for mic permission
3. Grant mic → click **"Kaydı Başlat"**
4. Speak Turkish for ~12 seconds: e.g. _"Hasta diş ağrısı şikayetiyle geldi. Sol alt birinci moları çürük."_
5. Verify 5-6 transcript segments appear in LiveTranscript below the buttons
6. Click **"Duraklat"** → speak 5s → confirm no new segments appear
7. Click **"Devam Et"** → speak 5s → new segments should arrive
8. Click **"Durdur"** → spinner briefly → redirected back to `/patients/[id]`
9. New session appears in history table with status "Tamamlandı" → click "Görüntüle" → transcript replay shows

### Safari test (required for STT-06)
Repeat steps 1-9 in Safari. Check browser DevTools Network tab — the POST `.../chunks` body should contain `audio/mp4` (not webm) as the Content-Type.

### Cross-user isolation (required)
Sign in with a second account → try to navigate to the first account's session URL → should get 404.

---

## STEP 3 — Approve checkpoint

Once E2E tests pass, type in the Claude session:

```
approved (sse-ok, no-reload-resume-ok)
```

This acknowledges two architectural deltas vs. CLAUDE.md:
1. **SSE + POST multipart** instead of WebSocket (simpler, Vercel-native, auto-reconnect)
2. **No mid-recording resume across page reload** (MediaRecorder destroyed by browser on reload; transcript segments are durable, recorder restarts from scratch)

---

## STEP 4 — Verify + advance to Phase 4

After checkpoint approval, run in Claude:

```
/gsd-verify-work 3
```

Then proceed to Phase 4: Anamnez Motoru (GPT-4o form fill from transcript).

---

## What was built (commits)

| Commit | What |
|--------|------|
| `354404e` | DB migration: transcript_segments + sessions STT columns |
| `201b3b9` | Session/transcript TypeScript types |
| `c8ac22f` | Plan 03-01 docs |
| `04c2cb0` | Whisper wrapper (`src/lib/openai/whisper.ts`) |
| `9901bf9` | POST /api/sessions + PATCH /[id]/state routes |
| `a00276a` | POST /[id]/chunks (Whisper transcription + segment insert) |
| `24826e7` | GET /[id]/stream (SSE) + GET /[id]/transcript |
| `b9a7b91` | Plan 03-02 docs |
| `bdcd0e8` | Codec selection helper (Chrome webm/opus → Safari mp4/AAC) |
| `8ce464e` | useChunkedRecorder + useTranscriptStream hooks |
| `4a7679f` | MicPermissionGate + LiveTranscript + RecordingPanel components |
| `8fbc3c3` | Plan 03-03 docs |
| `8d14233` | StartSessionButton component |
| `dc695ab` | Session detail page + SessionWorkspace |
| `69fa220` | Patient profile + SessionHistoryTable wired |
| `9e47b6c` | **BUG FIX**: recorder_state 'recording'→'idle' on mount |

---

## Bugs fixed this session

### recorder_state 'recording' → buttons non-functional (9e47b6c)

**Root cause:** `POST /api/sessions` inserts `recorder_state: 'recording'`. Session page loaded,
passed `initialRecorderState='recording'` to `useChunkedRecorder`. Hook initialized state as
`'recording'` but no `MediaRecorder` existed → Duraklat + Durdur buttons both silently no-opped
(`recorderRef.current === null` → early return in pause()/stop()).

**Fix:** `SessionWorkspace.tsx` now maps `recorderState === 'recording'` → `'idle'` before passing
to `RecordingPanel`. MediaRecorder never survives a page load, so any server-side 'recording' = "start fresh". The PATCH to 'recording' is NOT needed in `start()` because POST already set the DB to 'recording' — hook design preserved.

---

## Architecture decisions (locked)

| Decision | Choice | Reason |
|----------|--------|--------|
| Audio transport | POST multipart (not WebSocket) | Simpler, Vercel-native, no WS upgrade needed |
| Server→client | SSE EventSource | Browser-native auto-reconnect, no library |
| STT model | whisper-1 | Stable endpoint; gpt-4o-transcribe is 1-line swap |
| Language | hardcoded `tr` | STT-02 requirement, no per-request override |
| Audio retention | none | Audio bytes never persisted to disk |
| Session bus | In-process EventEmitter + 1.5s Postgres poll fallback | Redis deferred; ~50 concurrent session ceiling |
| Chunk interval | 2s (down from 5s) | Bound residual partial-chunk loss on tab close (B-2) |
| In-flight cap | MAX_INFLIGHT=2 | Prevent unbounded upload queue (W-2) |
| Consecutive failure limit | 3 → auto-pause | User feedback + server protection (W-8) |
| Mid-recording resume | NOT supported across page reload | Browser security model; transcript segments durable |
