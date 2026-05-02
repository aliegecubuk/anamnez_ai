-- Phase 1: Temel Altyapı
-- Foundation table: tenants
-- All subsequent tables reference this via tenant_id FK
-- Managed by superadmin only — no user-facing RLS policies

CREATE TABLE public.tenants (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id text        UNIQUE NOT NULL,  -- Clerk org_id (e.g., "org_abc123")
  slug         text        UNIQUE NOT NULL,  -- subdomain slug (e.g., "istanbul-uni")
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but NO policies — only service_role key can read/write
-- (service_role bypasses RLS entirely)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Critical: this index is used in EVERY RLS subquery across all future tables
-- Every policy uses: WHERE clerk_org_id = auth.jwt() ->> 'org_id'
CREATE INDEX ON public.tenants (clerk_org_id);

-- ============================================================
-- RLS TEMPLATE for all future phases (copy into each migration)
-- ============================================================
-- ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "tenant_isolation" ON public.{table_name}
--   FOR ALL
--   USING (
--     tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
--   )
--   WITH CHECK (
--     tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
--   );
--
-- CREATE INDEX ON public.{table_name} (tenant_id);
-- ============================================================
