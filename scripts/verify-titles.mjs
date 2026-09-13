#!/usr/bin/env node
/**
 * dist/ içindeki tüm HTML sayfalarının <title> uzunluklarını denetler.
 *
 * Amaç: Google SERP'te ~60 karakterde kesilen başlıkların build çıktısında
 * kalmadığını doğrulamak.
 *
 * Kullanım: node scripts/verify-titles.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = 'dist'
const MAX = 60

// Google Search Console doğrulama dosyası gerçek bir sayfa değildir; başlık
// denetiminden hariç tutulur (qa-audit.mjs ile aynı kural).
const NON_PAGE_HTML = /google[0-9a-f]+\.html$/i

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.html') && !NON_PAGE_HTML.test(entry)) out.push(full)
  }
  return out
}

const files = walk(DIST)
const rows = []

for (const file of files) {
  const html = readFileSync(file, 'utf8')
  const m = html.match(/<title>([\s\S]*?)<\/title>/i)
  if (!m) {
    rows.push({ page: '/' + relative(DIST, file).replace(/\\/g, '/'), len: 0, title: '(YOK)' })
    continue
  }
  const title = m[1].trim()
  rows.push({
    page: '/' + relative(DIST, file).replace(/\\/g, '/'),
    len: title.length,
    title,
  })
}

const over = rows.filter((r) => r.len > MAX).sort((a, b) => b.len - a.len)
const missing = rows.filter((r) => r.len === 0)
const short = rows.filter((r) => r.len > 0 && r.len < 30).sort((a, b) => a.len - b.len)

console.log('='.repeat(78))
console.log('TITLE DENETİMİ (dist/)')
console.log('='.repeat(78))
console.log(`  Toplam HTML sayfa : ${rows.length}`)
console.log(`  > ${MAX} karakter    : ${over.length}`)
console.log(`  < 30 karakter     : ${short.length}`)
console.log(`  Eksik             : ${missing.length}`)

if (over.length) {
  console.log(`\n🔴 ${MAX} KARAKTERİ AŞAN BAŞLIKLAR (${over.length})`)
  for (const r of over.slice(0, 40)) {
    console.log(`  ${String(r.len).padStart(4)}ch  ${r.page}`)
    console.log(`         "${r.title}"`)
  }
}

if (short.length) {
  console.log(`\n🟡 KISA BAŞLIKLAR (<30) (${short.length})`)
  for (const r of short) {
    console.log(`  ${String(r.len).padStart(4)}ch  ${r.page}  "${r.title}"`)
  }
}

if (missing.length) {
  console.log(`\n🔴 TITLE EKSİK (${missing.length})`)
  for (const r of missing) console.log(`  ${r.page}`)
}

// Uzunluk dağılımı
const buckets = { '0': 0, '1-29': 0, '30-60': 0, '61-70': 0, '71+': 0 }
for (const r of rows) {
  if (r.len === 0) buckets['0']++
  else if (r.len < 30) buckets['1-29']++
  else if (r.len <= 60) buckets['30-60']++
  else if (r.len <= 70) buckets['61-70']++
  else buckets['71+']++
}
console.log('\nUzunluk dağılımı:')
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(8)} ${v}`)

process.exit(over.length + missing.length > 0 ? 1 : 0)
