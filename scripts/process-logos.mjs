/**
 * Logo arka planı temizleme (background removal) script'i.
 *
 * Kaynak logolar `logo/` klasöründe `.jfif` (JPEG) formatındadır ve ALFA
 * KANALI YOKTUR — yani düz beyaz veya düz siyah bir zemin üzerine basılmıştır.
 * Bu script, zemini şeffafa çevirerek `public/` altındaki PNG'leri üretir:
 *
 *   logo/sa-printpro-logo-yatay.jfif      → public/logo.png       (açık tema)
 *   logo/sa-printpro-logo-yatay-alt.jfif  → public/logo-dark.png  (koyu tema)
 *   logo/sa-printpro-icon-kare.jfif       → public/favicon.png
 *
 * Yöntem: kenarlardan flood-fill (taşma doldurma). Global eşikleme yerine
 * kenarlardan başlayan bir BFS kullanılır; böylece logonun İÇİNDEKİ beyaz/siyah
 * alanlar (ör. harf içi boşluklar) korunur, yalnızca dış zemin şeffaflaşır.
 *
 * Kullanım:
 *   node scripts/process-logos.mjs
 *   node scripts/process-logos.mjs --tolerance=40
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

/**
 * İşlenecek logo tanımları. `background` beklenen zemin rengidir; flood-fill
 * bu renge `tolerance` mesafesindeki kenar piksellerinden başlar.
 *
 * NOT: `favicon.png` BİLİNÇLİ OLARAK bu listede DEĞİLDİR. Kaynak kare ikon
 * (`logo/sa-printpro-icon-kare.jfif`) tasarım gereği koyu bir rozet zeminine
 * sahiptir ve üzerindeki "SA" monogramı açık renktir. Arka planı kaldırmak
 * ikonun tasarımını bozar; bu yüzden favicon mevcut haliyle korunur.
 */
const JOBS = [
  {
    source: resolve(rootDir, 'logo/sa-printpro-logo-yatay.jfif'),
    output: resolve(rootDir, 'public/logo.png'),
    // Açık tema için koyu logo → beyaz zemin kaldırılır.
    background: [255, 255, 255],
    label: 'logo.png (açık tema)',
  },
  {
    source: resolve(rootDir, 'logo/sa-printpro-logo-yatay-alt.jfif'),
    output: resolve(rootDir, 'public/logo-dark.png'),
    // Koyu tema için açık logo → siyah zemin kaldırılır.
    background: [0, 0, 0],
    label: 'logo-dark.png (koyu tema)',
  },
]

/** Çıktı genişliği (yatay logolar için). */
const LOGO_WIDTH = 800
/** Çıktı boyutu (kare ikon için). */
const ICON_SIZE = 512

/**
 * `--tolerance=N` CLI parametresini ayrıştırır. Varsayılan 32.
 * @returns {number}
 */
function parseTolerance() {
  const arg = process.argv.find((value) => value.startsWith('--tolerance='))
  if (!arg) {
    return 32
  }
  const parsed = Number.parseInt(arg.split('=')[1], 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 32
}

/**
 * İki renk arasındaki Öklid mesafesini (RGB) hesaplar.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number[]} target
 * @returns {number}
 */
function colorDistance(r, g, b, target) {
  const dr = r - target[0]
  const dg = g - target[1]
  const db = b - target[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * Kenarlardan flood-fill yaparak zemin piksellerini şeffaf yapar ve kenarları
 * yumuşatır (anti-aliasing).
 *
 * Algoritma:
 *  1. Görüntünün tüm kenar pikselleri tohum (seed) olarak kuyruğa eklenir.
 *  2. Zemin rengine `tolerance` mesafesindeki komşular yayılır (BFS) ve
 *     "zemin" olarak işaretlenir. Böylece logonun İÇİNDEKİ aynı renkli
 *     bölgeler (ör. harf gözleri) korunur.
 *  3. Zemin pikselleri tamamen şeffaf (alfa=0) yapılır.
 *  4. Zemin ile logo arasındaki SINIR pikselleri, zemin rengine olan
 *     mesafelerine göre KADEMELİ alfa alır. Bu, testere dişi (jagged) kenarları
 *     önler ve logonun yumuşak görünmesini sağlar.
 *
 * @param {Buffer} raw RGBA ham piksel verisi.
 * @param {number} width
 * @param {number} height
 * @param {number[]} background Beklenen zemin rengi [r,g,b].
 * @param {number} tolerance
 * @returns {{data: Buffer, removed: number, feathered: number}}
 */
function removeBackground(raw, width, height, background, tolerance) {
  const data = Buffer.from(raw)
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  /**
   * Bir pikseli zemin adayı olarak kuyruğa ekler.
   * @param {number} index
   */
  function enqueue(index) {
    if (visited[index] === 1) {
      return
    }
    const offset = index * 4
    const distance = colorDistance(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      background
    )
    if (distance > tolerance) {
      return
    }
    visited[index] = 1
    queue[tail] = index
    tail += 1
  }

  // Tüm kenar piksellerini tohumla.
  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width)
    enqueue(y * width + (width - 1))
  }

  let removed = 0

  while (head < tail) {
    const index = queue[head]
    head += 1

    const offset = index * 4
    data[offset + 3] = 0
    removed += 1

    const x = index % width
    const y = (index - x) / width

    if (x > 0) {
      enqueue(index - 1)
    }
    if (x < width - 1) {
      enqueue(index + 1)
    }
    if (y > 0) {
      enqueue(index - width)
    }
    if (y < height - 1) {
      enqueue(index + width)
    }
  }

  // --- Kenar yumuşatma (feathering) ---------------------------------------
  // Zemin komşusu olan ama kendisi zemin OLMAYAN pikseller sınırdadır. Bu
  // piksellerin alfası, zemin rengine olan mesafeye göre kademelendirilir:
  // zemine çok yakın → neredeyse şeffaf, zeminden uzak → tam opak.
  const FEATHER_RANGE = tolerance * 2.5
  let feathered = 0

  for (let index = 0; index < total; index += 1) {
    if (visited[index] === 1) {
      continue
    }

    const x = index % width
    const y = (index - x) / width

    // Yalnızca zemine komşu sınır piksellerini işle.
    const touchesBackground =
      (x > 0 && visited[index - 1] === 1) ||
      (x < width - 1 && visited[index + 1] === 1) ||
      (y > 0 && visited[index - width] === 1) ||
      (y < height - 1 && visited[index + width] === 1)

    if (!touchesBackground) {
      continue
    }

    const offset = index * 4
    const distance = colorDistance(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      background
    )

    // Mesafe arttıkça alfa 0 → 255 arasında doğrusal artar.
    const ratio = Math.min(1, Math.max(0, (distance - tolerance) / FEATHER_RANGE))
    const alpha = Math.round(ratio * 255)

    if (alpha < 255) {
      data[offset + 3] = alpha
      feathered += 1
    }
  }

  return { data, removed, feathered }
}

/**
 * Tek bir logoyu işler: yeniden boyutlandırır, zeminini şeffaf yapar ve PNG
 * olarak yazar.
 *
 * @param {object} job
 * @param {number} tolerance
 * @returns {Promise<{removed: number, total: number, width: number, height: number}>}
 */
async function processLogo(job, tolerance) {
  const isIcon = job.output.endsWith('favicon.png')

  let pipeline = sharp(job.source).rotate()

  if (isIcon) {
    pipeline = pipeline.resize(ICON_SIZE, ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
  } else {
    pipeline = pipeline.resize({ width: LOGO_WIDTH, withoutEnlargement: true })
  }

  // Ham RGBA verisi (alfa kanalı eklenir).
  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data: cleaned, removed, feathered } = removeBackground(
    data,
    info.width,
    info.height,
    job.background,
    tolerance
  )

  const png = await sharp(cleaned, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()

  await writeFile(job.output, png)

  return {
    removed,
    feathered,
    total: info.width * info.height,
    width: info.width,
    height: info.height,
  }
}

async function main() {
  const tolerance = parseTolerance()

  await mkdir(resolve(rootDir, 'public'), { recursive: true })

  console.log(`[process-logos] Tolerans: ${tolerance}`)

  for (const job of JOBS) {
    try {
      const result = await processLogo(job, tolerance)
      const percent = ((result.removed / result.total) * 100).toFixed(1)
      console.log(
        `  ✓ ${job.label} → ${result.width}x${result.height}, ` +
          `şeffaflaşan piksel: ${result.removed} (%${percent}), ` +
          `yumuşatılan kenar: ${result.feathered}`
      )
    } catch (error) {
      console.error(`  ✗ ${job.label} işlenemedi: ${error.message}`)
      process.exitCode = 1
    }
  }

  console.log('[process-logos] Tamamlandı.')
}

main().catch((error) => {
  console.error('[process-logos] Hata:', error)
  process.exitCode = 1
})
