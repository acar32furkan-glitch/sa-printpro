#!/usr/bin/env node
/**
 * FAZ 4 — ADIM 5 doğrulama yardımcısı (G4.1 / G4.2).
 *
 * Üretilen statik kategori sayfalarını (dist/kategori/<slug>/index.html)
 * okuyarak:
 *   1. Başlıktaki "N ürün" toplamının, "Tümü" butonundaki sayaçla
 *      eşleştiğini (G4.2 — sayfa boyutu 24 değil, kategori toplamı),
 *   2. Marka pill sayaçlarının toplamının kategori toplamına eşit
 *      olduğunu (G4.1 — kategoriye özel sayım) doğrular.
 *
 * Kullanım: node scripts/verify-category-filters.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const CATEGORIES = [
  'motosiklet-sticker-granaj',
  'araba-sticker-aksesuar',
  'dini-kaligrafi-sticker',
  'ayna-cam-sticker',
  'duvar-dekor-sticker',
  'motosiklet-jant-serit',
  'tankpad-sticker',
]

let failures = 0

for (const slug of CATEGORIES) {
  const file = join(ROOT, 'dist/kategori', slug, 'index.html')
  if (!existsSync(file)) {
    console.log(`❌ ${slug.padEnd(28)} sayfa bulunamadı`)
    failures += 1
    continue
  }

  const html = readFileSync(file, 'utf8')

  // Başlıktaki "N ürün" toplamı.
  const headerMatch = html.match(/>\s*(\d+)\s*ürün/)
  const headerTotal = headerMatch ? Number(headerMatch[1]) : null

  // "Tümü" butonundaki sayaç (opacity-70 span'i).
  const allMatch = html.match(/Tümü[\s\S]{0,200}?opacity-70">(\d+)</)
  const allCount = allMatch ? Number(allMatch[1]) : null

  // Marka pill sayaçları: her pill "Marka<span ...>N</span>" biçiminde.
  const pillCounts = [...html.matchAll(/opacity-70">(\d+)</g)].map((m) =>
    Number(m[1])
  )
  // İlk sayaç "Tümü" butonuna aittir; marka toplamı kalanların toplamıdır.
  const brandSum = pillCounts.slice(1).reduce((sum, n) => sum + n, 0)

  const ok = headerTotal !== null && allCount === headerTotal
  const brandOk = brandSum === headerTotal

  console.log(
    `${ok && brandOk ? '✅' : '❌'} ${slug.padEnd(28)} ` +
      `header=${headerTotal}  allBtn=${allCount}  brandSum=${brandSum}  ` +
      `brands=${pillCounts.length - 1}`
  )

  if (!ok || !brandOk) {
    failures += 1
  }
}

console.log('-'.repeat(78))
console.log(failures === 0 ? '✅ Tüm kategori filtre sayaçları tutarlı.' : `❌ ${failures} kategori tutarsız.`)
process.exit(failures > 0 ? 1 : 0)
