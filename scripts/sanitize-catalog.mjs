#!/usr/bin/env node
/**
 * Mevcut `src/data/products.json` kataloğunu rakip satıcı izlerinden temizler.
 *
 * `scripts/fetch-trendyol.mjs` içindeki `sanitizeCatalogText` ile aynı kuralları
 * uygular; ürün adı, marka, açıklama, varyant özellikleri ve SKU alanlarını
 * tarar. Kaç alanın değiştiğini raporlar.
 *
 * Kullanım:
 *   node scripts/sanitize-catalog.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'products.json');

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
    const normalized = normalizeTr(brand).trim();
    if (GENERIC_TITLE_WORDS.has(normalized)) {
      throw new Error(
        `[COMPETITOR_BRANDS] Jenerik kelime marka listesine eklenemez: "${brand}". ` +
          'Bu, ürün başlıklarındaki meşru kelimeleri bozar (bkz. GENERIC_TITLE_WORDS).'
      );
    }
  }
}

const COMPETITOR_ENTITIES = [
  'meca ajans kurumsal reklam ve baskı hizmetleri',
  'meca ajans'
];

/**
 * Pazaryerinin (Trendyol) ürün açıklamalarına zorunlu olarak eklediği
 * uyum/uyarı cümleleri. Kendi vitrinimizde olumsuz mesaj verdiği için
 * cümle bazında silinir. Kalıplar bilinçli olarak dar tutulmuştur.
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
 * Türkçe karakterleri ASCII karşılıklarına indirgeyip küçük harfe çevirir.
 * `İ`/`I`/`ı`/`i` gibi harflerin JS regex `i` bayrağıyla eşleşmemesi
 * sorununu çözer; marka eşleştirmesi bu normalize edilmiş metin üzerinden
 * yapılır, böylece "BENİMSER REKLAM" da "benimser reklam" ile eşleşir.
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeTr(str) {
  return String(str)
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
    .toLowerCase();
}

/**
 * Bir metin içindeki tüm rakip marka adlarını, Türkçe karakter farkı
 * gözetmeksizin (case-insensitive + diacritic-insensitive) bulup
 * "SA Printpro" ile değiştirir.
 *
 * @param {string} text
 * @returns {string}
 */
function replaceCompetitorBrands(text) {
  let output = String(text);
  for (const brand of COMPETITOR_BRANDS) {
    const normalizedBrand = normalizeTr(brand);
    // Normalize edilmiş metin üzerinde eşleşme arar; orijinal metni
    // karakter karakter tarayarak eşleşen aralığı "SA Printpro" ile değiştirir.
    const normalizedOutput = normalizeTr(output);
    let searchFrom = 0;
    let result = '';
    let cursor = 0;
    while (searchFrom <= normalizedOutput.length) {
      const hit = normalizedOutput.indexOf(normalizedBrand, searchFrom);
      if (hit === -1) {
        break;
      }
      result += output.slice(cursor, hit) + 'SA Printpro';
      cursor = hit + normalizedBrand.length;
      searchFrom = cursor;
    }
    result += output.slice(cursor);
    output = result;
  }
  return output;
}

/**
 * Katalog metinlerinden rakip satıcı unvanlarını, ajans referanslarını,
 * telefon numaralarını, harici linkleri ve pazaryeri zorunlu uyum/uyarı
 * cümlelerini temizler.
 *
 * @param {string} text
 * @returns {string}
 */
function sanitizeCatalogText(text) {
  if (text === null || text === undefined) return '';

  let output = String(text);

  // Rakip satıcı adları → "SA Printpro" (Türkçe karakter farkı gözetmeksizin).
  output = replaceCompetitorBrands(output);

  for (const entity of COMPETITOR_ENTITIES) {
    const pattern = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(pattern, '');
  }

  output = output
    .replace(/(?:\+?90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '')
    .replace(/\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '');

  output = output
    .replace(/https?:\/\/[^\s<>"')]+/gi, '')
    .replace(/\bwww\.[a-z0-9-]+\.[a-z]{2,}(\/[^\s<>"')]*)?/gi, '');

  for (const pattern of COMPLIANCE_SENTENCE_PATTERNS) {
    output = output.replace(pattern, ' ');
  }

  // Trendyol şablon kalıntıları ("Diğer kategorisinde yer alan ...") → sil.
  for (const pattern of TEMPLATE_LEFTOVER_PATTERNS) {
    output = output.replace(pattern, ' ');
  }

  // "sticker → SA Printpro" regresyon onarımı (güvenlik ağı).
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

  // Madde işareti / ayraç kalıntılarını temizle ("; - " → ". ").
  output = output
    .replace(/\s*;\s*[-–—•·]\s*/g, '. ')
    .replace(/(^|\n)\s*[-–—•·]\s+/g, '$1')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return output.replace(/\s{2,}/g, ' ').trim();
}

/** İstatistik sayaçları. */
const stats = {
  name: 0,
  brand: 0,
  description: 0,
  attributes: 0,
  sku: 0
};

/**
 * Bir metin alanını temizler ve değiştiyse sayacı artırır.
 *
 * @param {string} value
 * @param {keyof typeof stats} counter
 * @returns {string}
 */
function cleanField(value, counter) {
  if (typeof value !== 'string' || value === '') return value;
  const cleaned = sanitizeCatalogText(value);
  if (cleaned !== value) {
    stats[counter] += 1;
  }
  return cleaned;
}

function main() {
  // Regresyonu kaynağında yakala: listeye jenerik kelime eklenirse dur.
  assertNoGenericBrands(COMPETITOR_BRANDS);

  if (!fs.existsSync(CATALOG_FILE)) {
    console.error(`[hata] Katalog bulunamadı: ${CATALOG_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CATALOG_FILE, 'utf8');
  const catalog = JSON.parse(raw);
  const products = Array.isArray(catalog?.products) ? catalog.products : [];

  for (const product of products) {
    product.name = cleanField(product.name, 'name');
    product.brand = cleanField(product.brand, 'brand');
    product.descriptionHtml = cleanField(product.descriptionHtml, 'description');

    if (Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        variant.sku = cleanField(variant.sku, 'sku');

        if (variant.attributes && typeof variant.attributes === 'object') {
          for (const [key, value] of Object.entries(variant.attributes)) {
            if (typeof value === 'string') {
              const cleaned = sanitizeCatalogText(value);
              if (cleaned !== value) {
                stats.attributes += 1;
                variant.attributes[key] = cleaned;
              }
            }
          }
        }
      }
    }
  }

  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

  const total =
    stats.name + stats.brand + stats.description + stats.attributes + stats.sku;

  console.log('[sanitize-catalog] Temizlik tamamlandı.');
  console.log(`  Ürün adı        : ${stats.name}`);
  console.log(`  Marka           : ${stats.brand}`);
  console.log(`  Açıklama        : ${stats.description}`);
  console.log(`  Varyant özelliği: ${stats.attributes}`);
  console.log(`  SKU             : ${stats.sku}`);
  console.log(`  TOPLAM          : ${total} alan temizlendi.`);
}

main();
