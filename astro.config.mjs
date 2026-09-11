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
