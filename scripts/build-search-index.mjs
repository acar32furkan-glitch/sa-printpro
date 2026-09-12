/**
 * Builds a slim, client-consumable search index from the full product catalog.
 *
 * The full `src/data/products.json` payload is large (variants, attributes,
 * descriptions, all images). Shipping it inside the SearchBar island bundle
 * bloats every page. Instead we emit a compact `public/search-index.json`
 * containing only the fields the dropdown needs, which the island fetches
 * lazily on first focus.
 *
 * Run automatically as part of `npm run build` (see package.json).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const SOURCE_FILE = resolve(rootDir, 'src/data/products.json')
const OUTPUT_FILE = resolve(rootDir, 'public/search-index.json')

/**
 * Returns the effective selling price for a variant: a positive `salePrice`
 * wins, otherwise a positive `price`, otherwise `null`.
 * @param {object} variant
 * @returns {number|null}
 */
function effectivePrice(variant) {
  const sale = Number(variant?.salePrice)
  if (Number.isFinite(sale) && sale > 0) {
    return sale
  }
  const base = Number(variant?.price)
  return Number.isFinite(base) && base > 0 ? base : null
}

/**
 * Derives the cheapest available price plus the highest list price for a
 * product, used to render the "from X TL" label and discount hints.
 * @param {object} product
 * @returns {{price: number|null, salePrice: number|null}}
 */
function resolvePrices(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []

  let cheapest = null
  let highest = null

  for (const variant of variants) {
    const value = effectivePrice(variant)
    if (value === null) {
      continue
    }
    if (cheapest === null || value < cheapest) {
      cheapest = value
    }
    if (highest === null || value > highest) {
      highest = value
    }
  }

  return { price: highest, salePrice: cheapest }
}

/**
 * Picks the primary barcode/SKU for a product.
 * @param {object} product
 * @returns {string}
 */
function resolveBarcode(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const first = variants[0]
  return first?.barcode || first?.sku || String(product?.id || '')
}

async function main() {
  const raw = await readFile(SOURCE_FILE, 'utf8')
  const data = JSON.parse(raw)
  const products = Array.isArray(data?.products) ? data.products : []

  const index = products.map((product) => {
    const { price, salePrice } = resolvePrices(product)

    // Yerelleştirilmiş görsel yolu: `process-images.mjs` her ürünün ilk
    // görselini `/uploads/products/{id}.webp` olarak üretir. Ham Trendyol CDN
    // URL'i arama indeksine sızmasın diye yerel yol tercih edilir.
    const localImage = product?.id ? `/uploads/products/${product.id}.webp` : null

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product?.category?.name || '',
      barcode: resolveBarcode(product),
      image: localImage,
      price,
      salePrice,
    }
  })

  await mkdir(dirname(OUTPUT_FILE), { recursive: true })
  await writeFile(OUTPUT_FILE, JSON.stringify(index), 'utf8')

  const sizeKb = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1)
  console.log(
    `[build-search-index] ${index.length} ürün → public/search-index.json (${sizeKb} KB)`
  )
}

main().catch((error) => {
  console.error('[build-search-index] Hata:', error)
  process.exitCode = 1
})
