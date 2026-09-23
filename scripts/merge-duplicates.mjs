#!/usr/bin/env node
/**
 * FAZ 4 — ADIM 3: DUPLICATE BİRLEŞTİRME / VARYANT DÖNÜŞÜMÜ (G2.1–G2.4)
 *
 * `scripts/find-duplicates.mjs` tarafından bulunan grupları işler:
 *
 *   1. BİREBİR DUPLICATE (merge)
 *      → En uygun kayıt "master" seçilir (0 TL olmayan, stoğu olan, en eksiksiz
 *        açıklama/görsel). Diğer kayıtlar master'a birleştirilir (varyantları
 *        master'a taşınır) ve katalogdan çıkarılır. Eski slug'lar master
 *        slug'ına 301 yönlendirilir.
 *
 *   2. GERÇEK VARYANT (variant)
 *      → Tek ürün + varyant seçici altında birleştirilir. Tüm varyantlar
 *        master ürünün `variants` dizisine taşınır; eski slug'lar 301 olur.
 *
 *   3. FARKLI ÜRÜN (distinct)
 *      → Başlıklar belirginleştirilir (yıl/model/ölçü eklenir). Ürün
 *        kaldırılmaz, slug değişmez.
 *
 * IDEMPOTENT: Kalıcı veri kaynağı `src/data/product-redirects.json` dosyasıdır.
 * Script her çalıştığında bu dosyayı okur; zaten birleştirilmiş (katalogda
 * olmayan) ürünleri atlar. Trendyol sync'i `products.json`'u üzerine yazsa
 * bile script tekrar çalıştırıldığında aynı sonucu üretir.
 *
 * Kullanım:
 *   node scripts/merge-duplicates.mjs            # --dry-run (varsayılan, yazmaz)
 *   node scripts/merge-duplicates.mjs --dry-run  # açıkça dry-run
 *   node scripts/merge-duplicates.mjs --apply    # değişiklikleri uygula
 *   npm run merge:duplicates
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PRODUCTS_PATH = join(ROOT, 'src/data/products.json')
const REDIRECTS_PATH = join(ROOT, 'src/data/product-redirects.json')
const WORKER_PATH = join(ROOT, 'worker/index.js')

/** Başlık benzerliği eşiği (%). */
const SIMILARITY_THRESHOLD = 90

/** Fiyat yakınlığı toleransı (TL). */
const PRICE_TOLERANCE = 1

/** Varyant seçiciye taşınacak gerçek seçim özellikleri. */
const VARIANT_ATTRIBUTE_KEYS = [
  'renk',
  'color',
  'beden',
  'size',
  'ölçü',
  'olcu',
  'boyut',
  'model',
  'desen',
  'adet',
  'paket',
  'uzunluk',
  'genişlik',
  'genislik',
  'kalınlık',
  'kalinlik',
  'tip',
  'type',
]

/** Renk adları — varyant ailesi tespitinde kullanılır. */
const COLOR_WORDS = [
  'siyah',
  'beyaz',
  'kirmizi',
  'kırmızı',
  'mavi',
  'lacivert',
  'sari',
  'sarı',
  'yesil',
  'yeşil',
  'turuncu',
  'mor',
  'pembe',
  'gri',
  'kahverengi',
  'altin',
  'altın',
  'gumus',
  'gümüş',
  'krom',
  'seffaf',
  'şeffaf',
  'reflektif',
  'cok renkli',
  'çok renkli',
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
 * Başlığı karşılaştırmaya uygun token dizisine çevirir.
 * @param {string} title
 * @returns {string[]}
 */
function tokenize(title) {
  return normalizeTr(title)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
}

/**
 * Levenshtein mesafesine dayalı benzerlik oranı (0–100).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinRatio(a, b) {
  if (a === b) return 100
  if (a.length === 0 || b.length === 0) return 0

  const rows = a.length + 1
  const cols = b.length + 1
  let previous = new Array(cols)
  let current = new Array(cols)

  for (let j = 0; j < cols; j += 1) {
    previous[j] = j
  }

  for (let i = 1; i < rows; i += 1) {
    current[0] = i
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      )
    }
    const swap = previous
    previous = current
    current = swap
  }

  const distance = previous[cols - 1]
  const maxLength = Math.max(a.length, b.length)
  return ((maxLength - distance) / maxLength) * 100
}

/**
 * İki başlık arasındaki benzerliği yüzde olarak hesaplar.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function titleSimilarity(a, b) {
  const tokensA = new Set(tokenize(a))
  const tokensB = new Set(tokenize(b))

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1
    }
  }
  const union = tokensA.size + tokensB.size - intersection
  const jaccard = union === 0 ? 0 : (intersection / union) * 100

  const normalizedA = normalizeTr(a).replace(/\s+/g, ' ').trim()
  const normalizedB = normalizeTr(b).replace(/\s+/g, ' ').trim()
  return Math.max(jaccard, levenshteinRatio(normalizedA, normalizedB))
}

/**
 * Bir ürünün temsili fiyatını döndürür.
 * @param {object} product
 * @returns {number}
 */
function productPrice(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  for (const variant of variants) {
    const sale = Number(variant?.salePrice)
    const list = Number(variant?.price)
    const value = Number.isFinite(sale) && sale > 0 ? sale : list
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return 0
}

/**
 * Bir ürünün toplam stoğunu döndürür.
 * @param {object} product
 * @returns {number}
 */
function productStock(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  return variants.reduce((sum, variant) => sum + (Number(variant?.stock) || 0), 0)
}

/**
 * Bir ürünün varyant attribute'larında gerçek bir seçim özelliği var mı?
 * @param {object} product
 * @returns {boolean}
 */
function hasChoiceAttribute(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  return variants.some((variant) => {
    const attributes = variant?.attributes
    if (!attributes || typeof attributes !== 'object') {
      return false
    }
    return Object.keys(attributes).some((key) => {
      const normalized = normalizeTr(key).trim()
      return VARIANT_ATTRIBUTE_KEYS.some((candidate) => normalized.includes(candidate))
    })
  })
}

/**
 * Bir ürünün varyant attribute değerlerini toplar.
 * @param {object} product
 * @returns {string[]}
 */
function variantAttributeValues(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const values = new Set()
  for (const variant of variants) {
    const attributes = variant?.attributes
    if (!attributes || typeof attributes !== 'object') continue
    for (const [key, value] of Object.entries(attributes)) {
      const normalizedKey = normalizeTr(key).trim()
      if (VARIANT_ATTRIBUTE_KEYS.some((candidate) => normalizedKey.includes(candidate))) {
        const text = String(value ?? '').trim()
        if (text) values.add(text)
      }
    }
  }
  return Array.from(values)
}

/**
 * Başlıkta bir renk kelimesi geçiyor mu?
 * @param {string} title
 * @returns {boolean}
 */
function containsColor(title) {
  const tokens = new Set(tokenize(title))
  return COLOR_WORDS.some((color) => tokens.has(normalizeTr(color)))
}

/**
 * İki başlıktaki renk kelimeleri farklı mı?
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function hasDifferentColor(a, b) {
  const colorsA = new Set(
    tokenize(a).filter((token) => COLOR_WORDS.some((c) => normalizeTr(c) === token))
  )
  const colorsB = new Set(
    tokenize(b).filter((token) => COLOR_WORDS.some((c) => normalizeTr(c) === token))
  )
  if (colorsA.size === 0 || colorsB.size === 0) {
    return false
  }
  for (const color of colorsA) {
    if (!colorsB.has(color)) {
      return true
    }
  }
  return false
}

/**
 * İki başlığın ortak önek (ilk N kelime) uzunluğunu döndürür.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function commonPrefixLength(a, b) {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  const limit = Math.min(tokensA.length, tokensB.length)
  let count = 0
  for (let i = 0; i < limit; i += 1) {
    if (tokensA[i] !== tokensB[i]) break
    count += 1
  }
  return count
}

/**
 * İki ürünün aynı varyant ailesine ait olup olmadığını belirler.
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function isVariantFamilyPair(a, b) {
  if (commonPrefixLength(a.name, b.name) < 3) {
    return false
  }
  if (!containsColor(a.name) || !containsColor(b.name)) {
    return false
  }
  if (!hasDifferentColor(a.name, b.name)) {
    return false
  }
  const sameCategory = (a.category?.slug || '') === (b.category?.slug || '')
  const sameBrand = normalizeTr(a.brand || '') === normalizeTr(b.brand || '')
  return sameCategory || sameBrand
}

/**
 * İki ürünün aynı duplicate grubuna ait olup olmadığını belirler.
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function isPairMatch(a, b) {
  // Birebir aynı başlık (normalize edilmiş): fiyat/marka/kategori farkı ne
  // olursa olsun aynı ürün ailesidir. Trendyol aynı ürünü renk başına ayrı
  // kayıt olarak, farklı fiyatlarla ve farklı satıcı/marka ile döndürebiliyor
  // (ör. Kırmızı 211 TL, Siyah 152 TL; "Terapi" vs "SA Printpro").
  const normalizedA = normalizeTr(a.name).replace(/\s+/g, ' ').trim()
  const normalizedB = normalizeTr(b.name).replace(/\s+/g, ' ').trim()
  if (normalizedA === normalizedB && normalizedA.length > 0) {
    return true
  }

  const sameBrand = normalizeTr(a.brand || '') === normalizeTr(b.brand || '')
  const sameCategory = (a.category?.slug || '') === (b.category?.slug || '')
  if (!sameBrand && !sameCategory) {
    return false
  }

  const priceA = productPrice(a)
  const priceB = productPrice(b)
  const pricesClose =
    priceA <= 0 || priceB <= 0 || Math.abs(priceA - priceB) <= PRICE_TOLERANCE

  const similarity = titleSimilarity(a.name, b.name)
  if (similarity >= SIMILARITY_THRESHOLD && pricesClose) {
    return true
  }

  if (isVariantFamilyPair(a, b)) {
    return true
  }

  return false
}

/**
 * Bir grubun önerisini belirler.
 * @param {Array<object>} group
 * @param {number} minSimilarity
 * @returns {'merge'|'variant'|'distinct'}
 */
function classifyGroup(group, minSimilarity) {
  const prices = group.map(productPrice)
  const priced = prices.filter((price) => price > 0)
  const priceSpread =
    priced.length > 1 ? Math.max(...priced) - Math.min(...priced) : 0
  const pricesClose = priced.length <= 1 || priceSpread <= PRICE_TOLERANCE

  const allHaveChoice = group.every(hasChoiceAttribute)
  const distinctValues = new Set()
  for (const product of group) {
    for (const value of variantAttributeValues(product)) {
      distinctValues.add(normalizeTr(value))
    }
  }

  // Birebir duplicate: başlıklar neredeyse aynı VE fiyatlar yakın VE
  // varyant attribute değerleri tek (renk farkı yok).
  if (minSimilarity >= 98 && pricesClose && distinctValues.size <= 1) {
    return 'merge'
  }

  if (allHaveChoice && distinctValues.size > 1) {
    return 'variant'
  }

  const colorValues = new Set()
  for (const product of group) {
    for (const token of tokenize(product.name)) {
      if (COLOR_WORDS.some((color) => normalizeTr(color) === token)) {
        colorValues.add(token)
      }
    }
  }
  const sharesPrefix = group.every(
    (product) => commonPrefixLength(group[0].name, product.name) >= 3
  )
  if (sharesPrefix && colorValues.size > 1) {
    return 'variant'
  }

  // Başlıklar neredeyse aynı ama fiyat farkı varsa: aynı ürünün farklı
  // varyantları (renk başına ayrı kayıt) olarak değerlendirilir.
  if (minSimilarity >= 98) {
    return 'variant'
  }

  return 'distinct'
}

/**
 * Ürünleri duplicate gruplarına ayırır (transitive union-find).
 * @param {Array<object>} products
 * @returns {Array<object>}
 */
function findGroups(products) {
  const parent = new Map()
  const find = (id) => {
    let root = id
    while (parent.get(root) !== root) {
      root = parent.get(root)
    }
    let cursor = id
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor)
      parent.set(cursor, root)
      cursor = next
    }
    return root
  }
  const union = (a, b) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) {
      parent.set(rootB, rootA)
    }
  }

  for (const product of products) {
    parent.set(String(product.id), String(product.id))
  }

  for (let i = 0; i < products.length; i += 1) {
    for (let j = i + 1; j < products.length; j += 1) {
      if (isPairMatch(products[i], products[j])) {
        union(String(products[i].id), String(products[j].id))
      }
    }
  }

  const buckets = new Map()
  for (const product of products) {
    const root = find(String(product.id))
    if (!buckets.has(root)) {
      buckets.set(root, [])
    }
    buckets.get(root).push(product)
  }

  const groups = []
  for (const members of buckets.values()) {
    if (members.length <= 1) continue

    let minSimilarity = 100
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        minSimilarity = Math.min(
          minSimilarity,
          titleSimilarity(members[i].name, members[j].name)
        )
      }
    }

    groups.push({
      recommendation: classifyGroup(members, minSimilarity),
      minSimilarity: Math.round(minSimilarity * 10) / 10,
      members,
    })
  }

  const order = { merge: 0, variant: 1, distinct: 2 }
  groups.sort((a, b) => {
    const byType = order[a.recommendation] - order[b.recommendation]
    if (byType !== 0) return byType
    return b.members.length - a.members.length
  })

  return groups
}

// ---------------------------------------------------------------------------
// Master seçimi
// ---------------------------------------------------------------------------

/**
 * Bir ürünün "eksiksizlik" puanını hesaplar. Yüksek puan = daha iyi master.
 *
 * Kriterler (öncelik sırasıyla):
 *  1. Fiyatı geçerli (>0) olmalı — 0 TL kayıt asla master olmaz.
 *  2. Stoğu olmalı.
 *  3. Daha fazla görsel.
 *  4. Daha uzun açıklama.
 *  5. Daha fazla varyant.
 *
 * @param {object} product
 * @returns {number}
 */
function masterScore(product) {
  const price = productPrice(product)
  const stock = productStock(product)
  const images = Array.isArray(product.images) ? product.images.length : 0
  const description = String(product.descriptionHtml || '').length
  const variants = Array.isArray(product.variants) ? product.variants.length : 0

  // Fiyat geçerliliği en ağır kriter (0 TL master seçilmesin).
  const priceScore = price > 0 ? 1_000_000 : 0
  const stockScore = stock > 0 ? 100_000 : 0
  const imageScore = images * 1_000
  const descriptionScore = description
  const variantScore = variants * 10

  return priceScore + stockScore + imageScore + descriptionScore + variantScore
}

/**
 * Bir grup için master ürünü seçer.
 * @param {Array<object>} members
 * @returns {object}
 */
function selectMaster(members) {
  return [...members].sort((a, b) => {
    const diff = masterScore(b) - masterScore(a)
    if (diff !== 0) return diff
    // Eşitlikte daha düşük id (daha eski kayıt) tercih edilir — deterministik.
    return String(a.id).localeCompare(String(b.id))
  })[0]
}

// ---------------------------------------------------------------------------
// Birleştirme işlemleri
// ---------------------------------------------------------------------------

/**
 * Bir varyantın görünen seçim kimliğini üretir (tekilleştirme için).
 * @param {object} variant
 * @returns {string}
 */
function variantSignature(variant) {
  const attributes = variant?.attributes
  const normalizedAttributes =
    attributes && typeof attributes === 'object'
      ? Object.entries(attributes)
          .map(([key, value]) => [
            normalizeTr(key).trim(),
            String(value ?? '').trim(),
          ])
          .sort((a, b) => a[0].localeCompare(b[0], 'tr-TR'))
      : []
  return JSON.stringify({
    attributes: normalizedAttributes,
    price: Number(variant?.price) || 0,
    salePrice: Number(variant?.salePrice) || 0,
    stock: Number(variant?.stock) || 0,
  })
}

/**
 * Master ürüne diğer üyelerin varyantlarını ekler (tekilleştirerek).
 * @param {object} master
 * @param {Array<object>} others
 * @returns {object} Güncellenmiş master (kopya).
 */
function mergeVariants(master, others) {
  const merged = { ...master }
  const variants = Array.isArray(master.variants) ? [...master.variants] : []
  const seen = new Set(variants.map((variant) => variantSignature(variant)))

  for (const other of others) {
    const otherVariants = Array.isArray(other.variants) ? other.variants : []
    for (const variant of otherVariants) {
      const signature = variantSignature(variant)
      if (seen.has(signature)) {
        continue
      }
      seen.add(signature)
      variants.push(variant)
    }
  }

  merged.variants = variants

  // Görselleri de birleştir (tekilleştirerek) — master'da olmayan kareler eklenir.
  const images = Array.isArray(master.images) ? [...master.images] : []
  const imageSet = new Set(images)
  for (const other of others) {
    const otherImages = Array.isArray(other.images) ? other.images : []
    for (const image of otherImages) {
      if (!imageSet.has(image)) {
        imageSet.add(image)
        images.push(image)
      }
    }
  }
  merged.images = images

  return merged
}

/**
 * Bir ürünün başlığını belirginleştirir (farklı ürün grupları için).
 *
 * Başlıkta zaten ayırt edici bir bilgi (yıl aralığı, derece, model kodu)
 * varsa dokunulmaz. Aksi halde varyant attribute değerleri (renk vb.)
 * başlığa eklenir.
 *
 * @param {object} product
 * @returns {string|null} Yeni başlık ya da değişiklik yoksa null.
 */
function clarifyTitle(product) {
  const name = String(product.name || '').trim()
  if (!name) return null

  // Zaten ayırt edici bilgi içeriyorsa (yıl aralığı, derece, ölçü) dokunma.
  if (/\d{4}\s*-\s*\d{4}/.test(name)) return null
  if (/\d+\s*(derece|°)/i.test(name)) return null
  if (/\d+\s*x\s*\d+/i.test(name)) return null

  // Varyant attribute değerlerinden ayırt edici bir etiket üret.
  const values = variantAttributeValues(product)
  if (values.length === 0) return null

  const label = values[0]
  if (!label) return null
  if (normalizeTr(name).includes(normalizeTr(label))) return null

  return `${name} — ${label}`
}

// ---------------------------------------------------------------------------
// Kalıcı redirect haritası
// ---------------------------------------------------------------------------

/**
 * `src/data/product-redirects.json` dosyasını okur.
 * @returns {Record<string, string>}
 */
function readRedirects() {
  if (!existsSync(REDIRECTS_PATH)) {
    return {}
  }
  try {
    const parsed = JSON.parse(readFileSync(REDIRECTS_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Redirect haritasını dosyaya yazar (deterministik sıralama ile).
 * @param {Record<string, string>} redirects
 */
function writeRedirects(redirects) {
  const sorted = {}
  for (const key of Object.keys(redirects).sort()) {
    sorted[key] = redirects[key]
  }
  writeFileSync(REDIRECTS_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

/**
 * `worker/index.js` içindeki `PRODUCT_REDIRECTS` bloğunu günceller.
 * Blok yoksa `CATEGORY_REDIRECTS`'ten sonra ekler.
 *
 * @param {Record<string, string>} redirects
 * @returns {boolean} Değişiklik yapıldı mı?
 */
function syncWorkerRedirects(redirects) {
  const source = readFileSync(WORKER_PATH, 'utf8')

  const entries = Object.keys(redirects)
    .sort()
    .map((slug) => `  '${slug}': '${redirects[slug]}',`)
    .join('\n')

  const block = `/**\n * FAZ 4 — G2.4: Birebir duplicate urunler birlestirildigi icin eski urun\n * slug'lari artik statik olarak URETILMEZ. Bu harita, eski urun URL'lerini\n * master urune kalici (301) olarak yonlendirir.\n *\n * Anahtar: eski urun slug'i. Deger: master urun slug'i.\n */\nconst PRODUCT_REDIRECTS = {\n${entries}\n};`

  const existing = /\/\*\*\n \* FAZ 4 — G2\.4[\s\S]*?const PRODUCT_REDIRECTS = \{[\s\S]*?\};/

  let updated
  if (existing.test(source)) {
    updated = source.replace(existing, block)
  } else {
    // CATEGORY_REDIRECTS blogundan sonra ekle.
    const anchor = /const CATEGORY_REDIRECTS = \{[\s\S]*?\};\n/
    if (!anchor.test(source)) {
      throw new Error('worker/index.js icinde CATEGORY_REDIRECTS blogu bulunamadi.')
    }
    updated = source.replace(anchor, (match) => `${match}\n${block}\n`)
  }

  if (updated === source) {
    return false
  }
  writeFileSync(WORKER_PATH, updated, 'utf8')
  return true
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const dryRun = !apply

  const data = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
  const products = Array.isArray(data) ? data : data.products || []
  const existingRedirects = readRedirects()

  const groups = findGroups(products)

  const mergeGroups = groups.filter((g) => g.recommendation === 'merge')
  const variantGroups = groups.filter((g) => g.recommendation === 'variant')
  const distinctGroups = groups.filter((g) => g.recommendation === 'distinct')

  console.log('='.repeat(78))
  console.log(`FAZ 4 — DUPLICATE BIRLESTIRME (${dryRun ? 'DRY-RUN' : 'APPLY'})`)
  console.log('='.repeat(78))
  console.log(`  Katalogdaki urun: ${products.length}`)
  console.log(`  Grup: ${groups.length} (merge:${mergeGroups.length} variant:${variantGroups.length} distinct:${distinctGroups.length})`)
  console.log(`  Mevcut redirect kaydi: ${Object.keys(existingRedirects).length}`)
  console.log('-'.repeat(78))

  const removedIds = new Set()
  const newRedirects = { ...existingRedirects }
  const titleChanges = []
  const masterUpdates = new Map()

  // --- 1. Birebir duplicate + varyant grupları: birleştir ---
  for (const group of [...mergeGroups, ...variantGroups]) {
    const master = selectMaster(group.members)
    const others = group.members.filter((m) => String(m.id) !== String(master.id))

    const masterPrice = productPrice(master)
    const masterStock = productStock(master)

    console.log(`\n[${group.recommendation.toUpperCase()}] master: ${master.id} (${masterPrice} TL, stok:${masterStock})`)
    console.log(`  "${master.name}"`)

    const merged = mergeVariants(master, others)
    masterUpdates.set(String(master.id), merged)

    for (const other of others) {
      removedIds.add(String(other.id))
      newRedirects[other.slug] = master.slug
      console.log(`  ↳ birleştir: ${other.id} "${other.name}"`)
      console.log(`     301: /urun/${other.slug} → /urun/${master.slug}`)
    }

    if (merged.variants.length !== (master.variants || []).length) {
      console.log(
        `  varyant: ${(master.variants || []).length} → ${merged.variants.length}`
      )
    }
  }

  // --- 2. Farklı ürün grupları: başlıkları belirginleştir ---
  for (const group of distinctGroups) {
    for (const product of group.members) {
      const newTitle = clarifyTitle(product)
      if (newTitle && newTitle !== product.name) {
        titleChanges.push({ id: String(product.id), from: product.name, to: newTitle })
      }
    }
  }

  if (titleChanges.length > 0) {
    console.log(`\n[DISTINCT] Başlık belirginleştirme (${titleChanges.length}):`)
    for (const change of titleChanges) {
      console.log(`  • ${change.id}`)
      console.log(`     - "${change.from}"`)
      console.log(`     + "${change.to}"`)
    }
  }

  // --- Özet ---
  const addedRedirects = Object.keys(newRedirects).filter(
    (slug) => !(slug in existingRedirects)
  )

  console.log('\n' + '-'.repeat(78))
  console.log(`  Kaldırılacak ürün: ${removedIds.size}`)
  console.log(`  Güncellenecek master: ${masterUpdates.size}`)
  console.log(`  Başlık değişikliği: ${titleChanges.length}`)
  console.log(`  Yeni 301 yönlendirme: ${addedRedirects.length}`)
  console.log(`  Toplam 301 yönlendirme: ${Object.keys(newRedirects).length}`)

  if (dryRun) {
    console.log('\n  ℹ️  DRY-RUN: hiçbir dosya yazılmadı. Uygulamak için --apply kullanın.')
    console.log('='.repeat(78))
    return
  }

  // --- Uygula ---
  const nextProducts = products
    .filter((product) => !removedIds.has(String(product.id)))
    .map((product) => {
      const updated = masterUpdates.get(String(product.id))
      if (updated) {
        return updated
      }
      const titleChange = titleChanges.find((c) => c.id === String(product.id))
      if (titleChange) {
        return { ...product, name: titleChange.to }
      }
      return product
    })

  const nextData = Array.isArray(data)
    ? nextProducts
    : { ...data, products: nextProducts }

  writeFileSync(PRODUCTS_PATH, `${JSON.stringify(nextData, null, 2)}\n`, 'utf8')
  writeRedirects(newRedirects)
  const workerChanged = syncWorkerRedirects(newRedirects)

  console.log('\n  ✅ Uygulandı:')
  console.log(`     - src/data/products.json (${products.length} → ${nextProducts.length} ürün)`)
  console.log(`     - src/data/product-redirects.json (${Object.keys(newRedirects).length} kayıt)`)
  console.log(`     - worker/index.js (${workerChanged ? 'güncellendi' : 'değişiklik yok'})`)
  console.log('='.repeat(78))
}

main()
