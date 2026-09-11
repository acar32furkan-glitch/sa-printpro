/**
 * FAZ 11 — Yerel Görsel Pipeline'ı (indirme + dönüştürme + logo filigranı).
 *
 * `src/data/products.json` içindeki her ürünün TÜM galeri görsellerini indirir,
 * Sharp ile maksimum 800x800px WebP (%85 kalite) formatına dönüştürür ve sağ alt
 * köşeye `public/logo.png` filigranını (maks. 130px genişlik, %40 opaklık, 20px
 * padding) basarak `public/uploads/products/${product.id}-${index}.webp` altına
 * kaydeder (index 0'dan başlar).
 *
 * Geriye dönük uyumluluk: ilk görsel (index 0) için ayrıca
 * `public/uploads/products/${product.id}.webp` dosyası da üretilir; mevcut
 * bileşenler bu yolu kullanmaya devam eder.
 *
 * Önbellek: hedef dosya zaten varsa indirme/işleme atlanır. Bu sayede script
 * tekrar tekrar çalıştırılabilir (idempotent) ve yalnızca eksik görselleri üretir.
 *
 * Kullanım:
 *   node scripts/process-images.mjs            # tüm ürünler
 *   node scripts/process-images.mjs --limit=5  # ilk 5 ürün
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const SOURCE_FILE = resolve(rootDir, 'src/data/products.json')
const LOGO_FILE = resolve(rootDir, 'public/logo.png')
const OUTPUT_DIR = resolve(rootDir, 'public/uploads/products')

// Görsel işleme sabitleri.
const MAX_DIMENSION = 800
const WEBP_QUALITY = 85
const LOGO_MAX_WIDTH = 130
const LOGO_OPACITY = 0.4
const LOGO_PADDING = 20

/**
 * `--limit=N` CLI parametresini ayrıştırır. Geçersiz/eksik değerde `null`
 * döner; bu da "tüm ürünler" anlamına gelir.
 * @returns {number|null}
 */
function parseLimit() {
  const arg = process.argv.find((value) => value.startsWith('--limit='))
  if (!arg) {
    return null
  }
  const parsed = Number.parseInt(arg.split('=')[1], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Bir dosyanın var olup olmadığını (erişilebilirliğini) kontrol eder.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Uzak bir görseli ArrayBuffer olarak indirir. HTTP hatalarında anlaşılır bir
 * mesajla fırlatır.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      // Bazı CDN'ler boş User-Agent isteklerini reddeder.
      'User-Agent': 'Mozilla/5.0 (compatible; SA-Printpro-ImagePipeline/1.0)',
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Logo filigranını hedef görselin sağ alt köşesine bindirir.
 *
 * Logo, `LOGO_MAX_WIDTH` genişliğine ölçeklenir (orijinal en-boy oranı korunur)
 * ve `LOGO_OPACITY` oranında yarı saydam hale getirilir. Hedef görselin
 * boyutlarından daha büyük bir logo asla taşmaz.
 *
 * @param {Buffer} imageBuffer
 * @param {Buffer} logoBuffer
 * @returns {Promise<Buffer>}
 */
async function applyWatermark(imageBuffer, logoBuffer) {
  const base = sharp(imageBuffer).rotate()
  const metadata = await base.metadata()

  const baseWidth = metadata.width || MAX_DIMENSION
  const baseHeight = metadata.height || MAX_DIMENSION

  // Logo genişliği hem sabit üst sınıra hem de hedef görselin genişliğine
  // (padding payı bırakarak) uyar.
  const logoWidth = Math.max(
    1,
    Math.min(LOGO_MAX_WIDTH, baseWidth - LOGO_PADDING * 2)
  )

  const logo = await sharp(logoBuffer)
    .resize({ width: logoWidth, withoutEnlargement: true })
    .ensureAlpha(LOGO_OPACITY)
    .toBuffer()

  const logoMeta = await sharp(logo).metadata()
  const logoHeight = logoMeta.height || logoWidth

  // Sağ alt köşe konumu; negatif değer oluşmaması için güvenli sınırlama.
  const left = Math.max(0, baseWidth - logoWidth - LOGO_PADDING)
  const top = Math.max(0, baseHeight - logoHeight - LOGO_PADDING)

  return base
    .composite([{ input: logo, left, top, blend: 'over' }])
    .toBuffer()
}

/**
 * Tek bir görsel URL'ini indirir, dönüştürür, filigran basar ve verilen
 * hedef yollara yazar. Hedef dosyalardan biri zaten varsa işlem atlanır.
 *
 * @param {string} sourceUrl
 * @param {string[]} outputPaths Aynı içeriğin yazılacağı hedef yollar.
 * @param {Buffer} logoBuffer
 * @returns {Promise<'processed'|'cached'>}
 */
async function processImage(sourceUrl, outputPaths, logoBuffer) {
  // Önbellek: tüm hedef dosyalar varsa yeniden indirme/işleme yapma.
  const existence = await Promise.all(outputPaths.map((p) => fileExists(p)))
  if (existence.every(Boolean)) {
    return 'cached'
  }

  const downloaded = await downloadImage(sourceUrl)

  const resized = await sharp(downloaded)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer()

  const watermarked = await applyWatermark(resized, logoBuffer)

  const webp = await sharp(watermarked)
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  // Eksik olan hedefleri yaz (mevcut dosyaları gereksiz yere ezme).
  for (let i = 0; i < outputPaths.length; i += 1) {
    if (!existence[i]) {
      await writeFile(outputPaths[i], webp)
    }
  }

  return 'processed'
}

/**
 * Tek bir ürünün TÜM galeri görsellerini işler.
 *
 * @param {object} product
 * @param {Buffer} logoBuffer
 * @returns {Promise<{processed: number, cached: number, skipped: number, failed: number}>}
 */
async function processProduct(product, logoBuffer) {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : []
  const result = { processed: 0, cached: 0, skipped: 0, failed: 0 }

  if (images.length === 0) {
    result.skipped += 1
    return result
  }

  for (let index = 0; index < images.length; index += 1) {
    const sourceUrl = images[index]
    const outputPaths = [resolve(OUTPUT_DIR, `${product.id}-${index}.webp`)]

    // Geriye dönük uyumluluk: ilk görsel için `{id}.webp` de üretilir.
    if (index === 0) {
      outputPaths.push(resolve(OUTPUT_DIR, `${product.id}.webp`))
    }

    try {
      const outcome = await processImage(sourceUrl, outputPaths, logoBuffer)
      if (outcome === 'processed') {
        result.processed += 1
      } else {
        result.cached += 1
      }
    } catch (error) {
      result.failed += 1
      console.error(
        `  ✗ ${product.id} görsel #${index} işlenemedi: ${error.message}`
      )
    }
  }

  return result
}

async function main() {
  const limit = parseLimit()

  const raw = await readFile(SOURCE_FILE, 'utf8')
  const data = JSON.parse(raw)
  const allProducts = Array.isArray(data?.products) ? data.products : []
  const products = limit ? allProducts.slice(0, limit) : allProducts

  if (!(await fileExists(LOGO_FILE))) {
    throw new Error(
      `Logo bulunamadı: ${LOGO_FILE}. Filigran için public/logo.png gerekli.`
    )
  }

  const logoBuffer = await readFile(LOGO_FILE)
  await mkdir(OUTPUT_DIR, { recursive: true })

  const totalImages = products.reduce(
    (sum, product) =>
      sum + (Array.isArray(product?.images) ? product.images.filter(Boolean).length : 0),
    0
  )

  console.log(
    `[process-images] ${products.length} ürün / ${totalImages} görsel işlenecek (toplam katalog: ${allProducts.length}).`
  )

  let processed = 0
  let cached = 0
  let skipped = 0
  let failed = 0

  for (const product of products) {
    const result = await processProduct(product, logoBuffer)
    processed += result.processed
    cached += result.cached
    skipped += result.skipped
    failed += result.failed

    if (result.processed > 0) {
      console.log(
        `  ✓ ${product.id} → ${product.slug} (${result.processed} yeni, ${result.cached} önbellek)`
      )
    } else if (result.skipped > 0) {
      console.warn(`  ! ${product.id} görsel içermiyor, atlandı.`)
    }
  }

  console.log(
    `[process-images] Tamamlandı → işlenen: ${processed}, önbellek: ${cached}, atlanan ürün: ${skipped}, hata: ${failed}`
  )
}

main().catch((error) => {
  console.error('[process-images] Hata:', error)
  process.exitCode = 1
})
