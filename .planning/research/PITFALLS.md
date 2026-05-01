# Domain Pitfalls: AnamnezAl

**Domain:** Voice-driven medical charting SaaS (dental anamnesis + tooth charting)
**Researched:** 2026-05-01
**Overall confidence:** HIGH for categories 1, 3, 5, 6, 8 — MEDIUM for 2, 4, 7

---

## Critical Pitfalls

Mistakes that cause data loss, clinical harm, or regulatory shutdown.

---

### Pitfall 1: Whisper Hallucination on Silence and Session Pauses

**What goes wrong:** When audio contains silence (dentist pauses, steps away, takes a call), Whisper fills the silence with fabricated text. Characteristic artifacts: repeated loop of the last few transcribed words, "subtitles by..." / "teşekkür ederim" boilerplate, or completely invented clinical-sounding sentences. The model's `condition_on_previous_text=True` default compounds this — each chunk primes the next, so a hallucinated phrase propagates forward as if it were said.

**Why it happens:** Whisper was trained on web video data which contains subtitle credits, intro/outro speech, and filler during silence. The model learned these patterns. Short final audio chunks relative to the priming context trigger disambiguation failure.

**Consequences:** The LLM downstream receives hallucinated text and maps it to real form fields. A dentist who doesn't review carefully saves fabricated clinical data — allergies, diagnoses, pocket depths — that were never stated.

**Prevention:**
- Enable Voice Activity Detection (VAD) before sending audio to Whisper — strip non-speech segments entirely. Libraries: `silero-vad`, `webrtcvad`.
- Set `condition_on_previous_text=False` for chunked/streaming transcription.
- Post-process: detect repetition patterns (same phrase 3+ times in 5 seconds = hallucination signal) and flag the segment for manual review.
- Never send audio chunks shorter than 1 second to Whisper.
- Show dentist the raw transcript alongside the filled form — never hide it.

**Detection:** Repetition detector on transcript text. Segment confidence scores below threshold. Timestamp anomalies (whisper-timestamp library exposes per-token probabilities).

**Phase to address:** Phase 1 (STT pipeline). Must be solved before any clinical data can be trusted.

---

### Pitfall 2: Tooth Number Confusion — "On Sekiz" vs "Yirmi Sekiz" (18 vs 28)

**What goes wrong:** Turkish number words for FDI tooth pairs are acoustically similar and contextually ambiguous:
- 18 / 28 = "on sekiz" / "yirmi sekiz" — differ only in the prefix
- 14 / 24 = "on dört" / "yirmi dört"
- 11 / 21 = "on bir" / "yirmi bir"
- 41 / 31 = "kırk bir" / "otuz bir" (lower jaw, less confusable but still a risk)

Whisper transcribes to text correctly ("on sekiz") in most cases, but the real danger is when the dentist speaks quickly and drops the prefix — "sekiz, 2mm" — relying on context from a previously stated quadrant. The LLM must infer which "sekiz" was meant. If the LLM infers wrong, a perio measurement is filed under the wrong tooth. This is a clinical harm scenario.

**Published evidence:** ASR transcription accuracy studies on orthodontic clinical records found clinically significant error rates of 2–66% across ASR systems. Even with LLM correction (GPT-4o), tooth-level errors in dental records remain a documented risk (King's College London / PubMed 2024). No Turkish-specific tooth number confusion study found, but the general pattern is well established.

**Why it happens:**
- Dentists in clinical settings often use shorthand ("sekiz" not "on sekiz") expecting the listener to track quadrant context.
- Whisper has no dental chart context — it transcribes phonetically, not contextually.
- The LLM has context from the conversation but can still assign to wrong quadrant if the dentist never made the quadrant explicit.

**Consequences:** Tooth 18 measured as tooth 28. Permanent clinical record error. If chart is printed or used for treatment planning, wrong tooth is operated on.

**Prevention:**
1. **Explicit quadrant anchoring in UI.** Before the dentist starts charting a jaw quadrant, they must say (or the UI confirms) "üst sağ" / "üst sol" / "alt sağ" / "alt sol". The LLM receives this as locked context.
2. **Ambiguity detection + confirmation prompt.** If the LLM cannot determine quadrant with >95% confidence, it must NOT fill the field — it must flag it as ambiguous and prompt the dentist: "Diş 18 mi 28 mi?" Dentist answers verbally.
3. **Visual confirmation before save.** The perio chart must display filled teeth color-coded so the dentist sees at a glance which teeth were populated. Wrong tooth is immediately visible.
4. **FDI validity check.** After LLM extraction, validate every tooth number against the FDI set {11-18, 21-28, 31-38, 41-48}. Any number outside this set is a parse failure, not a datum.
5. **Zero-filling prevention.** Unmentioned teeth must remain blank. An LLM that fills "0mm" for unmentioned teeth masks the error signal — blank means "not recorded," 0 means "measured zero."

**Detection:** Validate extracted tooth numbers against FDI set server-side. Log all ambiguity flags. Audit trail showing which teeth triggered disambiguation.

**Phase to address:** Phase 2 (Perio chart). This pitfall must be the primary design constraint for that phase, not an afterthought.

---

### Pitfall 3: LLM Hallucinating Form Field Answers

**What goes wrong:** The dentist's speech is conversational and incomplete. The LLM maps transcript to 60+ form fields. When a question is not addressed in the speech, the LLM may invent a plausible answer rather than leaving the field blank. In medical form-fill contexts, GPT-class models have been shown to produce hallucination rates that make them unsafe as standalone clinical tools (ChatGPT 3.5 achieved only 47% accuracy in drug interaction tasks; even GPT-4 variants "occasionally made unsafe recommendations" in dental anesthesia contexts).

**Why it happens:**
- LLMs are trained to be helpful and complete — leaving fields blank feels like failure to the model.
- Medical language is dense with negations ("no known allergies") that LLMs frequently mishandle.
- Long transcripts cause the model to lose track of which questions were answered vs. skipped.

**Consequences:** A patient's allergy is marked "none" when they mentioned no allergies — but also mentioned no peanut allergy. The dentist sees a complete-looking form and skips review. Anaphylactic reaction during treatment.

**Prevention:**
1. **Strict output schema with explicit null.** The LLM prompt must define a JSON schema where every field has three states: filled value, `null` (not mentioned), `uncertain`. Instruct: "If the transcript does not explicitly address a field, return null. Never infer. Never fill from general medical knowledge."
2. **Separate extraction from inference.** First pass: extract only what was explicitly said (atomic facts, chain-of-thought). Second pass: map extracted facts to form fields. This two-step approach reduces hallucination significantly (PMC clinical note research found rates as low as 1.47% with optimized prompting).
3. **Missing field alerts are non-negotiable.** Every `null` field must be shown to the dentist as a gap requiring attention before save is allowed.
4. **Confidence scoring.** Require the LLM to output a confidence score per field. Below threshold (e.g., 0.8) → surface for manual review even if a value was returned.
5. **Negation handling.** Prompt must explicitly instruct: "Distinguish between 'patient denied X' and 'patient did not mention X' — these are different states."

**Detection:** Track fields that are filled vs. null vs. uncertain per session. High fill rate on ambiguous questions is a red flag. Periodic spot-audit of sessions.

**Phase to address:** Phase 1 (anamnesis form fill). Core to the LLM prompt architecture from day one.

---

### Pitfall 4: AI Dental Descriptions Giving Confident But Wrong Drug-Interaction Information

**What goes wrong:** The click-to-expand dental description for a medication says "safe with epinephrine-containing local anesthetics" when in fact the drug (e.g., a specific MAOI, beta-blocker, or tricyclic antidepressant) has a documented dangerous interaction. Or: the description is generic and misses a Turkish-market-specific formulation or dosage that changes the interaction profile. The dentist sees a 3-line AI-generated note and trusts it.

**Published evidence:** British Dental Journal (2026) published specifically on AI hallucination risks in dental contexts. Studies show LLMs generate clinically inaccurate drug information, and this risk is highest for rare drugs and complex interactions. ChatGPT-4 was found to "underestimate risk and omit necessary considerations" in dental anesthesia management plans.

**Why it happens:**
- LLMs have no real-time access to updated drug databases (unless RAG is implemented).
- Drug interaction knowledge is highly version-sensitive — a new contraindication published after the model's training cutoff is simply unknown to it.
- "Dental-specific" prompting may cause the model to confidently apply dental framing to incorrect base facts.

**Consequences:** Dentist skips interaction check assuming AI vetted it. Patient harmed. Legal liability. Regulatory action.

**Prevention:**
1. **Mandatory disclaimer on every AI-generated description.** Non-negotiable. "Bu bilgi yapay zeka tarafından üretilmiştir. Klinik kararlar için bağımsız doğrulama yapınız." Must be visible, not collapsed.
2. **Hedge high-risk categories explicitly.** For any drug in anticoagulant, MAOI, beta-blocker, or antiplatelet class, the description must include: "Bu ilaç sınıfı yerel anestezi ile kritik etkileşim riski taşıyabilir — güncel kaynaktan doğrulayınız."
3. **RAG over trusted drug database.** Connect to a verified, maintained drug interaction database (e.g., DrugBank, or Turkish TITCK drug registry) via retrieval-augmented generation rather than relying on LLM training weights. This is the only way to get current, accurate interaction data.
4. **Do not use this feature as a decision tool.** Position it explicitly as a memory aid / attention prompt, not a clinical decision support system. The UI must communicate this distinction.
5. **Flag unknown drugs.** If the drug is not found in the RAG source, say so explicitly rather than falling back to LLM knowledge.

**Detection:** Periodic audit of generated descriptions against authoritative sources. Flag sessions where a high-risk drug class was transcribed — those descriptions warrant manual expert review.

**Phase to address:** Phase 2 or 3 (dental descriptions feature). RAG architecture must be scoped at the start of this phase, not retrofitted.

---

## Moderate Pitfalls

---

### Pitfall 5: Multi-Tenant Data Isolation Failures

**What goes wrong:** University A's patient data is accessible to dentists logged in as University B. This is rarely a single obvious bug — it emerges from accumulated small shortcuts: a missing `WHERE clinic_id = ?` clause in one query, a background job that runs without tenant context, a cache key that doesn't include tenant ID, or async context losing the tenant scope across an await boundary.

**Published patterns (OWASP, Redis, Medium):**
- **Connection pool contamination:** RLS (Row-Level Security) policy set for one connection leaks to another connection recycled from the pool under a different tenant.
- **Shared cache poisoning:** Redis key `patient:123` returns a different tenant's patient because the key didn't include tenant scope.
- **Async context leak:** `tenantId` stored in a Node.js AsyncLocalStorage context is lost across async boundaries if the context propagation is not correctly wired.
- **Background worker blindness:** A job that sends "session complete" emails or runs cleanup jobs has no request context — it must explicitly scope every query.

**Consequences:** KVKK breach. University patients' health data exposed to another institution. Regulatory fine up to TRY 17 million per violation. Reputational destruction in a market where trust is everything.

**Prevention:**
1. **Postgres Row-Level Security as the last line of defense.** Even if application logic fails, RLS policies at the DB level prevent cross-tenant reads. Use `SET app.current_tenant_id = ?` per connection and policy `USING (clinic_id = current_setting('app.current_tenant_id')::uuid)`.
2. **Tenant ID in every cache key.** Pattern: `tenant:{tenantId}:patient:{patientId}`. No exceptions.
3. **Middleware that injects + validates tenant context on every request.** Never trust the client to send tenant ID — derive it from the authenticated JWT.
4. **Background jobs explicitly scoped.** Every job payload must carry `tenantId`. Every DB query in a job must include tenant filter.
5. **Automated cross-tenant leak test in CI.** Create two test tenants, create records for each, attempt to access each record with the other tenant's session — assert 403 or empty result. Run this on every PR.

**Detection:** Audit log of patient record accesses with tenant_id + requesting_user_tenant_id. Mismatch = immediate alert. Automated cross-tenant tests in CI pipeline.

**Phase to address:** Phase 1 (authentication + multi-tenancy). This is foundational — cannot be patched in later. The RLS schema must be designed before any patient data model is written.

---

### Pitfall 6: KVKK Compliance Failures for Health Data

**What goes wrong:** Health data is "özel nitelikli kişisel veri" (special category personal data) under KVKK Article 6. The obligations are stricter than GDPR in some ways and the enforcement posture is active. Common ways companies get in trouble:

**Specific failure modes:**

**a) Missing explicit consent flow.** Consent for processing health data must be:
- Specific (not bundled with general terms of service)
- Informed (patient must understand what data is processed and why)
- Freely given (cannot be condition of receiving care — this is legally contested for clinical software)
- Recorded and auditable
Missing or generic consent = immediate violation.

**b) VERBİS non-registration.** All data controllers processing personal data in Turkey above defined thresholds must register data processing activities in VERBİS before processing begins. Processing health data before registration = violation.

**c) Server localization.** The Ministry of Health's regulations on health software (Sağlık Yazılımları Yönetmeliği) require that certain categories of health data be stored on servers physically located in Turkey. Using AWS eu-west-1 (Ireland) or us-east-1 without a Turkish region may be non-compliant. Verification with Turkish legal counsel is required — this is a MEDIUM confidence finding.

**d) Breach notification deadline.** 72-hour notification requirement to KVKK authority AND affected individuals after discovering a data breach. Most SaaS companies have no breach detection, no notification workflow, and no template ready. The 72-hour clock starts from discovery, not from when the breach occurred.

**e) Data retention policies.** Health data cannot be kept indefinitely. Retention period must be defined, documented, and enforced. A system with no deletion workflow will eventually violate this.

**f) Data processor agreements.** OpenAI (Whisper API) and LLM providers are data processors. A signed Data Processing Agreement (DPA) with each provider is required. OpenAI has a standard DPA but it must be explicitly invoked; default API usage does not auto-enroll.

**Prevention:**
1. Implement explicit per-patient consent collection at patient profile creation. Store consent timestamp, version, and scope.
2. Register with VERBİS before launching any beta.
3. Use a Turkish cloud region (Azure Turkey North / AWS — verify current availability) or a Turkish-based provider (e.g., Turkcell Cloud).
4. Build breach detection alerting and a documented 72-hour response playbook before go-live.
5. Define and implement data retention TTL per data category. Automate deletion.
6. Execute DPAs with OpenAI and any other AI provider before processing real patient data.

**Detection:** Compliance checklist gated at go-live. Legal counsel review of consent flows before production launch.

**Phase to address:** Phase 1 must establish the consent model and data architecture. VERBİS registration is pre-launch. DPAs are pre-beta. Retention policies are pre-go-live.

---

### Pitfall 7: Session Continuity — Partial Data Loss on Interruption

**What goes wrong:** Dentist starts a session, speaks for 8 minutes capturing perio measurements, is called away for a patient emergency. Tab is left open. Browser session expires, network drops, or tab is accidentally closed. When they return: blank form, empty chart, 8 minutes of data gone. With no keyboard fallback (hands-free requirement), the dentist cannot re-enter the data manually without de-gloving.

**Why it happens:**
- Transcript exists only in browser memory until explicitly saved.
- Whisper results returned from API are not persisted server-side by default.
- Form state lives in React component state — a tab reload destroys it.
- Medical sessions are long (10–20 minutes) and interruption rate is high in clinical settings.

**Consequences:** Dentist loses trust in the system after one data-loss incident. Adoption collapses. Clinical workflows revert to paper.

**Prevention:**
1. **Server-side draft persistence.** Every 30 seconds of transcribed audio, save a draft to the database. Draft state: `{transcript_raw, form_fill_partial, chart_state, timestamp}`. Auto-resume on next page load for the same session.
2. **IndexedDB fallback.** If the API call to save draft fails (network loss), buffer to IndexedDB locally. Sync when connectivity returns.
3. **Session recovery UI.** On page load, if an unfinished session draft exists, show: "Yarım kalan seans bulundu — devam et / sil" (Unfinished session found — continue / discard).
4. **Transcript is the source of truth.** Store the raw Whisper transcript server-side immediately upon receiving it. Form fill and chart can be re-derived from transcript. Transcript loss = unrecoverable. Form fill loss = recoverable.
5. **Audio buffering.** For live streaming mode, buffer audio client-side (IndexedDB) and upload progressively. Do not hold unsent audio only in memory.

**Detection:** Sessions with no save event after >5 minutes of activity are candidates for data loss. Monitor and alert.

**Phase to address:** Phase 1 (core STT pipeline) must include transcript persistence. Phase 2 (charts) must include chart draft autosave.

---

### Pitfall 8: Browser Compatibility — MediaRecorder API Failures

**What goes wrong:** MediaRecorder API has meaningful cross-browser inconsistencies that cause silent failures, wrong audio formats, or microphone permission UI that confuses non-technical clinical staff.

**Specific failure modes:**

**a) Audio format mismatch.** Chrome produces WebM/Opus. Safari (iOS/macOS) produces MP4/AAC or does not declare a MIME type at all. If the backend hardcodes `audio/webm` when sending to Whisper API, Safari sessions fail with encoding errors. Whisper API accepts: `mp3, mp4, mpeg, mpga, m4a, wav, webm`. The format must be detected dynamically and the correct content-type header sent.

**b) Safari MediaRecorder support.** Safari only added MediaRecorder in version 14.1 (released 2021). Older Safari = no recording. macOS Safari has additional quirks with MIME type declarations — specifying a MIME type in the MediaRecorder constructor options breaks it; omit the MIME type and let Safari choose.

**c) Microphone permission UX.** Browsers prompt for microphone permission once per origin. If the dentist clicks "Block" (common in hospital environments where browser popups are reflexively dismissed), the session cannot start. There is no second automatic prompt — the user must manually go to browser settings to re-enable. Clinical staff will not know how to do this and will report the app as broken.

**d) HTTPS requirement.** `getUserMedia` (microphone access) is blocked on HTTP origins in all modern browsers. If the app is deployed without HTTPS (staging environment, internal network), microphone will not work and the error message ("Permission denied" or silent failure) is not self-explanatory.

**e) Background tab throttling.** Chrome throttles timers and some APIs in background tabs. If a clinical workflow involves switching tabs (looking up a drug, checking another system), an active recording or timer may be suspended.

**Prevention:**
1. **MIME type detection.** Use `MediaRecorder.isTypeSupported()` to probe in order: `audio/webm;codecs=opus`, `audio/mp4`, `audio/ogg;codecs=opus`. Use the first supported type. Send detected MIME type as `Content-Type` header to Whisper.
2. **Safari explicit handling.** If no MIME type is supported or detection fails, create `MediaRecorder` with no options — let the browser choose. Log the actual output format from `recorder.mimeType` after start.
3. **Microphone permission pre-check UI.** Before a session starts, call `navigator.permissions.query({name: 'microphone'})`. If `state === 'denied'`, show a clear browser-specific guide: "Chrome'da mikrofon izni nasıl verilir" with screenshots. Do not silently fail.
4. **HTTPS enforcement.** Enforce HTTPS in production. Staging must also use HTTPS (Let's Encrypt, or ngrok for local dev).
5. **Keep-alive ping.** While recording is active, send a heartbeat every 30 seconds to prevent connection timeout and to signal the browser tab is active.
6. **Chrome-first, Safari-second.** The target environment is clinical desktop (Chrome). Safari support is for tablets/iPads used by some clinics. Mobile Safari is explicitly not in scope for v1 — do not invest in iOS audio quirks beyond basic compatibility.

**Detection:** Log `MediaRecorder.mimeType` for every session. Log permission state at session start. Monitor error rates by browser/OS combination.

**Phase to address:** Phase 1 (STT pipeline). MIME type handling must be correct from the first recording implementation.

---

## Minor Pitfalls

---

### Pitfall 9: Turkish Agglutinative Morphology Causing STT Word Boundary Errors

**What goes wrong:** Whisper research on Turkish confirms specific morphological error types: suffix/conjunction attachment errors ("de"/"da" written separately vs. attached), word merging when adjacent sounds are similar, and conjunction misidentification. In a dental context: "antibiyotikle birlikte" (with antibiotic) might be merged or the "le" suffix dropped, changing the clinical meaning.

**Prevention:** LLM form-fill prompt must work on semantic intent, not exact word match. Test suite should include common Turkish morphological variations of dental vocabulary (ilaç/ilaçla/ilaçlar, diş/dişin/dişe, etc.).

**Phase to address:** Phase 1 (STT + LLM prompt engineering).

---

### Pitfall 10: Form Template Versioning Breaking Historical Records

**What goes wrong:** Admin updates a department's question template (adds a new question, removes an old one). Past sessions were filled using the old template. Viewing a historical session with the new template schema causes misaligned fields, missing questions, or form rendering errors.

**Prevention:** Store `template_version_id` with every session. Always render a historical session with the template version it was created under. Templates are immutable once used — create a new version, never edit in place.

**Phase to address:** Phase 3 (admin template management). Must be designed before the first template is used in production.

---

### Pitfall 11: Overconfident Missing-Field Alerts Leading to Alert Fatigue

**What goes wrong:** The system flags 15 missing fields after every session because the dentist didn't answer questions that are not relevant to this patient. Dentist clicks through all alerts dismissing them. When a genuinely important missing field appears (allergy not captured), it's dismissed with the others.

**Prevention:** Distinguish between required fields (allergies, current medications, systemic diseases) and optional fields. Only block save on required missing fields. Optional missing fields: soft warning, not a blocker. Configure field priority in the template admin.

**Phase to address:** Phase 2 (missing field detection feature).

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| STT pipeline | Whisper silence hallucination | VAD pre-processing, condition_on_previous_text=False |
| STT pipeline | Turkish morphological errors | Semantic LLM extraction, not string matching |
| STT pipeline | MediaRecorder MIME type mismatch | Runtime format detection per browser |
| STT pipeline | Microphone permission denied | Pre-check UI with browser-specific instructions |
| Anamnesis form fill | LLM hallucinating answers | Strict null schema, two-pass extraction, confidence scores |
| Anamnesis form fill | Alert fatigue from missing fields | Required vs. optional field priority in template |
| Auth + multi-tenancy | Cross-tenant data leak | Postgres RLS, tenant-scoped cache keys, CI leak tests |
| Auth + multi-tenancy | KVKK VERBİS non-registration | Register before any real data is processed |
| Patient data model | KVKK consent flow missing | Per-patient explicit consent at profile creation |
| Patient data model | KVKK breach notification | Build detection + 72h playbook before beta |
| Perio chart | Tooth 18 filed as 28 | Quadrant anchoring, ambiguity confirmation, FDI validation |
| Perio chart | Blank vs. zero confusion | Schema enforces null for unmentioned teeth, never 0 |
| Session UX | Partial data loss on interruption | 30s server draft, IndexedDB fallback, recovery UI |
| Dental descriptions | AI confident wrong drug interaction | RAG over drug DB, mandatory disclaimer, hedge high-risk classes |
| Form templates | Version breaking historical records | Immutable templates, version_id stored with every session |

---

## Sources

- Whisper hallucination on silence: [openai/whisper Discussion #679](https://github.com/openai/whisper/discussions/679), [Memo AI](https://memo.ac/blog/whisper-hallucinations), [Careless Whisper: STT Hallucination Harms (arxiv)](https://arxiv.org/html/2402.08021v2)
- Whisper Turkish WER benchmarks: [MDPI Electronics 13/21/4227](https://www.mdpi.com/2079-9292/13/21/4227), [IEEE Xplore Turkish Whisper fine-tuning](https://ieeexplore.ieee.org/document/10304891/)
- Dental ASR accuracy and tooth-level errors: [PubMed 41178647](https://pubmed.ncbi.nlm.nih.gov/41178647/), [Kevin O'Brien Ortho Blog](https://kevinobrienorthoblog.com/how-reliable-is-automatic-speech-recognition-for-orthodontic-records/)
- LLM hallucination in medical contexts: [PMC Clinical Safety Framework](https://pmc.ncbi.nlm.nih.gov/articles/PMC12075489/), [Mitigating Hallucinations in Healthcare LLMs](https://arxiv.org/pdf/2512.16189)
- Drug interaction AI accuracy: [ScienceDirect / PMC comparative evaluation](https://pmc.ncbi.nlm.nih.gov/articles/PMC12712589/), [BDJ AI hallucination risks](https://www.nature.com/articles/s41415-026-9583-0)
- Multi-tenant isolation patterns: [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html), [Redis data isolation guide](https://redis.io/blog/data-isolation-multi-tenant-saas/), [Medium: RLS failure modes](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- KVKK health data: [Recording Law KVKK 2026 guide](https://www.recordinglaw.com/world-laws/world-data-privacy-laws/turkey-data-privacy-laws/), [Alfalaw 2025 updates](https://alfalawfirm.com/kvkk-2025-updates-a-compliance-guide-for-companies/), [Mondaq health data amendments](https://www.mondaq.com/turkey/data-protection/1726006/important-amendments-made-to-the-regulat%C4%B1onon-on-personal-health-data), [Prighter VERBİS guide](https://prighter.com/resources/turkish-kvkk-verbis-registration/)
- MediaRecorder compatibility: [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [Can I Use](https://caniuse.com/mediarecorder), [iPhone Safari MediaRecorder + transcription](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription)
- Session autosave patterns: [Medium autosave patterns](https://medium.com/@brooklyndippo/to-save-or-to-autosave-autosaving-patterns-in-modern-web-applications-39c26061aa6b)
