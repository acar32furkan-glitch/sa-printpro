# TRENDYOL PRODUCT SHOWCASE — MASTER BUILD PROMPT (v7 · ASTRO · PRODUCT-FIRST, REUSABLE TEMPLATE)

## ROLE

You are a senior Frontend Engineer and SEO specialist. Your goal: build a **product-first**, 100% static, production-ready **Astro** showcase site that mirrors a Trendyol seller's catalog with zero-friction, robust synchronization. This is a **reusable template**: it must work for any Trendyol seller by changing only the config values in §6, not by rewriting code. It is pre-configured for the seller "SA Printpro" as the default instance.

## 0) MANDATORY PRE-BUILD VERIFICATION (WEB SEARCH)

Your training data has a knowledge cutoff and may be stale. Before writing any code in Phase 0, use web search to verify the following against current, dated sources (not memory). Do not skip this step.

Verify and report back briefly (one line per item, with source and date) before proceeding:

1. **Trendyol Seller API (V2):** confirm the current base URL, exact path and required query/header parameters for the `products/approved` and `inventory-and-price` endpoints, current rate limits, and whether anything has changed since this prompt was written. Verify against `developers.trendyol.com` or the official seller API reference, not a blog post.
2. **Astro version & static output behavior:** confirm the current stable Astro version, whether the default `output: 'static'` mode, `getStaticPaths()` requirements, or the `@astrojs/react` and `@astrojs/sitemap` integrations have changed their config shape.
3. **Node.js LTS:** confirm which Node version is current LTS (this prompt assumes Node 20 LTS) and that it's still supported by the current Astro version.
4. **Cloudflare Pages deployment:** confirm the current recommended way to connect a GitHub repo and the current build-output settings for an Astro static build (build command, output directory).
5. **GA4 / Google Consent Mode:** confirm whether Consent Mode v2 is currently required/recommended for GA4 in the EU/Turkey context.
6. **Trendyol V1 shutdown claim:** confirm the exact shutdown date and status of Trendyol Product V1 services stated in §3.

Save findings to `docs/verification/*.md` as described below (one file per topic, plus a `docs/verification/README.md` index) so later phases can reference verified facts instead of re-deriving them from memory. If a correction is needed, note it under a `## Correction applied` heading in the relevant file.

### Save verification results to disk

- Create `docs/verification/` in the project root.
- One markdown file per topic: `trendyol-api.md`, `astro-static-output.md`, `node-lts.md`, `cloudflare-pages.md`, `ga4-consent-mode.md`, `trendyol-v1-shutdown.md`. Each contains: the question, the finding, exact source URL(s), and the date searched.
- `docs/verification/README.md` as an index, one line per topic, plus a date stamp for the pass.
- These are documentation, committed to the repo, excluded from the `dist/` build output.
- From Phase 1 onward, pull verified facts from `docs/verification/*.md` rather than re-deriving from memory.

## 1) HARD CONSTRAINTS & ANTI-OVERTHINKING

- **This is a product-discovery tool, not a brand-marketing site.** Every screen exists to help a visitor find, evaluate, and buy a product. No storytelling sections, no large hero banners, no decorative infographics. If a component doesn't help someone find or buy a product, cut it.
- NO backend, database, API routes, server actions, or middleware. Pure static output — Astro's default `output: 'static'` mode. No SSR adapter (no `@astrojs/cloudflare`, `@astrojs/node`, etc.) — this site never renders on request.
- NO unnecessary state-management libraries (Redux, Zustand, etc.). Plain React hooks (`useState`, `useEffect`, `useMemo`) inside island components are sufficient.
- NO Trendyol scraping. Only the authenticated V2 Seller API tied to the seller's own account may be used.
- NO placeholder UI logic: variant selection, search, filtering, sorting, pagination, theme toggle, gallery — all of it must actually work.
- NO fuzzy-search or search libraries (e.g. Fuse.js). NO cookie-consent libraries. See §7 and §9 for the exact required implementations.
- JavaScript only (no TypeScript, including in `.astro` file frontmatter). Tailwind CSS. Icons: `lucide-react` (inside islands) or plain inline SVG (in static `.astro` markup, to avoid shipping the icon library's JS to non-interactive parts of the page).
- **Islands discipline:** only components that genuinely need client-side interactivity (VariantSelector, Gallery, SearchBar, ThemeToggle, CookieBanner) are React components with a `client:*` directive. Everything else — layout, product grid, cards, breadcrumbs, footer — is plain `.astro` markup with zero shipped JS. Do not reach for a React component out of habit where static markup does the job.
- Do NOT over-engineer or add unnecessary abstraction layers. Produce pragmatic, modular, readable, directly runnable code.
- **Nothing in this codebase may hardcode a specific seller's identity.** Seller name, domain, contact info, and supplier ID all come from `src/config/site.js` and `.env.local` (see §6). Swapping those values for a different Trendyol seller must be enough to re-brand the entire template.

## 2) STACK & HOSTING

- **Astro** (default static output) + **React** (via `@astrojs/react`, islands only) + Tailwind CSS (via `@astrojs/tailwind`).
- `astro.config.mjs`:
  ```javascript
  import { defineConfig } from 'astro/config';
  import react from '@astrojs/react';
  import tailwind from '@astrojs/tailwind';
  import sitemap from '@astrojs/sitemap';
  import { siteConfig } from './src/config/site.js';

  export default defineConfig({
    site: siteConfig.domain,
    output: 'static',
    integrations: [react(), tailwind(), sitemap()],
    image: {
      domains: ['cdn.dsmcdn.com'],
      remotePatterns: [{ protocol: 'https', hostname: '**.dsmcdn.com' }]
    }
  });
  ```
- Target host: Cloudflare Pages (free, commercial use allowed, unlimited bandwidth for static sites). Build command: `npm run build`. Output directory: `dist`.
- Node 24 LTS (Node 20 LTS is end-of-life — see `docs/verification/node-lts.md`).
- **Dynamic routes:** every `src/pages/**/[slug].astro` MUST export `getStaticPaths()`, reading `src/data/products.json` via a direct static import (`import products from '../data/products.json'`) and returning one entry per product/category slug with its data passed as `props`. No `fetch` at build time — the sync script has already produced the JSON before `astro build` runs.
- **Islands hydration directives — pick deliberately per component:**
  - `ThemeToggle`: `client:load` (must be interactive immediately, avoids a flash of the wrong theme).
  - `VariantSelector`, `Gallery`: `client:visible` (below the fold on load, hydrate when scrolled into view).
  - `SearchBar`: `client:idle` (not needed for first paint).
  - `CookieBanner`: `client:load` (must gate GA4 before anything fires).
- Linting/formatting (Phase 0): flat config at `eslint.config.mjs` using `eslint` 9 + `eslint-plugin-astro` 1.x (`flat/recommended`) + `eslint-plugin-react` (flat, scoped to `**/*.{jsx,tsx}`) + `eslint-plugin-react-hooks` (flat) + `eslint-config-prettier`; `.prettierrc` (2-space indent, single quotes, no semicolons) with `prettier-plugin-astro` for `.astro` files.
  - **Version pinning (verified):** `eslint-plugin-react@7.37.5` (latest) declares peer support only up to `eslint@^9.7` and crashes under ESLint 10 (`contextOrFilename.getFilename is not a function`). `eslint-plugin-astro@2.x/3.x` requires `eslint >=10`. The only mutually compatible combination is **`eslint@^9.39.0` + `eslint-plugin-astro@^1.7.0`** (peer `eslint >=8.57.0`). Do not bump ESLint to 10 until `eslint-plugin-react` ships ESLint 10 support.
  - The React flat config disables two rules that are obsolete for this stack: `react/react-in-jsx-scope` (React 17+ automatic JSX runtime) and `react/prop-types` (props are documented via JSDoc and passed from Astro; PropTypes are intentionally unused).
  - React islands must not call `setState` synchronously inside an effect body (`react-hooks/set-state-in-effect`). Resolve initial client state with lazy `useState(() => ...)` initializers and clamp derived indices during render instead of resetting them in effects.

## 3) TRENDYOL SYNCHRONIZATION — V2 API (CRITICAL, MUST BE FRICTIONLESS)

> Trendyol's Product V1 services were shut down as of September 15, 2026 (verify in Phase 0). NEVER use V1 endpoints.

- Base URL: `https://apigw.trendyol.com`
- Product list: `GET /integration/product/sellers/{supplierId}/products/approved` (paginated via `page`, `size`; loop until a page returns zero items — do not assume a fixed total).
- Price/stock: `GET /integration/product/sellers/{supplierId}/products/approved/inventory-and-price`
- Auth: HTTP Basic Auth (`apiKey:apiSecret`).
- REQUIRED header: `User-Agent: "{supplierId} - SelfIntegration"` (omitting this causes a 403).
- Rate limit: 50 requests / 10 sec / endpoint; 250ms sleep between page requests.
- **Retry/backoff policy:** on `429`, honor `Retry-After` if present, otherwise exponential backoff (1s → 2s → 4s), max 3 retries per request. Exhausted retries → abort that sync run, leave `products.json` untouched, log clearly, exit non-zero — never break the site build.
- **Deduplication:** dedupe products by `id` before writing.
- **Atomic write:** write to `src/data/products.json.tmp`, then rename over `src/data/products.json` only after the full fetch succeeds — a crash mid-fetch must never leave a corrupt or partial file.
- **No-op detection:** compare a hash of the new normalized catalog against the previous one; if identical, skip the write so Git history and CI runs stay clean.

### Sync Architecture (build-time)

```
Trendyol V2 API → scripts/fetch-trendyol.mjs → src/data/products.json (committed to repo)
```

- Credentials from `.env.local`: `TRENDYOL_API_KEY`, `TRENDYOL_API_SECRET`, `TRENDYOL_SUPPLIER_ID`. Generate a matching `.env.example`.
- The site never calls the API at runtime; `astro build` only reads `products.json` from disk.
- Images are not downloaded; Trendyol CDN URLs are used directly (via Astro's `<Image>` component where practical, or plain `<img>` for simplicity — both are acceptable since images are remote).
- `.github/workflows/sync.yml`:
  - Cron trigger: twice a day.
  - `permissions: contents: write`.
  - Secrets injected via `env:` from GitHub repo secrets — never hardcoded.
  - `git diff --quiet -- src/data/products.json` guard skips the commit step when nothing changed.
  - Bot identity: `git config user.name "Trendyol Sync Bot"` with a matching noreply email (rename per-deployment if desired).
- On failure, the existing `products.json` is preserved and the workflow ends gracefully without committing — a sync failure must never break the live site.

## 4) DATA MODEL & NORMALIZATION

```json
{
  "generatedAt": "2026-09-11T00:00:00.000Z",
  "products": [
    {
      "id": "12345",
      "name": "Sample Sticker",
      "slug": "sample-sticker-12345",
      "brand": "Seller Brand Name",
      "category": { "id": "101", "name": "Reflective Label", "slug": "reflective-label" },
      "descriptionHtml": "<p>Detailed description</p>",
      "images": ["https://cdn.dsmcdn.com/..."],
      "variants": [
        {
          "barcode": "8680001",
          "sku": "STK-01-BLU",
          "attributes": { "Color": "Blue", "Size": "16cm" },
          "price": 120,
          "salePrice": 99,
          "stock": 50
        }
      ]
    }
  ]
}
```

- **Price:** `salePrice` is authoritative. If `price > salePrice`, show a discount badge: strikethrough list price + "−X%".
- **Stock:** if `stock <= 0`, that variant cannot be selected and shows a "Sold out" badge.
- **Slug:** strip Turkish characters, lowercase-hyphenate, append a short id/barcode suffix to avoid collisions.

## 5) SHOPIER & ORDER ROUTING

- Mapping file: `src/config/shopier.json` → `{ "BARCODE": "https://shopier.com/..." }`
- `scripts/import-shopier-csv.mjs`: converts `shopier-links.csv` (`barcode,url`) into the mapping above.

### Dual-Channel Order Logic

- **Primary CTA:** if a Shopier link exists, "Buy securely with Shopier" (new tab, `rel="noopener noreferrer"`).
- **Secondary CTA / Fallback:** "Order via WhatsApp". Becomes primary if no Shopier link exists. Opens a `wa.me` link:
  `"Hello, I'd like to order {Product Name} ({Variant Details} - Barcode: {Barcode})."`
- This logic lives inside the `VariantSelector` island (it already knows the selected variant's barcode and stock), rendered as plain buttons — no extra component needed.

## 6) CONFIGURATION — TEMPLATE IDENTITY LAYER

`src/config/site.js` is the **only** place seller identity lives. To reuse this template for a different Trendyol seller, edit only this file plus `.env.local`.

```javascript
export const siteConfig = {
  name: "SA Printpro",
  domain: "https://saprintpro.com",
  logoFile: "logo.png",
  contact: {
    whatsapp: "905XXXXXXXXX",
    instagram: "saprintpro",
    email: "info@saprintpro.com"
  },
  badges: {
    shipping: "Shipped in 2 days",
    returns: "15-day returns",
    freeShipping: "Free shipping over 350 TL",
    freeShippingThreshold: 350
  },
  ga4Id: "G-XXXXXXXXXX",
  searchConsoleVerification: "",
  showHowToApply: false
};
```

- `src/config/featured.js`: array of featured product slugs (empty → fall back to top 4 highest-stock products).
- **Logo placeholder:** `public/logo.png` will not exist initially. Build a simple text-wordmark `Logo.astro` component reading `siteConfig.name` as the placeholder — this one stays a static `.astro` component, not a React island, since a logo never needs interactivity. `README.md` must document: "replace `public/logo.png` and update `siteConfig.logoFile`."

## 7) DESIGN & UX — PRODUCT-FIRST, MINIMAL, LIGHT THEME

The homepage's job is to get a visitor into the product grid in under 2 seconds of scanning — not to tell a brand story.

- **Theme:** light by default (white background, near-black text), toggleable to dark via the `ThemeToggle` island, synced with `localStorage` and `prefers-color-scheme`. Apply the theme class to `<html>` via a tiny inline `<script>` in the layout head (runs before paint, avoiding a flash of the wrong theme — a standard pattern for static sites, not a hydration concern since it's plain script, not a React island). No neon accents, no gradients — a single neutral accent color used sparingly (e.g. only on the active category tab and primary CTA button).
- **No large hero banner.** Homepage structure, top to bottom: sticky minimal navbar (static `.astro`, except the search icon and theme toggle islands inside it) → one-line page intro (site name + product count, ~2 lines max) → category tab strip (static links, since category filtering is just navigation to `/kategori/[slug]/`) → product grid, immediately. No full-width imagery above the grid.
- **Navbar:** logo/name, "products" and "contact" links, search icon (opens the `SearchBar` island), theme toggle. Nothing else.
- **Product grid:** rendered as static `.astro` markup looping over `products.json` — zero JS for the grid itself. 3 columns on desktop / 2 on mobile, image-forward cards (4:5 image ratio dominates the card), name (1 line, truncated) + price beneath. Discount and sold-out badges are small, neutral-toned — the photo carries the visual weight, not the badge.
- **Product detail page:** `Gallery` island (thumbnail-driven image switch) and `VariantSelector` island (price reactive to selection, stock-aware, renders the Shopier/WhatsApp CTA per §5). Everything else on the page (description, breadcrumb, JSON-LD) is static markup.
- **"How to apply" infographic:** optional, OFF by default via `siteConfig.showHowToApply`. Build it as static `.astro` markup (it's illustrative, not interactive) only when the flag is true.
- **Cookie banner:** compact, bottom-anchored, two buttons (accept/decline), no illustration. React island (`client:load`) since it must gate script injection immediately.

### Search (exact spec — no libraries)

- A `SearchBar` React island (`client:idle`). On mount, it imports `products.json` directly (already bundled at build time, no fetch) and filters client-side with `Array.filter()` — no search libraries.
- Match `name`, `category.name`, `sku`, case-insensitive, Turkish-character-normalized (İ/I→i, Ş→s, Ğ→g, Ü→u, Ö→o, Ç→c) `includes()` substring match.
- Query state lives in the island's own `useState`, mirrored to the URL via `history.replaceState(...)` on a `?q=` param so a search is shareable/bookmarkable — no framework-level `useSearchParams`/`Suspense` requirement exists in Astro, since this is a plain client-side island, not a server-rendered boundary.

### Filtering & Sorting (exact spec)

- Category filter: static navigation to the `kategori/[slug]/` route — no client JS needed.
- Price sort and "in stock only": a small React island (`client:idle`) wrapping the product grid section, using `useMemo` over the page's product array (passed in as a prop from the static parent) — no additional state library.

## 8) SEO & METADATA

- A shared `Seo.astro` component (imported into every page's `<head>`) sets `title`, `description`, canonical URL (via `Astro.url` + `siteConfig.domain`), and Open Graph tags per page.
- `@astrojs/sitemap` (configured in `astro.config.mjs`, see §2) generates the sitemap automatically at build time — no hand-written `sitemap.js` needed.
- `public/robots.txt` is a plain static file (Astro copies `public/` verbatim to the build output) referencing the sitemap URL.
- Inline JSON-LD `<script type="application/ld+json">` blocks directly in each page's static markup: `Product` (price, stock, `currency: TRY`, sku, images, brand), `BreadcrumbList`, `FAQPage` (derived from product attributes).
- `<html lang="tr">` set once in the shared layout.

## 9) COOKIE CONSENT & GA4 (exact spec — no libraries)

- No third-party cookie-consent library.
- `localStorage` key `sa-cookie-consent`. Since Astro has no cross-component context by default outside a single island tree, implement consent as a tiny vanilla-JS module (`src/lib/consent.js`) exposing `getConsent()` / `setConsent(boolean)` against `localStorage`, imported by both the `CookieBanner` island and the GA4-loading script — no React Context needed since these aren't nested in the same component tree.
- GA4 is injected via a plain `<script>` tag added dynamically from `src/lib/consent.js` only after `setConsent(true)` fires — never present in the initial static HTML, so it cannot execute before consent.

## 10) AI EXECUTION RULES (STEP-BY-STEP & MODULAR)

1. **No overthinking:** no long theoretical explanations or architecture debates. Direct, clean, purpose-built code.
2. **Step-by-step delivery:** complete each phase fully before moving to the next. At the end of each phase, output only: `"Phase X Complete — Files Produced: [...]"`, then continue.
3. **No placeholders:** `// implement later` and similar are forbidden. Every function, utility, and component is written in full.

### Phase Breakdown

- **Phase 0:** Web-search verification pass (§0), results saved to `docs/verification/*.md`. Project scaffold via `package.json` (clean `npm install --legacy-peer-deps`; **not** `npm create astro@latest`, which defaults to Tailwind 4 and conflicts with this template's `tailwind.config.mjs` + `@astrojs/tailwind`'s `tailwindcss: ^3` peer), with `@astrojs/react`, `@astrojs/tailwind`, `@astrojs/sitemap` integrations installed alongside `eslint@^9.39.0` + `eslint-plugin-astro@^1.7.0` + `eslint-plugin-react` (+ `eslint-config-prettier`) flat config, `astro.config.mjs`, `tailwind.config.mjs`, `src/styles/globals.css`, `.env.example`, `eslint.config.mjs`, `.prettierrc`, `tsconfig.json`, `.gitignore`. (Phase 0 inlines `site` in `astro.config.mjs` because `src/config/site.js` is a Phase 2 file; the build is pure static, no adapter. See §2 for the verified ESLint/plugin version pinning rationale.)
- **Phase 1:** `scripts/fetch-trendyol.mjs` (with retry/backoff, dedup, atomic write, no-op detection), `scripts/import-shopier-csv.mjs`, mock `src/data/products.json` for testing.
- **Phase 2:** Config files (`site.js`, `featured.js`), `Logo.astro` placeholder, `src/lib/consent.js`, data-reading/filtering/search/sort utility functions.
- **Phase 3:** React island components: `ThemeToggle`, `VariantSelector`, `Gallery`, `SearchBar`, `CookieBanner`, `SortFilterBar`. Static `.astro` components: `Navbar`, `Footer`, `ProductCard`, `Breadcrumb`, `Seo`. (`HowToApply.astro` only if `siteConfig.showHowToApply` is true.)
- **Phase 4:** Pages (`src/pages/index.astro`, `src/pages/urun/[slug].astro`, `src/pages/kategori/[slug].astro`, `src/pages/iletisim.astro`, `src/pages/404.astro`) with `getStaticPaths()` on all dynamic routes, JSON-LD, `public/robots.txt`.
- **Phase 5:** GitHub Actions (`.github/workflows/sync.yml`), complete `README.md` with Cloudflare Pages setup guide (build command `npm run build`, output directory `dist`) and a "reusing this template for another seller" section (which fields in §6 to change).

## 11) ACCEPTANCE CRITERIA (END-OF-LOOP VALIDATION)

- `npm run build` produces error-free, pure static output in `dist/`.
- Every dynamic route has a working `getStaticPaths()` and builds every product/category page.
- Non-interactive sections (grid, cards, footer, breadcrumb) ship zero JavaScript — verify by inspecting the built HTML for the absence of hydration script tags on those elements.
- Price/stock react correctly to the selected variant inside the `VariantSelector` island; WhatsApp fallback activates automatically when no Shopier link exists.
- Search, category filter, price sort, and stock filter all work client-side with no external libraries.
- The homepage shows the product grid without a large hero section above it.
- GA4 is not injected until cookie consent is accepted via `src/lib/consent.js`.
- The sync script survives a simulated 429 via retry/backoff, deduplicates products, writes atomically, and skips commits when nothing changed.
- Swapping the values in `src/config/site.js` and `.env.local` is sufficient to re-brand the site for a different Trendyol seller — no other file needs a manual edit for that.
- No file contains a hardcoded domain or seller secret.
