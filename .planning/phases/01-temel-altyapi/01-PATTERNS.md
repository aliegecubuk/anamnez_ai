# Phase 1: Temel Altyapı — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 18 (all new — greenfield project)
**Analogs found:** 0 / 18 — no application code exists yet

---

## Greenfield Notice

This is a greenfield project. No existing application code exists to draw analogs from. All patterns below are sourced from:
- Official library documentation (cited in RESEARCH.md)
- RESEARCH.md code examples (verified against official docs)
- Next.js 15 App Router conventions

Every pattern established here becomes the canonical baseline for all future phases.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/middleware.ts` | middleware | request-response | none (greenfield) | — |
| `vercel.json` | config | — | none | — |
| `src/app/layout.tsx` | provider | request-response | none | — |
| `src/app/(auth)/sign-in/page.tsx` | component | request-response | none | — |
| `src/app/orgs/[slug]/layout.tsx` | middleware/guard | request-response | none | — |
| `src/app/orgs/[slug]/dashboard/page.tsx` | component | request-response | none | — |
| `src/app/superadmin/layout.tsx` | middleware/guard | request-response | none | — |
| `src/app/superadmin/tenants/page.tsx` | component | CRUD | none | — |
| `src/app/superadmin/tenants/create/page.tsx` | component | CRUD | none | — |
| `src/app/api/webhooks/clerk/route.ts` | route | event-driven | none | — |
| `src/lib/supabase/server.ts` | utility | request-response | none | — |
| `src/lib/supabase/admin.ts` | utility | CRUD | none | — |
| `src/lib/clerk/roles.ts` | utility | request-response | none | — |
| `supabase/migrations/20260501000001_create_tenants.sql` | migration | CRUD | none | — |
| `supabase/migrations/20260501000002_create_audit_log.sql` | migration | CRUD | none | — |
| `supabase/seed.sql` | config | CRUD | none | — |
| `src/lib/__tests__/rls.test.ts` | test | CRUD | none | — |
| `src/lib/__tests__/auth.test.ts` | test | request-response | none | — |

---

## Pattern Assignments

### `src/middleware.ts` (middleware, request-response)

**Source:** RESEARCH.md §1 + §4 (Clerk + subdomain routing)

**Full pattern:**
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'anamnezal.com'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])
const isSuperadminRoute = createRouteMatcher(['/superadmin(.*)'])

export default clerkMiddleware(
  async (auth, req) => {
    const url = req.nextUrl
    const hostname = req.headers.get('host') || ''

    // Extract tenant slug from subdomain
    const slug = hostname
      .replace(`.${ROOT_DOMAIN}`, '')
      .replace(`:3000`, '')
    const isTenantSubdomain = slug !== ROOT_DOMAIN && slug !== 'www' && slug !== ''

    if (isTenantSubdomain) {
      // Rewrite to /orgs/[slug]/... so organizationSyncOptions activates the org
      const newPath = `/orgs/${slug}${url.pathname}`
      const rewriteUrl = new URL(newPath, req.url)
      rewriteUrl.search = url.search
      return NextResponse.rewrite(rewriteUrl)
    }

    // Superadmin route protection — check publicMetadata.role
    if (isSuperadminRoute(req)) {
      const { sessionClaims } = await auth()
      if (sessionClaims?.metadata?.role !== 'superadmin') {
        return NextResponse.redirect(new URL('/sign-in', req.url))
      }
    }

    if (!isPublicRoute(req)) {
      await auth.protect()
    }
  },
  {
    organizationSyncOptions: {
      organizationPatterns: ['/orgs/:slug', '/orgs/:slug/(.*)'],
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

**Key constraints:**
- File lives at `src/middleware.ts` (because project uses `--src-dir`)
- Uses `clerkMiddleware()` NOT `authMiddleware()` (removed in @clerk/nextjs v6+)
- Must pin `next@15.2.4` (CVE-2025-29927 — versions <15.2.3 allow middleware bypass)
- `organizationSyncOptions` handles org activation from URL slug

---

### `vercel.json` (config)

**Source:** RESEARCH.md §8 KVKK Controls

**Full pattern:**
```json
{
  "regions": ["fra1"],
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  }
}
```

**Key constraint:** `fra1` region pin is mandatory for KVKK data residency (D-05). Must be committed before any deployment.

---

### `src/app/layout.tsx` (provider, request-response)

**Source:** RESEARCH.md §1 Clerk + Next.js 15 Integration

**Full pattern:**
```typescript
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AnamnezAl',
  description: 'Hands-free dental anamnesis',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="tr">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

**Key constraint:** `<ClerkProvider>` wraps the entire tree. `lang="tr"` for Turkish locale.

---

### `src/app/(auth)/sign-in/page.tsx` (component, request-response)

**Source:** RESEARCH.md §1 Key APIs

**Full pattern:**
```typescript
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  )
}
```

**Key constraint:** Design delegated to frontend-design agent (D-04). This is the minimal shell — UI agent fills in design tokens.

---

### `src/app/orgs/[slug]/layout.tsx` (middleware/guard, request-response)

**Source:** RESEARCH.md §1 CVE-2025-29927 Mitigation

**Full pattern:**
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  // Server-side auth check — do NOT rely solely on middleware (CVE-2025-29927)
  const { userId, orgId } = await auth()
  const { slug } = await params

  if (!userId) {
    redirect(`/sign-in`)
  }

  if (!orgId) {
    // User authenticated but no active org — org activation failed
    redirect(`/sign-in?error=no_org`)
  }

  return <>{children}</>
}
```

**Key constraint:** Every protected layout MUST call `auth()` server-side. Middleware redirect alone is insufficient (CVE-2025-29927).

---

### `src/app/orgs/[slug]/dashboard/page.tsx` (component, request-response)

**Source:** RESEARCH.md §1 Key APIs + Architecture Patterns

**Full pattern:**
```typescript
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { userId, orgId, orgSlug } = await auth()
  const { slug } = await params

  // Supabase query with RLS enforcement (org_id from JWT)
  const supabase = await createSupabaseServerClient()
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('name')
    .single()

  return (
    <main>
      <h1>Hoş geldiniz — {tenantData?.name}</h1>
    </main>
  )
}
```

---

### `src/app/superadmin/layout.tsx` (middleware/guard, request-response)

**Source:** RESEARCH.md §6 Superadmin Architecture

**Full pattern:**
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionClaims } = await auth()

  // Server-side superadmin role check (belt + suspenders with middleware)
  if (sessionClaims?.metadata?.role !== 'superadmin') {
    redirect('/sign-in')
  }

  return <>{children}</>
}
```

**Key constraint:** `sessionClaims.metadata.role` requires Clerk Dashboard → Sessions → Customize session token to include `{ "metadata": "{{user.public_metadata}}" }`.

---

### `src/app/superadmin/tenants/page.tsx` (component, CRUD)

**Source:** RESEARCH.md §6 Superadmin Panel Capabilities

**Full pattern:**
```typescript
import { clerkClient } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function TenantsPage() {
  const client = await clerkClient()
  const { data: orgs } = await client.organizations.getOrganizationList({ limit: 100 })

  // Cross-reference with tenants table for local metadata
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main>
      <h1>Tüm Tenantlar</h1>
      {/* Tenant list UI — delegated to frontend-design agent */}
    </main>
  )
}
```

---

### `src/app/superadmin/tenants/create/page.tsx` (component, CRUD)

**Source:** RESEARCH.md §6 Superadmin Panel Capabilities

**Core action pattern (Server Action):**
```typescript
'use server'
import { clerkClient } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),  // subdomain-safe
})

export async function createTenant(formData: FormData) {
  const parsed = CreateTenantSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
  })

  // 1. Create Clerk org
  const client = await clerkClient()
  const org = await client.organizations.createOrganization({
    name: parsed.name,
    slug: parsed.slug,
  })

  // 2. Insert into tenants table
  await supabaseAdmin.from('tenants').insert({
    clerk_org_id: org.id,
    slug: parsed.slug,
    name: parsed.name,
  })

  // 3. TODO: Add slug to Clerk subdomain allowlist (A1 — verify API exists)
}
```

---

### `src/app/api/webhooks/clerk/route.ts` (route, event-driven)

**Source:** RESEARCH.md §5 Login Audit Log

**Full pattern:**
```typescript
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
    evt = wh.verify(body, {
      'svix-id': svix_id!,
      'svix-timestamp': svix_timestamp!,
      'svix-signature': svix_signature!,
    })
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

**Key constraint:** Uses `svix` library for signature verification — do NOT hand-roll HMAC (D-07).

---

### `src/lib/supabase/server.ts` (utility, request-response)

**Source:** RESEARCH.md §2 Current Pattern (post-April 2025)

**Full pattern:**
```typescript
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
          const clerkToken = await getToken()  // no template: undefined needed
          const headers = new Headers(options?.headers)
          headers.set('Authorization', `Bearer ${clerkToken}`)
          return fetch(url, { ...options, headers })
        },
      },
    }
  )
}
```

**Critical:** Do NOT use `{ template: 'supabase' }` in `getToken()` — deprecated April 1, 2025. Use native Supabase Third-Party Auth.

---

### `src/lib/supabase/admin.ts` (utility, CRUD)

**Source:** RESEARCH.md §3 Service Role for Superadmin

**Full pattern:**
```typescript
import { createClient } from '@supabase/supabase-js'

// NEVER import this file from client components or pages with 'use client'
// ONLY use in: Server Components, Route Handlers, Server Actions
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
```

**Key constraint:** `SUPABASE_SERVICE_ROLE_KEY` has NO `NEXT_PUBLIC_` prefix — never expose to client bundle.

---

### `src/lib/clerk/roles.ts` (utility, request-response)

**Source:** RESEARCH.md §6 Superadmin Architecture

**Full pattern:**
```typescript
import { auth } from '@clerk/nextjs/server'

export type AppRole = 'superadmin' | 'org:admin' | 'org:dentist' | 'org:assistant'

export async function getRole(): Promise<AppRole | null> {
  const { sessionClaims, orgRole } = await auth()
  
  // Superadmin overrides org role
  if (sessionClaims?.metadata?.role === 'superadmin') {
    return 'superadmin'
  }
  
  // Clerk org roles (custom roles configured in Clerk dashboard)
  if (orgRole) {
    return orgRole as AppRole
  }
  
  return null
}

export async function requireSuperadmin() {
  const role = await getRole()
  if (role !== 'superadmin') {
    throw new Error('Unauthorized: superadmin required')
  }
}

export async function requireOrgRole(allowedRoles: AppRole[]) {
  const role = await getRole()
  if (!role || !allowedRoles.includes(role)) {
    throw new Error('Unauthorized: insufficient role')
  }
}
```

---

### `supabase/migrations/20260501000001_create_tenants.sql` (migration, CRUD)

**Source:** RESEARCH.md §3 Core RLS Pattern

**Full pattern:**
```sql
-- Phase 1 foundation: tenants table
-- Every subsequent table references tenant_id → this table
CREATE TABLE public.tenants (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id text        UNIQUE NOT NULL,  -- Clerk org_id (e.g., "org_abc123")
  slug         text        UNIQUE NOT NULL,  -- subdomain slug (e.g., "istanbul-uni")
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- No user-facing RLS policies — managed by superadmin via service role only
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Index used in every RLS subquery across all future tables
CREATE INDEX ON public.tenants (clerk_org_id);

-- RLS TEMPLATE for all future tables:
-- ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_isolation" ON public.{table}
--   FOR ALL
--   USING (
--     tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
--   )
--   WITH CHECK (
--     tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
--   );
```

---

### `supabase/migrations/20260501000002_create_audit_log.sql` (migration, CRUD)

**Source:** RESEARCH.md §5 Audit Log Table

**Full pattern:**
```sql
-- Login audit log (D-07) — cannot be retrofitted post-launch
CREATE TABLE public.login_audit_log (
  id           bigserial   PRIMARY KEY,
  user_id      text        NOT NULL,   -- Clerk user_id
  session_id   text        NOT NULL,   -- Clerk session_id
  clerk_org_id text,                   -- null if personal account login
  ip_address   text,
  user_agent   text,
  logged_in_at timestamptz NOT NULL DEFAULT now()
);

-- RLS enabled but no user-facing read policy — only service_role can read/write
ALTER TABLE public.login_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.login_audit_log (clerk_org_id);
CREATE INDEX ON public.login_audit_log (logged_in_at DESC);
```

---

### `supabase/seed.sql` (config, CRUD)

**Source:** RESEARCH.md §7 Greenfield Setup Workflow

**Full pattern:**
```sql
-- Test tenants for local dev only
-- Applied by `supabase db reset`
INSERT INTO public.tenants (clerk_org_id, slug, name)
VALUES
  ('org_test_tenant_a', 'test-tenant-a', 'Test Üniversitesi A'),
  ('org_test_tenant_b', 'test-tenant-b', 'Test Üniversitesi B');
```

---

### `src/lib/__tests__/rls.test.ts` (test, CRUD)

**Source:** RESEARCH.md §10 RLS Verification

**Full pattern:**
```typescript
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

describe('RLS tenant isolation (AUTH-07)', () => {
  it('Tenant A cannot read Tenant B rows', async () => {
    // Client authenticated as org_tenant_a (JWT from test fixture)
    const clientA = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwtForTenantA}` } }
    })

    const { data, error } = await clientA
      .from('patients')          // Phase 2 table — test structure only in Phase 1
      .select('*')
      .eq('tenant_id', tenantBId)

    expect(data).toHaveLength(0)  // RLS returns empty, not error
    expect(error).toBeNull()
  })
})
```

---

### `src/lib/__tests__/auth.test.ts` (test, request-response)

**Source:** RESEARCH.md §10 Phase 1 Requirements Test Map

**Skeleton pattern:**
```typescript
import { describe, it, expect } from 'vitest'
// AUTH-03: Role checking logic unit tests
// Mock auth() return values; verify getRole() and requireOrgRole() behavior
describe('Role helpers (AUTH-03)', () => {
  it('superadmin role returns "superadmin"', async () => { /* ... */ })
  it('org:admin cannot access superadmin routes', async () => { /* ... */ })
})
```

---

## Shared Patterns

### Authentication Guard (Server-Side)
**Apply to:** All layout files, all Server Components that query Supabase

```typescript
// Every protected layout must do this (CVE-2025-29927 mitigation)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const { userId, orgId } = await auth()
if (!userId) redirect('/sign-in')
```

### Supabase Admin Client Usage
**Apply to:** `superadmin/**` pages, `api/webhooks/clerk/route.ts`

- Import from `@/lib/supabase/admin` only in Server Components / Route Handlers / Server Actions
- Never import in files with `'use client'` directive
- The key is `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix)

### RLS Policy Template
**Apply to:** Every migration file that creates a user-facing table (Phases 2+)

```sql
ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.{table_name}
  FOR ALL
  USING (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    tenant_id = (SELECT id FROM public.tenants WHERE clerk_org_id = auth.jwt() ->> 'org_id')
  );

CREATE INDEX ON public.{table_name} (tenant_id);
```

### Zod Validation
**Apply to:** All Server Actions that accept user input (superadmin create tenant, future CRUD)

```typescript
import { z } from 'zod'
const Schema = z.object({ ... })
const parsed = Schema.parse(formData)  // throws ZodError on invalid input
```

### Environment Variable Conventions
**Apply to:** All lib files

| Variable | Prefix | Accessible |
|----------|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_` | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_` | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | none | Server only |
| `CLERK_SECRET_KEY` | none | Server only |
| `CLERK_WEBHOOK_SECRET` | none | Server only |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `NEXT_PUBLIC_` | Client + Server |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `NEXT_PUBLIC_` | Client + Server |

---

## No Analog Found

All files have no codebase analog (greenfield). Planner must use RESEARCH.md patterns exclusively.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| All 18 files | various | various | Greenfield project — no application code exists |

---

## Critical Implementation Notes for Planner

1. **CVE-2025-29927:** Pin `"next": "15.2.4"` exactly in `package.json` (no caret/tilde). Every protected layout calls `auth()` server-side.

2. **Supabase integration:** Use native Third-Party Auth (Supabase Dashboard → Auth → Third Party Auth → Clerk). Do NOT create a Clerk JWT template for Supabase — that pattern is deprecated April 1, 2025.

3. **Middleware placement:** With `--src-dir`, middleware lives at `src/middleware.ts`.

4. **Clerk session token customization:** Add `{ "metadata": "{{user.public_metadata}}" }` in Clerk Dashboard → Sessions → Customize session token — required for superadmin role check in middleware without extra API call.

5. **Frankfurt first:** Supabase project must be created in `eu-central-1` before any migration is run. Cannot be changed after creation.

6. **Local dev subdomains (Windows):** Use `lvh.me` — e.g., `istanbul-uni.lvh.me:3000`. Set `NEXT_PUBLIC_ROOT_DOMAIN=lvh.me` in `.env.local`.

7. **Assumption A1 (Clerk subdomain allowlist API):** The "create tenant" Server Action includes a TODO for adding the slug to Clerk's subdomain allowlist. Planner should flag this as a verification step before implementing that action.

8. **Assumption A2 (webhook event name):** `session.created` is the assumed event for login detection. Planner should verify this in Clerk Dashboard → Webhooks → Event catalog before implementation.

---

## Metadata

**Analog search scope:** No application source exists — greenfield
**Files scanned:** 0 application files
**Pattern sources:** RESEARCH.md (verified official docs), CONTEXT.md decisions
**Pattern extraction date:** 2026-05-01
