/**
 * Deep diagnostic script for the SA Printpro Trendyol V2 catalog.
 * Scans src/data/products.json across data hygiene, pricing anomalies,
 * variant integrity, XSS risk and category quality.
 *
 * Run: node scripts/diagnose.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataPath = resolve(__dirname, '../src/data/products.json')
const raw = readFileSync(dataPath, 'utf8')
const data = JSON.parse(raw)
const products = data.products || []

const report = {
  meta: {
    generatedAt: data.generatedAt,
    totalProducts: products.length,
    fileSizeBytes: Buffer.byteLength(raw, 'utf8'),
  },
  images: {
    noImages: [],
    emptyStringImage: [],
    invalidUrl: [],
    nonHttps: [],
    totalImageCount: 0,
  },
  pricing: {
    zeroOrInvalid: [],
    saleAboveList: [],
    missingPrice: [],
    hugeDiscount: [],
  },
  variants: {
    noVariants: [],
    missingBarcode: [],
    missingSku: [],
    nullAttributes: [],
    emptyAttributes: [],
    zeroStockAll: [],
    duplicateBarcodes: [],
  },
  xss: {
    scriptTags: [],
    iframeTags: [],
    javascriptProtocol: [],
    inlineHandlers: [],
    objectEmbed: [],
    suspiciousTags: [],
  },
  categories: {
    missing: [],
    emptyName: [],
    emptySlug: [],
    list: {},
  },
  description: {
    empty: [],
    veryLong: [],
    containsHtml: 0,
    plainText: 0,
  },
}

const XSS_PATTERNS = [
  { key: 'scriptTags', re: /<script[\s>]/i },
  { key: 'iframeTags', re: /<iframe[\s>]/i },
  { key: 'javascriptProtocol', re: /javascript:/i },
  { key: 'inlineHandlers', re: /\son[a-z]+\s*=/i },
  { key: 'objectEmbed', re: /<(object|embed|applet)[\s>]/i },
  { key: 'suspiciousTags', re: /<(svg|form|meta|link|base)[\s>]/i },
]

const barcodeSeen = new Map()

for (const p of products) {
  const id = p.id || p.slug || '(no-id)'

  // ---- Images ----
  const images = Array.isArray(p.images) ? p.images : []
  report.images.totalImageCount += images.length
  if (images.length === 0) {
    report.images.noImages.push(id)
  }
  for (const img of images) {
    if (typeof img !== 'string' || img.trim() === '') {
      report.images.emptyStringImage.push({ id, img })
      continue
    }
    if (!/^https?:\/\//i.test(img)) {
      report.images.invalidUrl.push({ id, img })
    } else if (!/^https:\/\//i.test(img)) {
      report.images.nonHttps.push({ id, img })
    }
  }

  // ---- Variants ----
  const variants = Array.isArray(p.variants) ? p.variants : []
  if (variants.length === 0) {
    report.variants.noVariants.push(id)
  }

  let totalStock = 0
  for (const v of variants) {
    totalStock += Number(v.stock) || 0

    if (!v.barcode || String(v.barcode).trim() === '') {
      report.variants.missingBarcode.push({ id, sku: v.sku })
    } else {
      const key = String(v.barcode)
      if (barcodeSeen.has(key)) {
        report.variants.duplicateBarcodes.push({
          barcode: key,
          first: barcodeSeen.get(key),
          second: id,
        })
      } else {
        barcodeSeen.set(key, id)
      }
    }

    if (!v.sku || String(v.sku).trim() === '') {
      report.variants.missingSku.push({ id, barcode: v.barcode })
    }

    if (v.attributes === null || v.attributes === undefined) {
      report.variants.nullAttributes.push({ id, barcode: v.barcode })
    } else if (
      typeof v.attributes === 'object' &&
      Object.keys(v.attributes).length === 0
    ) {
      report.variants.emptyAttributes.push({ id, barcode: v.barcode })
    }

    // ---- Pricing ----
    const price = Number(v.price)
    const salePrice = Number(v.salePrice)
    const hasValidPrice = Number.isFinite(price) && price > 0
    const hasValidSale = Number.isFinite(salePrice) && salePrice > 0

    if (!hasValidPrice && !hasValidSale) {
      report.pricing.missingPrice.push({ id, barcode: v.barcode, price: v.price, salePrice: v.salePrice })
    } else if (!hasValidSale && hasValidPrice) {
      // salePrice 0/geçersiz ama liste fiyatı var → Trendyol satışta değil
      report.pricing.zeroOrInvalid.push({
        id,
        barcode: v.barcode,
        price: v.price,
        salePrice: v.salePrice,
      })
    }

    if (hasValidPrice && hasValidSale && salePrice > price) {
      report.pricing.saleAboveList.push({
        id,
        barcode: v.barcode,
        price,
        salePrice,
      })
    }

    if (hasValidPrice && hasValidSale && salePrice < price) {
      const rate = ((price - salePrice) / price) * 100
      if (rate > 90) {
        report.pricing.hugeDiscount.push({
          id,
          barcode: v.barcode,
          price,
          salePrice,
          rate: Math.round(rate),
        })
      }
    }
  }

  if (variants.length > 0 && totalStock === 0) {
    report.variants.zeroStockAll.push(id)
  }

  // ---- XSS ----
  const html = String(p.descriptionHtml || '')
  for (const { key, re } of XSS_PATTERNS) {
    if (re.test(html)) {
      report.xss[key].push(id)
    }
  }

  // ---- Description ----
  if (html.trim() === '') {
    report.description.empty.push(id)
  } else {
    if (/<[a-z][\s\S]*>/i.test(html)) {
      report.description.containsHtml += 1
    } else {
      report.description.plainText += 1
    }
    if (html.length > 5000) {
      report.description.veryLong.push({ id, length: html.length })
    }
  }

  // ---- Categories ----
  const cat = p.category
  if (!cat) {
    report.categories.missing.push(id)
  } else {
    if (!cat.name || String(cat.name).trim() === '') {
      report.categories.emptyName.push(id)
    }
    if (!cat.slug || String(cat.slug).trim() === '') {
      report.categories.emptySlug.push(id)
    }
    const key = cat.slug || cat.id || '(none)'
    if (!report.categories.list[key]) {
      report.categories.list[key] = { name: cat.name, id: cat.id, count: 0 }
    }
    report.categories.list[key].count += 1
  }
}

// ---- Summary ----
const sum = (arr) => arr.length
const summary = {
  'Toplam ürün': report.meta.totalProducts,
  'JSON boyutu (KB)': Math.round(report.meta.fileSizeBytes / 1024),
  'Toplam görsel': report.images.totalImageCount,
  'Görselsiz ürün': sum(report.images.noImages),
  'Boş string görsel': sum(report.images.emptyStringImage),
  'Geçersiz URL görsel': sum(report.images.invalidUrl),
  'HTTP (non-https) görsel': sum(report.images.nonHttps),
  'Fiyatı geçersiz varyant': sum(report.pricing.missingPrice),
  'salePrice=0/geçersiz varyant': sum(report.pricing.zeroOrInvalid),
  'Liste < Satış (anomali)': sum(report.pricing.saleAboveList),
  '%90+ indirim': sum(report.pricing.hugeDiscount),
  'Varyantsız ürün': sum(report.variants.noVariants),
  'Barkodsuz varyant': sum(report.variants.missingBarcode),
  'SKU eksik varyant': sum(report.variants.missingSku),
  'null attributes': sum(report.variants.nullAttributes),
  'boş attributes': sum(report.variants.emptyAttributes),
  'Tümü stok=0 ürün': sum(report.variants.zeroStockAll),
  'Tekrarlanan barkod': sum(report.variants.duplicateBarcodes),
  '<script> içeren': sum(report.xss.scriptTags),
  '<iframe> içeren': sum(report.xss.iframeTags),
  'javascript: içeren': sum(report.xss.javascriptProtocol),
  'inline on* handler': sum(report.xss.inlineHandlers),
  'object/embed/applet': sum(report.xss.objectEmbed),
  'svg/form/meta/link/base': sum(report.xss.suspiciousTags),
  'Boş açıklama': sum(report.description.empty),
  'HTML içeren açıklama': report.description.containsHtml,
  'Düz metin açıklama': report.description.plainText,
  'Kategorisiz ürün': sum(report.categories.missing),
  'Toplam kategori': Object.keys(report.categories.list).length,
}

console.log('\n==================== ÖZET ====================')
for (const [k, v] of Object.entries(summary)) {
  console.log(`${k.padEnd(32, '.')} ${v}`)
}

console.log('\n==================== DETAY ====================')
console.log('\n--- Görselsiz ürünler ---')
console.log(report.images.noImages.join(', ') || '(yok)')

console.log('\n--- Boş/geçersiz görsel URL ---')
console.log(JSON.stringify(report.images.emptyStringImage.concat(report.images.invalidUrl), null, 2))

console.log('\n--- Fiyat anomalileri (liste < satış) ---')
console.log(JSON.stringify(report.pricing.saleAboveList, null, 2))

console.log('\n--- %90+ indirim ---')
console.log(JSON.stringify(report.pricing.hugeDiscount, null, 2))

console.log('\n--- Barkodsuz varyantlar ---')
console.log(JSON.stringify(report.variants.missingBarcode, null, 2))

console.log('\n--- Tekrarlanan barkodlar ---')
console.log(JSON.stringify(report.variants.duplicateBarcodes, null, 2))

console.log('\n--- XSS riskli ürünler ---')
console.log(JSON.stringify(report.xss, null, 2))

console.log('\n--- Kategori dağılımı ---')
const cats = Object.entries(report.categories.list)
  .map(([slug, v]) => ({ slug, ...v }))
  .sort((a, b) => b.count - a.count)
console.log(JSON.stringify(cats, null, 2))

console.log('\n--- Boş açıklamalı ürünler ---')
console.log(report.description.empty.join(', ') || '(yok)')

console.log('\n--- Çok uzun açıklamalar (>5000) ---')
console.log(JSON.stringify(report.description.veryLong, null, 2))

console.log('\n--- Tümü stok=0 ürünler ---')
console.log(report.variants.zeroStockAll.join(', ') || '(yok)')
