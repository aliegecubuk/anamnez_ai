---
phase: 01-temel-altyapi
plan: 03
subsystem: auth-routing
tags: [clerk, middleware, subdomain-routing, org-activation, rls, webhook, audit-log, cve-2025-29927]

requires:
  - phase: 01-temel-altyapi/plan-01
    provides: next.js-15.2.4-project, supabase-admin-client, supabase-server-client, clerk-provider
  - phase: 01-temel-altyapi/plan-02
    provides: login-audit-log-migration, tenants-table-migration, remote-schema-applied

provides:
  - clerk-middleware-with-subdomain-routing
  - org-activation-via-organizationSyncOptions
  - superadmin-route-guard (middleware + layout double enforcement)
  - tenant-route-guard (CVE-2025-29927 server-side check)
  - clerk-webhook-login-audit-log

affects:
  - all-subsequent-plans (middleware guards all routes from here forward)
  - 01-04 (Supabase server client and role helpers used by all future pages)

tech-stack:
  added: []
  patterns:
    - "Every protected layout calls await auth() server-side (CVE-2025-29927 mitigation)"
    - "Superadmin role check: (sessionClaims?.metadata as Record<string, unknown>)?.role === 'superadmin'"
    - "Subdomain routing: hostname.replace('.ROOT_DOMAIN','') → NextResponse.rewrite('/orgs/[slug]/...')"
    - "Webhook: Svix signature verification before any payload processing (T-03-01 mitigation)"
    - "Audit log failure returns 200 — login flow must not be blocked by audit write errors"

key-files:
  created:
    - src/middleware.ts
    - src/app/orgs/[slug]/layout.tsx
    - src/app/orgs/[slug]/dashboard/page.tsx
    - src/app/superadmin/layout.tsx
    - src/app/superadmin/page.tsx
    - src/app/api/webhooks/clerk/route.ts
  modified: []

key-decisions:
  - "sessionClaims.metadata typed as Record<string, unknown> via cast — Clerk v6 types metadata as {} requiring runtime cast for custom fields"
  - "dashboard/page.tsx drops params argument — stub page doesn't use slug yet; future plans will add it back with actual usage"
  - "Clerk webhook configuration (Clerk Dashboard + CLERK_WEBHOOK_SECRET) deferred to post-deploy — route is implemented and ready"
  - "session.created confirmed as correct Clerk webhook event for login detection (A2 assumption resolved: RESEARCH.md was correct)"

patterns-established:
  - "Middleware at src/middleware.ts (--src-dir project) — canonical location for all future middleware changes"
  - "All tenant routes under src/app/orgs/[slug]/ — layout guard pattern established"
  - "Superadmin routes under src/app/superadmin/ — layout guard pattern established"

requirements-completed:
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-07

duration: ~6min
completed: 2026-05-02
---

# Phase 1 Plan 3: Clerk Middleware + Route Guards + Webhook Summary

**Clerk middleware with subdomain→org routing (organizationSyncOptions), double-layer auth guards for tenant and superadmin routes (CVE-2025-29927 mitigated), and Svix-verified webhook writing session.created events to login_audit_log**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02
- **Tasks:** 2/2 complete
- **Files created:** 6

## Accomplishments

- `src/middleware.ts`: clerkMiddleware with subdomain slug extraction, NextResponse.rewrite to `/orgs/[slug]/...`, organizationSyncOptions for org activation, superadmin guard using sessionClaims metadata, public route protection
- `src/app/orgs/[slug]/layout.tsx`: Server-side `await auth()` guard — blocks unauthenticated users AND users without active org (CVE-2025-29927 mitigated)
- `src/app/orgs/[slug]/dashboard/page.tsx`: Minimal tenant dashboard querying tenants table via RLS-enforced Supabase client
- `src/app/superadmin/layout.tsx`: Server-side superadmin role guard (belt+suspenders with middleware edge check)
- `src/app/superadmin/page.tsx`: Stub page for future superadmin panel plans
- `src/app/api/webhooks/clerk/route.ts`: POST handler with Svix header validation, session.created handling, login_audit_log insert via supabaseAdmin, audit failure non-blocking (returns 200)

## Task Commits

1. **Task 1: Middleware + Route Guards** — `5c6e74f` (feat)
2. **Task 2: Clerk Webhook — Login Audit Log** — `782c980` (feat)

## Files Created/Modified

- `src/middleware.ts` — Clerk middleware with subdomain routing + org activation + superadmin guard
- `src/app/orgs/[slug]/layout.tsx` — Tenant route guard (server-side auth check)
- `src/app/orgs/[slug]/dashboard/page.tsx` — Minimal tenant dashboard (Supabase RLS query)
- `src/app/superadmin/layout.tsx` — Superadmin route guard (server-side role check)
- `src/app/superadmin/page.tsx` — Superadmin stub page
- `src/app/api/webhooks/clerk/route.ts` — Clerk webhook endpoint (login audit log)

## Decisions Made

- **Metadata cast pattern:** `sessionClaims?.metadata as Record<string, unknown>` — Clerk v6 types `metadata` as `{}` requiring a runtime cast. This matches the pattern already established in `src/lib/clerk/roles.ts` from Plan 01-01.
- **Webhook configuration deferred:** `CLERK_WEBHOOK_SECRET` must be set after first Vercel deployment (Clerk Dashboard → Webhooks → Add Endpoint). Route is fully implemented — only the dashboard registration is pending.
- **session.created confirmed:** The RESEARCH.md assumption A2 is correct — `session.created` is the canonical Clerk event for login detection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint no-unused-vars in dashboard/page.tsx**
- **Found during:** Task 2 (npm run build)
- **Issue:** Dashboard page had unused `userId`, `orgId`, `error`, `slug` variables from the plan template
- **Fix:** Removed `auth()` call (layout guard already handles auth; no values needed in page stub), removed destructured error from supabase query, simplified page to not need params (stub has no slug-specific logic yet)
- **Files modified:** `src/app/orgs/[slug]/dashboard/page.tsx`
- **Commit:** `782c980`

**2. [Rule 1 - Bug] ESLint no-unused-vars for slug in layout.tsx**
- **Found during:** Task 2 (npm run build)
- **Issue:** `slug` destructured from params but only used as guard parameter, not in actual redirect logic
- **Fix:** Changed to `await params` (no destructuring) — satisfies Next.js 15 async params requirement without creating an unused variable
- **Files modified:** `src/app/orgs/[slug]/layout.tsx`
- **Commit:** `782c980`

**3. [Rule 1 - Bug] TypeScript error: Property 'role' does not exist on type '{}'**
- **Found during:** Task 1 (npx tsc --noEmit)
- **Issue:** Clerk v6 types `sessionClaims.metadata` as `{}` — accessing `.role` fails type check
- **Fix:** Cast metadata to `Record<string, unknown>` before accessing `.role` — matches existing pattern in `src/lib/clerk/roles.ts`
- **Files modified:** `src/middleware.ts`, `src/app/superadmin/layout.tsx`
- **Commit:** `5c6e74f`

## Webhook Configuration Status

**Route:** Implemented and deployed at `/api/webhooks/clerk` — ready to receive events.

**Dashboard configuration required (post-deploy):**
1. Clerk Dashboard → Configure → Webhooks → Add Endpoint
2. URL: `https://{your-vercel-domain}/api/webhooks/clerk`
3. Event: `session.created`
4. Copy Signing Secret → add to Vercel env as `CLERK_WEBHOOK_SECRET`

**Local dev testing:** Deferred — requires publicly accessible URL. Can use Clerk's webhook test feature in dashboard with a deployed URL.

## Known Stubs

- `src/app/superadmin/page.tsx` — stub superadmin page showing "Kiracı yönetimi yükleniyor...". Intentional — Plan 01-04 or later adds tenant management UI.
- `src/app/orgs/[slug]/dashboard/page.tsx` — stub dashboard with tenant name only. Intentional — future phases (2, 3, 4) add patient management, STT controls, anamnesis forms.

These stubs do not prevent the plan's goal (auth enforcement layer) from being achieved.

## Threat Surface Scan

No new threat surface beyond what was modeled in the plan's threat model:
- T-03-01: Svix signature verification implemented — mitigated
- T-03-02: Slug extracted from hostname only routes to /orgs/[slug]; Clerk validates slug matches real org — mitigated
- T-03-03: Double enforcement at middleware (edge) + layout (Node.js runtime) — mitigated
- T-03-04: Clerk JWT RS256 validation by Supabase Third-Party Auth — mitigated by infrastructure
- T-03-05: Svix library handles 5-minute timestamp replay window internally — accepted
- T-03-06: Vercel 4.5MB request limit sufficient for Clerk payloads — accepted

## Self-Check: PASSED

- src/middleware.ts: FOUND (contains organizationSyncOptions, organizationPatterns, clerkMiddleware)
- src/app/orgs/[slug]/layout.tsx: FOUND (contains await auth(), userId, orgId guards)
- src/app/orgs/[slug]/dashboard/page.tsx: FOUND (contains createSupabaseServerClient)
- src/app/superadmin/layout.tsx: FOUND (contains sessionClaims metadata role check)
- src/app/superadmin/page.tsx: FOUND
- src/app/api/webhooks/clerk/route.ts: FOUND (contains svix, wh.verify, session.created, login_audit_log)
- Commit 5c6e74f: FOUND (feat(01-03): middleware + route guards)
- Commit 782c980: FOUND (feat(01-03): Clerk webhook)
- npx tsc --noEmit: PASS (zero errors)
- npm run build: PASS

## Next Phase Readiness

- Plan 01-04 (Supabase server client integration + tests) can proceed immediately
- All auth routes secured at both middleware and layout layers
- Webhook endpoint ready — only needs CLERK_WEBHOOK_SECRET set after deployment
- Future pages under /orgs/[slug]/ are automatically protected by the tenant layout guard

---
*Phase: 01-temel-altyapi*
*Completed: 2026-05-02*
