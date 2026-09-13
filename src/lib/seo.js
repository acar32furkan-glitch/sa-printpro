/**
 * SEO yardımcıları — kanonik URL üretimi.
 *
 * KÖK SORUN: Cloudflare statik sunucu, uzantısız ve sonu `/` ile bitmeyen
 * yolları sonuna `/` ekleyerek 308 (kalıcı) yönlendirir. Astro tarafında
 * canonical URL'ler slash'siz üretildiğinde, sayfanın gerçek adresi
 * (`/urun/x/`) ile canonical (`/urun/x`) uyuşmuyordu. Bu durum arama
 * motorlarında iki ayrı sorun üretiyordu:
 *
 *   - 162 URL "Redirected" (slash'siz → slash'li 308)
 *   - 136 URL "Canonicalised" (slash'li sayfa, slash'siz canonical gösteriyor)
 *
 * `buildCanonical()` tüm canonical üretimini tek bir yerden yönetir ve
 * sondaki slash'i garanti eder; böylece canonical her zaman gerçek,
 * yönlendirilmeyen URL ile birebir eşleşir.
 */

import { siteConfig } from '../config/site.js'

/**
 * Verilen yol için site genelinde tutarlı, slash'li bir kanonik URL üretir.
 *
 * Kurallar:
 * - Dosya uzantısı olan yollar (ör. `.html`, `.xml`, `.txt`, `.png`) olduğu
 *   gibi bırakılır; bunlara slash EKLENMEZ (aksi halde 404 olur).
 * - Kök yol (`/`) her zaman `${domain}/` döner.
 * - Diğer tüm yollar sondaki slash ile garanti edilir.
 *
 * @param {string} path Örn. `/urun/pcx-jant-seridi`, `urunler/2`, `/`
 * @returns {string} Örn. `https://saprintpro.com/urun/pcx-jant-seridi/`
 */
export function buildCanonical(path) {
  const base = siteConfig.domain.replace(/\/$/, '')
  const raw = typeof path === 'string' && path.length > 0 ? path : '/'
  const p = raw.startsWith('/') ? raw : `/${raw}`

  // Dosya uzantısı varsa (ör. .html, .xml, .txt) slash ekleme.
  if (/\.[a-z0-9]+$/i.test(p)) return `${base}${p}`

  // Kök yol.
  if (p === '/') return `${base}/`

  // Sondaki slash'i garanti et.
  return `${base}${p.replace(/\/$/, '')}/`
}

/**
 * Ürün detay sayfası için site-içi (relative) URL üretir.
 * @param {string} slug Ürün slug'ı
 * @returns {string} Örn. `/urun/pcx-jant-seridi/`
 */
export function productUrl(slug) {
  return `/urun/${slug}/`
}

/**
 * Kategori sayfası için site-içi URL üretir.
 * @param {string} slug Kategori slug'ı
 * @param {number} [page=1] Sayfa numarası (1 ise eklenmez)
 * @returns {string} Örn. `/kategori/jant/` veya `/kategori/jant/2/`
 */
export function categoryUrl(slug, page = 1) {
  return page > 1 ? `/kategori/${slug}/${page}/` : `/kategori/${slug}/`
}

/**
 * Marka sayfası için site-içi URL üretir.
 * @param {string} slug Marka slug'ı
 * @param {number} [page=1] Sayfa numarası (1 ise eklenmez)
 * @returns {string} Örn. `/marka/pcx/` veya `/marka/pcx/2/`
 */
export function brandUrl(slug, page = 1) {
  return page > 1 ? `/marka/${slug}/${page}/` : `/marka/${slug}/`
}

/**
 * Statik sayfa yolları için sondaki slash'i garanti eden yardımcı.
 * Dosya uzantılı yollar (ör. `.html`, `.xml`, `.txt`, `.png`) olduğu gibi
 * bırakılır; hash (`#...`) ve query (`?...`) kısımları korunur.
 * @param {string} path Örn. `sepet`, `/hakkimizda`, `/robots.txt`, `/urunler#liste`
 * @returns {string} Örn. `/sepet/`, `/hakkimizda/`, `/robots.txt`, `/urunler/#liste`
 */
export function staticUrl(path) {
  const raw = typeof path === 'string' && path.length > 0 ? path : '/'

  // Hash ve query kısımlarını ayır; yalnızca yol kısmına slash eklenir.
  const match = raw.match(/^([^?#]*)([?#].*)?$/)
  const pathname = match && match[1] ? match[1] : raw
  const suffix = match && match[2] ? match[2] : ''

  const p = pathname.startsWith('/') ? pathname : `/${pathname}`

  // Dosya uzantılı yollar (ör. .html, .xml, .txt, .png) slash almaz.
  if (/\.[a-z0-9]+$/i.test(p)) return `${p}${suffix}`

  // Kök yol.
  if (p === '/') return `/${suffix}`

  // Sondaki slash'i garanti et.
  return `${p.replace(/\/$/, '')}/${suffix}`
}

/**
 * Google SERP'te başlıklar ~580 pikselde (yaklaşık 60 karakter) kesilir.
 * Bu sabit, kesme eşiği olarak kullanılan karakter sınırıdır.
 */
export const TITLE_MAX_LENGTH = 60

/**
 * Bir başlığı, kelime ortasında kesmeden `maxLength` karaktere indirir.
 *
 * Kırpma yapıldığında sona `…` (tek karakter) eklenir; böylece nihai uzunluk
 * `maxLength` değerini AŞMAZ. Kırpma noktası son boşlukta aranır; eğer son
 * boşluk çok geride kalıyorsa (tek uzun kelime) sert kesim uygulanır.
 *
 * @param {string} text
 * @param {number} [maxLength]
 * @returns {string}
 */
export function truncateTitle(text, maxLength = TITLE_MAX_LENGTH) {
  const value = String(text || '').trim()
  if (value.length <= maxLength) {
    return value
  }

  // `…` için bir karakter ayır.
  const budget = Math.max(1, maxLength - 1)
  const sliced = value.slice(0, budget)
  const lastSpace = sliced.lastIndexOf(' ')

  // Son boşluk, bütçenin en az %60'ından sonra ise oradan kırp; aksi halde
  // (tek uzun kelime) sert kesim yap.
  const cut = lastSpace > budget * 0.6 ? sliced.slice(0, lastSpace) : sliced

  return `${cut.trimEnd()}…`
}

/**
 * Bir başlık parçasını, verilen sonekleri de hesaba katarak kısaltır.
 *
 * Ürün sayfalarında başlık `<Ürün Adı> Modelleri ve Fiyatı | SA Printpro`
 * biçimindedir. `Seo.astro` soneki otomatik eklediği için, kırpma kararı
 * verilirken sonek uzunluğu da bütçeden düşülür; böylece nihai `<title>`
 * SERP sınırını aşmaz.
 *
 * @param {string} text Kısaltılacak ana başlık (sonek hariç)
 * @param {string[]} [suffixes] Eklenecek sonekler (ör. ['| SA Printpro'])
 * @param {number} [maxLength]
 * @returns {string}
 */
export function truncateTitleWithSuffixes(
  text,
  suffixes = [],
  maxLength = TITLE_MAX_LENGTH
) {
  const suffixLength = suffixes.reduce((sum, s) => sum + String(s || '').length, 0)
  const budget = Math.max(20, maxLength - suffixLength)
  return truncateTitle(text, budget)
}

/**
 * Kısaltma sonrası başlıkların BENZERSİZ kalmasını sağlayan yardımcı.
 *
 * KÖK SORUN: Uzun ürün adları 60 karaktere kırpıldığında, aynı önekle
 * başlayan farklı ürünler (ör. renk varyantları) AYNI `<title>` değerini
 * üretiyordu. Bu, arama motorlarında yinelenen başlık sinyali yaratır.
 *
 * ÇÖZÜM: Kırpma yapıldıysa ve başlık başka bir sayfayla çakışıyorsa,
 * ayırt edici bir son ek (`(Ürün Kodu)`) başlığa eklenir. Böylece hem SERP
 * sınırı korunur hem de her sayfa benzersiz kalır.
 *
 * @param {string} text Kısaltılacak ana başlık (sonek hariç)
 * @param {string} discriminator Benzersizleştirici değer (ör. ürün kodu)
 * @param {string[]} [suffixes] Eklenecek sonekler (ör. ['| SA Printpro'])
 * @param {number} [maxLength]
 * @returns {string}
 */
export function truncateTitleUnique(
  text,
  discriminator,
  suffixes = [],
  maxLength = TITLE_MAX_LENGTH
) {
  const suffixLength = suffixes.reduce((sum, s) => sum + String(s || '').length, 0)
  const budget = Math.max(20, maxLength - suffixLength)
  const value = String(text || '').trim()

  // Kırpma gerekmiyorsa başlık zaten benzersizdir (ürün adları farklı).
  if (value.length <= budget) {
    return value
  }

  // Ayırt edici son eki (` (123456)`) bütçeye sığdırarak kırp.
  const tag = discriminator ? ` (${discriminator})` : ''
  const baseBudget = Math.max(10, budget - tag.length)
  return `${truncateTitle(value, baseBudget)}${tag}`
}
