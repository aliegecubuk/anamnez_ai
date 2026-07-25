# PRODUCT.md — AnamnezAl

register: product

## Product Purpose

Hands-free, voice-driven anamnesis and charting for Turkish clinicians. The clinician speaks; AI transcribes (Whisper, Turkish), structures (GPT-4o), and fills forms/charts. Keyboard and mouse are for review and correction only — the core value is zero cross-contamination and faster, more complete records.

Three modules sharing one architecture and language:
- **Diş (dental)** — anamnesis + periodontology + pathology charts, patient records in Supabase. Accent: teal.
- **Hastane (hospital)** — ephemeral rapid anamnesis for poliklinik/acil; no persistence, Medula copy-paste output, PDF then full reset. Accent: blue.
- **Terapist** — planned. Accent: purple.

## Users

| Role | Context |
|------|---------|
| Diş hekimi / hastane hekimi | Primary. Gloved hands, patient in chair or queue pressure in acil. Reads at arm's length between tasks. |
| Asistan / öğrenci | Same UI under supervision. |
| Superadmin | User list, login audit, role assignment. |

Physical scene: a clinician in a bright clinical room (daylight + overhead fluorescent), glancing at a screen between patients, hands busy. Light theme carries the product; dark variant exists in tokens.

## Brand & Tone

- Turkish UI throughout. Clinical, calm, exact. No marketing voice inside the product.
- Editorial-quiet aesthetic: serif display (Instrument) for page titles, Inter for UI, generous whitespace, hairline borders, uppercase tracked micro-labels.
- Copy is short and imperative ("Kaydı Başlat", "İşle"). Errors state what happened and what to do next.

## Anti-references

- SaaS-blue dashboards, mint/teal healthcare cliché, hero-metric cards, icon+heading+text card grids.
- Anything that reads "template". The palette comment in globals.css is explicit: porcelain ivory + deep ink + restrained ocean accent, "not SaaS-blue, not mint-cliché".

## Strategic principles

1. Hands-free first: every core flow completable by voice; pointer input is review/correction.
2. Zero tolerance on clinical accuracy (tooth numbers, only-explicit extraction — AI never invents content).
3. KVKK: special-category health data; identity stays on device in the hospital module; consent gates before module use.
4. Speed under queue pressure: hospital module optimizes for stop → İşle → Kopyala/PDF in seconds.
