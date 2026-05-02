-- Phase 1: Temel Altyapı
-- Login audit log (D-07 — mandatory, cannot be retrofitted post-launch)
-- Populated via Clerk webhook (session.created event) using service_role key
-- No user-facing read or write policies — superadmin reads via service_role only

CREATE TABLE public.login_audit_log (
  id           bigserial   PRIMARY KEY,
  user_id      text        NOT NULL,   -- Clerk user_id (e.g., "user_abc123")
  session_id   text        NOT NULL,   -- Clerk session_id
  clerk_org_id text,                   -- Clerk org_id; NULL if personal account login
  ip_address   text,                   -- x-forwarded-for from Vercel
  user_agent   text,
  logged_in_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but NO user-facing policies
-- Only service_role (via supabaseAdmin client) can INSERT/SELECT
ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

-- Performance indexes for superadmin audit log queries
CREATE INDEX ON public.login_audit_log (clerk_org_id);
CREATE INDEX ON public.login_audit_log (logged_in_at DESC);
