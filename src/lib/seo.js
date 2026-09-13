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
