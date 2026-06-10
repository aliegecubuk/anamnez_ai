# Phase 5: Dental AI Açıklamaları - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — autonomous mode, user requested no questions)

<domain>
## Phase Boundary

Every captured medication, systemic disease, and food allergy has an expandable dental-specific AI description with a legal disclaimer.

**Requirements:** DESC-01, DESC-02, DESC-03, DESC-04, DESC-05, DESC-06

**Success criteria:**
1. Each medication, disease, and allergy in the filled form has a click-to-expand button (collapsed by default, non-intrusive)
2. Expanded description is exactly 3 lines: dental/surgical/anesthetic impact, risk level, recommended precaution
3. Description contains only dental/surgical relevance — no general medical information
4. For an unknown or rare drug, the system generates a description via active ingredient lookup
5. Every description ends with the legal disclaimer: "Bu bilgi klinik karar desteği değildir"

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices at Claude's discretion — discuss skipped per user request (autonomous run to completion). Use ROADMAP goal, success criteria, codebase conventions.

Key anchors:
- LLM: GPT-4o Structured Outputs (CLAUDE.md tech stack) — generate the 3-line dental description with a strict json_schema (3 fixed fields: dental_impact, risk_level, precaution).
- Caching: descriptions for the same medication/disease/allergy term are deterministic enough to cache (DB table keyed by normalized term) — avoid regenerating + repeated API cost. Cache is a performance choice, not required by spec.
- Disclaimer "Bu bilgi klinik karar desteği değildir" appended server-side, not model-generated, so it can never be omitted (DESC success criterion 5).
- Scope guard (criterion 3): system prompt constrains output to dental/surgical/anesthetic relevance only; no general medical info.
- Source of terms: the anamnesis_answers / filled form fields from Phase 4 (medication, systemic disease, food allergy question types/categories).
- Per-user RLS, flat single-user model.

</decisions>

<code_context>
## Existing Code Insights

Phase 4 delivered: anamnesis_answers table, template_questions (with question types), GPT-4o mapper (`src/lib/anamnesis/mapper.ts`, `src/lib/openai` client), AnamnesisForm UI, session workspace. Phase 5 attaches expandable descriptions to medication/disease/allergy answers rendered in that form. Codebase context gathered during planning.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss skipped. Refer to ROADMAP phase description and success criteria. The 3-line format and exact disclaimer string are hard constraints.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
