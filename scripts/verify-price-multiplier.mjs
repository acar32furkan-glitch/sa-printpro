#!/usr/bin/env node
/**
 * FAZ A — PRICE-02 / PRICE-04: Fiyat çarpanı doğrulayıcı.
 *
 * `src/data/products.json` içindeki vitrin fiyatlarının `basePrice ×
 * priceMultiplier` kuralına uyduğunu ve indirim algısının korunduğunu denetler.
 * CI/build öncesi çalıştırılır; ihlalde `exit 1`.
 *
 * KONTROLLER
 *   1. `pricingVersion` güncel mi?
 *   2. Her varyantta `price === round(basePrice × multiplier)`
 *   3. Her varyantta `salePrice === round(baseSalePrice × multiplier)`
 *   4. `salePrice ≤ price` (satış fiyatı liste fiyatını aşmamalı)
 *   5. `getDirectPrice(salePrice) < salePrice` (web indirimi korunuyor)
 *   6. Web fiyatı ham fiyata göre ARTTI mı? (artış yönü doğru mu)
 *
 * KULLANIM
 *   node scripts/verify-price-multiplier.mjs
 *   node scripts/verify-price-multiplier.mjs --quiet
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRICING_VERSION, pricingConfig, getDirectPrice } from '../src/lib/pricing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const CATALOG_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'products.json')

const QUIET = process.argv.slice(2).includes('--quiet')
const MAX_REPORTED = 25

/** @param {number} value @returns {number} */
function scale(value) {
  return Math.round(Number(value) * pricingConfig.priceMultiplier)
}

function main() {
  if (!fs.existsSync(CATALOG_FILE)) {
    throw new Error(`Katalog bulunamadı: ${path.relative(PROJECT_ROOT, CATALOG_FILE)}`)
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  const products = Array.isArray(catalog.products) ? catalog.products : []

  /** @type {string[]} */
  const errors = []

  if (catalog.pricingVersion !== PRICING_VERSION) {
    errors.push(
      `pricingVersion uyumsuz: dosya="${catalog.pricingVersion ?? '-'}", beklenen="${PRICING_VERSION}". ` +
        'Çalıştır: node scripts/apply-price-multiplier.mjs'
    )
  }

  let variantCount = 0
  let pricelessCount = 0
  let directDiscountOk = 0
  let increaseOk = 0

  for (const product of products) {
    const variants = Array.isArray(product?.variants) ? product.variants : []
    const productName = String(product?.name ?? product?.slug ?? product?.id ?? '?').slice(0, 40)

    for (const variant of variants) {
      variantCount += 1
      const basePrice = Number(variant?.basePrice)
      const baseSalePrice = Number(variant?.baseSalePrice)
      const price = Number(variant?.price)
      const salePrice = Number(variant?.salePrice)
      const label = `${productName} [${variant?.barcode ?? variant?.sku ?? '?'}]`

      // Fiyatsız varyant (Trendyol'da satışta olmayan / 0 fiyatlı) çarpan
      // doğrulamasının kapsamına girmez; veri kalitesi bulgusu olarak ayrı
      // sayılır (DATA-04 / Faz C1).
      if (!Number.isFinite(basePrice) || basePrice <= 0 || !Number.isFinite(baseSalePrice) || baseSalePrice <= 0) {
        pricelessCount += 1
        continue
      }

      const expectedPrice = scale(basePrice)
      const expectedSale = scale(baseSalePrice)

      if (price !== expectedPrice) {
        errors.push(`${label}: price=${price}, beklenen=${expectedPrice} (base ${basePrice} × ${pricingConfig.priceMultiplier})`)
      }
      if (salePrice !== expectedSale) {
        errors.push(`${label}: salePrice=${salePrice}, beklenen=${expectedSale} (base ${baseSalePrice} × ${pricingConfig.priceMultiplier})`)
      }
      if (salePrice > price) {
        errors.push(`${label}: salePrice (${salePrice}) liste fiyatını (${price}) aşıyor`)
      }

      // Web indirimi korunuyor mu?
      const direct = getDirectPrice(salePrice)
      if (direct > 0 && direct < salePrice) {
        directDiscountOk += 1
      } else {
        errors.push(`${label}: web indirimi kayboldu (direct=${direct}, sale=${salePrice})`)
      }

      // Artış yönü: yeni web fiyatı ham web fiyatından düşük olmamalı.
      const baseDirect = getDirectPrice(baseSalePrice)
      if (direct >= baseDirect) {
        increaseOk += 1
      } else {
        errors.push(`${label}: web fiyatı artmadı (ham=${baseDirect}, yeni=${direct})`)
      }
    }
  }

  if (variantCount === 0) {
    errors.push('Katalogda hiç varyant bulunamadı; önce `npm run sync` çalıştırın.')
  }

  if (!QUIET) {
    const pricedCount = variantCount - pricelessCount
    console.log('[verify-price] Fiyat çarpanı doğrulaması')
    console.log(`  sürüm      : ${catalog.pricingVersion ?? '-'} (beklenen ${PRICING_VERSION})`)
    console.log(`  çarpan     : x${pricingConfig.priceMultiplier}`)
    console.log(`  ürün       : ${products.length}`)
    console.log(`  varyant    : ${variantCount}`)
    console.log(`  fiyatlı    : ${pricedCount}`)
    console.log(`  fiyatsız   : ${pricelessCount} (veri kalitesi — DATA-04)`)
    console.log(`  indirim ok : ${directDiscountOk}/${pricedCount}`)
    console.log(`  artış ok   : ${increaseOk}/${pricedCount}`)
  }

  if (errors.length > 0) {
    console.error(`[verify-price] ${errors.length} hata bulundu:`)
    for (const error of errors.slice(0, MAX_REPORTED)) {
      console.error(`  - ${error}`)
    }
    if (errors.length > MAX_REPORTED) {
      console.error(`  ... ve ${errors.length - MAX_REPORTED} hata daha`)
    }
    process.exit(1)
  }

  if (!QUIET) {
    console.log('[verify-price] OK — tüm fiyatlar tutarlı, indirim algısı korunuyor.')
  }
}

try {
  main()
} catch (error) {
  console.error(`[verify-price] HATA: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
