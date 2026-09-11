/**
 * Minimal IndexNow notifier.
 *
 * Pings the IndexNow JSON endpoint with the site's URL list so Bing/Yandex
 * (and other participating engines) re-crawl updated pages immediately.
 *
 * Usage:
 *   node scripts/notify-indexnow.mjs
 *   node scripts/notify-indexnow.mjs https://saprintpro.com/urun/foo
 *   node scripts/notify-indexnow.mjs --host=sa-printpro.pages.dev
 *   node scripts/notify-indexnow.mjs --host=sa-printpro.pages.dev https://sa-printpro.pages.dev/urun/foo
 *
 * The IndexNow key must be hosted at:
 *   https://<domain>/<key>.txt
 * and contain exactly the key string.
 *
 * `--host=<domain>` overrides the default host (saprintpro.com). This is
 * required while the custom domain is not yet live in DNS: IndexNow validates
 * the key file over HTTPS on the submitted host, so pinging the Cloudflare
 * Pages default domain (e.g. sa-printpro.pages.dev) is the only way to get a
 * successful (200/202) response before the apex domain resolves.
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const ENDPOINT = 'https://api.indexnow.org/indexnow'
const DEFAULT_HOST = 'saprintpro.com'

/**
 * `--host=<domain>` CLI parametresini ayrıştırır. Protokol, yol veya sonda
 * eğik çizgi içeren değerleri temizleyerek yalnızca hostname bırakır.
 * Geçersiz/eksik değerde `null` döner.
 * @returns {string|null}
 */
function parseHost() {
  const arg = process.argv.find((value) => value.startsWith('--host='))
  if (!arg) {
    return null
  }
  const raw = arg.slice('--host='.length).trim()
  if (!raw) {
    return null
  }
  // Protokolü ve olası yolu/trailing slash'i temizle.
  const withoutProtocol = raw.replace(/^https?:\/\//i, '')
  const hostname = withoutProtocol.split('/')[0].trim()
  return hostname || null
}

const HOST = parseHost() || process.env.INDEXNOW_HOST || DEFAULT_HOST
const KEY = process.env.INDEXNOW_KEY || 'saprintpro-indexnow-key'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`

/**
 * Collects the URLs to submit: explicit CLI args win, otherwise every product
 * URL is derived from the local catalog.
 * @returns {Promise<Array<string>>}
 */
async function resolveUrls() {
  const cliUrls = process.argv.slice(2).filter((arg) => arg.startsWith('http'))
  if (cliUrls.length > 0) {
    return cliUrls
  }

  const source = resolve(rootDir, 'src/data/products.json')
  const raw = await readFile(source, 'utf8')
  const data = JSON.parse(raw)
  const products = Array.isArray(data?.products) ? data.products : []

  return products
    .filter((product) => product?.slug)
    .map((product) => `https://${HOST}/urun/${product.slug}`)
}

async function main() {
  const urlList = await resolveUrls()

  if (urlList.length === 0) {
    console.log('[indexnow] Gönderilecek URL bulunamadı.')
    return
  }

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const hint =
      response.status === 403
        ? `\n  → 403 Forbidden: IndexNow, anahtar dosyasını canlı olarak doğrulayamadı.` +
          `\n    Beklenen adres: ${KEY_LOCATION}` +
          `\n    '${HOST}' DNS'te çözümlenmiyor veya anahtar dosyası yayında değilse bu hata alınır.` +
          `\n    Çözüm: --host=<canlı-domain> ile ping atın (örn. --host=sa-printpro.pages.dev).`
        : ''
    throw new Error(
      `IndexNow isteği başarısız: ${response.status} ${response.statusText}${hint}` +
        (body ? `\n  Yanıt: ${body}` : '')
    )
  }

  console.log(
    `[indexnow] ${urlList.length} URL gönderildi → ${ENDPOINT} (${response.status}) [host: ${HOST}]`
  )
}

main().catch((error) => {
  console.error('[indexnow] Hata:', error)
  process.exitCode = 1
})
