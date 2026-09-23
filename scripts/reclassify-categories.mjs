#!/usr/bin/env node
/**
 * FAZ 4 — ADIM 4: KATEGORİ TAKSONOMİSİ BÖLME (G3.1–G3.4)
 *
 * `arma-sticker-fosfor-serit` kategorisi tek bir çatı altında çok farklı
 * ürünleri topluyordu (motosiklet granaj, araba aksesuar, dini/kaligrafi,
 * duvar dekor, ayna). Bu script, ürünleri başlıklarına göre anlamlı alt
 * kategorilere ayırır ve eski kategori slug'larından yeni kategorilere
 * kalıcı (301) yönlendirme kurar.
 *
 * TASARIM İLKELERİ
 * ----------------
 * 1. IDEMPOTENT: Kalıcı veri kaynağı `src/data/category-redirects.json`
 *    dosyasıdır. Script her çalıştığında bu dosyayı okur; zaten taşınmış
 *    (yeni kategoriye atanmış) ürünleri atlar. Trendyol sync'i
 *    `products.json`'u üzerine yazsa bile script tekrar çalıştırıldığında
 *    aynı sonucu üretir.
 *
 * 2. HAM VERİ KORUNUR: `products.json` içindeki `category` alanı
 *    DEĞİŞTİRİLMEZ. Bunun yerine her ürüne `categoryOverride` alanı
 *    eklenir; `src/lib/products.js` içindeki `resolveCategory` bu alanı
 *    öncelikli olarak okur. Böylece Trendyol sync'i ham kategoriyi
 *    güncellese bile override korunur.
 *
 * 3. ÖNCELİK SIRASI: Bir ürün birden fazla kategoriye uyabilir. Aşağıdaki
 *    `CATEGORY_RULES` dizisi sıralıdır; İLK eşleşen kural kazanır.
 *    Sıra: dini/kaligrafi → duvar & dekor → ayna & cam → motosiklet →
 *    araba aksesuar → (fallback) arma-sticker-fosfor-serit.
 *
 * Kullanım:
 *   node scripts/reclassify-categories.mjs            # --dry-run (varsayılan)
 *   node scripts/reclassify-categories.mjs --dry-run  # açıkça dry-run
 *   node scripts/reclassify-categories.mjs --apply    # değişiklikleri uygula
 *   npm run reclassify
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PRODUCTS_PATH = join(ROOT, 'src/data/products.json')
const REDIRECTS_PATH = join(ROOT, 'src/data/category-redirects.json')
const WORKER_PATH = join(ROOT, 'worker/index.js')

/** Bölünecek kaynak kategori slug'ı. */
const SOURCE_SLUG = 'arma-sticker-fosfor-serit'

/**
 * Kaynak kategori boşaldıktan sonra eski URL'in yönlendirileceği SABİT hedef.
 * En büyük alt kategori (Motosiklet Sticker & Granaj) seçilir; böylece
 * yönlendirme hedefi script'in her çalışmasında aynı kalır (idempotent).
 */
const PRIMARY_REDIRECT_TARGET = 'motosiklet-sticker-granaj'

/**
 * Yeni kategori taksonomisi.
 *
 * `slug`  → SEO uyumlu, kalıcı URL parçası.
 * `name`  → Vitrinde gösterilen okunabilir ad.
 */
const TARGET_CATEGORIES = {
  'motosiklet-sticker-granaj': {
    name: 'Motosiklet Sticker & Granaj',
    id: '9001',
  },
  'araba-sticker-aksesuar': {
    name: 'Araba Sticker & Aksesuar',
    id: '9002',
  },
  'dini-kaligrafi-sticker': {
    name: 'Dini & Kaligrafi Sticker',
    id: '9003',
  },
  'duvar-dekor-sticker': {
    name: 'Duvar & Dekor Sticker',
    id: '9004',
  },
  'ayna-cam-sticker': {
    name: 'Ayna & Cam Sticker',
    id: '9005',
  },
}

/**
 * Sıralı sınıflandırma kuralları. İLK eşleşen kural kazanır.
 *
 * Her kural:
 *   - `slug`     → hedef kategori slug'ı
 *   - `keywords` → ürün başlığında (normalize edilmiş) aranacak kelimeler
 *   - `regex`    → (opsiyonel) ek regex koşulu
 *
 * ÖNCELİK SIRASI (çakışma çözümü):
 *   1. Dini & Kaligrafi   (en özel — tevhid, hat, Atatürk, bayrak)
 *   2. Duvar & Dekor      (duvar, dekor, berber, pisuar)
 *   3. Ayna & Cam         (ayna, güneşlik)
 *   4. Motosiklet         (granaj, kask, jant, far, venom, drift, marka adları)
 *   5. Araba Aksesuar     (oto, araba, kaput, kapı kolu, plaka)
 *   6. Fallback           → kaynak kategori korunur (arma-sticker-fosfor-serit)
 */
const CATEGORY_RULES = [
  {
    slug: 'dini-kaligrafi-sticker',
    keywords: [
      'tevhid',
      'kelime i tevhid',
      'hat yazisi',
      'hat yazısı',
      'ataturk',
      'atatürk',
      'mustafa kemal',
      'gazi m.kemal',
      'gazi mustafa',
      'turk bayragi',
      'türk bayrağı',
      'ay yildiz',
      'ay yıldız',
      'cumhuriyet',
      'imza',
      'imzasi',
      'imzası',
    ],
  },
  {
    slug: 'duvar-dekor-sticker',
    keywords: ['duvar', 'dekor', 'berber', 'pisuar'],
  },
  {
    slug: 'ayna-cam-sticker',
    keywords: ['ayna', 'guneslik', 'güneşlik'],
  },
  {
    slug: 'motosiklet-sticker-granaj',
    keywords: [
      'granaj',
      'grenaj',
      'kask',
      'jant',
      'far',
      'venom',
      'drift',
      'motosiklet',
      'motorsiklet',
      'motor',
      'moto',
      'honda',
      'yamaha',
      'kawasaki',
      'kawazaki',
      'suzuki',
      'bmw',
      'ktm',
      'tvs',
      'nmax',
      'pcx',
      'cbr',
      'xmax',
      'tmax',
      'fazer',
      'tenere',
      'hayabusa',
      'africa twin',
      'super adventure',
      'v-strom',
      'vstrom',
      'voge',
      'duster',
      'ssangyong',
      'saab',
      'hyundai',
      'activa',
      'jubiter',
      'jupiter',
      'renegade',
      'revs your heart',
      'ready to race',
      'kanat',
      'pençe',
      'pence',
      'monster',
      'reflektörlü',
      'reflektorlu',
    ],
  },
  {
    slug: 'araba-sticker-aksesuar',
    keywords: [
      'oto',
      'araba',
      'otomobil',
      'kaput',
      'kapi kolu',
      'kapı kolu',
      'plaka',
      'makyaj',
      'jdm',
      'japon',
      'low life',
      'hard core',
      'royal stance',
      'greddy',
      'tofasahin',
      'tofaşahin',
      'egea',
      'musso',
      'batarya',
      'pil',
      'wifi',
      'hologram',
      'kupon',
      'thy',
      'gayyış',
      'gayyis',
      'inan hiç',
      'inan hic',
      'findit',
      'yildiz',
      'yıldız',
      'bebek',
      'ayicik',
      'ayıcık',
      'spor sticker',
      'marşpiyel',
      'marspiyel',
      'roll',
      'wanted',
      'ssangyong',
      'telefon',
      'bildirim',
      'panel',
    ],
  },
]

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/**
 * Türkçe karakterleri sadeleştirir ve metni normalize eder.
 * @param {string} value
 * @returns {string}
 */
function normalizeTr(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
}

/**
 * Bir ürünün hedef kategori slug'ını kurallara göre belirler.
 * Hiçbir kural eşleşmezse `null` döner (kaynak kategori korunur).
 *
 * @param {object} product
 * @returns {string|null}
 */
function classifyProduct(product) {
  const haystack = normalizeTr(product?.name || '')

  for (const rule of CATEGORY_RULES) {
    const hit = rule.keywords.some((keyword) =>
      haystack.includes(normalizeTr(keyword))
    )
    if (hit) {
      return rule.slug
    }
  }

  return null
}

/**
 * `products.json` ham içeriğini okur.
 *
 * ÖNEMLİ: Dosya `{ products: [...] }` biçimindedir ve `src/lib/products.js`
 * içindeki `getAllProducts()` doğrudan `productsData.products` okur. Bu
 * nedenle script yazarken bu sarmalayıcıyı KORUMAK zorundadır.
 *
 * @returns {{raw: object, products: Array<object>, isWrapped: boolean}}
 */
function readProductsFile() {
  const raw = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
  const isWrapped = !Array.isArray(raw) && Array.isArray(raw.products)
  return {
    raw,
    products: isWrapped ? raw.products : Array.isArray(raw) ? raw : [],
    isWrapped,
  }
}

/**
 * Kalıcı kategori yönlendirme haritasını okur.
 * @returns {Record<string, string>}
 */
function readRedirects() {
  if (!existsSync(REDIRECTS_PATH)) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(REDIRECTS_PATH, 'utf8')) || {}
  } catch {
    return {}
  }
}

/**
 * `worker/index.js` içindeki mevcut `CATEGORY_REDIRECTS` kayıtlarını okur.
 * Böylece FAZ B'den gelen eski kategori yönlendirmeleri KORUNUR.
 *
 * @returns {Record<string, string>}
 */
function readWorkerRedirects() {
  if (!existsSync(WORKER_PATH)) {
    return {}
  }

  const source = readFileSync(WORKER_PATH, 'utf8')
  const match = /const CATEGORY_REDIRECTS = \{([\s\S]*?)\};/.exec(source)
  if (!match) {
    return {}
  }

  /** @type {Record<string, string>} */
  const result = {}
  // Hem tırnaklı ('ayna') hem tırnaksız (ayna) anahtarları yakalar.
  const entryPattern = /(?:'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*'([^']+)'/g
  let entry
  while ((entry = entryPattern.exec(match[1])) !== null) {
    const key = entry[1] || entry[2]
    result[key] = entry[3]
  }
  return result
}

/**
 * `worker/index.js` içindeki `CATEGORY_REDIRECTS` bloğunu, kalıcı JSON
 * kaynağından üretilen içerikle senkronlar. Mevcut (FAZ B) kayıtlar korunur;
 * yalnızca yeni/eksik kayıtlar eklenir.
 *
 * @param {Record<string, string>} redirects
 * @returns {boolean} Değişiklik yapıldı mı?
 */
function syncWorkerRedirects(redirects) {
  if (!existsSync(WORKER_PATH)) {
    return false
  }

  const source = readFileSync(WORKER_PATH, 'utf8')

  // Mevcut worker kayıtları + kalıcı JSON kayıtları birleştirilir.
  const merged = { ...readWorkerRedirects(), ...redirects }

  const entries = Object.keys(merged)
    .sort()
    .map((from) => `  '${from}': '${merged[from]}',`)
    .join('\n')

  const block = `const CATEGORY_REDIRECTS = {\n${entries}\n};`

  const pattern = /const CATEGORY_REDIRECTS = \{[\s\S]*?\};/
  if (!pattern.test(source)) {
    return false
  }

  const next = source.replace(pattern, block)
  if (next === source) {
    return false
  }

  writeFileSync(WORKER_PATH, next, 'utf8')
  return true
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

function main() {
  const apply = process.argv.includes('--apply')
  const { raw, products, isWrapped } = readProductsFile()

  const sourceProducts = products.filter(
    (product) => product?.category?.slug === SOURCE_SLUG
  )

  /** @type {Map<string, Array<object>>} */
  const buckets = new Map()
  let unchanged = 0

  for (const product of sourceProducts) {
    // IDEMPOTENT: zaten override edilmiş ürünü atla.
    if (product.categoryOverride?.slug) {
      unchanged += 1
      continue
    }

    const target = classifyProduct(product)
    if (!target) {
      unchanged += 1
      continue
    }

    if (!buckets.has(target)) {
      buckets.set(target, [])
    }
    buckets.get(target).push(product)
  }

  // --- Rapor ---
  console.log('='.repeat(78))
  console.log('FAZ 4 — ADIM 4: KATEGORİ YENİDEN SINIFLANDIRMA')
  console.log(`Mod: ${apply ? 'APPLY (yazılıyor)' : 'DRY-RUN (yazılmıyor)'}`)
  console.log('='.repeat(78))
  console.log(`Kaynak kategori: ${SOURCE_SLUG} (${sourceProducts.length} ürün)`)
  console.log('')

  console.log('Hedef kategori dağılımı:')
  let moved = 0
  for (const [slug, list] of [...buckets.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )) {
    const meta = TARGET_CATEGORIES[slug]
    console.log(`  ${String(list.length).padStart(4)}  ${slug}  (${meta?.name || slug})`)
    moved += list.length
  }
  console.log(`  ${String(unchanged).padStart(4)}  ${SOURCE_SLUG}  (değişmeden kalır)`)
  console.log('')
  console.log(`Taşınacak: ${moved}  |  Değişmeyen: ${unchanged}`)
  console.log('')

  // --- Uygula ---
  if (apply) {
    for (const [slug, list] of buckets.entries()) {
      const meta = TARGET_CATEGORIES[slug]
      for (const product of list) {
        product.categoryOverride = {
          id: meta.id,
          name: meta.name,
          slug,
        }
      }
    }

    // Orijinal sarmalayıcı biçimi ({ products: [...] }) KORUNUR; aksi halde
    // `getAllProducts()` (productsData.products) undefined döner ve build kırılır.
    const output = isWrapped ? { ...raw, products } : products
    writeFileSync(PRODUCTS_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
    console.log(`✔ products.json güncellendi (${moved} ürün override edildi).`)

    // Kalıcı yönlendirme haritası: eski slug → yeni kategori.
    //
    // Kaynak kategori artık statik olarak ÜRETİLMEZ (tüm ürünleri taşındı).
    // Eski URL, en büyük alt kategoriye (Motosiklet Sticker & Granaj) kalıcı
    // olarak yönlendirilir. Bu hedef sabittir; böylece script idempotent kalır
    // ve tek ürünlük geçici bucket'lara göre hedef değişmez.
    const redirects = readRedirects()
    redirects[SOURCE_SLUG] = PRIMARY_REDIRECT_TARGET

    writeFileSync(
      REDIRECTS_PATH,
      `${JSON.stringify(redirects, null, 2)}\n`,
      'utf8'
    )
    console.log(`✔ category-redirects.json güncellendi.`)

    const workerChanged = syncWorkerRedirects(redirects)
    console.log(
      workerChanged
        ? '✔ worker/index.js CATEGORY_REDIRECTS senkronlandı.'
        : '• worker/index.js zaten güncel.'
    )
  } else {
    console.log('(Dry-run: hiçbir dosya yazılmadı. Uygulamak için --apply kullanın.)')
  }

  console.log('='.repeat(78))
}

main()
