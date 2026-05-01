# Requirements: AnamnezAl

**Defined:** 2026-05-01
**Core Value:** Diş hekimi muayene sırasında klavye veya fare kullanmadan, yalnızca sesle anamnez formu doldurabilmeli ve diş chartlarını oluşturabilmeli — çapraz kontaminasyonu tamamen ortadan kaldırır.

## v1 Requirements

### Authentication & Multi-tenancy

- [ ] **AUTH-01**: Admin, üniversite/klinik için tenant hesabı oluşturabilir (isim, e-posta, organizasyon)
- [ ] **AUTH-02**: Admin, kendi tenant'ında diş hekimi ve asistan hesapları oluşturabilir
- [ ] **AUTH-03**: Admin, kullanıcılara rol atayabilir (admin / diş hekimi / asistan)
- [ ] **AUTH-04**: Kullanıcı, e-posta ve şifreyle giriş yapabilir
- [ ] **AUTH-05**: Kullanıcı oturumu tarayıcı yenilemesinde devam eder
- [ ] **AUTH-06**: Kullanıcı şifresini e-posta bağlantısıyla sıfırlayabilir
- [ ] **AUTH-07**: Her tenant verisi kesin olarak izole edilir — tenant A, tenant B'nin verisini göremez

### Hasta Yönetimi

- [ ] **PAT-01**: Diş hekimi, ad-soyad ve TC kimlik numarasıyla hasta profili oluşturabilir
- [ ] **PAT-02**: Diş hekimi, mevcut hastayı TC veya ad ile arayabilir
- [ ] **PAT-03**: Hasta profilinde geçmiş tüm seanslar listelenir (tarih, form tipi)
- [ ] **PAT-04**: Diş hekimi, geçmiş herhangi bir seansı görüntüleyebilir
- [ ] **PAT-05**: Diş hekimi, yeni seans için hasta profilini seçip devam edebilir

### Ses Kaydı & STT

- [ ] **STT-01**: Diş hekimi, tarayıcıdan mikrofon izni verip kaydı başlatabilir
- [ ] **STT-02**: Kayıt sırasında ses, anlık transkripte dönüştürülür (Whisper API, Türkçe)
- [ ] **STT-03**: Transkript ekranda gerçek zamanlı gösterilir
- [ ] **STT-04**: Diş hekimi kaydı durdurabilir / duraklatabilir / devam ettirebilir
- [ ] **STT-05**: Tüm transkript, sunucuya alındığı anda kaydedilir (seans kaybı önlenir)
- [ ] **STT-06**: Chrome ve Safari uyumluluğu (MediaRecorder format farklılıkları yönetilir)

### Anamnez Form Şablonları (Admin)

- [ ] **TPLT-01**: Admin, bölüm bazında form şablonu oluşturabilir (genel, periodontoloji, pedodonti, vb.)
- [ ] **TPLT-02**: Şablon soruları şu tipleri destekler: evet/hayır, metin, çoklu seçim, sayısal
- [ ] **TPLT-03**: Admin, şablona soru ekleyebilir / düzenleyebilir / sıralayabilir / silebilir
- [ ] **TPLT-04**: Şablonlar sürümlendirilir — mevcut seanslar eski sürüme bağlı kalır
- [ ] **TPLT-05**: Diş hekimi, seans başlatırken bölüm şablonunu seçer

### Anamnez Form Doldurma (AI)

- [ ] **ANAM-01**: AI, transkribi ilgili form alanlarına otomatik eşler (Yapılandırılmış Çıktı / JSON modu)
- [ ] **ANAM-02**: Her alan için doldurulan metin ve güven skoru gösterilir
- [ ] **ANAM-03**: Diş hekimi, AI'nın doldurduğu herhangi bir alanı manuel düzenleyebilir
- [ ] **ANAM-04**: Seans tamamlandığında, AI yanıtsız kalan soruları listeler (eksik alan uyarısı)
- [ ] **ANAM-05**: Eksik alanlara tıklanınca form o soruya odaklanır
- [ ] **ANAM-06**: KVKK ve onam (informed consent) onay kutularına tıklanmadan seans kaydedilemez

### Dental AI Açıklamaları

- [ ] **DESC-01**: Her ilaç, sistemik hastalık ve gıda alerjisi için tıkla-aç açıklaması bulunur
- [ ] **DESC-02**: Açıklamalar yalnızca diş hekimliğine özeldir (genel tıbbi bilgi içermez)
- [ ] **DESC-03**: Açıklama 3 satırdır: diş/cerrahi/anestezi etkisi, risk düzeyi, önerilen önlem
- [ ] **DESC-04**: Bilinmeyen ilaçlar için aktif madde üzerinden açıklama üretilir
- [ ] **DESC-05**: Açıklamalar zorunlu değil, isteğe bağlı olarak açılır (varsayılan kapalı)
- [ ] **DESC-06**: Her açıklamada yasal uyarı: "Bu bilgi klinik karar desteği değildir"

### Periodontoloji Chartı ⭐ KRİTİK

- [ ] **PERIO-01**: Chart, FDI diş numaralandırması ile 32 dişi gösterir (üst + alt çene)
- [ ] **PERIO-02**: Her diş için 6 ölçüm noktası bulunur: MB, B, DB, ML, L, DL
- [ ] **PERIO-03**: Her nokta için iki değer girilir: cep derinliği (pocket depth) ve ataşman kaybı (attachment loss)
- [ ] **PERIO-04**: Boş diş = sorun yok = NULL (0 değil — 0 ayrı klinik anlam taşır)
- [ ] **PERIO-05**: Diş hekimi sesle girer: "diş 18, 2mm cep, 4mm ataşman kaybı"
- [ ] **PERIO-06**: Belirsiz diş numaralarında (ör. 18 vs 28) AI onay adımı gösterir
- [ ] **PERIO-07**: Diş hekimi seans sonunda chart'ı gözden geçirebilir, düzenleyebilir
- [ ] **PERIO-08**: Kaydedilmemiş ölçümler olan bir seans, uyarı gösterilmeden kaydedilemez

### Patoloji / Çürük Chartı ⭐ KRİTİK

- [ ] **PATH-01**: 32 dişli görsel interaktif chart görüntülenir (FDI numaralandırması)
- [ ] **PATH-02**: Diş hekimi sesle girer: "diş 22 çürük, diş 25 diş eti çekilmesi"
- [ ] **PATH-03**: Belirtilen diş, belirtilen durum tipiyle renk kodlamasıyla işaretlenir
- [ ] **PATH-04**: Bir dişte birden fazla durum desteklenir
- [ ] **PATH-05**: Durum tipleri: çürük, diş eti çekilmesi, dolgu, kanal, köprü, eksik diş, diğer
- [ ] **PATH-06**: Belirsiz diş numaralarında onay adımı (PERIO ile aynı mekanizma)
- [ ] **PATH-07**: Diş hekimi işaretlenen dişe tıklayıp durumu silebilir / düzenleyebilir

### Seans Gözden Geçirme & Kaydetme

- [ ] **REVIEW-01**: Seans bitince ekranda dolu form + perio chart + patoloji chart birlikte gösterilir
- [ ] **REVIEW-02**: Diş hekimi herhangi bir alanı düzenleyebilir, kaydetmeden önce son kontrol yapar
- [ ] **REVIEW-03**: KVKK + onam onayı alındıktan sonra seans hasta profiline kaydedilir
- [ ] **REVIEW-04**: Kaydedilen seans düzenlenemez (audit trail korunur) — sadece ek not eklenebilir
- [ ] **REVIEW-05**: Seans, hasta geçmişinde tarih ve form tipiyle listelenir

---

## v2 Requirements

### Bildirimler
- **NOTF-01**: Eksik anamnez alanı olduğunda hatırlatma bildirimi
- **NOTF-02**: KVKK veri saklama süresi dolduğunda admin bildirimi

### PDF / Çıktı
- **PDF-01**: Seans verisi PDF formatında dışa aktarılabilir
- **PDF-02**: Perio ve patoloji chartları görsel olarak PDF'e dahil edilir

### Gelişmiş Analitik
- **ANLK-01**: Admin, tenant bazında seans istatistiklerini görüntüler
- **ANLK-02**: Hasta bazında perio ölçüm trendi takibi

### İngilizce Dil Desteği
- **LANG-01**: UI ve STT İngilizce seçeneği sunulur

---

## Out of Scope

| Özellik | Neden Kapsam Dışı |
|---------|-------------------|
| PDF dışa aktarma | v1'de istenmedi — dijital-only |
| Mobil uygulama | Web-first; mobil ileride |
| İngilizce UI/STT | v1 Türkçe-only |
| Randevu / HIS entegrasyonu | Kapsam dışı |
| Faturalama / ödeme modülü | Kapsam dışı |
| DHBS akreditasyonu (Sağlık Bakanlığı) | Devlet üniversitesi gereksinimi; v1 özel/vakıf hedef |
| Self-hosted Whisper | API yeterli MVP için; maliyet artarsa gözden geçirilir |
| Çoklu dil STT | v1 Türkçe-only |

---

## Traceability

| Gereksinim | Faz | Durum |
|------------|-----|-------|
| AUTH-01 | Faz 1 — Temel Altyapı | Bekliyor |
| AUTH-02 | Faz 1 — Temel Altyapı | Bekliyor |
| AUTH-03 | Faz 1 — Temel Altyapı | Bekliyor |
| AUTH-04 | Faz 1 — Temel Altyapı | Bekliyor |
| AUTH-05 | Faz 1 — Temel Altyapı | Bekliyor |
| AUTH-06 | Faz 1 — Temel Altyapı | Bekliyor |
| AUTH-07 | Faz 1 — Temel Altyapı | Bekliyor |
| PAT-01 | Faz 2 — Hasta Yönetimi | Bekliyor |
| PAT-02 | Faz 2 — Hasta Yönetimi | Bekliyor |
| PAT-03 | Faz 2 — Hasta Yönetimi | Bekliyor |
| PAT-04 | Faz 2 — Hasta Yönetimi | Bekliyor |
| PAT-05 | Faz 2 — Hasta Yönetimi | Bekliyor |
| STT-01 | Faz 3 — Ses Boru Hattı | Bekliyor |
| STT-02 | Faz 3 — Ses Boru Hattı | Bekliyor |
| STT-03 | Faz 3 — Ses Boru Hattı | Bekliyor |
| STT-04 | Faz 3 — Ses Boru Hattı | Bekliyor |
| STT-05 | Faz 3 — Ses Boru Hattı | Bekliyor |
| STT-06 | Faz 3 — Ses Boru Hattı | Bekliyor |
| TPLT-01 | Faz 4 — Anamnez Motoru | Bekliyor |
| TPLT-02 | Faz 4 — Anamnez Motoru | Bekliyor |
| TPLT-03 | Faz 4 — Anamnez Motoru | Bekliyor |
| TPLT-04 | Faz 4 — Anamnez Motoru | Bekliyor |
| TPLT-05 | Faz 4 — Anamnez Motoru | Bekliyor |
| ANAM-01 | Faz 4 — Anamnez Motoru | Bekliyor |
| ANAM-02 | Faz 4 — Anamnez Motoru | Bekliyor |
| ANAM-03 | Faz 4 — Anamnez Motoru | Bekliyor |
| ANAM-04 | Faz 4 — Anamnez Motoru | Bekliyor |
| ANAM-05 | Faz 4 — Anamnez Motoru | Bekliyor |
| ANAM-06 | Faz 4 — Anamnez Motoru | Bekliyor |
| DESC-01 | Faz 5 — Dental AI Açıklamaları | Bekliyor |
| DESC-02 | Faz 5 — Dental AI Açıklamaları | Bekliyor |
| DESC-03 | Faz 5 — Dental AI Açıklamaları | Bekliyor |
| DESC-04 | Faz 5 — Dental AI Açıklamaları | Bekliyor |
| DESC-05 | Faz 5 — Dental AI Açıklamaları | Bekliyor |
| DESC-06 | Faz 5 — Dental AI Açıklamaları | Bekliyor |
| PERIO-01 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PERIO-02 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PERIO-03 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PERIO-04 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PERIO-05 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PERIO-06 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PERIO-07 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PERIO-08 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| REVIEW-01 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| REVIEW-02 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| REVIEW-03 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| REVIEW-04 | Faz 6a — Periodontoloji Chartı | Bekliyor |
| PATH-01 | Faz 6b — Patoloji Chartı | Bekliyor |
| PATH-02 | Faz 6b — Patoloji Chartı | Bekliyor |
| PATH-03 | Faz 6b — Patoloji Chartı | Bekliyor |
| PATH-04 | Faz 6b — Patoloji Chartı | Bekliyor |
| PATH-05 | Faz 6b — Patoloji Chartı | Bekliyor |
| PATH-06 | Faz 6b — Patoloji Chartı | Bekliyor |
| PATH-07 | Faz 6b — Patoloji Chartı | Bekliyor |
| REVIEW-05 | Faz 6b — Patoloji Chartı | Bekliyor |

**Kapsam:**
- v1 gereksinimleri: 55 toplam
- Fazlara eşlenen: 55
- Eşlenmemiş: 0 ✓

---
*Requirements defined: 2026-05-01*
*Last updated: 2026-05-01 — traceability updated after roadmap creation (count corrected: 55 not 47)*
