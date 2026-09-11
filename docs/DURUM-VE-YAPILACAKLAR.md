# SA Printpro — Durum ve Yapılacaklar Raporu

> **Son güncelleme:** 2026-09-11
> **Depo:** [`acar32furkan-glitch/sa-printpro`](https://github.com/acar32furkan-glitch/sa-printpro)
> **Dal:** `main`
> **Canlı alan adı (hedef):** `https://saprintpro.com`

Bu doküman, projenin mevcut durumunu, tamamlanan işleri ve devreye alınmayı bekleyen
adımları tek bir yerde toplar. Yeni bir geliştirici veya farklı bir ortamda test
yapacak biri için başlangıç referansı olarak tasarlanmıştır.

---

## 1. Proje Özeti

**SA Printpro**, motosiklet aksesuar ve baskı ürünleri satan bir markanın vitrin
sitesidir. Mimari üç katmandan oluşur:

| Katman | Teknoloji | Görev |
|--------|-----------|-------|
| Vitrin (statik) | **Astro v7** (`output: 'static'`) | SEO odaklı, hızlı, JS-minimal vitrin + ürün/marka/kategori sayfaları |
| Katalog kaynağı | **Trendyol V2 Seller API** | 234 ürünün fiyat/stok/görsel senkronizasyonu |
| İçerik zenginleştirme | **DeepSeek AI** | 234 ürün için başlık/açıklama/SEO metni üretimi |
| Görsel işleme | **Sharp** | Ürün görsellerinin yerel, filigranlı WebP kopyaları |
| Dağıtım | **Cloudflare Worker + Static Assets** | Statik çıktı servisi + dinamik OAuth/webhook uç noktaları |
| Doğrudan satış | **Shopier OAuth + WhatsApp** | Trendyol bağımlılığı olmadan doğrudan satış |

**Temel tasarım kararı:** Site artık bir "Trendyol vitrini" değil, **Shopier-odaklı
doğrudan satış** kanalıdır. Trendyol butonları [`src/config/site.js`](../src/config/site.js:25)
içindeki `enableTrendyolCta: false` ile kapatılmıştır; Trendyol yalnızca katalog
kaynağı olarak kullanılır.

---

## 2. Tamamlanan İşler ✅

### 2.1 Altyapı ve Depo

- ✅ **Git deposu ve GitHub bağlantısı** — `origin` → `acar32furkan-glitch/sa-printpro`,
  aktif dal `main`.
- ✅ **Astro v7 statik çıktı** — `output: 'static'`, `dist/` klasörüne build.
- ✅ **Node LTS doğrulaması** — Node 24 (Krypton) hedefleniyor; doğrulama notu
  [`docs/verification/node-lts.md`](verification/node-lts.md).
- ✅ **Cloudflare Pages/Worker doğrulama notları** —
  [`docs/verification/cloudflare-pages.md`](verification/cloudflare-pages.md).

### 2.2 Katalog ve Veri Hattı

- ✅ **Trendyol V2 API entegrasyonu** — [`scripts/fetch-trendyol.mjs`](../scripts/fetch-trendyol.mjs)
  ile **234 ürün** çekildi, `src/data/products.json` üretildi.
  Doğrulama: [`docs/verification/trendyol-api.md`](verification/trendyol-api.md).
- ✅ **Trendyol V1 kapanış takibi** — V1 ürün servisleri **15 Eylül 2026**'da
  kapatılıyor; V2'ye geçiş tamamlandı.
  Doğrulama: [`docs/verification/trendyol-v1-shutdown.md`](verification/trendyol-v1-shutdown.md).
- ✅ **DeepSeek AI ile zenginleştirme** — [`scripts/enrich-catalog-ai.mjs`](../scripts/enrich-catalog-ai.mjs)
  ile 234 ürünün tamamı zenginleştirildi → `src/data/ai-enriched.json`.
- ✅ **Rakip marka temizleme** — [`scripts/sanitize-catalog.mjs`](../scripts/sanitize-catalog.mjs)
  içindeki `sanitizeCatalogText` fonksiyonu, ürün metinlerinden rakip marka
  referanslarını temizler.
- ✅ **Arama indeksi** — [`scripts/build-search-index.mjs`](../scripts/build-search-index.mjs)
  → `public/search-index.json`.

### 2.3 Görseller

- ✅ **Sharp ile filigranlı yerel WebP görselleri** —
  [`scripts/process-images.mjs`](../scripts/process-images.mjs) ile 234 ürünün
  görseli işlendi → `public/uploads/products/*.webp`.
  Görseller yerel olarak servis edilir (Trendyol CDN'e bağımlılık yok).

### 2.4 Ticari Koruma ve Satış Mantığı

- ✅ **Buybox & rakip koruma kalkanı** — Stok `0` olduğunda Trendyol linki
  gizlenir; kullanıcı rakip listelemesine yönlendirilmez.
- ✅ **Shopier-odaklı doğrudan satış modu** — `enableTrendyolCta: false` ile tüm
  Trendyol CTA'ları ve rozetleri gizlendi; birincil kanal Shopier + WhatsApp.
- ✅ **Web'e özel indirim gösterimi** — `enableDirectDiscount: true`,
  `directDiscountRate: 0.2` (%20) ile doğrudan satış fiyatı vurgulanır.
- ✅ **WhatsApp entegrasyonu** — `905542993058` numarası
  [`src/config/site.js`](../src/config/site.js:8) içinde tanımlı.

### 2.5 SEO ve Pazarlama

- ✅ **SEO şemaları** — `Product`, `BreadcrumbList`, `FAQPage`, `ImageObject`,
  `MerchantReturnPolicy` (bkz. [`src/components/Seo.astro`](../src/components/Seo.astro)).
- ✅ **Statik marka sayfaları** — `/marka/[slug]` dinamik rotası,
  `getStaticPaths()` ile statik üretim. Toplam **259 sayfa** build ediliyor.
- ✅ **Kategori sayfaları** — `/kategori/[slug]`.
- ✅ **Ürün sayfaları** — `/urun/[slug]`.
- ✅ **Sitemap** — `@astrojs/sitemap` ile `sitemap-index.xml` üretimi.
- ✅ **Google Merchant feed** — [`scripts/generate-feed.mjs`](../scripts/generate-feed.mjs)
  → `public/google-merchant.xml`.
- ✅ **GA4 entegrasyonu** — `G-HK6Q53CMG1`, Consent Mode v2 uyumlu
  (bkz. [`src/lib/consent.js`](../src/lib/consent.js) ve
  [`docs/verification/ga4-consent-mode.md`](verification/ga4-consent-mode.md)).
- ✅ **Google doğrulama** — Search Console HTML dosyası
  (`public/google419bc019c17c40b5.html`) + Merchant Center meta etiketi
  ([`src/config/site.js`](../src/config/site.js:20)).
- ✅ **IndexNow anahtarı** — `public/saprintpro-indexnow-key.txt` ve
  [`scripts/notify-indexnow.mjs`](../scripts/notify-indexnow.mjs).

### 2.6 Shopier Entegrasyonu (Kod Tarafı)

- ✅ **Shopier OAuth Worker** — [`worker/index.js`](../worker/index.js) içinde
  `/shopier/oauth/callback` ve `/api/shopier/webhook` uç noktaları.
- ✅ **Wrangler yapılandırması** — [`wrangler.toml`](../wrangler.toml) ile
  "Workers with static assets" dağıtımı (`ASSETS` binding, `./dist`).
- ✅ **Shopier uygulama görselleri** — `public/shopier/` altında app icon
  (256/512) ve 3 adet ekran görüntüsü.
- ✅ **Shopier CSV içe aktarma** — [`scripts/import-shopier-csv.mjs`](../scripts/import-shopier-csv.mjs).
- ✅ **Shopier asset üretimi** — [`scripts/generate-shopier-assets.mjs`](../scripts/generate-shopier-assets.mjs).

---

## 3. Bekleyen İşler ⏳

Aşağıdaki adımlar **sırayla** tamamlanmalıdır. Her adım bir sonrakine bağımlıdır.

### 3.1 Shopier Uygulama Onayı (BLOKER)

**Durum:** Oluşturulan OAuth uygulaması Shopier tarafından **ONAY BEKLİYOR**.

- Onay gelmeden `/shopier/oauth/callback` akışı **test edilemez**.
- Onay süresince `SHOPIER_CLIENT_ID` / `SHOPIER_CLIENT_SECRET` değerleri
  üretim ortamına konulmamalıdır (geçersiz olabilir).
- **Aksiyon:** Shopier Partner panelinden onay durumunu takip et; onay
  e-postası/bildirimi geldiğinde 3.2 adımına geç.

### 3.2 Cloudflare Secret Tanımlama

Onay sonrası, Worker'ın çalışması için secret'lar Cloudflare'e tanımlanmalıdır.
Secret'lar **asla** `wrangler.toml` içine yazılmaz.

```bash
npx wrangler secret put SHOPIER_CLIENT_ID
npx wrangler secret put SHOPIER_CLIENT_SECRET
npx wrangler secret put SHOPIER_REDIRECT_URI
```

- Her komut, değeri interaktif olarak sorar (değeri komut satırına yazmayın).
- Alternatif: Cloudflare Dashboard → Worker → Settings → Variables and Secrets.
- `SHOPIER_REDIRECT_URI` değeri: `https://saprintpro.com/shopier/oauth/callback`
  (bu değer [`wrangler.toml`](../wrangler.toml:26) içinde `[vars]` olarak da
  tanımlıdır; secret olarak tanımlamak zorunlu değildir).

### 3.3 Cloudflare Deploy

Worker entry script'i (`worker/index.js`) bulunduğu için **`wrangler deploy`
gereklidir**; yalnızca statik asset yüklemek yeterli değildir.

```bash
npm run build && npx wrangler deploy
```

- `npm run build` → arama indeksi + feed üretimi + `astro build` (259 sayfa).
- `npx wrangler deploy` → Worker + `./dist` statik assetlerini yükler.
- **Dikkat:** Cloudflare Dashboard üzerinden Git entegrasyonu kullanılıyorsa,
  build komutu `npm run build` olarak ayarlanmış olabilir; bu durumda Worker
  deploy edilmez. Dashboard build komutunun `wrangler deploy`'a göre
  ayarlanması **gerekebilir** (veya deploy tamamen CLI üzerinden yapılmalıdır).

### 3.4 DNS Yayılımı

**Durum:** Türkticaret'te NS kayıtları Cloudflare'e yönlendirildi ancak domain
henüz Cloudflare panelinde **`Active`** değil.

- Yayılım süresi: **1–24 saat**.
- `saprintpro.com` çözümlenmeye başladığında (DNS propagation tamamlandığında)
  site test edilmelidir.
- **Kontrol:** `nslookup saprintpro.com` veya Cloudflare panelinde domain
  durumunun `Active` olması.

### 3.5 IndexNow Ping

DNS oturduktan **sonra** çalıştırılmalıdır:

```bash
node scripts/notify-indexnow.mjs --host=saprintpro.com
```

- **Şu anki durum:** `403` döner — site henüz canlı erişilemez durumda.
- DNS + deploy tamamlandıktan sonra tekrar denenmeli.

### 3.6 Google Search Console

- Mülk (property) ekle: `https://saprintpro.com`.
- Doğrulama: HTML dosyası (`public/google419bc019c17c40b5.html`) zaten
  `public/` içinde; deploy sonrası erişilebilir olacak.
- `sitemap-index.xml` adresini gönder: `https://saprintpro.com/sitemap-index.xml`.

### 3.7 Google Merchant Center

- `google-merchant.xml` feed'ini bağla:
  `https://saprintpro.com/google-merchant.xml`.
- Meta etiketi doğrulaması [`src/config/site.js`](../src/config/site.js:20)
  içinde tanımlı; deploy sonrası aktif olacak.

### 3.8 `shopier.json` Doldurma

**Durum:** [`src/config/shopier.json`](../src/config/shopier.json) şu an **boş** (`{}`).

- Ürün barkodu → Shopier ürün linki eşlemesi girilmelidir.
- **Aksi halde:** Shopier butonu görünmez, yalnızca WhatsApp kanalı çalışır.
- İçe aktarma için [`scripts/import-shopier-csv.mjs`](../scripts/import-shopier-csv.mjs)
  kullanılabilir (Shopier CSV dışa aktarımı ile).

### 3.9 Webhook İmza Doğrulaması

**Durum:** [`worker/index.js`](../worker/index.js:207) içinde TODO yer tutucusu var.

```js
// TODO: Shopier webhook imzasini (varsa) env.SHOPIER_WEBHOOK_SECRET ile dogrula.
```

- Shopier webhook imza şeması teyit edilmeli.
- `SHOPIER_WEBHOOK_SECRET` secret'ı tanımlanmalı.
- İmza doğrulaması başarısızsa istek `401` ile reddedilmeli.

### 3.10 Shopier OAuth Token Endpoint Doğrulaması

**Durum:** Varsayılan endpoint [`worker/index.js`](../worker/index.js:16) içinde
`https://www.shopier.com/oauth/token` olarak tanımlı.

- Bu endpoint'in **gerçek** olduğu Shopier dokümantasyonundan teyit edilmelidir.
- Farklıysa `SHOPIER_TOKEN_ENDPOINT` ortam değişkeni ile override edilebilir
  (kod bu override'ı destekliyor).

---

## 4. Başka Sitede Test İçin Taşınabilir Notlar

Bu proje, farklı bir ortamda (başka bir hosting veya yerel makine) test edilebilir.
Aşağıdaki notlar taşınabilirlik için gereklidir.

### 4.1 Statik Site Testi

Statik çıktı herhangi bir hosting'de test edilebilir:

- **Netlify / Vercel:** Build komutu `npm run build`, yayın dizini `dist`.
- **Yerel önizleme:** `npm run preview` (Astro preview sunucusu).
- **Yerel geliştirme:** `npm run dev`.

> Not: Statik site tek başına çalışır; ancak `/shopier/oauth/callback` ve
> `/api/shopier/webhook` uç noktaları **yalnızca Worker** ile çalışır.

### 4.2 OAuth Testi (Yerel Worker)

Gerçek OAuth akışını yerelde test etmek için:

```bash
# 1. .dev.vars dosyasını oluştur (gerçek secret'larla)
copy .dev.vars.example .dev.vars

# 2. Worker'ı yerel olarak çalıştır
npx wrangler dev
```

- `.dev.vars` dosyası Git tarafından yok sayılır — **asla commit etmeyin**.
- İçerik: `SHOPIER_CLIENT_ID`, `SHOPIER_CLIENT_SECRET`, `SHOPIER_REDIRECT_URI`.

### 4.3 Test İçin Gerekli Ortam Değişkenleri

Tam liste için [`.env.example`](../.env.example) referans alınmalıdır:

| Değişken | Kullanım | Zorunlu |
|----------|----------|---------|
| `TRENDYOL_API_KEY` | Trendyol V2 API anahtarı | Katalog senkronu için |
| `TRENDYOL_API_SECRET` | Trendyol V2 API secret | Katalog senkronu için |
| `TRENDYOL_SUPPLIER_ID` | Satıcı kimliği (sayısal) | Katalog senkronu için |
| `TRENDYOL_SELLER_ID` | `SUPPLIER_ID` alias'ı | Opsiyonel |
| `TRENDYOL_INTEGRATION_CODE` | Entegrasyon kodu (UUID) | Opsiyonel |
| `TRENDYOL_TOKEN` | Base64(apiKey:apiSecret) | Opsiyonel (script üretir) |
| `DEEPSEEK_API_KEY` | DeepSeek AI içerik üretimi | Zenginleştirme için |
| `SHOPIER_CLIENT_ID` | Shopier OAuth client ID | OAuth için |
| `SHOPIER_CLIENT_SECRET` | Shopier OAuth client secret | OAuth için (yalnız sunucu) |
| `SHOPIER_REDIRECT_URI` | OAuth dönüş adresi | OAuth için |
| `NODE_VERSION` | Node sürümü (hosting) | Hosting'e bağlı |

### 4.4 Önemli Uyarılar

- **Gerçek Shopier OAuth akışı** yalnızca **onaylı `redirect_uri`** ve **canlı
  domain** ile test edilebilir. Shopier, kayıtlı olmayan redirect URI'leri reddeder.
- Alternatif olarak `wrangler dev` + `--host` override ile yerel test yapılabilir;
  ancak Shopier tarafında kayıtlı `redirect_uri` ile eşleşmesi gerekir.
- Secret'lar **hiçbir zaman** istemci tarafına (tarayıcıya) gönderilmez; yalnızca
  Worker (sunucu tarafı) okur.

---

## 5. Ortam Değişkenleri Referansı

[`.env.example`](../.env.example) içeriğinin özeti:

### Trendyol V2

```dotenv
TRENDYOL_API_KEY=your_api_key_here
TRENDYOL_API_SECRET=your_api_secret_here
TRENDYOL_SUPPLIER_ID=your_supplier_id_here
TRENDYOL_SELLER_ID=your_supplier_id_here
TRENDYOL_INTEGRATION_CODE=your_integration_code_here
TRENDYOL_TOKEN=your_base64_token_here
```

- `TRENDYOL_API_KEY` / `TRENDYOL_API_SECRET`: Trendyol "Integration Information"
  panelinden alınır (40 karakter).
- `TRENDYOL_SUPPLIER_ID`: Satıcı kimliği (sayısal). Script `TRENDYOL_SUPPLIER_ID`
  bekler; `TRENDYOL_SELLER_ID` aynı değerdir (alias).
- `TRENDYOL_INTEGRATION_CODE`: Entegrasyon kodu (UUID) — opsiyonel.
- `TRENDYOL_TOKEN`: Base64(apiKey:apiSecret) — opsiyonel, script kendisi üretir.

### DeepSeek AI

```dotenv
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

- `https://platform.deepseek.com/api_keys` adresinden alınır.
- [`scripts/enrich-catalog-ai.mjs`](../scripts/enrich-catalog-ai.mjs) tarafından
  kullanılır.

### Shopier OAuth

```dotenv
SHOPIER_CLIENT_ID=your_client_id
SHOPIER_CLIENT_SECRET=your_client_secret
SHOPIER_REDIRECT_URI=https://saprintpro.com/shopier/oauth/callback
```

- Shopier Partner panelinden alınır.
- Bu değerler **yalnızca Cloudflare Worker sunucu tarafında** kullanılır.
- Cloudflare'de `wrangler secret put SHOPIER_CLIENT_SECRET` ile tanımlanır;
  **asla istemci tarafına gönderilmez**.

### Node

```dotenv
NODE_VERSION=24
```

- Node 24 (Krypton) Active LTS hedeflenir; Astro v7 Node 22 & 24 destekler.

---

## 6. Hızlı Kontrol Listesi

Devreye alma sırası:

- [ ] Shopier uygulama onayı alındı
- [ ] Cloudflare secret'ları tanımlandı (`SHOPIER_CLIENT_ID/SECRET/REDIRECT_URI`)
- [ ] `npm run build && npx wrangler deploy` çalıştırıldı
- [ ] DNS `Active` durumda, `saprintpro.com` çözümleniyor
- [ ] `node scripts/notify-indexnow.mjs --host=saprintpro.com` başarılı (403 değil)
- [ ] Google Search Console mülkü eklendi + `sitemap-index.xml` gönderildi
- [ ] Google Merchant Center `google-merchant.xml` feed'i bağlandı
- [ ] `src/config/shopier.json` ürün eşlemesi ile dolduruldu
- [ ] Webhook imza doğrulaması tamamlandı
- [ ] Shopier OAuth token endpoint teyit edildi

---

## 7. İlgili Dokümanlar

- [`README.md`](../README.md) — Proje genel bakış
- [`docs/verification/README.md`](verification/README.md) — Doğrulama bulguları indeksi
- [`docs/verification/trendyol-api.md`](verification/trendyol-api.md) — Trendyol V2 API
- [`docs/verification/trendyol-v1-shutdown.md`](verification/trendyol-v1-shutdown.md) — V1 kapanış
- [`docs/verification/astro-static-output.md`](verification/astro-static-output.md) — Astro statik çıktı
- [`docs/verification/cloudflare-pages.md`](verification/cloudflare-pages.md) — Cloudflare dağıtım
- [`docs/verification/ga4-consent-mode.md`](verification/ga4-consent-mode.md) — GA4 / Consent Mode
- [`docs/verification/node-lts.md`](verification/node-lts.md) — Node LTS
