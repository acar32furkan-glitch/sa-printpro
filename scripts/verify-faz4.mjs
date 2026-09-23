#!/usr/bin/env node
/**
 * FAZ 4 DOĞRULAMA
 *
 * Faz 4 gereksinimlerini (G1.x–G5.x) gerçek denetimlerle doğrular. Her kontrol
 * PASS / FAIL / WARN üretir; PENDING yalnızca ilgili adım hiç uygulanmadıysa
 * kullanılır (Faz 4 tamamlandığında PENDING kalmamalıdır).
 *
 * Durumlar:
 *   PASS → kontrol başarılı
 *   FAIL → kontrol başarısız (düzeltme gerekli, exit code 1)
 *   WARN → kontrol geçti ama dikkat edilmesi gereken bir durum var
 *   PENDING → ilgili adım henüz uygulanmadı (henüz denetlenemiyor)
 *
 * Kullanım: node scripts/verify-faz4.mjs
 *           npm run verify:faz4
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARN: 'WARN',
  PENDING: 'PENDING',
}

const STATUS_ICON = {
  PASS: '✅',
  FAIL: '❌',
  WARN: '⚠️ ',
  PENDING: '⏳',
}

/**
 * @typedef {Object} CheckResult
 * @property {string} id      Gereksinim numarası (ör. "G1.2")
 * @property {string} title   Kısa açıklama
 * @property {string} status  PASS | FAIL | WARN | PENDING
 * @property {string} [detail] Ek açıklama
 */

/** @type {CheckResult[]} */
const results = []

/**
 * Bir kontrol sonucunu kaydeder.
 * @param {string} id
 * @param {string} title
 * @param {string} status
 * @param {string} [detail]
 */
function record(id, title, status, detail = '') {
  results.push({ id, title, status, detail })
}

/**
 * Dosya var mı kontrolü (yardımcı).
 * @param {string} relativePath
 * @returns {boolean}
 */
function fileExists(relativePath) {
  return existsSync(join(ROOT, relativePath))
}

/**
 * Dosya içeriğini okur; dosya yoksa boş string döner.
 * @param {string} relativePath
 * @returns {string}
 */
function readText(relativePath) {
  if (!fileExists(relativePath)) return ''
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

/**
 * Dosya içeriğinde regex arar (yardımcı).
 * @param {string} relativePath
 * @param {RegExp} pattern
 * @returns {boolean}
 */
function fileMatches(relativePath, pattern) {
  return pattern.test(readText(relativePath))
}

/**
 * JSON dosyasını güvenli şekilde ayrıştırır.
 * @param {string} relativePath
 * @returns {unknown|null}
 */
function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath))
  } catch {
    return null
  }
}

/**
 * `dist/` altındaki tüm HTML dosyalarını döndürür.
 * @returns {string[]}
 */
function listDistHtml() {
  const dist = join(ROOT, 'dist')
  if (!existsSync(dist)) return []
  /** @type {string[]} */
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.html')) out.push(full)
    }
  }
  walk(dist)
  return out
}

// ---------------------------------------------------------------------------
// G1.x — Merkezi kurumsal config + build uyarısı (ADIM 1)
// ---------------------------------------------------------------------------

function checkG1() {
  // G1.1 — Kurumsal alanların kaç dosyada tekrarlandığı denetlendi mi?
  // Kanıt: yasal sayfalar artık hardcoded placeholder yerine merkezi config
  // kullanıyor; ayrıca analiz raporu (plans/) tekrar envanterini içeriyor.
  //
  // NOT: `iade-ve-cayma-hakki.astro` içindeki `[DOLDURULACAK: ...]` alanları
  // KURUMSAL BİLGİ değil, kullanıcının dolduracağı İADE TALEP FORMU şablonudur;
  // bu yüzden denetim dışıdır. Yalnızca kurumsal bilgi placeholder'ları aranır.
  const legalPages = [
    'src/pages/mesafeli-satis-sozlesmesi.astro',
    'src/pages/kvkk-aydinlatma-metni.astro',
    'src/pages/iade-ve-cayma-hakki.astro',
    'src/pages/gizlilik-politikasi.astro',
    'src/components/Footer.astro',
  ]
  // Kurumsal bilgi placeholder kalıpları (form şablonu hariç).
  const COMPANY_PLACEHOLDER = /\[DOLDURULACAK:\s*(ticari unvan|açık adres|adres|vkn|vergi)/i
  const hardcodedPlaceholder = legalPages.filter((file) =>
    COMPANY_PLACEHOLDER.test(readText(file)),
  )
  const analysisDoc = fileMatches(
    'plans/faz4-analiz-ve-uygulama-plani.md',
    /G1\.1/,
  )
  if (hardcodedPlaceholder.length === 0 && analysisDoc) {
    record(
      'G1.1',
      'Kurumsal alan tekrarı denetlendi (hardcoded placeholder yok)',
      STATUS.PASS,
      `${legalPages.length} dosya tarandı; elle yazılmış [DOLDURULACAK] kalmadı.`,
    )
  } else if (hardcodedPlaceholder.length > 0) {
    record(
      'G1.1',
      'Kurumsal alan tekrarı denetlendi (hardcoded placeholder yok)',
      STATUS.FAIL,
      `Hardcoded placeholder hâlâ var: ${hardcodedPlaceholder.join(', ')}`,
    )
  } else {
    record(
      'G1.1',
      'Kurumsal alan tekrarı denetlendi (hardcoded placeholder yok)',
      STATUS.WARN,
      'Analiz dokümanı (plans/) bulunamadı.',
    )
  }

  // G1.2 — Merkezi config tek kaynak mı? Tüm yasal sayfalar + footer
  // `siteConfig.company` referansı vermeli.
  const siteConfigHasCompany = fileMatches('src/config/site.js', /company:\s*\{/)
  const consumers = [
    'src/pages/mesafeli-satis-sozlesmesi.astro',
    'src/pages/kvkk-aydinlatma-metni.astro',
    'src/pages/iade-ve-cayma-hakki.astro',
    'src/pages/gizlilik-politikasi.astro',
    'src/components/Footer.astro',
  ]
  const missingConsumers = consumers.filter(
    (file) => !fileMatches(file, /siteConfig\.company/),
  )

  if (siteConfigHasCompany && missingConsumers.length === 0) {
    record(
      'G1.2',
      'Merkezi kurumsal config tek kaynak',
      STATUS.PASS,
      `${consumers.length} tüketici dosya siteConfig.company kullanıyor.`,
    )
  } else if (siteConfigHasCompany) {
    record(
      'G1.2',
      'Merkezi kurumsal config tek kaynak',
      STATUS.FAIL,
      `site.js company bloğu var ama şu dosyalar referans vermiyor: ${missingConsumers.join(', ')}`,
    )
  } else {
    record('G1.2', 'Merkezi kurumsal config tek kaynak', STATUS.FAIL, 'site.js company bloğu yok.')
  }

  // G1.3 — Build uyarısı (placeholder kontrolü) build zincirine entegre mi?
  if (fileExists('scripts/check-company-info.mjs')) {
    const buildHasGuard = fileMatches('package.json', /check-company-info\.mjs/)
    record(
      'G1.3',
      'Placeholder build uyarısı',
      buildHasGuard ? STATUS.PASS : STATUS.FAIL,
      buildHasGuard ? 'build script\'i check-company-info.mjs içeriyor.' : 'Script var ama build script\'ine entegre değil.',
    )
  } else {
    record('G1.3', 'Placeholder build uyarısı', STATUS.PENDING, 'Adım 1 bekliyor.')
  }

  // G1.4 — Kullanıcıya "fatura kesilemez" bilgisi net veriliyor mu?
  const hasUserNotice = fileMatches(
    'scripts/check-company-info.mjs',
    /fatura kesilemez/i,
  )
  record(
    'G1.4',
    'Kullanıcıya "fatura kesilemez" bilgisi',
    hasUserNotice ? STATUS.PASS : STATUS.FAIL,
    hasUserNotice ? '' : 'check-company-info.mjs içinde net uyarı metni yok.',
  )
}

// ---------------------------------------------------------------------------
// G2.x — Duplicate ürün birleştirme (ADIM 2–3)
// ---------------------------------------------------------------------------

function checkG2() {
  // G2.5 — Duplicate tarama script'i mevcut ve çalıştırılabilir mi?
  const duplicateScript = fileExists('scripts/find-duplicates.mjs')
  record(
    'G2.5',
    'Duplicate tarama script\'i',
    duplicateScript ? STATUS.PASS : STATUS.PENDING,
    duplicateScript ? '' : 'Adım 2 bekliyor.',
  )

  // G2.1 — Duplicate grupları incelendi mi? (kalıcı redirect kaydı üretildi mi)
  const redirectsFile = 'src/data/product-redirects.json'
  const redirects = readJson(redirectsFile)
  const redirectCount =
    redirects && typeof redirects === 'object' ? Object.keys(redirects).length : 0
  record(
    'G2.1',
    'Duplicate grupları incelendi (redirect kaydı)',
    redirectCount > 0 ? STATUS.PASS : STATUS.PENDING,
    redirectCount > 0
      ? `${redirectCount} eski slug → master eşlemesi kayıtlı.`
      : 'Adım 3 bekliyor.',
  )

  // G2.4 — Ürün 301 yönlendirme haritası hem lib hem worker'da senkron mu?
  const libHasRedirects = fileMatches('src/lib/products.js', /PRODUCT_REDIRECTS/)
  const workerHasRedirects = fileMatches('worker/index.js', /PRODUCT_REDIRECTS/)
  if (libHasRedirects && workerHasRedirects) {
    record(
      'G2.4',
      'Ürün 301 yönlendirme haritası (lib + worker senkron)',
      STATUS.PASS,
    )
  } else {
    record(
      'G2.4',
      'Ürün 301 yönlendirme haritası (lib + worker senkron)',
      libHasRedirects || workerHasRedirects ? STATUS.FAIL : STATUS.PENDING,
      libHasRedirects || workerHasRedirects
        ? `Senkron değil (lib=${libHasRedirects}, worker=${workerHasRedirects}).`
        : 'Adım 3 bekliyor.',
    )
  }

  // G2.3 — Farklı ürünlerin başlıkları belirginleştirildi mi?
  const hasClarify = fileMatches('scripts/merge-duplicates.mjs', /clarifyTitle/)
  record(
    'G2.3',
    'Farklı ürün başlığı belirginleştirme mantığı',
    hasClarify ? STATUS.PASS : STATUS.PENDING,
    hasClarify ? '' : 'Adım 3 bekliyor.',
  )

  // G2.2 — Birebir duplicate kalmadı mı? (aynı başlık + aynı fiyat)
  const productsFile = 'src/data/products.json'
  const data = readJson(productsFile)
  if (data) {
    const products = Array.isArray(data) ? data : data.products || []
    const seen = new Map()
    let exactDuplicates = 0
    for (const product of products) {
      const name = String(product.name || '').trim().toLocaleLowerCase('tr-TR')
      const variants = Array.isArray(product.variants) ? product.variants : []
      const price = variants.reduce((min, v) => {
        const value = Number(v?.salePrice) || Number(v?.price) || 0
        return value > 0 && (min === 0 || value < min) ? value : min
      }, 0)
      const key = `${name}::${price}`
      if (seen.has(key)) {
        exactDuplicates += 1
      } else {
        seen.set(key, product.id)
      }
    }
    record(
      'G2.2',
      'Katalogda birebir duplicate kalmadı (başlık + fiyat)',
      exactDuplicates === 0 ? STATUS.PASS : STATUS.FAIL,
      exactDuplicates === 0
        ? `${products.length} ürün, aynı başlık+fiyat kombinasyonu yok.`
        : `${exactDuplicates} adet aynı başlık+fiyat kaydı hâlâ mevcut.`,
    )
  } else {
    record('G2.2', 'Katalogda birebir duplicate kalmadı (başlık + fiyat)', STATUS.FAIL, 'products.json okunamadı.')
  }
}

// ---------------------------------------------------------------------------
// G3.x — Kategori taksonomisi bölme (ADIM 4)
// ---------------------------------------------------------------------------

function checkG3() {
  // G3.1 — Yeni alt kategoriler tanımlı mı?
  const overrideNames = readText('src/lib/products.js')
  const newCategories = [
    'motosiklet-sticker-granaj',
    'araba-sticker-aksesuar',
    'dini-kaligrafi-sticker',
    'ayna-cam-sticker',
    'duvar-dekor-sticker',
  ]
  const missingNew = newCategories.filter((slug) => !overrideNames.includes(slug))
  record(
    'G3.1',
    'Yeni alt kategoriler tanımlı (5 kategori)',
    missingNew.length === 0 ? STATUS.PASS : STATUS.FAIL,
    missingNew.length === 0
      ? `${newCategories.length} yeni kategori slug'ı CATEGORY_OVERRIDE_NAMES içinde.`
      : `Eksik slug'lar: ${missingNew.join(', ')}`,
  )

  // G3.3 — Kategori yeniden sınıflandırma script'i + 301 haritası senkron mu?
  const reclassifyScript = fileExists('scripts/reclassify-categories.mjs')
  const libHasCategoryRedirects = fileMatches('src/lib/products.js', /CATEGORY_REDIRECTS/)
  const workerHasCategoryRedirects = fileMatches('worker/index.js', /CATEGORY_REDIRECTS/)
  const categoryRedirects = readJson('src/data/category-redirects.json')
  const hasRedirectData =
    categoryRedirects && typeof categoryRedirects === 'object' && Object.keys(categoryRedirects).length > 0

  if (reclassifyScript && libHasCategoryRedirects && workerHasCategoryRedirects && hasRedirectData) {
    record(
      'G3.3',
      'Kategori taşıma + 301 (script + lib + worker + veri)',
      STATUS.PASS,
      `${Object.keys(categoryRedirects).length} kategori yönlendirmesi kayıtlı.`,
    )
  } else {
    const missing = [
      !reclassifyScript && 'reclassify script',
      !libHasCategoryRedirects && 'lib CATEGORY_REDIRECTS',
      !workerHasCategoryRedirects && 'worker CATEGORY_REDIRECTS',
      !hasRedirectData && 'category-redirects.json',
    ].filter(Boolean)
    record(
      'G3.3',
      'Kategori taşıma + 301 (script + lib + worker + veri)',
      STATUS.FAIL,
      `Eksik bileşenler: ${missing.join(', ')}`,
    )
  }

  // G3.4 — Eski kategori adı ("Arma Sticker & Fosfor Şerit") kaldırıldı mı?
  // Eski slug artık üretilmemeli ve 301 haritasında bulunmalı.
  const oldSlug = 'arma-sticker-fosfor-serit'
  const oldStillBuilt = existsSync(join(ROOT, 'dist/kategori', oldSlug, 'index.html'))
  const oldRedirected = hasRedirectData && Boolean(categoryRedirects[oldSlug])
  record(
    'G3.4',
    'Eski kategori adı kaldırıldı (301 ile yönlendiriliyor)',
    !oldStillBuilt && oldRedirected ? STATUS.PASS : STATUS.FAIL,
    !oldStillBuilt && oldRedirected
      ? `/${oldSlug} artık üretilmiyor, 301 → ${categoryRedirects[oldSlug]}.`
      : `durum: üretiliyor=${oldStillBuilt}, redirect=${oldRedirected}`,
  )
}

// ---------------------------------------------------------------------------
// G4.x — Kategori bazlı filtre sayaçları (ADIM 5)
// ---------------------------------------------------------------------------

function checkG4() {
  // G4.1 — Marka sayaçları kategoriye özel hesaplanıyor mu?
  const brandsAcceptsParam = fileMatches(
    'src/lib/products.js',
    /getAllBrandsWithCounts\s*\(\s*\w+/,
  )
  const categoryPagePassesProducts = fileMatches(
    'src/pages/kategori/[slug]/[...page].astro',
    /getAllBrandsWithCounts\s*\(\s*products\s*\)/,
  )
  if (brandsAcceptsParam && categoryPagePassesProducts) {
    record(
      'G4.1',
      'Marka sayaçları kategoriye özel hesaplanıyor',
      STATUS.PASS,
      'Kategori sayfası filtrelenmiş ürün kümesini geçiriyor.',
    )
  } else {
    record(
      'G4.1',
      'Marka sayaçları kategoriye özel hesaplanıyor',
      STATUS.FAIL,
      `imza=${brandsAcceptsParam}, kategori sayfası filtreli çağrı=${categoryPagePassesProducts}`,
    )
  }

  // G4.2 — "Tümü" sayacı kategori toplamını gösteriyor mu?
  const gridHasTotal = fileMatches(
    'src/components/islands/ProductGridStatic.jsx',
    /totalCount/,
  )
  const categoryPagePassesTotal = fileMatches(
    'src/pages/kategori/[slug]/[...page].astro',
    /totalCount=\{category\.count\}/,
  )
  if (gridHasTotal && categoryPagePassesTotal) {
    record(
      'G4.2',
      '"Tümü" sayacı kategori toplamını gösteriyor',
      STATUS.PASS,
      'ProductGridStatic totalCount={category.count} alıyor.',
    )
  } else {
    record(
      'G4.2',
      '"Tümü" sayacı kategori toplamını gösteriyor',
      STATUS.FAIL,
      `grid totalCount=${gridHasTotal}, kategori sayfası prop=${categoryPagePassesTotal}`,
    )
  }

  // G4.3 — Üretilen kategori sayfalarında sayaç tutarlılığı (dist üzerinden).
  const distHtml = listDistHtml()
  if (distHtml.length === 0) {
    record(
      'G4.3',
      'Kategori filtre sayaçları tutarlı (dist)',
      STATUS.WARN,
      'dist/ bulunamadı; önce `npm run build` çalıştırın.',
    )
    return
  }

  const categoryDirs = readdirSync(join(ROOT, 'dist/kategori'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  let inconsistent = 0
  const details = []
  for (const slug of categoryDirs) {
    const file = join(ROOT, 'dist/kategori', slug, 'index.html')
    if (!existsSync(file)) continue
    const html = readFileSync(file, 'utf8')
    const headerMatch = html.match(/>\s*(\d+)\s*ürün/)
    const headerTotal = headerMatch ? Number(headerMatch[1]) : null
    const allMatch = html.match(/Tümü[\s\S]{0,200}?opacity-70">(\d+)</)
    const allCount = allMatch ? Number(allMatch[1]) : null
    const pillCounts = [...html.matchAll(/opacity-70">(\d+)</g)].map((m) => Number(m[1]))
    const brandSum = pillCounts.slice(1).reduce((sum, n) => sum + n, 0)

    if (headerTotal === null || allCount !== headerTotal || brandSum !== headerTotal) {
      inconsistent += 1
      details.push(`${slug}(header=${headerTotal}, all=${allCount}, brandSum=${brandSum})`)
    }
  }

  record(
    'G4.3',
    'Kategori filtre sayaçları tutarlı (dist)',
    inconsistent === 0 ? STATUS.PASS : STATUS.FAIL,
    inconsistent === 0
      ? `${categoryDirs.length} kategori sayfasında header = Tümü = marka toplamı.`
      : `${inconsistent} kategori tutarsız: ${details.join('; ')}`,
  )
}

// ---------------------------------------------------------------------------
// G5.x — Agent talimatı / canlı doğrulama (ADIM 6)
// ---------------------------------------------------------------------------

function checkG5() {
  // G5.1 — Doğrulama raporu üretildi mi?
  const reportExists = fileExists('docs/verification/faz4.md')
  record(
    'G5.1',
    'Faz 4 doğrulama raporu (docs/verification/faz4.md)',
    reportExists ? STATUS.PASS : STATUS.FAIL,
    reportExists ? '' : 'Rapor dosyası bulunamadı.',
  )

  // G5.2 — Kullanıcıdan bilgi isteme / varsayım üretmeme notu raporda mı?
  const reportMentionsUserInfo = fileMatches(
    'docs/verification/faz4.md',
    /kurumsal bilgi|placeholder|kullanıcı/i,
  )
  record(
    'G5.2',
    'Kullanıcıdan bilgi isteme notu raporda',
    reportMentionsUserInfo ? STATUS.PASS : STATUS.FAIL,
    reportMentionsUserInfo ? '' : 'Raporda kurumsal bilgi/kullanıcı notu yok.',
  )
}

// ---------------------------------------------------------------------------
// Çalıştır + özet tablo
// ---------------------------------------------------------------------------

function printSummary() {
  const total = results.length
  const passed = results.filter((r) => r.status === STATUS.PASS).length
  const failed = results.filter((r) => r.status === STATUS.FAIL).length
  const warned = results.filter((r) => r.status === STATUS.WARN).length
  const pending = results.filter((r) => r.status === STATUS.PENDING).length

  console.log('='.repeat(78))
  console.log('FAZ 4 DOĞRULAMA')
  console.log('='.repeat(78))

  const idWidth = Math.max(...results.map((r) => r.id.length), 4)
  for (const r of results) {
    const icon = STATUS_ICON[r.status] || '  '
    const id = r.id.padEnd(idWidth)
    const status = r.status.padEnd(7)
    console.log(`  ${icon} ${id}  ${status}  ${r.title}`)
    if (r.detail) console.log(`      ${' '.repeat(idWidth)}  ↳ ${r.detail}`)
  }

  console.log('-'.repeat(78))
  console.log(
    `  Toplam: ${total}  |  Başarılı: ${passed}  |  Başarısız: ${failed}  |  ` +
      `Uyarı: ${warned}  |  Bekleyen: ${pending}`,
  )
  console.log('='.repeat(78))

  return { total, passed, failed, warned, pending }
}

function main() {
  checkG1()
  checkG2()
  checkG3()
  checkG4()
  checkG5()

  const { failed } = printSummary()

  // Yalnızca gerçek FAIL durumları CI'da kırıcıdır.
  process.exit(failed > 0 ? 1 : 0)
}

main()
