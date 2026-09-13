#!/usr/bin/env node
/**
 * Üç Screaming Frog taramasını karşılaştırır ve kalan sorunları raporlar.
 * Kullanım: node scripts/analyze-crawls.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const FILES = [
  { label: '13:56', file: 'ınternal_all-saprintpro.csv' },
  { label: '15:46', file: 'saprintpro.ınternal_all.csv' },
  { label: 'YENİ (16:17)', file: 'sa_printpro-internal_all.csv' },
];

/** RFC4180 uyumlu basit CSV parser */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function load(file) {
  const text = readFileSync(file, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0];
  const data = rows.slice(1).filter((r) => r.length > 1 && r[0]);
  return { header, data };
}

function col(header, name) {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`Sütun bulunamadı: ${name}`);
  return i;
}

function countBy(data, idx) {
  const m = new Map();
  for (const r of data) {
    const v = (r[idx] || '').trim() || '(boş)';
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const results = [];

for (const { label, file } of FILES) {
  if (!existsSync(file)) {
    console.log(`!! Dosya yok: ${file}`);
    continue;
  }
  const { header, data } = load(file);
  const iAddr = col(header, 'Address');
  const iCode = col(header, 'Status Code');
  const iStatus = col(header, 'Status');
  const iIdx = col(header, 'Indexability');
  const iIdxStatus = col(header, 'Indexability Status');
  const iTitle = col(header, 'Title 1');
  const iMeta = col(header, 'Meta Description 1');
  const iH1 = col(header, 'H1-1');
  const iCanon = col(header, 'Canonical Link Element 1');
  const iRobots = col(header, 'Meta Robots 1');
  const iXRobots = col(header, 'X-Robots-Tag 1');
  const iSize = col(header, 'Size (Bytes)');
  const iResp = col(header, 'Response Time');
  const iRedirUrl = col(header, 'Redirect URL');
  const iRedirType = col(header, 'Redirect Type');
  const iInlinks = col(header, 'Inlinks');
  const iSpell = col(header, 'Spelling Errors');
  const iGram = col(header, 'Grammar Errors');
  const iNearDup = col(header, 'No. Near Duplicates');
  const iSemSim = col(header, 'No. Semantically Similar');
  const iDepth = col(header, 'Crawl Depth');
  const iTimestamp = col(header, 'Crawl Timestamp');

  const html = data.filter((r) => (r[col(header, 'Content Type')] || '').includes('html'));
  const codes = countBy(data, iCode);
  const idx = countBy(data, iIdx);
  const idxStatus = countBy(data, iIdxStatus);

  const redirects = data.filter((r) => /^3\d\d$/.test((r[iCode] || '').trim()));
  const r308 = redirects.filter((r) => (r[iCode] || '').trim() === '308');
  const r301 = redirects.filter((r) => (r[iCode] || '').trim() === '301');
  const r302 = redirects.filter((r) => (r[iCode] || '').trim() === '302');
  const notFound = data.filter((r) => (r[iCode] || '').trim() === '404');
  const zero = data.filter((r) => (r[iCode] || '').trim() === '0');
  const serverErr = data.filter((r) => /^5\d\d$/.test((r[iCode] || '').trim()));

  const canonicalised = data.filter((r) => (r[iIdxStatus] || '').trim() === 'Canonicalised');
  const noindex = data.filter((r) => (r[iIdxStatus] || '').trim() === 'Noindex');
  const blocked = data.filter((r) => (r[iIdxStatus] || '').trim() === 'Blocked by robots.txt');
  const redirected = data.filter((r) => (r[iIdxStatus] || '').trim() === 'Redirected');

  const selfCanon = html.filter((r) => {
    const c = (r[iCanon] || '').trim();
    const a = (r[iAddr] || '').trim();
    return c && c === a;
  });
  const missingCanon = html.filter((r) => !(r[iCanon] || '').trim());
  const canonMismatch = html.filter((r) => {
    const c = (r[iCanon] || '').trim();
    const a = (r[iAddr] || '').trim();
    return c && c !== a;
  });

  const missingTitle = html.filter((r) => !(r[iTitle] || '').trim());
  const missingMeta = html.filter((r) => !(r[iMeta] || '').trim());
  const missingH1 = html.filter((r) => !(r[iH1] || '').trim());
  const longTitle = html.filter((r) => Number(r[col(header, 'Title 1 Length')] || 0) > 60);
  const shortTitle = html.filter((r) => {
    const l = Number(r[col(header, 'Title 1 Length')] || 0);
    return l > 0 && l < 30;
  });
  const longMeta = html.filter((r) => Number(r[col(header, 'Meta Description 1 Length')] || 0) > 160);
  const shortMeta = html.filter((r) => {
    const l = Number(r[col(header, 'Meta Description 1 Length')] || 0);
    return l > 0 && l < 70;
  });

  const slow = html
    .map((r) => ({ url: r[iAddr], t: parseFloat((r[iResp] || '0').replace(',', '.')) }))
    .filter((x) => x.t > 1)
    .sort((a, b) => b.t - a.t);

  const big = html
    .map((r) => ({ url: r[iAddr], s: Number(r[iSize] || 0) }))
    .filter((x) => x.s > 150000)
    .sort((a, b) => b.s - a.s);

  const spell = html.filter((r) => Number(r[iSpell] || 0) > 0);
  const gram = html.filter((r) => Number(r[iGram] || 0) > 0);
  const nearDup = html.filter((r) => Number(r[iNearDup] || 0) > 0);
  const semSim = html.filter((r) => Number(r[iSemSim] || 0) > 0);

  const timestamps = [...new Set(data.map((r) => (r[iTimestamp] || '').slice(0, 10)))].sort();

  results.push({
    label, file, header, data, html,
    total: data.length, htmlCount: html.length,
    codes, idx, idxStatus,
    redirects, r308, r301, r302, notFound, zero, serverErr,
    canonicalised, noindex, blocked, redirected,
    selfCanon, missingCanon, canonMismatch,
    missingTitle, missingMeta, missingH1, longTitle, shortTitle, longMeta, shortMeta,
    slow, big, spell, gram, nearDup, semSim, timestamps,
    iAddr, iCode, iIdxStatus, iInlinks, iRedirUrl, iRedirType, iResp, iSize,
  });
}

// ---------- RAPOR ----------
const line = '='.repeat(78);
console.log(line);
console.log('ÜÇ TARAMA KARŞILAŞTIRMASI');
console.log(line);

const metric = (fn) => results.map((r) => fn(r));

function table(name, values) {
  console.log(
    `${name.padEnd(34)} | ${String(values[0]).padStart(10)} | ${String(values[1]).padStart(10)} | ${String(values[2]).padStart(12)}`
  );
}

console.log(`${'METRİK'.padEnd(34)} | ${'13:56'.padStart(10)} | ${'15:46'.padStart(10)} | ${'YENİ'.padStart(12)}`);
console.log('-'.repeat(78));
table('Toplam URL', metric((r) => r.total));
table('HTML sayfa', metric((r) => r.htmlCount));
table('HTTP 200', metric((r) => (r.codes.find((c) => c[0] === '200') || [0, 0])[1]));
table('HTTP 308', metric((r) => r.r308.length));
table('HTTP 301', metric((r) => r.r301.length));
table('HTTP 302', metric((r) => r.r302.length));
table('HTTP 404', metric((r) => r.notFound.length));
table('HTTP 5xx', metric((r) => r.serverErr.length));
table('HTTP 0 (bağlantı hatası)', metric((r) => r.zero.length));
table('Indexable', metric((r) => (r.idx.find((c) => c[0] === 'Indexable') || [0, 0])[1]));
table('Non-Indexable', metric((r) => (r.idx.find((c) => c[0] === 'Non-Indexable') || [0, 0])[1]));
table('  → Redirected', metric((r) => r.redirected.length));
table('  → Canonicalised', metric((r) => r.canonicalised.length));
table('  → Noindex', metric((r) => r.noindex.length));
table('  → Blocked by robots.txt', metric((r) => r.blocked.length));
table('Self-referencing canonical', metric((r) => r.selfCanon.length));
table('Canonical eksik (HTML)', metric((r) => r.missingCanon.length));
table('Canonical mismatch (HTML)', metric((r) => r.canonMismatch.length));
table('Title eksik', metric((r) => r.missingTitle.length));
table('Meta Description eksik', metric((r) => r.missingMeta.length));
table('H1 eksik', metric((r) => r.missingH1.length));
table('Title > 60 karakter', metric((r) => r.longTitle.length));
table('Title < 30 karakter', metric((r) => r.shortTitle.length));
table('Meta Desc > 160 karakter', metric((r) => r.longMeta.length));
table('Meta Desc < 70 karakter', metric((r) => r.shortMeta.length));
table('Yavaş sayfa (>1s)', metric((r) => r.slow.length));
table('Büyük sayfa (>150KB)', metric((r) => r.big.length));
table('Spelling hatalı sayfa', metric((r) => r.spell.length));
table('Grammar hatalı sayfa', metric((r) => r.gram.length));
table('Near duplicate', metric((r) => r.nearDup.length));
table('Semantically similar', metric((r) => r.semSim.length));
console.log('-'.repeat(78));
console.log('Tarama tarihleri:', results.map((r) => `${r.label}=${r.timestamps.join(',')}`).join('  |  '));

// ---------- DETAY: YENİ TARAMA ----------
const latest = results[results.length - 1];
const prev = results[results.length - 2];

console.log('\n' + line);
console.log('YENİ TARAMA — HTTP KOD DAĞILIMI');
console.log(line);
for (const [k, v] of latest.codes) console.log(`  ${k.padEnd(8)} ${v}`);

console.log('\n' + line);
console.log('YENİ TARAMA — INDEXABILITY STATUS');
console.log(line);
for (const [k, v] of latest.idxStatus) console.log(`  ${k.padEnd(28)} ${v}`);

if (latest.r308.length) {
  console.log('\n' + line);
  console.log(`🔴 KALAN 308 REDIRECT (${latest.r308.length})`);
  console.log(line);
  for (const r of latest.r308) {
    console.log(`  ${r[latest.iAddr]}`);
    console.log(`     → ${r[latest.iRedirUrl]}  [${r[latest.iRedirType]}]  inlinks=${r[latest.iInlinks]}`);
  }
}

if (latest.notFound.length) {
  console.log('\n' + line);
  console.log(`🔴 404 SAYFALAR (${latest.notFound.length})`);
  console.log(line);
  for (const r of latest.notFound) {
    console.log(`  ${r[latest.iAddr]}  inlinks=${r[latest.iInlinks]}`);
  }
}

if (latest.zero.length) {
  console.log('\n' + line);
  console.log(`🔴 BAĞLANTI HATASI / HTTP 0 (${latest.zero.length})`);
  console.log(line);
  for (const r of latest.zero) console.log(`  ${r[latest.iAddr]}`);
}

if (latest.canonicalised.length) {
  console.log('\n' + line);
  console.log(`🔴 CANONICALISED (${latest.canonicalised.length})`);
  console.log(line);
  for (const r of latest.canonicalised) {
    console.log(`  ${r[latest.iAddr]}`);
  }
}

if (latest.noindex.length) {
  console.log('\n' + line);
  console.log(`🟡 NOINDEX (${latest.noindex.length})`);
  console.log(line);
  for (const r of latest.noindex) console.log(`  ${r[latest.iAddr]}`);
}

if (latest.missingTitle.length) {
  console.log('\n' + line);
  console.log(`🔴 TITLE EKSİK (${latest.missingTitle.length})`);
  console.log(line);
  for (const r of latest.missingTitle) console.log(`  ${r[latest.iAddr]}`);
}

if (latest.missingMeta.length) {
  console.log('\n' + line);
  console.log(`🔴 META DESCRIPTION EKSİK (${latest.missingMeta.length})`);
  console.log(line);
  for (const r of latest.missingMeta) console.log(`  ${r[latest.iAddr]}`);
}

if (latest.missingH1.length) {
  console.log('\n' + line);
  console.log(`🔴 H1 EKSİK (${latest.missingH1.length})`);
  console.log(line);
  for (const r of latest.missingH1) console.log(`  ${r[latest.iAddr]}`);
}

if (latest.slow.length) {
  console.log('\n' + line);
  console.log(`🟡 YAVAŞ SAYFALAR >1s (${latest.slow.length})`);
  console.log(line);
  for (const s of latest.slow.slice(0, 25)) console.log(`  ${s.t.toFixed(3)}s  ${s.url}`);
}

if (latest.big.length) {
  console.log('\n' + line);
  console.log(`🟡 BÜYÜK SAYFALAR >150KB (${latest.big.length})`);
  console.log(line);
  for (const s of latest.big.slice(0, 25)) console.log(`  ${(s.s / 1024).toFixed(1)}KB  ${s.url}`);
}

if (latest.spell.length) {
  console.log('\n' + line);
  console.log(`🟡 SPELLING HATALARI (${latest.spell.length} sayfa)`);
  console.log(line);
  for (const r of latest.spell.slice(0, 20)) console.log(`  ${r[latest.iAddr]}`);
}

if (latest.gram.length) {
  console.log('\n' + line);
  console.log(`🟡 GRAMMAR HATALARI (${latest.gram.length} sayfa)`);
  console.log(line);
  for (const r of latest.gram.slice(0, 20)) console.log(`  ${r[latest.iAddr]}`);
}

if (latest.nearDup.length) {
  console.log('\n' + line);
  console.log(`🟡 NEAR DUPLICATE (${latest.nearDup.length})`);
  console.log(line);
  for (const r of latest.nearDup.slice(0, 20)) console.log(`  ${r[latest.iAddr]}`);
}

// ---------- DEĞİŞİM ----------
console.log('\n' + line);
console.log('DEĞİŞİM (15:46 → YENİ)');
console.log(line);
const diffs = [
  ['Toplam URL', prev.total, latest.total],
  ['HTTP 308', prev.r308.length, latest.r308.length],
  ['HTTP 404', prev.notFound.length, latest.notFound.length],
  ['HTTP 0', prev.zero.length, latest.zero.length],
  ['Canonicalised', prev.canonicalised.length, latest.canonicalised.length],
  ['Noindex', prev.noindex.length, latest.noindex.length],
  ['Redirected', prev.redirected.length, latest.redirected.length],
  ['Title eksik', prev.missingTitle.length, latest.missingTitle.length],
  ['Meta eksik', prev.missingMeta.length, latest.missingMeta.length],
  ['H1 eksik', prev.missingH1.length, latest.missingH1.length],
  ['Yavaş (>1s)', prev.slow.length, latest.slow.length],
  ['Büyük (>150KB)', prev.big.length, latest.big.length],
];
for (const [n, a, b] of diffs) {
  const d = b - a;
  const arrow = d === 0 ? '=' : d > 0 ? `+${d} ⬆` : `${d} ⬇`;
  console.log(`  ${n.padEnd(20)} ${String(a).padStart(6)} → ${String(b).padStart(6)}   ${arrow}`);
}

// Yeni taramada olup öncekinde olmayan URL'ler
const prevSet = new Set(prev.data.map((r) => r[prev.iAddr]));
const latestSet = new Set(latest.data.map((r) => r[latest.iAddr]));
const added = [...latestSet].filter((u) => !prevSet.has(u));
const removed = [...prevSet].filter((u) => !latestSet.has(u));
console.log(`\n  Yeni eklenen URL: ${added.length}`);
console.log(`  Kaybolan URL: ${removed.length}`);
if (added.length && added.length <= 40) for (const u of added) console.log(`    + ${u}`);
if (removed.length && removed.length <= 40) for (const u of removed) console.log(`    - ${u}`);
