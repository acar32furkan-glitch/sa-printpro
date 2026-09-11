#!/usr/bin/env node
/**
 * Shopier link CSV içe aktarma script'i (FAZ 1).
 *
 * Kök dizindeki `shopier-links.csv` dosyasını (`barcode,url` formatı) okur ve
 * `src/config/shopier.json` haritasını `{ [barcode]: url }` olarak üretir.
 *
 * Harici bağımlılık YOK — yalnızca Node built-in modülleri.
 *
 * Kullanım:
 *   node scripts/import-shopier-csv.mjs
 *   npm run import-shopier
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CSV_FILE = path.join(PROJECT_ROOT, 'shopier-links.csv');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'src', 'config');
const OUTPUT_FILE = path.join(CONFIG_DIR, 'shopier.json');

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

const log = {
  info: (msg) => console.log(`[bilgi] ${msg}`),
  step: (msg) => console.log(`[adım]  ${msg}`),
  warn: (msg) => console.warn(`[uyarı] ${msg}`),
  error: (msg) => console.error(`[hata]  ${msg}`),
  success: (msg) => console.log(`[tamam] ${msg}`)
};

/**
 * Basit ama sağlam CSV satırı parse eder. Tırnak içi virgülleri ve
 * çift tırnak kaçışlarını (`""`) destekler.
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // kaçırılmış tırnak
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields.map((f) => f.trim());
}

/**
 * Header satırı olup olmadığını tespit eder (ör. `barcode,url`).
 *
 * @param {string[]} fields
 * @returns {boolean}
 */
function isHeaderRow(fields) {
  if (fields.length < 2) return false;
  const first = fields[0].toLowerCase();
  const second = fields[1].toLowerCase();
  return first === 'barcode' || second === 'url' || second === 'link';
}

/**
 * Haritayı 2-space indent ile yazar.
 *
 * @param {Record<string, string>} map
 */
function writeMap(map) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    log.info(`Dizin oluşturuldu: ${path.relative(PROJECT_ROOT, CONFIG_DIR)}`);
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2) + '\n', 'utf8');
  log.success(`Shopier haritası yazıldı: ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

function main() {
  log.step('Shopier CSV içe aktarma başlatılıyor...');

  // CSV yoksa: build'i bozmadan boş harita yaz
  if (!fs.existsSync(CSV_FILE)) {
    log.warn(
      `CSV dosyası bulunamadı: ${path.relative(PROJECT_ROOT, CSV_FILE)}. ` +
        'Boş harita yazılıyor.'
    );
    writeMap({});
    process.exit(0);
  }

  const content = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = content.split(/\r?\n/);

  const map = {};
  let processed = 0;
  let skipped = 0;
  let headerSkipped = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue; // boş satır

    const fields = parseCsvLine(line);

    // İlk geçerli satır header ise atla
    if (!headerSkipped && isHeaderRow(fields)) {
      headerSkipped = true;
      continue;
    }

    const barcode = fields[0];
    const url = fields[1];

    // Geçersiz satırları atla
    if (!barcode || !url) {
      skipped++;
      continue;
    }

    map[barcode] = url;
    processed++;
  }

  log.info(`İşlenen satır: ${processed}, atlanan satır: ${skipped}.`);
  writeMap(map);
}

try {
  main();
} catch (error) {
  log.error(`İçe aktarma başarısız oldu: ${error.message}`);
  process.exit(1);
}
