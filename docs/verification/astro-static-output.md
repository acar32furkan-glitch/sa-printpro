# Verification: Astro version & static output

**Question (§0, item 2):** Confirm the current stable Astro version, whether the
default `output: 'static'` mode, `getStaticPaths()` requirements, or the
`@astrojs/react` and `@astrojs/sitemap` integrations have changed their config shape.

## Finding

| Item | Verified value |
|------|-----------------|
| Current stable Astro | **7.2** (blog 2026-08-06) → **7.2.4** (latest patch, 2026-08-19) → **7.3.2** installed 2026-09-11 |
| Static output | `output: 'static'` is the **default** and the only "static" mode. Astro 5 merged the old `output: 'hybrid'` into `'static'`; in Astro 7 a page opts out of prerendering with `export const prerender = false`. |
| Dynamic routes | A `src/pages/**/[slug].astro` **MUST** export `getStaticPaths()` returning one entry per built path (`{ params, props }`). |
| Integrations | `@astrojs/react`, `@astrojs/tailwind`, `@astrojs/sitemap` are all current and unchanged in config shape. |
| Build output | `dist/` by default; `npm run build`. |

### `image` config shape
The master prompt §2 uses:
```js
image: { domains: ['cdn.dsmcdn.com'], remotePatterns: [{ protocol: 'https', hostname: '**.dsmcdn.com' }] }
```
This shape is still valid in current Astro. The Astro Assets `<Image />` reads
`image.domains` and `image.remotePatterns` to authorize remote image optimization
(`isRemoteAllowed()`). Example from `astro.build`'s own config:
```js
image: { domains: ['v1.screenshot.11ty.dev', 'storage.googleapis.com', 'avatars.githubusercontent.com'] }
```
→ **No change required** to the master prompt §2 `astro.config.mjs` `image` block.

### Build-time data, not runtime fetch
Confirmed pattern (master prompt §6): dynamic routes read a committed JSON via direct
static import (`import products from '../data/products.json'`) in `getStaticPaths()`.
Astro prerenders these at `astro build`; there is no server at runtime. No adapter is
needed for a pure-static site.

## Correction applied
None. The master prompt §2 `astro.config.mjs` config shape is current for Astro 7.

### One dependency note (not a correctness issue)
`@astrojs/tailwind@6.0.2` declares a peer range of `astro: ^3 || ^4 || ^5`
(not `^7`) and `tailwindcss: ^3.0.24`. It works with Astro 7 and Tailwind 3 in
practice (astro.build ships this combo), but `npm install` needs
`--legacy-peer-deps` to pass the peer-range check. See `node-lts.md` for the
matching runtime choice (Tailwind CSS is pinned to the 3.x line so that
`tailwind.config.mjs` + `@tailwind` directives remain valid).

## Sources
- Astro 7.2 release blog: https://astro.build/blog/astro-720 (2026-08-06)
- astro@7.2.4 release: https://www.gitclear.com/open_repos/withastro/astro/release/astro@7.2.4 (2026-08-19)
- Static paths / dynamic routes: https://docs.astro.build/en/reference/modules/astro-static-paths
- Routing reference: https://docs.astro.build/en/reference/routing-reference (getStaticPaths)
- Image config / assets: https://docs.astro.build/en/reference/modules/astro-assets (`isRemoteAllowed`, `image.domains`, `image.remotePatterns`)
- Configuration reference: https://docs.astro.build/en/reference/configuration-reference
- Reference astro.config.mjs (uses `image.domains`, `@astrojs/tailwind`, `@astrojs/sitemap`): https://github.com/withastro/astro.build/blob/main/astro.config.mjs
- Static deploy settings: https://docs.astro.build/en/guides/deploy (build `astro build`/`npm run build`, publish `dist`)

Date searched: **2026-09-11**
