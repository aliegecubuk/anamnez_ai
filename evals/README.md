# Evaluation Harness — Hastane Anamnez Çıkarımı

`src/lib/openai/hospital-anamnesis.ts` içindeki `parseHospitalAnamnesis(transcript, mode)`
fonksiyonunun çıkarım kalitesini ölçer. Hedef: sağlık ürünü iddiası olan **%98+ doğruluk**;
bu harness o iddiayı kanıtlamak (ve regresyonları yakalamak) için ölçüm altyapısıdır.

## Çalıştırma

```bash
npm run eval:mock   # OpenAI çağrısı YOK — harness mantığını doğrular, CI'da çalışır
npm run eval        # Canlı mod — OPENAI_API_KEY gerekir (.env.local'den okunur, asla yazdırılmaz)
npm run eval -- --case dis-agrisi   # tek vaka
npm run eval -- --help
```

Yeni dependency yoktur: Node >= 22.6 `--experimental-strip-types` ile TS'i doğal çalıştırır;
`@/` alias'ı `evals/alias-loader.mjs` ile çözülür (`--import ./evals/register-alias.mjs`).

Çıkış kodları: `0` tüm vakalar geçti, `1` en az bir vaka başarısız, `2` kullanım/ortam hatası.
Raporlar `evals/results/eval-<mod>-<zaman>.json` altına yazılır (git'e girmez).

## Golden vaka formatı (`evals/golden/*.json`)

```json
{
  "id": "benzersiz-kebab-case",
  "title": "İnsan okur başlık",
  "mode": "hizli | detayli",
  "transcript": "Doktor: ...\nHasta: ...",
  "expected_entries": [{ "question": "Şikâyet", "answer": "..." }],
  "forbidden_entries": [{ "question": "Gebelik", "reason": "Konuşulmadı" }],
  "min_precision": 0.8,
  "min_recall": 0.8
}
```

- `expected_entries`: transkriptte **açıkça konuşulan** bilgiler. Model başlığı birebir
  yazmak zorunda değil; eşleşme bulanıktır (aşağıya bakın).
- `forbidden_entries`: transkriptte **hiç geçmeyen** başlıklar — hallucination tuzağı.
  Başlık benzerliği yakalanırsa içeriğine bakılmaksızın hallucination sayılır.
- `min_precision` / `min_recall`: opsiyonel, vaka bazında barajı gevşetir/sıkılaştırır
  (varsayılan ikisi de 0.8).

Yeni vaka eklemek: `evals/golden/` altına yeni bir `.json` koy — script klasördeki tüm
dosyaları otomatik toplar. Klinik olarak makul, gerçekçi diyalog yaz; forbidden
başlıkların transkriptte gerçekten geçmediğinden emin ol.

## Metrikler

Her vaka için, `expected_entries` ile model çıktısı greedy eşleştirilir:

- **Başlık eşleşmesi**: normalize (TR küçük harf, `â/î/û → a/i/u`, noktalama silinir)
  sonrası eşitlik, substring, token containment veya Jaccard ≥ 0.5.
- **Cevap eşleşmesi**: beklenen cevabın içerik token'larının (stopword'ler çıkarılmış)
  en az %50'si model cevabında geçiyorsa eşleşme.

Sonra:

| Metrik | Tanım |
| --- | --- |
| `precision` | Çıkarılan entry'lerden kaçı beklenenlerle eşleşti (`matched / extracted`) |
| `recall` | Beklenenlerin kaçı yakalandı (`matched / expected`) |
| `hallucination` | Forbidden başlıkla eşleşen entry'ler + hiçbir beklenenle eşleşmeyen (groundingsiz) entry'ler |

Bir vakanın geçmesi için: `precision ≥ 0.8`, `recall ≥ 0.8` ve `hallucination = 0`.
Özet satırı mikro ortalamadır (tüm vakaların sayaçları toplanıp bölünür).

## %98 hedefi hakkında

Baraj (0.8) bilinçli olarak toleranslıdır: başlık birleştirme/bölme gibi zararsız farklar
vakayı düşürmesin diye. **%98+ iddiası** için raporlardaki `precision_micro` /
`recall_micro` ≥ 0.98 ve `hallucinations = 0` olmalı; vaka sayısı arttıkça (hedef:
onlarca vaka) bu değerler anlamlı hale gelir. 4 vakalık bir set %98 kanıtı sayılmaz.

## Bilinen sınırlar

- Eşleşme token-overlap tabanlıdır; eş anlamlı ama token'ları farklı doğru cevaplar
  (örn. "tansiyon" yerine "hipertansiyon") recall'u düşürebilir. Yanlış negatifleri
  vaka JSON'unda beklenen cevabı zenginleştirerek yönet.
- Mock mod modeli taklit eder, model kalitesini ölçmez; sadece harness/CI doğrulamasıdır.
