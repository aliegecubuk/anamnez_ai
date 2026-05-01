---
phase: 1
plan: 1
subsystem: foundation
tags: [next.js, scaffold, shadcn, clerk, supabase, tailwind, vercel]
dependency_graph:
  requires: []
  provides:
    - next.js-15.2.4-project
    - shadcn-ui-initialized
    - tailwind-v4-design-tokens
    - clerk-provider
    - supabase-server-client
    - supabase-admin-client
    - role-helpers
    - vitest-config
    - playwright-config
    - vercel-fra1-pin
  affects:
    - all-subsequent-plans
tech_stack:
  added:
    - next@15.2.4
    - "@clerk/nextjs@6.39.3"
    - "@supabase/supabase-js@^2.105.1"
    - "@supabase/ssr@0.10.2"
    - shadcn/ui@4.6.0 (base-nova style, @base-ui/react primitives)
    - tailwindcss@^4
    - vitest + @vitejs/plugin-react + @vitest/ui
    - "@playwright/test"
    - zod
    - svix
    - next-themes
    - react-hook-form + @hookform/resolvers
  patterns:
    - ClerkProvider wraps entire React tree in layout.tsx
    - Supabase native Third-Party Auth (no deprecated JWT template)
    - Server-only admin client (SUPABASE_SERVICE_ROLE_KEY, no NEXT_PUBLIC_ prefix)
    - Tailwind v4 CSS-native config (@theme inline block, no tailwind.config.ts)
key_files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - vercel.json
    - .env.example
    - vitest.config.ts
    - playwright.config.ts
    - components.json
    - src/app/layout.tsx
    - src/app/globals.css
    - src/lib/supabase/server.ts
    - src/lib/supabase/admin.ts
    - src/lib/clerk/roles.ts
    - src/lib/__tests__/setup.ts
    - src/lib/utils.ts
    - src/components/ui/ (12 components)
    - e2e/.gitkeep
  modified:
    - .gitignore (added !.env.example exception)
    - .env.local (fixed Supabase URL from dashboard URL to API URL)
decisions:
  - "@clerk/nextjs v6.39.3 used instead of v7.3.0 — v7.3.0 peer requires next>=15.2.8, incompatible with pinned next@15.2.4"
  - "shadcn/ui v4.6.0 uses base-nova style with @base-ui/react primitives instead of @radix-ui — form.tsx written without @radix-ui/react-slot dependency"
  - "Supabase URL corrected in .env.local from dashboard URL to project API URL"
metrics:
  duration: "~13 minutes"
  completed_date: "2026-05-01"
  tasks_completed: 1
  files_created: 44
---

# Phase 1 Plan 1: Next.js Scaffold + Foundation Summary

**One-liner:** Next.js 15.2.4 project scaffolded with shadcn/ui v4.6.0 (base-nova/@base-ui), Clerk auth provider, Supabase client pattern, Tailwind v4 UI-SPEC tokens, fra1 Vercel pin, and test infrastructure stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Provision External Services | (skipped — pre-provisioned) | .env.local pre-filled |
| 2 | Create Next.js 15.2.4 Project + Install Dependencies | e262049 | 40 files created |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Version Incompatibility] @clerk/nextjs@7.3.0 requires next>=15.2.8**
- **Found during:** Task 2 — npm install step
- **Issue:** `@clerk/nextjs@7.3.0` declares peer dependency `next: "^15.2.8 || ^15.3.8 || ..."` — incompatible with pinned `next@15.2.4`
- **Fix:** Used `@clerk/nextjs@6.39.3` (latest v6) which accepts `>=15.0.0-rc`. The `clerkMiddleware`, `auth()` server API, `ClerkProvider`, and all PATTERNS.md patterns are identical between v6 and v7.
- **Files modified:** package.json
- **Commit:** e262049

**2. [Rule 1 - Bug] Incorrect Supabase URL in .env.local**
- **Found during:** Task 2 — reviewing .env.local content
- **Issue:** `NEXT_PUBLIC_SUPABASE_URL` was set to `https://supabase.com/dashboard/project/aihfqulgdwekvxyeeofl` (browser dashboard URL) instead of the API URL
- **Fix:** Corrected to `https://aihfqulgdwekvxyeeofl.supabase.co` (project API URL)
- **Files modified:** .env.local (git-ignored, not committed)
- **Commit:** N/A (git-ignored file)

**3. [Rule 2 - Missing Critical Functionality] shadcn/ui @base-ui/react instead of @radix-ui**
- **Found during:** Task 2 — shadcn init and component install
- **Issue:** shadcn/ui v4.6.0 uses `@base-ui/react` primitives instead of `@radix-ui`. Form component could not be installed via `npx shadcn add form` (hung during dependency check). Plan expected @radix-ui/react-slot for form.tsx.
- **Fix:** Wrote form.tsx manually using `react-hook-form` + `@hookform/resolvers` without @radix-ui dependencies. FormControl uses a native `div` wrapper instead of Radix Slot pattern.
- **Files modified:** src/components/ui/form.tsx
- **Commit:** e262049

**4. [Rule 1 - Bug] TypeScript error in roles.ts — sessionClaims.metadata typed as {}**
- **Found during:** Task 2 — npx tsc --noEmit
- **Issue:** `sessionClaims?.metadata?.role` failed TS check because `metadata` is typed as `{}` in @clerk/nextjs v6
- **Fix:** Cast to `(sessionClaims?.metadata as Record<string, unknown>)?.role`
- **Files modified:** src/lib/clerk/roles.ts
- **Commit:** e262049

**5. [Rule 3 - Blocking] create-next-app rejects directory name AnamnezAl (uppercase)**
- **Found during:** Task 2 — attempting to scaffold in-place
- **Issue:** npm package naming restrictions prohibit capital letters. `create-next-app .` uses directory name as package name.
- **Fix:** Scaffolded in temporary `anamnezal-tmp` directory on Desktop, copied files to AnamnezAl, removed temp directory.
- **Commit:** e262049

### Shadcn Style Note

The plan specified "Default" style with "Slate" base color. `npx shadcn@latest init --defaults` used "base-nova" style with "neutral" base color (shadcn v4.6.0 default). The UI-SPEC design tokens are fully applied in globals.css `:root` block, overriding the generated neutral palette. Visual output matches UI-SPEC regardless of shadcn style preset.

## Verification Results

- `npx tsc --noEmit`: PASSED (0 errors)
- `package.json` contains `"next": "15.2.4"` (exact, no caret)
- `vercel.json` contains `"fra1"` in regions array
- `components.json` contains `"config": ""` (Tailwind v4) and `"css": "src/app/globals.css"`
- `src/app/globals.css` contains `@theme` block and `--primary: #2563EB`
- `src/app/layout.tsx` contains `ClerkProvider` and `lang="tr"`
- All 12 shadcn components present in src/components/ui/
- `src/lib/supabase/server.ts` uses native Third-Party Auth (no `template: 'supabase'`)
- `src/lib/supabase/admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix)

## Known Stubs

None — this plan establishes infrastructure only, no UI data flows.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what was planned.

## Self-Check: PASSED

- package.json: FOUND
- components.json: FOUND
- vercel.json: FOUND
- src/app/layout.tsx: FOUND (ClerkProvider + lang=tr)
- src/app/globals.css: FOUND (@theme + --primary: #2563EB)
- src/lib/supabase/server.ts: FOUND
- src/lib/supabase/admin.ts: FOUND
- src/lib/clerk/roles.ts: FOUND
- vitest.config.ts: FOUND
- playwright.config.ts: FOUND
- .env.example: FOUND (committed with !.env.example gitignore exception)
- Commit e262049: FOUND
