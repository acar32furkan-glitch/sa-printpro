#!/usr/bin/env node
/**
 * Katalog `brand` alanı normalizasyonu.
 *
 * SORUN: Trendyol'dan gelen `brand` alanı çoğu üründe ÜRETİCİ marka değil,
 * hammadde/malzeme markası ("Oracal", "oracall", "AVERY", "3M") veya jenerik
 * çöp değer ("sticker", "rez", "Favori", "Home &") içeriyor. Vitrin görünür
 * metninde `resolveProductBrand` bunları SA Printpro'ya düşürüyor; ancak ham
 * `brand` değeri Astro island hydration payload'ına (`"brand":...`)
 * sızdığı için kaynakta da temizlenmelidir.
 *
 * ÇÖZÜM:
 *   - Malzeme markaları → `brand` = "SA Printpro", `materialBrand` = orijinal.
 *   - Geçersiz/jenerik değerler → `brand` = "SA Printpro".
 *   - Gerçek üretici markaları (Honda, Yamaha, Ducati, ...) DOKUNULMAZ.
 *
 * Kullanım:
 *   node scripts/normalize-brands.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const CATALOG_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'products.json')

const HOUSE_BRAND = 'SA Printpro'
const DRY_RUN = process.argv.includes('--dry-run')

/** Hammadde / malzeme markaları — üretici markası DEĞİLDİR. */
const MATERIAL_BRANDS = [
  'oracal',
  'oracall',
  'orafol',
  '3m',
  'avery',
  'avery dennison',
  'hexis',
  'kpmf',
  'metamark',
  'teckwrap',
]

/** Ürün markası olmayan jenerik/çöp değerler. */
const INVALID_BRAND_VALUES = [
  'sticker',
  'stickers',
  'etiket',
  'rez',
  'favori',
  'favorite',
  'home &',
  'home',
  'bys',
  'diğer',
  'diger',
  'yok',
  'belirsiz',
  'unknown',
  'n/a',
  '-',
]

/** Türkçe-duyarlı, aksan-bağımsız normalizasyon. */
function normalizeTr(str) {
  return String(str)
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
    .trim()
}

const stats = { material: 0, invalid: 0, unchanged: 0 }

function main() {
  if (!fs.existsSync(CATALOG_FILE)) {
    console.error(`[hata] Katalog bulunamadı: ${CATALOG_FILE}`)
    process.exit(1)
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  const products = Array.isArray(catalog?.products) ? catalog.products : []

  for (const product of products) {
    const raw = String(product?.brand || '').trim()
    const normalized = normalizeTr(raw)

    const isMaterial =
      raw !== '' &&
      MATERIAL_BRANDS.some(
        (brand) => normalized === brand || normalized.startsWith(brand)
      )

    if (isMaterial) {
      product.brand = HOUSE_BRAND
      product.materialBrand = raw
      stats.material += 1
      continue
    }

    if (raw === '' || INVALID_BRAND_VALUES.includes(normalized)) {
      product.brand = HOUSE_BRAND
      stats.invalid += 1
      continue
    }

    stats.unchanged += 1
  }

  if (!DRY_RUN) {
    fs.writeFileSync(
      CATALOG_FILE,
      JSON.stringify(catalog, null, 2) + '\n',
      'utf8'
    )
  }

  console.log(`[normalize-brands] ${DRY_RUN ? '(dry-run) ' : ''}Tamamlandı.`)
  console.log(`  Malzeme markası → SA Printpro : ${stats.material}`)
  console.log(`  Geçersiz değer → SA Printpro  : ${stats.invalid}`)
  console.log(`  Dokunulmayan (gerçek marka)   : ${stats.unchanged}`)
}

main()
