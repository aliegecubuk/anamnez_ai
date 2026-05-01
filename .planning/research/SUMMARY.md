# Research Summary: AnamnezAl
**Synthesized:** 2026-05-01 | **Confidence:** MEDIUM-HIGH

---

## Executive Summary

AnamnezAl is a voice-driven dental anamnesis and charting SaaS targeting Turkish dental universities. The core value proposition is genuine whitespace: no Turkish-language voice charting product exists, and all international competitors (Denti.AI, DentScribe, Florida Probe VoiceWorks) are English-only. The technical approach is validated — Whisper large-v3 achieves best-in-class Turkish WER (8% median vs Google's 16.5%), and GPT-4o Structured Outputs provide 100% schema adherence for clinical form extraction.

The highest technical risks are in the voice pipeline: Whisper silence hallucination, tooth number disambiguation (18 vs 28), and LLM field hallucination across 60+ field schemas. These are solvable with known patterns (VAD pre-processing, disambiguation modals, strict null schemas with two-pass extraction) but must be addressed from day one — they cannot be retrofit.

The highest non-technical risk is regulatory. KVKK classifies patient health data as special category data with strict consent, storage, and registration requirements. VERBİS registration must happen before the first real patient record is stored. The market entry risk is that public university procurement (KİK) cycles run 6–18 months — the correct v1 target is private/foundation universities (Medipol, Bahçeşehir, Biruni), not state institutions (Hacettepe, Ankara, Gazi).

---

## 1. Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15, App Router | RSC reduces bundle weight on hospital Wi-Fi; Route Handlers handle SSE natively |
| Database | Supabase PostgreSQL 15, Frankfurt eu-central-1 | RLS enforces multi-tenant isolation at DB layer; Frankfurt satisfies KVKK data residency |
| Auth | Clerk Organizations | Maps directly to university-tenant model; built-in RBAC; half-day setup vs weeks for alternatives |
| STT | OpenAI Whisper API (whisper-1, language: tr) | Best published Turkish WER (8% median vs Google 16.5%); 2.7x cheaper |
| LLM (form extraction) | GPT-4o Structured Outputs | 100% schema adherence via constrained decoding; superior Turkish medical text |
| LLM (descriptions) | Claude Sonnet (claude-3-5-sonnet-20241022) | Superior constrained prose for 3-line dental-only descriptions |
| Hosting | Vercel Pro, functions pinned to fra1 | EU data residency; Pro plan removes 10s timeout needed for Whisper calls |
| UI | shadcn/ui + Tailwind CSS v4 | Full code ownership essential for custom FDI SVG and 6-point perio grid |
| Realtime (server→client) | SSE via Next.js Route Handlers | Unidirectional; no WebSocket server; works through Vercel edge |
| Realtime (audio upload) | WebSocket | Binary frames; needed for audio chunks and disambiguation ACKs |
| Session hot state | Redis (24h TTL) | Active session state; flushed to Postgres on Save |
| Tooth charts | Custom SVG + React | No library has FDI dental chart components |

**MVP simplification:** Use GPT-4o for both form extraction and descriptions in v1 — single vendor, simpler DPA setup. Add Claude for descriptions in v2 if quality warrants.

---

## 2. Table Stakes

| Feature | Basis |
|---------|-------|
| Patient profile (name, TC kimlik, birthdate) | Required identifier in Turkish medical records |
| Structured anamnesis form — all 13 ADO/TDB categories | Malpractice protection |
| Explicit KVKK consent per patient (timestamped) | Law 6698 Article 6 — health data = special category |
| Informed consent (onam) capture | Turkish law: required before every dental procedure |
| FDI 32-tooth visual chart | Every Turkish dentist expects FDI exclusively |
| Manual override on every auto-filled field | Voice errors are expected |
| Missing field warning before save | Required fields flagged; blocking creates alert fatigue |
| Session history per patient | Dentist must see prior anamnesis at follow-up |
| Role auth: dentist + admin minimum | KVKK + institutional requirement |
| Encrypted at rest and in transit | TLS + AES-256 minimum |
| Turkish-language UI | Turkish dental universities will not adopt English interface |

---

## 3. Critical Unknowns / Risks

**Risk 1 — VERBİS Non-Registration (REGULATORY SHUTDOWN)**
Processing health data in Turkey without VERBİS registration = fines up to TRY 13.6M. Clock starts when the first real patient record is stored. Register before any non-test data enters. Budget TRY 5–15K for a law firm. Hard blocker.

**Risk 2 — Whisper Silence Hallucination Corrupting Clinical Records**
When audio contains silence, Whisper fabricates text. LLM maps fabricated text to real form fields. Dentist saves false clinical data. VAD pre-processing before every Whisper call is mandatory. Set `condition_on_previous_text=False`.

**Risk 3 — Tooth Number Ambiguity (Wrong-Tooth Records)**
"Sekiz" spoken without quadrant context maps to 18 or 28. LLM infers wrong quadrant → perio measurement permanently recorded on wrong tooth. Mandatory disambiguation modal for any non-high-confidence tooth mention. FDI validity check server-side on every extracted number.

**Risk 4 — MoH DHBS Accreditation Blocking State University Adoption**
Public dental faculties may be legally required to use accredited DHBS systems. AnamnezAl is not accredited. Target private/foundation universities for v1 (Medipol, Bahçeşehir, Biruni, Altınbaş). State universities via research project budgets only.

**Risk 5 — LLM Hallucinating Form Field Values**
Models invent plausible-looking answers when speech did not address a question. A hallucinated "no known allergies" is indistinguishable from an explicit denial. Three-state schema (value / null / uncertain) required. Two-pass extraction. Every null field surfaced before save.

---

## 4. Architecture Decisions

**Decision 1 — VAD-Boundary Chunking, Not Time-Based**
Time-based chunking cuts mid-word. "Diş on sekiz" takes ~1.2s — a 2s window fragments it. Use Silero VAD on server with 200ms trailing overlap. This is the foundation of the entire voice pipeline.

**Decision 2 — Redis Hot State + Postgres Cold Storage**
Active session state in Redis (24h TTL). Transcript = source of truth: persist raw Whisper output to Redis immediately on receipt, flush to Postgres on Save. IndexedDB browser fallback for network interruption. Never hold unsaved transcript only in browser memory.

**Decision 3 — RLS Tenant Isolation From Day One**
PostgreSQL RLS must be the first schema written, before any application code. `tenant_id` denormalized onto every table with patient data. Cannot be retrofit — a missing WHERE clause after go-live is a KVKK breach.

**Decision 4 — Domain-Grouped Schemas for Per-Segment LLM Calls**
Full 60+ field schema on every segment wastes ~70% of token spend and degrades precision. Group by domain (medications, systemic diseases, allergies, surgical history, lifestyle) and route each segment to the relevant schema via keyword detection. Full schema on final "Stop" pass only.

---

## 5. Immediate Actions Before Writing Code

1. **Register VERBİS** — Before any non-test patient data. Hard blocker. Budget TRY 5–15K legal.
2. **Sign OpenAI DPA** — Default API usage does not auto-enroll. Required before processing real patient audio.
3. **Verify Supabase Frankfurt region** — Create project in eu-central-1. Sign Supabase DPA (Pro plan).
4. **Pin Vercel functions to fra1** — `vercel.json` region config before deploying any patient-data API route.
5. **Draft KVKK consent language** — Must disclose that voice audio goes to OpenAI (USA). KVKK Article 9 cross-border transfer requires explicit patient consent.
6. **Confirm MoH DHBS posture with target customers** — Call 2–3 private university dental faculty admins before writing code.
7. **Benchmark Whisper API latency from Turkish ISPs** — If median exceeds 2s, scope faster-whisper fallback.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Stack | HIGH | WER benchmarks, structured output compliance rates cited |
| Features | MEDIUM | ADO categories corroborated; Turkish market pricing opaque |
| Architecture | HIGH | VAD chunking, RLS, Redis/Postgres patterns well-documented |
| Compliance severity | MEDIUM | Physical server localization in Turkey vs EU unresolved — legal counsel required |

---
*Synthesized from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md — 2026-05-01*
