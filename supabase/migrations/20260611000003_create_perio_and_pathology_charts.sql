-- Phase 6a + 6b: Periodontoloji Chartı + Patoloji Chartı
-- NOTE: remote apply is BATCHED at milestone end together with Phase 4/5 migrations — Supabase project is PAUSED. Do NOT run `supabase db push`. This SQL file is the schema source of truth.

-- ============================================================
-- perio_charts: one chart per session (Phase 6a)
-- ============================================================
CREATE TABLE public.perio_charts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  session_id  uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved')),
  saved_at    timestamptz,
  addendum    text,        -- nullable; only writable after save (immutable chart body)
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perio_charts_session_unique UNIQUE (session_id)
);

ALTER TABLE public.perio_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_isolation" ON public.perio_charts
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX perio_charts_user_id_idx    ON public.perio_charts (user_id);
CREATE INDEX perio_charts_session_id_idx ON public.perio_charts (session_id);

-- ============================================================
-- perio_measurements: one row per (chart, tooth, point)
-- point = one of 6 probing locations per tooth (MB/B/DB/ML/L/DL)
-- NULL values = not measured (never 0 by default — PERIO-04)
-- ============================================================
CREATE TABLE public.perio_measurements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text        NOT NULL,
  chart_id        uuid        NOT NULL REFERENCES public.perio_charts(id) ON DELETE CASCADE,
  tooth_number    integer     NOT NULL CHECK (tooth_number >= 11 AND tooth_number <= 48),
  point           text        NOT NULL CHECK (point IN ('MB', 'B', 'DB', 'ML', 'L', 'DL')),
  pocket_depth    integer     CHECK (pocket_depth IS NULL OR (pocket_depth >= 0 AND pocket_depth <= 20)),
  attachment_loss integer     CHECK (attachment_loss IS NULL OR (attachment_loss >= 0 AND attachment_loss <= 20)),
  bleeding        boolean,    -- NULL = not recorded
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perio_measurements_unique UNIQUE (chart_id, tooth_number, point)
);

ALTER TABLE public.perio_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_isolation" ON public.perio_measurements
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX perio_measurements_user_id_idx  ON public.perio_measurements (user_id);
CREATE INDEX perio_measurements_chart_id_idx ON public.perio_measurements (chart_id);

-- ============================================================
-- tooth_conditions: one row per (session, tooth, condition) (Phase 6b)
-- Multiple conditions per tooth via separate rows
-- ============================================================
CREATE TABLE public.tooth_conditions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text        NOT NULL,
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  tooth_number    integer     NOT NULL CHECK (tooth_number >= 11 AND tooth_number <= 48),
  condition_type  text        NOT NULL CHECK (condition_type IN (
    'çürük', 'diş_eti_çekilmesi', 'dolgu', 'kanal', 'köprü', 'eksik_diş', 'diğer'
  )),
  notes           text,       -- optional free text for 'diğer' or clarifications
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tooth_conditions_unique UNIQUE (session_id, tooth_number, condition_type)
);

ALTER TABLE public.tooth_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_isolation" ON public.tooth_conditions
  FOR ALL USING (user_id = auth.jwt() ->> 'sub') WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE INDEX tooth_conditions_user_id_idx    ON public.tooth_conditions (user_id);
CREATE INDEX tooth_conditions_session_id_idx ON public.tooth_conditions (session_id);
