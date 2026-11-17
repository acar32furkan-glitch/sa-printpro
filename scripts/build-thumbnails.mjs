#!/usr/bin/env node
/**
 * FAZ C3 — PERF-02: Arama dropdown'ı için 96x96 küçük görsel üretici.
 *
 * NEDEN: `search-index.json` tam boy ürün görselini taşıyordu; mobilde her
 * tuş vuruşunda yüzlerce KB indiriliyordu. 48x48 kutuda 96x96 yeterlidir.
 *
 * Yöntem: Yalnızca YEREL `public/uploads/products/{id}.webp` dosyaları
 * kullanılır (ağ erişimi yok). `{id}-thumb.webp` zaten varsa atlanır →
 * idempotent.
 *
 * KULLANIM
 *   node scripts/build-thumbnails.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'public', 'uploads', 'products')

const THUMB_SIZE = 96
const THUMB_QUALITY = 78

async function main() {
  if (!fs.existsSync(DIR)) {
    console.log('[thumbnails] Dizin yok, atlandı.')
    return
  }

  // Yalnız ana görseller: `{id}.webp` (galeri kareleri `{id}-{n}.webp` elenir).
  const files = fs
    .readdirSync(DIR)
    .filter((file) => /\.webp$/i.test(file))
    .filter((file) => !/-thumb\.webp$/i.test(file))
    .filter((file) => !/-\d+\.webp$/i.test(file))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const file of files) {
    const source = path.join(DIR, file)
    const target = path.join(DIR, file.replace(/\.webp$/i, '-thumb.webp'))

    if (fs.existsSync(target)) {
      skipped += 1
      continue
    }

    try {
      await sharp(source)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
        .webp({ quality: THUMB_QUALITY })
        .toFile(target)
      created += 1
    } catch {
      failed += 1
    }
  }

  console.log(
    `[thumbnails] ${created} üretildi, ${skipped} atlandı${failed > 0 ? `, ${failed} hata` : ''}`
  )
}

try {
  await main()
} catch (error) {
  console.error(
    `[thumbnails] HATA: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
}
