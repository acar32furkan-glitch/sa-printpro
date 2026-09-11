import productsData from '../data/products.json'
import { featuredSlugs } from '../config/featured.js'
import { siteConfig } from '../config/site.js'

/**
 * Normalizes a string for Turkish-aware, case-insensitive comparison.
 * @param {string} str
 * @returns {string}
 */
function normalizeTr(str) {
  return str
    .replace(/[İIıi]/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
}

/**
 * Returns all products.
 * @returns {Array<object>}
 */
export function getAllProducts() {
  return productsData.products
}

/**
 * Finds a single product by its slug.
 * @param {string} slug
 * @returns {object|undefined}
 */
export function getProductBySlug(slug) {
  return getAllProducts().find((product) => product.slug === slug)
}

/**
 * Builds a de-duplicated, alphabetically sorted category list with product counts.
 * @returns {Array<{id: string, name: string, slug: string, count: number}>}
 */
export function getAllCategories() {
  const map = new Map()

  for (const product of getAllProducts()) {
    const category = product.category
    if (!category) {
      continue
    }

    const existing = map.get(category.id)
    if (existing) {
      existing.count += 1
    } else {
      map.set(category.id, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        count: 1,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

/**
 * Returns all products belonging to the given category slug.
 * @param {string} categorySlug
 * @returns {Array<object>}
 */
export function getProductsByCategory(categorySlug) {
  return getAllProducts().filter(
    (product) => product.category && product.category.slug === categorySlug
  )
}

/**
 * Sums the stock across all variants of a product.
 * @param {object} product
 * @returns {number}
 */
function totalStock(product) {
  if (!Array.isArray(product.variants)) {
    return 0
  }
  return product.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0)
}

/**
 * Returns featured products based on featuredSlugs, falling back to the
 * top 4 products by total stock when no featured matches exist.
 * @returns {Array<object>}
 */
export function getFeaturedProducts() {
  const all = getAllProducts()

  if (Array.isArray(featuredSlugs) && featuredSlugs.length > 0) {
    const featured = featuredSlugs
      .map((slug) => all.find((product) => product.slug === slug))
      .filter(Boolean)

    if (featured.length > 0) {
      return featured
    }
  }

  return [...all].sort((a, b) => totalStock(b) - totalStock(a)).slice(0, 4)
}

/**
 * Turkish-aware, case-insensitive substring search across product name,
 * category name and variant SKUs.
 * @param {Array<object>} products
 * @param {string} query
 * @returns {Array<object>}
 */
export function searchProducts(products, query) {
  const normalizedQuery = normalizeTr(String(query || '').trim())

  if (normalizedQuery === '') {
    return products
  }

  return products.filter((product) => {
    const name = normalizeTr(product.name || '')
    if (name.includes(normalizedQuery)) {
      return true
    }

    const categoryName = normalizeTr((product.category && product.category.name) || '')
    if (categoryName.includes(normalizedQuery)) {
      return true
    }

    if (Array.isArray(product.variants)) {
      return product.variants.some((variant) =>
        normalizeTr(variant.sku || '').includes(normalizedQuery)
      )
    }

    return false
  })
}

/**
 * Builds a Trendyol product URL for the given product/variant.
 *
 * Priority 1: a direct product deep link when the product exposes an `id`
 * (or `contentId`). Priority 2 (fallback): a seller-scoped search URL keyed
 * on the variant barcode, or the product name when no barcode exists.
 *
 * Every returned URL carries the configured UTM parameters so outbound
 * traffic is always attributable to the showcase.
 *
 * @param {object} product
 * @param {object} [variant]
 * @returns {string}
 */
export function getTrendyolProductUrl(product, variant) {
  const trendyol = siteConfig.trendyol || {}
  const sellerId = String(trendyol.sellerId || '')
  const utmParams = String(trendyol.utmParams || '')

  const contentId = product?.contentId || product?.id

  // `utmParams` is authored with a leading "?" so it can be appended to any
  // base URL; when a query string already exists we swap it for "&".
  const utmSuffix = utmParams.startsWith('?')
    ? `&${utmParams.slice(1)}`
    : utmParams

  if (contentId) {
    const brand = String(product?.brand || 'sa-printpro')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
    const slug = String(product?.slug || product?.name || 'urun')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    return `https://www.trendyol.com/${brand}/${slug}-p-${contentId}?merchantId=${sellerId}${utmSuffix}`
  }

  const query = variant?.barcode || product?.name || ''
  return `https://www.trendyol.com/sr?mid=${sellerId}&q=${encodeURIComponent(
    query
  )}${utmSuffix}`
}

/**
 * Calculates the web-exclusive direct-sale price for a given list price.
 *
 * Applies the configured `directDiscountRate` and then rounds to a value whose
 * last digit is always 5 (e.g. 199 -> 155, 120 -> 95). A floor of 5 TL keeps
 * the result sane for very cheap items.
 *
 * @param {number} price
 * @returns {number}
 */
export function calculateDirectPrice(price) {
  const numeric = Number(price)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }

  const rate = Number(siteConfig.features?.directDiscountRate)
  const safeRate = Number.isFinite(rate) ? rate : 0
  const raw = numeric * (1 - safeRate)

  return Math.max(5, Math.round((raw - 5) / 10) * 10 + 5)
}

/**
 * Detects the motorcycle brand of a product by scanning its name and variant
 * attribute values against the configured `motorcycleBrands` keyword lists.
 *
 * The first brand (in config order) with a matching keyword wins; when nothing
 * matches, the `universal` brand is returned as the fallback.
 *
 * @param {object} product
 * @returns {{name: string, slug: string, keywords: Array<string>}}
 */
export function detectProductBrand(product) {
  const brands = Array.isArray(siteConfig.motorcycleBrands)
    ? siteConfig.motorcycleBrands
    : []
  const fallback =
    brands.find((brand) => brand.slug === 'universal') || {
      name: 'Universal / Genel',
      slug: 'universal',
      keywords: ['universal', 'genel'],
    }

  if (!product) {
    return fallback
  }

  // Build a single normalized haystack from the product name plus every
  // attribute value across all variants.
  const parts = [product.name || '']

  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      const attributes = variant?.attributes
      if (attributes && typeof attributes === 'object') {
        for (const value of Object.values(attributes)) {
          if (value !== null && value !== undefined) {
            parts.push(String(value))
          }
        }
      }
    }
  }

  const haystack = normalizeTr(parts.join(' '))

  for (const brand of brands) {
    if (brand.slug === 'universal') {
      continue
    }
    const keywords = Array.isArray(brand.keywords) ? brand.keywords : []
    const matched = keywords.some((keyword) =>
      haystack.includes(normalizeTr(String(keyword)))
    )
    if (matched) {
      return brand
    }
  }

  return fallback
}

/**
 * Builds the list of motorcycle brands that actually have products, each with
 * its product count. Brands with zero products are filtered out.
 *
 * @returns {Array<{name: string, slug: string, count: number}>}
 */
export function getAllBrandsWithCounts() {
  const brands = Array.isArray(siteConfig.motorcycleBrands)
    ? siteConfig.motorcycleBrands
    : []
  const counts = new Map()

  for (const product of getAllProducts()) {
    const brand = detectProductBrand(product)
    counts.set(brand.slug, (counts.get(brand.slug) || 0) + 1)
  }

  return brands
    .map((brand) => ({
      name: brand.name,
      slug: brand.slug,
      count: counts.get(brand.slug) || 0,
    }))
    .filter((brand) => brand.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'))
}

/**
 * Returns all products belonging to the given motorcycle brand slug.
 *
 * @param {string} brandSlug
 * @returns {Array<object>}
 */
export function getProductsByBrand(brandSlug) {
  if (!brandSlug) {
    return getAllProducts()
  }
  return getAllProducts().filter(
    (product) => detectProductBrand(product).slug === brandSlug
  )
}

/**
 * Finds a single motorcycle brand definition by its slug.
 *
 * @param {string} slug
 * @returns {{name: string, slug: string, keywords: Array<string>}|undefined}
 */
export function getBrandBySlug(slug) {
  const brands = Array.isArray(siteConfig.motorcycleBrands)
    ? siteConfig.motorcycleBrands
    : []
  return brands.find((brand) => brand.slug === slug)
}

/**
 * Computes the discount rate (0..1) of a product from its cheapest variant.
 * A positive `salePrice` below `price` yields the reduction; otherwise 0.
 *
 * @param {object} product
 * @returns {number}
 */
function discountRate(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  let best = 0

  for (const variant of variants) {
    const list = Number(variant?.price)
    const sale = Number(variant?.salePrice)
    if (!Number.isFinite(list) || list <= 0) {
      continue
    }
    if (!Number.isFinite(sale) || sale <= 0 || sale >= list) {
      continue
    }
    const rate = (list - sale) / list
    if (rate > best) {
      best = rate
    }
  }

  return best
}

/**
 * Smart ranking score used to surface the most attractive products first.
 *
 * Formula:
 *   (totalStock * 0.2) + (discountRate * 1.5) + (images.length * 5)
 *   - (totalStock === 0 ? 10000 : 0)
 *
 * Out-of-stock products are pushed to the bottom via the large penalty.
 *
 * @param {object} product
 * @returns {number}
 */
export function calculateProductScore(product) {
  if (!product) {
    return 0
  }

  const stock = totalStock(product)
  const discount = discountRate(product)
  const images = Array.isArray(product.images) ? product.images.length : 0

  return (
    stock * 0.2 +
    discount * 1.5 +
    images * 5 -
    (stock === 0 ? 10000 : 0)
  )
}

/**
 * Returns a new array of products sorted by descending smart score.
 * The input array is never mutated.
 *
 * @param {Array<object>} products
 * @returns {Array<object>}
 */
export function getSortedProducts(products) {
  const list = Array.isArray(products) ? products : getAllProducts()
  return [...list].sort(
    (a, b) => calculateProductScore(b) - calculateProductScore(a)
  )
}
