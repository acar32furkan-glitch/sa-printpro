/**
 * QA Audit script — SA Printpro
 *
 * dist/ çıktısını tarayarak şunları denetler:
 *  1. Kırık dahili linkler (<a href>) ve eksik kaynaklar (<img src/srcset>)
 *  2. SEO meta etiketleri (title, description, canonical, og, twitter)
 *  3. JSON-LD bloklarının parse edilebilirliği ve zorunlu alanları
 *  4. Erişilebilirlik (img alt, buton/link erişilebilir isim, form label)
 *  5. Uç durumlar (boş isim, uzun başlık, slug tekrarı, özel karakter)
 *
 * Kullanım: node scripts/qa-audit.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')
const PUBLIC = join(ROOT, 'public')

const findings = []
function add(category, finding, severity, detail = '') {
  findings.push({ category, finding, severity, detail })
}

/** dist/ altındaki tüm dosyaları özyinelemeli topla. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

if (!existsSync(DIST)) {
  console.error('dist/ bulunamadı. Önce `npm run build` çalıştırın.')
  process.exit(1)
}

const allFiles = walk(DIST)
// Google Search Console doğrulama dosyası gerçek bir sayfa değildir; SEO
// denetiminden hariç tutulur.
const NON_PAGE_HTML = /google[0-9a-f]+\.html$/i
const htmlFiles = allFiles.filter(
  (f) => extname(f) === '.html' && !NON_PAGE_HTML.test(f)
)
const distRel = new Set(allFiles.map((f) => '/' + relative(DIST, f).replace(/\\/g, '/')))

/** Bir URL yolunun dist/ içinde karşılığı var mı? */
function distHas(urlPath) {
  const clean = urlPath.split('#')[0].split('?')[0]
  if (clean === '' || clean === '/') return distRel.has('/index.html')
  if (distRel.has(clean)) return true
  if (distRel.has(clean + '/index.html')) return true
  if (distRel.has(clean + '.html')) return true
  return false
}

// ---------------------------------------------------------------------------
// 1) KIRIK LİNK & EKSİK KAYNAK
// ---------------------------------------------------------------------------
const brokenLinks = new Map()
const brokenAssets = new Map()
const emptyAssets = []

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  const page = '/' + relative(DIST, file).replace(/\\/g, '/')

  // <a href="...">
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const href = m[1]
    if (
      href.startsWith('http') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('#') ||
      href.startsWith('data:') ||
      href.startsWith('javascript:')
    ) {
      continue
    }
    if (!href.startsWith('/')) continue
    if (!distHas(href)) {
      if (!brokenLinks.has(href)) brokenLinks.set(href, new Set())
      brokenLinks.get(href).add(page)
    }
  }

  // <img src="..."> ve srcset
  const imgSrcs = []
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    imgSrcs.push(m[1])
  }
  for (const m of html.matchAll(/<img\b[^>]*\bsrcset=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0]
      if (url) imgSrcs.push(url)
    }
  }
  for (const src of imgSrcs) {
    if (src.startsWith('http') || src.startsWith('data:')) continue
    if (!src.startsWith('/')) continue
    if (!distHas(src)) {
      if (!brokenAssets.has(src)) brokenAssets.set(src, new Set())
      brokenAssets.get(src).add(page)
    }
  }
}

for (const [href, pages] of brokenLinks) {
  add(
    'Kırık Link',
    `Dahili link hedefi dist/ içinde yok: ${href}`,
    'Kritik',
    `${pages.size} sayfada (ör. ${[...pages][0]})`
  )
}
for (const [src, pages] of brokenAssets) {
  add(
    'Eksik Kaynak',
    `Görsel/asset dist/ içinde yok: ${src}`,
    'Kritik',
    `${pages.size} sayfada (ör. ${[...pages][0]})`
  )
}

// 0 byte / bozuk asset kontrolü
for (const f of allFiles) {
  const st = statSync(f)
  if (st.size === 0) {
    emptyAssets.push('/' + relative(DIST, f).replace(/\\/g, '/'))
  }
}
for (const a of emptyAssets) {
  add('Bozuk Asset', `0 byte dosya: ${a}`, 'Orta', '')
}

// ---------------------------------------------------------------------------
// 2) SEO META DENETİMİ
// ---------------------------------------------------------------------------
const seoIssues = []
const titleMap = new Map()
const descMap = new Map()

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  const page = '/' + relative(DIST, file).replace(/\\/g, '/')

  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
  const desc =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || ''
  const canonical =
    html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1] || ''
  const ogTitle =
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i)?.[1] || ''
  const ogDesc =
    html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i)?.[1] || ''
  const ogImage =
    html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i)?.[1] || ''
  const ogUrl =
    html.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']*)["']/i)?.[1] || ''
  const twitterCard =
    html.match(/<meta\s+name=["']twitter:card["']\s+content=["']([^"']*)["']/i)?.[1] || ''

  if (!title) seoIssues.push(`${page}: <title> boş/eksik`)
  if (!desc) seoIssues.push(`${page}: meta description boş/eksik`)
  if (desc.length > 160)
    seoIssues.push(`${page}: meta description ${desc.length} karakter (>160)`)
  if (!canonical) seoIssues.push(`${page}: canonical eksik`)
  if (canonical && !canonical.startsWith('https://saprintpro.com'))
    seoIssues.push(`${page}: canonical domain hatalı → ${canonical}`)
  if (!ogTitle) seoIssues.push(`${page}: og:title eksik`)
  if (!ogDesc) seoIssues.push(`${page}: og:description eksik`)
  if (!ogImage) seoIssues.push(`${page}: og:image eksik`)
  if (!ogUrl) seoIssues.push(`${page}: og:url eksik`)
  if (!twitterCard) seoIssues.push(`${page}: twitter:card eksik`)

  if (title) {
    if (!titleMap.has(title)) titleMap.set(title, [])
    titleMap.get(title).push(page)
  }
  if (desc) {
    if (!descMap.has(desc)) descMap.set(desc, [])
    descMap.get(desc).push(page)
  }
}

for (const issue of seoIssues) {
  add('SEO Meta', issue, 'Orta', '')
}
for (const [title, pages] of titleMap) {
  if (pages.length > 1) {
    add(
      'SEO Meta',
      `Tekrarlanan <title> (${pages.length} sayfa): "${title.slice(0, 70)}"`,
      'Orta',
      pages.slice(0, 3).join(', ')
    )
  }
}
for (const [desc, pages] of descMap) {
  if (pages.length > 1) {
    add(
      'SEO Meta',
      `Tekrarlanan meta description (${pages.length} sayfa): "${desc.slice(0, 70)}"`,
      'Düşük',
      pages.slice(0, 3).join(', ')
    )
  }
}

// ---------------------------------------------------------------------------
// 3) JSON-LD DOĞRULAMA
// ---------------------------------------------------------------------------
let jsonLdCount = 0
const jsonLdErrors = []
const productSchemaIssues = []

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  const page = '/' + relative(DIST, file).replace(/\\/g, '/')

  for (const m of html.matchAll(
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    jsonLdCount += 1
    const raw = m[1].trim()
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      jsonLdErrors.push(`${page}: JSON parse hatası → ${err.message}`)
      continue
    }

    const blocks = Array.isArray(parsed) ? parsed : [parsed]
    for (const block of blocks) {
      if (block['@type'] === 'Product') {
        if (!block.name) productSchemaIssues.push(`${page}: Product.name eksik`)
        if (!block.image) productSchemaIssues.push(`${page}: Product.image eksik`)
        // NOT: Fiyatı olmayan ürünlerde `offers` bloğu bilinçli olarak
        // atlanır (Google Merchant "0 TL" hatasını önlemek için). Bu yüzden
        // offers'ın yokluğu tek başına hata değildir; yalnızca VARSA
        // zorunlu alanları doğrularız.
        if (block.offers) {
          const o = block.offers
          if (o.priceCurrency === undefined)
            productSchemaIssues.push(`${page}: offers.priceCurrency eksik`)
          if (o.availability === undefined)
            productSchemaIssues.push(`${page}: offers.availability eksik`)
          if (o['@type'] === 'AggregateOffer') {
            if (o.lowPrice === undefined)
              productSchemaIssues.push(`${page}: AggregateOffer.lowPrice eksik`)
            if (Number(o.lowPrice) === 0)
              productSchemaIssues.push(
                `${page}: offers.lowPrice = 0 (Google Merchant riski)`
              )
          } else if (o.price === undefined) {
            productSchemaIssues.push(`${page}: offers.price eksik`)
          }
        }
      }
    }
  }
}

for (const e of jsonLdErrors) add('JSON-LD', e, 'Kritik', '')
for (const e of productSchemaIssues) add('JSON-LD', e, 'Orta', '')

// ---------------------------------------------------------------------------
// 4) ERİŞİLEBİLİRLİK
// ---------------------------------------------------------------------------
const a11yIssues = []
const missingAlt = new Map()
const emptyAlt = new Map()
const noAccessibleName = new Map()

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  const page = '/' + relative(DIST, file).replace(/\\/g, '/')

  // <img> alt kontrolü
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i)
    const src = tag.match(/\bsrc=["']([^"']*)["']/i)?.[1] || '(src yok)'
    if (!altMatch) {
      if (!missingAlt.has(src)) missingAlt.set(src, new Set())
      missingAlt.get(src).add(page)
    } else if (altMatch[1].trim() === '') {
      // Dekoratif olabilir; sadece raporla
      if (!emptyAlt.has(src)) emptyAlt.set(src, new Set())
      emptyAlt.get(src).add(page)
    }
  }

  // <button> erişilebilir isim
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attrs = m[1]
    const inner = m[2].replace(/<[^>]*>/g, '').trim()
    const hasAria = /\baria-label=["'][^"']+["']/i.test(attrs)
    const hasTitle = /\btitle=["'][^"']+["']/i.test(attrs)
    if (!inner && !hasAria && !hasTitle) {
      const key = attrs.slice(0, 80)
      if (!noAccessibleName.has(key)) noAccessibleName.set(key, new Set())
      noAccessibleName.get(key).add(page)
    }
  }

  // <a> erişilebilir isim (içi boş ve aria-label yok)
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1]
    const inner = m[2].replace(/<[^>]*>/g, '').trim()
    const hasAria = /\baria-label=["'][^"']+["']/i.test(attrs)
    const hasImgAlt = /<img\b[^>]*\balt=["'][^"']+["']/i.test(m[2])
    if (!inner && !hasAria && !hasImgAlt) {
      const key = attrs.slice(0, 80)
      if (!noAccessibleName.has(key)) noAccessibleName.set(key, new Set())
      noAccessibleName.get(key).add(page)
    }
  }
}

for (const [src, pages] of missingAlt) {
  add(
    'A11Y',
    `<img> alt özniteliği yok: ${src}`,
    'Orta',
    `${pages.size} sayfada (ör. ${[...pages][0]})`
  )
}
for (const [src, pages] of emptyAlt) {
  add(
    'A11Y',
    `<img> alt boş (dekoratif olabilir): ${src}`,
    'Düşük',
    `${pages.size} sayfada`
  )
}
for (const [key, pages] of noAccessibleName) {
  add(
    'A11Y',
    `Erişilebilir ismi olmayan buton/link: ${key}`,
    'Orta',
    `${pages.size} sayfada (ör. ${[...pages][0]})`
  )
}

// ---------------------------------------------------------------------------
// 5) UÇ DURUMLAR (products.json)
// ---------------------------------------------------------------------------
const productsPath = join(ROOT, 'src', 'data', 'products.json')
const productsData = JSON.parse(readFileSync(productsPath, 'utf8'))
const products = productsData.products || []

const slugSeen = new Map()
let emptyName = 0
let noImage = 0
let longName = 0
let specialChars = 0
const longNameSamples = []
const specialSamples = []

for (const p of products) {
  if (!p.name || String(p.name).trim() === '') emptyName += 1
  if (!Array.isArray(p.images) || p.images.length === 0) noImage += 1
  if (p.name && String(p.name).length > 100) {
    longName += 1
    if (longNameSamples.length < 3)
      longNameSamples.push(`${String(p.name).length} kr: ${String(p.name).slice(0, 60)}…`)
  }
  if (p.name && /[<>&"']/.test(String(p.name))) {
    specialChars += 1
    if (specialSamples.length < 3) specialSamples.push(String(p.name).slice(0, 60))
  }
  const slug = p.slug
  if (!slug || String(slug).trim() === '') {
    add('Uç Durum', `Boş slug: id=${p.id}`, 'Kritik', '')
  } else {
    if (!slugSeen.has(slug)) slugSeen.set(slug, [])
    slugSeen.get(slug).push(p.id)
  }
}

if (emptyName > 0) add('Uç Durum', `name boş/null ürün sayısı: ${emptyName}`, 'Kritik', '')
if (noImage > 0) add('Uç Durum', `Görseli olmayan ürün sayısı: ${noImage}`, 'Orta', '')
if (longName > 0)
  add('Uç Durum', `100+ karakter isimli ürün: ${longName}`, 'Düşük', longNameSamples.join(' | '))
if (specialChars > 0)
  add(
    'Uç Durum',
    `Özel karakter (<>&"') içeren isim: ${specialChars}`,
    'Düşük',
    specialSamples.join(' | ')
  )
for (const [slug, ids] of slugSeen) {
  if (ids.length > 1) {
    add('Uç Durum', `Tekrarlanan slug: "${slug}"`, 'Kritik', `id'ler: ${ids.join(', ')}`)
  }
}

// Görsel dosya sayısı vs ürün id sayısı
const uploadsDir = join(PUBLIC, 'uploads', 'products')
let uploadCount = 0
if (existsSync(uploadsDir)) {
  uploadCount = readdirSync(uploadsDir).filter((f) => f.endsWith('.webp')).length
}
const uniqueIds = new Set(products.map((p) => String(p.id)))
const missingImages = [...uniqueIds].filter(
  (id) => !existsSync(join(uploadsDir, `${id}.webp`))
)
add(
  'Kaynak',
  `public/uploads/products: ${uploadCount} webp / ${uniqueIds.size} benzersiz ürün id`,
  'Bilgi',
  missingImages.length > 0
    ? `${missingImages.length} ürün için yerel görsel yok (CDN fallback)`
    : 'Tüm ürünlerin yerel görseli var'
)

// featured.js slug eşleşmesi — yalnızca `featuredSlugs` dizisinin içeriğini
// ayrıştır (yorum satırlarındaki tırnaklı metinleri hariç tut).
const featuredSrc = readFileSync(join(ROOT, 'src', 'config', 'featured.js'), 'utf8')
const arrayMatch = featuredSrc.match(/featuredSlugs\s*=\s*\[([\s\S]*?)\]/)
const featuredSlugs = arrayMatch
  ? [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  : []
const allSlugs = new Set(products.map((p) => p.slug))
for (const fs of featuredSlugs) {
  if (!allSlugs.has(fs)) {
    add('Uç Durum', `featured.js slug ürünlerle eşleşmiyor: ${fs}`, 'Orta', '')
  }
}

// ---------------------------------------------------------------------------
// RAPOR
// ---------------------------------------------------------------------------
const order = { Kritik: 0, Orta: 1, Düşük: 2, Bilgi: 3 }
findings.sort((a, b) => order[a.severity] - order[b.severity])

console.log('\n================ QA AUDIT RAPORU ================')
console.log(`Taranan HTML sayfası: ${htmlFiles.length}`)
console.log(`Toplam dist dosyası : ${allFiles.length}`)
console.log(`JSON-LD blok sayısı : ${jsonLdCount}`)
console.log(`Ürün sayısı         : ${products.length}`)
console.log('-------------------------------------------------')

const counts = { Kritik: 0, Orta: 0, Düşük: 0, Bilgi: 0 }
for (const f of findings) {
  counts[f.severity] = (counts[f.severity] || 0) + 1
  console.log(`[${f.severity}] (${f.category}) ${f.finding}`)
  if (f.detail) console.log(`         → ${f.detail}`)
}
console.log('-------------------------------------------------')
console.log(
  `ÖZET → Kritik: ${counts.Kritik}, Orta: ${counts.Orta}, Düşük: ${counts.Düşük}, Bilgi: ${counts.Bilgi}`
)
console.log('=================================================\n')

// JSON çıktısı (makine okunabilir)
const reportPath = join(ROOT, 'qa-audit-report.json')
import('node:fs').then(({ writeFileSync }) => {
  writeFileSync(reportPath, JSON.stringify({ counts, findings }, null, 2))
  console.log(`Detaylı rapor yazıldı: ${reportPath}`)
})
