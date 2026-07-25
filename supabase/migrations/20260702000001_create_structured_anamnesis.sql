-- Section-based anamnesis (Özgeçmiş / Soygeçmiş), ilaç bilgileri, AI raporu
-- NOTE: remote apply is BATCHED — Supabase project is PAUSED. Do NOT run `supabase db push`. This SQL file is the schema source of truth.

-- ============================================================
-- anamnesis_entries: one row per classified line item
-- section_key = one of 6 fixed Hacettepe-form sections
-- ============================================================
CREATE TABLE public.anamnesis_entries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text        NOT NULL,
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  section_key     text        NOT NULL CHECK (section_key IN (
    'oz_cocukluk', 'oz_dis', 'oz_genel',
    'soy_sahsi', 'soy_ekstraoral', 'soy_intraoral'
  )),
  content         text        NOT NULL,
  confidence      real        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source          text        NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  edited_by_human boolean     NOT NULL DEFAULT false,
  display_order   integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnesis_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_isolation" ON public.anamnesis_entries
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX anamnesis_entries_user_id_idx    ON public.anamnesis_entries (user_id);
CREATE INDEX anamnesis_entries_session_id_idx ON public.anamnesis_entries (session_id);

-- ============================================================
-- anamnesis_medications: one row per drug the patient uses.
-- Enriched by GPT-4o: etken madde, özet, diş hekimliği önemi,
-- cerrahi/işlem engeli. name_key = lowercase-normalized name
-- for per-session dedupe.
-- ============================================================
CREATE TABLE public.anamnesis_medications (
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
CREATE POLICY "user_isolation" ON public.anamnesis_medications
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX anamnesis_medications_user_id_idx    ON public.anamnesis_medications (user_id);
CREATE INDEX anamnesis_medications_session_id_idx ON public.anamnesis_medications (session_id);

-- ============================================================
-- anamnesis_reports: one AI assessment per session (regenerated
-- on demand; jsonb arrays of Turkish sentences).
-- ============================================================
CREATE TABLE public.anamnesis_reports (
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
CREATE POLICY "user_isolation" ON public.anamnesis_reports
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX anamnesis_reports_user_id_idx    ON public.anamnesis_reports (user_id);
CREATE INDEX anamnesis_reports_session_id_idx ON public.anamnesis_reports (session_id);
