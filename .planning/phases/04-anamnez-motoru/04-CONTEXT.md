# Phase 4: Anamnez Motoru - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — autonomous mode, user requested no questions)

<domain>
## Phase Boundary

Admins can build form templates per department, and AI auto-fills the anamnesis form from the transcript — with alerts for missing answers and KVKK consent before saving.

**Requirements:** TPLT-01, TPLT-02, TPLT-03, TPLT-04, TPLT-05, ANAM-01, ANAM-02, ANAM-03, ANAM-04, ANAM-05, ANAM-06

**Success criteria:**
1. Admin can create a department form template with yes/no, text, multi-select, and numeric question types
2. Admin can add, edit, reorder, and delete questions on a template without breaking existing saved sessions
3. Dentist selects a department template before starting a session and the correct question set loads
4. After recording, AI maps the transcript to form fields and displays each answer with a confidence indicator
5. Dentist can manually edit any AI-filled field before saving
6. At session end, AI lists all unanswered questions as alerts; clicking an alert focuses the corresponding field
7. Session cannot be saved until KVKK data processing consent and informed consent checkboxes are checked

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user request (autonomous run to project completion). Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key anchors from prior phases:
- LLM: GPT-4o Structured Outputs (per CLAUDE.md tech stack) for transcript→form mapping
- Template versioning: editing a template must not break existing saved sessions (success criterion 2) — snapshot template version into session or use immutable template versions
- KVKK consent: blocking checkboxes before save (success criterion 7)
- Per-user RLS (`user_id = auth.jwt() ->> 'sub'`), flat single-user model — no orgs
- Phase 3 deferred items to address here: GPT-4o post-processing corrects proper-noun transcription drift

</decisions>

<code_context>
## Existing Code Insights

Phase 3 delivered: transcript_segments table, sessions STT columns, Whisper wrapper (`src/lib/openai/whisper.ts`, gpt-4o-transcribe), 5 session API routes, useChunkedRecorder + RecordingPanel/LiveTranscript, SessionWorkspace, patient profile wiring. Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria. See `.planning/phases/03-ses-boru-hatt/HANDOFF.md` for Phase 4 design questions raised at Phase 3 close.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
