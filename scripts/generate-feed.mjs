/**
 * Google Merchant Center XML feed generator.
 *
 * Reads the normalized catalog (`src/data/products.json`) and emits a
 * standards-compliant RSS 2.0 feed with the Google Merchant `g:` namespace to
 * `public/google-merchant.xml`. No external dependency or paid plugin needed.
 *
 * Run automatically as part of `npm run build` (see package.json).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const SOURCE_FILE = resolve(rootDir, 'src/data/products.json')
const OUTPUT_FILE = resolve(rootDir, 'public/google-merchant.xml')

const SITE_URL = 'https://saprintpro.com'
const BRAND = 'SA Printpro'
const CURRENCY = 'TRY'

/**
 * Escapes a string for safe inclusion in XML text/attribute nodes.
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
    .replace(/'/g, '\u0026apos;')
}

/**
 * Strips HTML tags and decodes the most common entities so the feed carries
 * plain text (Google rejects raw markup in `g:description`).
 * @param {unknown} value
 * @returns {string}
 */
function toPlainText(value) {
  const amp = '\u0026'
  const named = {
    [`${amp}nbsp;`]: ' ',
    [`${amp}amp;`]: '\u0026',
    [`${amp}quot;`]: '"',
    [`${amp}#39;`]: "'",
    [`${amp}apos;`]: "'",
    [`${amp}lt;`]: '<',
    [`${amp}gt;`]: '>',
    [`${amp}hellip;`]: '\u2026',
    [`${amp}mdash;`]: '\u2014',
    [`${amp}ndash;`]: '\u2013',
    [`${amp}rsquo;`]: '\u2019',
    [`${amp}lsquo;`]: '\u2018',
    [`${amp}rdquo;`]: '\u201D',
    [`${amp}ldquo;`]: '\u201C',
    [`${amp}deg;`]: '\u00B0',
    [`${amp}times;`]: '\u00D7',
    [`${amp}euro;`]: '\u20AC',
    [`${amp}trade;`]: '\u2122',
    [`${amp}reg;`]: '\u00AE',
    [`${amp}copy;`]: '\u00A9',
  }

  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;/gi, (entity) => named[entity.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

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
 * Sums the stock across all variants of a product.
 * @param {object} product
 * @returns {number}
 */
function totalStock(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  return variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0)
}

/**
 * Picks the cheapest available price for a product.
 * @param {object} product
 * @returns {number|null}
 */
function cheapestPrice(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  let cheapest = null
  for (const variant of variants) {
    const value = effectivePrice(variant)
    if (value === null) {
      continue
    }
    if (cheapest === null || value < cheapest) {
      cheapest = value
    }
  }
  return cheapest
}

/**
 * Builds a single `<item>` block for a product.
 * @param {object} product
 * @returns {string|null}
 */
function buildItem(product) {
  const slug = product?.slug
  const price = cheapestPrice(product)

  // Google Merchant Center, herkese açık MUTLAK görsel URL'i ister. Ürün
  // görselleri yerelleştirildiği için (`/uploads/products/{id}.webp`) feed'de
  // site alan adıyla birleştirilmiş yerel URL kullanılır; Trendyol CDN'ine
  // bağımlılık kalmaz.
  const image = product?.id ? `${SITE_URL}/uploads/products/${product.id}.webp` : null

  // Google requires a link, an image and a price — skip incomplete records.
  if (!slug || price === null || !image) {
    return null
  }

  const variants = Array.isArray(product?.variants) ? product.variants : []
  const firstVariant = variants[0] || {}
  const id = firstVariant.barcode || firstVariant.sku || String(product.id || slug)
  const link = `${SITE_URL}/urun/${slug}`
  const availability = totalStock(product) > 0 ? 'in_stock' : 'out_of_stock'

  const title = toPlainText(product.name)
  const description =
    toPlainText(product.descriptionHtml) || `${title} — ${BRAND}`

  return [
    '    <item>',
    `      <g:id>${escapeXml(id)}</g:id>`,
    `      <g:title>${escapeXml(title)}</g:title>`,
    `      <g:description>${escapeXml(description)}</g:description>`,
    `      <g:link>${escapeXml(link)}</g:link>`,
    `      <g:image_link>${escapeXml(image)}</g:image_link>`,
    `      <g:availability>${availability}</g:availability>`,
    `      <g:price>${price} ${CURRENCY}</g:price>`,
    `      <g:brand>${escapeXml(BRAND)}</g:brand>`,
    '      <g:condition>new</g:condition>',
    '    </item>',
  ].join('\n')
}

async function main() {
  const raw = await readFile(SOURCE_FILE, 'utf8')
  const data = JSON.parse(raw)
  const products = Array.isArray(data?.products) ? data.products : []

  const items = products.map(buildItem).filter(Boolean)

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    `    <title>${escapeXml(BRAND)}</title>`,
    `    <link>${SITE_URL}</link>`,
    `    <description>${escapeXml(
      `${BRAND} — reflektif sticker ve güvenlik etiketi ürünleri.`
    )}</description>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')

  await mkdir(dirname(OUTPUT_FILE), { recursive: true })
  await writeFile(OUTPUT_FILE, xml, 'utf8')

  const sizeKb = (Buffer.byteLength(xml) / 1024).toFixed(1)
  console.log(
    `[generate-feed] ${items.length} ürün → public/google-merchant.xml (${sizeKb} KB)`
  )
}

main().catch((error) => {
  console.error('[generate-feed] Hata:', error)
  process.exitCode = 1
})
