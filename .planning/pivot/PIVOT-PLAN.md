# Pivot — Multi-tenant → Flat Single-User (Test Mode)

**Date:** 2026-05-07
**Reason:** Test phase. Friends will sign up freely. KVKK satisfied via per-user data isolation. Multi-tenant deferred to post-validation.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Drop `tenants` table + `tenant_id` FKs | Single-user model, no orgs |
| 2 | Add `user_id text NOT NULL` (Clerk userId via `sub` claim) | Simple, forward-compat |
| 3 | Add nullable `clinic_id text` | Forward-compat hook for future grouping |
| 4 | RLS: `user_id = auth.jwt() ->> 'sub'` | Each user sees only their patients |
| 5 | Drop Clerk Organizations usage | Open registration, no invites |
| 6 | Routes: `/dashboard`, `/patients`, `/patients/[id]` | Drop `/orgs/[slug]/*` |
| 7 | API: `/api/patients`, `/api/patients/[id]` | Drop `/api/orgs/[slug]/*` |
| 8 | Middleware: drop subdomain rewrite + organizationSyncOptions | Flat routing |
| 9 | Add `/sign-up` page | Open registration |
| 10 | Email verify off | Test mode (Clerk dashboard config) |
| 11 | Superadmin keeps for debug; tenant + invite UI removed | Re-purposed for user/audit view |
| 12 | TC unique: `(user_id, tc_kimlik_no)` | Per-user TC uniqueness |
| 13 | Wipe DB (drop + recreate) | No production data; cleanest path |

## Waves

1. **DB wipe migration** — drop tenants/patients/sessions, recreate flat
2. **Middleware + root redirect + sign-in cleanup + new /sign-up**
3. **New route tree** — `/(app)/dashboard`, `/(app)/patients`, `/(app)/patients/[id]`, `/api/patients/*`
4. **Delete old tree** — `src/app/orgs/`, `src/app/api/orgs/`
5. **Superadmin slim-down**
6. **Docs + typecheck/build**

## Out of scope (post-test)
- Multi-tenant restoration (clinic_id activation)
- Subdomain routing
- KVKK/onam consent UI
- VERBİS registration
- Email verification

## Manual config (user must do in Clerk dashboard)
- Enable "Email + password" sign-up
- Disable "Email verification required at sign-up"
- Disable "Organizations" feature (optional; harmless if left on)
