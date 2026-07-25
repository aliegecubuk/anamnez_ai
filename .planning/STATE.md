---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: hospital-module
status: complete
last_updated: "2026-07-25T00:00:00.000Z"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# AnamnezAl — Project State

## ✅ v1.1 COMPLETE — Hastane (poliklinik/acil) modülü + yapılandırılmış anamnez

v1.0 (dental milestone) üzerine eklenenler, hepsi commit'lendi:

- **STT gecikme paketi** — pause-aware segmentasyon (~0.7s sessizlikte kesim, 1.5s min / 8s max),
  3 paralel chunk upload, anında transkript (chunk POST yanıtından, SSE yedeğiyle dedupe),
  `gpt-4o-mini-transcribe` modeli + domain prompt'u, chunks route'ta paralel ownership+formData,
  stop() için bounded drain (15s), state PATCH'lerinde 8s timeout.
- **Tek ekran seans workspace** — `SpeechInputPanel` (düzenlenebilir cümle listesi) + form/chart
  aynı anda canlı; "önce seansı bitir" kapısı yok. TemplatePicker kaldırıldı (sabit 10 bölümlü layout).
- **Yapılandırılmış anamnez (diş)** — Hacettepe formu 10 sabit bölüm
  (`gen_sikayet, gen_vital, oz_cocukluk, oz_dis, oz_genel, soy_sahsi, soy_ekstraoral,
  soy_intraoral, mua_hijyen, mua_radyoloji`), ilaç çıkarımı + dental ilaç kartları,
  AI ön değerlendirme raporu. API: `/api/sessions/[id]/structured`, `/api/sessions/[id]/report`.
- **PDF çıktıları (pdfmake)** — anamnez, perio, hastane PDF'leri (`src/lib/pdf/`).
- **Perio grid rework** — PATCH merge (bleeding toggle artık cep derinliğini silmiyor),
  DELETE /perio (draft temizleme), UI yenilemesi.
- **Hastane modülü** — `/hospital`, tamamen ephemeral (DB yok, session satırı yok):
  kimlik paneli (cihazda kalır) → transkriptte isim/TC/telefon maskeleme (`***`,
  Türkçe-aware) → stateless `/api/hospital/transcribe` + `/api/hospital/extract` →
  düzenlenebilir Q&A kartları → Medula metni (clipboard) + PDF → sıfırlama.
  İki mod: `hizli` (Acil — sadece kritik başlıklar) / `detayli` (Poliklinik — kapsamlı).
- **Modül seçici** — `/modules` (Diş → /dashboard, Hastane → /hospital, Terapist kaldırıldı).
  `/` sign-in sonrası `/modules`'e düşer. `KvkkGate` modül bazlı onay (localStorage, v1 metin).
- **useChunkedRecorder genellemesi** — opsiyonel `chunkUrl` (stateless mod) + `onSegment` callback.

### Pre-production checklist

- [x] Migrations applied to remote Supabase — verified 2026-07-25 (all 15 tables present via REST)
- [ ] VERBİS registration complete
- [ ] OpenAI DPA signed
- [ ] Supabase DPA signed (Pro plan)
- [ ] Vercel functions pinned to `fra1` in `vercel.json`
- [ ] KVKK + onam consent language reviewed by Turkish legal counsel (KvkkGate metni hâlâ taslak)
- [ ] Cross-border transfer disclosure (OpenAI US) in consent form
- [ ] E2E tests (Playwright) — `e2e/` currently empty; hospital + dental flows

## Phase Status

| # | Phase | Status | Key commit |
|---|-------|--------|------------|
| 1 | Temel Altyapı | ✅ Complete | pre-pivot |
| 2 | Hasta Yönetimi | ✅ Complete | `9e56ae8` |
| 3 | Ses Boru Hattı | ✅ Complete | `2ac2251` |
| 4 | Anamnez Motoru | ✅ Complete | `1f1d0ef` |
| 5 | Dental AI Açıklamaları | ✅ Complete | `0a6e27d` |
| 6a | Periodontoloji Chartı | ✅ Complete | `1224445` |
| 6b | Patoloji Chartı | ✅ Complete | `1224445` |
| 7 | Yapılandırılmış Anamnez + STT latency (v1.1) | ✅ Complete | v1.1 batch |
| 8 | Hastane Modülü (poliklinik/acil) | ✅ Complete | v1.1 batch |

## Architecture decisions (locked)

| Layer | Choice |
|-------|--------|
| Audio transport | POST multipart per chunk (3 parallel uploads) |
| STT model | gpt-4o-mini-transcribe, language: tr, dental domain prompt |
| Segmentation | Pause-aware: 0.7s tail silence cut, 1.5s min / 8s max, VAD RMS 0.03 |
| Server→client | SSE EventSource (replay/backup) + chunk POST response (instant render) |
| LLM | GPT-4o Structured Outputs |
| Form mapping | Strict json_schema response_format |
| Structured anamnesis | 10 fixed sections (Hacettepe), anamnesis_entries/medications/reports tables |
| Description cache | dental_descriptions (user-scoped, UNIQUE term_key+category) |
| Perio chart | perio_charts + perio_measurements (immutable after status=saved; PATCH merges) |
| Pathology chart | tooth_conditions (upsert on conflict) |
| Disambiguation | <70% confidence → DisambiguationModal queue |
| Hospital module | Fully ephemeral — no DB, identity stays on device, masked transcript |
| Module consent | KvkkGate per module (dis/hastane), localStorage, text version v1 |

## Test Mode (active since 2026-05-07)

Flat single-user, no orgs. RLS via `user_id = auth.jwt() ->> 'sub'`.
Routes: `/modules`, `/dashboard`, `/patients`, `/patients/[id]`, `/hospital`.
APIs: `/api/patients/*`, `/api/sessions/*`, `/api/descriptions`, `/api/hospital/*`.
