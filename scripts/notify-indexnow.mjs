/**
 * Minimal IndexNow notifier.
 *
 * Pings the IndexNow JSON endpoint with the site's URL list so Bing/Yandex
 * (and other participating engines) re-crawl updated pages immediately.
 *
 * Usage:
 *   node scripts/notify-indexnow.mjs
 *   node scripts/notify-indexnow.mjs https://saprintpro.com/urun/foo
 *
 * The IndexNow key must be hosted at:
 *   https://<domain>/<key>.txt
 * and contain exactly the key string.
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const ENDPOINT = 'https://api.indexnow.org/indexnow'
const HOST = 'saprintpro.com'
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
    throw new Error(`IndexNow isteği başarısız: ${response.status}`)
  }

  console.log(
    `[indexnow] ${urlList.length} URL gönderildi → ${ENDPOINT} (${response.status})`
  )
}

main().catch((error) => {
  console.error('[indexnow] Hata:', error)
  process.exitCode = 1
})
