-- Phase 2: Hasta Yönetimi
-- Tables: patients, sessions
-- All rows are tenant-isolated via RLS (Phase 1 template)

-- ============================================================
-- patients
-- ============================================================
CREATE TABLE public.patients (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name     text        NOT NULL CHECK (char_length(trim(full_name)) > 0),
  tc_kimlik_no  text        NOT NULL CHECK (tc_kimlik_no ~ '^[0-9]{11}$'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text        NOT NULL  -- Clerk user_id (e.g., "user_abc123")
);

-- Tenant isolation RLS (Phase 1 template)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.patients
  FOR ALL
  USING (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  );

-- Indexes
CREATE INDEX ON public.patients (tenant_id);
-- tc_kimlik_no prefix search (ILIKE 'prefix%' uses this via text_pattern_ops)
CREATE INDEX ON public.patients (tc_kimlik_no text_pattern_ops);
-- full_name case-insensitive search support
CREATE INDEX ON public.patients (lower(full_name));
-- Uniqueness: one TC per tenant (not globally — different tenants can share TC)
CREATE UNIQUE INDEX patients_tenant_tc_unique ON public.patients (tenant_id, tc_kimlik_no);

-- ============================================================
-- sessions
-- ============================================================
CREATE TABLE public.sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id   uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  form_type    text        NOT NULL DEFAULT 'genel'
                           CHECK (form_type IN ('genel', 'anamnez', 'perio', 'patoloji')),
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'completed')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,           -- NULL = session still in progress (draft)
  created_by   text        NOT NULL   -- Clerk user_id
);

-- Tenant isolation RLS (Phase 1 template)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.sessions
  FOR ALL
  USING (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  );

-- Indexes
CREATE INDEX ON public.sessions (tenant_id);
CREATE INDEX ON public.sessions (patient_id);
CREATE INDEX ON public.sessions (started_at DESC);  -- profile page sorts most-recent-first
