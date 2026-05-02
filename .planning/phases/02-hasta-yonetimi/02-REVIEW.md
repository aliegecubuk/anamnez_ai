---
phase: 02-hasta-yonetimi
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/patients/types.ts
  - src/app/api/orgs/[slug]/patients/route.ts
  - src/app/api/orgs/[slug]/patients/[id]/route.ts
  - src/app/orgs/[slug]/patients/page.tsx
  - src/components/patients/PatientTable.tsx
  - src/components/patients/CreatePatientDialog.tsx
  - src/app/orgs/[slug]/patients/[id]/page.tsx
  - src/components/patients/PatientProfileHeader.tsx
  - src/components/patients/SessionHistoryTable.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: partial_resolved
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-02  
**Depth:** standard  
**Files Reviewed:** 9  
**Status:** issues_found

## Summary

Phase 2 implements patient list, patient profile, and create-patient flows for a KVKK-regulated dental application. TC Kimlik No (Turkish national ID) masking is implemented correctly at the type and response layer. Auth structure follows the established Clerk + Supabase pattern.

Three critical defects found. Two are IDOR vulnerabilities: both API endpoints query the database by patient ID or name/TC without applying an explicit `tenant_id` filter, making cross-tenant data access possible if RLS is misconfigured, disabled (e.g., during migrations or service-role usage), or contains any policy gap. The third is a cookie-forwarding self-fetch that transfers the full session cookie header through application code. Five warnings cover double-fetch on mount, silent error swallowing, a non-null assertion on `userId`, an unhandled `console.error` that may log raw Supabase error objects (which can contain query context including TC values), and the `maskTc` utility not enforcing the exact expected mask length. Three info items cover minor quality issues.

---

## Critical Issues

### CR-01: IDOR — Patient List Query Missing tenant_id Filter ✓ RESOLVED (commit 3588996)

**File:** `src/app/api/orgs/[slug]/patients/route.ts:43-62`

**Issue:** `verifyTenantAccess` resolves `access.tenantId` but the Supabase query never applies `.eq('tenant_id', access.tenantId)`. The query runs as the Clerk-authenticated user via `createSupabaseServerClient`, relying entirely on RLS to scope results to the correct tenant. If the `patients` RLS policy is misconfigured, temporarily disabled (e.g., during a migration), or if a service-role bypass occurs anywhere upstream, all patients from all tenants are returned to any authenticated user. For a KVKK-sensitive dataset (TC Kimlik No), this is a data breach risk.

Defense-in-depth requires the application layer to also enforce tenant scoping — RLS alone is insufficient as the sole control.

**Fix:**
```typescript
let query = supabase
  .from('patients')
  .select(`
    id,
    full_name,
    tc_kimlik_no,
    sessions ( started_at )
  `)
  .eq('tenant_id', access.tenantId)   // ADD THIS — application-layer tenant filter
  .order('full_name', { ascending: true })
```

---

### CR-02: IDOR — Patient Detail Query Missing tenant_id Filter ✓ RESOLVED (commit 271ab3d)

**File:** `src/app/api/orgs/[slug]/patients/[id]/route.ts:39-55`

**Issue:** Same problem as CR-01. The GET `/api/orgs/[slug]/patients/[id]` query only filters by `.eq('id', id)`. Any authenticated user who knows (or guesses) a patient UUID from another tenant can fetch that patient's full name, masked TC, and session history by hitting the correct org slug. Patient UUIDs are not secret. This bypasses the tenant isolation guarantee.

**Fix:**
```typescript
const { data: patient, error } = await supabase
  .from('patients')
  .select(`
    id,
    full_name,
    tc_kimlik_no,
    created_at,
    sessions (
      id,
      form_type,
      status,
      started_at,
      completed_at
    )
  `)
  .eq('id', id)
  .eq('tenant_id', access.tenantId)   // ADD THIS
  .single()
```

---

### CR-03: Self-Fetch With Raw Cookie Header Forwarding ✓ RESOLVED (commit 76edbb0)

**File:** `src/app/orgs/[slug]/patients/[id]/page.tsx:17-24`

**Issue:** The Server Component assembles the full cookie header by joining all cookies (`cookieStore.getAll()`) and forwards the raw string to a self-HTTP call. This pattern:

1. Exposes every cookie (including `__Secure-*`, CSRF tokens, other session cookies) in application code as a plain string.
2. Bypasses Next.js's built-in cookie scoping and `HttpOnly` protections — the assembled string can be logged, stored, or accidentally serialised.
3. Is fragile: cookie values containing `=` or `;` are not encoded, potentially corrupting the header.
4. The `NEXT_PUBLIC_APP_URL` fallback to `http://localhost:3000` means in a misconfigured production environment, requests go to localhost and silently fail without surfacing auth errors (both 401 and 403 become `notFound()`).

The established pattern for server-side data fetching in this project is `createSupabaseServerClient()` + direct DB query — the same approach used in all route handlers. Use that directly instead of HTTP self-fetch.

**Fix:**
```typescript
// Replace the self-fetch entirely with direct Supabase call
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { maskTc } from '@/lib/patients/types'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ... inside the page component:
const { slug, id } = await params

// Verify tenant access (same pattern as route handlers)
const { userId, orgId } = await auth()
if (!userId || !orgId) redirect('/sign-in')

const { data: tenant } = await supabaseAdmin
  .from('tenants')
  .select('id, clerk_org_id')
  .eq('slug', slug)
  .single()

if (!tenant || tenant.clerk_org_id !== orgId) notFound()

const supabase = await createSupabaseServerClient()
const { data: patient, error } = await supabase
  .from('patients')
  .select(`id, full_name, tc_kimlik_no, created_at, sessions(id, form_type, status, started_at, completed_at)`)
  .eq('id', id)
  .eq('tenant_id', tenant.id)
  .single()

if (error || !patient) notFound()
```

---

## Warnings

### WR-01: console.error May Log Raw Supabase Error Containing TC Kimlik No Context ✓ RESOLVED (commit 3588996)

**File:** `src/app/api/orgs/[slug]/patients/route.ts:64,143`

**Issue:** `console.error('[patients GET]', error)` and `console.error('[patients POST]', error)` log the raw Supabase `PostgrestError` object. Supabase error objects can include the query hint, detail, or message fields populated by PostgreSQL — which in some configurations echo back constraint names or column values. For a column storing TC Kimlik No (special-category PII under KVKK), any log pipeline that ships stdout to a third-party service (Vercel logs, Datadog, etc.) risks capturing this data in log storage.

**Fix:** Log only the safe fields:
```typescript
console.error('[patients GET]', { code: error.code, message: error.message })
```

---

### WR-02: Double Fetch on Initial Mount

**File:** `src/components/patients/PatientTable.tsx:52-63`

**Issue:** Two `useEffect` hooks both call `fetchPatients` on mount. The first fires `fetchPatients('')` immediately. The second (debounced) also fires because `query` is `''` and `fetchPatients` is freshly created — it schedules another `fetchPatients('')` 300ms later. This produces two identical API calls on every page load.

**Fix:** Remove the separate initial-load effect; add an `isMounted` guard or use a `useRef` skip-first-run pattern, or initialize query-driven fetch to skip when `query === ''` on first render:
```typescript
const isFirstRender = useRef(true)

// Remove the separate "Initial load" useEffect entirely.
// In the debounced effect:
useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false
    fetchPatients('')   // first load, no debounce
    return
  }
  const timer = setTimeout(() => {
    fetchPatients(query)
  }, 300)
  return () => clearTimeout(timer)
}, [query, fetchPatients])
```

---

### WR-03: Silent Error Swallow on Fetch Failure in PatientTable

**File:** `src/components/patients/PatientTable.tsx:36-50`

**Issue:** When `res.ok` is false (e.g., 401, 403, 500), `setPatients` is never called and `loading` goes back to false. The component renders the empty state for "no patients" — indistinguishable from a legitimately empty list. Auth errors, network failures, and server errors all silently produce "Henüz hasta kaydı yok". The user has no feedback and there is no way to distinguish an empty tenant from a broken state.

**Fix:**
```typescript
const [fetchError, setFetchError] = useState<string | null>(null)

const fetchPatients = useCallback(async (q: string) => {
  setLoading(true)
  setFetchError(null)
  try {
    const res = await fetch(`/api/orgs/${slug}/patients?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      setPatients(await res.json())
    } else {
      setFetchError('Hasta listesi yüklenemedi.')
      toast.error('Hasta listesi yüklenemedi. Lütfen sayfayı yenileyin.')
    }
  } catch {
    setFetchError('Bağlantı hatası.')
    toast.error('Bağlantı hatası. Lütfen tekrar deneyin.')
  } finally {
    setLoading(false)
  }
}, [slug])
```

---

### WR-04: Non-Null Assertion on userId After Re-Fetch

**File:** `src/app/api/orgs/[slug]/patients/route.ts:101,130`

**Issue:** After `verifyTenantAccess` succeeds (guaranteeing `userId` is non-null at that moment), the POST handler calls `await auth()` again on line 101 to get `userId`, then uses `userId!` on line 130. The second `auth()` call is redundant and the `!` assertion masks a potential null. In theory, `verifyTenantAccess` already confirmed `userId` is non-null — just return it from the helper to avoid the second call and the assertion.

**Fix:** Return `userId` from `verifyTenantAccess`:
```typescript
async function verifyTenantAccess(slug: string): Promise<{ tenantId: string; orgId: string; userId: string } | null> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return null
  // ...
  return { tenantId: tenant.id, orgId, userId }
}

// In POST:
const { tenantId, userId } = access  // no second auth() call, no !
```

---

### WR-05: maskTc Does Not Validate Input Length — May Produce Incorrect Masks

**File:** `src/lib/patients/types.ts:49-53`

**Issue:** `maskTc` only checks `tc.length < 2`. For any string between 2 and 10 characters, it returns `'•••••••••' + tc.slice(-2)` — a 9-bullet prefix regardless of actual length. A 5-character input produces `•••••••••XX` (9 + 2 = 11 chars total) which looks correct in the UI but misrepresents the actual data. For a 13-character string (malformed TC), it shows last 2 chars prefixed by 9 bullets, still appearing as a valid 11-char TC.

The spec requires exactly `••••••••• XX` (9 bullets + 2 visible digits). At the API layer this input is already validated to exactly 11 digits, so this is low-risk in production paths, but the utility is exported and callable with any input.

**Fix:**
```typescript
export function maskTc(tc: string): string {
  if (!tc || tc.length !== 11) return '•••••••••••'
  return '•••••••••' + tc.slice(-2)
}
```

---

## Info

### IN-01: `page.tsx` Sets `<title>` Implicitly From Patient Name

**File:** `src/app/orgs/[slug]/patients/[id]/page.tsx:9-69`

**Issue:** The page has no `generateMetadata` export. Next.js will use the default layout title, which does not expose patient data. However, the UI-SPEC (section KVKK / PII Display Rules, rule 3) explicitly requires: "No patient name or TC appears in page `<title>` tags or browser tab titles." Without an explicit `generateMetadata`, future changes to the layout title could inadvertently include route segment data.

**Fix:** Add an explicit metadata export that does not include patient data:
```typescript
export const metadata = { title: 'Hasta Profili | AnamnezAl' }
```

---

### IN-02: Zod Schema Validates Length After Regex — Error Message Order Inconsistency

**File:** `src/components/patients/CreatePatientDialog.tsx:25-31`

**Issue:** The zod chain applies `.regex(/^[0-9]+$/)` before `.length(11)`. If a user enters 10 digits, the regex passes but `.length(11)` fails with "TC kimlik numarası tam 11 haneli olmalıdır." — correct. But if a user enters 10 digits + 1 letter, the regex fires first ("yalnızca rakam"). This matches the UI-SPEC validation order. However the backend in `route.ts` applies the combined regex `/^[0-9]{11}$/` first, then checks `[^0-9]` only as a secondary discriminator. The two-pass approach in the backend is more complex than necessary and the error discriminator order differs from the frontend.

**Fix (backend simplification):**
```typescript
if (!/^[0-9]{11}$/.test(tc_kimlik_no)) {
  const isNonNumeric = /[^0-9]/.test(tc_kimlik_no)
  return NextResponse.json(
    { error: isNonNumeric
        ? 'TC kimlik numarası yalnızca rakam içermelidir.'
        : 'TC kimlik numarası tam 11 haneli olmalıdır.' },
    { status: 422 }
  )
}
```
(Current code is functionally equivalent — this is a readability note, not a logic bug.)

---

### IN-03: `slug` Prop Unused in SessionHistoryTable

**File:** `src/components/patients/SessionHistoryTable.tsx:8-11`

**Issue:** `slug` is declared in the `Props` interface and accepted as a parameter but never used in the component body. All "Görüntüle" buttons are stubs (disabled). When Phase 4/6a/6b implements session routes, `slug` will be needed for `href` construction — but currently the unused prop adds noise and TypeScript does not warn on unused function parameters by default.

**Fix:** Either remove `slug` from the interface until it's used, or add a comment explaining it's reserved:
```typescript
interface Props {
  sessions: SessionSummary[]
  slug: string  // reserved: used in Phase 4/6a/6b for session view hrefs
}
```
Or remove until needed.

---

## Review Summary

- CRITICAL: 3
- HIGH: 0
- MEDIUM: 0 (mapped to WARNING per classification scheme used: 5)
- LOW: 0 (mapped to INFO per classification scheme: 3)
- WARNING: 5
- INFO: 3

**Overall: FAIL**

The two IDOR findings (CR-01, CR-02) make this code unsafe to ship. Both patient-list and patient-detail endpoints lack application-layer tenant scoping, relying solely on Supabase RLS as the only data isolation control. For a KVKK-regulated application handling Turkish national IDs, defense-in-depth is mandatory. CR-03 (cookie-forwarding self-fetch) adds unnecessary attack surface and fragility. All three criticals must be resolved before this phase is considered complete.

---

_Reviewed: 2026-05-02_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
