export const siteConfig = {
  name: 'SA Printpro',
  domain: 'https://saprintpro.com',
  logoFile: 'logo.png',
  logoDarkFile: 'logo-dark.png',
  faviconFile: 'favicon.png',
  contact: {
    whatsapp: '905542993058',
    instagram: 'saprintpro',
    email: 'info@saprintpro.com',
  },
  badges: {
    shipping: '2 Günde Kargoda',
    returns: '15 Gün İade',
    freeShipping: '350 TL Üzeri Kargo Bedava',
    freeShippingThreshold: 350,
  },
  ga4Id: 'G-HK6Q53CMG1',
  searchConsoleVerification: 'google419bc019c17c40b5',
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
  // Programatik SEO: motor modeli bazlı uyumluluk rozetleri için anahtar
  // kelime listesi. `detectCompatibleModels` bu listeyi tarar.
  motorcycleModels: [
    // Honda
    { brand: 'Honda', model: 'PCX', keywords: ['pcx'] },
    { brand: 'Honda', model: 'Forza', keywords: ['forza'] },
    { brand: 'Honda', model: 'CBR', keywords: ['cbr'] },
    { brand: 'Honda', model: 'Activa', keywords: ['activa'] },
    { brand: 'Honda', model: 'Dio', keywords: ['dio'] },
    { brand: 'Honda', model: 'CB250R', keywords: ['cb250r', 'cb 250r'] },
    { brand: 'Honda', model: 'ADV', keywords: ['adv'] },
    // Yamaha
    { brand: 'Yamaha', model: 'R25', keywords: ['r25'] },
    { brand: 'Yamaha', model: 'MT-25', keywords: ['mt-25', 'mt25'] },
    { brand: 'Yamaha', model: 'MT-07', keywords: ['mt-07', 'mt07'] },
    { brand: 'Yamaha', model: 'MT-09', keywords: ['mt-09', 'mt09'] },
    { brand: 'Yamaha', model: 'NMAX', keywords: ['nmax'] },
    { brand: 'Yamaha', model: 'XMAX', keywords: ['xmax'] },
    { brand: 'Yamaha', model: 'Tracer', keywords: ['tracer'] },
    // CFMoto
    { brand: 'CFMoto', model: '250SR', keywords: ['250sr'] },
    { brand: 'CFMoto', model: '250NK', keywords: ['250nk'] },
    { brand: 'CFMoto', model: '450SR', keywords: ['450sr'] },
    { brand: 'CFMoto', model: 'NK250', keywords: ['nk250'] },
    // Bajaj
    { brand: 'Bajaj', model: 'Pulsar NS200', keywords: ['ns200', 'pulsar ns200'] },
    { brand: 'Bajaj', model: 'Pulsar RS200', keywords: ['rs200', 'pulsar rs200'] },
    { brand: 'Bajaj', model: 'Dominar 250', keywords: ['dominar 250', 'dominar250'] },
    { brand: 'Bajaj', model: 'Dominar 400', keywords: ['dominar 400', 'dominar400'] },
  ],
  trendyol: {
    sellerId: '907993',
    storeUrl: 'https://www.trendyol.com/magaza/sa-printpro-m-907993',
    utmParams:
      '?utm_source=saprintpro_web&utm_medium=showcase&utm_campaign=trendyol_boost',
    appDeepLinkPrefix: 'trendyol://?Page=Product&ContentId=',
  },
}
