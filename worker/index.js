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
  'arma-sticker-fosfor-serit': 'motosiklet-sticker-granaj',
  'ayna': 'duvar-dekorasyon',
  'duvar-dekorasyon-urunu': 'duvar-dekorasyon',
  'duvar-sticker': 'duvar-dekorasyon',
  'motosiklet-luzumlu-urun': 'tankpad-sticker',
};

/**
 * FAZ 4 — G2.4: Birebir duplicate urunler birlestirildigi icin eski urun
 * slug'lari artik statik olarak URETILMEZ. Bu harita, eski urun URL'lerini
 * master urune kalici (301) olarak yonlendirir.
 *
 * Anahtar: eski urun slug'i. Deger: master urun slug'i.
 */
const PRODUCT_REDIRECTS = {
  '25-x-3-cm-batarya-pil-wifi-icon-oto-sticker-araba-cam-664225412': '25-x-3-cm-batarya-pil-wifi-icon-oto-sticker-araba-cam-664225329',
  '25-x-3-cm-batarya-pil-wifi-icon-oto-sticker-araba-cam-664859034': '25-x-3-cm-batarya-pil-wifi-icon-oto-sticker-araba-cam-664225329',
  'araba-makyaj-ayna-etiket-sticker-bugunde-cok-guzelsin-771995552': 'araba-makyaj-ayna-etiket-sticker-bugunde-cok-guzelsin-771992890',
  'araba-makyaj-ayna-etiket-sticker-bugunde-cok-guzelsin-771996004': 'araba-makyaj-ayna-etiket-sticker-bugunde-cok-guzelsin-771992890',
  'cumhuriyet-in-100-yil-yasinda-sticker-etiket-turk-bayragi-2-adet-787370155': 'cumhuriyet-in-100-yil-yasinda-sticker-etiket-turk-bayragi-2-adet-787369867',
  'cumhuriyet-in-100-yil-yasinda-sticker-etiket-turk-bayragi-2-adet-787370179': 'cumhuriyet-in-100-yil-yasinda-sticker-etiket-turk-bayragi-2-adet-787369867',
  'hard-core-rider-sticker-araba-motosiklet-14cm-18cm-768694343': 'hard-core-rider-sticker-araba-motosiklet-14cm-18cm-768694575',
  'hard-core-rider-sticker-araba-motosiklet-14cm-18cm-768694717': 'hard-core-rider-sticker-araba-motosiklet-14cm-18cm-768694575',
  'kask-goz-reflektif-sticker-motosiklet-araba-794968582': 'kask-goz-reflektif-sticker-motosiklet-araba-794968642',
  'kask-goz-reflektif-sticker-motosiklet-araba-795117404': 'kask-goz-reflektif-sticker-motosiklet-araba-794968642',
  'kask-kedi-pati-sticker-etiket-motosiklet-araba-reflektif-beyaz-795117733': 'kask-kedi-pati-sticker-etiket-motosiklet-araba-siyah-794969127',
  'kask-kedi-pati-sticker-etiket-motosiklet-araba-reflektif-kirmizi-795117712': 'kask-kedi-pati-sticker-etiket-motosiklet-araba-siyah-794969127',
  'kask-kedi-pati-sticker-etiket-motosiklet-araba-reflektif-mavi-795117410': 'kask-kedi-pati-sticker-etiket-motosiklet-araba-siyah-794969127',
  'kask-sticker-etiket-yapistirma-araba-motosiklet-beyaz-794967404': 'kask-sticker-etiket-yapistirma-araba-motosiklet-794967388',
  'kask-sticker-etiket-yapistirma-araba-motosiklet-florasan-sari-794967382': 'kask-sticker-etiket-yapistirma-araba-motosiklet-794967388',
  'kask-sticker-etiket-yapistirma-araba-motosiklet-kirmizi-794967407': 'kask-sticker-etiket-yapistirma-araba-motosiklet-794967388',
  'kask-sticker-etiket-yapistirma-araba-motosiklet-mavi-794967405': 'kask-sticker-etiket-yapistirma-araba-motosiklet-794967388',
  'ktm-motosiklet-jant-seridi-ready-to-race-ktm-duke-ici-sticker-etiket-791786204': 'ktm-motosiklet-jant-seridi-ready-to-race-ktm-duke-ici-sticker-etiket-791786585',
  'ktm-motosikletiniz-icin-yuksek-kaliteli-sticker-seti-ktm-etiket-yapistirma-ready-to-race-791775743': 'ktm-motosikletiniz-icin-yuksek-kaliteli-sticker-seti-ktm-etiket-yapistirma-ready-to-race-791780041',
  'ktm-motosikletiniz-icin-yuksek-kaliteli-sticker-seti-ktm-etiket-yapistirma-ready-to-race-791778351': 'ktm-motosikletiniz-icin-yuksek-kaliteli-sticker-seti-ktm-etiket-yapistirma-ready-to-race-791780041',
  'ktm-motosikletiniz-icin-yuksek-kaliteli-sticker-seti-ktm-etiket-yapistirma-ready-to-race-791779711': 'ktm-motosikletiniz-icin-yuksek-kaliteli-sticker-seti-ktm-etiket-yapistirma-ready-to-race-791780041',
  'limited-edition-sticker-otomobil-araba-etiket-yapistirma-honda-jdm-japon-792957793': 'limited-edition-sticker-otomobil-araba-etiket-yapistirma-honda-jdm-japon-792957806',
  'limited-edition-sticker-otomobil-araba-etiket-yapistirma-honda-jdm-japon-792957803': 'limited-edition-sticker-otomobil-araba-etiket-yapistirma-honda-jdm-japon-792957806',
  'low-life-yazili-oto-sticker-araba-sticker-genislik-15-cm-2-adet-701347090': 'low-life-yazili-oto-sticker-araba-sticker-genislik-15-cm-2-adet-701331830',
  'low-life-yazili-oto-sticker-araba-sticker-genislik-15-cm-2-adet-701347372': 'low-life-yazili-oto-sticker-araba-sticker-genislik-15-cm-2-adet-701331830',
  'made-in-japan-araba-sticker-etiket-yapistirma-honda-jdm-japon-792955964': 'made-in-japan-araba-sticker-etiket-yapistirma-honda-jdm-japon-792955940',
  'made-in-japan-araba-sticker-etiket-yapistirma-honda-jdm-japon-792955983': 'made-in-japan-araba-sticker-etiket-yapistirma-honda-jdm-japon-792955940',
  'mondial-drift-kafa-granaj-sticker-yapistirma-etiket-792365703': 'mondial-drift-kafa-granaj-sticker-yapistirma-etiket-792322343',
  'mondial-drift-kafa-granaj-sticker-yapistirma-etiket-792365733': 'mondial-drift-kafa-granaj-sticker-yapistirma-etiket-792322343',
  'mondial-drift-l-125-motorsiklet-venom-far-sticker-etiket-742310708': 'mondial-drift-l-125-motorsiklet-venom-far-sticker-etiket-379247293',
  'mondial-drift-l-reklektif-jant-serit-sticker-beyaz-kirmizi-uyumlu-463667312': 'mondial-drift-uyumlu-l-reklektif-jant-serit-sticker-kirmizi-beyaz-461957335',
  'motosiklet-jant-seridi-reflektif-florasan-sari-sticker-etiket-araba-serit-794966442': 'motosiklet-jant-seridi-reflektif-sticker-etiket-araba-serit-beyaz-794966419',
  'motosiklet-jant-seridi-reflektif-kirmizi-sticker-etiket-araba-794966449': 'motosiklet-jant-seridi-reflektif-sticker-etiket-araba-serit-beyaz-794966419',
  'motosiklet-jant-seridi-reflektif-mavi-sticker-etiket-araba-serit-lacivert-794966464': 'motosiklet-jant-seridi-reflektif-sticker-etiket-araba-serit-beyaz-794966419',
  'motosiklet-jant-seridi-reflektif-sticker-etiket-araba-serit-siyah-794966416': 'motosiklet-jant-seridi-reflektif-sticker-etiket-araba-serit-beyaz-794966419',
  'royal-stance-oto-sticker-30x10-cm-siyah-113807207': 'royal-stance-oto-sticker-30x10-cm-kirmizi-113800892',
  'wanted-motorsiklet-laptop-cam-kask-araba-sticker-18x7-cm-757791366': 'wanted-motorsiklet-laptop-cam-kask-araba-sticker-18x7-cm-757791365',
  'yamaha-r7-jant-seridi-kirmizi-reflektif-sticker-etiket-792066881': 'yamaha-r7-jant-seridi-mavi-reflektif-sticker-etiket-792066506',
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

/**
 * `/urun/<slug>` yolunu (opsiyonel son egik cizgi ile) ayristirir ve eski
 * (birlestirilmis) urun slug'larini master urune esler. Eslesme yoksa `null`.
 *
 * @param {string} pathname
 * @returns {string|null} Yonlendirilecek hedef yol ya da null.
 */
function resolveProductRedirect(pathname) {
  const match = /^\/urun\/([^/]+)\/?$/.exec(pathname);
  if (!match) {
    return null;
  }

  const target = PRODUCT_REDIRECTS[match[1]];
  if (!target) {
    return null;
  }

  return `/urun/${target}`;
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

/**
 * Kanonik ana alan adi. `www` alt alan adi (DNS eklendiginde) buraya kalici
 * (301) olarak yonlendirilir; boylece tek kanonik origin kullanilir.
 */
const CANONICAL_HOST = 'saprintpro.com';

/**
 * `.html` ile biten istekleri, Cloudflare static assets katmaninin uzanti
 * soyuma/yonlendirme davranisina takilmadan DOGRUDAN servis eder.
 *
 * Google Search Console site dogrulamasi tam `.html` yolunu bekledigi icin
 * (or. /google419bc019c17c40b5.html) bu isteklerin 307 ile uzantisiz yola
 * yonlendirilmesi dogrulamayi bozar.
 *
 * ONEMLI: `env.ASSETS.fetch(request)` cagrisi, varsayilan `html_handling`
 * davranisi nedeniyle `.html` istegini yine 307 ile uzantisiz yola
 * yonlendirebilir. Bu nedenle once dogrudan ASSETS'e iletilir; 3xx donerse
 * yonlendirme TAKIP EDILMEZ, bunun yerine hedef dosya (uzantisiz yol) icerigi
 * alinip 200 olarak, orijinal `.html` URL'si altinda sunulur.
 *
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response|null>} Yanit ya da ASSETS yoksa null.
 */
async function serveHtmlFileDirectly(request, env) {
  if (!env.ASSETS) {
    return null;
  }

  const response = await env.ASSETS.fetch(request);

  // 2xx ise dogrudan dondur (html_handling zaten dosyayi servis etti).
  if (response.status < 300 || response.status >= 400) {
    return response;
  }

  // 3xx: uzanti soyuma yonlendirmesi. Yonlendirmeyi takip etmek yerine
  // hedef icerigi alip orijinal `.html` URL'si altinda 200 olarak sun.
  const location = response.headers.get('location');
  if (!location) {
    return response;
  }

  const target = new URL(location, request.url);
  const followed = await env.ASSETS.fetch(
    new Request(target.toString(), { method: 'GET', headers: request.headers })
  );

  if (!followed.ok) {
    return response;
  }

  // Govdeyi ve ilgili basliklari koruyarak 200 yaniti uret.
  const headers = new Headers(followed.headers);
  headers.delete('location');
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=0, must-revalidate');

  return new Response(followed.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // SORUN 3: `www.saprintpro.com` (DNS eklendiginde) → `saprintpro.com`
    // kalici (301) yonlendirme. Yol ve query string korunur.
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      const location = new URL(request.url);
      location.hostname = CANONICAL_HOST;
      location.protocol = 'https:';
      return Response.redirect(location.toString(), 301);
    }

    // SORUN 1: `.html` dosyalarini yonlendirmeden dogrudan servis et.
    // (Google Search Console dogrulama dosyasi dahil.)
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      pathname.endsWith('.html')
    ) {
      const direct = await serveHtmlFileDirectly(request, env);
      if (direct) {
        return direct;
      }
    }

    // FAZ B — B3: Eski kategori URL'lerini yeni birlesik kategoriye 301 ile
    // yonlendir. Yalnizca GET/HEAD istekleri yonlendirilir; diger metotlar
    // statik akisa birakilir.
    //
    // ONEMLI: Bu blok trailing-slash (308) kuralindan ONCE calismalidir; aksi
    // halde `/kategori/ayna` gibi eski URL'ler once 308 ile `/kategori/ayna/`
    // adresine gider ve 301 semantigi kaybolur.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const redirectTarget = resolveCategoryRedirect(pathname);
      if (redirectTarget) {
        const location = new URL(redirectTarget, url.origin);
        // Query string (varsa) korunur; boylece UTM/izleme parametreleri kaybolmaz.
        location.search = url.search;
        return Response.redirect(location.toString(), 301);
      }

      // FAZ 4 — G2.4: Birebir duplicate urunler birlestirildigi icin eski urun
      // URL'lerini master urune 301 ile yonlendir.
      const productTarget = resolveProductRedirect(pathname);
      if (productTarget) {
        const location = new URL(productTarget, url.origin);
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

    // SORUN 2: Trailing-slash yonlendirmesi (KALICI 308).
    //
    // Cloudflare static assets varsayilan davranisi trailing-slash
    // yonlendirmesini 307 (gecici) ile yapar. SEO acisindan 308 (kalici) daha
    // uygundur. Burada ayni davranis KALICI (308) olarak acikca uygulanir:
    // uzantisiz ve sonu `/` ile bitmeyen yollar sonuna `/` eklenerek 308 ile
    // yonlendirilir.
    //
    // - Yalnizca GET/HEAD.
    // - Sonunda dosya uzantisi olan yollar (or. .html, .xml, .txt, .png)
    //   HARIC tutulur; bunlar dogrudan servis edilir.
    // - Kok yol (`/`) zaten `/` ile bittigi icin etkilenmez.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      pathname !== '/' &&
      !pathname.endsWith('/') &&
      !/\.[a-z0-9]+$/i.test(pathname)
    ) {
      const location = new URL(request.url);
      location.pathname = `${pathname}/`;
      return Response.redirect(location.toString(), 308);
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
