#!/usr/bin/env node
/** Yeni taramadaki kalan sorunların detayı */
import { readFileSync } from 'node:fs';

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') {}
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync('sa_printpro-internal_all.csv', 'utf8'));
const H = rows[0];
const data = rows.slice(1).filter((r) => r.length > 1 && r[0]);
const c = (n) => H.indexOf(n);

const iAddr = c('Address'), iType = c('Content Type'), iCode = c('Status Code');
const iIdx = c('Indexability'), iIdxS = c('Indexability Status');
const iTitle = c('Title 1'), iTLen = c('Title 1 Length'), iTPix = c('Title 1 Pixel Width');
const iMeta = c('Meta Description 1'), iMLen = c('Meta Description 1 Length');
const iH1 = c('H1-1'), iCanon = c('Canonical Link Element 1');
const iRobots = c('Meta Robots 1'), iXRobots = c('X-Robots-Tag 1');
const iSize = c('Size (Bytes)'), iResp = c('Response Time');
const iInlinks = c('Inlinks'), iDepth = c('Crawl Depth');
const iOutlinks = c('Outlinks'), iExtOut = c('External Outlinks');
const iWords = c('Word Count'), iTextRatio = c('Text Ratio');
const iRedirUrl = c('Redirect URL'), iRedirType = c('Redirect Type');
const iNearDup = c('No. Near Duplicates'), iSemSim = c('No. Semantically Similar');
const iSemScore = c('Semantic Similarity Score'), iSemRel = c('Semantic Relevance Score');
const iSpell = c('Spelling Errors'), iGram = c('Grammar Errors');
const iFolderDepth = c('Folder Depth'), iLinkScore = c('Link Score');

const html = data.filter((r) => (r[iType] || '').includes('html'));
const nonHtml = data.filter((r) => !(r[iType] || '').includes('html'));

console.log('=== GENEL ===');
console.log('Toplam:', data.length, '| HTML:', html.length, '| Non-HTML:', nonHtml.length);
const types = new Map();
for (const r of data) types.set(r[iType], (types.get(r[iType]) || 0) + 1);
console.log('İçerik tipleri:', [...types.entries()].sort((a, b) => b[1] - a[1]));

console.log('\n=== NOINDEX / ROBOTS ===');
for (const r of data) {
  const mr = (r[iRobots] || '').trim(), xr = (r[iXRobots] || '').trim();
  if (mr || xr || (r[iIdxS] || '').trim()) {
    console.log(`  ${r[iAddr]}`);
    console.log(`     Indexability=${r[iIdx]} | Status=${r[iIdxS]} | MetaRobots="${mr}" | XRobots="${xr}"`);
  }
}

console.log('\n=== TITLE UZUNLUK DAĞILIMI (HTML) ===');
const buckets = { '0 (yok)': 0, '1-29': 0, '30-60': 0, '61-70': 0, '71-100': 0, '101+': 0 };
for (const r of html) {
  const l = Number(r[iTLen] || 0);
  if (l === 0) buckets['0 (yok)']++;
  else if (l < 30) buckets['1-29']++;
  else if (l <= 60) buckets['30-60']++;
  else if (l <= 70) buckets['61-70']++;
  else if (l <= 100) buckets['71-100']++;
  else buckets['101+']++;
}
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(10)} ${v}`);

console.log('\n=== EN UZUN TITLE (ilk 25) ===');
const longT = html.map((r) => ({ u: r[iAddr], l: Number(r[iTLen] || 0), p: Number(r[iTPix] || 0), t: r[iTitle] }))
  .sort((a, b) => b.l - a.l).slice(0, 25);
for (const x of longT) console.log(`  ${String(x.l).padStart(4)}ch ${String(x.p).padStart(5)}px  ${x.u}\n        "${x.t}"`);

console.log('\n=== KISA TITLE (<30) ===');
for (const r of html) {
  const l = Number(r[iTLen] || 0);
  if (l > 0 && l < 30) console.log(`  ${String(l).padStart(3)}ch  ${r[iAddr]}  "${r[iTitle]}"`);
}

console.log('\n=== META DESC UZUNLUK DAĞILIMI (HTML) ===');
const mb = { '0 (yok)': 0, '1-69': 0, '70-160': 0, '161-200': 0, '201+': 0 };
for (const r of html) {
  const l = Number(r[iMLen] || 0);
  if (l === 0) mb['0 (yok)']++;
  else if (l < 70) mb['1-69']++;
  else if (l <= 160) mb['70-160']++;
  else if (l <= 200) mb['161-200']++;
  else mb['201+']++;
}
for (const [k, v] of Object.entries(mb)) console.log(`  ${k.padEnd(10)} ${v}`);

console.log('\n=== EN UZUN META DESC (ilk 15) ===');
const longM = html.map((r) => ({ u: r[iAddr], l: Number(r[iMLen] || 0), m: r[iMeta] }))
  .sort((a, b) => b.l - a.l).slice(0, 15);
for (const x of longM) console.log(`  ${String(x.l).padStart(4)}ch  ${x.u}\n        "${x.m}"`);

console.log('\n=== YAVAŞ SAYFALAR (tümü, >0.5s) ===');
const slow = html.map((r) => ({ u: r[iAddr], t: parseFloat((r[iResp] || '0').replace(',', '.')), s: Number(r[iSize] || 0) }))
  .filter((x) => x.t > 0.5).sort((a, b) => b.t - a.t);
for (const x of slow) console.log(`  ${x.t.toFixed(3)}s  ${(x.s / 1024).toFixed(1)}KB  ${x.u}`);

console.log('\n=== EN BÜYÜK SAYFALAR (ilk 20) ===');
const big = html.map((r) => ({ u: r[iAddr], s: Number(r[iSize] || 0), w: Number(r[iWords] || 0), tr: r[iTextRatio] }))
  .sort((a, b) => b.s - a.s).slice(0, 20);
for (const x of big) console.log(`  ${(x.s / 1024).toFixed(1).padStart(7)}KB  words=${String(x.w).padStart(5)}  textRatio=${x.tr}  ${x.u}`);

console.log('\n=== DÜŞÜK TEXT RATIO (<5%) ===');
const lowTR = html.map((r) => ({ u: r[iAddr], tr: parseFloat((r[iTextRatio] || '0').replace(',', '.')), w: Number(r[iWords] || 0) }))
  .filter((x) => x.tr < 5).sort((a, b) => a.tr - b.tr);
for (const x of lowTR.slice(0, 30)) console.log(`  ${x.tr.toFixed(3)}%  words=${x.w}  ${x.u}`);

console.log('\n=== DÜŞÜK WORD COUNT (<100) ===');
const lowW = html.map((r) => ({ u: r[iAddr], w: Number(r[iWords] || 0) })).filter((x) => x.w < 100).sort((a, b) => a.w - b.w);
for (const x of lowW.slice(0, 30)) console.log(`  ${String(x.w).padStart(4)}  ${x.u}`);

console.log('\n=== ORPHAN / DÜŞÜK INLINK (HTML, inlinks=0) ===');
const orphan = html.filter((r) => Number(r[iInlinks] || 0) === 0);
console.log('  Adet:', orphan.length);
for (const r of orphan.slice(0, 40)) console.log(`  ${r[iAddr]}  depth=${r[iDepth]}`);

console.log('\n=== DERİN SAYFALAR (Crawl Depth >= 4) ===');
const deep = html.filter((r) => Number(r[iDepth] || 0) >= 4);
console.log('  Adet:', deep.length);
for (const r of deep.slice(0, 30)) console.log(`  depth=${r[iDepth]}  ${r[iAddr]}`);

console.log('\n=== CANONICAL ANALİZİ ===');
const noCanon = html.filter((r) => !(r[iCanon] || '').trim());
const selfCanon = html.filter((r) => (r[iCanon] || '').trim() === (r[iAddr] || '').trim());
const otherCanon = html.filter((r) => {
  const cc = (r[iCanon] || '').trim();
  return cc && cc !== (r[iAddr] || '').trim();
});
console.log('  Canonical yok:', noCanon.length);
console.log('  Self-referencing:', selfCanon.length);
console.log('  Farklı canonical:', otherCanon.length);
for (const r of otherCanon) console.log(`    ${r[iAddr]} → ${r[iCanon]}`);

console.log('\n=== TRAILING SLASH KONTROLÜ (HTML URL) ===');
const noSlash = html.filter((r) => {
  const a = (r[iAddr] || '').trim();
  const path = a.replace(/^https?:\/\/[^/]+/, '');
  if (path === '' || path === '/') return false;
  return !path.endsWith('/');
});
console.log('  Slash\'siz HTML URL:', noSlash.length);
for (const r of noSlash) console.log(`    ${r[iAddr]}`);

console.log('\n=== NON-HTML DOSYALAR (ilk 30) ===');
for (const r of nonHtml.slice(0, 30)) console.log(`  ${r[iType].padEnd(16)} ${r[iAddr]}`);

console.log('\n=== SPELLING / GRAMMAR ===');
const sp = html.filter((r) => Number(r[iSpell] || 0) > 0);
const gr = html.filter((r) => Number(r[iGram] || 0) > 0);
console.log('  Spelling:', sp.length, '| Grammar:', gr.length);
for (const r of sp) console.log(`    spell=${r[iSpell]}  ${r[iAddr]}`);
for (const r of gr) console.log(`    gram=${r[iGram]}  ${r[iAddr]}`);

console.log('\n=== NEAR DUP / SEMANTIC ===');
const nd = html.filter((r) => Number(r[iNearDup] || 0) > 0);
const ss = html.filter((r) => Number(r[iSemSim] || 0) > 0);
console.log('  Near dup:', nd.length, '| Semantically similar:', ss.length);
for (const r of nd.slice(0, 20)) console.log(`    nd=${r[iNearDup]}  ${r[iAddr]}`);
for (const r of ss.slice(0, 20)) console.log(`    ss=${r[iSemSim]} score=${r[iSemScore]}  ${r[iAddr]}`);

console.log('\n=== REDIRECT KONTROLÜ ===');
const redir = data.filter((r) => (r[iRedirUrl] || '').trim() || (r[iRedirType] || '').trim());
console.log('  Redirect kaydı olan:', redir.length);
for (const r of redir) console.log(`    ${r[iAddr]} → ${r[iRedirUrl]} [${r[iRedirType]}]`);

console.log('\n=== SAYFA TİPİ DAĞILIMI ===');
const pageTypes = new Map();
for (const r of html) {
  const a = r[iAddr];
  let t = 'diğer';
  if (/^https?:\/\/[^/]+\/$/.test(a)) t = 'anasayfa';
  else if (a.includes('/urun/')) t = 'ürün';
  else if (a.includes('/kategori/')) t = 'kategori';
  else if (a.includes('/marka/')) t = 'marka';
  else if (a.includes('/urunler')) t = 'ürün listeleme';
  else if (a.includes('/blog/')) t = 'blog';
  else if (a.includes('/arama')) t = 'arama';
  else t = 'statik sayfa';
  pageTypes.set(t, (pageTypes.get(t) || 0) + 1);
}
for (const [k, v] of [...pageTypes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${v}`);

console.log('\n=== PAGINATION SAYFALARI ===');
const pag = html.filter((r) => /\/\d+\/?$/.test(r[iAddr]));
console.log('  Adet:', pag.length);
for (const r of pag.slice(0, 40)) console.log(`    ${r[iAddr]}  canon=${r[iCanon]}`);
