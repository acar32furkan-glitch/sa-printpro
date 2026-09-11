/**
 * Cloudflare Worker entry — SA Printpro
 *
 * Bu Worker, statik Astro ciktisini (dist klasoru) servis ederken ayni zamanda
 * dinamik OAuth callback ve webhook uc noktalarini karsilar.
 *
 * GUVENLIK:
 * - SHOPIER_CLIENT_SECRET YALNIZCA burada (sunucu tarafi) okunur.
 * - Secret hicbir zaman HTML/JSON yanitina veya istemciye gonderilmez.
 * - Secret'lar wrangler.toml icine GOMULMEZ; Cloudflare'de
 *   "wrangler secret put SHOPIER_CLIENT_SECRET" veya dashboard
 *   environment variables ile tanimlanir.
 */

/** Shopier OAuth token endpoint'i (varsayilan). Gerekirse env ile override edilebilir. */
const DEFAULT_TOKEN_ENDPOINT = 'https://www.shopier.com/oauth/token';

/**
 * FAZ B — B3: Kategori birlestirme sonrasi 301 yonlendirme haritasi.
 *
 * Ince/zayif kategoriler birlestirildigi icin eski kategori slug'lari artik
 * statik olarak URETILMEZ. Bu harita, eski URL'leri yeni birlesik kategoriye
 * kalici (301) olarak yonlendirir; boylece eski linkler ve arama motoru
 * indeksleri yeni sayfaya tasinir.
 *
 * Anahtar: eski kategori slug'i. Deger: yeni kategori slug'i.
 */
const CATEGORY_REDIRECTS = {
  ayna: 'duvar-dekorasyon',
  'duvar-sticker': 'duvar-dekorasyon',
  'duvar-dekorasyon-urunu': 'duvar-dekorasyon',
  'motosiklet-luzumlu-urun': 'tankpad-sticker',
};

/**
 * SEVIYE 1 — Yasal sayfa ayristirmasi sonrasi 301 yonlendirme haritasi.
 *
 * Eski birlesik yasal sayfalar (mesafeli satis + iade, gizlilik + cerez) ayri
 * sayfalara bolundu. Bu harita, eski URL'leri yeni karsiliklarina kalici (301)
 * olarak yonlendirir; boylece eski linkler ve arama motoru indeksleri korunur.
 *
 * Anahtar: eski yol (pathname). Deger: yeni yol (pathname).
 */
const LEGAL_REDIRECTS = {
  '/mesafeli-satis-ve-iade': '/mesafeli-satis-sozlesmesi',
  '/gizlilik-ve-cerez-politikasi': '/gizlilik-politikasi',
};

/**
 * Eski yasal sayfa yolunu (opsiyonel son egik cizgi ile) yeni sayfaya esler.
 * Eslesme yoksa `null` doner.
 *
 * @param {string} pathname
 * @returns {string|null} Yonlendirilecek hedef yol ya da null.
 */
function resolveLegalRedirect(pathname) {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  return LEGAL_REDIRECTS[normalized] || null;
}

/**
 * `/kategori/<slug>` yolunu (opsiyonel son egik cizgi ile) ayristirir.
 * Eslesme yoksa `null` doner.
 *
 * @param {string} pathname
 * @returns {string|null} Yonlendirilecek hedef yol ya da null.
 */
function resolveCategoryRedirect(pathname) {
  const match = /^\/kategori\/([^/]+)\/?$/.exec(pathname);
  if (!match) {
    return null;
  }

  const target = CATEGORY_REDIRECTS[match[1]];
  if (!target) {
    return null;
  }

  return `/kategori/${target}`;
}

/** Basit HTML kacis — kullanici girdisini yanita basmadan once temizler. */
function escapeHtml(value) {
  const AMP = String.fromCharCode(38) + 'amp;'; // &
  const LT = String.fromCharCode(38) + 'lt;'; // <
  const GT = String.fromCharCode(38) + 'gt;'; // >
  const QUOT = String.fromCharCode(38) + 'quot;'; // "
  const APOS = String.fromCharCode(38) + '#39;'; // '
  return String(value)
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT)
    .replace(/'/g, APOS);
}

/** Ortak HTML sablonu (basari/hata sayfalari). */
function renderPage({ title, heading, message, ok }) {
  const accent = ok ? '#16a34a' : '#dc2626';
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #f8fafc; color: #0f172a; padding: 24px;
  }
  .card {
    max-width: 480px; width: 100%; background: #fff; border-radius: 16px;
    padding: 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, .08);
    border-top: 4px solid ${accent}; text-align: center;
  }
  h1 { font-size: 1.35rem; margin: 0 0 12px; }
  p { margin: 0; line-height: 1.6; color: #475569; }
  a { display: inline-block; margin-top: 20px; color: ${accent}; font-weight: 600; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="/">Ana sayfaya don</a>
  </main>
</body>
</html>`;
}

/** JSON yaniti uretir (secret icermez). */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/**
 * Shopier OAuth token degisimi.
 * code karsiliginda access token alir. Secret yalnizca burada kullanilir.
 */
async function exchangeCodeForToken(env, code) {
  const clientId = env.SHOPIER_CLIENT_ID;
  const clientSecret = env.SHOPIER_CLIENT_SECRET;
  const redirectUri = env.SHOPIER_REDIRECT_URI;
  const tokenEndpoint = env.SHOPIER_TOKEN_ENDPOINT || DEFAULT_TOKEN_ENDPOINT;

  if (!clientId || !clientSecret || !redirectUri) {
    return {
      ok: false,
      status: 500,
      error: 'Sunucu yapilandirmasi eksik (SHOPIER_CLIENT_ID/SECRET/REDIRECT_URI).',
    };
  }

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  let upstream;
  try {
    upstream = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: payload.toString(),
    });
  } catch {
    return { ok: false, status: 502, error: 'Shopier token servisine ulasilamadi.' };
  }

  const raw = await upstream.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }

  if (!upstream.ok) {
    // Upstream hata govdesini oldugu gibi dondurmuyoruz; secret sizma riskini onlemek icin
    // yalnizca durum kodunu ve genel mesaji raporluyoruz.
    return {
      ok: false,
      status: 502,
      error: `Shopier token istegi basarisiz (HTTP ${upstream.status}).`,
    };
  }

  return { ok: true, status: 200, data };
}

/** GET /shopier/oauth/callback */
async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(
      renderPage({
        title: 'Baglanti basarisiz',
        heading: 'Baglanti basarisiz',
        message: `Shopier yetkilendirme reddedildi: ${error}`,
        ok: false,
      }),
      { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  if (!code) {
    return new Response(
      renderPage({
        title: 'Eksik parametre',
        heading: 'Eksik parametre',
        message: 'Yetkilendirme kodu (code) bulunamadi.',
        ok: false,
      }),
      { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  const result = await exchangeCodeForToken(env, code);

  if (!result.ok) {
    return new Response(
      renderPage({
        title: 'Baglanti basarisiz',
        heading: 'Baglanti basarisiz',
        message: result.error,
        ok: false,
      }),
      { status: result.status, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  return new Response(
    renderPage({
      title: 'Baglanti basarili',
      heading: 'Baglanti basarili',
      message: 'Shopier hesabiniz basariyla baglandi.',
      ok: true,
    }),
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

/** POST /api/shopier/webhook — istege bagli, imza dogrulamasi icin yer tutucu. */
async function handleShopierWebhook(request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  // TODO: Shopier webhook imzasini (varsa) env.SHOPIER_WEBHOOK_SECRET ile dogrula.
  // Simdilik yalnizca alindi onayi donduruyoruz; secret/log sizdirmiyoruz.
  return jsonResponse({ received: true, event: body?.event ?? null });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // FAZ B — B3: Eski kategori URL'lerini yeni birlesik kategoriye 301 ile
    // yonlendir. Yalnizca GET/HEAD istekleri yonlendirilir; diger metotlar
    // statik akisa birakilir.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const redirectTarget = resolveCategoryRedirect(pathname);
      if (redirectTarget) {
        const location = new URL(redirectTarget, url.origin);
        // Query string (varsa) korunur; boylece UTM/izleme parametreleri kaybolmaz.
        location.search = url.search;
        return Response.redirect(location.toString(), 301);
      }

      // SEVIYE 1: Eski birlesik yasal sayfalari yeni ayri sayfalara 301 ile
      // yonlendir.
      const legalTarget = resolveLegalRedirect(pathname);
      if (legalTarget) {
        const location = new URL(legalTarget, url.origin);
        location.search = url.search;
        return Response.redirect(location.toString(), 301);
      }
    }

    if (pathname === '/shopier/oauth/callback' && request.method === 'GET') {
      return handleOAuthCallback(request, env);
    }

    if (pathname === '/api/shopier/webhook' && request.method === 'POST') {
      return handleShopierWebhook(request);
    }

    // Diger tum istekler: statik asset servisi (SPA fallback degil).
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
