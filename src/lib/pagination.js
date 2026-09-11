/**
 * FAZ B — B4: Statik sayfalama yardımcıları.
 *
 * Astro `output: 'static'` ile path-based sayfalama üretirken sayfa sayısını,
 * dilimlemeyi ve canonical/prev/next URL'lerini tek bir yerden hesaplamak için
 * kullanılır. Böylece `/urunler`, `/kategori/{slug}` ve `/marka/{slug}`
 * sayfaları aynı mantığı paylaşır.
 */

/** Bir sayfada gösterilecek ürün sayısı. */
export const PAGE_SIZE = 24

/**
 * Toplam ürün sayısına göre toplam sayfa sayısını döndürür.
 * Ürün yoksa bile en az 1 sayfa döner (boş durum sayfası).
 *
 * @param {number} totalItems
 * @param {number} [pageSize]
 * @returns {number}
 */
export function getTotalPages(totalItems, pageSize = PAGE_SIZE) {
  const total = Number(totalItems) || 0
  const size = Number(pageSize) > 0 ? Number(pageSize) : PAGE_SIZE
  return Math.max(1, Math.ceil(total / size))
}

/**
 * Verilen diziyi sayfa numarasına göre dilimler (1 tabanlı).
 *
 * @template T
 * @param {Array<T>} items
 * @param {number} page 1 tabanlı sayfa numarası
 * @param {number} [pageSize]
 * @returns {Array<T>}
 */
export function paginate(items, page, pageSize = PAGE_SIZE) {
  const list = Array.isArray(items) ? items : []
  const size = Number(pageSize) > 0 ? Number(pageSize) : PAGE_SIZE
  const current = Math.max(1, Number(page) || 1)
  const start = (current - 1) * size
  return list.slice(start, start + size)
}

/**
 * Bir sayfa numarası için path segmentini üretir.
 * Sayfa 1 → '' (parametresiz URL), sayfa N → 'N'.
 *
 * @param {number} page
 * @returns {string}
 */
export function pageSegment(page) {
  const current = Math.max(1, Number(page) || 1)
  return current === 1 ? '' : String(current)
}

/**
 * Bir sayfa numarası için tam URL üretir.
 * Sayfa 1 → `${basePath}`, sayfa N → `${basePath}/N`.
 *
 * @param {string} basePath Örn. '/urunler' veya '/kategori/jant-serit'
 * @param {number} page
 * @returns {string}
 */
export function pageUrl(basePath, page) {
  const segment = pageSegment(page)
  return segment === '' ? basePath : `${basePath}/${segment}`
}

/**
 * Sayfalama navigasyonu için görünür sayfa numaralarını üretir.
 * Uzun listelerde ilk/son sayfaları ve aktif sayfanın çevresini gösterir,
 * araya `'…'` (ellipsis) yerleştirir.
 *
 * @param {number} current
 * @param {number} total
 * @param {number} [siblings] Aktif sayfanın iki yanında gösterilecek sayfa sayısı
 * @returns {Array<number|'…'>}
 */
export function getPageNumbers(current, total, siblings = 1) {
  const currentPage = Math.max(1, Number(current) || 1)
  const totalPages = Math.max(1, Number(total) || 1)

  // Toplam sayfa sayısı azsa hepsini göster.
  const maxVisible = siblings * 2 + 5
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const left = Math.max(2, currentPage - siblings)
  const right = Math.min(totalPages - 1, currentPage + siblings)

  const pages = [1]
  if (left > 2) {
    pages.push('…')
  }
  for (let page = left; page <= right; page += 1) {
    pages.push(page)
  }
  if (right < totalPages - 1) {
    pages.push('…')
  }
  pages.push(totalPages)

  return pages
}
