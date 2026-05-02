-- Local dev seed data
-- Applied by: supabase db reset
-- DO NOT use real tenant names or real Clerk org IDs here

INSERT INTO public.tenants (clerk_org_id, slug, name)
VALUES
  ('org_test_tenant_a', 'test-tenant-a', 'Test Üniversitesi A'),
  ('org_test_tenant_b', 'test-tenant-b', 'Test Üniversitesi B')
ON CONFLICT (clerk_org_id) DO NOTHING;
