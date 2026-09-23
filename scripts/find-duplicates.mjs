#!/usr/bin/env node
/**
 * FAZ 4 — ADIM 2: DUPLICATE ÜRÜN TESPİT SCRIPT'İ (G2.5)
 *
 * `src/data/products.json` içindeki ürünleri tarar; başlık benzerliği (%90+),
 * yakın fiyat ve marka/kategori eşleşmesi kriterlerine göre olası duplicate
 * gruplarını bulur ve her grup için bir öneri üretir:
 *
 *   - "merge"   → Birebir duplicate; tek kayda indirilmeli (ADIM 3).
 *   - "variant" → Gerçek varyant (renk/beden/ölçü); varyant seçiciye taşınmalı.
 *   - "distinct"→ Gerçek farklı ürün; başlık belirginleştirilmeli.
 *
 * Kullanım:
 *   node scripts/find-duplicates.mjs            # insan okunabilir rapor
 *   node scripts/find-duplicates.mjs --json     # makine okunabilir JSON
 *   npm run find:duplicates
 *
 * Çıkış kodu: birebir duplicate (merge) grubu bulunursa 1, aksi halde 0.
 * Bu sayede CI'da "duplicate kalmadı" kontrolü olarak kullanılabilir.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PRODUCTS_PATH = join(ROOT, 'src/data/products.json')

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
 * İki başlık arasındaki benzerliği yüzde olarak hesaplar.
 * Token kümesi Jaccard benzerliği ile karakter bazlı benzerliğin en yükseğini
 * döndürür; böylece hem kelime sırası farkı hem de küçük yazım farkları
 * yakalanır.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–100 arası benzerlik yüzdesi
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

  // Karakter bazlı benzerlik (Levenshtein tabanlı oran).
  const normalizedA = normalizeTr(a).replace(/\s+/g, ' ').trim()
  const normalizedB = normalizeTr(b).replace(/\s+/g, ' ').trim()
  const charRatio = levenshteinRatio(normalizedA, normalizedB)

  return Math.max(jaccard, charRatio)
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
 * Bir ürünün temsili fiyatını döndürür (indirimli fiyat varsa o, yoksa liste).
 * Fiyatı 0/geçersiz olan ürünlerde 0 döner.
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
 * Bir ürünün varyant attribute değerlerini toplar (ör. renk değerleri).
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
 * Bir grubun önerisini belirler.
 *
 * Kurallar:
 *  - Başlıklar %98+ benzer VE fiyatlar yakın → "merge" (birebir duplicate).
 *  - Başlıklar benzer ama varyant attribute değerleri farklı (renk vb.) →
 *    "variant".
 *  - Aksi halde → "distinct" (gerçek farklı ürün).
 *
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

  // Gerçek varyant: her kayıtta seçim özelliği var ve farklı değerler mevcut.
  if (allHaveChoice && distinctValues.size > 1) {
    return 'variant'
  }

  // Gerçek varyant (attribute boş olsa bile): başlıklar ortak önek paylaşıyor
  // ve renk kelimeleri farklı (ör. "Yamaha R7 Jant Şeridi Kırmızı/Mavi ...").
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
 * Renk adları — varyant ailesi tespitinde kullanılır.
 */
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
 * İki başlıktaki renk kelimeleri farklı mı? (Aynı renk → varyant değil.)
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
 *
 * Kural: başlıkların ilk 3+ kelimesi ortak VE iki başlıktaki renk kelimeleri
 * farklı. Bu, "%90 başlık benzerliği" eşiğinin altında kalan gerçek varyant
 * ailelerini (ör. "Kask Kedi Pati ... Siyah" vs "... Beyaz") yakalar.
 *
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

  // Marka/kategori eşleşmesi: marka aynı VEYA kategori aynı olmalı.
  const sameBrand = normalizeTr(a.brand || '') === normalizeTr(b.brand || '')
  const sameCategory = (a.category?.slug || '') === (b.category?.slug || '')
  if (!sameBrand && !sameCategory) {
    return false
  }

  // Fiyat yakınlığı: ikisi de fiyatlıysa tolerans içinde olmalı.
  const priceA = productPrice(a)
  const priceB = productPrice(b)
  const pricesClose =
    priceA <= 0 || priceB <= 0 || Math.abs(priceA - priceB) <= PRICE_TOLERANCE

  const similarity = titleSimilarity(a.name, b.name)
  if (similarity >= SIMILARITY_THRESHOLD && pricesClose) {
    return true
  }

  // Eşik altı ama aynı varyant ailesi (renk varyantları).
  if (isVariantFamilyPair(a, b)) {
    return true
  }

  return false
}

/**
 * Ürünleri duplicate gruplarına ayırır.
 *
 * Gruplama transitive (zincirleme) yapılır: A~B ve B~C ise A, B, C aynı grupta
 * toplanır. Böylece 4 renkli bir varyant ailesi, ara üyelerin fiyat farkı
 * yüzünden parçalanmaz.
 *
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
    // Yol sıkıştırma.
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

    // Grup içi minimum benzerlik (en zayıf halka).
    let minSimilarity = 100
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        minSimilarity = Math.min(
          minSimilarity,
          titleSimilarity(members[i].name, members[j].name)
        )
      }
    }

    const recommendation = classifyGroup(members, minSimilarity)
    groups.push({
      recommendation,
      minSimilarity: Math.round(minSimilarity * 10) / 10,
      products: members.map((product) => ({
        id: String(product.id),
        name: product.name,
        slug: product.slug,
        brand: product.brand || '',
        category: product.category?.slug || '',
        price: productPrice(product),
        stock: productStock(product),
        images: Array.isArray(product.images) ? product.images.length : 0,
        descriptionLength: String(product.descriptionHtml || '').length,
        variantValues: variantAttributeValues(product),
      })),
    })
  }

  // En kritik gruplar (birleştirilecekler) önce gelsin.
  const order = { merge: 0, variant: 1, distinct: 2 }
  groups.sort((a, b) => {
    const byType = order[a.recommendation] - order[b.recommendation]
    if (byType !== 0) return byType
    return b.products.length - a.products.length
  })

  return groups
}

/**
 * İnsan okunabilir raporu basar.
 * @param {Array<object>} groups
 * @param {number} totalProducts
 */
function printReport(groups, totalProducts) {
  const label = {
    merge: '🔴 BİREBİR DUPLICATE → birleştir',
    variant: '🟡 GERÇEK VARYANT → varyant seçiciye taşı',
    distinct: '🟢 FARKLI ÜRÜN → başlığı belirginleştir',
  }

  console.log('='.repeat(78))
  console.log('FAZ 4 — DUPLICATE ÜRÜN TARAMASI')
  console.log('='.repeat(78))
  console.log(`  Taranan ürün: ${totalProducts}`)
  console.log(`  Bulunan grup: ${groups.length}`)
  console.log('-'.repeat(78))

  if (groups.length === 0) {
    console.log('  ✅ Duplicate grup bulunamadı.')
    console.log('='.repeat(78))
    return
  }

  groups.forEach((group, index) => {
    console.log(`\n[${index + 1}] ${label[group.recommendation]}`)
    console.log(`    Benzerlik: %${group.minSimilarity}`)
    for (const product of group.products) {
      const price = product.price > 0 ? `${product.price} TL` : '0 TL (geçersiz)'
      console.log(
        `    • ${product.id}  ${price}  stok:${product.stock}  ` +
          `görsel:${product.images}  açıklama:${product.descriptionLength}`
      )
      console.log(`      "${product.name}"`)
      if (product.variantValues.length > 0) {
        console.log(`      varyant değerleri: ${product.variantValues.join(', ')}`)
      }
    }
  })

  const mergeCount = groups.filter((g) => g.recommendation === 'merge').length
  const variantCount = groups.filter((g) => g.recommendation === 'variant').length
  const distinctCount = groups.filter((g) => g.recommendation === 'distinct').length

  console.log('\n' + '-'.repeat(78))
  console.log(
    `  Özet → birleştir: ${mergeCount}  |  varyant: ${variantCount}  |  ` +
      `farklı ürün: ${distinctCount}`
  )
  console.log('='.repeat(78))
}

function main() {
  const args = process.argv.slice(2)
  const asJson = args.includes('--json')

  const data = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
  const products = Array.isArray(data) ? data : data.products || []

  const groups = findGroups(products)

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalProducts: products.length,
          groupCount: groups.length,
          groups,
        },
        null,
        2
      )
    )
  } else {
    printReport(groups, products.length)
  }

  const mergeCount = groups.filter((g) => g.recommendation === 'merge').length
  process.exit(mergeCount > 0 ? 1 : 0)
}

main()
