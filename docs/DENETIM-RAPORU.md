# SA Printpro — Kapsamlı Denetim Raporu (Audit)

> **Kapsam:** `c:/Users/admin/Desktop/Furkan acar üzerine/saprintpro` (Astro statik vitrin + Cloudflare Worker + Trendyol/Shopier/GA4 entegrasyonları)
> **Yöntem:** Yalnızca statik kaynak incelemesi (dosya okuma, yapı analizi, çapraz referans doğrulama). **Komut çalıştırılmadı.**
> **Kural:** Bu denetimde hiçbir kod dosyası değiştirilmedi; yalnızca bu rapor üretildi.
> **Bulgular:** 71 (P0: 4 · P1: 16 · P2: 40 · P3: 11)
> **Rapor tarihi:** 2026-11-16

---

## 1. Özet

### 1.1 Bulgu sayısı ve önem dağılımı

| Önem | Tanım | Adet |
|------|-------|------|
| **P0** | Yayını/satışı veya yasal geçerliliği doğrudan bloke eder | **4** |
| **P1** | Gelir, ölçümleme veya uyumluluk üzerinde yüksek etkili hata | **16** |
| **P2** | Orta etkili kalite/deneyim/SEO sorunu | **40** |
| **P3** | Düşük etkili iyileştirme / teknik borç | **11** |
| **Toplam** | | **71** |

### 1.2 Kategori dağılımı

| Ön ek | Alan | Bulgu |
|-------|------|-------|
| `CONF` | Yapılandırma, bağımlılıklar, CI/CD, ortam | 5 |
| `QA` | Kod kalitesi ve mimari tutarlılık | 8 |
| `CART` | Sepet ve ödeme akışı | 7 |
| `SEO` | SEO, metadata, feed, structured data | 10 |
| `AN` | Analitik/ölçümleme (GA4 olayları) | 2 |
| `PERF` | Performans ve asset stratejisi | 6 |
| `A11Y` | Erişilebilirlik | 8 |
| `PRIV` | Gizlilik, rıza, güvenlik, Worker | 5 |
| `LEGAL` | Yasal/kurumsal içerik ve uyum | 8 |
| `DATA` | Veri katmanı, katalog, görseller | 6 |
| `UX` | Kullanıcı deneyimi ve dönüşüm | 6 |

### 1.3 Genel kalite değerlendirmesi: **6.5 / 10**

Gerekçe (kısa):

- **Güçlü yanlar:** Astro statik mimarisi tutarlı; `trailingSlash: 'always'` + `buildCanonical()` ile canonical/308 sorunu sistematik çözülmüş; sepette `useSyncExternalStore` snapshot referans kararlılığı gibi ince React hataları giderilmiş; `test-cart.mjs` gerçek regresyon senaryoları içeriyor; `_headers` ile güvenlik başlıkları ve asset cache politikası mevcut; skip-link, focus ring, `prefers-reduced-motion` gibi a11y temelleri doğru kurulmuş.
- **Zayıf yanlar:** Ticari çekirdek (sepet → ödeme) **çalışmıyor**: [`src/config/shopier.json`](../src/config/shopier.json:1) boş, çok satırlı sepet asla Shopier'e gidemiyor, sepette KDV/kargo hesabı yok. Yasal zorunlu satıcı kimliği alanları boş ve bunu denetleyen script build'i bilerek kırmıyor. GA4, kendi çerez politikasının aksine onaydan bağımsız yükleniyor. Ölçüm olaylarında fiyat alanı ürün seviyesinde olmayan `product.price` üzerinden 0 gidiyor. Merchant feed gtin/kategori/kargo alanlarından yoksun. Kod tarafında ciddi kopyala-yapıştır tekrarı (Astro/React kart ve grid çiftleri) ve ölü bileşen var.

---

## 2. Bulgu Listesi

> Her blokta `ID`, başlık, önem, etki, kanıt (`dosya:satır` + alıntı), öneri ve efor (S/M/L) verilmiştir. Kanıtsız bulgu yoktur.

---

### CONF — Yapılandırma, bağımlılıklar, CI/CD

#### CONF-01 — CI, EOL Node 20 ile çalışıyor; `engines` alanı yok
- **Önem:** P1
- **Etki:** Projenin kendi doğrulama notu Node 20'yi **EOL** olarak işaretliyor. Build/deploy zinciri desteklenmeyen runtime'da koşuyor; Astro 7 + eslint-parser engine aralıkları (`^22.22.3 || ^24.16.0`) ile çakışma riski var. Lokal (Node 22/24) ile CI (Node 20) farklı davranabilir → "lokalimde çalışıyordu" tipi üretim hataları.
- **Kanıt:** [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml:45) → `node-version: '20'`; aynı ayar [`sync.yml:44`](../.github/workflows/sync.yml:44) ve [`trendyol-sync.yml:47`](../.github/workflows/trendyol-sync.yml:47). Karşı kanıt: [`docs/verification/node-lts.md`](verification/node-lts.md) → "Node.js v20.x Iron **EOL** … Node 24 (Krypton) Active LTS". `package.json` içinde `engines` alanı yok ([`package.json:1`](../package.json:1)).
- **Öneri:** Üç workflow'da `node-version: '24'` (veya `22.x`) yap; `package.json`'a `"engines": { "node": ">=22.22.3" }` ekle; `README.md` içindeki "Node 20 LTS" ifadelerini güncelle.
- **Efor:** S

#### CONF-02 — İki adet birebir aynı Trendyol senkron workflow'u
- **Önem:** P1
- **Etki:** [`sync.yml`](../.github/workflows/sync.yml:17) ve [`trendyol-sync.yml`](../.github/workflows/trendyol-sync.yml:20) aynı cron ile (`0 5,17 * * *`) aynı işi yapıyor. İki workflow aynı `concurrency.group: trendyol-sync` altında yarışır; her ikisi de `git push` denediğinde biri reject olur veya çift katalog yazımı/commit gürültüsü oluşur. Ayrıca senkronun neden durduğunu teşhis etmek zorlaşır.
- **Kanıt:** [`sync.yml:16-17`](../.github/workflows/sync.yml:16) ve [`trendyol-sync.yml:19-20`](../.github/workflows/trendyol-sync.yml:19) aynı cron; iki dosyada da `run: npm run sync` ([`sync.yml:57`](../.github/workflows/sync.yml:57), [`trendyol-sync.yml:60`](../.github/workflows/trendyol-sync.yml:60)).
- **Öneri:** Birini sil (tercihen `trendyol-sync.yml`); kalan workflow'a `git pull --rebase` veya `git push` retry ekle. Dokümanlarda tek isim bırak.
- **Efor:** S

#### CONF-03 — Build hattı görsel işleme ve doğrulama adımlarını içermiyor
- **Önem:** P2
- **Etki:** `npm run build` yalnızca `check-company-info → build-search-index → generate-feed → astro build` çalıştırıyor. `images` (Sharp/WebP üretimi), `enrich`, `test:cart`, `lint`, `check-broken-links`, `qa-audit` hiçbir otomatik akışta yok. Yeni senkron edilen ürünün yerel görseli üretilmeden site yayına çıkabilir (bkz. DATA-02) ve regresyonlar CI'da yakalanmaz.
- **Kanıt:** [`package.json:9`](../package.json:9) → `"build": "node scripts/check-company-info.mjs && node scripts/build-search-index.mjs && node scripts/generate-feed.mjs && astro build"`; `images` script'i tanımlı ama build'de çağrılmıyor ([`package.json:17`](../package.json:17)). `test` script'i hiç yok; test yalnız `test:cart` ([`package.json:21`](../package.json:21)).
- **Öneri:** `build` öncesine `node scripts/process-images.mjs` (idempotent çalışacak şekilde) ve `lint` ekle; `npm test` tanımla (`test:cart` + `verify:*`); deploy workflow'unda build sonrası `check-broken-links` + `qa-audit` çalıştır.
- **Efor:** M

#### CONF-04 — `legacy-peer-deps` global olarak zorlanıyor; şüpheli sürüm aralıkları
- **Önem:** P2
- **Etki:** Peer dependency çakışmaları kalıcı olarak bastırılıyor; bu, React 19 / `@astrojs/react` / `eslint-plugin-react-hooks` uyumsuzluklarını görünmez kılar. `lucide-react "^1.44.0"` ve `typescript "^7.0.2"` gibi aralıklar standart yayın çizgisiyle uyuşmuyor görünüyor; gerçek kurulu sürüm ile beyan edilen aralık farklıysa "temiz kurulum" farklı ağaç üretir.
- **Kanıt:** [`.npmrc:1`](../.npmrc:1) → `legacy-peer-deps=true`; CI'da ayrıca tekrar ediliyor ([`deploy.yml:50`](../.github/workflows/deploy.yml:50) → `npm ci --legacy-peer-deps`). Sürümler: [`package.json:43-58`](../package.json:43).
- **Öneri:** `.npmrc`'yi kaldırıp gerçek peer çakışmalarını çöz; `npm ls lucide-react typescript astro --depth=0` ile beyan/kurulu sürümü karşılaştır; gerekirse sürümleri sabitle (`~`/tam sürüm).
- **Efor:** M

#### CONF-05 — Çalışma alanında gerçek `.env` / `.env.local` dosyaları var
- **Önem:** P3
- **Etki:** Anahtar içeren dosyaların yanlışlıkla commit'lenmesi (veya bir `git add -f`, arşiv/paylaşım) tüm Trendyol/DeepSeek/Shopier kimlik bilgilerini sızdırır. `.gitignore` kapsıyor görünüyor, ancak dosyalar mevcut ve içerik taşıyor (580 B).
- **Kanıt:** Kök dizin listesi: `.env` (580 B) ve `.env.local` (580 B) mevcut; yok sayma kuralları [`.gitignore:4-6`](../.gitignore:4).
- **Öneri:** Code modunda `git status --ignored` ve `git ls-files | findstr .env` ile takip durumunu doğrula; sızma şüphesi varsa anahtarları rotate et; yerel dosyaları `.env.local` tek isimde topla.
- **Efor:** S

---

### QA — Kod kalitesi ve mimari tutarlılık

#### QA-01 — `ProductCard` iki ayrı kopya olarak yaşıyor (Astro + React)
- **Önem:** P2
- **Etki:** Fiyat/indirim/stok rozeti mantığı ve kart markup'ı iki dosyada elle senkron tutuluyor. Her fiyat kuralı değişikliği iki yerde uygulanmalı; biri unutulduğunda liste sayfaları ile ana sayfa farklı fiyat gösterir (gelir etkisi doğrudan).
- **Kanıt:** [`src/components/ProductCard.astro:59-61`](../src/components/ProductCard.astro:59) ve [`src/components/islands/ProductCard.jsx:78-80`](../src/components/islands/ProductCard.jsx:78) aynı üç satırı içeriyor; her iki dosyada da `effectivePrice`, `pricedVariants`, `hasDiscount`, `directPrice`, stok rozetleri birebir tekrar ediyor.
- **Öneri:** Fiyat/stok hesaplarını `src/lib/pricing.js` içine taşı; kart markup'ını tek kaynağa indir (Astro kartı, React kartının sunucu render'ı olarak kullanılabilir) veya React kartını tek gerçek kaynak yapıp statik listelerde `client:load` yerine SSR çıktısını kullan.
- **Efor:** M

#### QA-02 — `ProductGrid.jsx` ölü bileşen
- **Önem:** P2
- **Etki:** Hiçbir sayfa tarafından import edilmiyor; "Daha Fazla Göster" mantığı içeren bu bileşen bakımsız kalıyor ve `ProductGridStatic` ile iki farklı grid davranışı bilgisi yaratıyor. Yanlış dosyayı düzenleyen geliştirici değişikliğin canlıya çıkmadığını görür.
- **Kanıt:** [`src/components/islands/ProductGrid.jsx:73`](../src/components/islands/ProductGrid.jsx:73) tanımı var; kod tabanında yalnızca yorum içinde referans ([`ProductGridStatic.jsx:85`](../src/components/islands/ProductGridStatic.jsx:85) → "`ProductGrid`'den farkı…").
- **Öneri:** Dosyayı sil veya gerçekten kullan (ör. `/urunler` için "daha fazla göster" modu); silinemiyorsa `docs/` altında "kullanılmıyor" notu düş.
- **Efor:** S

#### QA-03 — `ProductGrid` / `ProductGridStatic` ~%80 aynı kod
- **Önem:** P2
- **Etki:** `displayPrice`, `totalStock`, `readInitialState`, marka pill markup'ı ve `aria-pressed` sınıf üçlüleri iki dosyada kopya. Filtre/sıralama davranışı düzeltmeleri iki yerde yapılmalı; farklılıklar sessiz UX tutarsızlığına dönüşüyor.
- **Kanıt:** [`ProductGrid.jsx:13-41`](../src/components/islands/ProductGrid.jsx:13) ve [`ProductGridStatic.jsx:35-63`](../src/components/islands/ProductGridStatic.jsx:35) birebir aynı yardımcılar; marka pill bloğu her iki dosyada ~60 satır tekrar.
- **Öneri:** Yardımcıları `src/lib/grid.js`'e, pill UI'ı `BrandFilter.jsx`'e çıkar; iki grid bileşenini ince bir sarmalayıcıya indir.
- **Efor:** M

#### QA-04 — `products.js` içinde aynı JSDoc bloğu iki kez
- **Önem:** P3
- **Etki:** `calculateDirectPrice` için yazılmış JSDoc + açıklama bloğu, fonksiyondan önce bir kez daha (marka listelerinin arasına) yapıştırılmış durumda. Kopyala-yapıştır artığı; okuyucuyu yanıltıyor ve lint gürültüsü üretiyor.
- **Kanıt:** [`src/lib/products.js`](../src/lib/products.js:1) — "Calculates the web-exclusive direct-sale price…" bloğu `resolveProductBrand` açıklamasından hemen sonra ikinci kez tekrarlanıyor.
- **Öneri:** Yinelenen bloğu sil; `eslint`'e `no-dupe-else-if`/yorum düzeni kontrolü eklemek yerine tek seferlik temizlik yeterli.
- **Efor:** S

#### QA-05 — Marka adı `sanitizeCatalogText` içinde sabit kodlu
- **Önem:** P2
- **Etki:** White-label iddiası ("yalnızca `site.js` düzenlenir") bozuluyor: rakip marka temizliği her zaman "SA Printpro" yazıyor. Site başka bir satıcıya uyarlanırsa, ürün metinlerinde eski marka adı kalır.
- **Kanıt:** [`src/lib/products.js`](../src/lib/products.js:1) — `result += output.slice(cursor, hit) + 'SA Printpro'` ve sonraki `'SA Printpro'` sabitleri; karşı iddia [`README.md`](../README.md:1) §7 "Hiçbir kod dosyası değiştirilmeden…".
- **Öneri:** Sabitleri `siteConfig.name` ile değiştir; `sanitize` fonksiyonlarına marka adını parametre olarak geçir.
- **Efor:** S

#### QA-06 — Alan adı ve marka sabit kodlu (3 ayrı yerde)
- **Önem:** P3
- **Etki:** Domain değişikliğinde feed/OG/paylaşım linkleri eski domain'e işaret eder.
- **Kanıt:** [`scripts/generate-feed.mjs:20-21`](../scripts/generate-feed.mjs:20) → `const SITE_URL = 'https://saprintpro.com'`, `const BRAND = 'SA Printpro'`; [`src/components/islands/ProductShare.jsx`](../src/components/islands/ProductShare.jsx:1) → `return \`https://saprintpro.com/urun/${slug}/\``; [`worker/index.js`](../worker/index.js:1) → `const CANONICAL_HOST = 'saprintpro.com'`.
- **Öneri:** Script'lerde `src/config/site.js` import et; Worker için `env.CANONICAL_HOST` ile override edilebilir hale getir.
- **Efor:** S

#### QA-07 — Fiyat biçimlendirme/hesaplama 6+ yerde kopya
- **Önem:** P2
- **Etki:** `formatPrice` ve "efektif fiyat" mantığı ayrı ayrı yazılmış; `Intl`/yuvarlama farkı oluşursa aynı ürün farklı ekranlarda farklı fiyat gösterir (güven kaybı, itiraz riski).
- **Kanıt:** [`ProductCard.astro`](../src/components/ProductCard.astro:85), [`ProductCard.jsx`](../src/components/islands/ProductCard.jsx:13), [`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:18), [`VariantSelector.jsx`](../src/components/islands/VariantSelector.jsx:19), [`cart.js`](../src/lib/cart.js:1) (`formatPrice`), [`build-search-index.mjs`](../scripts/build-search-index.mjs:27), [`generate-feed.mjs`](../scripts/generate-feed.mjs:82) — hepsinde ayrı kopya.
- **Öneri:** `src/lib/format.js` (`formatPrice`) + `src/lib/pricing.js` (`effectivePrice`, `cheapest`, `discountRate`) oluştur; script'ler bu modülleri import etsin.
- **Efor:** M

#### QA-08 — Tip güvenliği fiilen yok
- **Önem:** P3
- **Etki:** `tsconfig.json` var ama `typecheck`/`astro check` script'i ve CI adımı yok. `.js`/`.jsx` dosyaları yalnız JSDoc ile korunuyor; `product`, `variant`, `shopierMap` gibi serbest şekilli nesnelerde alan adı hatası build sırasında yakalanmıyor.
- **Kanıt:** [`tsconfig.json:1`](../tsconfig.json:1) (93 B, yalnız `extends` + `jsx`); `package.json` script'lerinde tür kontrolü yok ([`package.json:7-29`](../package.json:7)).
- **Öneri:** `npx astro check` script'i ekle ve deploy öncesi çalıştır; kritik modüller (`products`, `cart`, `shopier`) için JSDoc `@typedef` tanımları yaz.
- **Efor:** M

---

### CART — Sepet ve ödeme akışı

#### CART-01 — Shopier eşleme dosyası boş: ödeme kanalı çalışmıyor
- **Önem:** **P0**
- **Etki:** Barkod→Shopier URL haritası `{}` olduğu için `resolveShopierUrl` her zaman `null` döner. Sepette "Siparişi Tamamla" hiç görünmez; tüm siparişler WhatsApp'a düşer. Kartlı ödeme yok → doğrudan gelir kaybı ve "güvenli ödeme" iddiasının karşılıksız kalması.
- **Kanıt:** [`src/config/shopier.json:1`](../src/config/shopier.json:1) → `{}`; tüketici tarafı: [`CartView.jsx:123-127`](../src/components/islands/CartView.jsx:123) → `items.length === 1 && Boolean(resolveShopierUrl(shopierMap, items[0]?.barcode))`.
- **Öneri:** `npm run import-shopier` ile `shopier-links.csv` üret; en az stokta olan barkodlar için eşleme gir; build'de eşleme sayısını loglayan bir uyarı ekle (0 ise build uyarısı).
- **Efor:** M

#### CART-02 — Çok satırlı sepet hiçbir zaman Shopier'e gidemiyor
- **Önem:** **P0**
- **Etki:** `items.length === 1` koşulu yüzünden 2+ ürünlük sepetler otomatik WhatsApp'a yönleniyor. Müşteri kartla ödeme yapamaz; sepet bir "sipariş listesi" olarak kalır. Ortalama sepet tutarı büyüdükçe kayıp büyür.
- **Kanıt:** [`CartView.jsx:123-127`](../src/components/islands/CartView.jsx:123) ve yönlendirme kararı [`CartView.jsx:179`](../src/components/islands/CartView.jsx:179).
- **Öneri:** Shopier tarafında sepet/checkout API'si veya "tek sipariş linki" modeli varsa çok satırlı sepeti destekle; yoksa iki aşamalı akış (her satır için Shopier + tek WhatsApp özeti) tasarla ve UI metnini buna göre düzelt. Kısa vadede kullanıcıya nedeni açıkça yaz.
- **Efor:** L

#### CART-03 — Sepette KDV ve kargo hesabı yok
- **Önem:** P1
- **Etki:** Toplam yalnızca `Σ fiyat×adet`. 350 TL ücretsiz kargo eşiği ([`site.js:15-16`](../src/config/site.js:15)) yalnızca metinde yaşıyor; sepette kargo satırı, KDV satırı ve "kargo bedava kalan tutar" yok. Mesafeli satış sözleşmesi kargo bedelinin sipariş özetinde gösterileceğini taahhüt ediyor → sözleşme ile uygulama çelişiyor; ayrıca müşteri son tutarı göremeden yönlendiriliyor.
- **Kanıt:** [`CartView.jsx:109-110`](../src/components/islands/CartView.jsx:109) → `items.reduce((sum, item) => sum + item.price * item.qty, 0)`; eşik hiçbir hesaplamada kullanılmıyor (kod tabanında `freeShippingThreshold` yalnızca metinlerde geçiyor). Karşı taahhüt: [`mesafeli-satis-sozlesmesi.astro:49`](../src/pages/mesafeli-satis-sozlesmesi.astro:49).
- **Öneri:** `src/lib/totals.js` yaz: `subtotal`, `shippingFee` (eşik altı sabit ücret), `freeShippingRemaining`, `vatIncluded`. Sepet özetinde kargo satırı + "350 TL üzeri bedava" ilerleme çubuğu göster; sözleşme metniyle birebir hizala.
- **Efor:** M

#### CART-04 — Sepet fiyatı istemciden geliyor, katalogla doğrulanmıyor
- **Önem:** P1
- **Etki:** `localStorage` içeriği kullanıcı tarafından değiştirilebilir; sepetteki `price` doğrudan WhatsApp sipariş mesajına ve GA4 `value` alanına yazılıyor. Aynı ürünün fiyatı sonradan düştüğünde de eski (yüksek) fiyat gösterilir. Müşteri ekranı ile gerçek fiyat ayrışır; itiraz/iade riski doğar.
- **Kanıt:** [`cart.js`](../src/lib/cart.js:1) → `normalizeItem` yalnızca `Number(item.price)` doğruluyor (katalogla eşleştirme yok); [`CartView.jsx:110`](../src/components/islands/CartView.jsx:110) ve `buildWhatsappMessage` toplamı bu değerden üretiliyor.
- **Öneri:** Sepet render'ında `getProductBySlug/slug→variant barcode` ile katalogdan güncel fiyat/stok çekip satırı "fiyat güncellendi" bilgisiyle düzelt; ödeme öncesi fiyat farkı varsa kullanıcıdan onay al.
- **Efor:** M

#### CART-05 — Stok üstü adet engeli yok
- **Önem:** P2
- **Etki:** Stok 3 iken 999 adet sepete eklenebiliyor; `updateQty` üst sınır tanımıyor. Müşteriye "Stokta (3 adet)" denirken 999 adetlik sipariş oluşabiliyor.
- **Kanıt:** [`cart.js`](../src/lib/cart.js:1) → `addItem`/`updateQty` yalnızca alt sınır uyguluyor (`qty <= 0` → sil); üst sınır yok. Stok bilgisi yalnız [`VariantSelector.jsx`](../src/components/islands/VariantSelector.jsx:1) içinde gösterim amaçlı kullanılıyor.
- **Öneri:** Sepet satırına `maxQty` alanı yaz (varyant stoğu), `updateQty`'de kırp; sepette "en fazla X adet" bilgisi ver.
- **Efor:** S

#### CART-06 — Sepeti boşaltma ve otomatik temizlik geri alınamaz
- **Önem:** P2
- **Etki:** "Sepeti Boşalt" tek tıkla ve onaysız çalışır; `siparis-basarili` sayfası, ödeme gerçekten tamamlanmamış olsa bile (doğrudan ziyaret/refresh) sepeti siler. Müşteri emeği ve dönüşüm kaybı.
- **Kanıt:** [`CartView.jsx:402`](../src/components/islands/CartView.jsx:402) (onaysız `clear()` butonu) ve [`siparis-basarili.astro`](../src/pages/siparis-basarili.astro:1) içindeki inline script → `window.localStorage.removeItem('saprintpro_cart_v1')`.
- **Öneri:** Boşaltmaya `confirm` veya "geri al" sun; sipariş temizliği yalnızca doğrulanmış `transaction_id` + ödeme sağlayıcı parametresi varsa yapılsın.
- **Efor:** S

#### CART-07 — Onay kutusu var olmayan "Ön Bilgilendirme Formu"na atıf yapıyor
- **Önem:** P2
- **Etki:** Kullanıcı onayladığını beyan ettiği belgeye ulaşamıyor; mesafeli satış mevzuatı açısından "ön bilgilendirme" ayrı bir yasal metindir. Ayrıca onay kutusu yalnızca buton tıklamasında kontrol ediliyor (buton `disabled`), hata mesajı görünürlüğü zayıf.
- **Kanıt:** [`CartView.jsx:415-417`](../src/components/islands/CartView.jsx:415) → `Mesafeli Satış Sözleşmesi … 'ni ve Ön Bilgilendirme Formu'nu okudum`; `src/pages` altında `on-bilgilendirme` sayfası yok (yalnız `mesafeli-satis-sozlesmesi.astro`).
- **Öneri:** `/on-bilgilendirme-formu/` sayfası ekle (satıcı bilgileri, toplam bedel, kargo, cayma hakkı, şikâyet kanalları) ve onay kutusunu iki ayrı belgeye link verecek şekilde güncelle.
- **Efor:** M

---

### SEO — Metadata, feed, structured data

#### SEO-01 — Varsayılan canonical `Astro.url.href` → query parametreleri canonical'a sızıyor
- **Önem:** P1
- **Etki:** `Layout`, `canonicalUrl` prop'u verilmediğinde tam URL'i (`?q=`, `?sort=`, `?fbclid` dahil) canonical olarak basıyor; `Seo.astro`'nun güvenli varsayılanı (`buildCanonical(pathname)`) hiç devreye girmiyor. Yeni eklenen her sayfa, kampanya parametreleriyle canonical kirliliği üretme riski taşıyor; arama motorları farklı URL'leri tek sayfa olarak birleştiremez.
- **Kanıt:** [`Layout.astro:13`](../src/layouts/Layout.astro:13) → `canonicalUrl = Astro.url.href`; bu değer her zaman `Seo`'ya geçiliyor ([`Layout.astro`](../src/layouts/Layout.astro:1) içindeki `<Seo … canonicalUrl={canonicalUrl} />`). Güvenli varsayılan [`Seo.astro:19`](../src/components/Seo.astro:19).
- **Öneri:** `Layout` varsayılanını `buildCanonical(Astro.url.pathname)` yap; OG `og:url` için ayrı, query'siz mutlak URL üret.
- **Efor:** S

#### SEO-02 — İade süresi üç yerde çelişiyor (14 vs 15 gün)
- **Önem:** P1
- **Etki:** Rozet "14 Gün İade", JSON-LD `merchantReturnDays: 15`, `llms.txt` "15 gün iade". Merchant Center/GSC zengin sonuçlar ile sayfa metni çelişirse güven kaybı ve politika uyuşmazlığı doğar; tüketici hakları açısından hangi sürenin geçerli olduğu belirsizleşir.
- **Kanıt:** [`site.js:14`](../src/config/site.js:14) → `returns: '14 Gün İade'`; [`urun/[slug].astro:348`](../src/pages/urun/[slug].astro:348) → `merchantReturnDays: 15`; [`public/llms.txt:3`](../public/llms.txt:3) → "15 gün iade hakkı vardır".
- **Öneri:** Süreyi `siteConfig.policies.returnDays` olarak tekilleştir; rozet, JSON-LD, llms.txt ve iade sayfası aynı değerden beslensin.
- **Efor:** S

#### SEO-03 — Merchant feed zorunlu alanlardan yoksun (gtin/kategori/kargo)
- **Önem:** P1
- **Etki:** `g:gtin`, `g:google_product_category`, `g:product_type`, `g:shipping`, `g:sale_price` yok. Google Merchant Center bu item'ları "eksik/geçersiz öznitelik" olarak işaretler; ürünler kısıtlı yayınlanır veya onaylanmaz → Shopping/PMax trafiği ve doğrudan satış kaybı.
- **Kanıt:** [`scripts/generate-feed.mjs:156-165`](../scripts/generate-feed.mjs:156) → item yalnız `id, title, description, link, image_link, availability, price, brand, condition` içeriyor; üretilmiş çıktı [`public/google-merchant.xml`](../public/google-merchant.xml:10) aynı alan setini doğruluyor (gtin yok).
- **Öneri:** Varyant `barcode` → `g:gtin`; kategori adı → `g:google_product_category` (Google taksonomi eşlemesi) + `g:product_type`; `g:shipping` (TR, ücretsiz/ücretli) ve indirim varsa `g:sale_price` ekle. Eşleme tablosu `src/config/merchant.js` içinde tutulsun.
- **Efor:** M

#### SEO-04 — Ürün JSON-LD'sinde `gtin` yok, `AggregateOffer` kimlik taşımıyor
- **Önem:** P2
- **Etki:** Barkod verisi (`productMpn`) var ama `gtin13`/`gtin` alanına yazılmıyor. Google zengin sonuç/ Merchant eşleştirmesinde ürün kimliği zayıf kalır; aynı ürünün farklı satıcılarla eşleşmesi güvenilmez.
- **Kanıt:** [`urun/[slug].astro`](../src/pages/urun/[slug].astro:1) → `productJsonLd` içinde `sku`, `mpn`, `brand`, `offers` var; `gtin*` alanı yok (barkod yalnız `mpn` olarak kullanılıyor, `const productMpn = primaryVariant.barcode`).
- **Öneri:** Barkod 13/14 hane ise `gtin13`/`gtin14`, değilse `mpn` + `identifier_exists: true` kullan; `offers` içine `seller` ekle.
- **Efor:** S

#### SEO-05 — Feed linkleri trailing slash'siz (her tıklama 308)
- **Önem:** P2
- **Etki:** Site `trailingSlash: 'always'` ve Worker 308 uyguluyor; feed'deki `link` alanı slash'siz üretildiği için Merchant Center tıklamaları gereksiz yönlendirme yaşar. Google "final URL" bekler; kalite puanı ve tarama bütçesi etkilenir.
- **Kanıt:** [`scripts/generate-feed.mjs`](../scripts/generate-feed.mjs:1) → `const link = \`${SITE_URL}/urun/${slug}\``; üretilen çıktı [`public/google-merchant.xml`](../public/google-merchant.xml:13) → `…/urun/kirmizi-universal-reflektif-jant-seridi-1160687379`.
- **Öneri:** `buildCanonical`/`productUrl` yardımcılarını feed üretiminde de kullan (slash'li URL).
- **Efor:** S

#### SEO-06 — Her ürün sayfasında aynı 3 şablon SSS + aynı HowTo
- **Önem:** P2
- **Etki:** Ürün başına `FAQPage` ve `HowTo` basılıyor; sorular ürün adı dışında birebir aynı. Yüzlerce sayfada yinelenen yapısal veri, Google'ın "spam yapısal veri" değerlendirmesine ve zengin sonuç kaybına yol açabilir; ayrıca kullanıcıya değer katmayan içerik oranı artıyor.
- **Kanıt:** [`urun/[slug].astro`](../src/pages/urun/[slug].astro:1) → `staticFaqs` üç sabit soru (reflektif mi / kargo süresi / nasıl uygulanır) ve `faqJsonLd` her sayfada üretiliyor; `HowToApply.astro` da her ürün sayfasında render ediliyor.
- **Öneri:** SSS'leri ürüne özgü hale getir (AI SSS varsa yeterli), şablon SSS'leri yalnız gerçekten farklılaştığında bas; `HowTo` şemasını tek bir rehber sayfasında topla, ürün sayfasında link ver.
- **Efor:** M

#### SEO-07 — `llms.txt` var olmayan URL'lere ve slash'siz yollara link veriyor
- **Önem:** P2
- **Etki:** AI asistanlarına verilen referanslar 301'e düşüyor (`/mesafeli-satis-ve-iade`, `/gizlilik-ve-cerez-politikasi`) veya 308 yiyor (`/urunler`, `/iletisim`). Kaynak kalitesi düşer, yanlış alıntılama riski artar.
- **Kanıt:** [`public/llms.txt:25-26`](../public/llms.txt:25) → eski birleşik yasal URL'ler; ayrıca `https://saprintpro.com/urunler` (slash yok) [`public/llms.txt:21`](../public/llms.txt:21).
- **Öneri:** `llms.txt`'yi güncel sayfa listesiyle yeniden üret (build sırasında `getStaticPaths` çıktısından üretmek en güvenlisi) ve tüm URL'leri slash'li yaz.
- **Efor:** S

#### SEO-08 — PWA manifest ikon boyutları gerçek dosyalarla uyuşmuyor
- **Önem:** P2
- **Etki:** `favicon.png` "192x192", `logo.png` "512x512 maskable" olarak beyan edilmiş; logo yatay (400×170) olduğu için maskable ikon kırpılır ve kurulum ekranında bozuk görünür. Lighthouse "maskable icon" uyarısı verir.
- **Kanıt:** [`public/manifest.webmanifest:16-17`](../public/manifest.webmanifest:16) (`favicon.png` → 192x192) ve [`public/manifest.webmanifest:31`](../public/manifest.webmanifest:31) (`logo.png` → maskable); logo boyutu [`Logo.astro:8-9`](../src/components/Logo.astro:8) → `logoWidth = 400`, `logoHeight = 170`.
- **Öneri:** Gerçek 192/512 kare ikon üret (`public/shopier/app-icon-*.png` zaten kare); maskable için güvenli alanı olan ayrı bir dosya kullan; `sizes` değerlerini doğrula.
- **Efor:** S

#### SEO-09 — Arama sıralama parametreleri URL'e yazılıyor ama içerik/canonical değişmiyor
- **Önem:** P2
- **Etki:** `?q=`, `?sort=`, `?inStock=`, `?brand=` `history.replaceState` ile yazılıyor; bu URL'ler paylaşılabilir hale geliyor fakat sunucuda üretilen HTML aynı kalıyor ve canonical taban URL'i gösteriyor. Parametreli URL'lerin dizine alınması durumunda yinelenen/boş içerik riski doğar.
- **Kanıt:** [`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:1) → `syncUrl()` (`url.searchParams.set('q', trimmed)`); [`SortFilterBar.jsx`](../src/components/islands/SortFilterBar.jsx:1) → `url.searchParams.set('sort'|'inStock')`; [`ProductGridStatic.jsx`](../src/components/islands/ProductGridStatic.jsx:1) → `set('brand')`.
- **Öneri:** Filtre parametreleri için sayfalara `<meta name="robots" content="noindex, follow">` koşulu ekle (parametre varsa client-side) veya `_headers`/Worker düzeyinde `X-Robots-Tag` ver; alternatif olarak yalnız hash kullan.
- **Efor:** S

#### SEO-10 — Boş kategori için `noindex` koşulu hiç tetiklenmiyor
- **Önem:** P3
- **Etki:** `noindex={category.count === 0}` yazılmış ama `count` her zaman ≥1 olan kategorilerden geliyor; yani ölü koşul. Gerçek boş-sayfa senaryosu (filtre sonrası boş) için önlem yok.
- **Kanıt:** [`kategori/[slug]/[...page].astro`](../src/pages/kategori/%5Bslug%5D/%5B...page%5D.astro:1) → `noindex={category.count === 0}`; `getAllCategories()` yalnız ürünü olan kategorileri döndürüyor ([`products.js`](../src/lib/products.js:1) `getAllCategories`).
- **Öneri:** Koşulu kaldır veya gerçek boş-durum (0 ürün) sayfalarını üretirken kullan; sayfalama sonu boş sayfa üretimini engelle.
- **Efor:** S

---

### AN — Analitik / ölçümleme (GA4)

#### AN-01 — `view_item` olayında fiyat 0 gidiyor (ürün seviyesinde fiyat yok)
- **Önem:** P1
- **Etki:** GA4 ürün görüntüleme olayı `product.price` alanından besleniyor; fiyatlar yalnız `variants[].price/salePrice` içinde tutulduğu için `Number(product.price)` → `0`. Sonuç: `view_item` değeri 0, `price` 0 ve `item_brand` ham (çözümlenmemiş) değer → GA4 gelir/ROAS raporları ve ürün performansı analizi sistematik olarak bozuk. Dönüşüm optimizasyonu bu veriye dayanamaz.
- **Kanıt:** [`urun/[slug].astro:781`](../src/pages/urun/%5Bslug%5D.astro:781) → `value: ${Number(product.price) || 0}`; [`urun/[slug].astro:787`](../src/pages/urun/%5Bslug%5D.astro:787) → `price: ${Number(product.price) || 0}`; [`urun/[slug].astro:785`](../src/pages/urun/%5Bslug%5D.astro:785) → `item_brand: ${JSON.stringify(String(product.brand || ''))}` (oysa ada `brandInfo.name` ile çözümlenmiş marka gönderiliyor). Fiyat kaynağı `lowestPrice`/`pricedVariants` ([`urun/[slug].astro`](../src/pages/urun/%5Bslug%5D.astro:1)).
- **Öneri:** Olayı `lowestPrice` (veya seçili varyant fiyatı), `brandInfo.name` ve `category.name` ile üret; `item_id` için barkod/SKU kullan. Değerleri sunucuda hesaplayıp inline script'e tek yerden yaz.
- **Efor:** S

#### AN-02 — `purchase` olayı doğrulanmadan tetikleniyor ve sepeti siliyor
- **Önem:** P1
- **Etki:** `/siparis-basarili/` her açıldığında, sepet doluysa `purchase` olayı fırlatılıyor. Sayfa `noindex` olsa da kullanıcı geri/ileri, yer imi veya paylaşılan link ile gelebilir; ödeme hiç yapılmamışken "satış" kaydı oluşur. Ayrıca sepet bu sayfada koşulsuz silindiği için kullanıcı siparişini kaybeder. Gelir raporları şişer, gerçek dönüşüm oranı ölçülemez.
- **Kanıt:** [`siparis-basarili.astro`](../src/pages/siparis-basarili.astro:1) → inline script: `window.gtag('event', 'purchase', { transaction_id: orderId || String(Date.now()), … })` ve ardından `window.localStorage.removeItem('saprintpro_cart_v1')`; tek koruma aynı `orderId` için `sa-purchase-tracked` guard'ı.
- **Öneri:** `purchase` yalnız ödeme sağlayıcısından dönen doğrulanmış parametreyle (Worker tarafında imza/token kontrolü) tetiklensin; aksi halde olay gönderilmesin ve sepet silinmesin. `Date.now()` fallback'i kaldırılmalı (her ziyaret yeni "sipariş" üretiyor).
- **Efor:** M

### PERF — Performans

#### PERF-01 — Ürün görsellerinde `width`/`height` yok (CLS)
- **Önem:** P1
- **Etki:** Kart, galeri, arama sonucu ve 404 görselleri sabit oranlı konteyner içinde ama `<img>` boyutsuz. Görsel yüklenirken layout kayması (CLS) oluşur; Core Web Vitals ve mobil sıralama etkilenir.
- **Kanıt:** [`ProductCard.astro:97`](../src/components/ProductCard.astro:97) → `<img src={image} alt={displayName} loading=…` (width/height yok); aynı desen [`ProductCard.jsx`](../src/components/islands/ProductCard.jsx:120), [`Gallery.jsx`](../src/components/islands/Gallery.jsx:1), [`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:1), [`404.astro:136`](../src/pages/404.astro:136).
- **Öneri:** Kartlarda 4:5 için `width={800} height={1000}` (veya gerçek üretilen boyut) ver; `aspect-[4/5]` korunarak `h-full w-full` ile birlikte kullan.
- **Efor:** S

#### PERF-02 — Arama dropdown'ı tam boy görsel yüklüyor
- **Önem:** P2
- **Etki:** 48×48 px küçük resim için orijinal WebP indiriliyor; `search-index.json` her sonuçta tam görsel URL'i taşıyor. Mobilde tuş vuruşu başına birkaç yüz KB gereksiz indirme olur.
- **Kanıt:** [`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:1) → `<img src={product.image} … className="h-full w-full object-cover" />`; indeks üretimi [`build-search-index.mjs:87`](../scripts/build-search-index.mjs:87) → `image: localImage` (tam boy).
- **Öneri:** `process-images.mjs` içinde 96×96 `-thumb.webp` üret; indekste `thumb` alanı taşı ve dropdown'da onu kullan.
- **Efor:** M

#### PERF-03 — Google Fonts dış çağrısı, preload + `media="print"` hilesiyle
- **Önem:** P2
- **Etki:** 3. taraf bağlantısı (2 preconnect + 1 preload + 1 stylesheet) kritik yolda; `onload="this.media='all'"` inline event handler CSP ile çakışabilir ve font swap sırasında metin kaymasına yol açar. 5 ağırlık (400–800) gereğinden fazla olabilir.
- **Kanıt:** [`Layout.astro:86-87`](../src/layouts/Layout.astro:86) (gtag) sonrası font bloğu: `rel="preconnect"` + `rel="preload" as="style"` + `media="print" onload="this.media='all'"` ([`Layout.astro`](../src/layouts/Layout.astro:1) ~satır 130-160).
- **Öneri:** Fontları `public/fonts` altında self-host et (`woff2`, `font-display: swap`, `size-adjust`), yalnız 400/600/700 yükle; inline onload yerine CSS `@font-face` kullan.
- **Efor:** M

#### PERF-04 — Ağır island'lar her sayfada `client:load`
- **Önem:** P2
- **Etki:** `CookieBanner`, `CartButton`, `ThemeToggle`, `MobileNav` her sayfada anında hidrasyon; React runtime + lucide ikonları ilk yüklemede çalışır. Ana sayfa/ürün sayfası gibi statik ağırlıklı sayfalarda TBT ve mobil LCP olumsuz etkilenir.
- **Kanıt:** [`Layout.astro`](../src/layouts/Layout.astro:1) → `<CookieBanner client:load />`; [`Navbar.astro`](../src/components/Navbar.astro:1) → `<CartButton client:load />`, `<ThemeToggle client:load />`, `<MobileNav client:load … />`.
- **Öneri:** Cookie banner ve tema düğmesini `client:idle` (veya saf vanilla script) yap; mobil menüyü `client:visible`; sepet sayacı için küçük bir inline script + `useSyncExternalStore` yerine hafif bir özel event dinleyici düşün.
- **Efor:** M

#### PERF-05 — `_headers` içinde CSP yok, Worker yanıtları için cache kuralı yok
- **Önem:** P3
- **Etki:** Güçlü başlık seti var (`nosniff`, HSTS, COOP) ama `Content-Security-Policy` yok; dolayısıyla inline script'ler (GA4, tema, view_item, purchase) zorunlu kalıyor ve XSS yüzeyi geniş. `/shopier/oauth/callback` gibi Worker yanıtları statik asset kuralına girmediği için cache/başlık tutarlılığı yok.
- **Kanıt:** [`public/_headers:1-12`](../public/_headers:1) → CSP satırı yok; Worker OAuth yanıtı yalnız `content-type` set ediyor ([`worker/index.js`](../worker/index.js:1) `handleOAuthCallback`).
- **Öneri:** `report-only` ile CSP başlat (`script-src 'self' 'unsafe-inline' https://www.googletagmanager.com`), sonra nonce/hash'e geçir; Worker yanıtlarına `cache-control: no-store` + `x-robots-tag: noindex` ekle.
- **Efor:** M

#### PERF-06 — Sayfa başına 24 ürünün tam nesnesi hidrasyon payload'ına giriyor
- **Önem:** P3
- **Etki:** `toClientProduct` ürünün tüm alanlarını (`variants[].attributes`, `descriptionHtml` yok ama diğer alanlar var) ada prop'u olarak serileştiriyor; 24 ürün × çok varyant HTML içinde şişiyor. HTML boyutu ve parse maliyeti artar.
- **Kanıt:** [`urunler/[...page].astro`](../src/pages/urunler/%5B...page%5D.astro:1) → `const clientProducts = products.map(toClientProduct)`; `ProductGridStatic` yalnız `name, slug, images[0], variants{fiyat,stok}, brand` ihtiyacı duyuyor (bkz. [`ProductCard.jsx`](../src/components/islands/ProductCard.jsx:1) kullanımı).
- **Öneri:** `toClientProduct` yerine `toCardProduct` ile minimal projeksiyon gönder (ad, slug, tek görsel, en düşük fiyat, stok toplamı, varsayılan varyant barcode).
- **Efor:** M

---

### A11Y — Erişilebilirlik

#### A11Y-01 — Aynı DOM id'si birden fazla kez basılıyor (`search-results`)
- **Önem:** P1
- **Etki:** `SearchBar` hem masaüstü navbar'da hem mobil menüde (ve 404'te) render ediliyor; `id="search-results"` ve `aria-controls` her kopyada aynı. HTML geçersiz; ekran okuyucu `aria-controls` referansını yanlış öğeye bağlar.
- **Kanıt:** [`SearchBar.jsx:292`](../src/components/islands/SearchBar.jsx:292) → `aria-controls="search-results"` ve [`SearchBar.jsx:311`](../src/components/islands/SearchBar.jsx:311) → `id="search-results"`; iki örnek aynı sayfada: [`Navbar.astro`](../src/components/Navbar.astro:1) (`SearchBar client:idle`), [`MobileNav.jsx`](../src/components/islands/MobileNav.jsx:1) (`<SearchBar autoFocus …/>`), [`404.astro`](../src/pages/404.astro:1).
- **Öneri:** `useId()` ile tekil id üret (`const listboxId = useId()`), `aria-controls={listboxId}` kullan.
- **Efor:** S

#### A11Y-02 — Arama combobox ARIA'sı geçersiz ve klavye desteği yok
- **Önem:** P2
- **Etki:** `<input>` üzerinde `aria-expanded` var ama `role="combobox"`/`aria-autocomplete` yok; liste `role="listbox"` fakat çocuklar `role="option"` değil `<a>` linkler. Ok tuşlarıyla gezinme, Enter ile seçme ve `aria-activedescendant` yok → klavye/ekran okuyucu kullanıcısı önerileri kullanamaz.
- **Kanıt:** [`SearchBar.jsx:291-293`](../src/components/islands/SearchBar.jsx:291) ve [`SearchBar.jsx:311-313`](../src/components/islands/SearchBar.jsx:311); sonuçlar `<ul><li><a>` olarak basılıyor ([`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:1) sonuç listesi).
- **Öneri:** Ya tam combobox deseni uygula (role=combobox/listbox/option + klavye), ya da ARIA rolleri kaldırıp düz bir "search results" bölgesi + link listesi olarak işaretle (daha düşük risk).
- **Efor:** M

#### A11Y-03 — Çerez banner'ı dialog semantiği taşıyor ama odak yönetimi yok
- **Önem:** P2
- **Etki:** `role="dialog"` + `aria-live` birlikte kullanılmış; `aria-modal` yok, odak banner'a taşınmıyor, ESC ile kapanmıyor, arka plan etkileşimi engellenmiyor. Klavye kullanıcısı banner'ı fark etmeyebilir; `aria-live` ile tüm içerik anons edilir (gürültü).
- **Kanıt:** [`CookieBanner.jsx:74-76`](../src/components/islands/CookieBanner.jsx:74) → `role="dialog" aria-live="polite" aria-label="Çerez bildirimi"`; odak/ESC kodu yok.
- **Öneri:** `role="region"` + `aria-labelledby` kullan (modal değil, non-blocking banner), ilk butona `autoFocus` verme yerine `tabindex="-1"` ile banner'a odak taşı, `Escape` ve kapat butonu ekle; ayrıntılı ayar linki ("Çerez tercihleri") koy.
- **Efor:** S

#### A11Y-04 — Galeri küçük resimlerinde `aria-current` ve tekrar eden `alt`
- **Önem:** P2
- **Etki:** Butonlarda `aria-current` geçersiz kullanım (sayfa/p konum değil); doğru öznitelik `aria-pressed`. Tüm görseller aynı `alt` metnini taşıyor, bu da ekran okuyucuda ayırt edilemeyen tekrarlar üretir.
- **Kanıt:** [`Gallery.jsx`](../src/components/islands/Gallery.jsx:1) → `aria-current={isActive}` ve her `<img>` için `alt={title ? \`${title} - Motosiklet Reflektif Sticker SA Printpro\` : …}`.
- **Öneri:** `aria-pressed={isActive}` kullan; küçük resimlere `alt={\`${title} ${index + 1}. görsel\`}`, dekoratifse `alt=""`.
- **Efor:** S

#### A11Y-05 — 404 sayfasındaki `<label for>` bir `<div>`'i işaret ediyor
- **Önem:** P2
- **Etki:** Etiket hiçbir form kontrolüne bağlı değil; ekran okuyucu etiketi input ile ilişkilendiremez, tıklama odağı taşımaz. Ayrıca arama input'unun kendi `aria-label`'ı var → çift/çelişkili adlandırma.
- **Kanıt:** [`404.astro`](../src/pages/404.astro:1) → `<label for="notfound-search">…</label>` ve `<div id="notfound-search"><SearchBar …/></div>`; `SearchBar` içindeki input `aria-label="Ürün ara"` ([`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:1)).
- **Öneri:** `SearchBar`'a `inputId` prop'u ekleyip `<label for={inputId}>` bağla veya etiketi `<span>` yapıp `aria-label` ile yetin.
- **Efor:** S

#### A11Y-06 — Mobil menü kaplaması dialog değil, odak tuzağı yok, konum hatalı
- **Önem:** P2
- **Etki:** Açılan panel `role="dialog"`/`aria-modal` taşımıyor, odağı içine almıyor, dışına tıklayınca kapanmıyor. `top-[88px]` sabit değeri 64 px yüksekliğindeki header ile uyuşmadığı için panel ya üst üste biner ya boşluk bırakır (mobilde tıklama alanı kaybı).
- **Kanıt:** [`MobileNav.jsx`](../src/components/islands/MobileNav.jsx:1) → `fixed inset-x-0 top-[88px] …` iki panel; `role="dialog"` yok. Header yüksekliği [`Navbar.astro`](../src/components/Navbar.astro:1) → `h-16` (64 px).
- **Öneri:** `top-16` (veya CSS değişkeni) kullan; panele `role="dialog" aria-modal="true"`, ilk linke odak, ESC + dış tıklama ile kapatma ve odak tuzağı ekle.
- **Efor:** M

#### A11Y-07 — Yardımcı metinlerde kontrast ve 10 px tipografi
- **Önem:** P2
- **Etki:** `text-zinc-400` (≈ #a1a1aa) beyaz üstünde ~2.4:1 kontrast verir (WCAG AA 4.5:1 ister). `text-2xs` = 10 px, okunabilirlik sınırının altında; fiyat/barkod/kategori gibi bilgiler bu boyutta.
- **Kanıt:** [`tailwind.config.mjs`](../tailwind.config.mjs:1) → `'2xs': ['0.625rem', …]`; kullanım örnekleri [`ProductCard.astro`](../src/components/ProductCard.astro:1) (rozetler), [`CartView.jsx`](../src/components/islands/CartView.jsx:1) (özet altı not), [`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:1) (barkod satırı `text-zinc-400`).
- **Öneri:** İkincil metin için `text-zinc-500`/`zinc-600` kullan; `text-2xs`'yi 11–12 px'e çıkar veya yalnız dekoratif rozetlerde bırak ve kritik bilgide `text-xs` kullan.
- **Efor:** M

#### A11Y-08 — Tükendi durumunda üç ayrı "Tükendi/Stokta" anonsu
- **Önem:** P3
- **Etki:** Aynı kartta hem üst rozet ("Tükendi"), hem alt satır ("Tükendi"), hem tam kaplayan overlay rozeti basılıyor; stokta olan üründe de iki kez "Stokta" yazılıyor. Ekran okuyucu ve görsel tekrar gürültüsü.
- **Kanıt:** [`ProductCard.astro`](../src/components/ProductCard.astro:1) → üst rozet bloğu, `!inStock` overlay bloğu ve alt "Stokta/Tükendi" satırı; aynı üçlü [`ProductCard.jsx`](../src/components/islands/ProductCard.jsx:1).
- **Öneri:** Tek bir stok göstergesi seç (rozet), diğerlerini kaldır veya `aria-hidden` yap; kart genelinde `aria-label` ile durumu bir kez bildir.
- **Efor:** S

---

### PRIV — Gizlilik, rıza, güvenlik

#### PRIV-01 — GA4, çerez politikasının aksine onaydan bağımsız yükleniyor
- **Önem:** P1
- **Etki:** Çerez politikası "Analitik çerezler yalnızca açık rızanız ile etkinleşir" diyor; uygulamada `gtag.js` herkese yükleniyor (Consent Mode varsayılanı `denied` olsa da cookieless ping'ler Google'a gider). KVKK aydınlatma/çerez metni ile teknik uygulama çelişiyor → denetim ve itibar riski; ayrıca kullanıcı "Reddet" dedikten sonra da ağ istekleri sürüyor.
- **Kanıt:** [`Layout.astro:86-87`](../src/layouts/Layout.astro:86) → koşulsuz `<script async src="https://www.googletagmanager.com/gtag/js?id=…" />` ve ardından `gtag('config', …)`; metin: [`cerez-politikasi.astro`](../src/pages/cerez-politikasi.astro:1) analitik çerez bloğu → "Yalnızca açık rızanız ile etkinleşir."
- **Öneri:** GA4'ü yalnızca rıza verildiğinde dinamik yükle (`consent.js` içinde script injection) **veya** metni "Consent Mode v2 ile cookieless ölçüm" olarak gerçeğe uygun yeniden yaz. İkinci seçenekte `wait_for_update` + reklam kişiselleştirme kapalı kalsın.
- **Efor:** M

#### PRIV-02 — "IP anonimleştirmesi uygulanır" iddiası GA4 için geçersiz
- **Önem:** P2
- **Etki:** GA4'te `anonymize_ip` parametresi yok (UA döneminden kalma). Metin teknik olarak yanlış bir güvence veriyor; KVKK/GDPR denetiminde "yanıltıcı beyan" olarak değerlendirilebilir.
- **Kanıt:** [`cerez-politikasi.astro`](../src/pages/cerez-politikasi.astro:1) analitik çerez açıklaması → "IP anonimleştirmesi uygulanır"; `Layout.astro`'daki `gtag('config')` çağrısında böyle bir ayar yok ([`Layout.astro`](../src/layouts/Layout.astro:1)).
- **Öneri:** Metni "IP adresi Google tarafından toplanabilir; veri saklama süresi X aydır" şeklinde düzelt veya gerçekten IP maskeleme yapan bir proxy/Consent Mode ayarı uygula.
- **Efor:** S

#### PRIV-03 — Rıza geri alma ve granüler tercih yok
- **Önem:** P1
- **Etki:** Kullanıcı "Kabul Et" dedikten sonra çerez politikasındaki "tercihinizi dilediğiniz zaman değiştirebilirsiniz" ifadesi fiilen sadece tarayıcı verisi silmeye bağlı. Analitik/pazarlama ayrımı yapılamıyor; AB/EEA benzeri beklentilerde uyumsuzluk.
- **Kanıt:** [`consent.js`](../src/lib/consent.js:1) → yalnız `'true'|'false'` tek anahtar (`sa-cookie-consent`); [`CookieBanner.jsx`](../src/components/islands/CookieBanner.jsx:1) → sadece "Reddet"/"Kabul Et", ayar ekranı veya "tercihleri değiştir" linki yok.
- **Öneri:** Kategori bazlı rıza (`analytics`, `marketing`) sakla; footer'a "Çerez Tercihleri" linki ekle; banner'ı tekrar açan bir API (`window.__openConsent()`) sağla.
- **Efor:** M

#### PRIV-04 — Webhook imza doğrulaması yok (açık uç nokta)
- **Önem:** P2
- **Etki:** `/api/shopier/webhook` herkesin POST edebildiği bir uç; gövde doğrulanmadan `{received:true}` dönüyor. İleride sipariş işleme eklenirse sahte sipariş/olay enjeksiyonu mümkün olur. Şu an işlevsiz olduğu için "yarım açık kapı".
- **Kanıt:** [`worker/index.js`](../worker/index.js:1) → `handleShopierWebhook` içinde `// TODO: Shopier webhook imzasini … dogrula` (proje dokümanı da bu satırı `worker/index.js:207` olarak işaret ediyor: [`docs/DURUM-VE-YAPILACAKLAR.md`](DURUM-VE-YAPILACAKLAR.md:207)); imza kontrolü veya `env.SHOPIER_WEBHOOK_SECRET` kullanımı yok.
- **Öneri:** İmza/`X-Shopier-Signature` doğrulaması ekle, başarısızsa `401`; doğrulama yoksa endpoint'i tamamen kapat (`404`) ve `wrangler.toml`'da route tanımlama.
- **Efor:** M

#### PRIV-05 — OAuth callback token'ı alıp atıyor; akış yarım
- **Önem:** P2
- **Etki:** Token değişimi yapılıyor, sonuç yalnız "başarılı" HTML'i olarak dönüyor; token hiçbir yerde saklanmıyor/kullanılmıyor. Ayrıca kullanıcıyı yetkilendirmeye gönderen bir `/shopier/oauth/start` route'u yok. Yani Shopier entegrasyonu "kodu var, işlevi yok" durumunda; doküman bunu tamamlanmış gibi listeliyor.
- **Kanıt:** [`worker/index.js`](../worker/index.js:1) → `exchangeCodeForToken()` sonrası yalnız `renderPage(...)` dönüyor; `KV`/secret storage yazımı yok. Route listesinde yalnız `callback` ve `webhook` var ([`worker/index.js`](../worker/index.js:1) `fetch` içindeki `pathname` kontrolleri).
- **Öneri:** Token'ı `KV`/Durable Object veya şifreli secret olarak sakla; `start` route'u + `state` (CSRF) parametresi ekle; entegrasyon gerçekten kullanılmayacaksa kodu kaldır ve dokümanı düzelt.
- **Efor:** L

---

### LEGAL — Yasal/kurumsal içerik

#### LEGAL-01 — Zorunlu satıcı kimliği alanları boş
- **Önem:** **P0**
- **Etki:** `legalName`, `address`, `taxOffice`, `taxNumber`, `mersis`, `returnAddress`, `returnRecipient` boş. Footer'daki "Kurumsal Bilgiler", iletişim sayfası, mesafeli satış sözleşmesinin "SATICI" bloğu ve iade adresi eksik çıkıyor. Bu haliyle mesafeli satış sözleşmesi **geçersiz**, fatura kesilemez, iade süreci yürütülemez.
- **Kanıt:** [`src/config/site.js:31-42`](../src/config/site.js:31) → `company: { legalName: '', address: '', …, taxOffice: '', taxNumber: '', mersis: '', returnAddress: '', returnRecipient: '' }`; tüketici tarafı: [`Footer.astro:33-39`](../src/components/Footer.astro:33) (`filter(Boolean)` ile satırlar tamamen kayboluyor), [`mesafeli-satis-sozlesmesi.astro:21-27`](../src/pages/mesafeli-satis-sozlesmesi.astro:21).
- **Öneri:** Şirket/şahıs işletmesi bilgilerini (unvan, açık adres, vergi dairesi+VKN, MERSİS, iade adresi/alıcı, KEP varsa) doldur; `check-company-info` çıktısını release checklist'e ekle.
- **Efor:** S (veri girişi) — hukuki içerik onayı ayrıca gerekli.

#### LEGAL-02 — Kurumsal bilgi kontrolü build'i hiç durdurmuyor
- **Önem:** **P0**
- **Etki:** Eksik yasal bilgiyle üretim yayını engellenmiyor: script her durumda `exit 0`. Yani LEGAL-01 durumu fark edilmeden canlıya çıkabilir (ve çıkmış görünüyor). Aynı script placeholder'ları da tarıyor ama sonucu yalnızca log'a yazıyor.
- **Kanıt:** [`scripts/check-company-info.mjs`](../scripts/check-company-info.mjs:1) → `main()` sonunda iki ayrı `process.exit(0)` (eksik alan olsa da başarılı); `build` zincirinde ilk adım olarak çağrılıyor ([`package.json:9`](../package.json:9)) → yani kasıtlı olarak "uyarı" davranışı.
- **Öneri:** `--strict` modu ekle: production build/CI'da eksik varsa `exit 1`; lokal dev'de uyarı kalsın. Ayrıca `PLACEHOLDER_PATTERNS` taramasını yasal sayfa metinlerine de uygula.
- **Efor:** S

#### LEGAL-03 — İade adresi bölümü boş çıkıyor
- **Önem:** P1
- **Etki:** "İade gönderimleri aşağıdaki adrese yapılmalıdır:" cümlesinden sonra hiçbir adres gelmiyor. Müşteri iadeyi nereye göndereceğini bilemiyor → cayma hakkı fiilen kullanılamaz, şikâyet riski.
- **Kanıt:** [`iade-ve-cayma-hakki.astro`](../src/pages/iade-ve-cayma-hakki.astro:1) → `${[company.returnAddress, company.returnRecipient ? … : ''].filter(Boolean).join('\n')}` her ikisi boşken boş string üretiyor; kaynak: [`site.js:31-42`](../src/config/site.js:31).
- **Öneri:** LEGAL-01 ile birlikte doldur; ayrıca değer boşsa bölümü tamamen gizleyip "iade adresi için iletişime geçin" alternatif metni bas (boş başlık göstermesin).
- **Efor:** S

#### LEGAL-04 — "Son güncelleme" gerçek tarih değil, sadece yıl
- **Önem:** P2
- **Etki:** Tüm yasal sayfalarda `Son güncelleme: 2026` gibi yalnız yıl yazıyor; üstelik build anındaki yıla göre otomatik değişiyor. Kullanıcıya ve denetime "güncel metin" kanıtı sunulamaz.
- **Kanıt:** [`mesafeli-satis-sozlesmesi.astro:94`](../src/pages/mesafeli-satis-sozlesmesi.astro:94), [`iade-ve-cayma-hakki.astro:104`](../src/pages/iade-ve-cayma-hakki.astro:104), [`kvkk-aydinlatma-metni.astro:116`](../src/pages/kvkk-aydinlatma-metni.astro:116), [`gizlilik-politikasi.astro:116`](../src/pages/gizlilik-politikasi.astro:116), [`cerez-politikasi.astro:90`](../src/pages/cerez-politikasi.astro:90) → `{new Date().getFullYear()}`.
- **Öneri:** `siteConfig.legal.lastUpdated = '2026-11-16'` gibi sabit bir ISO tarih tut; her yasal sayfa `tr-TR` formatında onu göstersin.
- **Efor:** S

#### LEGAL-05 — KVKK başvuru maddesi adres boşken yarım cümle
- **Önem:** P2
- **Etki:** `addressClause` boş olduğunda madde "… e-posta göndererek" ile bitiyor ve "veri sorumlusuna iletebilirsiniz" diye devam ediyor; araya giren madde işareti/boşluk yüzünden cümle dilbilgisel olarak kopuk. KVKK aydınlatma metni bu haliyle özensiz ve eksik başvuru yolu sunuyor (yazılı başvuru adresi yok).
- **Kanıt:** [`kvkk-aydinlatma-metni.astro:21-23`](../src/pages/kvkk-aydinlatma-metni.astro:21) → `addressClause` koşullu üretiliyor; §8 `body` içinde `• … göndererek${addressClause}` şeklinde birleştiriliyor ([`kvkk-aydinlatma-metni.astro`](../src/pages/kvkk-aydinlatma-metni.astro:1)).
- **Öneri:** Adres boşsa madde işaretini ve "veya" bağlacını da koşullu üret; yazılı başvuru adresi zorunlu hale gelsin (LEGAL-01 ile birlikte).
- **Efor:** S

#### LEGAL-06 — Gizlilik politikası "sitede ödeme alınmaz" derken sepet Shopier'e yönlendiriyor
- **Önem:** P2
- **Etki:** Metin "sitemiz üzerinden ödeme alınmaz" diyor; uygulamada sepet "Siparişi Tamamla" ile Shopier'e yönlendiriyor (haritalar doldurulduğunda). Çelişki, veri sorumluluğu ve ödeme akışı anlatımını tutarsız kılıyor.
- **Kanıt:** [`gizlilik-politikasi.astro`](../src/pages/gizlilik-politikasi.astro:1) §2 → "Sitemiz bir vitrin (showcase) platformudur; sitemiz üzerinden doğrudan üyelik oluşturulmaz ve ödeme alınmaz." Karşı uygulama: [`CartView.jsx:179`](../src/components/islands/CartView.jsx:179) → Shopier yönlendirmesi.
- **Öneri:** Metni "ödeme, sitenin yönlendirdiği Shopier altyapısında alınır" şeklinde güncelle; sözleşme, çerez ve gizlilik metinlerini tek kaynaktan (config) üret.
- **Efor:** S

#### LEGAL-07 — Hakkımızda sayfasında yasal kimlik bilgisi yok
- **Önem:** P2
- **Etki:** "İşletme Adı: SA Printpro" ve "detaylı bilgi için iletişime geçin" yazıyor; unvan/adres/vergi bilgisi yok. ETBİS ve tüketici mevzuatı açısından satıcı kimliğinin erişilebilir olması beklenir; ayrıca güven sinyali zayıflar.
- **Kanıt:** [`hakkimizda.astro`](../src/pages/hakkimizda.astro:1) → "Kurumsal Bilgi" bloğunda yalnız `İşletme Adı` + `Faaliyet Alanı`, ardından "Detaylı kurumsal bilgi … için lütfen bizimle iletişime geçin."
- **Öneri:** LEGAL-01 dolduktan sonra aynı `company` bloğunu burada da render et; ETBİS kayıt bilgisini ekle.
- **Efor:** S

#### LEGAL-08 — İletişim sayfasında form yok, `mailto:` linkleri yeni sekmede açılıyor
- **Önem:** P3
- **Etki:** Tüm iletişim "dış uygulamaya" devredilmiş; kurumsal/toptan talepler için form veya en azından kopyalanabilir bilgi yok. `mailto:`/`instagram` linklerinde `target="_blank"` gereksiz yeni sekme açar (mobilde uygulama geçişi sorunlu olabilir).
- **Kanıt:** [`iletisim.astro`](../src/pages/iletisim.astro:1) → `channels` yalnız WhatsApp/Instagram/E-posta; tüm `<a>` etiketlerinde `target="_blank" rel="noopener noreferrer"`.
- **Öneri:** Basit bir iletişim formu (sunucusuz endpoint + honeypot/rate-limit) veya `mailto:` için `target` kaldır; KVKK onayı ve "hangi kanaldan dönüş" bilgisi ekle.
- **Efor:** M

---

### DATA — Veri katmanı ve katalog

#### DATA-01 — Yerel görsel kontrolü, yalnız 2 sayfanın set ettiği global'e bağlı
- **Önem:** P1
- **Etki:** `getProductPrimaryImage`/`getProductImages`, `globalThis.__SA_PRINTPRO_FS__` yoksa **CDN URL'ine düşüyor**. Bu global yalnız `404.astro` ve `urun/[slug].astro` modüllerinde atanıyor. Build sırasında modül değerlendirme sırasına göre ana sayfa/liste sayfaları yerel WebP yerine Trendyol CDN'i basabilir → marka bağımsızlığı iddiası, `toClientProduct` filtresi ve JSON-LD görselleri bozulur, hotlink riski geri gelir.
- **Kanıt:** [`products.js:438`](../src/lib/products.js:438) → `const { existsSync } = globalThis.__SA_PRINTPRO_FS__ || {}` ve `return existsSync(...) ? localPath : cdnImage`; assignment yalnız [`404.astro:17`](../src/pages/404.astro:17) ve [`urun/[slug].astro:38`](../src/pages/urun/%5Bslug%5D.astro:38). `index.astro`, `urunler`, `kategori`, `marka` sayfalarında bu atama yok.
- **Öneri:** `fs` kontrolünü modül yüklemesinde bir kez yap (`import { existsSync } from 'node:fs'` + `typeof window === 'undefined'` guard'ı ile, ya da `import.meta.env.SSR`), global hack'i kaldır; alternatif olarak görsel varlığını build öncesi `public/products-manifest.json` ile üret.
- **Efor:** M

#### DATA-02 — Arama indeksi görselin var olduğunu varsayıyor
- **Önem:** P2
- **Etki:** `search-index.json` her ürün için `/uploads/products/{id}.webp` yazıyor; dosya yoksa dropdown'da kırık görsel oluşur. `process-images` build'de çalışmadığı için (CONF-03) senkron sonrası bu durum sessizce oluşur.
- **Kanıt:** [`build-search-index.mjs:87`](../scripts/build-search-index.mjs:87) → `const localImage = product?.id ? \`/uploads/products/${product.id}.webp\` : null` (varlık kontrolü yok).
- **Öneri:** İndeks üretiminde `existsSync(publicPath)` kontrolü yap; yoksa `null` yaz ve UI'da placeholder göster.
- **Efor:** S

#### DATA-03 — Katalog 2 aydır güncellenmemiş görünüyor
- **Önem:** P2
- **Etki:** `products.json` `generatedAt` 2026-09-13; bugün 2026-11-16. Günlük 2 kez senkron planlanmış olmasına rağmen veri tazelenmemiş → fiyat/stok/fiyat değişiklikleri sitede yok. Bu, doğrudan yanlış fiyat gösterme riski (ve Merchant feed'in bayatlaması) demek.
- **Kanıt:** [`products.json:2`](../src/data/products.json:2) → `"generatedAt": "2026-09-13T16:20:38.400Z"`; planlanan cron [`sync.yml:17`](../.github/workflows/sync.yml:17).
- **Öneri:** Code modunda `gh run list --workflow=sync.yml` ile son çalışmaları incele; muhtemel nedenler CONF-02 (çift workflow/push çakışması) ve API kimlik/limit hatası. Senkron başarısızlığında görünür alarm (issue açma) ekle.
- **Efor:** S

#### DATA-04 — Stok değerleri gerçekçi değil (19936 / 19999)
- **Önem:** P2
- **Etki:** İlk ürünlerde stok 19936, 19999 gibi değerler var; bu değerler "stokta" sinyalini sürekli açık tutar, "Tükendi" senaryosu hiç test edilmez ve kampanya/aciliyet mesajları etkisizleşir. Ayrıca varyant stoğu ile varyant seçici metni ("Stokta (19999 adet)") müşteriye inandırıcı gelmez.
- **Kanıt:** [`products.json:1`](../src/data/products.json:1) → ilk ürün varyantı `"stock": 19936`; ikinci ürün `"stock": 19999` (aynı dosya içindeki ilk iki ürün bloğu).
- **Öneri:** Trendyol'dan gelen `quantity` alanının doğru eşlendiğini doğrula; üst sınır (ör. 999) uygula; `>500` stokları "Stokta" olarak normalize et.
- **Efor:** S

#### DATA-05 — Ürün açıklamalarında bozuk HTML entity ve kapanmayan etiketler
- **Önem:** P2
- **Etki:** `yedek&nbsp.` gibi geçersiz entity'ler ve `<p>` kapanmadan iç içe geçen etiketler var. Ürün sayfasında metin akışı bozulabilir; feed'de `&nbsp.` olarak çift kaçışlı görünür (aşağıdaki örnek). Merchant Center "description" kalitesi düşer.
- **Kanıt:** [`products.json`](../src/data/products.json:1) ikinci ürün (`1157433395`) `descriptionHtml` → `"yedek&nbsp. almanızı öneririz … <p> … <p> …"`; feed'e yansıması [`public/google-merchant.xml`](../public/google-merchant.xml:18) → `yedek&nbsp. almanızı öneririz`.
- **Öneri:** `sanitize-catalog`/`repair-catalog` hattına entity normalizasyonu (ör. `&nbsp.` → `&nbsp;`) ve HTML denge kontrolü ekle; feed üretiminde `decodeHtmlEntities` benzeri bir adımı yeniden kullan.
- **Efor:** M

#### DATA-06 — Redirect haritaları üç yerde ve tutarsız
- **Önem:** P2
- **Etki:** `src/data/category-redirects.json` yalnız 1 kayıt içeriyor; `products.js` içindeki `CATEGORY_REDIRECTS` 5 kayıt; `worker/index.js` içindeki `CATEGORY_REDIRECTS` 5 kayıt. `product-redirects.json` ise Worker'a elle kopyalanmış. Tek kaynak yok → yeni birleştirmede 301'lerin bir kısmı eksik kalır (SEO değeri kaybı) veya Worker ile build farklı davranır.
- **Kanıt:** [`src/data/category-redirects.json:1`](../src/data/category-redirects.json:1) → yalnız `{ "arma-sticker-fosfor-serit": "motosiklet-sticker-granaj" }`; [`products.js`](../src/lib/products.js:1) `CATEGORY_REDIRECTS` 5 girişli; [`worker/index.js`](../worker/index.js:1) `CATEGORY_REDIRECTS` ve `PRODUCT_REDIRECTS` blokları aynı veriyi tekrar ediyor.
- **Öneri:** Tek JSON kaynak (`src/data/redirects.json`) + build adımında Worker için modül üretimi (`import redirects from '../src/data/redirects.json'` wrangler bundling'i destekler); `scripts/verify-category-redirects.mjs`'i bu kaynağa bağla.
- **Efor:** M

---

### UX — Deneyim ve dönüşüm

#### UX-01 — Sıralama yalnızca mevcut 24 ürünü sıralıyor
- **Önem:** P1
- **Etki:** "Fiyat: Artan" seçildiğinde kullanıcı tüm katalogda en ucuz ürünü beklerken yalnızca o sayfadaki 24 ürün sıralanıyor. 10 sayfalık katalogda en ucuz ürün 7. sayfada kalabilir → yanıltıcı sıralama, güven kaybı, dönüşüm düşüşü. Aynı sorun stok filtresi ve marka filtresi için de geçerli (sayfa bazlı).
- **Kanıt:** [`urunler/[...page].astro`](../src/pages/urunler/%5B...page%5D.astro:1) → `products: paginate(getSortedProducts(), page, PAGE_SIZE)` (sunucu 24'lük dilim); [`ProductGridStatic.jsx`](../src/components/islands/ProductGridStatic.jsx:1) → sıralama `safeProducts` (yalnız sayfadaki 24) üzerinde `list.sort(...)`.
- **Öneri:** Sıralama/filtre parametrelerini sunucu tarafında `getStaticPaths` ile kombinasyon olarak üret (price-asc/desc için ayrı statik yollar) veya sıralama/filtreleme için grid'i tam katalogla besleyip sayfalamayı client-side yap. En azından UI'da "bu sayfada sırala" ifadesi kullan.
- **Efor:** L

#### UX-02 — Aynı ürün iki farklı kart davranışı gösteriyor
- **Önem:** P2
- **Etki:** Ana sayfa ve "Benzer Ürünler" statik kart kullanıyor (sepete ekle yok), liste sayfaları React kart kullanıyor (sepete ekle var). Kullanıcı aynı ürün için farklı CTA setleriyle karşılaşır; en çok trafik alan ana sayfada sepete ekleme imkânı yok → dönüşüm kaybı.
- **Kanıt:** [`ProductCard.astro`](../src/components/ProductCard.astro:1) (AddToCartButton yok, tüm kart tek `<a>`); [`ProductCard.jsx`](../src/components/islands/ProductCard.jsx:1) → `{hasPrice && <AddToCartButton … />}`; kullanım yerleri [`index.astro`](../src/pages/index.astro:1) ve [`urun/[slug].astro`](../src/pages/urun/%5Bslug%5D.astro:1) (Astro kart) vs [`ProductGridStatic.jsx`](../src/components/islands/ProductGridStatic.jsx:1) (React kart).
- **Öneri:** Astro kartına da "Sepete Ekle" ekle (küçük bir `client:visible` ada olarak) veya ana sayfayı React grid'e taşı; iki kartı tek tasarım sistemine indir.
- **Efor:** M

#### UX-03 — Tükendi ürün sayfasında çelişkili CTA'lar
- **Önem:** P2
- **Etki:** Stok 0 iken "Sepete Ekle" devre dışı ama WhatsApp CTA "atölyede aynı gün özel basılır" diyerek sipariş istiyor. Aynı ekranda iki zıt mesaj; kullanıcı hangisinin geçerli olduğunu anlamıyor; ayrıca sepete eklenemeyen ürün için "Stokta (0 adet)" benzeri tutarsız metinler oluşabiliyor.
- **Kanıt:** [`VariantSelector.jsx`](../src/components/islands/VariantSelector.jsx:1) → `!inStock` bloğunda "Bu ürün stokta tükenmiş görünse de … özel basılmaktadır." mesajı ve `<AddToCartButton disabled={!inStock} … />`; stok satırı aynı bileşende ([`VariantSelector.jsx`](../src/components/islands/VariantSelector.jsx:1)).
- **Öneri:** Tükenmiş üründe tek bir net yol seç: ya "Ön sipariş/özel üretim" modu (sepete ekle aktif, teslim süresi farklı) ya da yalnız "Haber ver" CTA'sı. Metinleri buna göre ayır.
- **Efor:** M

#### UX-04 — Güven rozeti, çalışmayan Shopier ödemesini vaat ediyor
- **Önem:** P2
- **Etki:** Ürün sayfasında "Shopier ve WhatsApp üzerinden güvenli ödeme" yazıyor; Shopier haritası boş olduğu için kullanıcı yalnız WhatsApp görüyor. Vaat ile deneyim uyuşmuyor (CART-01 ile birlikte).
- **Kanıt:** [`ProductTrustBadges.astro:20`](../src/components/ProductTrustBadges.astro:20) → `'Shopier ve WhatsApp üzerinden güvenli ödeme, 2 günde kargoda.'`; harita boş [`shopier.json:1`](../src/config/shopier.json:1).
- **Öneri:** Rozet metnini `shopier.json` dolu mu kontrolüne bağla (build-time boolean prop) veya harita dolana kadar yalnız WhatsApp metni göster.
- **Efor:** S

#### UX-05 — Arama `?q=` parametresi yazılıyor ama okunmuyor
- **Önem:** P3
- **Etki:** Kullanıcı arama yaptığında URL değişiyor (paylaşılabilir görünüyor), ancak sayfa yenilendiğinde/başka biri linki açtığında arama kutusu boş geliyor. Boşa yazılmış history manipülasyonu; ayrıca GA4'te `page_view` URL kirliliği.
- **Kanıt:** [`SearchBar.jsx`](../src/components/islands/SearchBar.jsx:1) → `syncUrl()` `url.searchParams.set('q', trimmed)`; bileşen açılışta `new URLSearchParams(window.location.search)` okumuyor (yalnız `SortFilterBar` ve grid'ler okuyor).
- **Öneri:** İlk render'da `q` parametresini okuyup `query` state'ine yükle (lazy initializer) veya `replaceState` kullanmayı bırak.
- **Efor:** S

#### UX-06 — Mobil arama/menü panelinin konumu header ile uyumsuz
- **Önem:** P3
- **Etki:** Panel `top-[88px]` ile sabitlenmiş, header 64 px. Sonuç: 24 px'lik boşluk (veya sticky davranışı değişince panel içeriği kesilir). Küçük ekranlarda içerik kayması.
- **Kanıt:** [`MobileNav.jsx`](../src/components/islands/MobileNav.jsx:1) → `top-[88px]`; [`Navbar.astro`](../src/components/Navbar.astro:1) → `h-16`.
- **Öneri:** `top-16` veya `top-[--header-h]` CSS değişkeni kullan; sticky header yüksekliği tek yerden tanımlansın.
- **Efor:** S

---

## 3. Uygulama Yol Haritası

### Faz 1 — Hızlı kazanımlar (yayın blokerlerini kaldır)
Sıralı; bağımlılıklar parantez içinde.

1. **LEGAL-01 + LEGAL-03**: `site.js → company` bloğunu doldur, iade adresi bölümünü doğrula. *(Önce bu; diğer yasal sayfalar buna bağlı.)*
2. **LEGAL-02**: `check-company-info.mjs`'ye `--strict` ekle, build/CI'da zorunlu kıl. *(LEGAL-01'e bağlı.)*
3. **CART-01**: `shopier.json` eşlemesini doldur (`npm run import-shopier`), en az N barkod için doğrula.
4. **CART-03**: `src/lib/totals.js` ile kargo/KDV/eşik hesabı; sepet özetine kargo satırı. *(Mesafeli satış metniyle hizala.)*
5. **SEO-02**: İade süresini tek config değerine indir (14 gün varsayımıyla) → rozet, JSON-LD, llms.txt.
6. **SEO-01**: `Layout` canonical varsayılanını `buildCanonical(Astro.url.pathname)` yap.
7. **CONF-01 + CONF-02**: CI Node sürümünü 24 yap; çift senkron workflow'unu tekilleştir.
8. **PRIV-01**: Ya GA4'ü rıza sonrası yükle, ya çerez politikası metnini Consent Mode gerçeğine uyarla. *(Metin kararı iş kararı; hızlı yol metin düzeltmesi.)*
9. **A11Y-01**: `SearchBar`'da `useId()` ile tekil id.
10. **DATA-01**: `__SA_PRINTPRO_FS__` global hack'ini kaldır, görsel kontrolünü modül düzeyine al.
11. **AN-01 + AN-02**: `view_item` fiyatını `lowestPrice`'tan üret; `purchase` olayını doğrulanmış ödeme dönüşüne bağla ve koşulsuz sepet silmeyi kaldır.

### Faz 2 — Ölçüm, SEO ve veri doğruluğu
1. **SEO-03 + SEO-05 + SEO-04**: Feed'e gtin/kategori/kargo/sale_price ve slash'li link; JSON-LD'ye gtin.
2. **CONF-03**: Build hattına `process-images` + `lint` + `npm test` + `qa-audit` ekle. *(Faz 1/2 sonrası regresyon güvencesi.)*
3. **DATA-02 + DATA-04 + DATA-05**: İndekste görsel varlık kontrolü; stok normalizasyonu; entity/HTML temizliği.
4. **DATA-03**: Senkronun neden durduğunu teşhis et ve alarm ekle.
5. **PERF-01 + PERF-04**: `width/height` ve island direktiflerini optimize et.
6. **A11Y-02 + A11Y-03 + A11Y-05**: Arama ARIA'sı, çerez banner'ı, 404 etiketi.
7. **CART-04**: Sepette katalog fiyat doğrulaması.
8. **PRIV-03**: Granüler rıza + footer "Çerez Tercihleri".

### Faz 3 — Mimari sadeleştirme ve UX tutarlılığı
1. **QA-07 + QA-01 + QA-03**: `lib/pricing.js`, `lib/format.js`; kart/grid tekilleştirmesi.
2. **QA-02 + QA-04 + QA-05 + QA-06**: Ölü bileşen, yinelenen JSDoc, sabit marka/domain temizliği.
3. **UX-01**: Sıralama/filtrelemenin katalog geneline uygulanması (statik kombinasyon veya client-side tam liste). *(En yüksek eforlu UX işi.)*
4. **UX-02 + UX-03 + UX-04**: CTA tutarlılığı ve güven rozeti doğruluğu.
5. **DATA-06**: Redirect tek kaynak.
6. **LEGAL-04 + LEGAL-05 + LEGAL-06 + LEGAL-07 + LEGAL-08**: Yasal metin tutarlılığı ve iletişim formu.

### Faz 4 — Derin iyileştirmeler
1. **CART-02**: Çok satırlı sepet → Shopier akışı (API/checkout modeli araştırması gerekir).
2. **PRIV-04 + PRIV-05**: Webhook imza doğrulaması; OAuth token saklama ve `start` route'u.
3. **PERF-02 + PERF-03 + PERF-05 + PERF-06**: Thumbnail üretimi, self-host font, CSP, hidrasyon payload küçültme.
4. **QA-08**: `astro check` + JSDoc typedef'leri, CI'a tür kontrolü.
5. **SEO-06 + SEO-09 + SEO-10**: SSS/HowTo çeşitlendirme, parametreli URL indeks politikası.
6. **CONF-04 + CONF-05**: Bağımlılık hijyeni, sürüm sabitleme, secret rotasyonu.

---

## 4. Komut Gerektiren Doğrulamalar (Code modunda çalıştırılacak)

> Bu kontroller statik analizle **kesinleştirilemez**; aşağıdaki komutlarla doğrulanmalıdır.

| # | Komut | Beklenen sonuç | Doğruladığı bulgu |
|---|-------|----------------|-------------------|
| 1 | `npm ci --legacy-peer-deps` | Hatasız kurulum; `EBADENGINE` uyarısı çıkmamalı | CONF-01, CONF-04 |
| 2 | `npm run lint` | 0 hata | QA-04, A11Y/A11Y-08 kod kokuları |
| 3 | `npm run build` | `dist/` üretilir; `[build-search-index] N ürün`, `[generate-feed] N ürün` logları | CONF-03, DATA-02, DATA-03 |
| 4 | `node scripts/process-images.mjs` | Yerel WebP'ler tamamlanır; "atlandı/üretildi" sayıları | DATA-01, DATA-02 |
| 5 | `node scripts/check-company-info.mjs` | Şu an yalnız uyarı + `exit 0` → LEGAL-02 doğrulanır | LEGAL-01, LEGAL-02 |
| 6 | `node scripts/test-cart.mjs` | Tüm assert'ler geçer (`0 başarısız`) | CART-04/CART-05 regresyon tabanı |
| 7 | `node scripts/check-broken-links.mjs` | `Kırık: 0` | SEO-07, DATA-01 |
| 8 | `node scripts/qa-audit.mjs` | Kritik: 0; `qa-audit-report.json` üretilir | SEO-01, A11Y-01, PERF-01 (alt/href denetimi) |
| 9 | `node scripts/verify-category-redirects.mjs` | Tüm eski slug'lar 301 hedefiyle eşleşir | DATA-06 |
| 10 | `node scripts/verify-trailing-slash.mjs` | Canonical/iç linkler slash'li | SEO-05 |
| 11 | `git ls-files \| findstr /i ".env"` ve `git status --ignored` | `.env`/`.env.local` **takip edilmiyor** olmalı | CONF-05 |
| 12 | `npm ls lucide-react typescript astro react --depth=0` | Beyan edilen aralıkla uyumlu sürümler | CONF-04 |
| 13 | `npx astro check` | Mevcut hata sayısı baseline olarak kaydedilir | QA-08 |
| 14 | `gh run list --workflow=sync.yml --limit 10` | Son 10 çalışmanın durumu (fail/success) | CONF-02, DATA-03 |
| 15 | `curl -sI https://saprintpro.com/urunler` | `308` değil `200`; `cache-control` ve güvenlik başlıkları | PERF-05, SEO-05 |
| 16 | `npx wrangler deploy --dry-run` | Yapılandırma hatasız; `[assets]` binding doğru | CONF-01, PRIV-04 |

**Not:** 15. ve 16. maddeler canlı ortam/Cloudflare kimlik bilgisi gerektirir; yalnızca yetkili ortamda çalıştırılmalıdır.

---

## 5. Riskler ve Notlar

### 5.1 Uygulama riskleri

- **CART-02 (çok satırlı sepet) tasarım kararı gerektirir.** Shopier'in ürün-bazlı link modeli sepete uymuyor; "tek sipariş linki" veya harici sepet API'si yoksa WhatsApp akışı bilinçli bir tercih olabilir. Bu durumda **UI metinlerinin** (CART-01/CART-03/UX-04) buna göre düzeltilmesi zorunlu; aksi halde "kartla ödeme" vaadi karşılıksız kalır.
- **PRIV-01 bir hukuk/ürün kararıdır.** GA4'ü tamamen rıza sonrasına almak ölçüm hacmini ciddi düşürür. Alternatif (Consent Mode cookieless ölçüm + metin düzeltmesi) daha az veri kaybı yaratır; ancak metnin teknik gerçeğe uyması şart.
- **UX-01 (global sıralama) statik sayfa sayısını çarpar.** `sort × inStock × brand × page` kombinasyonları build süresini ve `dist` boyutunu büyütür. Önce ölçüm yapılmalı (build süresi, sayfa sayısı).
- **LEGAL-01 verisi işletme sahibinden gelmeli.** Vergi/MERSİS/adres bilgisi uydurulmamalı; hukuki metinlerin son hali için uzman onayı gerekir.
- **DATA-01 düzeltmesi davranış değiştirir.** Global hack kaldırıldığında, yerel görseli olmayan ürünler CDN'e dönecek; `toClientProduct` filtresi bu ürünlerin `images` dizisini boşaltacağı için kartlarda "Görsel yok" placeholder'ı görünebilir. Önce `process-images` tamamlanmalı.
- **Feed değişiklikleri (SEO-03) Merchant Center'da yeniden inceleme tetikler.** Birkaç gün "pending/limited" durum beklenmelidir; bu süre içinde reklam harcaması optimize edilmemeli.

### 5.2 Genel notlar

- **Bu rapor komut çalıştırmadan üretildi.** 71 bulgunun tamamı dosya içeriği + çapraz referansla kanıtlanmıştır; ancak satır numaraları kaynak dosyaların bu rapordaki hâline aittir. Kod değişikliği sonrası satırlar kayar.
- **`docs/DURUM-VE-YAPILACAKLAR.md` iyi bir baseline sağlıyor** ve bazı bulguları zaten "bekleyen iş" olarak işaretliyor (Shopier onayı, `shopier.json`, webhook imzası). Bu raporun katkısı: aynı konuların **kod kanıtıyla** ve etki/öncelik sıralamasıyla birleştirilmesi + dokümanda listelenmeyen 40+ yeni bulgu (GA4 fiyat=0, canonical polluted, feed gtin eksik, CLS, duplicate ARIA id, CI Node 20 vb.).
- **`README.md` üç noktada gerçekle çelişiyor** (Node 20 LTS, "görseller indirilmez / CDN kullanılır", "GA4 onay sonrası enjekte edilir"). Kod düzeltmeleriyle birlikte README güncellenmeli; aksi halde yeni geliştirici yanlış varsayımla çalışır.
- **Ölçümleme bütünlüğü riski:** `purchase` olayı herhangi bir ziyarette sepet doluysa tetiklenebiliyor (AN-02) ve `view_item` fiyatı 0 gidiyor (AN-01). İkisi birlikte GA4 gelir raporlarını sistematik olarak bozar; düşük eforla düzeltilebildikleri için Faz 1 kapsamına alınmıştır.
- **Kapsam dışı bırakılanlar:** Görsel tasarım zevki, marka dili/ton, hukuki metinlerin içerik doğruluğunun avukat onayı, Trendyol API'nin canlı yanıt şeması. Bunlar bu denetimin kanıt standardına uymadığı için bulgu olarak yazılmadı.
