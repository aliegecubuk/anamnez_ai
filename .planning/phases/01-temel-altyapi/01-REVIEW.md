---
phase: 01-temel-altyapi
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - .env.example
  - components.json
  - next.config.ts
  - package.json
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/reset-password/page.tsx
  - src/app/(auth)/sign-in/page.tsx
  - src/app/api/webhooks/clerk/route.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/orgs/[slug]/dashboard/page.tsx
  - src/app/orgs/[slug]/layout.tsx
  - src/app/page.tsx
  - src/app/superadmin/layout.tsx
  - src/app/superadmin/page.tsx
  - src/lib/__tests__/setup.ts
  - src/lib/clerk/roles.ts
  - src/lib/supabase/admin.ts
  - src/lib/supabase/server.ts
  - src/lib/utils.ts
  - src/middleware.ts
  - supabase/config.toml
  - supabase/migrations/20260501000001_create_tenants.sql
  - supabase/migrations/20260501000002_create_audit_log.sql
  - supabase/seed.sql
  - tsconfig.json
  - vercel.json
  - vitest.config.ts
findings:
  critical: 5
  warning: 5
  info: 2
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed the Phase 1 foundation scaffold: Next.js 15 / Clerk / Supabase multi-tenant setup. Five
critical issues were found. The most severe are a complete authentication bypass for all tenant
subdomain routes in middleware, a cross-tenant data leak in the dashboard query, and a broken
Clerk-to-Supabase JWT bridge that will silently render all RLS policies inoperative. Two additional
critical issues are a broken post-login redirect and a null token being forwarded to Supabase as a
literal string. Five warnings cover slug-to-org binding, IP spoofing in the audit log, missing
env validation, a wrong Vercel functions path pattern, and an unprotected password-reset route.

---

## Critical Issues

### CR-01: Middleware bypasses auth entirely for all tenant subdomain requests

**File:** `src/middleware.ts:20-26`

**Issue:** When a request arrives on a tenant subdomain the middleware immediately rewrites the URL
to `/orgs/[slug]/...` and returns with `NextResponse.rewrite(rewriteUrl)`. This early return means
the subsequent `auth.protect()` call on line 38 is never reached. Any unauthenticated user can
access any tenant route — the tenant layout does perform a server-side auth check, but an attacker
who crafts a direct request bypassing the Next.js layout hierarchy (e.g., via a direct fetch to an
API route under `/orgs/[slug]/api/...`) receives no middleware-level protection. This also means
the CVE-2025-29927 defence note in the layout is the only gate, which contradicts defence-in-depth.

**Fix:** Enforce authentication before rewriting. Apply `auth.protect()` for non-public paths
before returning the rewrite response:

```ts
if (isTenantSubdomain) {
  if (!isPublicRoute(req)) {
    await auth.protect()          // throws / redirects if unauthenticated
  }
  const newPath = `/orgs/${slug}${url.pathname}`
  const rewriteUrl = new URL(newPath, req.url)
  rewriteUrl.search = url.search
  return NextResponse.rewrite(rewriteUrl)
}
```

---

### CR-02: Dashboard query fetches an arbitrary tenant — cross-tenant data leak potential

**File:** `src/app/orgs/[slug]/dashboard/page.tsx:6-9`

**Issue:** The query `.from('tenants').select('name, slug').single()` has no `.eq()` filter. It
asks Supabase for any single tenant row. The `tenants` table has RLS enabled with no user-facing
policies, so the anon key returns zero rows (the query silently returns `null` for `tenantData`).
However this is a latent correctness bug: if a policy is ever added for tenant self-read, this
query would return an arbitrary row rather than the current tenant. The `params.slug` value is
available in the layout (and can be extracted from the URL) but is completely unused.

**Fix:** Filter by the slug from the URL params. Because the page is a Server Component, read the
slug from `params` (or pass it as a prop from the layout) and filter:

```ts
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('name, slug')
    .eq('slug', slug)
    .single()
  ...
}
```

---

### CR-03: Clerk JWT not wired to Supabase — all RLS policies are silently broken

**File:** `supabase/config.toml:355-358`

**Issue:** `[auth.third_party.clerk]` is `enabled = false`. The `createSupabaseServerClient` in
`src/lib/supabase/server.ts` injects the Clerk JWT as an `Authorization: Bearer <token>` header on
every Supabase request. For Supabase to validate that JWT and populate `auth.jwt()` in RLS
policies, Clerk must be registered as a trusted third-party OIDC provider. With the integration
disabled, Supabase treats every request as anonymous (using the anon key), `auth.jwt()` returns the
anon payload, and the RLS template expressions (`WHERE clerk_org_id = auth.jwt() ->> 'org_id'`)
evaluate against an empty or wrong claim. All tenant isolation enforced through RLS silently
passes or fails in unintended ways depending on policy logic. This is a complete data isolation
failure for production.

**Fix — local config:**
```toml
[auth.third_party.clerk]
enabled = true
domain = "env(CLERK_ISSUER_DOMAIN)"   # e.g. "your-instance.clerk.accounts.dev"
```

The production Supabase project also requires the same configuration in the Supabase dashboard
(Authentication → Third-party Auth → Clerk). Add `CLERK_ISSUER_DOMAIN` to `.env.example`.

---

### CR-04: Post-login redirect targets non-existent route `/dashboard`

**File:** `src/app/(auth)/sign-in/page.tsx:40`

**Issue:** On successful sign-in, the code does `router.push('/dashboard')`. No route at
`/dashboard` exists in the app — the actual routes are `/orgs/[slug]/dashboard` (tenant users) and
`/superadmin` (superadmin). The root `page.tsx` redirects authenticated users to `/superadmin` or
back to `/sign-in`, it does not serve tenant users. Users who successfully authenticate will land
on a 404.

**Fix:** After sign-in, redirect to the root path and let the server-side routing in `page.tsx`
handle dispatch, OR redirect to the tenant dashboard using the active org slug from Clerk:

```ts
if (result.status === 'complete') {
  // Let root page.tsx handle redirect based on role/org
  router.push('/')
}
```

Or, if the org slug is available from `useOrganization`:

```ts
router.push(`/orgs/${orgSlug}/dashboard`)
```

---

### CR-05: `getToken()` returns `null` when unauthenticated — forwarded as literal string "Bearer null"

**File:** `src/lib/supabase/server.ts:13-14`

**Issue:** `getToken()` returns `string | null`. When the Supabase client is used in a context
where the user is not authenticated (or the token has expired), `clerkToken` is `null`. The header
is then set to `Authorization: Bearer null` — the literal string `"null"`. Supabase will reject
this as an invalid token, but the error surfaces silently as a permissions/RLS failure rather than
an authentication error, making debugging difficult. More importantly this client is called from
`DashboardPage` which is only behind an auth gate — but it is a reusable utility and future callers
may not have that guarantee.

**Fix:** Throw early if the token is null to surface auth failures explicitly:

```ts
const clerkToken = await getToken()
if (!clerkToken) {
  throw new Error('No Clerk session token — user is not authenticated')
}
headers.set('Authorization', `Bearer ${clerkToken}`)
```

---

## Warnings

### WR-01: Layout does not verify that Clerk org matches URL slug — cross-tenant navigation possible

**File:** `src/app/orgs/[slug]/layout.tsx:14-22`

**Issue:** The layout checks that a user is authenticated and has an active org (`orgId`), but does
not verify that the active org corresponds to the `slug` in the URL. A user authenticated to
`org_a` (slug `uni-a`) who manually navigates to `/orgs/uni-b/dashboard` will pass all auth checks
(userId ✓, orgId ✓) and reach the dashboard. The `params.slug` is awaited but the resolved value
is discarded. Data isolation at the route level is entirely dependent on RLS being correct (see
CR-03).

**Fix:** Resolve the slug from params and validate it against the active org:

```ts
const { slug } = await params
// Fetch the tenant for this slug via supabaseAdmin and compare clerk_org_id to orgId
const { data: tenant } = await supabaseAdmin
  .from('tenants')
  .select('clerk_org_id')
  .eq('slug', slug)
  .single()

if (!tenant || tenant.clerk_org_id !== orgId) {
  redirect('/sign-in?error=wrong_org')
}
```

---

### WR-02: `x-forwarded-for` in audit log can be spoofed by the client

**File:** `src/app/api/webhooks/clerk/route.ts:46`

**Issue:** `x-forwarded-for` is taken directly from the incoming webhook request header. This
header is set by Vercel's edge network for app traffic, but this is a webhook endpoint and the
request comes from Svix (Clerk's delivery infrastructure), not from the end user. The IP recorded
in the audit log will be a Svix IP address, not the user's IP. The Clerk `session.created` event
payload contains the client IP in `data.client_ip` (or similar, depending on Clerk API version).
Using the `x-forwarded-for` of the webhook delivery is both wrong (Svix's IP) and spoofable.

**Fix:** Extract the client IP from the Clerk event payload instead of the webhook request header:

```ts
const ip_address = (data.request_data as Record<string, unknown>)?.remote_addr as string ?? null
```

Check the exact field name in the Clerk `SessionJSON` type for the current SDK version.

---

### WR-03: `supabaseAdmin` and `createSupabaseServerClient` use non-null assertions with no startup validation

**File:** `src/lib/supabase/admin.ts:5-6`, `src/lib/supabase/server.ts:8-9`

**Issue:** Both files use `!` to assert that `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are defined. If any of these
variables is missing the client is constructed with `undefined`, and every database call fails at
runtime with an opaque error rather than a clear startup message. `supabaseAdmin` is a
module-level singleton so the failure happens at cold-start with no helpful context.

**Fix:** Add explicit checks at module load:

```ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}
export const supabaseAdmin = createClient(url, key, { ... })
```

---

### WR-04: `vercel.json` functions path pattern is incorrect for Next.js App Router

**File:** `vercel.json:4`

**Issue:** The `functions` key uses the pattern `"app/api/**"`. Vercel's `functions` configuration
key expects paths relative to the project root matching the deployed function file paths. For
Next.js App Router the correct pattern is `"src/app/api/**"` (when `src/` layout is used) or
just omit the functions block and configure `maxDuration` via `next.config.ts`. As written, the
`maxDuration: 30` setting is likely silently ignored and all API routes default to Vercel's
platform default (10s on Pro), which may cause webhook timeouts.

**Fix:**

```json
{
  "regions": ["fra1"],
  "functions": {
    "src/app/api/**": {
      "maxDuration": 30
    }
  }
}
```

Or configure via `next.config.ts`:
```ts
export const maxDuration = 30
```
placed as a named export in each route file that needs it.

---

### WR-05: Password-reset page is not in `isPublicRoute` — unauthenticated users cannot access it

**File:** `src/middleware.ts:6`

**Issue:** `isPublicRoute` only matches `/sign-in(.*)`. The `/reset-password` path is not included.
When `auth.protect()` is called for a non-public route on the root domain and the user is not
authenticated, Clerk will redirect to the sign-in page. This means a user who has forgotten their
password cannot reach the reset-password form — they get bounced back to sign-in in a loop.

**Fix:**

```ts
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/reset-password(.*)'])
```

---

## Info

### IN-01: `next.config.ts` is empty — no security headers configured

**File:** `next.config.ts:3-5`

**Issue:** The config object is entirely empty. For a healthcare app handling KVKK special-category
data, security response headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy) should be added. This is a quality gap even at the foundation phase.

**Fix:** Add headers in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'microphone=()' },  // update when STT added
        ],
      },
    ]
  },
}
```

---

### IN-02: `package.json` missing `test` script

**File:** `package.json:5-10`

**Issue:** `vitest` is installed as a dev dependency and `vitest.config.ts` is configured, but
there is no `"test"` or `"test:unit"` script in `package.json`. Running `npm test` will fail with
"missing script: test". This is a quality/DX gap.

**Fix:**

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
