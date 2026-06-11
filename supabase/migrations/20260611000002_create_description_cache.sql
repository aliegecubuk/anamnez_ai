-- Phase 5: Dental AI Açıklamaları — description cache table
-- Caches GPT-4o generated dental descriptions per user+term+category.
-- NOTE: remote apply is BATCHED at milestone end together with Phase 4 migration 20260611000001 — Supabase project is PAUSED. Do NOT run `supabase db push` in this plan. This SQL file is the schema source of truth.

-- ============================================================
-- dental_descriptions: per-user cache keyed by normalized term
-- ============================================================
CREATE TABLE public.dental_descriptions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text        NOT NULL,
  term_key         text        NOT NULL,  -- normalizeTerm() output: lowercase tr-TR, trimmed, collapsed
  category         text        NOT NULL CHECK (category IN ('medication', 'disease', 'allergy')),
  display_term     text        NOT NULL,  -- original captured term for display
  dental_impact    text        NOT NULL,  -- line 1: dental/surgical/anesthetic impact
  risk_level       text        NOT NULL,  -- line 2: risk düzeyi
  precaution       text        NOT NULL,  -- line 3: önerilen önlem
  active_ingredient text,                -- nullable — set when DESC-04 active-ingredient fallback used
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dental_descriptions_user_term_unique UNIQUE (user_id, term_key, category)
);

ALTER TABLE public.dental_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.dental_descriptions
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX dental_descriptions_user_id_idx  ON public.dental_descriptions (user_id);
CREATE INDEX dental_descriptions_lookup_idx   ON public.dental_descriptions (user_id, term_key, category);
