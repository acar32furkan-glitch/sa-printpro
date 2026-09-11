import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import sitemap from '@astrojs/sitemap'
import { siteConfig } from './src/config/site.js'

export default defineConfig({
  site: siteConfig.domain,
  output: 'static',
  integrations: [react(), tailwind(), sitemap()],
  image: {
    domains: ['cdn.dsmcdn.com'],
    remotePatterns: [{ protocol: 'https', hostname: '**.dsmcdn.com' }],
  },
})
