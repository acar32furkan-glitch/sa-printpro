/**
 * FAZ A — Fiyat yapılandırması (TEK MERKEZİ KAYNAK).
 *
 * Bu dosya SAF VERİ içerir; hiçbir modülü import etmez. Böylece hem build
 * (Node/SSR) hem de tarayıcı (client island) tarafında güvenle kullanılabilir.
 *
 * NEDEN BURADA: Fiyat çarpanı ve indirim oranı daha önce `site.js` içindeki
 * `features` bloğunda ve `products.js` içindeki formüllerde dağınık duruyordu.
 * Aynı ürünün kart / feed / JSON-LD / sepet / GA4 arasında farklı fiyat
 * göstermesini engellemek için tüm fiyat kararları buradan beslenir.
 *
 * ⚠️ `priceMultiplier` DEĞİŞTİRİLDİĞİNDE `pricingVersion` DE GÜNCELLENMELİDİR.
 * `scripts/apply-price-multiplier.mjs` idempotency kontrolünü bu sürüm
 * damgasına göre yapar; aksi halde çarpan iki kez uygulanır (%20 → %44).
 */
export const pricingConfig = {
  /** Para birimi (yalnız gösterim/feed için). */
  currency: 'TRY',

  /**
   * Liste fiyatına uygulanan çarpan.
   * 1.2 → tüm ürün fiyatları %20 artırılmış kabul edilir.
   */
  priceMultiplier: 1.2,

  /**
   * Fiyat verisi sürüm damgası. `apply-price-multiplier.mjs` bu değeri
   * `products.json` içine yazar; aynı sürümde ikinci kez çalışmayı reddeder.
   */
  pricingVersion: '2026-11-16-v1',

  /**
   * Web'e özel doğrudan satış indirimi (0.20 = %20).
   *
   * Liste fiyatı ile ürünün sitede gösterilen satış fiyatı arasındaki farktır;
   * bu oran SABİT tutulur, böylece `priceMultiplier` değişse bile müşterinin
   * gördüğü indirim yüzdesi korunur.
   */
  directDiscountRate: 0.2,

  /**
   * Doğrudan satış fiyatının yuvarlama biçimi.
   * `five` → son hane her zaman 5 (ör. 191,2 → 195). Onaylanan politikadır.
   * `nearest` → en yakın tam sayı (indirim oranını birebir korur).
   */
  roundingMode: 'five',

  /** Doğrudan satış fiyatı için alt sınır (TL). */
  minPrice: 5,

  /** Ücretsiz kargo eşiği (TL). Fiyat artışıyla birlikte 350 → 420. */
  freeShippingThreshold: 420,

  /** Eşik altındaki siparişlerde uygulanan kargo ücreti (TL). */
  shippingFee: 49.9,

  /** Fiyatların KDV dahil olup olmadığı (gösterim/sözleşme metinleri için). */
  vatIncluded: true,

  /** KDV oranı (0.20 = %20). Yalnız bilgilendirme/ayrıştırma içindir. */
  vatRate: 0.2,

  /**
   * Stok üst sınırı. Trendyol bazen 19999 gibi değerler döndürüyor; sepet ve
   * ürün sayfası bu sınırı aşan stokları "sınırsız/bol stok" kabul eder.
   */
  maxDisplayStock: 999,
}

/** Kısa erişim için sürüm sabiti (script'ler ve doğrulama için). */
export const PRICING_VERSION = pricingConfig.pricingVersion
