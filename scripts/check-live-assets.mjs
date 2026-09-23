/**
 * Canlı sitedeki kritik asset'lerin boyut/cache durumunu kontrol eder.
 * Kullanım: node scripts/check-live-assets.mjs
 */
import https from 'node:https'

const BASE = 'https://saprintpro.com'
const PATHS = ['/logo.png', '/logo.webp', '/logo-dark.png', '/logo-dark.webp', '/favicon.png']

function head(url) {
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        let bytes = 0
        res.on('data', (chunk) => {
          bytes += chunk.length
        })
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            bytes,
            cacheControl: res.headers['cache-control'] || '-',
            contentType: res.headers['content-type'] || '-',
          }),
        )
      })
      .on('error', (error) => resolve({ error: error.message }))
  })
}

for (const path of PATHS) {
  const result = await head(BASE + path)
  if (result.error) {
    console.log(`${path.padEnd(18)} HATA: ${result.error}`)
    continue
  }
  console.log(
    `${path.padEnd(18)} HTTP:${result.status}  ${(result.bytes / 1024).toFixed(1).padStart(7)} KB  CC:${result.cacheControl}`,
  )
}
