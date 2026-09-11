export const siteConfig = {
  name: 'SA Printpro',
  domain: 'https://saprintpro.com',
  logoFile: 'logo.png',
  logoDarkFile: 'logo-dark.png',
  faviconFile: 'favicon.png',
  contact: {
    whatsapp: '905XXXXXXXXX',
    instagram: 'saprintpro',
    email: 'info@saprintpro.com',
  },
  badges: {
    shipping: '2 Günde Kargoda',
    returns: '15 Gün İade',
    freeShipping: '350 TL Üzeri Kargo Bedava',
    freeShippingThreshold: 350,
  },
  ga4Id: 'G-XXXXXXXXXX',
  searchConsoleVerification: '',
  showHowToApply: true,
  features: {
    // false yapılırsa sitedeki tüm Trendyol butonları ve rozetleri gizlenir,
    // doğrudan satış (Shopier/WhatsApp) birincil olur.
    enableTrendyolCta: true,
    // Web'e özel indirimli fiyat gösterimi.
    enableDirectDiscount: true,
    // Doğrudan satış indirim oranı (0.20 = %20).
    directDiscountRate: 0.2,
  },
  motorcycleBrands: [
    { name: 'Honda', slug: 'honda', keywords: ['honda', 'pcx', 'cbr', 'forza', 'activa', 'dio'] },
    {
      name: 'Yamaha',
      slug: 'yamaha',
      keywords: ['yamaha', 'mt-', 'mt07', 'mt09', 'r25', 'r7', 'nmax', 'xmax'],
    },
    {
      name: 'CFMoto',
      slug: 'cfmoto',
      keywords: ['cfmoto', 'cf moto', '250sr', '250nk', '450sr', 'nk250'],
    },
    {
      name: 'Bajaj',
      slug: 'bajaj',
      keywords: ['bajaj', 'pulsar', 'ns200', 'rs200', 'dominar'],
    },
    { name: 'RKS', slug: 'rks', keywords: ['rks', 'wildcat', 'freccia'] },
    { name: 'KTM', slug: 'ktm', keywords: ['ktm', 'duke', 'rc'] },
    { name: 'Kawasaki', slug: 'kawasaki', keywords: ['kawasaki', 'ninja', 'z900'] },
    { name: 'BMW', slug: 'bmw', keywords: ['bmw', 'gs', 's1000rr'] },
    { name: 'TVS', slug: 'tvs', keywords: ['tvs', 'jupiter', 'raider', 'apache'] },
    { name: 'Universal / Genel', slug: 'universal', keywords: ['universal', 'genel'] },
  ],
  trendyol: {
    sellerId: '907993',
    storeUrl: 'https://www.trendyol.com/magaza/sa-printpro-m-907993',
    utmParams:
      '?utm_source=saprintpro_web&utm_medium=showcase&utm_campaign=trendyol_boost',
    appDeepLinkPrefix: 'trendyol://?Page=Product&ContentId=',
  },
}
