#!/usr/bin/env node
/**
 * FAZ B — DATA-01: Yerel görsel manifest'i üretici.
 *
 * `public/uploads/products/` altındaki gerçek WebP dosyalarını tarar ve
 * `src/data/image-manifest.json` içine yazar. `src/lib/products.js` yerel
 * görsel kontrolünü bu manifest üzerinden yapar.
 *
 * NEDEN: Önceden `getProductPrimaryImage`/`getProductImages` yalnızca
 * `globalThis.__SA_PRINTPRO_FS__` köprüsü set edilmiş sayfalarda (404 ve ürün
 * detayı) yerel görseli bulabiliyordu; ana sayfa/liste sayfaları sessizce
 * Trendyol CDN'ine düşüyordu. Manifest yaklaşımı hem SSR hem tarayıcıda aynı
 * sonucu verir ve `node:fs` bağımlılığını client paketinden uzak tutar.
 *
 * KULLANIM
 *   node scripts/build-image-manifest.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public', 'uploads', 'products')
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'image-manifest.json')

function main() {
  let files = []

  if (fs.existsSync(IMAGES_DIR)) {
    files = fs
      .readdirSync(IMAGES_DIR)
      .filter((file) => /\.webp$/i.test(file))
      .sort()
  }

  // PERF-02: `{id}-thumb.webp` dosyaları ayrı listelenir; arama indeksi yalnız
  // gerçekten var olan küçük görseli yazar.
  const isThumb = (file) => /-thumb\.webp$/i.test(file)
  const images = files
    .filter((file) => !isThumb(file))
    .map((file) => `/uploads/products/${file}`)
  const thumbs = files.filter(isThumb).map((file) => `/uploads/products/${file}`)

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: images.length,
    thumbCount: thumbs.length,
    images,
    thumbs,
  }

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`[image-manifest] ${images.length} görsel → src/data/image-manifest.json`)
}

try {
  main()
} catch (error) {
  console.error(
    `[image-manifest] HATA: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
}
