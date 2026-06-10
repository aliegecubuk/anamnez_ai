---
plan: 04-03
status: complete
commits:
  - 386c058: "chore(04-03): add vitest test scripts to package.json"
  - 929a764: "test(04-03): add failing tests for buildAnswerSchema structured-output builder"
  - 8dd5c03: "feat(04-03): implement buildAnswerSchema dynamic structured-output builder"
  - 8cb6b09: "test(04-03): add failing tests for normalizeAnswers + buildMissingAlerts"
  - 8318a58: "feat(04-03): implement normalizeAnswers type coercion + buildMissingAlerts"
  - ec0ae1c: "test(04-03): add failing tests for mapTranscriptToAnswers GPT-4o wrapper (mocked client)"
  - 20539d2: "feat(04-03): implement mapTranscriptToAnswers GPT-4o structured-output wrapper"
requirements: [ANAM-01, ANAM-02]
key-files:
  created:
    - src/lib/anamnesis/schema.ts
    - src/lib/anamnesis/schema.test.ts
    - src/lib/anamnesis/mapper.ts
    - src/lib/anamnesis/mapper.test.ts
    - src/lib/openai/anamnesis.ts
    - src/lib/openai/anamnesis.test.ts
  modified:
    - package.json (test scripts + jsdom devDep)
    - package-lock.json
completed: 2026-06-11
duration: ~6 min
---

# Phase 4 Plan 03: GPT-4o Mapping Engine Summary

**One-liner:** Transcript→form mapping engine: dynamic strict JSON-schema builder per template version, type-coercing answer normalizer with [0,1] confidence clamping, required-field missing alerts, and a GPT-4o structured-output wrapper whose Turkish system prompt also returns a drift-corrected transcript — all TDD, 20 tests green, zero live API calls.

## What Was Built

### Task 0 — Test scripts (386c058)
`"test": "vitest run"` + `"test:watch": "vitest"` added to package.json.

### Task 1 — buildAnswerSchema (929a764 RED → 8dd5c03 GREEN)
`src/lib/anamnesis/schema.ts`: builds `{ name:'anamnesis_answers', strict:true, schema }` from `SnapshotQuestion[]`. Per-question `{ value, confidence(0..1) }` keyed by question id; yes_no→boolean, text→string, numeric→number, multi_select→array with `items.enum` locked to options (throws `'multi_select question requires options'` when options null/empty). Top-level `corrected_transcript` string; `additionalProperties:false` + full `required` lists throughout (OpenAI strict-mode valid). 6 tests.

### Task 2 — normalizeAnswers + buildMissingAlerts (8cb6b09 RED → 8318a58 GREEN)
`src/lib/anamnesis/mapper.ts` (pure):
- `normalizeAnswers`: numeric coerces "12"→12 (incl. Turkish decimal comma), unparseable→null/conf 0; yes_no maps evet/var/true/1 and hayır/yok/false/0 (tr-TR lowercasing), garbage→null; multi_select filters values to options (T-04-08 mitigation); text trimmed, ''→null; confidence clamped [0,1]; missing raw entry → `{ answer_value:null, confidence:0 }`.
- `buildMissingAlerts`: required + (null|''|[]) → `{ question_id, prompt }` alert (ANAM-04 support for 04-04). 9 tests.

### Task 3 — mapTranscriptToAnswers (ec0ae1c RED → 20539d2 GREEN)
`src/lib/openai/anamnesis.ts`: reuses `getOpenAIClient()` from whisper.ts (no second OpenAI instance); `chat.completions.create` with model `gpt-4o`, `response_format: { type:'json_schema', json_schema: buildAnswerSchema(questions) }`. Turkish system prompt: per-field 0..1 confidence, unmentioned fields confidence 0, `corrected_transcript` fixing proper-noun + Turkish-number STT drift (Phase 3 deferred item). `AnamnesisMappingError` with codes `missing_api_key|upstream_error|parse_error` mirrors WhisperError. Keyed answers object → `AiMappedAnswer[]` → `normalizeAnswers` before return. 5 tests, OpenAI client fully mocked via `vi.mock('@/lib/openai/whisper')`.

## Deviations from Plan

1. **[Rule 3 — blocking dep] jsdom installed:** `vitest.config.ts` declares `environment: 'jsdom'` but jsdom was not in devDependencies — every test run failed with MISSING DEPENDENCY. Added `jsdom ^29.1.1` (commit 8dd5c03).
2. **[Pre-existing working-tree absorption] Task 0 commit (386c058) includes prior uncommitted package.json changes:** next `15.2.4→^15.5.18`, `openai ^6.37.0`, vitest/@vitejs/plugin-react/@vitest/ui/@playwright/test devDeps. These were already modified in the working tree (Phase 3 session leftovers) and are exactly the dependencies this plan presumes; package.json cannot be partially staged non-interactively. package-lock.json committed in 8dd5c03 to restore lock/manifest sync.
3. **[Observation — not changed] Strict schema vs null instruction tension:** the plan's schema spec types `value` as plain boolean/string/number (no null union) while the prompt instructs "unmentioned → null with confidence 0". Implemented per plan verbatim; prompt instructs the model to use a neutral value with confidence 0 instead, and `normalizeAnswers` already yields null/0 for anything unparseable. If real-world runs show forced-value noise, widen value schemas to `[type,'null']` (one-line change in `valueSchemaFor`).

## Verification Results

| Check | Result |
|-------|--------|
| Task 0: `grep '"test": "vitest run"' package.json` | PASS |
| Task 1: `npm test -- schema` (6 tests) + export grep | PASS |
| Task 2: `npm test -- mapper` (9 tests) + export greps | PASS |
| Task 3: export/json_schema/getOpenAIClient/corrected_transcript greps | PASS |
| Full suite `npm test` | PASS — 3 files, 20 tests |
| `npx tsc --noEmit -p .` | PASS — zero errors |
| TDD gates: test→feat commit per task | PASS (929a764→8dd5c03, 8cb6b09→8318a58, ec0ae1c→20539d2) |
| No live OpenAI / Supabase calls in tests | PASS (client mocked; no DB access) |

## Known Stubs

None — all functions fully wired; consumer (04-04 form UI + answer persistence) is a later plan by design.

## Threat Flags

None new — T-04-08 mitigation (strict schema + coercion + option filtering) implemented as planned; no new endpoints or auth paths added.

## Self-Check: PASSED
- src/lib/anamnesis/schema.ts / schema.test.ts — FOUND
- src/lib/anamnesis/mapper.ts / mapper.test.ts — FOUND
- src/lib/openai/anamnesis.ts / anamnesis.test.ts — FOUND
- Commits 386c058, 929a764, 8dd5c03, 8cb6b09, 8318a58, ec0ae1c, 20539d2 — FOUND in git log
