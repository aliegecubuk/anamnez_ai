# AnamnezAI — Saha Test Senaryosu

> **Amaç:** Uygulamayı gerçek kullanıcı gözüyle baştan sona test etmek ve geri bildirim toplamak.
> **Süre:** ~20–30 dakika · **Gereken:** Güncel Chrome veya Safari + çalışan bir mikrofon + internet
> **Adres:** https://anamnezal.vercel.app
> **Okuma metinleri:** Sesli testlerde okunacak hazır dikte metinleri `TEST-DEMO-METINLERI.md` dosyasında.

Adımları sırayla uygulayın. Her adımın yanındaki **✓ Beklenen** kısmı, doğru çalışıyorsa görmeniz gerekeni söyler. Beklenenden farklı bir şey olursa en sondaki geri bildirim tablosuna not edin (mümkünse ekran görüntüsüyle).

---

## Bölüm 1 — Hesap Oluşturma ve Giriş

1. Linke tıklayın → karşınıza giriş/kayıt ekranı gelir. **"Hesap Oluştur"** (kayıt) sayfasına geçin.
2. E-posta ve şifre girin (şifre en az 8 karakter) → **"Hesap Oluştur"** butonuna basın.
   - ✓ Beklenen: "Bir kod gönderdik." ekranı; e-postanıza 6 haneli kod gelir.
3. Kodu girin → **"Doğrula ve Devam Et"**.
   - ✓ Beklenen: **"Nerede çalışıyorsun?"** modül seçim ekranı (Diş / Hastane kartları).
4. Sağ üstten **"Çıkış"** yapın, sonra **"Giriş yap"** ile aynı bilgilerle tekrar girin.
   - ✓ Beklenen: Sorunsuz giriş, yine modül seçim ekranı.
5. Yanlış şifreyle giriş yapmayı deneyin.
   - ✓ Beklenen: Anlaşılır bir hata mesajı, uygulama kırılmaz.

> Not edin: Kayıt olurken takıldığınız, kafa karıştıran bir yer oldu mu?

---

## Bölüm 2 — Diş Modülü

### 2.1 KVKK onayı ve panel
1. Modül seçiminden **"Diş"** kartına tıklayın.
   - ✓ Beklenen: İlk girişte **"KVKK Aydınlatma ve Onay — Diş Hekimliği Modülü"** ekranı. Onay kutusunu işaretlemeden buton aktif olmaz. Onaylayınca panele girilir (bu onay bir kez sorulur).
2. Panelde karşılama yazısı ve istatistik satırını (Hastalar / Son kayıt) görün. **"Hastalar"** kartına tıklayın.

### 2.2 Hasta oluşturma
1. **"Yeni Hasta"** (liste boşsa **"İlk Hastayı Ekle"**) butonuna basın.
2. Ad Soyad ve 11 haneli TC girin → **"Oluştur"**.
   - ✓ Beklenen: "Hasta oluşturuldu." bildirimi, hasta listede görünür.
3. Aynı TC ile bir hasta daha oluşturmayı deneyin.
   - ✓ Beklenen: "Bu TC kimlik numarasıyla kayıtlı bir hasta zaten var." hatası.
4. Arama kutusuna (**"Ad veya TC ile ara…"**) hastanın adının bir kısmını yazın.
   - ✓ Beklenen: Liste filtrelenir. TC'nin her yerde maskeli (`*******1234` gibi) gösterildiğine dikkat edin.
5. Hastanın satırına tıklayın → profil açılır.
   - ✓ Beklenen: Üç buton: **"Anamnez"**, **"Periodontal Chart"**, **"Patoloji Chart"** + boş seans geçmişi ("Henüz seans yok").

### 2.3 Anamnez seansı (sesli)
1. **"Anamnez"** butonuna basın → seans ekranı açılır.
2. İlk seferde **"Mikrofon iznini ver"** → tarayıcı iznini onaylayın.
3. **"Kaydı Başlat"** deyin ve şu metni doğal konuşmayla okuyun (hastayı canlandırın):

   > "Hastanın sol alt azı dişinde üç gündür ağrı var, soğuk su içince sızlıyor. Daha önce kanal tedavisi olmuş. Şeker hastalığı var, metformin kullanıyor. Aspirine alerjisi olduğunu söylüyor. Sigara kullanmıyor."

4. Konuşurken **"Konuşma Girişi"** panelinde cümlelerin canlı belirdiğini izleyin. Bitince **"Durdur"**.
   - ✓ Beklenen: Cümleler yazıya dökülür, "Kayıt tamamlandı." görünür. Kayıt sırasında **"Duraklat"** / **"Devam Et"** de deneyin.
5. Bir cümlenin içine tıklayıp düzeltin, bir cümleyi çöp ikonuyla silin, alttaki kutuya elle cümle ekleyin (Enter).
   - ✓ Beklenen: Hepsi düzenlenebilir.
6. **"İşle ve Düzenle"** butonuna basın.
   - ✓ Beklenen: "Ses kaydı bölümlere yerleştirildi." bildirimi; bilgiler 10 bölümlük forma dağılır (Şikâyet ve hikâyesi, Vital bulgular, Genel sağlık yönünden vb.).
7. Formu kontrol edin:
   - Şikâyet bölümüne ağrı bilgisi geldi mi?
   - **"Kullanılan İlaçlar"** bölümünde **metformin kartı** oluştu mu (etken madde, diş hekimliği önemi, cerrahi önlem)?
   - Aspirin alerjisi ilgili bölüme işlendi mi?
   - Yanlış yere düşen satırı düzeltin veya silin; **"+ satır"** ile elle satır ekleyin.
8. **"Rapor Oluştur"** butonuna basın.
   - ✓ Beklenen: AI Değerlendirme Raporu (özet + dikkat edilecekler + risk uyarıları + öneriler) ve altında sorumluluk reddi metni.
9. **"PDF İndir"** butonuna basın.
   - ✓ Beklenen: Anamnez raporu PDF olarak iner; açıp içeriği (hasta adı, tarih, bölümler, ilaç tablosu, AI raporu) kontrol edin.

### 2.4 Periodontal chart
1. Hasta profiline dönün, **"Periodontal Chart"** butonuna basın.
2. Kaydı başlatıp şunu okuyun:

   > "On altı dişte bukkal cep derinlikleri üç, dört, üç; palatal üç, üç, iki. Otuz altı dişte beş, altı, beş, kanama var."

3. **"Durdur"** → **"İşle ve Düzenle"**.
   - ✓ Beklenen: 16 ve 36 numaralı diş kartları cep derinlikleriyle dolar; kanama işaretleri gelir. 4–5 amber, 6 ve üzeri kırmızı renk alır.
4. Elle bir diş ekleyin: **"Diş no (örn. 36)"** kutusuna `46` yazıp **"+ diş ekle"**, birkaç değer girin.
   - ✓ Beklenen: Değerler otomatik kaydedilir (ayrı kaydet butonu yok).
5. **"Onayla & PDF"** butonuna basın.
   - ✓ Beklenen: Chart kilitlenir ("Kaydedildi" rozeti), perio PDF'i otomatik iner. Kilitliyken sadece **"PDF İndir"** aktif kalır.

### 2.5 Patoloji chart
1. Hasta profiline dönün, **"Patoloji Chart"** butonuna basın.
2. Diş dizisinden bir dişe tıklayın → alttaki listeden durum seçin (**Çürük, Dolgu, Kanal, Eksik Diş…**).
   - ✓ Beklenen: Diş renk koduna göre boyanır, seçim anında kaydedilir. X ile durumu silebilirsiniz.
3. (Varsa) Sesle deneyin: "Yirmi altı dişte çürük var" deyip **"Yeniden Çözümle"**ye basın.
4. Hasta profiline dönün → **"Seans geçmişi"** tablosunda 3 seansın da durumunu görün (**"Görüntüle"** / **"Devam et"**).
   - ✓ Beklenen: Tamamlananlar "Tamamlandı", yarım kalanlar "Taslak".

---

## Bölüm 3 — Hastane Modülü (poliklinik/acil)

> Bu modülde **hiçbir veri saklanmaz** — PDF alınca her şey silinir. Bu bir hata değil, tasarım gereği.

1. Modül seçimine dönüp **"Hastane"** kartına tıklayın → KVKK onayını geçin.
2. **Hasta Kimliği** paneline ad, soyad, TC, telefon girin.
3. **Maskeleme testi:** Kaydı başlatıp hastanın adını da söyleyerek konuşun:

   > "Ahmet Yılmaz, iki saattir göğüs ağrısı var, sol kola yayılıyor, terleme eşlik ediyor. Tansiyon ilacı kullanıyor, adını bilmiyor. Alerjisi yok."

   - ✓ Beklenen: "Konuşma Metni" kutusunda isim/TC/telefon `***` olarak maskeli görünür.
4. **"Durdur"** → **"İşle"**.
   - ✓ Beklenen: Anamnez kartları (soru-cevap) oluşur; konuşulmayan başlık **eklenmez**.
5. Üstteki amber **"Sorulmadı:"** çiplerine bakın (örn. "Alerjiler sorulmadı"). Birine tıklayın.
   - ✓ Beklenen: O başlıkta boş satır eklenir; elle doldurabilirsiniz.
6. Kartlarda düzenleme yapın: bir cevabı değiştirin, bir satırı silin, **"Satır Ekle"** ile yeni satır açın.
7. **"Sık Şikâyetler"** çiplerinden birine (örn. "Nefes darlığı") dokunun.
   - ✓ Beklenen: Şikâyet satırına eklenir.
8. **"Klinik Özet + Ayırıcı Tanı"** kartında özetin otomatik üretildiğini görün; düzenleme yaptıysanız **"Yeniden Üret"** ile tazeleyin.
   - ✓ Beklenen: Özet + olası ayırıcı tanılar + kırmızı bayraklar + sorumluluk reddi metni.
9. **Medula kutusu:** metni kontrol edin, **"Kopyala"** deyin, bir yere yapıştırıp deneyin.
   - ✓ Beklenen: Başlıksız, akıcı klinik metin; yalın "yok" cevapları başlığıyla yazar ("İlaç alerjisi: Yok.").
10. **"PDF İndir"** butonuna basın.
    - ✓ Beklenen: PDF iner (kimlik başlığı + anamnez + muayene + klinik özet) **ve modül tamamen sıfırlanır** (kimlik, konuşma, kartlar silinir). Buton pasifken üzerine gelirseniz neden pasif olduğunu açıklayan ipucu görünür.
11. **"Detaylı (Poliklinik)"** moduna geçip kısa bir kayıtla aynı akışı tekrarlayın; şikâyet çiplerinin ve sorulmadı listesinin değiştiğine dikkat edin.
12. **"Sıfırla"** butonuna basın.
    - ✓ Beklenen: İçerik varken önce "Tüm veriler silinsin mi?" onayı sorar; "Evet, sıfırla" ile temizlenir.

---

## Bölüm 4 — Kenar Durumlar (fırsat olursa)

- Mikrofon iznini **reddedin** → anlaşılır yönerge çıkıyor mu?
- Kayıt devam ederken **"İşle"** butonunun pasif olduğunu görün (üzerine gelince "Önce kaydı durdurun").
- Hiç konuşmadan **"İşle"** → buton pasif kalmalı.
- Sessiz bir kayıt yapıp **"İşle"** → "Konuşmada anamneze girecek bilgi bulunamadı." uyarısı.
- Tarayıcı sekmesini kapatıp tekrar girin → diş modülünde kayıtlar duruyor mu? (Hastane modülünde durmaması normal.)

---

## Geri Bildirim Tablosu

Her bulgu için bir satır doldurun (WhatsApp'tan düz metin de olur):

| # | Nerede? (sayfa/adım) | Ne yaptım? | Beklediğim | Olan | Ekran görüntüsü |
|---|----------------------|------------|------------|------|-----------------|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**Genel sorular** (kısa cevap yeter):
1. En çok işinize yarayan özellik hangisiydi?
2. Hangi adımda takıldınız / "bu niye böyle" dediniz?
3. Poliklinik temponuzda bu akışı kullanır mıydınız? Neden?
4. Eksik gördüğünüz ilk 3 şey?
