import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import sitemap from '@astrojs/sitemap'
import { siteConfig } from './src/config/site.js'

// Sitemap'ten hariç tutulacak yollar: kişiye özel / dinamik sayfalar
// (`noindex, follow` ile işaretli) arama motorlarına sunulmamalıdır.
const SITEMAP_EXCLUDED_PATHS = ['/sepet', '/siparis-basarili', '/siparis-basarisiz']

export default defineConfig({
  site: siteConfig.domain,
  output: 'static',
  // SEO: Cloudflare statik sunucu, uzantisiz URL'leri sonuna `/` ekleyerek
  // 308 ile yonlendirir. Astro'nun urettigi ic linkler ve `Astro.url`
  // davranisi bu yonlendirmeyle uyusmuyordu (canonical `/urun/x` iken
  // gercek URL `/urun/x/`). `trailingSlash: 'always'` ile Astro tum ic
  // linkleri ve canonical'lari slash'li uretir; boylece 298 URL'yi
  // etkileyen "Redirected" (162) + "Canonicalised" (136) sorunu cozulur.
  trailingSlash: 'always',
  integrations: [
    react(),
    tailwind(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/+$/, '') || '/'
        return !SITEMAP_EXCLUDED_PATHS.some(
          (excluded) => pathname === excluded || pathname.startsWith(`${excluded}/`)
        )
      },
    }),
  ],
  image: {
    domains: ['cdn.dsmcdn.com'],
    remotePatterns: [{ protocol: 'https', hostname: '**.dsmcdn.com' }],
  },
})
