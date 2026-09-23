/**
 * Logo/favicon optimizasyonu (PageSpeed).
 *
 * Navbar'da logo 85x36 px gösterilirken 800x339 px / 168 KB PNG yükleniyordu.
 * Bu script:
 *   - PNG'leri retina için yeterli boyuta küçültür (2x),
 *   - aynı görsellerin WebP kopyalarını üretir (daha küçük transfer),
 *   - favicon'u 192x192'ye indirir.
 *
 * Kullanım: node scripts/optimize-logos.mjs
 */
import { statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const pub = (name) => resolve(rootDir, 'public', name)

/** Yatay logo hedef genişliği (navbar 85px @2x retina + pay). */
const LOGO_WIDTH = 400
/** Kare favicon hedef boyutu. */
const ICON_SIZE = 192

async function optimizePngAndWebp(pngName, webpName, resizeOptions, pngOptions, webpOptions) {
  const pngPath = pub(pngName)
  const webpPath = pub(webpName)

  const resized = await sharp(pngPath).resize(resizeOptions).png(pngOptions).toBuffer()
  writeFileSync(pngPath, resized)

  const webp = await sharp(pngPath).webp(webpOptions).toBuffer()
  writeFileSync(webpPath, webp)

  const pngKb = (statSync(pngPath).size / 1024).toFixed(1)
  const webpKb = (statSync(webpPath).size / 1024).toFixed(1)
  console.log(`${pngName.padEnd(18)} ${pngKb.padStart(7)} KB   ${webpName.padEnd(18)} ${webpKb.padStart(7)} KB`)
}

async function main() {
  console.log('Logo/favicon optimizasyonu başlıyor...\n')

  await optimizePngAndWebp(
    'logo.png',
    'logo.webp',
    { width: LOGO_WIDTH, fit: 'inside', withoutEnlargement: true },
    { compressionLevel: 9, palette: true, quality: 90 },
    { quality: 88, effort: 6 },
  )

  await optimizePngAndWebp(
    'logo-dark.png',
    'logo-dark.webp',
    { width: LOGO_WIDTH, fit: 'inside', withoutEnlargement: true },
    { compressionLevel: 9, palette: true, quality: 90 },
    { quality: 88, effort: 6 },
  )

  await optimizePngAndWebp(
    'favicon.png',
    'favicon.webp',
    { width: ICON_SIZE, height: ICON_SIZE, fit: 'inside' },
    { compressionLevel: 9, palette: true, quality: 90 },
    { quality: 90, effort: 6 },
  )

  console.log('\nTamamlandı.')
}

main().catch((error) => {
  console.error('Hata:', error)
  process.exit(1)
})
