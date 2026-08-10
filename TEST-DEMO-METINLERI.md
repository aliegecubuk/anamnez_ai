# AnamnezAI — Sesli Test Demo Metinleri

Her modül için hazır okuma metni + beklenen sonuç + bilerek gömülmüş tuzaklar.
Normal konuşma hızında, aralarda kısa duraklamalarla okuyun. Metinde geçen sayılar
bilerek yazıyla verilmiştir — sayı çözümlemeyi de test eder.

---

## 1. Diş — Anamnez Seansı (`Anamnez` butonu)

**Okuma metni:**

> "Hasta sağ üst azı dişinde dört beş gündür zonklayıcı ağrı olduğunu söylüyor, gece uyandırıyor, soğuk ve sıcakta şiddetleniyor. Tansiyon ölçümü yüz yirmi seksen, nabız yetmiş altı. Çocukluğunda geçirilmiş bir hastalık belirtmiyor. İki yıl önce bir dişine dolgu yaptırmış, diş tedavisi sırasında sorun yaşamamış. Şeker hastalığı var, günde iki kez metformin kullanıyor. Bir de kalp çarpıntısı için verapamil kullanıyor. Eskiden coraspin içiyormuş ama altı ay önce bırakmış. Bilinen ilaç alerjisi yok. Penisilin alerjisi olduğunu düşünmüyor. Sigara kullanmıyor, alkol ara sıra. Ağız hijyeni için günde bir kez fırçalıyor, diş ipi kullanmıyor. Ekstraoral muayenede patoloji saptanmadı. İntraoralde on altı dişte derin çürük ve perküsyonda hassasiyet var. Radyolojide on altı dişte periapikal radyolusensi izlendi."

**Beklenen:**
- Şikâyet bölümünde zonklayıcı ağrı + süre + tetikleyiciler.
- Vital bulgularda TA 120/80, nabız 76.
- İlaç kartları: **metformin** ve **verapamil** (etken madde + dental önem + cerrahi önlem dolu).
- Genel sağlık yönünden: diyabet. Radyolojik bulgular: periapikal radyolusensi.

**Tuzaklar:**
- "Eskiden coraspin içiyormuş, **bırakmış**" → aktif ilaç kartı AÇILMAMALI (aspirin/Coraspin güncel ilaç değil).
- "Alerjisi yok" ve "olduğunu **düşünmüyor**" → alerji olarak işlenmemeli; negatif/belirsiz kalmalı.
- "Ara sıra alkol" → şahsi/sosyal hikâyeye gitmeli, ilaç kartı olmamalı.

---

## 2. Diş — Periodontal Chart (`Periodontal Chart` butonu)

**Okuma metni:**

> "On altı dişten başlıyorum. Bukkal üç, dört, üç; palatal iki, üç, iki. On yedi dişte bukkal beş, altı, beş; palatal dört, beş, dört, mesialde kanama var. Yirmi altı dişte üç, iki, üç. Otuz altı dişte bukkal altı, yedi, altı; lingual beş, altı, beş, ataşman kaybı ikişer milimetre, distalde kanama var. Kırk altı dişte iki, iki, iki, kanama yok. Bir de diş sekiz için bir şey söyleyecektim — pardon, hangi sekizdi bilemedim, boş ver."

**Beklenen:**
- 16: MB/B/DB = 3/4/3, ML/L/DL = 2/3/2 (palatal arka yüze düşmeli).
- 17: 5/6/5 + 4/5/4; kanama MB ve ML'de ("mesialde" → iki yüzün mesial noktası).
- 36: ön 6/7/6, arka 5/6/5; ataşman kaybı 2 mm; kanama DB ve DL'de. 7 mm nokta kırmızı.
- 46: 2/2/2, kanama işareti yok.
- **Disambiguation testi:** "diş sekiz" ifadesi için "Diş Numarası Belirsiz" modalı açılmalı (adaylar: 18/28/38/48). Bir diş seçin → **modal kapanmalı ve geri gelmemeli**. Kalan varsa bir de "Bu ifadeyi atla" deneyin.

**Tuzaklar:**
- "Palatal" ve "lingual" ayrı dişlerde geçiyor — ikisi de arka yüze (ML/L/DL) eşlenmeli.
- "İkişer milimetre" ataşman kaybı → cep derinliği değil, attachment_loss alanına.
- Sonda bilerek kararsız bir ifade → modalı test eder; ifadeyi atlamak sorunsuz çalışmalı.

---

## 3. Diş — Patoloji Chart (`Patoloji Chart` butonu)

**Okuma metni:**

> "Hastanın ağız içi muayenesinde; on bir numaralı dişte eski bir kompozit dolgu mevcut. On altı dişte oklüzal yüzeyde çürük tespit ettim. On yedi diş çekilmiş, eksik. Yirmi bir dişte diş eti çekilmesi var, yaklaşık iki milimetre. Yirmi dört diş kanal tedavili, üzerinde porselen kuron var. Yirmi altı dişte derin çürük var, kanal tedavisi planlıyoruz. Yirmi sekiz diş yani üçüncü büyük azı gömülü kalmış. Otuz altı dişte amalgam dolgu var, kenar uyumu bozulmuş. Otuz yedi dişte bukkal yüzeyde çürük başlangıcı izleniyor. Otuz sekiz diş eksik, daha önce çekilmiş. Kırk altı diş kanal tedavisi görmüş, köprü ayağı olarak kullanılıyor; kırk beş ve kırk yedi ile birlikte üç üyeli köprü protezi mevcut. Kırk bir ve otuz bir dişlerde diş eti çekilmesi ve hafif mobilite var. Kırk iki dişte mine çatlağı gözlemledim, takibe aldık."

**Beklenen:**
- **Dolgu:** 11, 36 · **Çürük:** 16, 26, 37 · **Eksik:** 17, 38 · **Diş Eti Çekilmesi:** 21, 31, 41 · **Kanal:** 24, 46 · **Köprü:** 45, 46, 47 · **Diğer:** 28 (gömülü), 42 (çatlak), 24 kuron.
- Kayıt sonrası **"Yeniden Çözümle"**ye basın.

**Tuzaklar:**
- "Kanal tedavisi **planlıyoruz**" (26) → plan, mevcut durum değil; chart'a girmemeli.
- "Gömülü 28" ve "mine çatlağı 42" → standart listede yok, "Diğer" veya atlanmalı.
- "Mobilite" → listede yok; girerse "Diğer" olmalı.
- Sayılar yazıyla ("on yedi") → doğru FDI'ye çözülmeli.

---

## 4. Hastane — Hızlı / Acil modu

**Okuma metni** (önce Hasta Kimliği paneline ad-soyad, TC, telefon girin — maskeleme testi için):

> "Hastanın adı Mehmet Demir, telefonu sıfır beş yüz otuz iki, bir iki üç, dört beş altı yedi. Kırk dakika önce başlayan şiddetli göğüs ağrısı var, sol kola ve çeneye yayılıyor. Terleme ve nefes darlığı eşlik ediyor. Bulantısı var, kusma yok. Bilinci açık. Hipertansiyon ve şeker hastalığı varmış; metformin ve amlodipin kullanıyor, evde bir tane de aspirin çiğnemiş. Bilinen ilaç alerjisi yok. Babasında erken yaşta kalp krizi öyküsü var. Tansiyon yüz altmış doksan, nabız yüz dört, satürasyon doksan dört."

**Beklenen:**
- Konuşma metninde isim ve telefon `***` maskeli.
- "İşle" sonrası anamnez kartlarında: göğüs ağrısı + süre + yayılım + eşlik edenler; ilaçlar (metformin, amlodipin, **evde alınan aspirin**); alerji **"Yok" başlığıyla**; kronik hastalıklar.
- Fizik Muayene grubunda TA/nabız/SpO₂.
- AI özetinde yaş uydurulmamalı (söylenmedi) — "yaşı belirtilmemiş" veya hiç geçmemeli.

**Tuzaklar:**
- "**Babasında** kalp krizi" → hastanın kendi hastalığı değil; aile öyküsü olarak kalmalı, kronik hastalığa yazılmamalı.
- "Kusma yok" → bulantı/kusma kartına "kusma var" olarak düşmemeli.
- Alerji "yok" → kartlar ve Medula metninde "İlaç alerjisi: Yok." diye başlıklı çıkmalı.

---

## 5. Hastane — Detaylı / Poliklinik modu

**Okuma metni:**

> "Kırk beş yaşındaki hasta üç haftadır tekrarlayan karın ağrısıyla başvuruyor. Ağrı üst karın bölgesinde, yanma tarzında, yemeklerden yarım saat sonra artıyor, açken azalıyor. Bulantı oluyor ama kusma yok, iştah biraz azalmış, kilo kaybı yok. Dışkılama düzenli, kanama veya siyah dışkı tarif etmiyor. Özgeçmişinde beş yıldır hipertansiyon var, ramipril kullanıyor. Ülser öyküsü yok. Alerjisi yok. Sigara günde yarım paket, yirmi yıldır içiyor, alkol kullanmıyor. Ailesinde mide kanseri öyküsü yok. Muayenede genel durum iyi, tansiyon yüz otuz seksen beş, nabız yetmiş sekiz, ateş otuz altı virgül yedi, satürasyon doksan sekiz. Karında epigastrik bölgede derin palpasyonla hassasiyet var, rebound ve defans yok, barsak sesleri doğal."

**Beklenen:**
- Detaylı modun kapsamlı kartları: şikâyet, süre, karakter, tetikleyici/azaltıcı, iştah-kilo, dışkılama, özgeçmiş, ilaç, alerji, sosyal öykü (sigara!), aile öyküsü.
- Fizik Muayene grubunda vitaller (TA 135/85, nabız 78, ateş 36.7, SpO₂ 98) + karın muayenesi bulguları.
- AI özeti **"45 yaşında"** demeli (burada söylendi — bug 4 düzeltmesinin ters yönü: verilen bilgi kullanılmalı).
- "Rebound ve defans yok" → pozitif bulgu olarak yazılmamalı.

**Tuzaklar:**
- Yaş açıkça söyleniyor → özet 45'i kullanmalı (uydurma değil, verilen bilgi).
- "Kilo kaybı yok", "ülser öyküsü yok", "ailede mide kanseri yok" → negatifler başlıklarıyla, ters çevrilmeden.
- "Otuz altı virgül yedi" → ateş 36.7 °C olarak parse edilmeli.
