import productsData from '../data/products.json'
import productRedirectsData from '../data/product-redirects.json'
import { featuredSlugs } from '../config/featured.js'
import { siteConfig } from '../config/site.js'

/**
 * Normalizes a string for Turkish-aware, case-insensitive comparison.
 * @param {string} str
 * @returns {string}
 */
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

/**
 * Third-party seller titles that must never surface on the storefront.
 * Matching is Turkish-aware and case-insensitive (see `normalizeTr`).
 */
/**
 * Üçüncü taraf satıcı / pazaryeri mağaza adları (gerçek ürün markası değil).
 *
 * ÖNEMLİ: Bu liste YALNIZCA tam mağaza unvanlarını içermelidir. Ürün türünü
 * veya jenerik bir kelimeyi (ör. "sticker", "rez", "3m", "favori") içeren kısa
 * parçalar EKLENMEMELİDİR — aksi halde ürün başlıklarındaki meşru kelimeler
 * yanlışlıkla "SA Printpro" ile değiştirilir ve hem başlıklar bozulur hem de
 * SEO'da aranan kelimeler kaybolur.
 */
const COMPETITOR_BRANDS = [
  'baskı babası',
  'baski babasi',
  'baskibabasi',
  'baskıbabası',
  'baski babası',
  'baskı babasi',
  'hediyelikevi',
  'benimser reklam',
  'run grafik shop',
  'bay s plus',
  'kaplama merkezi',
  'beta moda hub',
  'mavera stickers',
  'adasya reklam',
  'kurt reklam dünyası',
  'modernsanatdükkanı',
  'tasarım market',
  'maral grup',
  'ersa sticker',
  'asilmeydan',
  'wouw store',
  'hsc store',
  'yılmaz auto',
  'yarımada bahçe',
  'asil ticaret',
  'uçgunmoto',
  'cebecioto',
  'mtl pleksi',
  'stckrco',
  'muasl',
  'allivo',
  'arona',
  'comtura',
  'bricave',
  'kumraldede',
  'habole',
  'bilge sea',
  'motiker',
  'stıckman',
  'erzline',
  'carsesuar',
  'teknotik',
  'unifol',
]

/**
 * Jenerik ürün türü / malzeme kelimeleri. Bunlar ASLA `COMPETITOR_BRANDS`
 * içine girmemelidir; aksi halde ürün başlıklarındaki meşru kelimeler
 * yanlışlıkla "SA Printpro" ile değiştirilir (ör. "Granaj Sticker Etiket"
 * → "Granaj SA Printpro Etiket") ve hem başlıklar bozulur hem de SEO'da
 * aranan kelimeler kaybolur.
 *
 * Bu liste, geçmişte yaşanan "sticker → SA Printpro" regresyonunun bir daha
 * oluşmaması için bir güvenlik ağıdır: aşağıdaki `assertNoGenericBrands`
 * fonksiyonu, listeye jenerik bir kelime eklenirse derleme/senkronizasyon
 * anında hata fırlatır.
 */
const GENERIC_TITLE_WORDS = new Set([
  'sticker',
  'stickers',
  'etiket',
  'çıkartma',
  'cikartma',
  'folyo',
  'jant',
  'şerit',
  'serit',
  'granaj',
  'grenaj',
  'kaplama',
  'reflektif',
  'reflektor',
  'reflektör',
  'hologram',
  'kupon',
  'arma',
  'logo',
  'motor',
  'motosiklet',
  'araba',
  'oto',
  'kask',
  'aksesuar',
  'rez',
  '3m',
  'favori',
])

/**
 * `COMPETITOR_BRANDS` içinde jenerik bir kelime bulunursa hata fırlatır.
 * Bu, "sticker → SA Printpro" benzeri bir regresyonu erken yakalar.
 *
 * @param {string[]} brands
 */
function assertNoGenericBrands(brands) {
  for (const brand of brands) {
    const normalized = normalizeTr(brand).trim()
    if (GENERIC_TITLE_WORDS.has(normalized)) {
      throw new Error(
        `[COMPETITOR_BRANDS] Jenerik kelime marka listesine eklenemez: "${brand}". ` +
          'Bu, ürün başlıklarındaki meşru kelimeleri bozar (bkz. GENERIC_TITLE_WORDS).'
      )
    }
  }
}

// Modül yüklenirken listeyi doğrula — regresyonu derleme anında yakala.
assertNoGenericBrands(COMPETITOR_BRANDS)

/**
 * Corporate / agency references that leak the upstream seller identity.
 */
const COMPETITOR_ENTITIES = [
  'meca ajans kurumsal reklam ve baskı hizmetleri',
  'meca ajans',
]

/**
 * Marketplace-mandated compliance / warning sentences that Trendyol injects
 * into product descriptions. These read as "this product may not be safe /
 * we don't know who imported it" on our own storefront, so they are removed
 * sentence-by-sentence. Patterns are intentionally narrow (anchored on the
 * compliance vocabulary) so ordinary product copy is never touched.
 */
const COMPLIANCE_SENTENCE_PATTERNS = [
  // "ECE uygunluk sembolü ..." / "ECE uygunluk beyanı ..." cümleleri.
  /[^.!?\n]*\bECE\b[^.!?\n]*(?:uygunluk|uygun|sembol|işaret|beyan|standart|belge)[^.!?\n]*[.!?]?/giu,
  // "İthalatçı, yetkili temsilci veya ifa hizmet sağlayıcı bilgisi ..." cümleleri.
  /[^.!?\n]*\b(?:ithalatçı|ithalatci|yetkili temsilci|ifa hizmet sağlayıcı)\b[^.!?\n]*[.!?]?/giu,
  // "Türkiye'de ... tarafından ithal edilmiştir" kalıpları.
  /[^.!?\n]*\bithal edilmiştir\b[^.!?\n]*[.!?]?/giu,
  // Pazaryeri zorunlu uyum şablonları: "Bu ürün ... yönetmeliğine uygundur".
  /[^.!?\n]*\bBu ürün\b[^.!?\n]*\b(?:yönetmeliğine|yönetmelik|mevzuatına|standardına|uygundur|uygun olduğu)\b[^.!?\n]*[.!?]?/giu,
]

/**
 * Trendyol ürün açıklamalarına otomatik eklenen, kendi vitrinimizde anlamsız
 * kalan şablon kalıntıları. Bunlar cümle bazında silinir; aksi halde ürün
 * açıklamasında "... üretilmiştir.; - Diğer kategorisinde yer alan bu ürün ..."
 * gibi ham madde işareti/ayraç artıkları görünür.
 *
 * Kalıplar bilinçli olarak dardır: yalnızca pazaryeri şablonuna özgü ifadeleri
 * hedefler, normal ürün metnine dokunmaz.
 */
const TEMPLATE_LEFTOVER_PATTERNS = [
  // "Diğer kategorisinde yer alan bu ürün ..." gibi kategori şablon cümleleri.
  /[^.!?\n]*\bDiğer kategorisinde yer alan\b[^.!?\n]*[.!?]?/giu,
  // "Bu ürün ... kategorisinde yer alan ..." varyantları.
  /[^.!?\n]*\bkategorisinde yer alan\b[^.!?\n]*[.!?]?/giu,
]

/**
 * Removes competitor seller names, agency references, phone numbers,
 * external links and marketplace-mandated compliance/warning sentences from
 * any catalog text (product name, description, variant attributes, etc.).
 *
 * Competitor brand titles are replaced with the house brand ("SA Printpro")
 * so sentences stay grammatical; agency references, phone numbers, external
 * URLs and compliance sentences are stripped entirely.
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeCatalogText(text) {
  if (text === null || text === undefined) {
    return ''
  }

  let output = String(text)

  // 1) Competitor seller titles → house brand. Matching is Turkish-aware
  // (case- and diacritic-insensitive) so "BENİMSER REKLAM" is caught too.
  for (const brand of COMPETITOR_BRANDS) {
    const normalizedBrand = normalizeTr(brand)
    const normalizedOutput = normalizeTr(output)
    let searchFrom = 0
    let result = ''
    let cursor = 0
    while (searchFrom <= normalizedOutput.length) {
      const hit = normalizedOutput.indexOf(normalizedBrand, searchFrom)
      if (hit === -1) {
        break
      }
      result += output.slice(cursor, hit) + 'SA Printpro'
      cursor = hit + normalizedBrand.length
      searchFrom = cursor
    }
    result += output.slice(cursor)
    output = result
  }

  // 2) Agency / corporate references → removed.
  for (const entity of COMPETITOR_ENTITIES) {
    const pattern = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    output = output.replace(pattern, '')
  }

  // 3) Phone numbers (TR mobile + generic international) → removed.
  output = output
    .replace(/(?:\+?90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '')
    .replace(/\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '')

  // 4) External links / bare domains → removed.
  output = output
    .replace(/https?:\/\/[^\s<>"')]+/gi, '')
    .replace(/\bwww\.[a-z0-9-]+\.[a-z]{2,}(\/[^\s<>"')]*)?/gi, '')

  // 5) Marketplace-mandated compliance / warning sentences → removed.
  for (const pattern of COMPLIANCE_SENTENCE_PATTERNS) {
    output = output.replace(pattern, ' ')
  }

  // 6) Trendyol şablon kalıntıları ("Diğer kategorisinde yer alan ...") → sil.
  for (const pattern of TEMPLATE_LEFTOVER_PATTERNS) {
    output = output.replace(pattern, ' ')
  }

  // 6b) "sticker → SA Printpro" regresyon onarımı (güvenlik ağı).
  //     Geçmişte `COMPETITOR_BRANDS` içindeki çıplak "sticker" kelimesi, ürün
  //     metinlerindeki meşru "sticker" kelimesini "SA Printpro" ile
  //     değiştirmişti (ör. "diş SA Printpro setidir" ← "diş sticker setidir").
  //     Bu adım, markanın jenerik bir ürün kelimesinin YERİNE geçtiği dar
  //     kalıpları tespit edip doğru kelimeyi geri koyar. Meşru marka
  //     kullanımlarına ("SA Printpro Tasarımıdır", "Tüm SA Printpro Güvencesi")
  //     dokunmaz; yalnızca jenerik kelime bağlamını hedefler.
  output = output.replace(
    /\bSA Printpro\b(?=\s*(?:setidir|seti|setleri|set)\b)/giu,
    'sticker'
  )
  output = output.replace(
    /\bSA Printpro\b(?=['’](?:ı|i|u|ü)\b)/giu,
    'sticker'
  )
  output = output.replace(
    /\b(?:diş|far|granaj|grenaj|jant|depo|kask|kaput|kapı|kapi)\s+SA Printpro\b/giu,
    (match) => match.replace(/SA Printpro$/i, 'sticker')
  )

  // 7) Madde işareti / ayraç kalıntılarını temizle.
  //    Trendyol açıklamaları bullet'ları "; - " ile birleştirir; bu ayraç
  //    düz metne dönüşünce "... üretilmiştir.; - Diğer ..." gibi ham görünür.
  output = output
    // "; - " / "; – " / "; • " gibi ayraçları cümle sonuna indirge.
    .replace(/\s*;\s*[-–—•·]\s*/g, '. ')
    // Satır başındaki yalnız "- " / "• " madde işaretlerini kaldır.
    .replace(/(^|\n)\s*[-–—•·]\s+/g, '$1')
    // Kalan yalnız noktalı virgülleri cümle sonuna çevir.
    .replace(/\s*;\s*/g, '. ')
    // Ardışık noktalama ve boşlukları toparla.
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // 8) Collapse the whitespace left behind by removals.
  return output.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Keyword-stuffing patterns that Trendyol sellers abuse in titles, e.g.
 * "Sticker Çıkartma Etiket Reflektif Reflektörlü ...". Collapsing these keeps
 * titles readable and prevents duplicate-keyword penalties in search.
 */
const STUFFING_PATTERNS = [
  /\b(\p{L}+)(?:\s+\1\b)+/giu, // aynı kelimenin arka arkaya tekrarı
]

/**
 * Removes competitor seller/agency titles and simplifies keyword-stuffed
 * titles. This is the canonical entry point used by the storefront and the
 * sync pipeline; it delegates to `sanitizeCatalogText` for the brand/entity
 * scrubbing so both stay in sync.
 *
 * @param {string} text
 * @returns {string}
 */
export function sanitizeProductContent(text) {
  let output = sanitizeCatalogText(text)

  // Ardışık tekrar eden kelimeleri tekilleştir (keyword stuffing).
  for (const pattern of STUFFING_PATTERNS) {
    output = output.replace(pattern, '$1')
  }

  // Aynı kelimenin 3+ kez geçtiği başlıklarda fazlalıkları at.
  const words = output.split(/\s+/).filter(Boolean)
  const seen = new Map()
  const deduped = []
  for (const word of words) {
    const key = normalizeTr(word)
    const count = seen.get(key) || 0
    // Kısa bağlaçlar (ve, ile, için) tekrar edebilir; onları koru.
    if (count >= 1 && key.length > 3) {
      continue
    }
    seen.set(key, count + 1)
    deduped.push(word)
  }

  return normalizeProductTitle(deduped.join(' ').replace(/\s{2,}/g, ' ').trim())
}

/**
 * Tümü büyük harfle yazılmış ürün başlıklarını okunabilir başlık düzenine
 * çevirir (ör. "KUPON HOLOGRAM STİCKER 2 ADET" → "Kupon Hologram Sticker 2 Adet").
 *
 * Yalnızca başlığın TAMAMI büyük harfse uygulanır; karışık yazım (ör. "Honda
 * PCX Jant Şeridi") olduğu gibi korunur. Kısa bağlaçlar (ve, ile, için) ve
 * bilinen kısaltmalar (PCX, KTM, BMW, LED, 3M, TR) küçültülmez.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeProductTitle(text) {
  const value = String(text || '').trim()
  if (value === '') {
    return value
  }

  // Harf içeren karakterleri topla; rakam/noktalama tek başına karar vermez.
  const letters = value.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '')
  if (letters.length < 8 || letters !== letters.toLocaleUpperCase('tr-TR')) {
    return value
  }

  // Küçültülmeyecek kısaltmalar (marka/model/teknoloji).
  const KEEP_UPPER = new Set([
    'PCX', 'KTM', 'BMW', 'TVS', 'RKS', 'CFMOTO', 'LED', 'UV', 'TR', 'SA',
    'MG100', 'MT', 'R25', 'NMAX', 'XMAX', 'JDM', 'ABS', 'ECE', '3M',
  ])
  // Cümle başında da küçük kalması gereken bağlaçlar.
  const LOWERCASE_WORDS = new Set(['ve', 'ile', 'için', 'veya', 'de', 'da'])

  const words = value.split(/\s+/)
  return words
    .map((word, index) => {
      const bare = word.replace(/[^\p{L}\p{N}]/gu, '')
      if (bare === '') {
        return word
      }
      if (KEEP_UPPER.has(bare.toLocaleUpperCase('tr-TR'))) {
        return word
      }
      const lower = word.toLocaleLowerCase('tr-TR')
      if (index > 0 && LOWERCASE_WORDS.has(bare.toLocaleLowerCase('tr-TR'))) {
        return lower
      }
      // İlk harfi büyüt, kalanı küçült (Türkçe yerel ayarıyla).
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1)
    })
    .join(' ')
}

/**
 * Returns all products.
 * @returns {Array<object>}
 */
export function getAllProducts() {
  return productsData.products
}

/**
 * FAZ 11 — Yerel görsel önceliği.
 *
 * `scripts/process-images.mjs` her ürünün ilk görselini logo filigranlı yerel
 * bir WebP dosyasına (`/uploads/products/${id}.webp`) dönüştürür. Bu fonksiyon
 * yerel dosya mevcutsa onu, aksi halde CDN görselini döndürür.
 *
 * Not: Astro statik derlemesi sırasında `public/` içeriği doğrudan kopyalanır;
 * bu yüzden yerel dosyanın varlığını derleme zamanında `fs` ile kontrol ederiz.
 * Tarayıcı tarafında (island) `fs` bulunmadığından bu kontrol güvenli biçimde
 * atlanır ve CDN görseline düşülür.
 *
 * @param {object} product
 * @returns {string} Görsel URL'i (yerel yol veya CDN adresi) ya da ''.
 */
export function getProductPrimaryImage(product) {
  if (!product) {
    return ''
  }

  const images = Array.isArray(product.images) ? product.images : []
  const cdnImage = images[0] || ''

  if (!product.id) {
    return cdnImage
  }

  const localPath = `/uploads/products/${product.id}.webp`

  // Yalnızca Node (build/SSG) ortamında dosya sistemi kontrolü yapılabilir.
  // Tarayıcıda `process.versions.node` bulunmaz; bu durumda CDN görseline düşülür.
  if (typeof process === 'undefined' || !process.versions?.node) {
    return cdnImage
  }

  try {
    // `node:fs` yalnızca Node ortamında yüklenir; tarayıcı paketine sızmaz.
    const { existsSync } = globalThis.__SA_PRINTPRO_FS__ || {}
    if (typeof existsSync !== 'function') {
      return cdnImage
    }
    const absolute = `${process.cwd()}/public${localPath}`
    return existsSync(absolute) ? localPath : cdnImage
  } catch {
    return cdnImage
  }
}

/**
 * FAZ 11 — Tüm galeri görselleri için yerel öncelik.
 *
 * `scripts/process-images.mjs` her ürünün TÜM görsellerini
 * `/uploads/products/${id}-${index}.webp` biçiminde üretir. Bu fonksiyon her
 * görsel için yerel dosya mevcutsa onu, aksi halde ilgili CDN URL'ini döndürür.
 *
 * Node (build/SSG) ortamında `fs` köprüsü üzerinden dosya varlığı kontrol
 * edilir; tarayıcıda (island) bu kontrol atlanır ve CDN görsellerine düşülür.
 *
 * @param {object} product
 * @returns {string[]} Görsel URL'leri (yerel yol veya CDN adresi).
 */
export function getProductImages(product) {
  if (!product) {
    return []
  }

  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : []

  if (!product.id) {
    return images
  }

  // Yalnızca Node (build/SSG) ortamında dosya sistemi kontrolü yapılabilir.
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node)
  const existsSync = isNode
    ? globalThis.__SA_PRINTPRO_FS__?.existsSync
    : undefined

  return images.map((cdnImage, index) => {
    if (typeof existsSync !== 'function') {
      return cdnImage
    }
    const localPath = `/uploads/products/${product.id}-${index}.webp`
    try {
      const absolute = `${process.cwd()}/public${localPath}`
      return existsSync(absolute) ? localPath : cdnImage
    } catch {
      return cdnImage
    }
  })
}

/**
 * İstemci adalarına (React grid/kart bileşenleri) gönderilecek ürün nesnesini
 * hazırlar.
 *
 * Astro, ada prop'larını HTML'e serileştirdiği için `product.images` içindeki
 * ham Trendyol CDN URL'leri sayfa kaynağına sızıyordu. Bu fonksiyon, görselleri
 * yerelleştirilmiş (`/uploads/products/...`) yollarla değiştirir; böylece
 * sayfa kaynağında hiçbir harici görsel URL'i kalmaz ve Trendyol hotlink
 * bağımlılığı tamamen ortadan kalkar.
 *
 * @param {object} product
 * @returns {object} Sadeleştirilmiş ürün kopyası.
 */
export function toClientProduct(product) {
  if (!product) {
    return product
  }

  const localImages = getProductImages(product).filter(
    (url) => typeof url === 'string' && url.startsWith('/uploads/')
  )

  return {
    ...product,
    images: localImages.length > 0 ? localImages : [],
  }
}

/**
 * Finds a single product by its slug.
 * @param {string} slug
 * @returns {object|undefined}
 */
export function getProductBySlug(slug) {
  return getAllProducts().find((product) => product.slug === slug)
}

/**
 * FAZ B — B3: Kategori birleştirme katmanı.
 *
 * Trendyol'dan gelen ham kategori slug'larını, vitrinde gösterilecek
 * birleştirilmiş/sadeleştirilmiş kategorilere eşler. Bu katman sayesinde
 * `src/data/products.json` HAM VERİSİ DEĞİŞMEZ; sonraki Trendyol sync'i
 * eşlemeyi otomatik olarak korur.
 *
 * Anahtar: kaynak kategori slug'ı (products.json içindeki `category.slug`).
 * Değer: `{ name, slug }` — birleşik görünen kategori.
 *
 * Birleştirme kararları (ince/zayıf kategoriler güçlü kategorilere taşınır):
 *  - "Duvar Sticker" + "Duvar Dekorasyon Ürünü" + "Ayna" → "Duvar & Dekorasyon"
 *  - "Motosiklet Lüzumlu Ürün" → "Tankpad & Sticker"
 *  - Diğerleri (arma-sticker-fosfor-serit, motosiklet-jant-serit, reflektor,
 *    ofis-sarf-tuketim-malzemesi) aynen kalır.
 *
 * @type {Record<string, {name: string, slug: string}>}
 */
export const CATEGORY_MAP = {
  'duvar-sticker': { name: 'Duvar & Dekorasyon', slug: 'duvar-dekorasyon' },
  'duvar-dekorasyon-urunu': { name: 'Duvar & Dekorasyon', slug: 'duvar-dekorasyon' },
  ayna: { name: 'Duvar & Dekorasyon', slug: 'duvar-dekorasyon' },
  'motosiklet-luzumlu-urun': { name: 'Tankpad & Sticker', slug: 'tankpad-sticker' },
}

/**
 * FAZ 4 — G3.1: `arma-sticker-fosfor-serit` kategorisi bölündükten sonra
 * oluşan yeni alt kategorilerin görünen adları.
 *
 * `scripts/reclassify-categories.mjs` her ürüne `categoryOverride` alanı
 * ekler; `resolveCategory` bu slug'ı bu haritadan okur. Böylece ham
 * `products.json` kategori alanı değişmeden kalır (Trendyol sync güvenliği).
 *
 * @type {Record<string, {name: string, slug: string}>}
 */
export const CATEGORY_OVERRIDE_NAMES = {
  'motosiklet-sticker-granaj': {
    name: 'Motosiklet Sticker & Granaj',
    slug: 'motosiklet-sticker-granaj',
  },
  'araba-sticker-aksesuar': {
    name: 'Araba Sticker & Aksesuar',
    slug: 'araba-sticker-aksesuar',
  },
  'dini-kaligrafi-sticker': {
    name: 'Dini & Kaligrafi Sticker',
    slug: 'dini-kaligrafi-sticker',
  },
  'duvar-dekor-sticker': {
    name: 'Duvar & Dekor Sticker',
    slug: 'duvar-dekor-sticker',
  },
  'ayna-cam-sticker': {
    name: 'Ayna & Cam Sticker',
    slug: 'ayna-cam-sticker',
  },
}

/**
 * Eski (kaldırılan) kategori slug'larından yeni birleşik slug'lara 301
 * yönlendirme haritası. `worker/index.js` bu haritayı kullanır; ayrıca
 * dokümantasyon/doğrulama amaçlı burada da tutulur.
 *
 * FAZ 4 — G3.3: `arma-sticker-fosfor-serit` bölündüğü için eski kategori
 * URL'i en büyük alt kategoriye (Motosiklet Sticker & Granaj) yönlendirilir.
 *
 * @type {Record<string, string>}
 */
export const CATEGORY_REDIRECTS = {
  ayna: 'duvar-dekorasyon',
  'duvar-sticker': 'duvar-dekorasyon',
  'duvar-dekorasyon-urunu': 'duvar-dekorasyon',
  'motosiklet-luzumlu-urun': 'tankpad-sticker',
  'arma-sticker-fosfor-serit': 'motosiklet-sticker-granaj',
}

/**
 * FAZ 4 — G2.4: Birebir duplicate ürünler birleştirildiği için eski ürün
 * slug'ları artık statik olarak ÜRETİLMEZ. Bu harita, eski ürün URL'lerini
 * master ürüne kalıcı (301) olarak yönlendirir.
 *
 * Kalıcı veri kaynağı `src/data/product-redirects.json` dosyasıdır;
 * `scripts/merge-duplicates.mjs` bu dosyayı idempotent olarak üretir ve
 * `worker/index.js` içindeki `PRODUCT_REDIRECTS` bloğunu senkronlar.
 *
 * Anahtar: eski ürün slug'ı. Değer: master ürün slug'ı.
 *
 * @type {Record<string, string>}
 */
export const PRODUCT_REDIRECTS = productRedirectsData

/**
 * Bir ürünün ham kategorisini birleşik görünen kategoriye çevirir.
 * Eşleme yoksa ham kategori aynen döndürülür.
 *
 * FAZ 4 — G3.1: `scripts/reclassify-categories.mjs` tarafından eklenen
 * `categoryOverride` alanı EN YÜKSEK önceliğe sahiptir. Böylece ham
 * `products.json` kategori alanı değişmeden kalır ve Trendyol sync'i
 * override'ı silmez.
 *
 * Öncelik sırası:
 *   1. `categoryOverride` (script ile atanan yeni alt kategori)
 *   2. `CATEGORY_MAP` (FAZ B birleştirme katmanı)
 *   3. Ham kategori (aynen)
 *
 * @param {{id?: string, name?: string, slug?: string}|undefined} category
 * @param {{id?: string, name?: string, slug?: string}|undefined} [override]
 * @returns {{id: string, name: string, slug: string}|undefined}
 */
export function resolveCategory(category, override) {
  if (override && override.slug) {
    const known = CATEGORY_OVERRIDE_NAMES[override.slug]
    return {
      id: override.id || known?.id || category?.id,
      name: override.name || known?.name || override.slug,
      slug: override.slug,
    }
  }

  if (!category) {
    return undefined
  }

  const mapped = CATEGORY_MAP[category.slug]
  if (!mapped) {
    return category
  }

  return {
    id: category.id,
    name: mapped.name,
    slug: mapped.slug,
  }
}

/**
 * Builds a de-duplicated, alphabetically sorted category list with product
 * counts, applying the `CATEGORY_MAP` merge layer so thin categories collapse
 * into their consolidated counterparts.
 *
 * @returns {Array<{id: string, name: string, slug: string, count: number}>}
 */
export function getAllCategories() {
  const map = new Map()

  for (const product of getAllProducts()) {
    const category = resolveCategory(product.category, product.categoryOverride)
    if (!category) {
      continue
    }

    const existing = map.get(category.slug)
    if (existing) {
      existing.count += 1
    } else {
      map.set(category.slug, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        count: 1,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

/**
 * Returns all products belonging to the given (consolidated) category slug.
 * The merge layer is applied so legacy slugs resolve to their new category.
 *
 * @param {string} categorySlug
 * @returns {Array<object>}
 */
export function getProductsByCategory(categorySlug) {
  return getAllProducts().filter((product) => {
    const category = resolveCategory(product.category, product.categoryOverride)
    return category && category.slug === categorySlug
  })
}

/**
 * Sums the stock across all variants of a product.
 * @param {object} product
 * @returns {number}
 */
function totalStock(product) {
  if (!Array.isArray(product.variants)) {
    return 0
  }
  return product.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0)
}

/**
 * Returns featured products based on featuredSlugs, falling back to the
 * top 4 products by total stock when no featured matches exist.
 * @returns {Array<object>}
 */
export function getFeaturedProducts() {
  const all = getAllProducts()

  if (Array.isArray(featuredSlugs) && featuredSlugs.length > 0) {
    const featured = featuredSlugs
      .map((slug) => all.find((product) => product.slug === slug))
      .filter(Boolean)

    if (featured.length > 0) {
      return featured
    }
  }

  return [...all].sort((a, b) => totalStock(b) - totalStock(a)).slice(0, 4)
}

/**
 * Turkish-aware, case-insensitive substring search across product name,
 * category name and variant SKUs.
 * @param {Array<object>} products
 * @param {string} query
 * @returns {Array<object>}
 */
export function searchProducts(products, query) {
  const normalizedQuery = normalizeTr(String(query || '').trim())

  if (normalizedQuery === '') {
    return products
  }

  return products.filter((product) => {
    const name = normalizeTr(product.name || '')
    if (name.includes(normalizedQuery)) {
      return true
    }

    const categoryName = normalizeTr((product.category && product.category.name) || '')
    if (categoryName.includes(normalizedQuery)) {
      return true
    }

    if (Array.isArray(product.variants)) {
      return product.variants.some((variant) =>
        normalizeTr(variant.sku || '').includes(normalizedQuery)
      )
    }

    return false
  })
}

/**
 * Builds a Trendyol product URL for the given product/variant.
 *
 * Priority 1: a direct product deep link when the product exposes an `id`
 * (or `contentId`). Priority 2 (fallback): a seller-scoped search URL keyed
 * on the variant barcode, or the product name when no barcode exists.
 *
 * Every returned URL carries the configured UTM parameters so outbound
 * traffic is always attributable to the showcase.
 *
 * @param {object} product
 * @param {object} [variant]
 * @returns {string}
 */
export function getTrendyolProductUrl(product, variant) {
  const trendyol = siteConfig.trendyol || {}
  const sellerId = String(trendyol.sellerId || '')
  const utmParams = String(trendyol.utmParams || '')

  // Buybox koruma kalkanı: stok yoksa Trendyol linki ÜRETİLMEZ. Aksi halde
  // müşteri Trendyol Buybox'ındaki rakip satıcıya kaptırılır.
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const productStock = variants.reduce(
    (sum, item) => sum + (Number(item?.stock) || 0),
    0
  )

  if (productStock <= 0) {
    return null
  }

  if (variant) {
    const variantStock = Number(variant?.stock) || 0
    if (variantStock <= 0) {
      return null
    }
  }

  const contentId = product?.contentId || product?.id

  // `utmParams` is authored with a leading "?" so it can be appended to any
  // base URL; when a query string already exists we swap it for "&".
  const utmSuffix = utmParams.startsWith('?')
    ? `&${utmParams.slice(1)}`
    : utmParams

  if (contentId) {
    const brand = String(product?.brand || 'sa-printpro')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
    const slug = String(product?.slug || product?.name || 'urun')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    // merchantId ZORUNLU — satıcı koruma kalkanı.
    return `https://www.trendyol.com/${brand}/${slug}-p-${contentId}?merchantId=${sellerId}${utmSuffix}`
  }

  const query = variant?.barcode || product?.name || ''
  return `https://www.trendyol.com/sr?mid=${sellerId}&q=${encodeURIComponent(
    query
  )}${utmSuffix}`
}

/**
 * Calculates the web-exclusive direct-sale price for a given list price.
 *
 * Applies the configured `directDiscountRate` and then rounds to a value whose
 * last digit is always 5 (e.g. 199 -> 155, 120 -> 95). A floor of 5 TL keeps
 * the result sane for very cheap items.
 *
 * @param {number} price
 * @returns {number}
 */
/**
 * Hammadde / malzeme markaları. Bunlar ürünün ÜRETİCİ markası değildir; vinil,
 * folyo gibi girdilerin tedarikçi markalarıdır. Vitrinde "MARKA: Oracal" olarak
 * gösterildiğinde "%100 Orijinal SA Printpro Üretimi" mesajıyla çelişiyor ve
 * müşteri "bu SA Printpro ürünü mü yoksa Oracal markalı bir ürün mü?" diye
 * tereddüt ediyordu. Bu liste, bu tür alanları "Malzeme Markası" olarak
 * sınıflandırmak için kullanılır.
 *
 * @type {string[]}
 */
const MATERIAL_BRANDS = [
  'oracal',
  'oracall',
  'orafol',
  '3m',
  'avery',
  'avery dennison',
  'hexis',
  'kpmf',
  'metamark',
  'teckwrap',
]

/**
 * Ürün markası OLMAYAN, Trendyol'dan gelen jenerik/çöp `brand` değerleri.
 * Bunlar satıcıların marka alanına ürün türünü veya anlamsız bir etiket
 * yazmasından kaynaklanır (ör. "sticker", "rez", "Favori", "Home &").
 * Vitrinde "MARKA: sticker" gibi absürt bir satır görünmemesi için bu
 * değerler de ürün markası sayılmaz ve SA Printpro'ya düşülür.
 *
 * @type {string[]}
 */
const INVALID_BRAND_VALUES = [
  'sticker',
  'stickers',
  'etiket',
  'rez',
  'favori',
  'favorite',
  'home &',
  'home',
  'bys',
  'diğer',
  'diger',
  'yok',
  'belirsiz',
  'unknown',
  'n/a',
  '-',
  // Satıcı/mağaza adları — ürün markası DEĞİLDİR. Trendyol satıcıları marka
  // alanına kendi mağaza adlarını yazıyor; vitrinde "MARKA: CEBECİOTO" gibi
  // alakasız bir satır görünmemesi için SA Printpro'ya düşülür.
  'cebecioto',
  'benimser reklam',
  'kaplama merkezi',
  'asil ticaret',
  'tasarim market',
  'mtl pleksi',
  'triders',
]

/**
 * Bir ürünün `brand` alanını yorumlar.
 *
 * - `brand` bir hammadde/malzeme markasıysa (ör. "Oracal"), ürünün gerçek
 *   markası SA Printpro'dur; malzeme markası ayrıca döndürülür.
 * - Aksi halde `brand` ürün markası olarak kabul edilir.
 *
 * @param {object} product
 * @returns {{name: string, materialBrand: string|null}}
 */
export function resolveProductBrand(product) {
  const raw = String(product?.brand || '').trim()
  const normalized = normalizeTr(raw)

  // Tam eşleşme ya da bilinen malzeme markası köküyle başlama (ör. "oracall"
  // → "oracal" kökü) durumunda hammadde markası kabul edilir.
  const isMaterialBrand =
    raw !== '' &&
    MATERIAL_BRANDS.some(
      (brand) => normalized === brand || normalized.startsWith(brand)
    )

  if (isMaterialBrand) {
    return { name: siteConfig.name, materialBrand: raw }
  }

  // Jenerik/çöp marka değerleri (ör. "sticker", "rez", "Favori") ürün markası
  // DEĞİLDİR; vitrinde "MARKA: sticker" gibi absürt bir satır görünmemesi için
  // SA Printpro'ya düşülür ve malzeme markası olarak da gösterilmez.
  const isInvalidBrand =
    raw === '' || INVALID_BRAND_VALUES.includes(normalized)

  if (isInvalidBrand) {
    return { name: siteConfig.name, materialBrand: null }
  }

  return { name: raw, materialBrand: null }
}

/**
 * Calculates the web-exclusive direct-sale price for a given list price.
 *
 * Applies the configured `directDiscountRate` and then rounds to a value whose
 * last digit is always 5 (e.g. 199 -> 155, 120 -> 95). A floor of 5 TL keeps
 * the result sane for very cheap items.
 *
 * @param {number} price
 * @returns {number}
 */
export function calculateDirectPrice(price) {
  const numeric = Number(price)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }

  const rate = Number(siteConfig.features?.directDiscountRate)
  const safeRate = Number.isFinite(rate) ? rate : 0
  const raw = numeric * (1 - safeRate)

  return Math.max(5, Math.round((raw - 5) / 10) * 10 + 5)
}

/**
 * Detects the motorcycle brand of a product by scanning its name and variant
 * attribute values against the configured `motorcycleBrands` keyword lists.
 *
 * The first brand (in config order) with a matching keyword wins; when nothing
 * matches, the `universal` brand is returned as the fallback.
 *
 * @param {object} product
 * @returns {{name: string, slug: string, keywords: Array<string>}}
 */
export function detectProductBrand(product) {
  const brands = Array.isArray(siteConfig.motorcycleBrands)
    ? siteConfig.motorcycleBrands
    : []
  const fallback =
    brands.find((brand) => brand.slug === 'universal') || {
      name: 'Universal / Genel',
      slug: 'universal',
      keywords: ['universal', 'genel'],
    }

  if (!product) {
    return fallback
  }

  // Build a single normalized haystack from the product name plus every
  // attribute value across all variants.
  const parts = [product.name || '']

  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      const attributes = variant?.attributes
      if (attributes && typeof attributes === 'object') {
        for (const value of Object.values(attributes)) {
          if (value !== null && value !== undefined) {
            parts.push(String(value))
          }
        }
      }
    }
  }

  const haystack = normalizeTr(parts.join(' '))

  for (const brand of brands) {
    if (brand.slug === 'universal') {
      continue
    }
    const keywords = Array.isArray(brand.keywords) ? brand.keywords : []
    const matched = keywords.some((keyword) =>
      haystack.includes(normalizeTr(String(keyword)))
    )
    if (matched) {
      return brand
    }
  }

  return fallback
}

/**
 * Detects the specific motorcycle models a product is compatible with by
 * scanning its name and variant attribute values against the configured
 * `motorcycleModels` keyword lists.
 *
 * Returns a de-duplicated array of `{ brand, model }` entries in config order.
 * An empty array means the product is universal (no specific model matched).
 *
 * @param {object} product
 * @returns {Array<{brand: string, model: string}>}
 */
export function detectCompatibleModels(product) {
  const models = Array.isArray(siteConfig.motorcycleModels)
    ? siteConfig.motorcycleModels
    : []

  if (!product || models.length === 0) {
    return []
  }

  // Build a single normalized haystack from the product name plus every
  // attribute value across all variants.
  const parts = [product.name || '']

  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      const attributes = variant?.attributes
      if (attributes && typeof attributes === 'object') {
        for (const value of Object.values(attributes)) {
          if (value !== null && value !== undefined) {
            parts.push(String(value))
          }
        }
      }
    }
  }

  const haystack = normalizeTr(parts.join(' '))
  const matched = []
  const seen = new Set()

  for (const entry of models) {
    const brand = String(entry?.brand || '')
    const model = String(entry?.model || '')
    const keywords = Array.isArray(entry?.keywords) ? entry.keywords : []

    const hit = keywords.some((keyword) =>
      haystack.includes(normalizeTr(String(keyword)))
    )

    if (!hit) {
      continue
    }

    const key = `${brand}::${model}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    matched.push({ brand, model })
  }

  return matched
}

/**
 * Builds the list of motorcycle brands that actually have products, each with
 * its product count. Brands with zero products are filtered out.
 *
 * FAZ 4 — G4.1: Opsiyonel `products` parametresi ile sayaçlar YALNIZCA
 * verilen ürün kümesi üzerinden hesaplanır. Kategori sayfaları bu parametreye
 * kategoriye ait ürünleri geçirerek sitewide sayım hatasını önler.
 *
 * GERİYE DÖNÜK UYUMLU: Parametre verilmezse tüm katalog üzerinden sayar
 * (mevcut çağrılar — `index.astro`, `urunler/[...page].astro` — değişmez).
 *
 * @param {Array<object>} [products] Sayım yapılacak ürün kümesi.
 * @returns {Array<{name: string, slug: string, count: number}>}
 */
export function getAllBrandsWithCounts(products) {
  const brands = Array.isArray(siteConfig.motorcycleBrands)
    ? siteConfig.motorcycleBrands
    : []
  const counts = new Map()

  const source = Array.isArray(products) ? products : getAllProducts()

  for (const product of source) {
    const brand = detectProductBrand(product)
    counts.set(brand.slug, (counts.get(brand.slug) || 0) + 1)
  }

  return brands
    .map((brand) => ({
      name: brand.name,
      slug: brand.slug,
      count: counts.get(brand.slug) || 0,
    }))
    .filter((brand) => brand.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'))
}

/**
 * Returns all products belonging to the given motorcycle brand slug.
 *
 * @param {string} brandSlug
 * @returns {Array<object>}
 */
export function getProductsByBrand(brandSlug) {
  if (!brandSlug) {
    return getAllProducts()
  }
  return getAllProducts().filter(
    (product) => detectProductBrand(product).slug === brandSlug
  )
}

/**
 * Finds a single motorcycle brand definition by its slug.
 *
 * @param {string} slug
 * @returns {{name: string, slug: string, keywords: Array<string>}|undefined}
 */
export function getBrandBySlug(slug) {
  const brands = Array.isArray(siteConfig.motorcycleBrands)
    ? siteConfig.motorcycleBrands
    : []
  return brands.find((brand) => brand.slug === slug)
}

/**
 * Computes the discount rate (0..1) of a product from its cheapest variant.
 * A positive `salePrice` below `price` yields the reduction; otherwise 0.
 *
 * @param {object} product
 * @returns {number}
 */
function discountRate(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  let best = 0

  for (const variant of variants) {
    const list = Number(variant?.price)
    const sale = Number(variant?.salePrice)
    if (!Number.isFinite(list) || list <= 0) {
      continue
    }
    if (!Number.isFinite(sale) || sale <= 0 || sale >= list) {
      continue
    }
    const rate = (list - sale) / list
    if (rate > best) {
      best = rate
    }
  }

  return best
}

/**
 * Smart ranking score used to surface the most attractive products first.
 *
 * Formula:
 *   (totalStock * 0.2) + (discountRate * 1.5) + (images.length * 5)
 *   - (totalStock === 0 ? 10000 : 0)
 *
 * Out-of-stock products are pushed to the bottom via the large penalty.
 *
 * @param {object} product
 * @returns {number}
 */
export function calculateProductScore(product) {
  if (!product) {
    return 0
  }

  const stock = totalStock(product)
  const discount = discountRate(product)
  const images = Array.isArray(product.images) ? product.images.length : 0

  return (
    stock * 0.2 +
    discount * 1.5 +
    images * 5 -
    (stock === 0 ? 10000 : 0)
  )
}

/**
 * Returns a new array of products sorted by descending smart score.
 * The input array is never mutated.
 *
 * @param {Array<object>} products
 * @returns {Array<object>}
 */
export function getSortedProducts(products) {
  const list = Array.isArray(products) ? products : getAllProducts()
  return [...list].sort(
    (a, b) => calculateProductScore(b) - calculateProductScore(a)
  )
}
