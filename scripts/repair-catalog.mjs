#!/usr/bin/env node
/**
 * Katalog onarım script'i — "sticker" → "SA Printpro" yanlış değişimini geri alır.
 *
 * SORUN: `COMPETITOR_BRANDS` listesindeki çıplak `'sticker'` kelimesi, ürün
 * başlıklarındaki meşru "sticker" kelimesini "SA Printpro" ile değiştirmişti.
 * Bu, 191+ ürünün başlığını bozdu ve SEO'da aranan kelimeyi sildi.
 *
 * ÇÖZÜM: Temiz referans katalogdan (`--clean=<path>`) yalnızca BOZULMUŞ metin
 * alanlarını geri yükler. Bozulma tespiti: mevcut değer "SA Printpro" içeriyor
 * AMA temiz değer içermiyorsa, alan bozulmuş kabul edilir ve temiz değer
 * yazılır. Diğer tüm alanlar (fiyat, stok, kategori, görsel) DOKUNULMADAN kalır.
 *
 * Kullanım:
 *   node scripts/repair-catalog.mjs --clean=.logo-backup/products-clean.json
 *   node scripts/repair-catalog.mjs --clean=... --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const CATALOG_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'products.json')

/** Bozulma işareti: yanlışlıkla enjekte edilen marka adı. */
const CORRUPTION_MARKER = 'SA Printpro'

/**
 * `--clean=<path>` parametresini ayrıştırır.
 * @returns {string|null}
 */
function parseCleanPath() {
  const arg = process.argv.find((value) => value.startsWith('--clean='))
  if (!arg) {
    return null
  }
  const value = arg.slice('--clean='.length).trim()
  return value === '' ? null : path.resolve(PROJECT_ROOT, value)
}

/** `--dry-run` bayrağı. */
const DRY_RUN = process.argv.includes('--dry-run')

/**
 * Bir metin alanının bozulup bozulmadığını belirler.
 *
 * Bozuk sayılma koşulu: mevcut değer `SA Printpro` içeriyor, temiz değer
 * içermiyor ve iki değer farklı. Bu, meşru "SA Printpro" kullanımlarını
 * (ör. marka alanı zaten SA Printpro olan ürünler) korur.
 *
 * @param {string} current
 * @param {string} clean
 * @returns {boolean}
 */
function isCorrupted(current, clean) {
  if (typeof current !== 'string' || typeof clean !== 'string') {
    return false
  }
  if (current === clean) {
    return false
  }
  return current.includes(CORRUPTION_MARKER) && !clean.includes(CORRUPTION_MARKER)
}

const stats = {
  name: 0,
  brand: 0,
  description: 0,
  attributes: 0,
  sku: 0,
}

/**
 * Bir ürünün metin alanlarını temiz referanstan onarır.
 * @param {object} current
 * @param {object} clean
 */
function repairProduct(current, clean) {
  if (isCorrupted(current.name, clean.name)) {
    current.name = clean.name
    stats.name += 1
  }

  if (isCorrupted(current.brand, clean.brand)) {
    current.brand = clean.brand
    stats.brand += 1
  }

  if (isCorrupted(current.descriptionHtml, clean.descriptionHtml)) {
    current.descriptionHtml = clean.descriptionHtml
    stats.description += 1
  }

  // Varyant SKU ve özellikleri.
  const currentVariants = Array.isArray(current.variants) ? current.variants : []
  const cleanVariants = Array.isArray(clean.variants) ? clean.variants : []

  for (let i = 0; i < currentVariants.length; i += 1) {
    const cv = currentVariants[i]
    const clv = cleanVariants[i]
    if (!cv || !clv) {
      continue
    }

    if (isCorrupted(cv.sku, clv.sku)) {
      cv.sku = clv.sku
      stats.sku += 1
    }

    if (cv.attributes && clv.attributes) {
      for (const key of Object.keys(cv.attributes)) {
        if (isCorrupted(cv.attributes[key], clv.attributes[key])) {
          cv.attributes[key] = clv.attributes[key]
          stats.attributes += 1
        }
      }
    }
  }
}

function main() {
  const cleanPath = parseCleanPath()

  if (!cleanPath) {
    console.error(
      '[hata] Temiz referans katalog gerekli. Kullanım: --clean=<path>'
    )
    process.exit(1)
  }

  if (!fs.existsSync(cleanPath)) {
    console.error(`[hata] Temiz katalog bulunamadı: ${cleanPath}`)
    process.exit(1)
  }

  const currentCatalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  const cleanCatalog = JSON.parse(fs.readFileSync(cleanPath, 'utf8'))

  const currentProducts = Array.isArray(currentCatalog?.products)
    ? currentCatalog.products
    : []
  const cleanProducts = Array.isArray(cleanCatalog?.products)
    ? cleanCatalog.products
    : []

  const cleanById = new Map(cleanProducts.map((p) => [String(p.id), p]))

  let missing = 0

  for (const product of currentProducts) {
    const clean = cleanById.get(String(product.id))
    if (!clean) {
      missing += 1
      continue
    }
    repairProduct(product, clean)
  }

  const total =
    stats.name + stats.brand + stats.description + stats.attributes + stats.sku

  if (!DRY_RUN) {
    fs.writeFileSync(
      CATALOG_FILE,
      JSON.stringify(currentCatalog, null, 2) + '\n',
      'utf8'
    )
  }

  console.log(
    `[repair-catalog] ${DRY_RUN ? '(dry-run) ' : ''}Onarım tamamlandı.`
  )
  console.log(`  Ürün adı        : ${stats.name}`)
  console.log(`  Marka           : ${stats.brand}`)
  console.log(`  Açıklama        : ${stats.description}`)
  console.log(`  Varyant özelliği: ${stats.attributes}`)
  console.log(`  SKU             : ${stats.sku}`)
  console.log(`  TOPLAM          : ${total} alan onarıldı.`)
  if (missing > 0) {
    console.log(`  UYARI           : ${missing} ürün temiz referansta bulunamadı.`)
  }
}

main()
