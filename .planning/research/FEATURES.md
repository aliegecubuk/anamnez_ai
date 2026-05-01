# Feature Landscape: Dental Anamnesis & Charting Software

**Domain:** Dental anamnesis + periodontology/pathology charting, Turkish dental universities
**Researched:** 2026-05-01
**Overall confidence:** MEDIUM (Turkish-market pricing opaque; ADO form content partially inferred)

---

## Competitive Landscape

### Turkish Market Players

| Vendor | Type | Anamnez | Perio Chart | Voice | AI | Notes |
|--------|------|---------|-------------|-------|----|-------|
| **NovaSoft** | Desktop + cloud | Yes — custom form designer since 2008 | Basic tooth marking | No | No | Longest-running; universities use it |
| **DentSoft DS4** | Cloud + on-prem | Yes — stored with patient record | Basic | No | No | ISO 27001, KVKK compliant; academic module exists |
| **Saye Dental** | Cloud | Yes | Yes — marks teeth + gum/bone deformity on model | No | No | Ministry of Health accredited DHBS; telemed integration |
| **Kalemzen DHBYS** | Enterprise HIS module | Yes — with contraindication algorithm | Tooth marking + gum/bone | No | Partial (anesthesia dosage calc) | Used by ADSM and faculties; MoH-integrated |
| **Dr.DENTES** | Cloud | Yes | Yes | No | No | SSL/encrypted; private practice focus |
| **AsistDent** | Cloud | Yes | Basic | No | No | "Easiest to use" positioning |
| **Dental Asistanım** | Cloud | Yes | Basic | No | No | SME private practice focus |
| **TRtek** | Enterprise | Yes | Yes | No | No | Used by dental faculties and ADSM hospitals |

### International Voice/AI Charting Players (no Turkish market presence)

| Vendor | Voice Perio | AI Scribe | Language | Pricing |
|--------|-------------|-----------|----------|---------|
| **Florida Probe VoiceWorks** | Yes — voice-activated, 6-point per tooth, pocket depth + recession + bleeding + mobility + furcation + suppuration + plaque + MGJ | No scribe | English only | ~$103/month hardware+software |
| **Denti.AI** | Yes — 99% accuracy claimed, 5 min full chart, AAP staging, accent-agnostic, no training required | Yes — SOAP notes | English only | $399/month (scribe + voice perio) |
| **DentScribe** | Yes — freeform speech, real-time structured output, range commands ("bleeding on 5 through 7"), patent-pending | Yes — full day support | English only | $699/month |
| **Alta AI / Xtnsion AI / Curve FLO** | Partial | Yes | English only | Varies |
| **Dentrix (Henry Schein)** | Hands-free charting module | Limited | English | Enterprise |

**Critical gap confirmed:** No Turkish-language voice charting or voice anamnesis product exists in the market.

---

## Anamnesis Form Standards (Turkey)

### Regulatory Framework

- **ADO (Ankara Dişhekimleri Odası)** publishes and periodically updates the standard "Hasta Anamnez ve Onam Formu" — the de-facto national template used by most faculties and private practices. It was updated recently (exact date not retrieved, but announcement confirmed on ado.org.tr).
- **İDO (İzmir Dişhekimleri Odası)** and regional chambers publish their own versions; all follow ADO structure.
- **YÖK** does not prescribe form content directly; dental faculties follow TDB (Türk Diş Hekimleri Birliği) and regional chamber templates.
- **T.C. Sağlık Bakanlığı DHBYS** (dhbys.saglik.gov.tr) is a national dental information registry system; DHBS-accredited vendors must integrate with it for public institutions.
- Anamnesis forms are legally part of the patient record. Missing or incomplete forms constitute malpractice liability under Turkish medical law.

### Standard Form Question Categories (HIGH confidence — corroborated by ADO, İDO, academic sources)

1. **Genel Sağlık Durumu** — overall health self-assessment
2. **Sistemik Hastalıklar** — cardiovascular disease, diabetes, hypertension, liver/kidney disease, lung disease, epilepsy, thyroid disorders, osteoporosis, HIV/AIDS, cancer/malignancy
3. **İlaç Kullanımı** — current medications (name + dose + duration), including OTC and supplements
4. **Alerji** — medication allergies (especially penicillin/amoxicillin, NSAIDs, local anesthetics, latex), food allergies
5. **Kan Sulandırıcı / Pıhtılaşma** — anticoagulants (warfarin, aspirin, clopidogrel), bleeding disorders, hemophilia
6. **Cerrahi / Hastane Öyküsü** — previous surgeries, hospitalizations, anesthesia complications
7. **Diş Hekimi Geçmişi** — previous dental treatments, phobia, prior complications
8. **Gebelik / Emzirme** — pregnancy status, trimester, breastfeeding
9. **Sigara / Alkol** — smoking (pack/year), alcohol use
10. **Radyasyon Öyküsü** — head/neck radiation therapy history
11. **Kalp Kapağı / Protez** — heart valve, joint prosthesis (antibiotic prophylaxis indicator)
12. **Onam (Informed Consent)** — signature block; legally required pre-treatment
13. **KVKK Onayı** — data processing consent; legally required

Ankara University's "Oral Diagnoz" curriculum (2025-26 open courseware) confirms the full anamnez structure includes subjective complaint, systemic history, medication history, family history, and social history.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or legally risky.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Patient profile (name, TC/ID, birthdate, contact) | Every tool has it; legally required record | Low | TC kimlik is the standard identifier in Turkey |
| Structured anamnesis form with all ADO/TDB categories | Legal requirement; malpractice protection | Medium | Must cover all 13 category groups above |
| Informed consent capture (onam) | Turkish law: every procedure requires signed onam | Medium | Digital signature or typed acknowledgment at minimum |
| KVKK consent capture | Law 6698: health data requires explicit consent | Low | Checkbox + timestamp is sufficient for v1 |
| Tooth chart (visual, FDI numbering) | Expected by every Turkish dentist | High | FDI is locked; 32-tooth visual grid required |
| Manual override of any auto-filled field | Voice will make errors; review is mandatory | Medium | Inline edit on every field |
| Patient session history | Dentist must see past anamnesis at next visit | Medium | List of past sessions per patient |
| Department/template selection | Different departments have different forms | Medium | At minimum: general, periodontology, oral surgery, orthodontics, pedodontics |
| Secure login + role separation | KVKK + institutional requirement | Medium | Dentist vs. admin roles minimum |
| Data encryption at rest and in transit | KVKK strict health data category | Medium | TLS + AES-256 minimum; VERBİS registration for controller |
| Missing field alert before save | Patient safety — incomplete anamnesis = liability | Low | Flag unanswered required questions |
| Condition marking on pathology chart | Basic clinical record requirement | High | Color-coded, multi-condition per tooth |

---

## Differentiators

Features that set AnamnezAl apart. Not expected in the market, but highly valued.

| Feature | Value Proposition | Complexity | Competitive Gap |
|---------|-------------------|------------|-----------------|
| **Turkish STT via Whisper** | First voice-driven anamnesis product in Turkey | High | Zero Turkish-language voice charting tools exist |
| **Voice → form auto-fill (60+ questions)** | Eliminates keyboard/pen during treatment; cross-contamination prevention | Very High | No competitor does this in any language at this scope |
| **Voice → perio chart (FDI, 6-point)** | Hands-free perio in Turkish — Florida Probe/Denti.AI English-only, no FDI support | Very High | FDI + Turkish = total whitespace |
| **Voice → pathology/caries chart** | Tooth condition by voice, color-coded | High | No product does this in Turkish |
| **Dental-specific AI descriptions** | Click-expand for drug interactions, bleeding risk, anesthesia contraindications — dentistry-only, not general medicine | High | Kalemzen has a contraindication algorithm, but no natural language explanations; NovaSoft has none |
| **Disambiguation confirmation (18 vs 28)** | Zero-tolerance tooth accuracy — addresses #1 clinical risk in voice charting | High | Even Denti.AI acknowledges multi-speaker pickup as failure mode; FDI disambiguation is novel |
| **Multi-tenant per-university form templates** | Universities each have custom question sets; admin control | Medium | No Turkish vendor explicitly supports per-department templates with admin UI |
| **Blank ≠ zero semantics on perio chart** | Clinical correctness — unmentioned tooth = healthy, not 0mm | Low | Most tools default to zero; this is a real clinical error source |
| **Session-based workflow** | Voice session scoped to one patient visit; all charts filled in one voice pass | Medium | No tool structures work this way |

---

## Anti-Features

Things that seem useful but cause harm, delay adoption, or violate the product vision.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **PDF export** | Encourages printing → paper → contamination; breaks digital-only intent; already Out of Scope in PROJECT.md | Keep records digital-only; screen sharing for review |
| **Real-time word-by-word transcription display** | Creates cognitive distraction during clinical exam; dentist watches screen instead of patient | Show structured filled-form after session, not raw transcript |
| **Forced command syntax ("say 'tooth 18 pocket depth 2'")** | Dentists speak naturally; rigid commands cause errors and frustration — exactly what Florida Probe's approach suffers from | Natural language NLP: dentist speaks, AI segments |
| **Mandatory field validation that blocks save** | If voice missed something, blocking prevents saving any data; better to warn and allow | Warn on missing required fields; allow save with incomplete flag |
| **Integration with existing HIS/HBYS** | Scope creep, complex procurement, delays launch; already Out of Scope | Independent system first; integration in later phase |
| **Appointment scheduling / billing module** | Changes product category; attracts wrong buyer scrutiny; already Out of Scope | Refer to existing tools for scheduling |
| **Per-user / per-session pricing model** | Universities hate variable cost; unpredictable budgets kill SaaS deals in Turkish public institutions | Flat per-tenant (per-university) annual fee |
| **Mobile-native app** | Adds platform complexity, Apple/Google review delays, no hands-free voice benefit on mobile | Web app with microphone API; works on tablet at chair |
| **General medical AI descriptions** | Dentists don't need "this drug treats hypertension" — they need "this drug causes gingival hyperplasia" | Strict dental/surgical prompt constraints on all LLM calls |
| **Auto-save without review** | A wrong tooth number auto-saved = clinical harm | Explicit dentist review + confirm step before commit |
| **English UI** | Turkish dental universities will not adopt; already Out of Scope | Turkish-only v1 |

---

## Unknown Unknowns (Risks Not in PROJECT.md)

| Risk | Description | Severity | Mitigation |
|------|-------------|----------|------------|
| **MoH DHBS accreditation requirement** | Public dental faculties (state universities) may be legally required to use MoH-accredited DHBS systems (Saye, Kalemzen, TRtek). AnamnezAl is not accredited and cannot integrate with the national DHBS registry without a formal application. This could block adoption at Hacettepe, Ankara, Gazi, etc. | CRITICAL | Target private universities and foundation faculties first (e.g., Bahçeşehir, Medipol, Biruni, Altınbaş). These are not bound by MoH DHBS mandates. Run state university pilots informally under a research project umbrella. |
| **VERBİS registration obligation** | Processing health data (special category under KVKK) as a data controller requires VERBİS registration. Failure = fines up to TRY 13.6M regardless of whether data handling is substantively compliant. | HIGH | Register before first patient data is stored. Budget legal costs (~5K-15K TRY for a law firm to handle registration). |
| **Whisper API latency in clinical setting** | Whisper API is cloud-based; Turkish clinical internet can be slow or unreliable. A 3-second STT lag during active charting is clinically disruptive. | HIGH | Test with local Whisper inference (faster-whisper on CPU) as fallback. Benchmark Whisper API latency on Turkish ISPs before committing. |
| **FDI phonetic ambiguity in Turkish speech** | In Turkish, "on sekiz" (18) and "yirmi sekiz" (28) are phonetically distinct but fast speech compresses them. "On dört" (14) vs "yirmi dört" (24) is a known error pattern. Also: "bir" (1 in local names) vs "bir" in other contexts. | HIGH | Build per-tooth phoneme distance table. Require explicit confirmation for any tooth number within one jaw quadrant of a neighbor with same last digit. |
| **University IT procurement cycle** | Turkish university procurement follows KİK (Kamu İhale Kanunu) public tender law for state universities. A SaaS subscription may require a formal ihale process that takes 6-18 months. | HIGH | Target department-level pilots funded by research budgets (TUBITAK, BAP), not institution-level procurement. Pilot ≠ procurement. |
| **GDPR-equivalent cross-border data transfer** | Whisper API sends audio to OpenAI servers (USA). Under KVKK Article 9, transferring special category (health) data abroad requires either adequate country designation or explicit patient consent + Board approval. Turkey has not designated the USA as adequate. | HIGH | Add explicit patient consent for STT cloud processing in the KVKK onam. Consider offering local Whisper inference as an enterprise option. |
| **Form template version drift** | When an admin updates a form template, old patient records were filled with the old version. Displaying them with the new template makes fields appear empty or mismatched. | MEDIUM | Version-stamp every session with the template version it used. Render historical sessions with their original template schema. |
| **Clinician accent + dialect variation** | Turkey has significant regional accent variation (Black Sea, Southeast, Aegean). Whisper handles this well on average, but "yirmi" in Karadeniz dialect vs Istanbul standard may cause errors. | MEDIUM | Test with accent-varied speakers before clinical deployment. Allow dentist to replay and manually correct any segment. |
| **Student/intern liability boundary** | In teaching clinics, students fill forms under supervisor oversight. If a student's voice input causes a clinical error (wrong tooth charted), liability is unclear. The product must distinguish dentist-confirmed records from student-drafted records. | MEDIUM | Add "reviewed and approved by [supervisor name]" confirmation step for student sessions. |
| **Microphone hygiene in operatory** | The microphone that captures voice is a contamination vector if touched. Wireless headset = another device to sterilize. Ceiling mic = distance reduces accuracy. | MEDIUM | Design for hands-free mic activation (wake word or foot pedal integration). Document recommended mic placement per operatory type. |

---

## Feature Dependencies

```
Patient Profile → Anamnesis Session → Voice → STT → Form Auto-Fill
                                                   → Perio Chart Fill
                                                   → Pathology Chart Fill

Form Auto-Fill → Missing Field Alert → Dentist Review → Session Save
Perio Chart Fill → Disambiguation Confirm → Dentist Review → Session Save
Pathology Chart Fill → Dentist Review → Session Save

Admin → Tenant Setup → Department Template → Question Set
Department Template → Anamnesis Session (template selection)

KVKK Consent Capture → Session Save (blocked without consent)
Onam Capture → Session Save (blocked without consent)
```

---

## MVP Prioritization

**Must ship (no MVP without these):**
1. Patient profile create/search
2. KVKK + onam consent capture (legal gate)
3. Turkish STT (Whisper API) — core differentiator
4. Voice → anamnesis form auto-fill (ADO categories)
5. Missing field alert before save
6. Manual field edit/override
7. Session history per patient
8. Role auth (dentist / admin)

**Ship in second wave:**
1. Voice → perio chart (FDI 6-point)
2. Voice → pathology chart (color-coded)
3. Tooth number disambiguation confirmation
4. AI dental descriptions (click-to-expand)
5. Multi-department template management (admin UI)

**Defer:**
- Department template versioning (important but not day-1)
- Local Whisper inference (after API latency validated)
- Supervisor approval flow for student sessions

---

## Sources

- ADO anamnez form: https://www.ado.org.tr/uyelik/hasta-onam-ve-anamnez-formu
- ADO form update announcement: https://www.ado.org.tr/duyurular/hasta-anamnez-ve-onam-formu-guncellendi
- Ankara University Oral Diagnoz 2025-26 courseware: https://acikders.ankara.edu.tr/pluginfile.php/222727/mod_resource/content/0/ORAL%20D%C4%B0AGNOZ%20G%C4%B0R%C4%B0%C5%9E%202025-26.pdf
- NovaSoft: https://www.novasoft.com.tr/
- DentSoft: https://dentsoft.com.tr/
- Saye Dental / Kalemzen: https://kalemzen.com.tr/urun-dis-hekimligi-bilgi-yonetim-sistemi-3
- MoH DHBYS national system: https://dhbys.saglik.gov.tr/
- Florida Probe VoiceWorks: https://floridaprobe.com/voiceworks.htm
- Denti.AI Voice Perio: https://www.denti.ai/voice-perio
- DentScribe AI Voice Perio: https://www.dentistrytoday.com/dentscribe-launches-ai-voice-perio-charting/
- KVKK overview: https://www.cookieyes.com/blog/turkey-data-protection-law-kvkk/
- VERBİS obligation: https://searchinform.com/resources/how-to/compliance-with-turkish-personal-data-protection-law-kvkk/
- Dental EHR adoption barriers: https://jccpractice.com/article/electronic-health-records-in-dentristry-a-systematic-review-340/
- Voice charting accuracy research: https://ai.dentist/blog/complete-guide-to-voice-activated-clinical-chartin/
- Tooth number AI accuracy: https://pmc.ncbi.nlm.nih.gov/articles/PMC12206106/
