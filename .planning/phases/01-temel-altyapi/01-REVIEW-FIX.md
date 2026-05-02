---
phase: 01-temel-altyapi
fixed_at: 2026-05-02T00:00:00Z
review_path: .planning/phases/01-temel-altyapi/01-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-02T00:00:00Z
**Source review:** `.planning/phases/01-temel-altyapi/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (5 Critical + 5 Warning; Info excluded by fix_scope)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: Middleware bypasses auth entirely for all tenant subdomain requests

**Files modified:** `src/middleware.ts`
**Commit:** `5113987`
**Applied fix:** Added `if (!isPublicRoute(req)) { await auth.protect() }` before the `NextResponse.rewrite()` return in the tenant subdomain branch. Auth is now enforced at middleware level before the URL rewrite, ensuring all tenant routes require authentication regardless of whether the layout server-side check is reached.

---

### CR-02: Dashboard query fetches an arbitrary tenant — cross-tenant data leak potential

**Files modified:** `src/app/orgs/[slug]/dashboard/page.tsx`
**Commit:** `5602304`
**Applied fix:** Added `params: Promise<{ slug: string }>` to `DashboardPage` props, destructured `slug` with `await params`, and added `.eq('slug', slug)` filter to the Supabase query. The page now always filters to the tenant matching the URL slug.

---

### CR-03: Clerk JWT not wired to Supabase — all RLS policies are silently broken

**Files modified:** `supabase/config.toml`, `.env.example`
**Commit:** `39ee2dd`
**Applied fix:** Set `enabled = true` and `domain = "env(CLERK_ISSUER_DOMAIN)"` in `[auth.third_party.clerk]` block of `supabase/config.toml`. Added `CLERK_ISSUER_DOMAIN` with documentation comment to `.env.example`. Note: the production Supabase dashboard also requires Clerk configured under Authentication → Third-party Auth.

---

### CR-04: Post-login redirect targets non-existent route `/dashboard`

**Files modified:** `src/app/(auth)/sign-in/page.tsx`
**Commit:** `c5e33fe`
**Applied fix:** Changed `router.push('/dashboard')` to `router.push('/')`. The root `page.tsx` already handles role-based dispatch to `/orgs/[slug]/dashboard` (tenant users) or `/superadmin` (superadmin). This avoids a 404 and delegates routing to the existing server-side logic.

---

### CR-05: `getToken()` returns `null` when unauthenticated — forwarded as literal string "Bearer null"

**Files modified:** `src/lib/supabase/server.ts`
**Commit:** `a451379`
**Applied fix:** Added a null guard immediately after `await getToken()` that throws `new Error('No Clerk session token — user is not authenticated')`. This surfaces auth failures as explicit errors rather than silent RLS failures caused by the literal string `"Bearer null"`.

---

### WR-01: Layout does not verify that Clerk org matches URL slug — cross-tenant navigation possible

**Files modified:** `src/app/orgs/[slug]/layout.tsx`
**Commit:** `d0f5f2b`
**Applied fix:** Destructured `slug` from `await params` (previously discarded). Added a `supabaseAdmin` query to fetch `clerk_org_id` for the slug, then compared it to the authenticated user's `orgId`. If the tenant is not found or the org IDs do not match, redirects to `/sign-in?error=wrong_org`.

---

### WR-02: `x-forwarded-for` in audit log can be spoofed by the client

**Files modified:** `src/app/api/webhooks/clerk/route.ts`
**Commit:** `ef2c3b8`
**Applied fix:** Replaced `headerPayload.get('x-forwarded-for')` with `(data.request_data as Record<string, unknown>)?.remote_addr as string ?? null`, extracting the client IP from the Clerk event payload's `request_data.remote_addr` field instead of the webhook delivery request header.

---

### WR-03: `supabaseAdmin` and `createSupabaseServerClient` use non-null assertions with no startup validation

**Files modified:** `src/lib/supabase/admin.ts`, `src/lib/supabase/server.ts`
**Commit:** `efb36c4`
**Applied fix:** In `admin.ts`: extracted env vars into named constants, added an explicit `if (!url || !key)` guard that throws at module load time with a clear error message. In `server.ts`: same pattern — module-level constants with a guard block, passing named variables to `createClient` instead of inline `process.env.X!` assertions.

---

### WR-04: `vercel.json` functions path pattern is incorrect for Next.js App Router

**Files modified:** `vercel.json`
**Commit:** `9671543`
**Applied fix:** Changed functions key from `"app/api/**"` to `"src/app/api/**"` to match the actual file path under the `src/` layout. This ensures `maxDuration: 30` is applied to API routes (needed to prevent webhook timeout on the 10s platform default).

---

### WR-05: Password-reset page is not in `isPublicRoute` — unauthenticated users cannot access it

**Files modified:** `src/middleware.ts`
**Commit:** `5113987`
**Applied fix:** Added `'/reset-password(.*)'` to the `createRouteMatcher` array for `isPublicRoute`. Fixed in the same commit as CR-01 since both changes are in `middleware.ts`.

---

## Skipped Issues

None — all in-scope findings were fixed successfully.

---

_Fixed: 2026-05-02T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
