-- Phase 3: Ses Boru Hattı (STT pipeline)
-- Adds: transcript_segments (append-only per-chunk transcripts)
-- Modifies: sessions.audio_format, sessions.recorder_state, sessions.dropped_chunks
-- All rows user-scoped via Clerk JWT 'sub' claim (pivot template — defense-in-depth)
-- App-layer isolation: routes use supabaseAdmin + .eq('user_id', userId) per pivot pattern.

-- ============================================================
-- sessions: forward-compatible columns for STT
-- ============================================================
ALTER TABLE public.sessions
  ADD COLUMN audio_format text
    CHECK (audio_format IS NULL OR audio_format IN (
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mpeg',
      'audio/wav'
    ));

ALTER TABLE public.sessions
  ADD COLUMN recorder_state text NOT NULL DEFAULT 'idle'
    CHECK (recorder_state IN ('idle', 'recording', 'paused', 'stopped', 'completed'));

-- W-2: client-side concurrency-cap overflow counter. Incremented by PATCH /state route
-- when the recorder hook drops a chunk because MAX_INFLIGHT was already saturated.
-- Pure observability — never used for auth or routing decisions.
ALTER TABLE public.sessions
  ADD COLUMN dropped_chunks integer NOT NULL DEFAULT 0
    CHECK (dropped_chunks >= 0);

-- ============================================================
-- transcript_segments: append-only per-chunk Whisper output
-- ============================================================
-- Each row = one Whisper API result for one ~2s audio chunk (default chunkMs reduced
-- from 5s to 2s in Plan 03-03 per B-2 to bound residual partial-chunk loss on tab close).
-- sequence: monotonic integer per session (0, 1, 2, ...) — client assigns, DB enforces uniqueness.
-- content:  Turkish text returned by Whisper (may be empty string for silence).
-- started_at / ended_at: client-reported wall-clock timestamps for the chunk window (used for replay UX).
-- created_at: server-side insertion time (used for "server received" audit + SSE ordering tie-break).
CREATE TABLE public.transcript_segments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  session_id  uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  sequence    integer     NOT NULL CHECK (sequence >= 0),
  content     text        NOT NULL,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.transcript_segments
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX transcript_segments_user_id_idx     ON public.transcript_segments (user_id);
CREATE INDEX transcript_segments_session_seq_idx ON public.transcript_segments (session_id, sequence);
CREATE INDEX transcript_segments_session_created_idx
  ON public.transcript_segments (session_id, created_at);

-- One sequence number per session — guards against duplicate chunk submissions on retry.
-- Plan 03-02 catches the resulting 23505 error and returns 200 idempotently.
CREATE UNIQUE INDEX transcript_segments_session_seq_unique
  ON public.transcript_segments (session_id, sequence);
