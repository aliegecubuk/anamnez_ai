---
phase: 01-temel-altyapi
plan: 04
subsystem: auth-ui
tags: [clerk, sign-in, password-reset, turkish-ui, shadcn, next-auth-routing]

requires:
  - phase: 01-temel-altyapi/plan-01
    provides: next.js-15.2.4-project, shadcn-components, clerk-provider, inter-font
  - phase: 01-temel-altyapi/plan-03
    provides: clerk-middleware-with-subdomain-routing, org-activation

provides:
  - login-page-at-sign-in (Turkish copy, shadcn Card, Clerk useSignIn)
  - password-reset-2-step-flow (email form → confirmation, reset_password_email_code)
  - auth-layout (full-viewport centered, bg-background)
  - root-redirect (unauthenticated → /sign-in, superadmin → /superadmin)

affects:
  - all-subsequent-plans (login is entry point for every user flow)
  - 02-hasta-yonetimi (dentists must be able to log in before accessing patients)

tech-stack:
  added: []
  patterns:
    - "Clerk useSignIn() hook for client-side login — returns signIn.create() method"
    - "Clerk error codes: form_identifier_not_found, form_password_incorrect for specific Turkish messages"
    - "Password reset via signIn.create({ strategy: 'reset_password_email_code', identifier })"
    - "Auth layout at src/app/(auth)/layout.tsx — all auth pages inherit centered background"
    - "CardFooter border suppressed via border-t-0 bg-transparent for login/reset pages"

key-files:
  created:
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/sign-in/page.tsx
    - src/app/(auth)/reset-password/page.tsx
  modified:
    - src/app/page.tsx

key-decisions:
  - "reset_password_email_code confirmed as correct Clerk strategy for password reset — Clerk sends email with code, not link"
  - "CardFooter border suppressed — default shadcn CardFooter has border-t + muted bg, inappropriate for login page aesthetics"
  - "Root page replaces Next.js scaffold — now server component with Clerk auth() redirect logic"

patterns-established:
  - "Auth route group at src/app/(auth)/ — all unauthenticated pages live here"
  - "Client components for Clerk hooks — any page using useSignIn/useSignUp must be 'use client'"

requirements-completed:
  - AUTH-04
  - AUTH-05
  - AUTH-06

duration: ~2min
completed: 2026-05-02
---

# Phase 1 Plan 4: Login UI + Password Reset Summary

**Clerk-powered login page with Turkish copy, shadcn Card, password show/hide toggle, and 2-step password reset flow using reset_password_email_code strategy**

## Performance

- **Duration:** ~2 minutes
- **Started:** 2026-05-02T04:57:28Z
- **Completed:** 2026-05-02T04:59:42Z
- **Tasks:** 2/2 complete
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- `src/app/(auth)/layout.tsx`: Full-viewport centered layout — `flex min-h-screen items-center justify-center bg-background px-4`. Includes `metadata.title: 'AnamnezAl'` (KVKK T-04-03 mitigation).
- `src/app/(auth)/sign-in/page.tsx`: Login card (w-[400px]) with Clerk `useSignIn`, email/password form, password show/hide toggle (Eye/EyeOff lucide icons, 44px touch target), inline Turkish error messages with `role="alert"`, no sign-up link (D-01), no remember-me (D-09).
- `src/app/(auth)/reset-password/page.tsx`: 2-step flow — step 1 email form + "Sıfırlama bağlantısı gönder", step 2 confirmation "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.", `isSent` state toggle.
- `src/app/page.tsx`: Replaced Next.js scaffold with server-side Clerk `auth()` redirect — unauthenticated → /sign-in, superadmin → /superadmin.

## Task Commits

1. **Task 1: Login Page + Auth Layout** — `a1f0526` (feat)
2. **Task 2: Password Reset Flow** — `2cd1240` (feat)

## Files Created/Modified

- `src/app/(auth)/layout.tsx` — Auth layout with KVKK-safe title metadata
- `src/app/(auth)/sign-in/page.tsx` — Login card with Clerk useSignIn, Turkish UI, error states
- `src/app/(auth)/reset-password/page.tsx` — 2-step password reset with Clerk reset_password_email_code
- `src/app/page.tsx` — Root redirect (unauthenticated → /sign-in, superadmin → /superadmin)

## Decisions Made

- **reset_password_email_code strategy:** Clerk's `signIn.create({ strategy: 'reset_password_email_code', identifier })` sends a code to the email. Clerk's hosted page handles the actual password change after code verification. This matches the plan's "Step 3: Clerk-hosted page handles the actual reset" — no custom code-entry UI needed.
- **CardFooter border suppressed:** Default shadcn CardFooter applies `border-t bg-muted/50` which creates visual noise on the login card footer. Overrode with `border-t-0 bg-transparent` to keep the "Şifremi unuttum" link clean.
- **Metadata in auth layout:** Added `export const metadata` to `(auth)/layout.tsx` with `title: 'AnamnezAl'` — satisfies T-04-03 (no tenant/patient data in browser history page titles).

## Deviations from Plan

None — plan executed exactly as written. The only minor note: the plan's code template used `<CardFooter className="justify-center pt-0">` — adjusted to also suppress `border-t` and `bg-muted/50` from the shadcn base (which differ from @radix-ui defaults in the base-nova style). This is cosmetic and within the plan's design intent.

## Threat Surface Scan

No new threat surface beyond what was modeled in the plan's threat model:
- T-04-01: Error message enumeration — accepted (dental B2B with admin-controlled accounts)
- T-04-02: No analytics imports in (auth)/ — verified via grep, NONE found
- T-04-03: `metadata.title: 'AnamnezAl'` in auth layout — mitigated
- T-04-04: Password show/hide toggle — accepted (personal devices confirmed per D-08)

## Self-Check: PASSED

- src/app/(auth)/layout.tsx: FOUND (contains `flex min-h-screen items-center justify-center`)
- src/app/(auth)/sign-in/page.tsx: FOUND (contains `'use client'`, `useSignIn`, `Giriş Yap`, `w-[400px]`, `role="alert"`)
- src/app/(auth)/reset-password/page.tsx: FOUND (contains `reset_password_email_code`, `isSent`, `Sıfırlama bağlantısı gönder`)
- src/app/page.tsx: FOUND (contains `auth()`, redirect to `/sign-in`)
- Commit a1f0526: FOUND (feat(01-04): login page, auth layout, root redirect)
- Commit 2cd1240: FOUND (feat(01-04): password reset 2-step flow)
- npx tsc --noEmit: PASS (zero errors)
- npm run build: PASS (/sign-in: 3.94kB, /reset-password: 2.64kB)

## Next Phase Readiness

- Phase 1 complete — all 4 plans executed
- Auth stack fully operational: tenant subdomain routing (Plan 03) + login UI (Plan 04)
- Dentists can log in at `{tenant-slug}.anamnezal.com/sign-in`
- Phase 2 (Hasta Yönetimi) can proceed immediately — auth foundation is complete

---
*Phase: 01-temel-altyapi*
*Completed: 2026-05-02*
