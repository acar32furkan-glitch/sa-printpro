# Trendyol Product Showcase — Astro Şablonu

> **%100 saf statik, ürün-öncelikli, yeniden kullanılabilir (white-label) Trendyol vitrin şablonu.**
> Varsayılan örnek satıcı: **SA Printpro**. Başka bir Trendyol satıcısına uyarlamak için
> yalnızca [`src/config/site.js`](src/config/site.js) ve `.env.local` dosyalarını düzenlemek yeterlidir.

---

## İçindekiler

1. [Proje Tanıtımı & Mimari Özet](#1-proje-tanıtımı--mimari-özet)
2. [Hızlı Başlangıç (Yerel Geliştirme)](#2-hızlı-başlangıç-yerel-geliştirme)
3. [Sıfırdan Cloudflare Pages Dağıtımı](#3-sıfırdan-cloudflare-pages-dağıtımı)
4. [GitHub Secrets Yapılandırması](#4-github-secrets-yapılandırması)
5. [Otomatik Senkronizasyon (GitHub Actions)](#5-otomatik-senkronizasyon-github-actions)
6. [Shopier CSV İçe Aktarma Rehberi](#6-shopier-csv-içe-aktarma-rehberi)
7. [Şablonun Başka Bir Satıcıya Uyarlanması (White-label)](#7-şablonun-başka-bir-satıcıya-uyarlanması-white-label)
8. [Kabul Kriterleri Doğrulama Listesi](#8-kabul-kriterleri-doğrulama-listesi)
9. [Proje Yapısı](#9-proje-yapısı)
10. [Sorun Giderme](#10-sorun-giderme)

---

## 1. Proje Tanıtımı & Mimari Özet

Bu proje bir **marka pazarlama sitesi değil**, bir **ürün keşif aracıdır**. Her ekran ziyaretçinin
bir ürünü bulmasına, değerlendirmesine ve satın almasına yardımcı olmak için vardır. Büyük hero
banner'lar, hikâye anlatımı bölümleri veya dekoratif infografikler yoktur.

### Neden %100 Saf Statik Astro?

| Karar | Gerekçe |
|-------|---------|
| **`output: 'static'`** | Site hiçbir zaman istek anında render edilmez. Backend, veritabanı, API route, middleware veya SSR adapter **yoktur**. |
| **Build-time sync** | Trendyol API'si yalnızca **build öncesinde** (CI'da) çağrılır. Sonuç `src/data/products.json` olarak depoya commit edilir. |
| **Zero runtime API call** | Ziyaretçi tarayıcısı Trendyol API'sine **asla** istek atmaz. API anahtarları istemciye hiçbir zaman sızmaz. |
| **Cloudflare Pages** | Ücretsiz, ticari kullanıma izin verir, statik siteler için sınırsız bant genişliği sunar. |
| **React Islands** | Yalnızca gerçekten etkileşim gerektiren bileşenler (VariantSelector, Gallery, SearchBar, ThemeToggle, CookieBanner, SortFilterBar) React'tir. Geri kalan her şey saf `.astro` markup'ıdır ve **sıfır JS** gönderir. |

### Veri Akışı (Build-time)

```
Trendyol V2 API  →  scripts/fetch-trendyol.mjs  →  src/data/products.json (repoya commit)
                                                              │
                                                              ▼
                                                    astro build  →  dist/  →  Cloudflare Pages
```

- **Görseller indirilmez.** Trendyol CDN URL'leri (`cdn.dsmcdn.com`) doğrudan kullanılır.
- **`astro build` yalnızca diskten okur.** Build sırasında hiçbir `fetch` çağrısı yapılmaz.
- **Dinamik rotalar** (`src/pages/**/[slug].astro`) `getStaticPaths()` ile `products.json`'ı
  doğrudan statik import ederek her ürün/kategori için bir sayfa üretir.

### Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Framework | Astro 7 (statik çıktı) |
| UI Islands | React 19 (`@astrojs/react`) |
| Stil | Tailwind CSS 3 (`@astrojs/tailwind`) |
| SEO | `@astrojs/sitemap` + JSON-LD |
| İkonlar | `lucide-react` (island içinde) / inline SVG (statik markup) |
| Lint/Format | ESLint 9 (flat config) + Prettier |
| Runtime | Node.js 20 LTS (CI) / Node 22+ (yerel) |

---

## 2. Hızlı Başlangıç (Yerel Geliştirme)

### Gereksinimler

- **Node.js 20 LTS veya üzeri** (CI iş akışı Node 20 kullanır; yerelde Node 22/24 de çalışır)
- **npm** (proje `package-lock.json` ile gelir)

### Kurulum

```bash
# 1) Bağımlılıkları kur (peer-dependency çakışmaları için legacy flag gerekir)
npm ci --legacy-peer-deps

# 2) Ortam değişkenlerini hazırla
cp .env.example .env.local
# .env.local dosyasını Trendyol API bilgilerinizle doldurun

# 3) Kataloğu Trendyol'dan çek
npm run sync

# 4) Geliştirme sunucusunu başlat
npm run dev
```

### Kullanılabilir Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusunu başlatır (`astro dev`) |
| `npm run build` | Statik üretim çıktısını `dist/` dizinine oluşturur |
| `npm run preview` | Build çıktısını yerel olarak önizler |
| `npm run sync` | Trendyol API'sinden kataloğu çeker → `src/data/products.json` |
| `npm run import-shopier` | `shopier-links.csv` → `src/config/shopier.json` |
| `npm run lint` | ESLint ile tüm projeyi denetler |
| `npm run lint:fix` | ESLint sorunlarını otomatik düzeltir |
| `npm run format` | Prettier ile tüm dosyaları biçimlendirir |

### Ortam Değişkenleri (`.env.local`)

```dotenv
TRENDYOL_API_KEY=your_api_key
TRENDYOL_API_SECRET=your_api_secret
TRENDYOL_SUPPLIER_ID=your_supplier_id
```

> `.env.local` **asla** commit edilmez (`.gitignore` içinde `.env.*` hariç tutulur).
> Yalnızca `.env.example` şablonu depoda tutulur.

---

## 3. Sıfırdan Cloudflare Pages Dağıtımı

Bu şablon **saf statik** çıktı üretir; bu nedenle `@astrojs/cloudflare` adapter'ı **gerekmez**
(adapter yalnızca SSR/on-demand render için gereklidir).

### Adım Adım Kurulum

#### 3.1. GitHub Deposunu Bağlayın

1. Kodu bir GitHub deposuna push edin (`main` dalı).
2. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application**.
3. **Pages** sekmesi → **Import an existing Git repository** → **Connect GitHub**.
4. Depoyu seçin → **Begin setup**.

#### 3.2. Build Ayarları

| Ayar | Değer |
|------|-------|
| **Project name** | `saprintpro` (veya istediğiniz ad) |
| **Production branch** | `main` |
| **Framework preset** | `Astro` (veya `None` — ikisi de çalışır) |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (varsayılan) |

#### 3.3. Node Sürümü Ortam Değişkeni

Cloudflare Pages varsayılan Node sürümünü kullanır. Tutarlılık için açıkça belirtin:

**Settings → Environment variables → Production (ve Preview):**

| Değişken | Değer |
|----------|-------|
| `NODE_VERSION` | `20` (veya `22`) |

> **Not:** `NODE_VERSION` yalnızca Cloudflare'in **build** ortamını etkiler. Trendyol API
> anahtarlarını Cloudflare'e **eklemeyin** — senkronizasyon GitHub Actions'ta çalışır ve
> güncellenmiş `products.json` repoya commit edilir; Cloudflare yalnızca build eder.

#### 3.4. İlk Dağıtım

**Save and Deploy** düğmesine basın. Cloudflare:
1. Depoyu klonlar,
2. `npm ci` (veya `npm install`) çalıştırır,
3. `npm run build` ile `dist/` üretir,
4. `dist/` içeriğini global CDN'e yayınlar.

Her `main` dalına push, otomatik olarak yeni bir dağıtım tetikler.

#### 3.5. Custom Domain & SSL

1. **Pages projesi → Custom domains → Set up a custom domain**.
2. Alan adınızı girin (ör. `saprintpro.com`).
3. Cloudflare, alan adı zaten Cloudflare'de yönetiliyorsa DNS kaydını otomatik ekler;
   aksi halde gösterilen `CNAME` kaydını DNS sağlayıcınızda oluşturun.
4. **SSL/TLS**: Cloudflare, tüm `*.pages.dev` ve custom domain'ler için **otomatik olarak
   ücretsiz SSL sertifikası** sağlar. Ek yapılandırma gerekmez.
5. **SSL/TLS → Overview → Encryption mode**: `Full (strict)` önerilir.

> **Önemli:** `src/config/site.js` içindeki `domain` değerini gerçek alan adınızla güncelleyin.
> Bu değer canonical URL'ler, sitemap ve Open Graph etiketleri için kullanılır.

---

## 4. GitHub Secrets Yapılandırması

[`.github/workflows/sync.yml`](.github/workflows/sync.yml) iş akışının çalışması için **3 adet
repository secret** tanımlanmalıdır.

### Secret'ları Ekleme

GitHub deposu → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret Adı | Açıklama | Nereden Alınır |
|------------|----------|----------------|
| `TRENDYOL_API_KEY` | Trendyol Seller API anahtarı | Trendyol Satıcı Paneli → Hesap Bilgileri → API Entegrasyon |
| `TRENDYOL_API_SECRET` | Trendyol Seller API gizli anahtarı | Aynı yer (API anahtarı ile birlikte üretilir) |
| `TRENDYOL_SUPPLIER_ID` | Trendyol satıcı (tedarikçi) numarası | Trendyol Satıcı Paneli → Hesap Bilgileri |

### Güvenlik Notları

- Secret'lar iş akışına yalnızca `env:` bloğu üzerinden enjekte edilir — **asla** kod içine
  veya loglara yazılmaz.
- `scripts/fetch-trendyol.mjs`, `process.env` değerlerini `.env.local` üzerine öncelikli olarak
  okur; bu sayede CI ortamında dosya gerekmez.
- Secret'ları döndürdükten (rotate) sonra GitHub'da da güncelleyin.

---

## 5. Otomatik Senkronizasyon (GitHub Actions)

### İş Akışı: [`.github/workflows/sync.yml`](.github/workflows/sync.yml)

| Özellik | Değer |
|---------|-------|
| **Tetikleyici (Cron)** | `0 5,17 * * *` — günde iki kez (05:00 ve 17:00 UTC) |
| **Tetikleyici (Manuel)** | `workflow_dispatch` — Actions sekmesinden "Run workflow" |
| **Runner** | `ubuntu-latest` |
| **Node.js** | 20 LTS (`actions/setup-node@v4`, `cache: 'npm'`) |
| **İzinler** | `permissions: contents: write` |
| **Eşzamanlılık** | `concurrency: trendyol-sync` (paralel çalışma engellenir) |

### İş Akışı Adımları

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node.js** — `actions/setup-node@v4` (`node-version: 20`, `cache: 'npm'`)
3. **Install dependencies** — `npm ci --legacy-peer-deps`
4. **Sync** — `npm run sync` (3 secret `env:` üzerinden enjekte edilir)
5. **Değişiklik kontrolü** — `git diff --quiet -- src/data/products.json`
   - Değişiklik **yoksa** → `changed=false`, commit adımı atlanır (no-op, temiz Git geçmişi)
   - Değişiklik **varsa** → `changed=true`
6. **Commit & Push** (yalnızca değişiklik varsa)
   ```
   git config user.name "Trendyol Sync Bot"
   git config user.email "actions@github.com"
   git add src/data/products.json
   git commit -m "chore(data): auto-sync trendyol catalog [skip ci]"
   git push
   ```

### Hata Toleransı (Graceful Degradation)

- **API hatası / 429 / ağ kesintisi:** [`scripts/fetch-trendyol.mjs`](scripts/fetch-trendyol.mjs)
  mevcut `products.json` dosyasına **dokunmaz** (atomik yazma: önce `.tmp`, sonra `rename`).
  Script sıfırdan farklı çıkış koduyla sonlanır, iş akışı zarifçe durur ve **canlı site bozulmaz**.
- **Retry/backoff:** 429 durumunda `Retry-After` header'ına uyulur; yoksa üssel geri çekilme
  (1s → 2s → 4s), istek başına maksimum 3 deneme.
- **No-op tespiti:** Yeni katalog hash'i öncekiyle aynıysa yazma atlanır — gereksiz commit ve
  CI çalışması oluşmaz.
- **`[skip ci]` etiketi:** Bot commit'i, Cloudflare Pages build'ini gereksiz yere tetiklemez
  (Cloudflare yine de yeni commit'i algılar ve dağıtır; etiket yalnızca diğer CI'ları atlar).

### Manuel Çalıştırma

GitHub deposu → **Actions** → **Trendyol Catalog Sync** → **Run workflow** → `main` dalını seçin → **Run**.

---

## 6. Shopier CSV İçe Aktarma Rehberi

Bu şablon **çift kanallı sipariş yönlendirmesi** destekler: birincil kanal Shopier, yedek kanal
WhatsApp.

### 6.1. CSV Formatı

Proje kök dizininde `shopier-links.csv` dosyası oluşturun:

```csv
barcode,url
8680001,https://shopier.com/12345678
8680002,https://shopier.com/12345679
8680003,https://shopier.com/12345680
```

| Sütun | Açıklama |
|-------|----------|
| `barcode` | Ürün varyantının barkodu (Trendyol verisindeki `variants[].barcode` ile eşleşmeli) |
| `url` | İlgili Shopier ürün sayfasının tam URL'si |

> **Not:** Header satırı (`barcode,url`) isteğe bağlıdır; script bunu otomatik algılar ve atlar.
> Tırnak içi virgüller ve `""` kaçışları desteklenir.

### 6.2. İçe Aktarma Komutu

```bash
npm run import-shopier
```

Bu komut [`scripts/import-shopier-csv.mjs`](scripts/import-shopier-csv.mjs) dosyasını çalıştırır ve
`src/config/shopier.json` dosyasını üretir:

```json
{
  "8680001": "https://shopier.com/12345678",
  "8680002": "https://shopier.com/12345679",
  "8680003": "https://shopier.com/12345680"
}
```

- CSV dosyası **yoksa**, script build'i bozmadan boş bir harita (`{}`) yazar ve başarıyla çıkar.
- Geçersiz satırlar (eksik barkod veya URL) atlanır ve loglanır.

### 6.3. Çift Kanallı CTA ve WhatsApp Fallback Mekanizması

Bu mantık [`src/components/islands/VariantSelector.jsx`](src/components/islands/VariantSelector.jsx)
island'ı içinde yaşar (seçili varyantın barkodunu ve stok durumunu zaten bilir):

| Durum | Birincil CTA | İkincil CTA |
|-------|--------------|-------------|
| Shopier linki **var** | **"Shopier ile güvenle satın al"** (yeni sekme, `rel="noopener noreferrer"`) | **"WhatsApp ile sipariş ver"** |
| Shopier linki **yok** | **"WhatsApp ile sipariş ver"** (birincil olur) | — |
| Stok **yok** (`stock <= 0`) | Varyant seçilemez, "Tükendi" rozeti gösterilir | — |

**WhatsApp mesaj şablonu:**

```
Merhaba, {Ürün Adı} ({Varyant Detayları} - Barkod: {Barkod}) sipariş etmek istiyorum.
```

WhatsApp numarası [`src/config/site.js`](src/config/site.js) içindeki `contact.whatsapp`
alanından okunur (`wa.me` linki olarak açılır).

---

## 7. Şablonun Başka Bir Satıcıya Uyarlanması (White-label)

Bu şablon **yeniden kullanılabilir** olacak şekilde tasarlanmıştır. **Hiçbir kod dosyası
değiştirilmeden**, yalnızca iki dosya düzenlenerek mağaza tamamen yeniden markalanır:

1. [`src/config/site.js`](src/config/site.js) — satıcı kimliği katmanı
2. `.env.local` — API kimlik bilgileri

### 7.1. `src/config/site.js` — Parametre Parametre

| Parametre | Tip | Açıklama | Örnek |
|-----------|-----|----------|-------|
| `name` | `string` | Mağaza/satıcı adı. Navbar, footer, logo wordmark ve SEO başlıklarında kullanılır. | `"SA Printpro"` |
| `domain` | `string` | Tam alan adı (protokol dahil). Canonical URL, sitemap ve OG etiketleri için kullanılır. | `"https://saprintpro.com"` |
| `logoFile` | `string` | `public/` içindeki logo dosyası adı. Dosya yoksa `Logo.astro` metin wordmark gösterir. | `"logo.png"` |
| `contact.whatsapp` | `string` | WhatsApp numarası, ülke kodu dahil, `+` ve boşluk olmadan. `wa.me` linki üretir. | `"905XXXXXXXXX"` |
| `contact.instagram` | `string` | Instagram kullanıcı adı (`@` olmadan). Footer sosyal linki. | `"saprintpro"` |
| `contact.email` | `string` | İletişim e-posta adresi. Footer ve iletişim sayfası. | `"info@saprintpro.com"` |
| `badges.shipping` | `string` | Kargo rozeti metni. | `"2 Günde Kargoda"` |
| `badges.returns` | `string` | İade rozeti metni. | `"15 Gün İade"` |
| `badges.freeShipping` | `string` | Ücretsiz kargo rozeti metni. | `"350 TL Üzeri Kargo Bedava"` |
| `badges.freeShippingThreshold` | `number` | Ücretsiz kargo eşiği (TL). Hesaplamalarda kullanılır. | `350` |
| `ga4Id` | `string` | Google Analytics 4 ölçüm kimliği. Boş bırakılırsa GA4 yüklenmez. | `"G-XXXXXXXXXX"` |
| `searchConsoleVerification` | `string` | Google Search Console doğrulama meta etiketi içeriği. Boşsa eklenmez. | `""` |
| `showHowToApply` | `boolean` | "Nasıl uygulanır" infografiğini göster/gizle. Varsayılan `false`. | `false` |

### 7.2. `.env.local` — API Kimlik Bilgileri

```dotenv
TRENDYOL_API_KEY=yeni_satici_api_key
TRENDYOL_API_SECRET=yeni_satici_api_secret
TRENDYOL_SUPPLIER_ID=yeni_satici_supplier_id
```

### 7.3. Uyarlama Adımları (Özet)

```bash
# 1) Şablonu klonlayın
git clone <repo-url> yeni-magaza && cd yeni-magaza

# 2) site.js içindeki tüm değerleri yeni satıcıya göre düzenleyin
#    (name, domain, contact, badges, ga4Id, ...)

# 3) API kimlik bilgilerini girin
cp .env.example .env.local
# .env.local dosyasını doldurun

# 4) Kataloğu çekin
npm run sync

# 5) (Opsiyonel) Shopier linklerini içe aktarın
npm run import-shopier

# 6) Build alın
npm run build
```

### 7.4. Logo Değiştirme

1. `public/logo.png` dosyasını kendi logonuzla değiştirin.
2. `siteConfig.logoFile` değerini yeni dosya adıyla güncelleyin.

> Logo dosyası yoksa [`src/components/Logo.astro`](src/components/Logo.astro) otomatik olarak
> `siteConfig.name` değerini kullanan bir metin wordmark gösterir — site yine de düzgün görünür.

### 7.5. GitHub Actions ve Cloudflare

- GitHub deposunda **3 secret**'ı yeni satıcının bilgileriyle tanımlayın (bkz. [Bölüm 4](#4-github-secrets-yapılandırması)).
- Cloudflare Pages'te yeni bir proje oluşturun ve yeni depoyu bağlayın (bkz. [Bölüm 3](#3-sıfırdan-cloudflare-pages-dağıtımı)).
- `NODE_VERSION` ortam değişkenini ayarlayın.

> **Kural:** Hiçbir dosyada sabit kodlanmış alan adı veya satıcı sırrı bulunmaz. Tüm satıcı
> kimliği `site.js` + `.env.local` içinde izole edilmiştir.

---

## 8. Kabul Kriterleri Doğrulama Listesi

Master Prompt §11'deki 10 kabul kriterinin durumu:

| # | Kriter | Durum | Kanıt / Not |
|---|--------|-------|-------------|
| 1 | `npm run build` hatasız, saf statik çıktı üretir (`dist/`) | ✅ | `astro build` başarıyla tamamlanır; `dist/` içinde HTML/CSS/JS üretilir |
| 2 | Her dinamik rota çalışan `getStaticPaths()` içerir ve tüm ürün/kategori sayfalarını üretir | ✅ | [`src/pages/urun/[slug].astro`](src/pages/urun/[slug].astro), [`src/pages/kategori/[slug].astro`](src/pages/kategori/[slug].astro) |
| 3 | Etkileşimsiz bölümler (grid, kartlar, footer, breadcrumb) sıfır JS gönderir | ✅ | Bu bileşenler saf `.astro` markup'ıdır; hydration script etiketi yoktur |
| 4 | Fiyat/stok seçilen varyanta göre doğru tepki verir; Shopier linki yoksa WhatsApp fallback otomatik devreye girer | ✅ | [`src/components/islands/VariantSelector.jsx`](src/components/islands/VariantSelector.jsx) |
| 5 | Arama, kategori filtresi, fiyat sıralaması ve stok filtresi harici kütüphane olmadan istemci tarafında çalışır | ✅ | [`SearchBar.jsx`](src/components/islands/SearchBar.jsx), [`SortFilterBar.jsx`](src/components/islands/SortFilterBar.jsx) — yalnızca `Array.filter()`/`useMemo` |
| 6 | Ana sayfa, üstünde büyük hero bölümü olmadan ürün grid'ini gösterir | ✅ | [`src/pages/index.astro`](src/pages/index.astro) — navbar → tek satır intro → kategori sekmeleri → grid |
| 7 | GA4, çerez onayı kabul edilene kadar enjekte edilmez | ✅ | [`src/lib/consent.js`](src/lib/consent.js) — GA4 yalnızca `setConsent(true)` sonrası dinamik `<script>` ile eklenir |
| 8 | Sync script'i 429'u retry/backoff ile atlatır, ürünleri tekilleştirir, atomik yazar ve değişiklik yoksa commit atlar | ✅ | [`scripts/fetch-trendyol.mjs`](scripts/fetch-trendyol.mjs) — `fetchWithRetry`, `dedupeProducts`, `.tmp`+`rename`, hash no-op |
| 9 | `site.js` + `.env.local` değerlerini değiştirmek siteyi yeniden markalamak için yeterlidir | ✅ | Bkz. [Bölüm 7](#7-şablonun-başka-bir-satıcıya-uyarlanması-white-label) |
| 10 | Hiçbir dosyada sabit kodlanmış alan adı veya satıcı sırrı yoktur | ✅ | Tüm kimlik `site.js` + `.env.local` içinde; secret'lar GitHub Secrets'ta |

### Ek Doğrulama (FAZ 5)

| Kontrol | Durum |
|---------|-------|
| `.github/workflows/sync.yml` YAML sözdizimi geçerli (tab yok, doğru girinti) | ✅ |
| Cron tetikleyici `0 5,17 * * *` + `workflow_dispatch` mevcut | ✅ |
| `permissions: contents: write` tanımlı | ✅ |
| `npm run lint` hatasız geçer | ✅ |
| `npm run build` hatasız tamamlanır | ✅ |

---

## 9. Proje Yapısı

```
saprintpro/
├── .github/
│   └── workflows/
│       └── sync.yml              # Trendyol senkronizasyon iş akışı (FAZ 5)
├── docs/
│   └── verification/             # FAZ 0 web-araştırma doğrulama kayıtları
├── public/
│   ├── logo.png                  # (opsiyonel) mağaza logosu
│   └── robots.txt                # statik robots dosyası
├── scripts/
│   ├── fetch-trendyol.mjs        # Trendyol V2 API senkronizasyonu
│   └── import-shopier-csv.mjs    # Shopier CSV → JSON dönüştürücü
├── src/
│   ├── components/
│   │   ├── islands/              # React island'ları (client:* direktifli)
│   │   │   ├── CookieBanner.jsx
│   │   │   ├── Gallery.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductGrid.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── SortFilterBar.jsx
│   │   │   ├── ThemeToggle.jsx
│   │   │   └── VariantSelector.jsx
│   │   ├── Breadcrumb.astro      # statik (sıfır JS)
│   │   ├── Footer.astro          # statik (sıfır JS)
│   │   ├── HowToApply.astro      # opsiyonel (showHowToApply)
│   │   ├── Logo.astro            # statik wordmark
│   │   ├── Navbar.astro          # statik
│   │   ├── ProductCard.astro     # statik
│   │   └── Seo.astro             # statik meta/OG etiketleri
│   ├── config/
│   │   ├── featured.js           # öne çıkan ürün slug'ları
│   │   ├── shopier.json          # barkod → Shopier URL haritası
│   │   └── site.js               # ★ satıcı kimliği katmanı
│   ├── data/
│   │   └── products.json         # ★ senkronize edilen katalog
│   ├── layouts/
│   │   └── Layout.astro          # ortak layout (tema script'i, <html lang="tr">)
│   ├── lib/
│   │   ├── consent.js            # çerez onayı + GA4 enjeksiyonu
│   │   └── products.js           # veri okuma/filtreleme/arama/sıralama yardımcıları
│   ├── pages/
│   │   ├── kategori/[slug].astro # kategori sayfaları (getStaticPaths)
│   │   ├── urun/[slug].astro     # ürün detay sayfaları (getStaticPaths)
│   │   ├── 404.astro
│   │   ├── iletisim.astro
│   │   ├── index.astro
│   │   └── urunler.astro
│   └── styles/
│       └── globals.css
├── .env.example                  # ortam değişkeni şablonu
├── astro.config.mjs
├── eslint.config.mjs
├── package.json
├── tailwind.config.mjs
└── tsconfig.json
```

---

## 10. Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `npm ci` peer-dependency hatası veriyor | `npm ci --legacy-peer-deps` kullanın (CI iş akışı da bunu kullanır) |
| `npm run sync` "Eksik ortam değişkenleri" hatası | `.env.local` dosyasının doldurulduğundan emin olun (`.env.example` referans) |
| Trendyol API 403 döndürüyor | `User-Agent` header'ı zorunludur (`{supplierId} - SelfIntegration`); script bunu otomatik ekler — `TRENDYOL_SUPPLIER_ID` doğru mu kontrol edin |
| Trendyol API 429 döndürüyor | Script otomatik olarak `Retry-After`/üssel backoff uygular; kalıcıysa rate limit kotanızı kontrol edin |
| Cloudflare build başarısız | `NODE_VERSION` ortam değişkenini `20` veya `22` olarak ayarlayın; build komutu `npm run build`, çıktı dizini `dist` olmalı |
| GitHub Actions commit atamıyor | `permissions: contents: write` tanımlı mı ve repo ayarlarında Actions'a yazma izni verilmiş mi kontrol edin |
| GA4 verisi gelmiyor | Çerez banner'ından onay verildiğinden emin olun; `siteConfig.ga4Id` gerçek ölçüm kimliğiyle doldurulmalı |
| Shopier butonu görünmüyor | `shopier-links.csv` dosyasını oluşturup `npm run import-shopier` çalıştırın; barkodların `products.json` içindeki `variants[].barcode` ile eşleştiğinden emin olun |
| Ürün sayfaları build'de üretilmiyor | `src/data/products.json` dosyasının dolu olduğundan emin olun (`npm run sync`); `getStaticPaths()` boş dizi dönerse sayfa üretilmez |
| Tema yanlış yükleniyor (flash) | `Layout.astro` içindeki inline tema script'inin `<head>` içinde, paint öncesi çalıştığından emin olun |

---

## Lisans

MIT — bkz. `package.json`. Bu şablon herhangi bir Trendyol satıcısı tarafından ticari olarak
kullanılabilir.