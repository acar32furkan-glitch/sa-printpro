/**
 * dist/ içindeki TÜM HTML dosyalarını tarar ve sondaki slash'i EKSİK olan
 * site-içi (internal) linkleri raporlar.
 *
 * Amaç: Cloudflare statik sunucunun 308 yönlendirmesiyle sonuçlanan
 * slash'siz iç linklerin build çıktısında kalmadığını doğrulamak.
 *
 * Kurallar:
 * - Yalnızca `href="/..."` biçimindeki site-içi linkler taranır.
 * - Dış linkler (http://, https://, //, mailto:, tel:, wa.me) atlanır.
 * - Dosya uzantılı yollar (.html, .xml, .txt, .png, .webp, .json, ...) atlanır.
 * - Hash (`#...`) ve query (`?...`) kısımları ayrıştırılır; yalnızca yol
 *   kısmı değerlendirilir.
 * - Kök yol (`/`) geçerlidir.
 *
 * Kullanım: node scripts/verify-trailing-slash.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST_DIR = 'dist'

/** Dosya uzantısı olan yollar slash almaz. */
const FILE_EXTENSION_RE = /\.[a-z0-9]+$/i

/**
 * Bir dizini özyinelemeli olarak gezer ve eşleşen dosyaları döndürür.
 * @param {string} dir
 * @param {(name: string) => boolean} predicate
 * @returns {string[]}
 */
function walk(dir, predicate) {
  const results = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      results.push(...walk(full, predicate))
    } else if (predicate(entry)) {
      results.push(full)
    }
  }

  return results
}

/**
 * Bir href değerinin sondaki slash'i eksik bir site-içi link olup olmadığını
 * belirler.
 * @param {string} href
 * @returns {boolean} true → slash'siz iç link (sorunlu)
 */
function isMissingTrailingSlash(href) {
  if (typeof href !== 'string' || href.length === 0) {
    return false
  }

  // Dış linkler, protokol-relative, mailto/tel ve hash-only linkler atlanır.
  if (
    /^(https?:)?\/\//i.test(href) ||
    /^(mailto|tel|sms|whatsapp|trendyol):/i.test(href) ||
    href.startsWith('#')
  ) {
    return false
  }

  // Yalnızca site-içi (kök ile başlayan) yollar değerlendirilir.
  if (!href.startsWith('/')) {
    return false
  }

  // Hash ve query kısımlarını ayır.
  const match = href.match(/^([^?#]*)([?#].*)?$/)
  const pathname = match && match[1] ? match[1] : href

  // Kök yol geçerlidir.
  if (pathname === '/' || pathname === '') {
    return false
  }

  // Dosya uzantılı yollar slash almaz.
  if (FILE_EXTENSION_RE.test(pathname)) {
    return false
  }

  // Sondaki slash yoksa sorunludur.
  return !pathname.endsWith('/')
}

const htmlFiles = walk(DIST_DIR, (name) => name.endsWith('.html'))

/** @type {Map<string, {count: number, files: Set<string>}>} */
const offenders = new Map()
let totalLinks = 0
let totalOffenders = 0

const HREF_RE = /href\s*=\s*"([^"]*)"/gi

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  let match
  while ((match = HREF_RE.exec(html)) !== null) {
    const href = match[1]
    totalLinks += 1
    if (isMissingTrailingSlash(href)) {
      totalOffenders += 1
      const entry = offenders.get(href) || { count: 0, files: new Set() }
      entry.count += 1
      entry.files.add(relative(DIST_DIR, file))
      offenders.set(href, entry)
    }
  }
}

console.log('=== Trailing Slash Doğrulaması (dist/**/*.html) ===')
console.log(`Taranan HTML dosyası : ${htmlFiles.length}`)
console.log(`Taranan href toplamı : ${totalLinks}`)
console.log(`Slash'siz iç link    : ${totalOffenders}`)
console.log(`Benzersiz kalıp      : ${offenders.size}`)

if (offenders.size > 0) {
  console.log('\n--- Slash\'siz iç linkler (ilk 50) ---')
  const sorted = [...offenders.entries()].sort((a, b) => b[1].count - a[1].count)
  for (const [href, info] of sorted.slice(0, 50)) {
    const sample = [...info.files][0]
    console.log(`  ${href}  (${info.count}x, ör. ${sample})`)
  }
  process.exitCode = 1
} else {
  console.log('\n✅ Hedef karşılandı: 0 slash\'siz iç link.')
}
