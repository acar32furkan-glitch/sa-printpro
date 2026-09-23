# Verification Pass — Phase 0

Index of web-search findings saved for the Trendyol Showcase (Astro v7) template.
These files are documentation committed to the repo and are **excluded from `dist/`**
(Astro only emits `src/pages` + `public/` at build time; a root-level `docs/` folder
is never copied to output).

Date of pass: **2026-09-11**

| # | Topic | Finding | Source (date searched) |
|---|-------|---------|------------------------|
| 1 | Trendyol Seller API (V2) | `apigw.trendyol.com`; endpoints confirmed; rate-limit not independently verified | developers.trendyol.com/v2.0 (2026-07-20) |
| 2 | Astro version & static output | Astro 7.2/7.3 current; `output:'static'` default; `getStaticPaths()` required for dynamic routes; `image:{domains,…}` config still valid | astro.build / docs.astro.build (2026-08) |
| 3 | Node.js LTS | Node 24 (Krypton) is current Active LTS; Node 20 EOL. Astro 7 supports Node 22 & 24 | nodejs.org (2026-08-26) |
| 4 | Cloudflare Pages | Build `npm run build`; output `dist`; framework preset Astro | developers.cloudflare.com (2026-04-21) |
| 5 | GA4 / Google Consent Mode | Consent Mode v2 required for EEA since Mar 2024; June 15 2026 change; Turkey subject to KVKK | consentmanager / privado.ai / trustyourwebsite.com (2026-05…08) |
| 6 | Trendyol V1 shutdown | V1 product services deactivated **15 Sep 2026** per current official docs (an earlier "10 Aug 2026" date was superseded) | developers.trendyol.com (2026-07-20) |

From Phase 1 onward, pull verified facts from these files instead of re-deriving from memory.

## Phase Reports

| Phase | Report | Scope |
|-------|--------|-------|
| Phase 4 | [`faz4.md`](./faz4.md) | Kurumsal bilgi merkezileştirme (G1.x), duplicate ürün birleştirme (G2.x), kategori taksonomisi bölme (G3.x), kategori bazlı filtre sayaçları (G4.x), canlı/yerel doğrulama (G5.x) |
