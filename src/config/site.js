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
    returns: '14 Gün İade',
    freeShipping: '350 TL Üzeri Kargo Bedava',
    freeShippingThreshold: 350,
  },
  // Kurumsal/şeffaflık bilgileri. TEK MERKEZİ KAYNAK: yasal sayfalar (mesafeli
  // satış, KVKK, iade) ve footer bu bloğu referans alır; elle placeholder
  // yazılmaz. Boş/placeholder alanlar `scripts/check-company-info.mjs` ile
  // build öncesi uyarı olarak raporlanır (build'i kırmaz).
  //
  // ⚠️ Bu alanlar doldurulmadan gerçek fatura kesilemez; ilk gerçek satıştan
  // önce tamamlanmalıdır. Değerler bilinmiyorsa placeholder bırakılır —
  // varsayım/örnek veri üretilmez.
  company: {
    legalName: '[[TICARI_UNVAN]]',
    address: '[[ACIK_ADRES]]',
    phone: '+90 554 299 30 58',
    email: 'info@saprintpro.com',
    taxOffice: '[[VERGI_DAIRESI]]',
    taxNumber: '[[VKN]]',
    mersis: '[[MERSIS_NO]]',
    // İade gönderim adresi ve alıcı (iade sayfası bu alanları kullanır).
    returnAddress: '[[IADE_ADRESI]]',
    returnRecipient: '[[IADE_ALICI]]',
  },
  ga4Id: 'G-HK6Q53CMG1',
  searchConsoleVerification: 'google419bc019c17c40b5',
  merchantCenterVerification: 'qStkrwJrl6uF-imyYuA0nvG2eFIdtyF3I8CSr_jVYmM',
  showHowToApply: true,
  features: {
    // false yapılırsa sitedeki tüm Trendyol butonları ve rozetleri gizlenir,
    // doğrudan satış (Shopier/WhatsApp) birincil olur.
    enableTrendyolCta: false,
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
    sellerId: '855597',
    storeUrl: 'https://www.trendyol.com/magaza/sa-printpro-m-855597?sst=0',
    utmParams:
      '?utm_source=saprintpro_web&utm_medium=showcase&utm_campaign=trendyol_boost',
    appDeepLinkPrefix: 'trendyol://?Page=Product&ContentId=',
  },
}
