# Verification: Cloudflare Pages deployment

**Question (§0, item 4):** Confirm the current recommended way to connect a GitHub
repo and the current build-output settings for an Astro static build (build command,
output directory).

## Finding

For a **static** Astro site (no SSR adapter), Cloudflare Pages needs:

| Setting | Value |
|---------|-------|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build directory / output | `dist` |

Flow: in the Cloudflare dashboard → **Workers & Pages** → *Pages* → **Create
application** → **Import an existing Git repository** → connect GitHub →
"Begin setup" → set _Production branch_ `main`, _Build command_ `npm run build`,
_Build directory_ `dist` → **Save and Deploy**. Pages automatically rebuilds on every
push to the connected branch.

No `@astrojs/cloudflare` adapter is required for static output — the adapter is only
for SSR/on-demand rendering. This template deliberately uses pure static output
(master prompt §1: no adapter).

### Note (Cloudflare guidance)
Cloudflare's current docs note that **new projects are recommended to use Cloudflare
Workers** rather than Pages, and that existing Pages projects remain supported. This
template keeps the master-prompt target of Pages for a static site; the build/output
settings above are unchanged and remain valid.

## Correction applied
None. The master prompt §2/§5 values (build `npm run build`, output `dist`) match the
current Cloudflare Pages documentation.

## Sources
- Deploy an Astro site — Cloudflare Pages framework guide
  https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site
  (last updated 2026-04-21; Build command `npm run build`, Build directory `dist`)
- Build configuration reference (Astro row: `npm run build` | `dist`)
  https://developers.cloudflare.com/pages/configuration/build-configuration/index.md
- Astro deploy guide (build `astro build`/`npm run build`, publish `dist`):
  https://docs.astro.build/en/guides/deploy
- Cloudflare adapter doc (only needed for SSR; not for static):
  https://v5.docs.astro.build/en/guides/integrations-guide/cloudflare

Date searched: **2026-09-11**
