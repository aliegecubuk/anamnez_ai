# Architecture Patterns: AnamnezAl

**Domain:** Voice-driven dental anamnesis + charting web app  
**Researched:** 2026-05-01  
**Confidence:** HIGH (core patterns), MEDIUM (Turkish STT disambiguation), HIGH (data models)

---

## Component Diagram (ASCII)

```
Browser (Chrome)
┌─────────────────────────────────────────────────────────────────┐
│  MediaRecorder                                                  │
│     │  audio chunks (webm/opus, ~2s each via VAD boundary)      │
│     ▼                                                           │
│  WebSocket client ──── binary audio frames ──────────────────► │
│                                                                 │
│  Transcript Display  ◄── SSE stream (transcript tokens) ─────  │
│  Form Panel          ◄── SSE stream (field fill events) ──────  │
│  Perio Chart         ◄── SSE stream (tooth data events) ──────  │
│  Pathology Chart     ◄── SSE stream (condition events) ───────  │
│                                                                 │
│  Confirmation Modal  ◄── tooth disambiguation triggers ───────  │
└─────────────────────────────────────────────────────────────────┘
         │                                    ▲
         │ WebSocket (audio)                  │ SSE (server→client)
         ▼                                    │
┌─────────────────────────────────────────────────────────────────┐
│  Next.js App Server (App Router, Server Components)             │
│                                                                 │
│  /api/session/audio  ← WebSocket handler                       │
│      │                                                          │
│      ├─► Audio Buffer Service                                   │
│      │       VAD (Silero via server-side JS or Python sidecar)  │
│      │       chunk overlap: 200ms trailing context              │
│      │       emit finalized chunks to Whisper queue             │
│      │                                                          │
│      ├─► Whisper Transcription Worker                           │
│      │       POST to OpenAI Whisper API ($0.006/min)            │
│      │       returns raw transcript segment                     │
│      │       appends to session transcript store                │
│      │                                                          │
│      ├─► Transcript → Structure LLM (GPT-4o / Claude)          │
│      │       runs per-segment + final full pass                 │
│      │       Structured Outputs (JSON Schema constrained)       │
│      │       outputs: form fields, perio events, path events    │
│      │                                                          │
│      └─► SSE emitter → browser                                  │
│                                                                 │
│  /api/session/[id]   ← CRUD + pause/resume                     │
│  /api/templates      ← tenant form templates                   │
│  /api/descriptions   ← dental AI descriptions (on demand)      │
│                                                                 │
│  Supabase Client (RLS-enforced queries)                         │
│  Redis (session hot state, 24h TTL)                             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────┐    ┌───────────────────┐
│  PostgreSQL (Supabase) │    │  Redis             │
│  - tenants             │    │  - active_session  │
│  - users               │    │  - transcript_buf  │
│  - patients            │    │  - form_state      │
│  - sessions            │    │  - perio_state     │
│  - form_templates      │    │  TTL: 24h          │
│  - form_responses      │    └───────────────────┘
│  - perio_charts        │
│  - pathology_charts    │
│  RLS: tenant_id on all │
└────────────────────────┘
```

---

## Data Flow: Full Session

```
1. Dentist opens session → selects department template → session row created
2. "Record" pressed → MediaRecorder starts → audio chunks → WebSocket
3. Server VAD detects speech boundaries → assembles chunks (no mid-word cuts)
4. Finalized chunk → Whisper API → transcript segment returned (≈1-2s latency)
5. Segment appended to Redis transcript_buf
6. Per-segment LLM call with current transcript window:
   a. Extracts filled form fields → SSE "field" event → browser fills form cells
   b. Extracts perio mentions → SSE "perio" event → chart updates
   c. Extracts pathology mentions → SSE "pathology" event → chart highlights
7. If tooth number confidence LOW → SSE "confirm_tooth" event → modal shown
8. Dentist confirms/corrects → WebSocket message back → state updated
9. "Stop" → final full-transcript LLM pass → missing field detection → alerts
10. Dentist reviews, corrects manual fields → "Save" → flush Redis → write Postgres
```

---

## Q1: Voice Pipeline — Chunking Strategy

**Recommendation: VAD-boundary chunking with 200ms overlap, NOT time-based.**

Time-based chunking (e.g., every 3s) will cut mid-word regularly. Sentence-boundary detection requires NLP not available client-side in real time. VAD (Voice Activity Detection) is the correct approach.

**Implementation:**

- Browser: MediaRecorder with `timeslice: 250ms` — sends small chunks over WebSocket
- Server: accumulates chunks into a rolling buffer, runs Silero VAD (Python sidecar or `@xenova/transformers` WASM on Node)
- VAD detects speech end (pause ≥ 400ms in dental context — doctors pause between data points)
- On speech end: extract last spoken segment + 200ms trailing overlap from previous segment
- Send combined buffer to Whisper API as a single webm/opus blob
- Discard silence-only segments without calling Whisper (cost saving)

**Why NOT time-based:**
- "diş on sekiz" takes ~1.2s — a 2s window might capture "diş on" in chunk N and "sekiz" in chunk N+1
- Whisper on chunk N will hallucinate a complete phrase, missing "sekiz"
- Lost context = wrong tooth number = clinical error

**Whisper API vs Realtime API:**
- Whisper API: $0.006/min, 2s median latency, file-based — fine for clinical pace
- Realtime API: ~$0.06/min input (10x cost), sub-300ms — overkill for dental dictation
- **Use Whisper API** with VAD chunking. Clinical dictation is not a live conversation.

**Latency budget:** VAD detection (50ms) + network (100ms) + Whisper (500-2000ms) = 650ms-2.1s per segment. Acceptable for review-as-you-go UX.

---

## Q2: Transcript → Structured Form

**Recommendation: Structured Outputs (JSON Schema constrained) with two-pass strategy.**

### Strategy

**Pass 1 — Per-segment incremental fill (fast, low context)**
- Triggered after each Whisper segment arrives
- Input: last transcript segment only (~20-50 words)
- Task: extract ANY form field, perio measurement, or pathology condition mentioned
- Output: partial JSON with only newly mentioned fields set
- Merge into running state (don't overwrite already-filled fields)
- Latency: ~300-600ms per segment with GPT-4o mini

**Pass 2 — Full-transcript consolidation (on "Stop")**
- Input: entire session transcript (may be 2000-5000 tokens)
- Task: complete form fill, detect contradictions, fill missed fields
- Output: full form state JSON with confidence scores per field
- Flags fields with low confidence → missing field alerts
- Latency: 2-5s, acceptable (user is reviewing, not speaking)

### Schema approach for 60+ fields

Use Structured Outputs (not JSON mode, not function calling):
- JSON Schema defines all possible fields with `type`, `enum` where applicable, and descriptions in Turkish
- Constrained decoding guarantees schema adherence without retry loops
- Fields not mentioned in segment = omitted from output (use `additionalProperties: false`, all fields optional)
- Merge delta outputs into cumulative state on server

**Do NOT use a single 60-field schema for per-segment calls.**
Split into domain groups (medications, systemic diseases, allergies, surgical history, lifestyle) — each segment call only passes the relevant group schema based on keyword detection in the transcript.

### Prompt structure (per-segment call)

```
System: Sen bir diş hekimliği anamnezi asistanısın. Transkripsiyonu verilen cümleden 
        yalnızca açıkça söylenen bilgileri JSON formatında çıkar. 
        Söylenmeyen alanları ekleme. Tahmin etme.

User: Transkript: "{segment}"
      Şema: {field_group_schema}
      JSON çıktısı:
```

---

## Q3: Tooth Number Disambiguation

**Recommendation: 3-layer defense — LLM phonetic context + confidence scoring + mandatory confirmation for ambiguous pairs.**

### Problem

Turkish FDI pairs with high phonetic confusion risk:
- 18 ("on sekiz") vs 28 ("yirmi sekiz") — share "sekiz"
- 14 ("on dört") vs 24 ("yirmi dört") — share "dört"
- 11 ("on bir") vs 21 ("yirmi bir") — share "bir"
- 17 ("on yedi") vs 27 ("yirmi yedi") — share "yedi"

Whisper may transcribe "on" as "yirmi" due to coarticulation or background noise. Stakes: wrong quadrant in perio chart = clinical misdiagnosis.

### Layer 1: Contextual LLM parsing

The LLM prompt includes the full FDI chart structure as context:
```
Üst sağ kadran: 11,12,13,14,15,16,17,18
Üst sol kadran: 21,22,23,24,25,26,27,28
...
```
Dentists typically work through a jaw systematically (e.g., upper right → upper left). 
Instruct LLM: "If dentist has been naming upper-right teeth (11-18), weight 18 over 28 for ambiguous 'sekiz' references."

### Layer 2: Confidence scoring

LLM outputs a `confidence` field per tooth mention:
- `"high"`: number clearly spoken, no phonetic neighbors in recent mentions
- `"medium"`: clear number but neighboring quadrant tooth not yet ruled out  
- `"low"`: number unclear or mid-word segment boundary detected

### Layer 3: Mandatory confirmation modal

For any tooth mention with `confidence != "high"` on perio chart (NOT pathology — lower stakes):
- Pause audio processing
- Show modal: "Diş 18 mi, yoksa Diş 28 mi?"
- Dentist taps/speaks answer → confirmed → recorded
- Pathology chart: only confirm if directly adjacent quadrant teeth overlap

### Post-Whisper text correction

Apply a lightweight Turkish number normalization pass before LLM:
- Use regex + lookup to normalize Whisper output: "onsekiz" → "on sekiz", "onbir" → "on bir"
- Whisper sometimes outputs compound numbers without space — normalize before parsing

---

## Q4: Multi-Tenant Template Engine

**Recommendation: JSONB template definitions in PostgreSQL, shared table with tenant_id RLS.**

### Schema

```sql
-- Tenant table
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,           -- "İstanbul Üniversitesi Diş Hekimliği"
  slug        TEXT UNIQUE NOT NULL,    -- "istanbul-uni"
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Form templates (one per department per tenant)
CREATE TABLE form_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  department   TEXT NOT NULL,          -- "Periodontoloji", "Endodonti"
  name         TEXT NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  is_active    BOOLEAN DEFAULT true,
  questions    JSONB NOT NULL,         -- array of question objects (see below)
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, department, version)
);

-- Index for tenant isolation + RLS
CREATE INDEX idx_form_templates_tenant ON form_templates(tenant_id);
```

### Question JSONB structure

```json
{
  "questions": [
    {
      "id": "q_001",
      "order": 1,
      "group": "Sistemik Hastalıklar",
      "label": "Kalp rahatsızlığınız var mı?",
      "type": "yes_no",
      "required": true,
      "follow_up_if": "yes",
      "follow_up_question": "Hangi kalp rahatsızlığı?"
    },
    {
      "id": "q_002",
      "order": 2,
      "group": "İlaçlar",
      "label": "Düzenli kullandığınız ilaçlar?",
      "type": "text_list",
      "required": false,
      "triggers_dental_description": true
    },
    {
      "id": "q_003",
      "order": 3,
      "group": "Alerjiler",
      "label": "Penisilin alerjiniz var mı?",
      "type": "yes_no",
      "required": true
    }
  ]
}
```

**Question types supported:** `yes_no`, `text`, `text_list`, `numeric`, `multi_select`, `date`

### Why JSONB over alternatives

| Approach | Verdict | Reason |
|----------|---------|--------|
| JSONB column | **USE THIS** | 3x less storage than EAV, 1.3x faster queries, schema changes = no migrations |
| EAV tables | Avoid | Complex joins, slow, hard to validate |
| Per-tenant tables | Avoid | Schema migrations per tenant, unmanageable at 50+ universities |
| Per-tenant schemas | Avoid | Operational overhead, complex connection pooling |

### Template versioning

- Increment `version` on every admin edit (never mutate in place)
- `is_active` flags the current version
- `form_responses` stores `template_version_id` foreign key — old responses always render correctly against their snapshot

---

## Q5: Perio Chart Data Model

**Recommendation: Flat row per tooth per session, 12 nullable integer columns.**

```sql
CREATE TABLE perio_charts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES sessions(id),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),  -- denormalized for RLS
  patient_id     UUID NOT NULL REFERENCES patients(id),
  tooth_fdi      SMALLINT NOT NULL CHECK (tooth_fdi BETWEEN 11 AND 48),
  
  -- Pocket Depth (mm) — NULL = not recorded, 0 = explicit zero
  pd_mb          SMALLINT,   -- mesio-buccal
  pd_b           SMALLINT,   -- buccal
  pd_db          SMALLINT,   -- disto-buccal
  pd_ml          SMALLINT,   -- mesio-lingual/palatal
  pd_l           SMALLINT,   -- lingual/palatal
  pd_dl          SMALLINT,   -- disto-lingual/palatal
  
  -- Attachment Loss (mm) — NULL = not recorded
  al_mb          SMALLINT,
  al_b           SMALLINT,
  al_db          SMALLINT,
  al_ml          SMALLINT,
  al_l           SMALLINT,
  al_dl          SMALLINT,
  
  -- Metadata
  recorded_at    TIMESTAMPTZ DEFAULT now(),
  confirmed_by   UUID REFERENCES users(id),  -- NULL if unreviewed
  
  UNIQUE(session_id, tooth_fdi)
);

CREATE INDEX idx_perio_session ON perio_charts(session_id);
CREATE INDEX idx_perio_tenant ON perio_charts(tenant_id);  -- for RLS
```

**NULL vs 0 enforcement:** Application layer never writes 0 for an unrecorded measurement. The voice pipeline only inserts a row for a tooth when at least one measurement is explicitly stated. Rows are upserted by (session_id, tooth_fdi) — re-stating a tooth updates its measurements.

**32 teeth × 12 columns = max 384 SMALLINT values per session.** This is tiny — no partitioning needed.

---

## Q6: Real-Time Streaming — WebSocket + SSE Split

**Recommendation: WebSocket for audio upload (client→server binary), SSE for all server→client events.**

### Why split

| Direction | Protocol | Reason |
|-----------|----------|--------|
| Audio upload (client→server) | WebSocket | Binary frames, low overhead, bidirectional needed for confirmation ACKs |
| Transcript + form events (server→client) | SSE | Simpler, HTTP/2 multiplexed, auto-reconnect, works through proxies |

WebSocket handles two directions: audio chunks up, confirmation responses up. SSE handles everything coming down.

### SSE event types

```
event: transcript
data: {"segment": "diş on sekiz iki milimetre cep", "ts": 1234567890}

event: field_fill
data: {"field_id": "q_001", "value": "yes", "confidence": "high"}

event: perio_update
data: {"tooth": 18, "metric": "pd", "point": "mb", "value": 2, "confidence": "high"}

event: perio_confirm_needed
data: {"candidates": [18, 28], "segment": "on sekiz", "context": "..."}

event: pathology_update
data: {"tooth": 22, "condition": "caries", "color": "#FF4444"}

event: missing_fields
data: {"fields": ["q_007", "q_012"], "message": "Bu alanlar doldurulamadı"}

event: session_complete
data: {"session_id": "...", "filled_count": 57, "total_count": 63}
```

### LLM streaming during session

Per-segment LLM calls: NOT streamed to client — wait for complete JSON, then emit structured SSE events. Streaming raw LLM tokens is useless for chart updates which require complete validated JSON.

Final pass (on Stop): can stream field_fill events as they come from LLM output, since the dentist is reviewing.

---

## Q7: Session State Persistence

**Recommendation: Redis for hot state (active session), PostgreSQL for cold storage (completed/paused).**

### Redis schema (active session)

```
session:{session_id}:meta       HASH   {patient_id, tenant_id, template_id, status, started_at}
session:{session_id}:transcript STRING  full accumulated transcript text
session:{session_id}:form       HASH   {field_id → value} (all filled fields)
session:{session_id}:perio      HASH   {tooth_fdi:point:metric → value}
session:{session_id}:pathology  HASH   {tooth_fdi:condition → true}

TTL: 24 hours (covers overnight if dentist forgets to save)
```

### Pause/resume flow

1. Dentist clicks "Pause" → server writes Redis state snapshot to `sessions` table with `status: 'paused'`
2. Redis keys remain hot (session may resume same day)
3. Next day or after TTL: Redis evicts → resume reads from Postgres snapshot
4. On "Save": flush all state to Postgres, delete Redis keys, mark session `status: 'completed'`

### PostgreSQL session table

```sql
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  dentist_id      UUID NOT NULL REFERENCES users(id),
  template_id     UUID NOT NULL REFERENCES form_templates(id),
  status          TEXT CHECK (status IN ('active','paused','completed')) DEFAULT 'active',
  transcript      TEXT,
  form_state      JSONB,                -- snapshot of filled fields
  started_at      TIMESTAMPTZ DEFAULT now(),
  paused_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);
```

`perio_charts` and `pathology_charts` rows are written on Save (not mid-session), read from Redis during session.

---

## Build Order (Suggested)

Build in this order — each layer unblocks the next:

### Phase 1: Foundation
1. **Multi-tenant auth** — Supabase Auth + RLS policies + tenant/user tables
2. **Patient CRUD** — patient profiles, TC/clinic ID, tenant isolation
3. **Form template editor** — admin UI to create JSONB question sets

### Phase 2: Voice Pipeline (no LLM yet)
4. **MediaRecorder → WebSocket** — browser audio capture, chunk delivery
5. **VAD + Whisper worker** — server-side VAD, Whisper API calls, transcript display via SSE
6. **Session persistence** — Redis hot state, pause/resume, save to Postgres

### Phase 3: AI Form Fill
7. **Transcript → form fields** — per-segment + final-pass LLM structured outputs
8. **Missing field detection + alerts** — confidence scoring, highlight incomplete fields
9. **Dental AI descriptions** — click-to-expand, GPT-4o with dental-only prompt constraint

### Phase 4: Charts
10. **Pathology chart** — SVG 32-tooth visual, voice-driven condition highlighting
11. **Perio chart** — FDI grid, 6-point measurements, blank-not-zero rendering
12. **Tooth disambiguation** — confidence scoring, confirmation modal, quadrant-context weighting

### Phase 5: Hardening
13. **KVKK compliance** — encryption at rest, consent recording, data retention policies
14. **Template versioning** — version pinning for saved sessions
15. **Session history** — patient timeline, past charts, past forms

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Time-based audio chunking
Cuts mid-word. Use VAD boundary chunking. See Q1.

### Anti-Pattern 2: Single large JSON schema for all 60+ fields per segment
Per-segment calls should use domain-grouped schemas (5-15 fields). Full 60-field schema only on final pass. Reduces token cost ~70% and improves extraction precision.

### Anti-Pattern 3: Storing perio measurements as a JSONB blob per tooth
Querying/indexing individual measurement values (e.g., "all teeth with PD > 5mm") becomes impossible. Use flat columns per measurement point.

### Anti-Pattern 4: Applying RLS as an afterthought
Must design tenant_id denormalization into every table from day one. Retrofitting is a full schema rewrite.

### Anti-Pattern 5: Writing 0 for unmentioned perio measurements
NULL means "not examined." 0 means "examined, no pocket depth." Clinical distinction is significant. Enforce NULL at the application layer — never default to 0.

### Anti-Pattern 6: Streaming raw LLM tokens to browser during form fill
Browser cannot render a partial JSON object. Buffer the full structured output, validate, then emit typed SSE events. Stream only the transcript display.

---

## Scalability Notes

| Concern | Current scope | At 10 universities |
|---------|--------------|-------------------|
| Whisper API calls | ~5-10/session | Still API-bound, no infra change |
| Redis session state | 1 key set per session, ~50KB | Trivial |
| RLS performance | Index tenant_id on all tables | Add connection pooling (PgBouncer) |
| WebSocket connections | 1 per active recording | Session duration ~20min max |
| LLM API costs | ~$0.05-0.15/session | Monitor, add caching for common phrases |

---

## Sources

- Whisper streaming: https://github.com/ufal/whisper_streaming, https://arxiv.org/abs/2604.25611
- VAD integration: https://www.f22labs.com/blogs/what-is-vad-and-diarization-with-whisper-models-a-complete-guide/
- Structured Outputs vs JSON mode: https://www.buildmvpfast.com/blog/structured-output-llm-json-mode-function-calling-production-guide-2026
- JSONB vs EAV: https://coussej.github.io/2016/01/14/Replacing-EAV-with-JSONB-in-PostgreSQL/
- Multi-tenant Postgres: https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy
- WebSocket vs SSE: https://dev.to/polliog/server-sent-events-beat-websockets-for-95-of-real-time-apps-heres-why-a4l
- Redis + Postgres hybrid state: https://www.sitepoint.com/state-management-for-long-running-agents-redis-vs-postgres/
- Supabase RLS multi-tenant: https://designrevision.com/blog/supabase-row-level-security
- Whisper API pricing: https://tokenmix.ai/blog/whisper-api-pricing
