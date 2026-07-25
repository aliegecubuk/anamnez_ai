-- Structured anamnesis: create tables if missing + expand to 10 sections.
-- Migration 20260702000001 was repair-marked as applied without ever running on
-- the remote, so this file is written idempotent: safe whether the tables exist
-- (old 6-key CHECK) or not.

-- ============================================================
-- anamnesis_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anamnesis_entries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text        NOT NULL,
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  section_key     text        NOT NULL,
  content         text        NOT NULL,
  confidence      real        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source          text        NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  edited_by_human boolean     NOT NULL DEFAULT false,
  display_order   integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 10-section CHECK (replaces the 6-key version if it exists).
ALTER TABLE public.anamnesis_entries
  DROP CONSTRAINT IF EXISTS anamnesis_entries_section_key_check;
ALTER TABLE public.anamnesis_entries
  ADD CONSTRAINT anamnesis_entries_section_key_check CHECK (section_key IN (
    'gen_sikayet', 'gen_vital',
    'oz_cocukluk', 'oz_dis', 'oz_genel',
    'soy_sahsi', 'soy_ekstraoral', 'soy_intraoral',
    'mua_hijyen', 'mua_radyoloji'
  ));

ALTER TABLE public.anamnesis_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_isolation" ON public.anamnesis_entries;
CREATE POLICY "user_isolation" ON public.anamnesis_entries
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX IF NOT EXISTS anamnesis_entries_user_id_idx    ON public.anamnesis_entries (user_id);
CREATE INDEX IF NOT EXISTS anamnesis_entries_session_id_idx ON public.anamnesis_entries (session_id);

-- ============================================================
-- anamnesis_medications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anamnesis_medications (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               text        NOT NULL,
  session_id            uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  name_key              text        NOT NULL,
  active_ingredient     text,
  summary               text,
  dental_significance   text,
  surgical_precautions  text,
  blocks_treatment      text        CHECK (blocks_treatment IS NULL OR blocks_treatment IN (
    'engel_yok', 'dikkat', 'kontrendike_olabilir'
  )),
  risk_level            text        CHECK (risk_level IS NULL OR risk_level IN ('düşük', 'orta', 'yüksek')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anamnesis_medications_unique UNIQUE (session_id, name_key)
);

ALTER TABLE public.anamnesis_medications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_isolation" ON public.anamnesis_medications;
CREATE POLICY "user_isolation" ON public.anamnesis_medications
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX IF NOT EXISTS anamnesis_medications_user_id_idx    ON public.anamnesis_medications (user_id);
CREATE INDEX IF NOT EXISTS anamnesis_medications_session_id_idx ON public.anamnesis_medications (session_id);

-- ============================================================
-- anamnesis_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anamnesis_reports (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               text        NOT NULL,
  session_id            uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  summary               text        NOT NULL,
  dental_considerations jsonb       NOT NULL DEFAULT '[]'::jsonb,
  risk_flags            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  recommendations       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  model                 text        NOT NULL DEFAULT 'gpt-4o',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anamnesis_reports_session_unique UNIQUE (session_id)
);

ALTER TABLE public.anamnesis_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_isolation" ON public.anamnesis_reports;
CREATE POLICY "user_isolation" ON public.anamnesis_reports
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX IF NOT EXISTS anamnesis_reports_user_id_idx    ON public.anamnesis_reports (user_id);
CREATE INDEX IF NOT EXISTS anamnesis_reports_session_id_idx ON public.anamnesis_reports (session_id);

-- PostgREST şema cache'ini tazele (PGRST205'e karşı garanti).
NOTIFY pgrst, 'reload schema';
