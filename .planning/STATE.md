---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: field-feedback
status: complete
last_updated: "2026-07-25T21:00:00.000Z"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# AnamnezAl — Project State

## ✅ v1.3 — Hastane: hasta geçmişi (etiketli, süreli kayıt) + güçlendirilmiş KVKK metni

- **Geçmiş kayıtları** — workspace'teki düzenlenmiş Q&A kartları + fizik muayene + Medula metni +
  AI özet, doktorun verdiği etiketle ("14:30 göğüs ağrısı") sunucuya kaydedilir; ham transkript,
  ayırıcı tanılar ve PDF saklanmaz. Kimlik hâlâ cihazdan çıkmaz. Migration:
  `20260810000001_hospital_records.sql` (`hospital_records` + `hospital_settings`, pivot RLS kalıbı).
- **Saklama süresi** — 30/90/120/240/365 gün veya "otomatik silme yok"; kayıt anında kullanıcının
  o anki ayarından `expires_at` hesaplanır (snapshot). Süre değişikliği yalnız yeni kayıtlara
  uygulanır. Ayar yoksa varsayılan 365 gün.
- **Silme** — lazy purge (`GET /api/hospital/records` başında) + günlük Vercel cron
  (`/api/cron/hospital-purge`, `17 3 * * *`, Bearer `CRON_SECRET`); listeden manuel silme
  iki aşamalı confirm'li.
- **API** — GET/POST `/api/hospital/records`, DELETE `/api/hospital/records/[id]`,
  GET/PUT `/api/hospital/settings` (hepsi Clerk `auth()` + user_id filtresi).
- **UI** — workspace üstünde açılır `HospitalHistory` (liste + salt-okur detay + silme +
  saklama süresi select'i); workspace'te "Kaydet" butonu + etiket dialog'u. PDF sonrası
  sıfırlama davranışı aynen korunur.
- **KVKK v2** — hastane metni modül bazlı ayrıldı ve güçlendirildi: veri sorumlusu
  placeholder'ları, veri kategorileri, m.6/2 açık rıza, Supabase AB/Frankfurt + OpenAI ABD
  aktarımı, saklama süresi, m.11 hakları + başvuru yöntemi. ⚠️ Metin hâlâ taslak — hukukçu
  onayı açık madde (metinde görünür not var).
- **Kapsam dışı (bilinçli)** — kaydı workspace'e geri yükleme, PDF arşivi, `dis` modülü KVKK
  metninin yeniden yazımı.

## ✅ v1.2 COMPLETE — Saha feedback paketi (gerçek hastane testi)

Gerçek bir hastanede benzer ürünün saha testinden gelen kritik feedback üzerine:

- **Doğruluk (P0)** — tüm GPT-4o çağrılarında `temperature: 0`; hastane çıkarımında her entry
  zorunlu `source_quote` taşır, transkriptte ground olamayanlar deterministik olarak `dropped`'a
  düşer (hallucination kapısı) ve UI'da "doğrulanamayan ifadeler" olarak gösterilir.
- **Negatif başlıklar (P0)** — yalın "yok" cevapları Medula/PDF'te artık başlıklı ("İlaç alerjisi: Yok").
- **Fizik Muayene (P1)** — `exam_entries` grubu (vital bulgular + muayene), ayrı Q&A grubu,
  Medula paragrafı ve PDF bölümü.
- **Checklist (P1)** — mod bazlı kritik konular; sorulmayanlar amber çip, tıklayınca boş satır.
- **AI Insight (P2)** — düzenlenmiş Q/A'dan klinik özet paragrafı + olası ayırıcı tanılar +
  kırmızı bayraklar (GPT-4o, temp 0; ham transkript ve kimlik ASLA gönderilmez). Disclaimer sabit;
  PDF'e yalnız özet girer, ayırıcı tanı ekranda kalır. ⚠️ TİTCK tıbbi cihaz sınırı — hukuki inceleme şart.
- **Şikâyet çipleri (P2)** — mod bazlı hızlı çipler; işaret eden hastalar için doktor tekrarı yükünü azaltır.
- **Mikrofon seçici (P3)** — harici/yaka mikrofonu, localStorage kalıcı, kayıt sırasında kilitli.
- **Eval harness (P3)** — `evals/` golden transkript seti + precision/recall/hallucination skorlama
  (`npm run eval` canlı, `npm run eval:mock` offline). %98 hedefi ancak geniş vaka setiyle kanıtlanır.
- **E2E** — Playwright: 6 smoke test her yerde çalışır; hastane gate akışı `CLERK_TEST_EMAIL/PASSWORD` varsa.

### Açık kalan feedback maddeleri

- Konuşmacı ayrıştırma (diarization) — Whisper API ile tek mikrofonda yok; doktor-tekrarı ipucu
  UI'a eklendi, donanım/araştırma konusu.
- Siteye giriş hatası ekran görüntüleri — arkadaştan bekleniyor, görmeden teşhis yok.
- Canlı eval koşusu — API kotası gerekiyor, henüz koşulmadı (mock yeşil).

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
- [x] Vercel functions pinned to `fra1` in `vercel.json` — verified 2026-08-10 (`regions: ["fra1"]`, api maxDuration 30s)
- [ ] KVKK + onam consent language reviewed by Turkish legal counsel (KvkkGate metni hâlâ taslak)
- [ ] Cross-border transfer disclosure (OpenAI US) in consent form
- [x] E2E tests (Playwright) — 6 smoke test + hospital gate flow; `npm run test:e2e` yeşil (2026-08-10)
- [x] Deploy readiness check 2026-08-10 — build ✓, lint ✓, 178 unit test ✓, 6 e2e smoke ✓

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
| Hospital module | Identity + transcript ephemeral (device-only); structured output stored as labeled snapshot with chosen retention (30–365 gün veya manuel silme) |
| Module consent | KvkkGate per module (dis/hastane), localStorage, text version v2 (hastane metni güçlendirildi) |

## Test Mode (active since 2026-05-07)

Flat single-user, no orgs. RLS via `user_id = auth.jwt() ->> 'sub'`.
Routes: `/modules`, `/dashboard`, `/patients`, `/patients/[id]`, `/hospital`.
APIs: `/api/patients/*`, `/api/sessions/*`, `/api/descriptions`, `/api/hospital/*`.
