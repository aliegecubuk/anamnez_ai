-- Hospital module: labeled anamnesis snapshots with time-boxed retention.
-- Identity and raw transcript stay client-only; only the structured output
-- (Q&A entries, exam entries, Medula text, AI summary) is stored, scoped by
-- Clerk userId (via JWT 'sub' claim). RLS pattern follows the pivot migration.

-- ============================================================
-- hospital_records (flat, user-scoped)
-- ============================================================
CREATE TABLE public.hospital_records (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text        NOT NULL,                  -- Clerk userId (auth.jwt() ->> 'sub')
  label          text        NOT NULL CHECK (char_length(trim(label)) > 0 AND char_length(label) <= 80),
  mode           text        NOT NULL CHECK (mode IN ('hizli', 'detayli')),
  entries        jsonb       NOT NULL,                  -- Q&A: [{question, answer}]
  exam_entries   jsonb       NOT NULL DEFAULT '[]',
  medula_text    text        NOT NULL,
  ai_summary     text,                                  -- nullable; insight summary only (no differentials)
  retention_days int         CHECK (retention_days IN (30, 90, 120, 240, 365) OR retention_days IS NULL),
  expires_at     timestamptz,                           -- null = kept until manual delete
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.hospital_records
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX hospital_records_user_created_idx ON public.hospital_records (user_id, created_at DESC);
CREATE INDEX hospital_records_expires_idx      ON public.hospital_records (expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- hospital_settings (flat, user-scoped)
-- ============================================================
-- One row per user; retention_days is snapshotted into each record at save
-- time (null = no auto-delete, the user deletes manually).
CREATE TABLE public.hospital_settings (
  user_id        text        PRIMARY KEY,               -- Clerk userId
  retention_days int         CHECK (retention_days IN (30, 90, 120, 240, 365) OR retention_days IS NULL),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.hospital_settings
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');
