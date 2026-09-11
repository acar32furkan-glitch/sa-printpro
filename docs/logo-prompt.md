# SA Printpro — Logo Üretim Promptu

Bu doküman, SA Printpro vitrininin **saf beyaz / kurumsal minimal** temasına uygun
logo ve favicon üretmek için kullanılacak hazır promptları içerir. Görsel üretim
aracına (ChatGPT / DALL·E, Midjourney, Ideogram, Gemini vb.) doğrudan kopyala-yapıştır
yapılabilir.

---

## 1. Marka Özeti

| Alan           | Değer                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Marka adı     | **SA Printpro**                                                                                |
| Sektör        | Reflektif sticker, güvenlik etiketi, araç/logo etiketi üretimi                                    |
| Konumlandırma | Kurumsal, güvenilir, teknik hassasiyet, minimal                                                     |
| Tema           | Saf beyaz zemin (`#FFFFFF`), ince gri çizgiler (`#E4E4E7`), kömür siyahı metin (`#18181B`) |
| Tipografi      | Inter (sans-serif), temiz ve nötr                                                                   |
| Vurgu rengi    | Nötr siyah/beyaz; ikincil olarak çok hafif zümrüt yeşili (`#059669`) yalnızca CTA'da         |

**Kaçınılacaklar:** CMYK matbaa jargonu, crop mark, register haçı, neon renkler,
gradyan patlamaları, 3D gölgeler, karmaşık illüstrasyon, fazla detay.

---

## 2. Ana Logo Promptu (Yatay Wordmark — Navbar için)

> **Kullanım:** Navbar sol üst köşe. Yatay (geniş) format. Beyaz zemin üzerinde net okunmalı.

```
Minimal corporate wordmark logo for a reflective sticker and safety label
manufacturing brand named "SA Printpro".

Style: ultra-clean, modern, Swiss-style corporate minimalism. Flat vector,
no gradients, no 3D, no shadows, no texture.

Composition: horizontal lockup. A simple geometric monogram mark on the left
(abstract "SA" formed from two clean overlapping shapes suggesting a printed
label / reflective sheet), followed by the wordmark "SA Printpro" in a clean
geometric sans-serif typeface (similar to Inter or Helvetica Neue), medium-bold
weight, tight letter spacing.

Color: pure black (#18181B) on a pure white (#FFFFFF) background. Monochrome
only. High contrast, crisp edges.

The mark should feel precise, technical and trustworthy — like a premium
industrial print lab, not playful.

Output: centered on a plain white background, generous padding, sharp vector
quality, suitable for a website header at 36px height. Aspect ratio roughly
2.5:1 (wide horizontal).
```

---

## 3. Kare İkon / Favicon Promptu

> **Kullanım:** Tarayıcı sekmesi ikonu, apple-touch-icon, sosyal medya profil resmi.
> Kare format. Küçük boyutta (16×16) bile net kalmalı.

```
Minimal square app icon / favicon for a reflective sticker and safety label
brand "SA Printpro".

Style: ultra-clean flat vector, corporate minimalism, no gradients, no shadows,
no 3D, no texture.

Composition: a single bold geometric monogram — the letters "SA" combined into
one compact, balanced symbol, or an abstract mark suggesting a layered printed
label / reflective sheet with a subtle corner peel. Centered, with comfortable
padding inside the square.

Color: pure black (#18181B) symbol on a pure white (#FFFFFF) background.
Monochrome only. Maximum contrast, crisp edges, legible even at 16x16 pixels.

Output: perfect 1:1 square, plain white background, sharp vector quality,
suitable for a browser favicon and app icon.
```

---

## 4. Koyu Tema Varyantı (Opsiyonel)

> **Kullanım:** Sitenin dark modu. Mevcut kod `dark:brightness-0 dark:invert`
> filtresiyle logoyu otomatik beyaza çevirir; ancak ayrı bir beyaz varyant
> üretmek isterseniz bu promptu kullanın.

```
Same minimal corporate wordmark logo for "SA Printpro" as described above,
but inverted: pure white (#FFFFFF) mark and wordmark on a pure black (#09090B)
background. Monochrome only, flat vector, no gradients, no shadows.
Wide horizontal aspect ratio (~2.5:1).
```

---

## 5. Üretim Sonrası Yerleştirme Adımları

1. Üretilen **yatay wordmark** görselini indir ve proje kökündeki `logo/` klasörüne koy.
2. Üretilen **kare ikon** görselini indir ve aynı klasöre koy.
3. Dosyaları şu adlarla `public/` dizinine kopyala:

   - Yatay wordmark → `public/logo.png`
   - Kare ikon → `public/favicon.png`
4. `src/config/site.js` içindeki değerlerin doğru olduğundan emin ol:

   ```js
   logoFile: 'logo.png',
   faviconFile: 'favicon.png',
   ```
5. `src/components/Logo.astro` bileşeni logoyu otomatik olarak `/logo.png`
   yolundan okur; `width`/`height` niteliklerini yeni görselin gerçek piksel
   boyutlarıyla güncelle (CLS'i önlemek için).
6. `src/layouts/Layout.astro` favicon'u `/favicon.png` yolundan otomatik okur.
7. Doğrulama:

   ```bash
   npm run lint
   npm run build
   npm run preview
   ```

   Tarayıcıda `http://localhost:4321` adresini açıp logonun beyaz zeminde net
   göründüğünü ve dark modda doğru renge döndüğünü kontrol et.

---

## 6. Teknik Gereksinimler (Özet)

| Gereksinim            | Değer                                                                |
| --------------------- | --------------------------------------------------------------------- |
| Format                | PNG (şeffaf veya beyaz zemin), tercihen SVG kaynağı da saklanmalı |
| Wordmark oranı       | ~2.5:1 (yatay)                                                        |
| Favicon oranı        | 1:1 (kare)                                                            |
| Wordmark yüksekliği | En az 400px (retina için), navbar'da 36px'e ölçeklenir             |
| Favicon boyutu        | En az 512×512px                                                      |
| Renk                  | Monokrom siyah (#18181B) / beyaz (#FFFFFF)                            |
| Zemin                 | Saf beyaz (#FFFFFF)                                                   |
| Stil                  | Flat vektör, gradyan yok, gölge yok, 3D yok                         |
