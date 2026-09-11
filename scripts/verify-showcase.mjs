/**
 * Vitrin işlevleri doğrulama betiği.
 * Arama, varyant/fiyat reaktivitesi, WhatsApp CTA ve kategori filtreleme
 * mantığını gerçek ürün verisiyle test eder.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const productsData = JSON.parse(
  readFileSync(join(root, 'src/data/products.json'), 'utf8')
)
const { siteConfig } = await import(
  new URL('../src/config/site.js', import.meta.url).href
)
const shopierMap = JSON.parse(
  readFileSync(join(root, 'src/config/shopier.json'), 'utf8')
)

const products = productsData.products

// --- products.js mantığının birebir kopyası (Türkçe normalize) ---
function normalizeTr(str) {
  return str
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
}

function searchProducts(list, query) {
  const normalizedQuery = normalizeTr(String(query || '').trim())
  if (normalizedQuery === '') return list
  return list.filter((product) => {
    const name = normalizeTr(product.name || '')
    if (name.includes(normalizedQuery)) return true
    const categoryName = normalizeTr((product.category && product.category.name) || '')
    if (categoryName.includes(normalizedQuery)) return true
    if (Array.isArray(product.variants)) {
      return product.variants.some((variant) =>
        normalizeTr(variant.sku || '').includes(normalizedQuery)
      )
    }
    return false
  })
}

function getAllCategories() {
  const map = new Map()
  for (const product of products) {
    const category = product.category
    if (!category) continue
    const existing = map.get(category.id)
    if (existing) existing.count += 1
    else map.set(category.id, { id: category.id, name: category.name, slug: category.slug, count: 1 })
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

function getProductsByCategory(slug) {
  return products.filter((p) => p.category && p.category.slug === slug)
}

const line = (c = '=') => console.log(c.repeat(70))

// ============ 1. ARAMA DOĞRULAMASI ============
line()
console.log('1) ARAMA DOĞRULAMASI (234 ürün)')
line()
const queries = ['şerit', 'reflektif', 'kırmızı', 'serit', 'KIRMIZI', 'ŞERİT']
for (const q of queries) {
  const res = searchProducts(products, q)
  console.log(`  "${q}" -> ${res.length} eşleşme`)
  res.slice(0, 3).forEach((p) => console.log(`      • ${p.name}`))
}

// Türkçe karakter eşdeğerlik testi
console.log('\n  Türkçe karakter eşdeğerlik kontrolü:')
const pairs = [
  ['şerit', 'serit'],
  ['kırmızı', 'kirmizi'],
  ['reflektif', 'REFLEKTİF'],
]
for (const [a, b] of pairs) {
  const ca = searchProducts(products, a).length
  const cb = searchProducts(products, b).length
  console.log(`    "${a}" (${ca}) vs "${b}" (${cb}) -> ${ca === cb ? 'EŞİT ✓' : 'FARKLI ✗'}`)
}

// ============ 2. VARYANT & FİYAT REAKTİVİTESİ ============
line()
console.log('2) VARYANT & FİYAT REAKTİVİTESİ')
line()
const multiVariant = products
  .filter((p) => Array.isArray(p.variants) && p.variants.length > 1)
  .sort((a, b) => b.variants.length - a.variants.length)

console.log(`  Çoklu varyantlı ürün sayısı: ${multiVariant.length}`)

// Farklı fiyatlara sahip varyantı olan ürün bul
const priceVarying = multiVariant.find((p) => {
  const prices = new Set(p.variants.map((v) => Number(v.salePrice ?? v.price)))
  return prices.size > 1
})

const sample = priceVarying || multiVariant[0]
console.log(`\n  Örnek ürün: "${sample.name}" (${sample.variants.length} varyant)`)
console.log(`  Slug: /urun/${sample.slug}`)

sample.variants.slice(0, 6).forEach((v, i) => {
  const price = Number(v.price)
  const salePrice = Number(v.salePrice)
  const effPrice = Number.isFinite(price) && price > 0 ? price : 0
  const effSale = Number.isFinite(salePrice) && salePrice > 0 ? salePrice : effPrice
  const hasDiscount = effPrice > 0 && effSale > 0 && effSale < effPrice
  const rate = hasDiscount ? Math.round(((effPrice - effSale) / effPrice) * 100) : 0
  const attrs = v.attributes ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ') : ''
  console.log(
    `    [${i}] ${attrs || v.sku || 'Varyant ' + (i + 1)}`
  )
  console.log(
    `        liste=${effPrice} TL, satış=${effSale} TL, indirim=${hasDiscount ? '%' + rate : 'yok'}, stok=${v.stock}`
  )
})

// ============ 3. WHATSAPP CTA ============
line()
console.log('3) WHATSAPP SİPARİŞ CTA')
line()
const whatsappNumber = String(siteConfig.contact.whatsapp || '').replace(/\D/g, '')
console.log(`  WhatsApp numarası (temizlenmiş): ${whatsappNumber}`)

function formatAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') return ''
  return Object.entries(attributes).map(([key, value]) => `${key}: ${value}`).join(', ')
}

const waVariant = sample.variants[0]
const attributeSummary = formatAttributes(waVariant.attributes)
const barcode = waVariant.barcode || ''
const whatsappMessage = `Merhaba, ${sample.name} (${
  attributeSummary || 'Varsayılan'
} - Barkod: ${barcode}) siparişi vermek istiyorum.`
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`

console.log(`\n  Ham mesaj:\n    ${whatsappMessage}`)
console.log(`\n  URL-encoded mesaj:\n    ${encodeURIComponent(whatsappMessage)}`)
console.log(`\n  Tam URL:\n    ${whatsappUrl}`)
console.log(`\n  İçerik kontrolü:`)
console.log(`    Ürün adı içeriyor mu? ${whatsappMessage.includes(sample.name) ? 'EVET ✓' : 'HAYIR ✗'}`)
console.log(`    Varyant adı içeriyor mu? ${attributeSummary ? (whatsappMessage.includes(attributeSummary) ? 'EVET ✓' : 'HAYIR ✗') : 'Varyant attribute yok'}`)
console.log(`    Barkod içeriyor mu? ${whatsappMessage.includes(barcode) ? 'EVET ✓' : 'HAYIR ✗'}`)
console.log(`    URL-encoded (boşluk %20)? ${whatsappUrl.includes('%20') ? 'EVET ✓' : 'HAYIR ✗'}`)

// Shopier eşleşmesi
const shopierUrl = shopierMap[barcode]
console.log(`\n  Shopier eşleşmesi (barkod ${barcode}): ${shopierUrl ? shopierUrl : 'YOK (WhatsApp fallback)'}`)

// ============ 4. FİLTRELER & KATEGORİ SAYFALARI ============
line()
console.log('4) FİLTRELER & KATEGORİ SAYFALARI')
line()
const categories = getAllCategories()
console.log(`  Toplam kategori: ${categories.length}`)
console.log(`  Kategori toplam ürün: ${categories.reduce((s, c) => s + c.count, 0)}`)
console.log('\n  Kategori rotaları:')
categories.forEach((c) => {
  const catProducts = getProductsByCategory(c.slug)
  const match = catProducts.length === c.count
  console.log(
    `    /kategori/${c.slug} -> "${c.name}" | ${catProducts.length} ürün | sayaç=${c.count} ${match ? '✓' : '✗'}`
  )
})

// Stok filtresi testi
const inStockCount = products.filter((p) =>
  Array.isArray(p.variants) && p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0) > 0
).length
console.log(`\n  Stokta olan ürün (inStock filtresi): ${inStockCount}/${products.length}`)

line()
console.log('DOĞRULAMA TAMAMLANDI')
line()
