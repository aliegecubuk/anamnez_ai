# Phase 1: Temel Altyapı - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Dentists and admins can securely log in to their tenant. Data is isolated per tenant (Supabase RLS), encrypted at rest and in transit, with basic login audit logging. KVKK-compliance at the technical layer only — user consent screens come in Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Tenant Onboarding
- **D-01:** No public signup page. Superadmin manually creates tenants via an in-app superadmin panel.
- **D-02:** Superadmin panel required in-app (not just Clerk dashboard) — to view all tenants, troubleshoot, delete tenants. This is a separate role above tenant admins.

### Login URL Structure
- **D-03:** Tenant-specific subdomains: `{tenant-slug}.anamnezal.com`. Requires wildcard DNS (`*.anamnezal.com`). Clerk must resolve the correct Organization from the subdomain.
- **D-04:** All UI and design decisions for the login page are delegated to `frontend-design` + `impeccable` agents. No design decisions locked here.

### KVKK Baseline (Phase 1 scope)
- **D-05:** Phase 1 covers technical KVKK layer only: Supabase Frankfurt (eu-central-1), AES-256 at rest, TLS in transit, Supabase RLS from first schema.
- **D-06:** User-facing KVKK consent screens (aydınlatma metni, hasta onam) are scoped to Phase 4 — they are meaningful only at the patient session level.
- **D-07:** Basic login audit log (who logged in, when, from which tenant) must be set up in Phase 1. Cannot be retrofitted post-launch.

### Session Security
- **D-08:** No auto-timeout. Manual logout only. Dentists use personal devices (not shared hospital PCs) — timeout would interrupt active patient sessions without benefit.
- **D-09:** Standard Clerk session persistence (survives browser refresh). Session length managed by Clerk defaults.

### Claude's Discretion
- Clerk Organization slug format and subdomain mapping implementation details
- Supabase RLS policy structure (row-level vs. column-level tradeoffs)
- Superadmin panel UI layout (subject to frontend-design agent)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project goals, core value, constraints
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-07 (Phase 1 requirements)
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 observable outcomes)

### Research
- `.planning/research/STACK.md` — Technology choices with rationale (Next.js 15, Supabase Frankfurt, Clerk Organizations, shadcn/ui)
- `.planning/research/PITFALLS.md` — Multi-tenant isolation failures section; KVKK compliance section
- `.planning/research/SUMMARY.md` — Recommended stack table + immediate pre-code actions (VERBİS, DPA, Supabase region)

### Critical Constraints
- Supabase project MUST be created in `eu-central-1` (Frankfurt) — data residency for KVKK
- Vercel functions MUST be pinned to `fra1` in `vercel.json` before any deployment
- OpenAI DPA must be signed before Phase 3 (STT) — not Phase 1, but note it now

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield project — no existing components or patterns to reuse.
- `.claude/settings.local.json` exists (Claude Code config only, not application code).

### Established Patterns
- None yet — Phase 1 establishes all foundational patterns.
- All patterns created in Phase 1 (RLS structure, Clerk integration, component library) become the baseline for all subsequent phases.

### Integration Points
- Phase 2 (Patient Records) builds directly on top of Phase 1 auth/RLS. Every patient table will inherit `tenant_id` RLS from Phase 1 schema patterns.

</code_context>

<specifics>
## Specific Ideas

- Subdomain routing: `{tenant-slug}.anamnezal.com` — slug assigned by superadmin at tenant creation
- Superadmin panel is a separate internal section, not visible to regular tenant admins
- Login UI design: deferred to frontend-design agent — no wireframe decisions here

</specifics>

<deferred>
## Deferred Ideas

- Public tenant self-signup page — not needed in v1 (superadmin creates manually)
- Auto-logout / session timeout — not needed (personal devices confirmed)
- KVKK aydınlatma metni at user registration — Phase 4 scope
- Password strength rules / 2FA — not discussed, Claude's discretion

</deferred>

---

*Phase: 1-Temel Altyapı*
*Context gathered: 2026-05-01*
