import productsData from '../data/products.json'
import { featuredSlugs } from '../config/featured.js'

/**
 * Normalizes a string for Turkish-aware, case-insensitive comparison.
 * @param {string} str
 * @returns {string}
 */
function normalizeTr(str) {
  return str
    .replace(/[İI]/g, 'i')
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
