#!/usr/bin/env node
/**
 * FAZ C1 — DATA-03: Katalog tazelik denetimi.
 *
 * `src/data/products.json` içindeki `generatedAt` alanı `MAX_AGE_DAYS` günden
 * eskiyse uyarır. Build zincirinde uyarı modunda çalışır (build'i durdurmaz);
 * CI'da `--strict` ile hata verecek şekilde kullanılabilir.
 *
 * NEDEN: Senkron workflow'u sessizce durduğunda site bayat fiyat/stok
 * göstermeye devam ediyordu (generatedAt 2 aydan eskiydi).
 *
 * KULLANIM
 *   node scripts/check-catalog-age.mjs
 *   node scripts/check-catalog-age.mjs --strict
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CATALOG_FILE = path.join(ROOT, 'src', 'data', 'products.json')

const MAX_AGE_DAYS = 7
const STRICT = process.argv.includes('--strict')

try {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  const generatedAt = catalog?.generatedAt ? new Date(catalog.generatedAt) : null

  if (!generatedAt || Number.isNaN(generatedAt.getTime())) {
    const message =
      '[catalog-age] UYARI: `generatedAt` okunamadı. Trendyol senkronunu kontrol edin: npm run sync'
    if (STRICT) {
      console.error(message)
      process.exit(1)
    }
    console.warn(message)
  } else {
    const ageDays = (Date.now() - generatedAt.getTime()) / 86_400_000

    if (ageDays > MAX_AGE_DAYS) {
      const message = `[catalog-age] UYARI: katalog ${Math.floor(ageDays)} gündür güncellenmedi (son: ${catalog.generatedAt}). Senkronu çalıştırın: npm run sync`
      if (STRICT) {
        console.error(message)
        process.exit(1)
      }
      console.warn(message)
    } else {
      console.log(`[catalog-age] Katalog ${Math.floor(ageDays)} gün önce güncellendi — taze.`)
    }
  }
} catch (error) {
  console.warn(
    `[catalog-age] UYARI: denetim yapılamadı: ${error instanceof Error ? error.message : String(error)}`
  )
}
