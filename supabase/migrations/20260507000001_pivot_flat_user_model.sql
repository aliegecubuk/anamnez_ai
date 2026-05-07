-- Pivot: multi-tenant → flat single-user model (test mode)
-- Wipes existing patients/sessions/tenants and recreates without tenant_id.
-- Each row scoped by Clerk userId (via JWT 'sub' claim).
-- Forward-compat: nullable clinic_id reserved for future grouping.

-- ============================================================
-- Drop old tables (CASCADE removes FKs, policies, indexes)
-- ============================================================
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.tenants  CASCADE;

-- ============================================================
-- patients (flat, user-scoped)
-- ============================================================
CREATE TABLE public.patients (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text        NOT NULL,                  -- Clerk userId (auth.jwt() ->> 'sub')
  clinic_id     text,                                  -- nullable; reserved for future multi-tenant grouping
  full_name     text        NOT NULL CHECK (char_length(trim(full_name)) > 0),
  tc_kimlik_no  text        NOT NULL CHECK (tc_kimlik_no ~ '^[0-9]{11}$'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.patients
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX patients_user_id_idx          ON public.patients (user_id);
CREATE INDEX patients_tc_prefix_idx        ON public.patients (tc_kimlik_no text_pattern_ops);
CREATE INDEX patients_full_name_lower_idx  ON public.patients (lower(full_name));
CREATE UNIQUE INDEX patients_user_tc_unique ON public.patients (user_id, tc_kimlik_no);

-- ============================================================
-- sessions (flat, user-scoped)
-- ============================================================
CREATE TABLE public.sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text        NOT NULL,                   -- Clerk userId
  patient_id   uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  form_type    text        NOT NULL DEFAULT 'genel'
                            CHECK (form_type IN ('genel', 'anamnez', 'perio', 'patoloji')),
  status       text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'completed')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.sessions
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX sessions_user_id_idx     ON public.sessions (user_id);
CREATE INDEX sessions_patient_id_idx  ON public.sessions (patient_id);
CREATE INDEX sessions_started_at_idx  ON public.sessions (started_at DESC);

-- ============================================================
-- RLS TEMPLATE for future flat tables (copy into each new migration)
-- ============================================================
-- ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "user_isolation" ON public.{table}
--   FOR ALL
--   USING      (user_id = auth.jwt() ->> 'sub')
--   WITH CHECK (user_id = auth.jwt() ->> 'sub');
-- CREATE INDEX ON public.{table} (user_id);
-- ============================================================
