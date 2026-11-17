#!/usr/bin/env node
/**
 * FAZ A — PRICE-02 / PRICE-07: Fiyat çarpanı uygulayıcı (IDEMPOTENT).
 *
 * `src/data/products.json` içindeki varyant fiyatlarını `priceMultiplier` ile
 * ölçekler ve ham Trendyol fiyatlarını `basePrice` / `baseSalePrice` alanlarında
 * saklar.
 *
 * NEDEN SCRIPT: 6.900+ satırlık katalog elle düzenlenemez ve `fetch-trendyol.mjs`
 * her senkronda dosyayı yeniden yazdığı için elle yapılan artış kaybolur.
 *
 * KULLANIM
 *   node scripts/apply-price-multiplier.mjs            → çarpanı uygula
 *   node scripts/apply-price-multiplier.mjs --dry-run  → yalnız raporla
 *   node scripts/apply-price-multiplier.mjs --restore  → basePrice'tan geri al
 *   node scripts/apply-price-multiplier.mjs --force    → sürüm damgasını yok say
 *   node scripts/apply-price-multiplier.mjs --multiplier=1.25
 *
 * GÜVENLİK
 *   - Aynı `pricingVersion` için ikinci kez çalışmaz (çift çarpma / %44 hatası
 *     engellenir).
 *   - `--restore` her zaman `basePrice` alanından döner.
 *   - Yazma atomiktir (tmp + rename).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRICING_VERSION, pricingConfig } from '../src/lib/pricing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const CATALOG_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'products.json')
const TMP_FILE = `${CATALOG_FILE}.tmp`

const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(`--${name}`)
const RESTORE = hasFlag('restore')
const DRY_RUN = hasFlag('dry-run')
const FORCE = hasFlag('force')

const multiplierArg = args.find((arg) => arg.startsWith('--multiplier='))
const MULTIPLIER = multiplierArg ? Number(multiplierArg.split('=')[1]) : pricingConfig.priceMultiplier

/** @param {string} message */
function log(message) {
  console.log(`[apply-price] ${message}`)
}

/**
 * Pozitif sonlu sayı mı?
 * @param {unknown} value
 * @returns {boolean}
 */
function isPositiveNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0
}

function main() {
  if (!Number.isFinite(MULTIPLIER) || MULTIPLIER <= 0) {
    throw new Error(`Geçersiz çarpan: ${MULTIPLIER}`)
  }

  if (!fs.existsSync(CATALOG_FILE)) {
    throw new Error(`Katalog bulunamadı: ${path.relative(PROJECT_ROOT, CATALOG_FILE)}`)
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  const products = Array.isArray(catalog.products) ? catalog.products : []

  if (products.length === 0) {
    throw new Error('Katalogda ürün yok; önce `npm run sync` çalıştırılmalıdır.')
  }

  const currentVersion = catalog.pricingVersion ?? null
  const alreadyApplied = currentVersion === PRICING_VERSION && !RESTORE

  if (alreadyApplied && !FORCE) {
    log(`Sürüm "${PRICING_VERSION}" zaten uygulanmış — değişiklik yapılmadı.`)
    log('Yeniden uygulamak için --force, geri almak için --restore kullanın.')
    return
  }

  let variantCount = 0
  let skippedCount = 0
  /** @type {Array<{name: string, base: number, next: number}>} */
  const samples = []

  for (const product of products) {
    const variants = Array.isArray(product?.variants) ? product.variants : []

    for (const variant of variants) {
      const currentPrice = Number(variant?.price)
      const currentSale = Number(variant?.salePrice)

      // Ham fiyat: daha önce yazılmış `basePrice` varsa o, yoksa mevcut fiyat.
      const basePrice = isPositiveNumber(variant?.basePrice) ? Number(variant.basePrice) : currentPrice
      const baseSalePrice = isPositiveNumber(variant?.baseSalePrice)
        ? Number(variant.baseSalePrice)
        : currentSale

      if (!isPositiveNumber(basePrice) || !isPositiveNumber(baseSalePrice)) {
        skippedCount += 1
        continue
      }

      variant.basePrice = basePrice
      variant.baseSalePrice = baseSalePrice

      if (RESTORE) {
        variant.price = basePrice
        variant.salePrice = baseSalePrice
      } else {
        variant.price = Math.round(basePrice * MULTIPLIER)
        variant.salePrice = Math.round(baseSalePrice * MULTIPLIER)
      }

      variantCount += 1

      if (samples.length < 5) {
        samples.push({
          name: String(product?.name ?? '').slice(0, 48),
          base: baseSalePrice,
          next: variant.salePrice,
        })
      }
    }
  }

  catalog.pricingVersion = RESTORE ? null : PRICING_VERSION
  catalog.priceMultiplier = RESTORE ? 1 : MULTIPLIER
  catalog.pricedAt = new Date().toISOString()

  log(`${products.length} ürün, ${variantCount} varyant işlendi${skippedCount > 0 ? `, ${skippedCount} varyant atlandı` : ''}.`)
  log(`Mod: ${RESTORE ? 'RESTORE (basePrice)' : `MULTIPLY x${MULTIPLIER}`} · Sürüm: ${catalog.pricingVersion ?? '-'}`)

  for (const sample of samples) {
    log(`  örnek: ${sample.base} TL → ${sample.next} TL  (${sample.name})`)
  }

  if (DRY_RUN) {
    log('--dry-run: dosya yazılmadı.')
    return
  }

  fs.writeFileSync(TMP_FILE, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  fs.renameSync(TMP_FILE, CATALOG_FILE)
  log(`Yazıldı: ${path.relative(PROJECT_ROOT, CATALOG_FILE)}`)
}

try {
  main()
} catch (error) {
  log(`HATA: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
