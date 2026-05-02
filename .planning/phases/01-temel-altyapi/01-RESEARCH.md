# Phase 1: Temel Altyapı — Research

**Researched:** 2026-05-01
**Domain:** Next.js 15 + Clerk Organizations + Supabase RLS + Multi-tenant auth infrastructure
**Overall Confidence:** HIGH (stack choices verified; integration patterns confirmed against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** No public signup. Superadmin manually creates tenants via in-app superadmin panel.
- **D-02:** Superadmin panel required in-app (not just Clerk dashboard) — view all tenants, troubleshoot, delete.
- **D-03:** Tenant subdomains: `{tenant-slug}.anamnezal.com`. Clerk must resolve the correct Org from subdomain.
- **D-04:** All login page UI/design delegated to frontend-design agent. No design decisions locked here.
- **D-05:** Phase 1 covers technical KVKK layer: Supabase Frankfurt eu-central-1, AES-256 at rest, TLS, RLS from first schema.
- **D-06:** User-facing KVKK consent screens scoped to Phase 4.
- **D-07:** Basic login audit log (who, when, which tenant) set up in Phase 1 — cannot be retrofitted.
- **D-08:** No auto-timeout. Manual logout only.
- **D-09:** Standard Clerk session persistence.

### Claude's Discretion

- Clerk Organization slug format and subdomain mapping implementation details
- Supabase RLS policy structure (row-level vs. column-level tradeoffs)
- Superadmin panel UI layout (subject to frontend-design agent)

### Deferred Ideas (OUT OF SCOPE)

- Public tenant self-signup page
- Auto-logout / session timeout
- KVKK aydınlatma metni at user registration (Phase 4)
- Password strength rules / 2FA
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Admin creates tenant account (name, email, org) | D-01/D-02: Superadmin panel + Clerk Organizations; Clerk Backend API `organizations.createOrganization()` |
| AUTH-02 | Admin creates dentist/assistant accounts within tenant | Clerk `organizationMembership.create()` via Backend API; in-app invite flow |
| AUTH-03 | Admin assigns roles (admin / dentist / assistant) | Clerk custom roles per organization; `organizationMembership.update({ role })` |
| AUTH-04 | User logs in with email/password | Clerk `<SignIn>` component; email/password strategy enabled in dashboard |
| AUTH-05 | Session persists across browser refreshes | Clerk default session persistence; standard cookie-based session |
| AUTH-06 | User resets password via email link | Clerk built-in password reset flow; no custom implementation needed |
| AUTH-07 | Tenant data strictly isolated — Tenant A cannot see Tenant B data | Supabase RLS with `org_id` from Clerk JWT; `auth.jwt() ->> 'org_id'` in every policy |
</phase_requirements>

---

## Research Summary

Phase 1 establishes the entire auth and data isolation foundation. Every subsequent phase inherits from it. The stack is confirmed and well-supported: Clerk Organizations handles multi-tenant auth, subdomain resolution, and RBAC; Supabase (Frankfurt) handles data persistence and RLS; Next.js 15 App Router + `clerkMiddleware()` handles routing and org activation.

**Three integration facts that change the plan:**

1. **The old Clerk-Supabase JWT template pattern is deprecated as of April 1, 2025.** The new "native" Supabase Third-Party Auth integration is simpler: configure Clerk as a third-party auth provider in the Supabase dashboard, then pass `(await auth()).getToken()` directly as the Supabase client's `accessToken`. No JWT template creation needed. [VERIFIED: clerk.com/changelog/2025-03-31-supabase-integration]

2. **CVE-2025-29927 (Next.js middleware bypass) is real and relevant.** Versions < 15.2.3 are vulnerable. The project must pin to `next@15.2.3` or later. Clerk is partially affected: routes that rely solely on middleware-layer auth checks without a server-side `auth()` call can be bypassed. [VERIFIED: clerk.com/blog/cve-2025-29927]

3. **Clerk's `organizationSyncOptions` in `clerkMiddleware()` is the correct mechanism for subdomain→org resolution.** It matches slug patterns in the URL and activates the correct org. For subdomain routing, middleware extracts the slug from the hostname, rewrites to a path like `/orgs/:slug/...`, and `organizationSyncOptions` handles org activation from there. [VERIFIED: clerk.com/docs/guides/organizations/org-slugs-in-urls]

**Primary recommendation:** Use the native Supabase + Clerk third-party auth integration (not JWT templates). Structure the first migration to create a `tenants` table and establish `tenant_id` as a mandatory column on every subsequent table. All RLS policies use `auth.jwt() ->> 'org_id' = tenant_id`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authentication (sign in/out) | Clerk cloud | Next.js middleware | Clerk handles the auth state; middleware enforces it at the edge |
| Session persistence | Clerk cloud | Browser cookie | Clerk manages the session cookie; no custom implementation |
| Org/tenant resolution from subdomain | Next.js Edge middleware | Clerk `organizationSyncOptions` | Middleware extracts slug from hostname; Clerk activates the org |
| Role-based access control | Clerk Organizations | Next.js API routes | Clerk org roles (admin/dentist/assistant) checked server-side |
| Data isolation (multi-tenant) | Supabase RLS | — | Database-layer enforcement; application logic is a secondary check |
| Audit log writes | Supabase (service role) | Clerk webhooks | Service role bypasses RLS; Clerk webhook triggers on session create |
| Superadmin panel | Next.js App Router | Clerk Backend API | Custom in-app section using `clerkClient` to list/manage orgs |
| KVKK data residency | Supabase Frankfurt | Vercel fra1 functions | Data lives in Frankfurt; compute also pinned to Frankfurt |
| Password reset | Clerk cloud | — | Built-in flow; zero custom implementation |
| TLS encryption | Vercel (in transit) | — | Automatic on Vercel Pro |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 15.2.4+ | Framework | Must be ≥15.2.3 to patch CVE-2025-29927 |
| `@clerk/nextjs` | 7.3.0 | Auth, orgs, middleware | Native Next.js 15 App Router support |
| `@supabase/supabase-js` | 2.x | DB client | Official Supabase JS client |
| `@supabase/ssr` | 0.10.2 | SSR-safe Supabase client | Cookie-based session for Next.js SSR |
| `supabase` (CLI) | 2.98.0 | Migrations, local dev | Official CLI; Docker-based local stack |
| `tailwindcss` | 4.x | Styling | Locked in stack; v4 CSS-native config |
| `shadcn/ui` (CLI) | latest | Component library | `npx shadcn@latest init` |

[VERIFIED: npm registry — versions confirmed 2026-05-01]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `svix` | latest | Clerk webhook signature verification | Needed to verify webhook payloads in audit log route |
| `zod` | 3.x | Schema validation | Server action/API route input validation |
| `next-themes` | latest | Dark mode toggle | Required if UI spec includes dark mode |

### Installation

```bash
# Project scaffold
npx create-next-app@latest anamnezal --typescript --tailwind --eslint --app --src-dir

# Auth
npm install @clerk/nextjs

# Database
npm install @supabase/supabase-js @supabase/ssr

# Supabase CLI (global)
npm install -g supabase

# Validation / webhook
npm install zod svix

# shadcn init (run after project scaffold)
npx shadcn@latest init
```

**Version verification (confirmed):**
- `next`: 15.2.4 [VERIFIED: npm registry]
- `@clerk/nextjs`: 7.3.0 [VERIFIED: npm registry]
- `@supabase/ssr`: 0.10.2 [VERIFIED: npm registry]
- `supabase` CLI: 2.98.0 [VERIFIED: npm registry]

---

## 1. Clerk + Next.js 15 Integration

### Setup Flow

1. Install `@clerk/nextjs@7.3.0`
2. Add to `app/layout.tsx`: wrap with `<ClerkProvider>`
3. Create `middleware.ts` at project root (not in `src/` — Next.js 15 middleware must be at root or `src/middleware.ts`)
4. Use `clerkMiddleware()` (not the old `authMiddleware()` which is removed in v6+)

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',  // superadmin creates accounts, but Clerk sign-up UI still needed internally
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

[CITED: clerk.com/docs/reference/nextjs/clerk-middleware]

### Key APIs

| API | Where | Purpose |
|-----|-------|---------|
| `auth()` | Server components, Route Handlers | Get userId, orgId, sessionClaims |
| `currentUser()` | Server components | Full user object (extra network call) |
| `clerkClient()` | API routes / Server Actions | Backend API access (list orgs, update metadata) |
| `<ClerkProvider>` | Root layout | Required wrapper |
| `<SignIn>`, `<SignOut>` | Auth pages | Prebuilt UI components |
| `<OrganizationSwitcher>` | Nav | Switch active org |

### CVE-2025-29927 Mitigation

**Critical:** Must use `next@>=15.2.3`. Additionally, all protected pages must perform a server-side `auth()` call — do not rely solely on middleware redirect for auth enforcement. Clerk's recommendation: every protected Server Component calls `const { userId } = await auth()` and redirects if null.

[VERIFIED: clerk.com/blog/cve-2025-29927, nvd.nist.gov/vuln/detail/CVE-2025-29927]

---

## 2. Supabase + Clerk JWT / RLS Integration

### Current Pattern (post-April 2025 deprecation)

**Do NOT use:** Clerk JWT template → Supabase JWT secret sharing (deprecated April 1, 2025)

**Use instead:** Supabase Third-Party Auth (native integration)

**Setup steps:**
1. In Supabase Dashboard → Authentication → Sign In/Up → Third Party Auth → Add Clerk
2. Enter your Clerk Frontend API URL (e.g., `https://clerk.anamnezal.com`)
3. Supabase will verify Clerk-signed JWTs natively — no shared secret needed

**Client creation in Next.js (server component):**

```typescript
// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

export async function createSupabaseServerClient() {
  const { getToken } = await auth()
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url, options = {}) => {
          const clerkToken = await getToken({ template: undefined }) // no template needed
          const headers = new Headers(options?.headers)
          headers.set('Authorization', `Bearer ${clerkToken}`)
          return fetch(url, { ...options, headers })
        },
      },
    }
  )
}
```

[CITED: clerk.com/docs/guides/development/integrations/databases/supabase]
[CITED: clerk.com/changelog/2025-03-31-supabase-integration]

### JWT Claims Available in RLS

Clerk session tokens expose these claims accessible via `auth.jwt()` in Supabase RLS policies:

| Claim | Value | Use in RLS |
|-------|-------|-----------|
| `sub` | Clerk user ID | `auth.jwt() ->> 'sub'` |
| `org_id` | Active org ID | `auth.jwt() ->> 'org_id'` |
| `org_slug` | Active org slug | `auth.jwt() ->> 'org_slug'` |
| `org_role` | User's role in org | `auth.jwt() ->> 'org_role'` |

**Key constraint:** `org_id` is only present when the user has an active organization in their session. The middleware must ensure org activation before any Supabase call.

---

## 3. Supabase RLS for Multi-Tenancy

### Core Pattern

Every table gets a `tenant_id` column referencing the `tenants` table. RLS policies use `auth.jwt() ->> 'org_id'` to match.

```sql
-- 001_create_tenants.sql
CREATE TABLE public.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id text UNIQUE NOT NULL,  -- Clerk org_id (e.g., "org_abc123")
  slug        text UNIQUE NOT NULL,   -- subdomain slug (e.g., "istanbul-uni")
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- No RLS on tenants table — managed by superadmin via service role only
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
-- No policies = no user access via anon/user key. Only service_role can touch it.

-- Example: a future table with tenant isolation
CREATE TABLE public.patients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id),
  created_at  timestamptz NOT NULL DEFAULT now()
  -- ... other columns
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.patients
  FOR ALL
  USING (
    tenant_id = (
      SELECT id FROM public.tenants
      WHERE clerk_org_id = auth.jwt() ->> 'org_id'
    )
  )
  WITH CHECK (
    tenant_id = (
      SELECT id FROM public.tenants
      WHERE clerk_org_id = auth.jwt() ->> 'org_id'
    )
  );
```

### Performance: Index Every tenant_id

```sql
CREATE INDEX ON public.patients (tenant_id);
CREATE INDEX ON public.tenants (clerk_org_id);  -- used in every RLS subquery
```

[CITED: supabase.com/docs/guides/database/postgres/row-level-security]
[CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]

### RLS Template for All Future Tables

Every new table in any future phase follows this template exactly:

```sql
-- Add to every migration file that creates a new user-facing table:
ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.{table_name}
  FOR ALL
  USING (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  );
```

### Service Role for Superadmin

The superadmin panel uses the Supabase `service_role` key, which bypasses all RLS:

```typescript
// lib/supabase/admin.ts — NEVER expose to client
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

[CITED: github.com/orgs/supabase/discussions/30739]

---

## 4. Subdomain Routing

### Architecture

```
Request: istanbul-uni.anamnezal.com/dashboard
         ↓
Edge Middleware (middleware.ts)
  1. Extract slug from hostname: "istanbul-uni"
  2. Rewrite URL: NextResponse.rewrite(/orgs/istanbul-uni/dashboard)
  3. clerkMiddleware organizationSyncOptions activates org from slug
         ↓
App Router: app/orgs/[slug]/dashboard/page.tsx
  - auth() returns { orgId: "org_abc123", orgSlug: "istanbul-uni" }
```

### Middleware Implementation

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'anamnezal.com'

export default clerkMiddleware(
  async (auth, req) => {
    const url = req.nextUrl
    const hostname = req.headers.get('host') || ''

    // Extract subdomain slug
    const slug = hostname
      .replace(`.${ROOT_DOMAIN}`, '')
      .replace(`:3000`, '')  // local dev port
    const isTenantSubdomain = slug !== ROOT_DOMAIN && slug !== 'www' && slug !== ''

    if (isTenantSubdomain) {
      // Rewrite to /orgs/[slug]/... so organizationSyncOptions can activate the org
      const newPath = `/orgs/${slug}${url.pathname}`
      const rewriteUrl = new URL(newPath, req.url)
      rewriteUrl.search = url.search
      return NextResponse.rewrite(rewriteUrl)
    }

    // Main domain: superadmin panel or landing
    await auth.protect()
  },
  {
    organizationSyncOptions: {
      organizationPatterns: ['/orgs/:slug', '/orgs/:slug/(.*)'],
    },
  }
)

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)', '/(api|trpc)(.*)'],
}
```

[CITED: clerk.com/docs/guides/organizations/org-slugs-in-urls]
[CITED: vercel.com/templates/next.js/hostname-rewrites]

### Local Dev Subdomain Testing

Subdomains don't work on `localhost`. Use one of:

- **Option A:** Edit `/etc/hosts` (or `C:\Windows\System32\drivers\etc\hosts` on Windows): add `127.0.0.1 istanbul-uni.localhost`
- **Option B:** Use `lvh.me` domain (resolves all subdomains to 127.0.0.1): `istanbul-uni.lvh.me:3000`
- **Option C:** Use Vercel dev environment for subdomain testing

Set `NEXT_PUBLIC_ROOT_DOMAIN=localhost` or `lvh.me` in `.env.local`.

[ASSUMED: Option B (lvh.me) is the simplest for Windows dev without hosts file admin rights]

### Vercel Wildcard Domain Setup

1. In Vercel project settings → Domains → Add `anamnezal.com` and `*.anamnezal.com`
2. At DNS registrar: point nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com` (wildcard requires Vercel nameservers — CNAME alone insufficient)
3. Vercel auto-issues SSL certs for each subdomain on first request

**Constraint:** Wildcard domain requires Vercel nameserver delegation (not CNAME-only). [VERIFIED: vercel.com/blog/wildcard-domains]

### Clerk Domain Setup for Subdomains

In Clerk Dashboard → Configure → Domains:
- Primary domain: `anamnezal.com`
- Enable "Allowed Subdomains" in production (security best practice)
- Add each tenant slug subdomain to the allowlist dynamically when a tenant is created (via Clerk Backend API or manually)

**Alternative:** Disable subdomain allowlist restriction during development; re-enable with explicit list before production launch.

[CITED: clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist]

---

## 5. Login Audit Log

### Recommended Pattern: Clerk Webhook → Supabase (service role)

Clerk emits a `session.created` webhook event on every successful login. A Next.js API route receives the webhook, verifies the Svix signature, and inserts a record using the Supabase service role key (bypasses RLS).

**Why not `user.signed_in`:** Clerk does not emit a `user.signed_in` event. `session.created` is the correct event for login detection. [ASSUMED: based on Clerk webhook event reference; verify in Clerk dashboard webhook event list]

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) throw new Error('Missing CLERK_WEBHOOK_SECRET')

  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  const body = await req.text()
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: any
  try {
    evt = wh.verify(body, { 'svix-id': svix_id!, 'svix-timestamp': svix_timestamp!, 'svix-signature': svix_signature! })
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (evt.type === 'session.created') {
    const { user_id, id: session_id, last_active_organization_id } = evt.data
    await supabaseAdmin.from('login_audit_log').insert({
      user_id,
      session_id,
      clerk_org_id: last_active_organization_id,
      ip_address: headerPayload.get('x-forwarded-for') ?? null,
      user_agent: headerPayload.get('user-agent') ?? null,
      logged_in_at: new Date().toISOString(),
    })
  }

  return new Response('OK', { status: 200 })
}
```

### Audit Log Table (Migration)

```sql
-- 002_create_audit_log.sql
CREATE TABLE public.login_audit_log (
  id           bigserial PRIMARY KEY,
  user_id      text NOT NULL,          -- Clerk user_id
  session_id   text NOT NULL,          -- Clerk session_id
  clerk_org_id text,                   -- Clerk org_id (null if personal account login)
  ip_address   text,
  user_agent   text,
  logged_in_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but NO user-facing read policy — only service_role can read
ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.login_audit_log (clerk_org_id);
CREATE INDEX ON public.login_audit_log (logged_in_at DESC);
```

**IP address note:** On Vercel, the real IP comes from `x-forwarded-for` header. Vercel sets this correctly; the first IP in the list is the client IP.

[CITED: supabase.com/docs/guides/auth/audit-logs]

---

## 6. Superadmin Architecture

### Pattern: publicMetadata flag on the superadmin user

Clerk has no native "super-admin across all orgs" concept. The correct approach for AnamnezAl:

1. Mark one or more users as superadmin via `publicMetadata.role = 'superadmin'` using the Clerk Backend API (server-side only, never from client)
2. In Next.js middleware, check `sessionClaims.metadata.role === 'superadmin'` to allow access to `/superadmin/**` routes
3. The superadmin panel uses `clerkClient()` (Backend API) to list, create, and delete organizations

```typescript
// Setting superadmin role (run once via API route or script with service key)
import { clerkClient } from '@clerk/nextjs/server'

const client = await clerkClient()
await client.users.updateUserMetadata(userId, {
  publicMetadata: { role: 'superadmin' }
})
```

**Session token must expose publicMetadata.** In Clerk Dashboard → Sessions → Customize session token: add `{ "metadata": "{{user.public_metadata}}" }` so `sessionClaims.metadata.role` is accessible in middleware without an extra API call.

```typescript
// middleware.ts — superadmin route protection
const isSuperadminRoute = createRouteMatcher(['/superadmin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isSuperadminRoute(req)) {
    const { sessionClaims } = await auth()
    if (sessionClaims?.metadata?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }
  // ... rest of middleware
})
```

### Superadmin Panel Capabilities

| Action | Clerk API | Supabase Action |
|--------|-----------|-----------------|
| List all tenants | `client.organizations.getOrganizationList()` | SELECT from `tenants` (service role) |
| Create tenant | `client.organizations.createOrganization({ name, slug })` | INSERT into `tenants` |
| Delete tenant | `client.organizations.deleteOrganization(orgId)` | DELETE from `tenants` (cascade) |
| View tenant members | `client.organizations.getOrganizationMembershipList(orgId)` | — |
| Set tenant admin | `client.organizationMemberships.updateOrganizationMembership(...)` | — |

[CITED: clerk.com/docs/guides/secure/basic-rbac]
[CITED: clerk.com/docs/nextjs/reference/objects/organization]

---

## 7. Supabase Migrations

### Greenfield Setup Workflow

```bash
# 1. Initialize Supabase in project root
supabase init

# 2. Start local Supabase stack (requires Docker)
supabase start
# Outputs: local URL, anon key, service_role key — copy to .env.local

# 3. Create migration files
supabase migration new create_tenants
supabase migration new create_audit_log
# Files created in supabase/migrations/YYYYMMDDHHMMSS_name.sql

# 4. Apply migrations locally
supabase db reset  # applies all migrations + seed.sql

# 5. Push to remote (linked Supabase project)
supabase link --project-ref <your-project-ref>
supabase db push
```

[CITED: supabase.com/docs/guides/local-development/overview]

### Migration File Naming Convention

```
supabase/migrations/
├── 20260501000001_create_tenants.sql
├── 20260501000002_create_audit_log.sql
└── 20260501000003_create_users_view.sql    # optional: mirror Clerk user data
```

### Environment Variables (.env.local)

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # NEVER expose to client

# App
NEXT_PUBLIC_ROOT_DOMAIN=localhost   # anamnezal.com in production
```

### Supabase Region Enforcement

**Supabase project MUST be created in `eu-central-1` (Frankfurt).** This is selected at project creation time in the Supabase dashboard — it cannot be changed after creation. There is no config file that enforces this after the fact; it is an infrastructure-level decision locked at project creation.

**Action item for planner:** Include a verification step: "Confirm Supabase project region is eu-central-1 in dashboard Settings → Infrastructure."

[CITED: supabase.com/docs/guides/platform/regions]

---

## 8. KVKK Technical Controls (Phase 1 Scope)

### What Phase 1 Must Implement

| Control | How | Status |
|---------|-----|--------|
| Data at rest encryption (AES-256) | Supabase handles automatically on Pro plan | Done at infrastructure level — verify plan |
| TLS in transit | Vercel + Supabase both enforce HTTPS | Done at infrastructure level |
| Data residency (Frankfurt) | Supabase `eu-central-1`, Vercel `fra1` | Must verify at project creation |
| Tenant data isolation | Supabase RLS on every table | Phase 1 implementation |
| Login audit log | `login_audit_log` table + Clerk webhook | Phase 1 implementation |
| Access to raw patient data | Service role key stored only server-side | Phase 1 secret management |

### What Phase 1 Does NOT Need to Implement

- VERBİS registration — required before any real patient data is processed (pre-beta action)
- OpenAI DPA — required before Phase 3 (STT)
- Supabase DPA — required before beta (Pro plan prerequisite)
- Patient consent flow (aydınlatma metni) — Phase 4
- Data retention/deletion workflows — deferred
- Breach notification playbook — pre-go-live

### Vercel fra1 Configuration

```json
// vercel.json — pin all functions to Frankfurt
{
  "regions": ["fra1"],
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  }
}
```

[CITED: vercel.com (fra1 region support confirmed for Vercel Pro)]
[CITED: CLAUDE.md — "Vercel functions MUST be pinned to fra1 in vercel.json"]

### TC Kimlik (Turkish National ID) Encryption

TC kimlik numbers are PII under KVKK. At-rest encryption via Supabase (AES-256) covers the storage layer, but application-level encryption adds defense-in-depth. **Phase 1 decision point:** TC kimlik is a Phase 2 (Patient Management) concern, but the encryption strategy should be defined now.

**Recommendation (Claude's discretion):** Store TC kimlik hashed (SHA-256 + salt) for search, and encrypted (AES-256-GCM with app-level key) for display. The app-level encryption key is stored in environment variables (not Supabase). This is a Phase 2 implementation detail but should be documented as an architectural constraint now.

[ASSUMED: Application-layer encryption of TC kimlik is required by KVKK Article 6 for special category health data identifiers — verify with Turkish legal counsel before Phase 2]

---

## 9. shadcn/ui + Tailwind CSS v4 Init

### Tailwind v4 Breaking Changes

Tailwind CSS v4 removes `tailwind.config.js/ts` entirely. Configuration moves into CSS via the `@theme` directive in `globals.css`. This is a significant change from v3.

**shadcn/ui officially supports Tailwind v4** as of their latest CLI. [VERIFIED: ui.shadcn.com/docs/tailwind-v4]

### Init Commands

```bash
# 1. Create Next.js project (includes Tailwind v4 auto-config)
npx create-next-app@latest anamnezal \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# 2. Initialize shadcn
npx shadcn@latest init
# Prompts:
#   - Style: Default (or New York)
#   - Base color: Slate (or per UI spec)
#   - CSS variables: Yes (required for theming)
#   - No tailwind.config.ts path needed (v4 leaves it blank)

# 3. Add initial components
npx shadcn@latest add button card form input label toast
```

### components.json (Tailwind v4 format)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### globals.css (Tailwind v4 @theme structure)

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* shadcn tokens here */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}
```

**Key difference from v3:** No `tailwind.config.js`. Leave `tailwind.config` path blank in `components.json`. All color tokens use OKLCH (not HSL).

[CITED: ui.shadcn.com/docs/tailwind-v4]
[CITED: ui.shadcn.com/docs/installation/next]

---

## 10. Validation Architecture

### Test Framework Detection

Node 22.15.0 available. Docker 29.1.2 available (required for `supabase start`). No existing test infrastructure — greenfield.

**Recommended:** Vitest for unit/integration tests (compatible with Next.js 15 and Vite-based toolchain used by shadcn). Playwright for E2E.

```bash
npm install -D vitest @vitejs/plugin-react
npm install -D @playwright/test
```

### Phase 1 Requirements → Test Map

| Req ID | Behavior | Test Type | Command | Wave 0? |
|--------|----------|-----------|---------|---------|
| AUTH-01 | Superadmin creates org via Clerk API | Integration | Manual / Playwright | ❌ Wave 0 |
| AUTH-02 | Admin creates dentist account in org | Integration | Playwright | ❌ Wave 0 |
| AUTH-03 | Role assignment works | Unit | `vitest run src/lib/auth.test.ts` | ❌ Wave 0 |
| AUTH-04 | Email/password sign-in | E2E | Playwright | ❌ Wave 0 |
| AUTH-05 | Session survives browser refresh | E2E | Playwright | ❌ Wave 0 |
| AUTH-06 | Password reset email flow | E2E (manual) | Manual | Manual-only |
| AUTH-07 | Cross-tenant data access blocked | Integration | `vitest run src/lib/rls.test.ts` | ❌ Wave 0 |

### RLS Verification (AUTH-07) — Critical Test

The most important Phase 1 test is cross-tenant isolation. Create two Supabase test clients authenticated as different orgs; verify Tenant A cannot read Tenant B rows.

```typescript
// src/lib/__tests__/rls.test.ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('RLS tenant isolation', () => {
  it('Tenant A cannot read Tenant B patients', async () => {
    // Client authenticated as org_tenant_a
    const clientA = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwtForTenantA}` } }
    })
    
    // Insert a row as Tenant B (via service role)
    // Then try to read it as Tenant A
    const { data, error } = await clientA
      .from('patients')
      .select('*')
      .eq('tenant_id', tenantBId)
    
    expect(data).toHaveLength(0)  // RLS blocks cross-tenant read
    expect(error).toBeNull()      // Empty result, not an error
  })
})
```

### Wave 0 Gaps

- [ ] `src/lib/__tests__/rls.test.ts` — AUTH-07 cross-tenant isolation
- [ ] `src/lib/__tests__/auth.test.ts` — AUTH-03 role checking logic
- [ ] `e2e/auth.spec.ts` — Playwright: sign-in, session persistence
- [ ] `vitest.config.ts` — Vitest configuration
- [ ] `playwright.config.ts` — Playwright configuration

---

## Key Risks & Mitigations

### Risk 1: Clerk Subdomain Allowlist Blocks Tenants

**What:** In production, Clerk's subdomain allowlist must be manually updated (or via API) each time a new tenant is created. Missing this step means the new tenant subdomain can't authenticate.

**Mitigation:** In the superadmin "create tenant" flow, after calling `client.organizations.createOrganization()`, also call the Clerk Backend API to add the new slug to the subdomain allowlist. [ASSUMED: Clerk provides a Backend API endpoint for this — verify in Clerk API reference]

### Risk 2: org_id Absent from JWT on Login

**What:** `auth.jwt() ->> 'org_id'` is null if the user hasn't activated an org. RLS policies that depend on org_id will block all data access.

**Mitigation:** Middleware must ensure org activation before any app route is accessed. Use `organizationSyncOptions` to force org activation from the subdomain slug. Also: on first login if no active org, redirect to an "activate your org" step rather than letting the user see broken data.

### Risk 3: Migration Order / tenant_id Consistency

**What:** Future phases adding new tables may forget to include `tenant_id` and RLS. One unprotected table breaks the entire isolation model.

**Mitigation:** Create a Supabase RLS coverage check as part of CI: query `pg_tables` joined against `pg_policies` to assert every table in `public` schema has at least one RLS policy. [ASSUMED: This query is feasible via Supabase's meta-tables; verify the exact pg_catalog query]

### Risk 4: Service Role Key Exposure

**What:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. If accidentally bundled into client-side code (via `NEXT_PUBLIC_` prefix or wrong import path), it's game over.

**Mitigation:** Name it `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix). Keep `supabaseAdmin` client in `/lib/supabase/admin.ts` — never import this file from client components. Add a CI check that no `NEXT_PUBLIC_SUPABASE_SERVICE` variable is set.

### Risk 5: Next.js 15.2.3 CVE Patch Must Be Locked

**What:** CVE-2025-29927 allows middleware bypass. If `package.json` uses `"next": "^15.0.0"` and a patch pulls in a vulnerable sub-15.2.3 version, auth protection fails.

**Mitigation:** Pin exactly: `"next": "15.2.4"` (no caret/tilde). Or use `>=15.2.3` with lock file committed.

---

## Architecture Patterns

### Recommended Project Structure

```
anamnezal/
├── middleware.ts                     # Clerk + subdomain routing
├── vercel.json                       # fra1 region pin
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260501000001_create_tenants.sql
│   │   └── 20260501000002_create_audit_log.sql
│   └── seed.sql                      # test tenants for local dev
├── src/
│   ├── app/
│   │   ├── layout.tsx               # ClerkProvider wrapper
│   │   ├── (auth)/
│   │   │   └── sign-in/page.tsx     # Clerk <SignIn> component
│   │   ├── orgs/
│   │   │   └── [slug]/              # tenant-scoped routes
│   │   │       ├── layout.tsx       # tenant auth guard
│   │   │       └── dashboard/page.tsx
│   │   ├── superadmin/              # superadmin panel
│   │   │   ├── layout.tsx           # superadmin role guard
│   │   │   ├── tenants/page.tsx     # list all orgs
│   │   │   └── tenants/create/page.tsx
│   │   └── api/
│   │       └── webhooks/
│   │           └── clerk/route.ts   # session.created → audit log
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts            # createSupabaseServerClient (Clerk JWT)
│   │   │   └── admin.ts             # supabaseAdmin (service role — server only)
│   │   └── clerk/
│   │       └── roles.ts             # role check helpers
│   └── components/
│       └── ui/                      # shadcn/ui components
```

### System Data Flow

```
Browser (tenant-slug.anamnezal.com)
    │
    ▼
Vercel Edge (fra1)
  middleware.ts
    ├─ Extract slug from hostname
    ├─ Rewrite to /orgs/[slug]/...
    └─ clerkMiddleware → activate org
    │
    ▼
Next.js App Router (fra1 Node.js runtime)
  Server Component
    ├─ auth() → { userId, orgId }
    └─ createSupabaseServerClient()
         └─ passes Clerk JWT as Bearer token
    │
    ▼
Supabase PostgreSQL (eu-central-1 Frankfurt)
  RLS Policy evaluates:
    auth.jwt() ->> 'org_id' = tenant_id in tenants table
    → Tenant-isolated query result
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password reset | Custom email + token system | Clerk built-in | Clerk handles token expiry, email template, security |
| Session management | JWT parsing + cookie management | Clerk + `@clerk/nextjs` | Edge-compatible, Next.js 15 RSC-safe |
| Role checking | Custom role tables + permission logic | Clerk org roles + publicMetadata | Built-in RBAC, available in JWT claims |
| HTTPS | Manual cert management | Vercel (automatic) | Vercel Pro handles wildcard certs |
| Webhook signature verification | Custom HMAC code | `svix` library | Clerk uses Svix; they provide the verification SDK |
| Database migrations | Manual SQL files tracked manually | Supabase CLI | Tracks applied migrations, supports branching |
| Subdomain SSL | Per-subdomain cert provisioning | Vercel wildcard domain | Vercel issues per-subdomain certs automatically |

---

## Common Pitfalls

### Pitfall 1: Using Deprecated Clerk JWT Template
**What goes wrong:** Old tutorials show creating a "supabase" JWT template in Clerk dashboard. This pattern is deprecated April 2025 and no longer works correctly with Supabase's native integration.
**How to avoid:** Use native Third-Party Auth integration in Supabase dashboard. Pass `getToken()` directly via the accessToken function in createClient.
**Warning signs:** Any code that calls `await auth().getToken({ template: 'supabase' })`

### Pitfall 2: org_id Missing in JWT
**What goes wrong:** Supabase RLS policies that use `auth.jwt() ->> 'org_id'` return empty results because the JWT has no org_id claim — user isn't in an active org context.
**How to avoid:** Middleware must activate the org from the subdomain before any DB call. Log JWT claims during development to verify org_id is present.
**Warning signs:** All Supabase queries return 0 rows for authenticated users; no RLS errors thrown (empty result, not 403)

### Pitfall 3: Service Role Key in Client Bundle
**What goes wrong:** SUPABASE_SERVICE_ROLE_KEY accidentally added as NEXT_PUBLIC_ or imported in a Client Component.
**How to avoid:** Never add NEXT_PUBLIC_ prefix. `admin.ts` must only be imported in Server Components, Route Handlers, and Server Actions.
**Warning signs:** `supabaseAdmin` imported in a component with `'use client'` directive

### Pitfall 4: Wildcard Domain Without Vercel Nameservers
**What goes wrong:** Configuring `*.anamnezal.com` via CNAME record fails — Vercel wildcard domains require full nameserver delegation.
**How to avoid:** Delegate `anamnezal.com` nameservers to Vercel. Budget 24–48 hours for propagation.
**Warning signs:** Wildcard subdomain returns "certificate error" or Vercel 404 after DNS change

### Pitfall 5: clerkMiddleware Not at Root
**What goes wrong:** `middleware.ts` placed at `src/middleware.ts` works in some setups but not all. Combined with subdomain rewriting, placement matters.
**How to avoid:** In Next.js 15 with `--src-dir`, place at `src/middleware.ts`. Without src-dir, at root.
**Warning signs:** `auth()` throws "clerkMiddleware not detected" error despite middleware file existing

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Clerk JWT template → Supabase | Native Third-Party Auth in Supabase dashboard | April 1, 2025 | Simpler setup, no shared JWT secret |
| `authMiddleware()` in @clerk/nextjs | `clerkMiddleware()` | @clerk/nextjs v5+ (breaking in v6) | `authMiddleware` removed in v6 |
| `tailwind.config.js` | CSS-native `@theme` in globals.css | Tailwind v4 (2025) | No config file; OKLCH colors |
| shadcn JSON with HSL colors | OKLCH color tokens | shadcn + Tailwind v4 integration (2025) | Better color interpolation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Clerk provides a Backend API endpoint to add subdomains to allowlist programmatically | §4 Subdomain Routing | Superadmin "create tenant" flow requires manual Clerk dashboard step — workflow broken |
| A2 | `session.created` is the correct Clerk webhook event for login detection (not `user.signed_in`) | §5 Audit Log | Wrong event = audit log doesn't fire, or fires at wrong time |
| A3 | lvh.me resolves all subdomains to 127.0.0.1 and works for Windows local dev | §4 Local Dev | Local subdomain testing fails; need alternative approach |
| A4 | Application-layer encryption of TC kimlik is required by KVKK Article 6 | §8 KVKK | Either over-engineering (wasted effort) or legal gap (regulatory risk) |
| A5 | pg_catalog tables can be queried via Supabase to assert RLS coverage in CI | §Key Risks | CI RLS coverage check not feasible via this approach |

**If table is not empty:** Confirm A1, A2, A3 before finalizing the plan.

---

## Open Questions

1. **Clerk subdomain allowlist API**: Does Clerk expose a Backend API to add entries to the subdomain allowlist when a new tenant is created? If not, superadmin tenant creation requires a separate manual Clerk dashboard step.
   - What we know: The allowlist exists and can be managed in Clerk dashboard
   - What's unclear: Whether it's scriptable via clerkClient
   - Recommendation: Check Clerk API reference for subdomain allowlist management endpoint before planning the "create tenant" task

2. **Supabase Pro plan confirmation**: The KVKK DPA is only available on Supabase Pro plan. Is the project starting on Pro, or on the free plan (no DPA = no real patient data)?
   - Recommendation: Planner should include a "provision Supabase Pro project in eu-central-1" task as Wave 0

3. **Clerk organization slug format**: Slugs are auto-generated by Clerk or manually set? For `istanbul-uni.anamnezal.com`, the superadmin needs to control the slug value at org creation time.
   - What we know: Clerk allows setting slug in `createOrganization({ name, slug })`
   - Recommendation: Confirmed — slug can be set explicitly via Backend API

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime, Supabase CLI | ✓ | v22.15.0 | — |
| Docker | `supabase start` local dev | ✓ | 29.1.2 | Use remote Supabase dev branch |
| Supabase CLI | Migrations, local dev | ✓ | 2.98.0 | Direct SQL via dashboard |
| Clerk account | Auth provider | Not verified | — | — |
| Supabase project (Frankfurt) | Database | Not verified | — | Must create in eu-central-1 |
| Vercel Pro | fra1 functions, wildcard domain | Not verified | — | Can develop without; required for prod |

**Missing dependencies with no fallback:**
- Clerk account with Organizations enabled (must create before Wave 1)
- Supabase project in eu-central-1 (must create before Wave 1)

**Missing dependencies with fallback:**
- Vercel Pro: local dev works without it; required before any subdomain testing or production

---

## Sources

### Primary (HIGH confidence)

- `clerk.com/docs/reference/nextjs/clerk-middleware` — clerkMiddleware, organizationSyncOptions
- `clerk.com/docs/guides/organizations/org-slugs-in-urls` — org slug in URL patterns
- `clerk.com/changelog/2025-03-31-supabase-integration` — new native Supabase integration
- `clerk.com/docs/guides/development/integrations/databases/supabase` — Clerk+Supabase setup
- `clerk.com/docs/guides/secure/basic-rbac` — publicMetadata superadmin pattern
- `clerk.com/blog/cve-2025-29927` — CVE-2025-29927 impact on Clerk
- `supabase.com/docs/guides/auth/third-party/clerk` — native Supabase+Clerk integration
- `supabase.com/docs/guides/database/postgres/row-level-security` — RLS patterns
- `supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv` — RLS index patterns
- `supabase.com/docs/guides/local-development/overview` — CLI migration workflow
- `ui.shadcn.com/docs/tailwind-v4` — shadcn Tailwind v4 support
- `ui.shadcn.com/docs/installation/next` — Next.js install
- `vercel.com/blog/wildcard-domains` — Vercel wildcard domain requirements
- `clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist` — subdomain security
- npm registry (2026-05-01): next@15.2.4, @clerk/nextjs@7.3.0, @supabase/ssr@0.10.2, supabase@2.98.0

### Secondary (MEDIUM confidence)

- `makerkit.dev/blog/tutorials/supabase-rls-best-practices` — RLS production patterns
- `clerk.com/blog/how-clerk-integrates-with-supabase-auth` — integration walkthrough
- `vercel.com/templates/next.js/hostname-rewrites` — hostname rewrite middleware pattern

### Tertiary (LOW confidence)

- Various Medium articles on subdomain routing patterns (cross-referenced with Vercel official template)

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Clerk Next.js 15 integration | HIGH | Official docs verified, CVE confirmed |
| Supabase native Clerk integration | HIGH | Official changelog + Supabase docs verified |
| RLS patterns | HIGH | Official Supabase docs + multiple sources |
| Subdomain routing | MEDIUM-HIGH | Pattern verified; Clerk subdomain allowlist API unclear (A1) |
| Superadmin architecture | HIGH | publicMetadata pattern well-documented |
| KVKK controls | MEDIUM | Technical layer HIGH; legal interpretation ASSUMED for TC kimlik |
| shadcn/ui + Tailwind v4 | HIGH | Official shadcn docs verified |
| Audit log | MEDIUM | Webhook event name (A2) unverified |
| Vercel wildcard | HIGH | Official Vercel docs verified |
| Package versions | HIGH | Verified against npm registry 2026-05-01 |

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (Clerk and Supabase integration patterns may shift; recheck if planning takes >30 days)
