---
phase: 03-ses-boru-hatt
plan: "03"
subsystem: browser-recorder
tags: [stt, mediarecorder, hooks, react, audio, live-transcript]
dependency_graph:
  requires:
    - 03-01  # session types + DB schema
    - 03-02  # server routes (POST /chunks, PATCH /state, GET /stream)
  provides:
    - browser MediaRecorder lifecycle (useChunkedRecorder)
    - live SSE transcript consumer (useTranscriptStream)
    - mic permission gate UI (MicPermissionGate)
    - recording controls + transcript display (RecordingPanel, LiveTranscript)
  affects:
    - 03-04  # session workspace wiring — imports RecordingPanel
tech_stack:
  added: []
  patterns:
    - MediaRecorder timeslice chunking (2s default)
    - EventSource SSE client with sequence-deduplication
    - React useRef-based concurrency cap (MAX_INFLIGHT=2)
    - visibilitychange + pagehide flush for hard-tab-close durability
key_files:
  created:
    - src/lib/sessions/codec.ts
    - src/hooks/useChunkedRecorder.ts
    - src/hooks/useTranscriptStream.ts
    - src/components/sessions/MicPermissionGate.tsx
    - src/components/sessions/LiveTranscript.tsx
    - src/components/sessions/RecordingPanel.tsx
  modified: []
decisions:
  - "DEFAULT_CHUNK_MS=2000 (down from 5s) — bounds residual partial-chunk loss to ≤2s on hard tab close (B-2)"
  - "MAX_INFLIGHT=2 concurrency cap — keeps upload rate ≤30 RPM per session at 2s chunks, well under Whisper tier-1 50 RPM ceiling (W-2)"
  - "Three-failure auto-pause with retryRequired flag — surfaces degraded network to user without data loss (W-8)"
  - "initialRecorderState prop on useChunkedRecorder — client mirrors server recorder_state on mount to avoid idle-flash on resumed/paused sessions (W-5)"
  - "MicPermissionGate is a standalone component — testable in isolation, reusable in Phase 6 flows"
  - "stateRef shadow for ondataavailable closure — avoids stale closure bug when PATCH needs current state for dropped_chunks increment"
metrics:
  duration_minutes: 4
  completed_date: "2026-05-13"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 0
---

# Phase 03 Plan 03: Browser Recorder Layer Summary

**One-liner:** MediaRecorder hook with 2s chunked upload + SSE live transcript + permission gate UI, with cross-browser codec detection (Chrome webm/opus ↔ Safari mp4/AAC).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Codec selection helper | `bdcd0e8` | `src/lib/sessions/codec.ts` |
| 2 | useChunkedRecorder + useTranscriptStream | `8ce464e` | `src/hooks/useChunkedRecorder.ts`, `src/hooks/useTranscriptStream.ts` |
| 3 | MicPermissionGate, LiveTranscript, RecordingPanel | `4a7679f` | `src/components/sessions/MicPermissionGate.tsx`, `src/components/sessions/LiveTranscript.tsx`, `src/components/sessions/RecordingPanel.tsx` |

## Hook API Reference

### `useChunkedRecorder(opts)`

```typescript
interface UseChunkedRecorderOptions {
  sessionId: string
  audioFormat: AudioFormat
  chunkMs?: number                     // default 2000ms
  initialRecorderState?: RecorderState // default 'idle'; W-5 server-state mirror
  onError?: (err: Error) => void
}

interface UseChunkedRecorderResult {
  state: RecorderState          // 'idle' | 'recording' | 'paused' | 'stopped' | 'completed'
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>     // awaits all in-flight uploads before completing
  pendingUploads: number
  recorderError: Error | null
  retryRequired: boolean        // W-8: set after 3 consecutive failures; cleared on resume()
  droppedChunks: number         // W-2: count of chunks dropped due to MAX_INFLIGHT overflow
}
```

### `useTranscriptStream(opts)`

```typescript
interface UseTranscriptStreamOptions {
  sessionId: string
  enabled?: boolean   // disconnect on false (e.g., session completed)
}

interface UseTranscriptStreamResult {
  segments: TranscriptSegmentDTO[]
  connected: boolean
  error: Error | null
}
```

## Recorder FSM

```
idle ──start()──→ recording ──pause()──→ paused ──resume()──→ recording
                      │                     │
                   stop()               stop()
                      └──────────┬──────────┘
                                 ↓
                              stopped ──(uploads settle)──→ completed
```

Additional auto-transition: `recording → paused` after MAX_CONSECUTIVE_FAILURES=3 upload failures (W-8, sets `retryRequired=true`).

## Codec Priority (CODEC_PRIORITY)

| Priority | Mime Type | Browser |
|----------|-----------|---------|
| 1 | `audio/webm;codecs=opus` | Chrome, Edge, Firefox |
| 2 | `audio/webm` | Chrome generic fallback |
| 3 | `audio/mp4;codecs=mp4a.40.2` | Safari ≥14.1 explicit AAC-LC |
| 4 | `audio/mp4` | Safari generic fallback |
| 5 | `audio/mpeg` | Rare |
| 6 | `audio/wav` | Last resort (large payloads) |

`pickSupportedMimeType()` throws a Turkish-language `Error` if none supported (e.g., old Safari <14.1 or non-standard browsers).

## Key Behaviors

- **B-2 (hard tab close):** `visibilitychange→hidden` AND `pagehide` both call `MediaRecorder.requestData()` to flush the in-progress chunk. Combined with 2s chunkMs, worst-case audio loss is ≤2s.
- **W-2 (concurrency cap):** `inflightRef.current.size >= MAX_INFLIGHT` → drop chunk + toast + `dropped_chunks++` + PATCH server with `dropped_chunks_increment`.
- **W-5 (mount state mirror):** `useState(initialRecorderState)` initializes from server value; `RecordingPanel` → `useChunkedRecorder` prop chain carries DB `recorder_state` through.
- **W-8 (auto-pause):** `consecutiveFailuresRef` increments on each failed upload, resets on success or manual resume. At 3 → `triggerAutoPause()` calls `recorder.pause()` + PATCH server + `setRetryRequired(true)` + toast.
- **Sequence dedup in SSE:** `useTranscriptStream` drops segments where `seg.sequence <= lastSequenceRef.current` — backlog replay on reconnect cannot create duplicates.
- **beforeunload guard:** `RecordingPanel` warns browser on tab close when `pendingUploads > 0` OR state in `{recording, paused}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stateRef shadow to fix stale closure in ondataavailable**
- **Found during:** Task 2
- **Issue:** The plan's `ondataavailable` callback called `setServerState(state, 1)` for dropped chunks, but `state` inside the closure would be stale (React useState value captured at function creation time).
- **Fix:** Added `stateRef` that mirrors `state` via `useEffect`, so `ondataavailable` reads `stateRef.current` instead of the stale closure value.
- **Files modified:** `src/hooks/useChunkedRecorder.ts`
- **Commit:** `8ce464e`

**2. [Rule 1 - Bug] Removed `state` from start() dependency array**
- **Found during:** Task 2
- **Issue:** Plan included `state` in `useCallback` deps of `start()` — would cause `start` to be recreated on every state change and potentially break ongoing recordings.
- **Fix:** Removed `state` from deps; `ondataavailable` uses `stateRef.current` instead.
- **Files modified:** `src/hooks/useChunkedRecorder.ts`
- **Commit:** `8ce464e`

**3. [Rule 2 - Missing] JSX quote escaping in RecordingPanel retry banner**
- **Found during:** Task 3
- **Issue:** Raw `"Devam Et"` quotes inside JSX string would trigger ESLint `no-unescaped-entities`.
- **Fix:** Changed to `&quot;Devam Et&quot;`.
- **Files modified:** `src/components/sessions/RecordingPanel.tsx`
- **Commit:** `4a7679f`

## Known Stubs

None. All components render functional UI. Data flows are wired:
- `RecordingPanel` → `useChunkedRecorder` (live state machine)
- `RecordingPanel` → `useTranscriptStream` → `LiveTranscript` (live SSE segments)
- All API calls are to real endpoints delivered in Plan 03-02.

Note: `RecordingPanel` is not wired to any page route yet — that is Plan 03-04's scope.

## Threat Flags

No new threat surface beyond what Plan 03-03's threat_model covers. All T-03-03-xx mitigations implemented:
- T-03-03-01: MicPermissionGate is hard gate (children render only on 'granted') ✓
- T-03-03-02: `stop()` calls `getTracks().forEach(t.stop())`; cleanup useEffect also stops on unmount ✓
- T-03-03-04: `beforeunload` + `visibilitychange` + `pagehide` triple protection ✓
- T-03-03-05: Transcript rendered via React JSX (auto-escaped), no `dangerouslySetInnerHTML` ✓
- T-03-03-07: `MAX_INFLIGHT=2` cap keeps theoretical max ≤30 RPM per session ✓

## Self-Check: PASSED

Files exist:
- `src/lib/sessions/codec.ts` ✓
- `src/hooks/useChunkedRecorder.ts` ✓
- `src/hooks/useTranscriptStream.ts` ✓
- `src/components/sessions/MicPermissionGate.tsx` ✓
- `src/components/sessions/LiveTranscript.tsx` ✓
- `src/components/sessions/RecordingPanel.tsx` ✓

Commits exist:
- `bdcd0e8` ✓
- `8ce464e` ✓
- `4a7679f` ✓

`npx tsc --noEmit` exit 0 ✓
