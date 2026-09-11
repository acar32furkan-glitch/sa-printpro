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

const COMPETITOR_BRANDS = [
  'baskı babası',
  'baski babasi',
  'baskibabasi',
  'baskıbabası',
  'baski babası',
  'baskı babasi'
];

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

  for (const brand of COMPETITOR_BRANDS) {
    const pattern = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(pattern, 'SA Printpro');
  }

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
