/**
 * FAZ 11 — DeepSeek Otonom İçerik Fabrikası.
 *
 * `src/data/products.json` içindeki ürünler için DeepSeek Chat API'sini
 * kullanarak zenginleştirilmiş içerik üretir:
 *   - cleanTitle        : SEO uyumlu, sadeleştirilmiş başlık
 *   - hook              : Açıklama üstünde dikkat çeken kısa giriş cümlesi
 *   - detailedSpecs     : material, durability, nightVisibility, removal
 *   - applicationGuide  : Adım adım uygulama rehberi
 *   - compatibleModels  : Uyumlu motosiklet modelleri listesi
 *   - faqs              : question/answer çiftleri
 *
 * Sonuçlar `src/data/ai-enriched.json` içine önbelleklenir; daha önce üretilen
 * id'ler atlanır. Böylece script tekrar çalıştırıldığında yalnızca eksik
 * ürünler için API çağrısı yapılır (maliyet ve süre tasarrufu).
 *
 * Dayanıklılık: her istek arasında 300ms gecikme, hatalarda 3 kez exponential
 * backoff ile yeniden deneme.
 *
 * Kullanım:
 *   node scripts/enrich-catalog-ai.mjs            # tüm eksik ürünler
 *   node scripts/enrich-catalog-ai.mjs --limit=3  # ilk 3 ürün
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const SOURCE_FILE = resolve(rootDir, 'src/data/products.json')
const CACHE_FILE = resolve(rootDir, 'src/data/ai-enriched.json')

const API_URL = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'

const REQUEST_DELAY_MS = 300
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

/**
 * `--limit=N` CLI parametresini ayrıştırır. Geçersiz/eksik değerde `null`
 * döner; bu da "tüm ürünler" anlamına gelir.
 * @returns {number|null}
 */
function parseLimit() {
  const arg = process.argv.find((value) => value.startsWith('--limit='))
  if (!arg) {
    return null
  }
  const parsed = Number.parseInt(arg.split('=')[1], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * `.env` / `.env.local` dosyalarını (varsa) basitçe ayrıştırıp ortam
 * değişkenlerine yükler. Harici bir bağımlılık gerektirmez.
 * @returns {Promise<void>}
 */
async function loadEnvFiles() {
  for (const name of ['.env', '.env.local']) {
    const filePath = resolve(rootDir, name)
    try {
      const content = await readFile(filePath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
          continue
        }
        const eqIndex = trimmed.indexOf('=')
        if (eqIndex === -1) {
          continue
        }
        const key = trimmed.slice(0, eqIndex).trim()
        let value = trimmed.slice(eqIndex + 1).trim()
        // Çevreleyen tırnakları temizle.
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (key && process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    } catch {
      // Dosya yoksa sorun değil; ortam değişkeni başka yoldan gelebilir.
    }
  }
}

/**
 * Bekleme yardımcısı.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

/**
 * Ürün için DeepSeek'e gönderilecek prompt'u üretir.
 * @param {object} product
 * @returns {string}
 */
function buildPrompt(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const attributes = variants[0]?.attributes || {}
  const attributeText = Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')

  return [
    'Sen SA Printpro için çalışan kıdemli bir e-ticaret SEO metin yazarısın.',
    'Aşağıdaki motosiklet reflektif sticker ürünü için Türkçe, doğal ve satış odaklı içerik üret.',
    '',
    `Ürün adı: ${product.name}`,
    `Kategori: ${product?.category?.name || 'Genel'}`,
    attributeText ? `Öznitelikler: ${attributeText}` : '',
    '',
    'Yanıtı SADECE aşağıdaki JSON şemasına uygun, geçerli bir JSON nesnesi olarak ver.',
    'Markdown kod bloğu, açıklama veya ek metin EKLEME.',
    '',
    'JSON şeması:',
    '{',
    '  "cleanTitle": "string (en fazla 70 karakter, sade ve SEO uyumlu başlık)",',
    '  "hook": "string (1-2 cümlelik dikkat çekici giriş)",',
    '  "detailedSpecs": {',
    '    "material": "string",',
    '    "durability": "string",',
    '    "nightVisibility": "string",',
    '    "removal": "string"',
    '  },',
    '  "applicationGuide": "string (adım adım uygulama rehberi)",',
    '  "compatibleModels": ["string", "string"],',
    '  "faqs": [{ "question": "string", "answer": "string" }]',
    '}',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Model yanıtından JSON nesnesini güvenli biçimde çıkarır. Model bazen
 * ```json ... ``` bloğu döndürebilir; bunu temizler.
 * @param {string} content
 * @returns {object}
 */
function parseJsonResponse(content) {
  let text = String(content || '').trim()

  // Markdown kod bloğu sarmalayıcısını kaldır.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }

  // İlk `{` ile son `}` arasını al (olası ek metni at).
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1)
  }

  return JSON.parse(text)
}

/**
 * Tek bir ürün için DeepSeek API çağrısı yapar; hatalarda exponential backoff
 * ile en fazla `MAX_RETRIES` kez yeniden dener.
 *
 * @param {object} product
 * @param {string} apiKey
 * @returns {Promise<object>}
 */
async function enrichProduct(product, apiKey) {
  const prompt = buildPrompt(product)

  let lastError = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content:
                'Sen yalnızca geçerli JSON döndüren bir içerik üretim asistanısın.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`HTTP ${response.status} ${response.statusText} ${body}`)
      }

      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('API yanıtında içerik bulunamadı.')
      }

      return parseJsonResponse(content)
    } catch (error) {
      lastError = error
      const isLastAttempt = attempt === MAX_RETRIES - 1
      if (isLastAttempt) {
        break
      }
      const backoff = BASE_BACKOFF_MS * 2 ** attempt
      console.warn(
        `  ↻ ${product.id} deneme ${attempt + 1} başarısız (${error.message}). ${backoff}ms sonra tekrar denenecek...`
      )
      await sleep(backoff)
    }
  }

  throw lastError || new Error('Bilinmeyen hata')
}

/**
 * Önbellek dosyasını okur; yoksa boş bir nesne döner.
 * @returns {Promise<object>}
 */
async function readCache() {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function main() {
  await loadEnvFiles()

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn(
      '[enrich-catalog-ai] UYARI: DEEPSEEK_API_KEY tanımlı değil.\n' +
        '  .env veya .env.local dosyasına DEEPSEEK_API_KEY=... ekleyin.\n' +
        '  Örnek: DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx\n' +
        '  Script API anahtarı olmadan çalışamaz; işlem atlanıyor.'
    )
    return
  }

  const limit = parseLimit()

  const raw = await readFile(SOURCE_FILE, 'utf8')
  const data = JSON.parse(raw)
  const allProducts = Array.isArray(data?.products) ? data.products : []

  const cache = await readCache()

  // Önbellekte olmayan ürünleri seç, sonra limit uygula.
  const pending = allProducts.filter((product) => !cache[product.id])
  const targets = limit ? pending.slice(0, limit) : pending

  console.log(
    `[enrich-catalog-ai] Toplam ${allProducts.length} ürün, önbellekte ${Object.keys(cache).length}, işlenecek ${targets.length}.`
  )

  if (targets.length === 0) {
    console.log('[enrich-catalog-ai] İşlenecek yeni ürün yok. Önbellek güncel.')
    return
  }

  let success = 0
  let failed = 0

  for (let index = 0; index < targets.length; index += 1) {
    const product = targets[index]
    try {
      const enriched = await enrichProduct(product, apiKey)
      cache[product.id] = {
        ...enriched,
        _meta: {
          model: MODEL,
          enrichedAt: new Date().toISOString(),
        },
      }
      success += 1
      console.log(`  ✓ ${product.id} zenginleştirildi (${product.slug})`)

      // Her başarılı istekten sonra önbelleği diske yaz (kesintiye dayanıklı).
      await mkdir(dirname(CACHE_FILE), { recursive: true })
      await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
    } catch (error) {
      failed += 1
      console.error(`  ✗ ${product.id} zenginleştirilemedi: ${error.message}`)
    }

    // Rate limit'e saygı: son eleman hariç her istekten sonra bekle.
    if (index < targets.length - 1) {
      await sleep(REQUEST_DELAY_MS)
    }
  }

  console.log(
    `[enrich-catalog-ai] Tamamlandı → başarılı: ${success}, hata: ${failed}, önbellek toplam: ${Object.keys(cache).length}`
  )
}

main().catch((error) => {
  console.error('[enrich-catalog-ai] Hata:', error)
  process.exitCode = 1
})
