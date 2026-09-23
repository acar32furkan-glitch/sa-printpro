#!/usr/bin/env node
/**
 * FAZ 4 — Kategori 301 yönlendirme doğrulaması (G3.3).
 *
 * `worker/index.js` içindeki `CATEGORY_REDIRECTS` haritasını ve
 * `resolveCategoryRedirect` mantığını statik olarak doğrular:
 *   1. Eski kategori slug'ları haritada tanımlı mı?
 *   2. Hedef slug'lar gerçekten üretilen kategori sayfalarıyla eşleşiyor mu?
 *   3. Eski kategori sayfaları artık statik olarak ÜRETİLMİYOR mu?
 *
 * Kullanım: node scripts/verify-category-redirects.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const workerSource = readFileSync(join(ROOT, 'worker/index.js'), 'utf8')
const match = /const CATEGORY_REDIRECTS = \{([\s\S]*?)\};/.exec(workerSource)

if (!match) {
  console.error('❌ worker/index.js içinde CATEGORY_REDIRECTS bulunamadı.')
  process.exit(1)
}

/** @type {Record<string, string>} */
const redirects = {}
const entryPattern = /(?:'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*'([^']+)'/g
let entry
while ((entry = entryPattern.exec(match[1])) !== null) {
  redirects[entry[1] || entry[2]] = entry[3]
}

let failures = 0

console.log('Kategori 301 yönlendirmeleri:')
for (const [from, to] of Object.entries(redirects).sort()) {
  const targetExists = existsSync(join(ROOT, 'dist/kategori', to, 'index.html'))
  const sourceStillBuilt = existsSync(
    join(ROOT, 'dist/kategori', from, 'index.html')
  )

  // Kaynak sayfa hâlâ üretiliyorsa 301 anlamsız olur (çift içerik).
  const ok = targetExists && !sourceStillBuilt
  if (!ok) failures += 1

  console.log(
    `  ${ok ? '✅' : '❌'} /kategori/${from}  →  /kategori/${to}  ` +
      `(hedef=${targetExists ? 'var' : 'YOK'}, kaynak=${sourceStillBuilt ? 'hâlâ üretiliyor' : 'üretilmiyor'})`
  )
}

console.log('-'.repeat(78))
console.log(
  failures === 0
    ? `✅ ${Object.keys(redirects).length} kategori yönlendirmesi geçerli.`
    : `❌ ${failures} yönlendirme sorunlu.`
)
process.exit(failures > 0 ? 1 : 0)
