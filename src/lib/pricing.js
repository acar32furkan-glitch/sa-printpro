/**
 * FAZ A — Tek fiyat doğrusu (single source of truth for money).
 *
 * Bu modül hem build (Astro SSR) hem de tarayıcı (React island / sepet)
 * tarafında çalışır; hiçbir DOM veya Node API'sine dokunmaz.
 *
 * Kural: fiyat ile ilgili HİÇBİR hesaplama bileşenlerde veya script'lerde
 * tekrar yazılmaz. Kart, ürün sayfası, sepet/sipariş listesi, arama indeksi,
 * Merchant feed, JSON-LD ve GA4 olayları fiyatı buradan okur.
 */

import { PRICING_VERSION, pricingConfig } from '../config/pricing.js'

/**
 * Bir değeri güvenli biçimde sonlu sayıya çevirir.
 * @param {unknown} value
 * @returns {number|null}
 */
function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

/**
 * Sayıyı yapılandırılmış yuvarlama biçimine göre yuvarlar.
 * `five` → son hane 5; `nearest` → en yakın tam sayı.
 * @param {number} value
 * @returns {number}
 */
export function roundPrice(value) {
  const numeric = toFiniteNumber(value)
  if (numeric === null || numeric <= 0) {
    return 0
  }

  if (pricingConfig.roundingMode !== 'five') {
    return Math.max(pricingConfig.minPrice, Math.round(numeric))
  }

  return Math.max(pricingConfig.minPrice, Math.round((numeric - 5) / 10) * 10 + 5)
}

/**
 * Liste fiyatına `priceMultiplier` uygular.
 *
 * Ham Trendyol fiyatı (basePrice) ile birlikte kullanılır: `price` ve
 * `salePrice` alanları senkron sırasında bu fonksiyondan geçirilir.
 * @param {unknown} value
 * @returns {number}
 */
export function applyPriceMultiplier(value) {
  const numeric = toFiniteNumber(value)
  if (numeric === null || numeric <= 0) {
    return 0
  }

  return Math.round(numeric * pricingConfig.priceMultiplier)
}

/**
 * Varyantın liste fiyatı (`price`).
 * @param {object|null|undefined} variant
 * @returns {number|null}
 */
export function getListPrice(variant) {
  const numeric = toFiniteNumber(variant?.price)
  return numeric !== null && numeric > 0 ? numeric : null
}

/**
 * Varyantın efektif satış fiyatı: pozitif `salePrice`, yoksa `price`.
 *
 * Trendyol listelenmeyen ürünlerde `salePrice: 0` döndürür; 0 gerçek fiyat
 * kabul edilmez.
 * @param {object|null|undefined} variant
 * @returns {number|null}
 */
export function getEffectivePrice(variant) {
  const sale = toFiniteNumber(variant?.salePrice)
  if (sale !== null && sale > 0) {
    return sale
  }

  return getListPrice(variant)
}

/**
 * Web'e özel doğrudan satış fiyatı (liste fiyatından `directDiscountRate` düşük).
 * @param {unknown} price
 * @returns {number}
 */
export function getDirectPrice(price) {
  const numeric = toFiniteNumber(price)
  if (numeric === null || numeric <= 0) {
    return 0
  }

  const rate = Number(pricingConfig.directDiscountRate)
  const safeRate = Number.isFinite(rate) && rate > 0 && rate < 1 ? rate : 0

  return roundPrice(numeric * (1 - safeRate))
}

/**
 * İki fiyat arasındaki indirim oranını (0..100) tam sayı olarak döndürür.
 * @param {unknown} listPrice
 * @param {unknown} finalPrice
 * @returns {number}
 */
export function getDiscountPercent(listPrice, finalPrice) {
  const base = toFiniteNumber(listPrice)
  const final = toFiniteNumber(finalPrice)

  if (base === null || final === null || base <= 0 || final <= 0 || final >= base) {
    return 0
  }

  return Math.round(((base - final) / base) * 100)
}

/**
 * Varyantın Trendyol kaynaklı indirim oranı (`price` → `salePrice`).
 * @param {object|null|undefined} variant
 * @returns {number}
 */
export function getVariantDiscountPercent(variant) {
  return getDiscountPercent(getListPrice(variant), getEffectivePrice(variant))
}

/**
 * Web'e özel indirimin GERÇEK oranı (liste fiyatı → doğrudan satış fiyatı).
 *
 * Rozet metni bu değeri gösterir; config'teki sabit `directDiscountRate`
 * yuvarlama sonrası gerçek oranla ±%2 sapabildiği için doğrudan yazılmaz.
 * @param {unknown} listPrice
 * @returns {number}
 */
export function getDirectDiscountPercent(listPrice) {
  return getDiscountPercent(listPrice, getDirectPrice(listPrice))
}

/**
 * Ara toplam için kargo ücretini döndürür (ücretsiz kargo eşiği dahil).
 * @param {unknown} subtotal
 * @returns {number}
 */
export function getShippingFee(subtotal) {
  const numeric = toFiniteNumber(subtotal) ?? 0
  if (numeric <= 0) {
    return 0
  }

  return numeric >= pricingConfig.freeShippingThreshold ? 0 : pricingConfig.shippingFee
}

/**
 * Ücretsiz kargoya kalan tutarı döndürür (eşik aşıldıysa 0).
 * @param {unknown} subtotal
 * @returns {number}
 */
export function getFreeShippingRemaining(subtotal) {
  const numeric = toFiniteNumber(subtotal) ?? 0
  if (numeric <= 0) {
    return pricingConfig.freeShippingThreshold
  }

  return Math.max(0, Math.round((pricingConfig.freeShippingThreshold - numeric) * 100) / 100)
}

/**
 * Sipariş/sepet satırlarından toplamları üretir.
 *
 * Satır: `{ price, qty }`. `price` birim fiyat (doğrudan satış fiyatı) kabul
 * edilir; çağıran taraf katalogdan doğrulanmış fiyatı geçirmelidir.
 * @param {Array<{price: number, qty: number}>} items
 * @returns {{subtotal: number, shippingFee: number, total: number, itemCount: number,
 *   freeShippingRemaining: number, freeShippingQualified: boolean,
 *   freeShippingThreshold: number}}
 */
export function getTotals(items) {
  const lines = Array.isArray(items) ? items : []

  let subtotal = 0
  let itemCount = 0

  for (const item of lines) {
    const price = toFiniteNumber(item?.price) ?? 0
    const qty = Math.max(0, Math.floor(toFiniteNumber(item?.qty) ?? 0))
    if (price <= 0 || qty <= 0) {
      continue
    }

    subtotal += price * qty
    itemCount += qty
  }

  subtotal = Math.round(subtotal * 100) / 100
  const shippingFee = getShippingFee(subtotal)
  const total = Math.round((subtotal + shippingFee) * 100) / 100

  return {
    subtotal,
    shippingFee,
    total,
    itemCount,
    freeShippingRemaining: getFreeShippingRemaining(subtotal),
    freeShippingQualified: shippingFee === 0 && subtotal > 0,
    freeShippingThreshold: pricingConfig.freeShippingThreshold,
  }
}

/**
 * Fiyatı Türkçe biçimde (binlik ayraç + TL) döndürür.
 * Projedeki TEK fiyat biçimlendiricisidir.
 * @param {unknown} value
 * @returns {string}
 */
export function formatPrice(value) {
  const numeric = toFiniteNumber(value)
  if (numeric === null) {
    return ''
  }

  return `${numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} TL`
}

/**
 * Varyantın stok değerini görüntüleme sınırına göre normalize eder.
 * Trendyol'un 19936/19999 gibi değerleri "bol stok" kabul edilir.
 * @param {unknown} stock
 * @returns {number}
 */
export function normalizeStock(stock) {
  const numeric = toFiniteNumber(stock)
  if (numeric === null || numeric <= 0) {
    return 0
  }

  return Math.min(Math.floor(numeric), pricingConfig.maxDisplayStock)
}

/**
 * DATA-04: Stok etiketi. Trendyol'un 19999 gibi değerleri "999+ adet" olarak
 * gösterilir; müşteriye inandırıcı olmayan dev stok sayıları basılmaz.
 * @param {unknown} stock
 * @returns {string}
 */
export function getStockLabel(stock) {
  const numeric = toFiniteNumber(stock)
  if (numeric === null || numeric <= 0) {
    return 'Tükendi'
  }

  if (numeric > pricingConfig.maxDisplayStock) {
    return `${pricingConfig.maxDisplayStock}+ adet`
  }

  return `${Math.floor(numeric)} adet`
}

/** Testler ve doğrulama script'leri için ham yapılandırma + sürüm damgası. */
export { pricingConfig, PRICING_VERSION }
