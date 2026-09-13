#!/usr/bin/env node
/**
 * Canlı site doğrulaması — yayın sonrası kontrol.
 *
 * Kontroller:
 *  1. Kritik URL'ler 200 döner ve 308 yönlendirmesi YOKTUR.
 *  2. Slash'siz URL'ler 308 ile slash'li adrese yönlenir (beklenen davranış).
 *  3. <title> uzunlukları 60 karakteri aşmaz.
 *  4. Canonical, istenen URL ile birebir eşleşir (self-referencing).
 *
 * Kullanım: node scripts/verify-live.mjs
 */

const BASE = 'https://saprintpro.com'

/** Kritik sayfalar — 200 dönmeli ve yönlendirilmemeli. */
const PAGES = [
  '/',
  '/urunler/',
  '/urunler/2/',
  '/kategori/reflektor/',
  '/kategori/arma-sticker-fosfor-serit/',
  '/kategori/arma-sticker-fosfor-serit/2/',
  '/marka/universal/',
  '/marka/universal/2/',
  '/hakkimizda/',
  '/iletisim/',
  '/sepet/',
  '/urun/honda-cbf-jant-seridi-cbf150-cbf-150-serit-2-icin-sag-sol-cbf-seridi-240370640/',
  '/urun/mondial-drift-jant-seridi-etiket-sticker-758334452/',
]

/** Slash'siz URL'ler — 308 ile slash'li adrese yönlenmeli. */
const SLASHLESS = [
  '/urunler',
  '/kategori/reflektor',
  '/marka/universal',
  '/hakkimizda',
]

let failures = 0

async function fetchPage(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' })
  const body = res.status === 200 ? await res.text() : ''
  return { status: res.status, location: res.headers.get('location'), body }
}

function extract(html, re) {
  const m = html.match(re)
  return m ? m[1].trim() : null
}

console.log('='.repeat(78))
console.log('CANLI SİTE DOĞRULAMASI — ' + BASE)
console.log('='.repeat(78))

console.log('\n--- 1) KRİTİK SAYFALAR (200 beklenir, yönlendirme YOK) ---')
for (const path of PAGES) {
  try {
    const { status, location, body } = await fetchPage(path)
    const ok = status === 200
    if (!ok) failures++
    const title = body ? extract(body, /<title>([\s\S]*?)<\/title>/i) : null
    const canonical = body
      ? extract(body, /<link\s+rel="canonical"\s+href="([^"]+)"/i)
      : null
    const titleLen = title ? title.length : 0
    const titleOk = titleLen > 0 && titleLen <= 60
    const canonOk = canonical === `${BASE}${path}`
    if (!titleOk || !canonOk) failures++

    console.log(`  ${ok ? '✅' : '🔴'} ${status}  ${path}`)
    if (location) console.log(`        → ${location}`)
    if (title) {
      console.log(
        `        title(${titleLen}ch) ${titleOk ? '✅' : '🔴'} "${title}"`
      )
    }
    if (canonical) {
      console.log(`        canonical ${canonOk ? '✅' : '🔴'} ${canonical}`)
    }
  } catch (err) {
    failures++
    console.log(`  🔴 HATA  ${path}  ${err.message}`)
  }
}

console.log('\n--- 2) SLASH\'SİZ URL\'LER (308 beklenir) ---')
for (const path of SLASHLESS) {
  try {
    const { status, location } = await fetchPage(path)
    const ok = status === 308 || status === 301
    if (!ok) failures++
    console.log(`  ${ok ? '✅' : '🔴'} ${status}  ${path}  →  ${location || '(yok)'}`)
  } catch (err) {
    failures++
    console.log(`  🔴 HATA  ${path}  ${err.message}`)
  }
}

console.log('\n' + '='.repeat(78))
console.log(failures === 0 ? '✅ TÜM CANLI KONTROLLER GEÇTİ' : `🔴 ${failures} KONTROL BAŞARISIZ`)
console.log('='.repeat(78))

process.exit(failures === 0 ? 0 : 1)
