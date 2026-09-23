#!/usr/bin/env node
/**
 * FAZ 4 — Build sonrası kırık iç link kontrolü.
 *
 * `dist/` altındaki tüm HTML dosyalarını tarar; her `href="/..."` iç
 * bağlantısının karşılık gelen bir statik dosyaya (`.html`, `index.html`
 * veya dizin) çözümlenip çözümlenmediğini doğrular.
 *
 * Kullanım: node scripts/check-broken-links.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

/** @type {string[]} */
const htmlFiles = []

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (entry.name.endsWith('.html')) {
      htmlFiles.push(full)
    }
  }
}

if (!existsSync(DIST)) {
  console.error('❌ dist/ bulunamadı. Önce `npm run build` çalıştırın.')
  process.exit(1)
}

walk(DIST)

const checked = new Set()
let broken = 0

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  for (const match of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = match[1]
    if (href.startsWith('/uploads/') || href.startsWith('/_astro/')) continue
    if (checked.has(href)) continue
    checked.add(href)

    const clean = href.replace(/\/$/, '')
    const candidates = [
      join(DIST, `${clean}.html`),
      join(DIST, clean, 'index.html'),
      join(DIST, clean),
    ]

    const ok = candidates.some((candidate) => {
      if (!existsSync(candidate)) return false
      try {
        return statSync(candidate).isFile() || statSync(candidate).isDirectory()
      } catch {
        return false
      }
    })

    if (!ok) {
      broken += 1
      if (broken <= 30) {
        console.log(`❌ ${href}  ← ${file.replace(DIST, '')}`)
      }
    }
  }
}

console.log('-'.repeat(78))
console.log(
  `HTML dosyası: ${htmlFiles.length}  |  Benzersiz iç link: ${checked.size}  |  Kırık: ${broken}`
)
process.exit(broken > 0 ? 1 : 0)
