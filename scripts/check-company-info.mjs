#!/usr/bin/env node
/**
 * Merkezi kurumsal config (`src/config/site.js` → `company`) içindeki
 * zorunlu alanları denetler.
 *
 * Amaç (Faz 4 / G1.3–G1.4): Boş veya placeholder kalan kurumsal bilgileri
 * build öncesi net bir UYARI olarak raporlamak. Bu script build'i KIRMAZ —
 * her durumda exit code 0 döner; yalnızca uyarır.
 *
 * Kullanım: node scripts/check-company-info.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_CONFIG_PATH = join(__dirname, '..', 'src', 'config', 'site.js')

// Denetlenecek zorunlu alanlar: [anahtar, insan-okur etiket]
const REQUIRED_FIELDS = [
  ['legalName', 'Ticari Unvan'],
  ['address', 'Açık Adres'],
  ['taxOffice', 'Vergi Dairesi'],
  ['taxNumber', 'VKN'],
  ['mersis', 'MERSİS No'],
  ['phone', 'Telefon'],
  ['email', 'E-posta'],
  ['returnAddress', 'İade Adresi'],
  ['returnRecipient', 'İade Alıcı'],
]

// Placeholder kalıpları: [[...]], [DOLDURULACAK: ...], TODO, XXX vb.
const PLACEHOLDER_PATTERNS = [
  /\[\[[^\]]*\]\]/,
  /\[DOLDURULACAK[^\]]*\]/i,
  /\bTODO\b/i,
  /\bXXX+\b/i,
  /^\s*$/,
]

/**
 * Bir değerin boş veya placeholder olup olmadığını döndürür.
 * @param {unknown} value
 * @returns {boolean}
 */
function isMissing(value) {
  if (value === null || value === undefined) return true
  const text = String(value).trim()
  if (!text) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * `site.js` dosyasından `company` bloğunu güvenli şekilde okur.
 * Astro/Vite olmadan çalıştığı için dosya metni ayrıştırılır.
 * @returns {Record<string, string>}
 */
function readCompanyBlock() {
  const source = readFileSync(SITE_CONFIG_PATH, 'utf8')
  const match = source.match(/company:\s*\{([\s\S]*?)\n\s*\},/)
  if (!match) {
    throw new Error('site.js içinde `company` bloğu bulunamadı.')
  }

  const body = match[1]
  const company = {}
  const entryPattern = /(\w+)\s*:\s*(['"`])((?:\\.|(?!\2)[\s\S])*)\2/g
  let entry
  while ((entry = entryPattern.exec(body)) !== null) {
    company[entry[1]] = entry[3]
  }
  return company
}

function main() {
  let company
  try {
    company = readCompanyBlock()
  } catch (error) {
    console.warn('⚠️  Kurumsal bilgi kontrolü atlandı:', error.message)
    process.exit(0)
  }

  const missing = REQUIRED_FIELDS.filter(([key]) => isMissing(company[key]))

  console.log('='.repeat(78))
  console.log('KURUMSAL BİLGİ KONTROLÜ (src/config/site.js → company)')
  console.log('='.repeat(78))
  console.log(`  Denetlenen alan : ${REQUIRED_FIELDS.length}`)
  console.log(`  Eksik/placeholder: ${missing.length}`)

  if (missing.length === 0) {
    console.log('\n✅ Tüm kurumsal bilgiler dolu görünüyor.')
    process.exit(0)
  }

  console.log('\n⚠️  UYARI: Aşağıdaki kurumsal alanlar boş veya placeholder:')
  for (const [key, label] of missing) {
    const current = company[key]
    const shown = current === undefined ? '(tanımsız)' : `"${current}"`
    console.log(`   • ${label} (${key}) → ${shown}`)
  }

  console.log(
    '\n⚠️  Bu bilgiler doldurulmadan fatura kesilemez. İlk gerçek satıştan önce\n' +
      '   `src/config/site.js` içindeki `company` bloğunu eksiksiz doldurun.\n' +
      '   (Bu kontrol build\'i durdurmaz; yalnızca uyarır.)',
  )

  // Build'i kırmamak için her durumda başarılı çık.
  process.exit(0)
}

main()
