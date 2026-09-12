#!/usr/bin/env node
/**
 * Trendyol ürün senkronizasyon script'i (FAZ 1).
 *
 * Trendyol Seller API (V2) üzerinden onaylı ürünleri ve fiyat/stok verisini çeker,
 * Master Prompt §4 normalize şemasına dönüştürür ve `src/data/products.json`
 * dosyasına atomik olarak yazar.
 *
 * Harici bağımlılık YOK — yalnızca Node built-in modülleri ve global `fetch`.
 *
 * Kullanım:
 *   node scripts/fetch-trendyol.mjs
 *   npm run sync
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');
const DATA_DIR = path.join(PROJECT_ROOT, 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'products.json');
const TMP_FILE = path.join(DATA_DIR, 'products.json.tmp');

const BASE_URL = 'https://apigw.trendyol.com';
const PAGE_SIZE = 100; // Trendyol üst sınırı
const PAGE_DELAY_MS = 250; // Sayfalar arası bekleme (rate limit)
const MAX_ATTEMPTS = 3; // İstek başına maksimum deneme
const BACKOFF_BASE_MS = 1000; // Üssel geri çekilme tabanı: 1s → 2s → 4s

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/** Belirtilen milisaniye kadar bekler. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Türkçe log yardımcıları. */
const log = {
  info: (msg) => console.log(`[bilgi] ${msg}`),
  step: (msg) => console.log(`[adım]  ${msg}`),
  warn: (msg) => console.warn(`[uyarı] ${msg}`),
  error: (msg) => console.error(`[hata]  ${msg}`),
  success: (msg) => console.log(`[tamam] ${msg}`)
};

/**
 * `.env.local` dosyasını manuel olarak parse eder (dotenv bağımlılığı yok).
 * `process.env` içinde zaten tanımlı olan değerler korunur (öncelikli).
 *
 * @returns {Record<string, string>} Ortam değişkenleri haritası.
 */
function loadEnv() {
  const env = {};

  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;

      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();

      // Çevreleyen tırnakları kaldır
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) env[key] = value;
    }
  }

  // process.env öncelikli (CI ortamları için)
  for (const key of ['TRENDYOL_API_KEY', 'TRENDYOL_API_SECRET', 'TRENDYOL_SUPPLIER_ID']) {
    if (process.env[key]) env[key] = process.env[key];
  }

  return env;
}

/**
 * Türkçe karakterleri sadeleştirip lowercase-hyphenate slug üretir.
 *
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  if (!text) return '';

  const map = {
    İ: 'i',
    I: 'i',
    ı: 'i',
    Ş: 's',
    ş: 's',
    Ğ: 'g',
    ğ: 'g',
    Ü: 'u',
    ü: 'u',
    Ö: 'o',
    ö: 'o',
    Ç: 'c',
    ç: 'c'
  };

  return String(text)
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // kalan aksanları temizle
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Üçüncü taraf (rakip) satıcı unvanları — katalogda asla görünmemeli.
 * Eşleştirme Türkçe-duyarlı ve büyük/küçük harf bağımsızdır.
 *
 * ÖNEMLİ: Bu liste YALNIZCA tam mağaza unvanlarını içermelidir. Ürün türünü
 * veya jenerik bir kelimeyi (ör. "sticker", "rez", "3m", "favori") içeren kısa
 * parçalar EKLENMEMELİDİR — aksi halde ürün başlıklarındaki meşru kelimeler
 * yanlışlıkla "SA Printpro" ile değiştirilir ve hem başlıklar bozulur hem de
 * SEO'da aranan kelimeler kaybolur.
 *
 * Bu liste `src/lib/products.js` ve `scripts/sanitize-catalog.mjs` ile
 * senkron tutulmalıdır; aşağıdaki `assertNoGenericBrands` guard'ı jenerik
 * kelime eklenmesini senkronizasyon anında engeller.
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
  'unifol'
];

/**
 * Jenerik ürün türü / malzeme kelimeleri. Bunlar ASLA `COMPETITOR_BRANDS`
 * içine girmemelidir; aksi halde ürün başlıklarındaki meşru kelimeler
 * yanlışlıkla "SA Printpro" ile değiştirilir (ör. "Granaj Sticker Etiket"
 * → "Granaj SA Printpro Etiket") ve hem başlıklar bozulur hem de SEO'da
 * aranan kelimeler kaybolur.
 *
 * Bu liste, geçmişte yaşanan "sticker → SA Printpro" regresyonunun bir daha
 * oluşmaması için bir güvenlik ağıdır: aşağıdaki `assertNoGenericBrands`
 * fonksiyonu, listeye jenerik bir kelime eklenirse senkronizasyon anında
 * hata fırlatır.
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
  'favori'
]);

/**
 * `COMPETITOR_BRANDS` içinde jenerik bir kelime bulunursa hata fırlatır.
 * Bu, "sticker → SA Printpro" benzeri bir regresyonu erken yakalar.
 *
 * @param {string[]} brands
 */
function assertNoGenericBrands(brands) {
  for (const brand of brands) {
    const normalized = String(brand)
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
      .trim();
    if (GENERIC_TITLE_WORDS.has(normalized)) {
      throw new Error(
        `[COMPETITOR_BRANDS] Jenerik kelime marka listesine eklenemez: "${brand}". ` +
          'Bu, ürün başlıklarındaki meşru kelimeleri bozar (bkz. GENERIC_TITLE_WORDS).'
      );
    }
  }
}

/** Kurumsal / ajans referansları — satıcı kimliğini sızdırır. */
const COMPETITOR_ENTITIES = [
  'meca ajans kurumsal reklam ve baskı hizmetleri',
  'meca ajans'
];

/**
 * Pazaryerinin (Trendyol) ürün açıklamalarına zorunlu olarak eklediği
 * uyum/uyarı cümleleri. Kendi vitrinimizde "bu ürün güvenli olmayabilir /
 * ithalatçısı bilinmiyor" mesajı verdiği için cümle bazında silinir.
 * Kalıplar bilinçli olarak dar tutulmuştur; normal ürün metnine dokunmaz.
 */
const COMPLIANCE_SENTENCE_PATTERNS = [
  // "ECE uygunluk sembolü ..." / "ECE uygunluk beyanı ..." cümleleri.
  /[^.!?\n]*\bECE\b[^.!?\n]*(?:uygunluk|uygun|sembol|işaret|beyan|standart|belge)[^.!?\n]*[.!?]?/giu,
  // "İthalatçı, yetkili temsilci veya ifa hizmet sağlayıcı bilgisi ..." cümleleri.
  /[^.!?\n]*\b(?:ithalatçı|ithalatci|yetkili temsilci|ifa hizmet sağlayıcı)\b[^.!?\n]*[.!?]?/giu,
  // "Türkiye'de ... tarafından ithal edilmiştir" kalıpları.
  /[^.!?\n]*\bithal edilmiştir\b[^.!?\n]*[.!?]?/giu,
  // Pazaryeri zorunlu uyum şablonları: "Bu ürün ... yönetmeliğine uygundur".
  /[^.!?\n]*\bBu ürün\b[^.!?\n]*\b(?:yönetmeliğine|yönetmelik|mevzuatına|standardına|uygundur|uygun olduğu)\b[^.!?\n]*[.!?]?/giu
];

/**
 * Trendyol ürün açıklamalarına otomatik eklenen, kendi vitrinimizde anlamsız
 * kalan şablon kalıntıları. Cümle bazında silinir; aksi halde açıklamada
 * "... üretilmiştir.; - Diğer kategorisinde yer alan bu ürün ..." gibi ham
 * madde işareti/ayraç artıkları görünür.
 */
const TEMPLATE_LEFTOVER_PATTERNS = [
  // "Diğer kategorisinde yer alan bu ürün ..." gibi kategori şablon cümleleri.
  /[^.!?\n]*\bDiğer kategorisinde yer alan\b[^.!?\n]*[.!?]?/giu,
  // "Bu ürün ... kategorisinde yer alan ..." varyantları.
  /[^.!?\n]*\bkategorisinde yer alan\b[^.!?\n]*[.!?]?/giu
];

/**
 * Katalog metinlerinden (ürün adı, açıklama, varyant özellikleri) rakip
 * satıcı unvanlarını, ajans referanslarını, telefon numaralarını, harici
 * linkleri ve pazaryeri zorunlu uyum/uyarı cümlelerini temizler.
 *
 * Rakip marka unvanları cümle akışını bozmamak için "SA Printpro" ile
 * değiştirilir; ajans referansları, telefon numaraları, harici URL'ler ve
 * uyum cümleleri tamamen silinir.
 *
 * @param {string} text
 * @returns {string}
 */
function sanitizeCatalogText(text) {
  if (text === null || text === undefined) return '';

  let output = String(text);

  // 1) Rakip satıcı unvanları → SA Printpro
  for (const brand of COMPETITOR_BRANDS) {
    const pattern = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(pattern, 'SA Printpro');
  }

  // 2) Ajans / kurumsal referanslar → sil
  for (const entity of COMPETITOR_ENTITIES) {
    const pattern = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(pattern, '');
  }

  // 3) Telefon numaraları (TR mobil + genel uluslararası) → sil
  output = output
    .replace(/(?:\+?90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '')
    .replace(/\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '');

  // 4) Harici linkler / çıplak alan adları → sil
  output = output
    .replace(/https?:\/\/[^\s<>"')]+/gi, '')
    .replace(/\bwww\.[a-z0-9-]+\.[a-z]{2,}(\/[^\s<>"')]*)?/gi, '');

  // 5) Pazaryeri zorunlu uyum/uyarı cümleleri → sil
  for (const pattern of COMPLIANCE_SENTENCE_PATTERNS) {
    output = output.replace(pattern, ' ');
  }

  // 6) Trendyol şablon kalıntıları ("Diğer kategorisinde yer alan ...") → sil
  for (const pattern of TEMPLATE_LEFTOVER_PATTERNS) {
    output = output.replace(pattern, ' ');
  }

  // 6b) "sticker → SA Printpro" regresyon onarımı (güvenlik ağı).
  // Geçmişte çıplak "sticker" kuralı meşru kelimeyi markayla değiştirmişti
  // (ör. "diş SA Printpro setidir" ← "diş sticker setidir"). Markanın jenerik
  // bir ürün kelimesinin YERİNE geçtiği dar kalıpları onarır; meşru marka
  // kullanımlarına dokunmaz.
  output = output.replace(
    /\bSA Printpro\b(?=\s*(?:setidir|seti|setleri|set)\b)/giu,
    'sticker'
  );
  output = output.replace(/\bSA Printpro\b(?=['’](?:ı|i|u|ü)\b)/giu, 'sticker');
  output = output.replace(
    /\b(?:diş|far|granaj|grenaj|jant|depo|kask|kaput|kapı|kapi)\s+SA Printpro\b/giu,
    (match) => match.replace(/SA Printpro$/i, 'sticker')
  );

  // 7) Madde işareti / ayraç kalıntılarını temizle ("; - " → ". ")
  output = output
    .replace(/\s*;\s*[-–—•·]\s*/g, '. ')
    .replace(/(^|\n)\s*[-–—•·]\s+/g, '$1')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 8) Silme sonrası kalan fazla boşlukları toparla
  return output.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Başlıklarda satıcıların sıkça başvurduğu keyword stuffing kalıplarını
 * sadeleştirir (ör. "Reflektif Reflektif Reflektif").
 */
const STUFFING_PATTERNS = [
  /\b(\p{L}+)(?:\s+\1\b)+/giu // aynı kelimenin arka arkaya tekrarı
];

/**
 * Rakip satıcı/ajans unvanlarını temizleyip keyword stuffing'i sadeleştiren
 * kanonik giriş noktası. Marka/ajans temizliği için `sanitizeCatalogText`'e
 * delege eder; böylece iki katman senkron kalır.
 *
 * @param {string} text
 * @returns {string}
 */
function sanitizeProductContent(text) {
  let output = sanitizeCatalogText(text);

  // Ardışık tekrar eden kelimeleri tekilleştir (keyword stuffing).
  for (const pattern of STUFFING_PATTERNS) {
    output = output.replace(pattern, '$1');
  }

  // Aynı kelimenin 3+ kez geçtiği başlıklarda fazlalıkları at.
  const words = output.split(/\s+/).filter(Boolean);
  const seen = new Map();
  const deduped = [];
  for (const word of words) {
    const key = word
      .replace(/[İIıi]/g, 'i')
      .replace(/[Şş]/g, 's')
      .replace(/[Ğğ]/g, 'g')
      .replace(/[Üü]/g, 'u')
      .replace(/[Öö]/g, 'o')
      .replace(/[Çç]/g, 'c')
      .toLowerCase();
    const count = seen.get(key) || 0;
    // Kısa bağlaçlar (ve, ile, için) tekrar edebilir; onları koru.
    if (count >= 1 && key.length > 3) {
      continue;
    }
    seen.set(key, count + 1);
    deduped.push(word);
  }

  return deduped.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Çakışmayı önlemek için slug'a kısa bir sonek ekler.
 *
 * @param {string} baseSlug
 * @param {string} suffix
 * @returns {string}
 */
function withSuffix(baseSlug, suffix) {
  const clean = slugify(suffix);
  if (!clean) return baseSlug;
  return baseSlug ? `${baseSlug}-${clean}` : clean;
}

/**
 * `Retry-After` header'ını milisaniyeye çevirir.
 * Saniye (ör. "5") veya HTTP-date formatını destekler.
 *
 * @param {string|null} headerValue
 * @returns {number|null} Bekleme süresi (ms) veya parse edilemezse null.
 */
function parseRetryAfter(headerValue) {
  if (!headerValue) return null;

  const trimmed = headerValue.trim();

  // Saniye formatı
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  // HTTP-date formatı
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }

  return null;
}

/**
 * 429 (rate limit) durumunda `Retry-After` header'ına uyar, yoksa üssel
 * geri çekilme uygular. Diğer non-2xx hatalarda net hata fırlatır.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<any>} Parse edilmiş JSON gövdesi.
 */
async function fetchWithRetry(url, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (networkError) {
      lastError = networkError;
      log.warn(`Ağ hatası (deneme ${attempt}/${MAX_ATTEMPTS}): ${networkError.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const waitMs = BACKOFF_BASE_MS * 2 ** (attempt - 1);
        log.info(`Yeniden denemeden önce ${waitMs}ms bekleniyor...`);
        await sleep(waitMs);
        continue;
      }
      throw new Error(`Ağ isteği başarısız oldu: ${networkError.message}`);
    }

    if (response.ok) {
      return response.json();
    }

    // 429 — rate limit
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
      const waitMs = retryAfterMs ?? BACKOFF_BASE_MS * 2 ** (attempt - 1);

      if (attempt < MAX_ATTEMPTS) {
        log.warn(
          `429 (rate limit) — deneme ${attempt}/${MAX_ATTEMPTS}. ` +
            `${waitMs}ms bekleniyor${retryAfterMs !== null ? ' (Retry-After)' : ' (üssel backoff)'}...`
        );
        await sleep(waitMs);
        continue;
      }

      lastError = new Error(`429 rate limit — ${MAX_ATTEMPTS} denemede aşılamadı: ${url}`);
      break;
    }

    // Diğer non-2xx hatalar — net hata fırlat
    const bodyText = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status} ${response.statusText} — ${url}` +
        (bodyText ? `\nYanıt: ${bodyText.slice(0, 500)}` : '')
    );
  }

  throw lastError ?? new Error(`İstek başarısız oldu: ${url}`);
}

/**
 * Trendyol API için ortak header'ları üretir.
 *
 * @param {string} apiKey
 * @param {string} apiSecret
 * @param {string} supplierId
 * @returns {Record<string, string>}
 */
function buildHeaders(apiKey, apiSecret, supplierId) {
  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  return {
    Authorization: `Basic ${basic}`,
    // ZORUNLU: yoksa 403 döner
    'User-Agent': `${supplierId} - SelfIntegration`,
    Accept: 'application/json'
  };
}

/**
 * Onaylı ürünleri sayfalayarak çeker.
 * `page=0`'dan başlar, boş dizi dönene kadar döngü sürer.
 * `totalElements`/`totalPages` varsayımı YAPILMAZ.
 *
 * @param {object} ctx
 * @returns {Promise<object[]>}
 */
async function fetchAllApprovedProducts(ctx) {
  const { supplierId, headers } = ctx;
  const all = [];
  let page = 0;

  log.step('Onaylı ürünler çekiliyor...');

  for (;;) {
    const url =
      `${BASE_URL}/integration/product/sellers/${supplierId}/products/approved` +
      `?page=${page}&size=${PAGE_SIZE}`;

    const data = await fetchWithRetry(url, { method: 'GET', headers });
    const items = Array.isArray(data?.content) ? data.content : [];

    if (items.length === 0) {
      log.info(`Sayfa ${page}: boş dizi — döngü sonlandırılıyor.`);
      break;
    }

    all.push(...items);
    log.info(`Sayfa ${page}: ${items.length} ürün alındı (toplam: ${all.length}).`);

    page += 1;
    await sleep(PAGE_DELAY_MS);
  }

  log.success(`Toplam ${all.length} onaylı ürün çekildi.`);
  return all;
}

/**
 * Fiyat/stok verisini sayfalayarak çeker.
 *
 * @param {object} ctx
 * @returns {Promise<object[]>}
 */
async function fetchInventoryAndPrice(ctx) {
  const { supplierId, headers } = ctx;
  const all = [];
  let page = 0;

  log.step('Fiyat/stok verisi çekiliyor...');

  for (;;) {
    const url =
      `${BASE_URL}/integration/product/sellers/${supplierId}/products/approved/inventory-and-price` +
      `?page=${page}&size=${PAGE_SIZE}`;

    const data = await fetchWithRetry(url, { method: 'GET', headers });
    const items = Array.isArray(data?.content) ? data.content : [];

    if (items.length === 0) {
      log.info(`Sayfa ${page}: boş dizi — döngü sonlandırılıyor.`);
      break;
    }

    all.push(...items);
    log.info(`Sayfa ${page}: ${items.length} kayıt alındı (toplam: ${all.length}).`);

    page += 1;
    await sleep(PAGE_DELAY_MS);
  }

  log.success(`Toplam ${all.length} fiyat/stok kaydı çekildi.`);
  return all;
}

/**
 * Fiyat/stok kayıtlarını `barcode` (yoksa `contentId`) bazlı bir Map'e dönüştürür.
 *
 * V2 şeması: her kayıt `variants[]` dizisi içerir; fiyat/stok alanları
 * (`listPrice`, `salePrice`, `quantity`) varyant seviyesindedir. V1 düz
 * alanları da geriye dönük desteklenir.
 *
 * @param {object[]} inventoryItems
 * @returns {Map<string, object>}
 */
function buildPriceMap(inventoryItems) {
  const map = new Map();

  for (const item of inventoryItems) {
    const contentId = item?.contentId ?? item?.id;
    const variants =
      Array.isArray(item?.variants) && item.variants.length > 0 ? item.variants : [item];

    for (const variant of variants) {
      const barcode = variant?.barcode != null ? String(variant.barcode) : null;
      if (barcode) map.set(barcode, variant);
    }

    // Ürün seviyesinde de erişilebilsin (barcode yoksa fallback)
    if (contentId != null) {
      const key = String(contentId);
      if (!map.has(key)) map.set(key, variants[0]);
    }
  }

  return map;
}

/**
 * Trendyol `attributes` dizisini `{ [name]: value }` map'ine çevirir.
 *
 * @param {object[]|undefined} attributes
 * @returns {Record<string, string>}
 */
function normalizeAttributes(attributes) {
  const result = {};
  if (!Array.isArray(attributes)) return result;

  for (const attr of attributes) {
    const name = attr?.attributeName ?? attr?.name;
    const value = attr?.attributeValue ?? attr?.value;
    if (name != null && value != null) {
      // Özellik değerlerindeki rakip satıcı izlerini de temizle.
      result[String(name)] = sanitizeProductContent(String(value));
    }
  }
  return result;
}

/**
 * Trendyol `images` dizisini URL listesine çevirir.
 *
 * @param {Array<object|string>|undefined} images
 * @returns {string[]}
 */
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => (typeof img === 'string' ? img : img?.url))
    .filter((url) => typeof url === 'string' && url.length > 0);
}

/**
 * Ham Trendyol ürününü §4 normalize şemasına dönüştürür.
 *
 * @param {object} raw
 * @param {Map<string, object>} priceMap
 * @returns {object}
 */
function normalizeProduct(raw, priceMap) {
  // V2 şeması: ürün kimliği `contentId`; `id`/`productId` eski (V1) alanlardır.
  const id = String(raw?.contentId ?? raw?.id ?? raw?.productId ?? '');
  // Rakip satıcı izlerini ve keyword stuffing'i kaynağında temizle.
  const name = sanitizeProductContent(String(raw?.title ?? raw?.name ?? ''));

  // V2'de varyantlar `variants[]` altında gelir; her varyantın kendi
  // barcode/fiyat/stok bilgisi vardır. V1 düz alanları da geriye dönük desteklenir.
  const rawVariants = Array.isArray(raw?.variants) && raw.variants.length > 0 ? raw.variants : [raw];

  const variants = rawVariants.map((v) => {
    const barcode = v?.barcode != null ? String(v.barcode) : '';

    // Fiyat/stok verisini barcode (yoksa ürün id) üzerinden bul
    const priceEntry =
      (barcode && priceMap.get(barcode)) ||
      (id && priceMap.get(id)) ||
      null;

    // V2: `listPrice` (liste fiyatı) ve `salePrice` (satış fiyatı).
    // V1 uyumu için `price` alanı da desteklenir.
    const price = Number(
      priceEntry?.listPrice ?? priceEntry?.price ?? v?.listPrice ?? v?.price ?? raw?.price ?? 0
    );
    const rawSalePrice = priceEntry?.salePrice ?? v?.salePrice ?? raw?.salePrice;
    // Trendyol satışta olmayan ürünlerde `salePrice: 0` döner; bu durumda
    // liste fiyatına düşülür (aksi halde kartta "0 TL" görünür).
    const salePrice =
      rawSalePrice != null && rawSalePrice !== '' && Number(rawSalePrice) > 0
        ? Number(rawSalePrice)
        : price;
    const stock = Number(
      priceEntry?.quantity ??
        priceEntry?.stock ??
        v?.quantity ??
        v?.stock ??
        raw?.quantity ??
        raw?.stock ??
        0
    );

    // V2'de ürün özellikleri ürün seviyesindeki `attributes[]` dizisinde gelir;
    // varyant seviyesindeki `attributes` genellikle boş bir dizidir. Boş dizi
    // `??` ile "geçerli" sayılacağından uzunluk kontrolü yapılır.
    const variantAttrs = Array.isArray(v?.attributes) ? v.attributes : [];
    const productAttrs = Array.isArray(raw?.attributes) ? raw.attributes : [];
    const effectiveAttrs = variantAttrs.length > 0 ? variantAttrs : productAttrs;

    return {
      barcode,
      sku: String(v?.stockCode ?? v?.productCode ?? v?.sku ?? raw?.stockCode ?? ''),
      attributes: normalizeAttributes(effectiveAttrs),
      price,
      salePrice,
      stock
    };
  });

  const categoryId = String(raw?.categoryId ?? raw?.category?.id ?? '');
  const categoryName = String(raw?.categoryName ?? raw?.category?.name ?? '');

  return {
    id,
    name,
    slug: withSuffix(slugify(name), id),
    brand: sanitizeProductContent(
      String(raw?.brand?.name ?? raw?.brand ?? raw?.brandName ?? '')
    ),
    category: {
      id: categoryId,
      name: categoryName,
      slug: slugify(categoryName)
    },
    descriptionHtml: sanitizeProductContent(String(raw?.description ?? '')),
    images: normalizeImages(raw?.images),
    variants
  };
}

/**
 * Aynı `id`'ye sahip ürünleri birleştirir (dedup) ve varyantları toplar.
 *
 * @param {object[]} normalizedProducts
 * @returns {object[]}
 */
function dedupeProducts(normalizedProducts) {
  const map = new Map();

  for (const product of normalizedProducts) {
    if (!product.id) continue;

    if (!map.has(product.id)) {
      map.set(product.id, product);
      continue;
    }

    // Aynı ürünün farklı varyantı — varyantı ekle
    const existing = map.get(product.id);
    const incoming = product.variants[0];
    const alreadyExists = existing.variants.some(
      (v) => v.barcode && v.barcode === incoming.barcode
    );
    if (!alreadyExists) {
      existing.variants.push(incoming);
    }
  }

  return Array.from(map.values());
}

/**
 * Bir nesnenin SHA-256 hash'ini üretir.
 *
 * @param {string} content
 * @returns {string}
 */
function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Mevcut `products.json` içeriğini okur (yoksa null).
 *
 * @returns {string|null}
 */
function readExistingCatalog() {
  if (!fs.existsSync(OUTPUT_FILE)) return null;
  try {
    return fs.readFileSync(OUTPUT_FILE, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

async function main() {
  // Regresyonu kaynağında yakala: listeye jenerik kelime eklenirse dur.
  assertNoGenericBrands(COMPETITOR_BRANDS);

  log.step('Trendyol senkronizasyonu başlatılıyor...');

  // 1) Ortam değişkenleri
  const env = loadEnv();
  const apiKey = env.TRENDYOL_API_KEY;
  const apiSecret = env.TRENDYOL_API_SECRET;
  const supplierId = env.TRENDYOL_SUPPLIER_ID;

  const missing = [];
  if (!apiKey) missing.push('TRENDYOL_API_KEY');
  if (!apiSecret) missing.push('TRENDYOL_API_SECRET');
  if (!supplierId) missing.push('TRENDYOL_SUPPLIER_ID');

  if (missing.length > 0) {
    log.error(
      `Eksik ortam değişkenleri: ${missing.join(', ')}. ` +
        `Lütfen .env.local dosyasını doldurun (.env.example referans alın).`
    );
    process.exit(1);
  }

  const ctx = {
    supplierId,
    headers: buildHeaders(apiKey, apiSecret, supplierId)
  };

  // 2) Veri çekme
  const approvedProducts = await fetchAllApprovedProducts(ctx);
  const inventoryItems = await fetchInventoryAndPrice(ctx);

  // 3) Birleştirme + normalize
  log.step('Veriler birleştiriliyor ve normalize ediliyor...');
  const priceMap = buildPriceMap(inventoryItems);
  const normalized = approvedProducts.map((raw) => normalizeProduct(raw, priceMap));
  const products = dedupeProducts(normalized);
  log.success(`${products.length} benzersiz ürün normalize edildi.`);

  // 4) Katalog nesnesi
  const catalog = {
    generatedAt: new Date().toISOString(),
    products
  };
  const serialized = JSON.stringify(catalog, null, 2) + '\n';

  // 5) No-op tespiti (hash karşılaştırması)
  const existing = readExistingCatalog();
  if (existing !== null) {
    const existingHash = sha256(existing);
    const newHash = sha256(serialized);
    if (existingHash === newHash) {
      log.info('No changes detected, skipping write');
      process.exit(0);
    }
  }

  // 6) Atomic write
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log.info(`Dizin oluşturuldu: ${path.relative(PROJECT_ROOT, DATA_DIR)}`);
  }

  fs.writeFileSync(TMP_FILE, serialized, 'utf8');
  fs.renameSync(TMP_FILE, OUTPUT_FILE);
  log.success(`Katalog yazıldı: ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
}

main().catch((error) => {
  log.error(`Senkronizasyon başarısız oldu: ${error.message}`);
  log.error('Mevcut products.json dosyasına DOKUNULMADI.');
  process.exit(1);
});
