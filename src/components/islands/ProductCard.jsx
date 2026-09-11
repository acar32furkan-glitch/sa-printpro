import { siteConfig } from '../../config/site.js'
import { calculateDirectPrice, getProductPrimaryImage } from '../../lib/products.js'

/**
 * Formats a numeric price as a Turkish Lira string.
 * @param {number} value
 * @returns {string}
 */
function formatPrice(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return ''
  }
  return `${numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} TL`
}

/**
 * React product card used inside interactive islands (grids, related strips).
 * Mirrors the static `ProductCard.astro` markup so both render identically.
 *
 * @param {object} props
 * @param {object} props.product
 */
export default function ProductCard({ product }) {
  const variants = Array.isArray(product?.variants) ? product.variants : []

  /**
   * Effective selling price: prefer a positive `salePrice`, else `price`.
   * Trendyol returns `salePrice: 0` for non-listed items, which must not be
   * treated as a real price.
   */
  const effectivePrice = (variant) => {
    const sale = Number(variant?.salePrice)
    if (Number.isFinite(sale) && sale > 0) {
      return sale
    }
    const base = Number(variant?.price)
    return Number.isFinite(base) && base > 0 ? base : null
  }

  const pricedVariants = variants.filter((variant) => effectivePrice(variant) !== null)

  const cheapest = pricedVariants.reduce((min, variant) => {
    const value = effectivePrice(variant)
    if (min === null || value < min) {
      return value
    }
    return min
  }, null)

  const salePrice = cheapest ?? 0
  const hasPrice = cheapest !== null && cheapest > 0

  const basePrice = pricedVariants.reduce((max, variant) => {
    const value = Number(variant.price)
    if (!Number.isFinite(value) || value <= 0) {
      return max
    }
    return max === null || value > max ? value : max
  }, null)

  const hasDiscount =
    basePrice !== null && Number.isFinite(basePrice) && salePrice > 0 && salePrice < basePrice

  const discountRate = hasDiscount
    ? Math.round(((basePrice - salePrice) / basePrice) * 100)
    : 0

  // Web'e özel doğrudan satış fiyatı (son hanesi her zaman 5).
  const features = siteConfig.features || {}
  const enableDirectDiscount = features.enableDirectDiscount !== false
  const directDiscountPercent = Math.round((Number(features.directDiscountRate) || 0) * 100)
  const directPrice = enableDirectDiscount ? calculateDirectPrice(salePrice) : 0
  const showDirectPrice = enableDirectDiscount && hasPrice && directPrice > 0

  const totalStock = variants.reduce(
    (sum, variant) => sum + (Number(variant.stock) || 0),
    0
  )
  const inStock = totalStock > 0

  // FAZ 11: yerel (logo filigranlı) görsel varsa onu, yoksa CDN görselini kullan.
  const image = getProductPrimaryImage(product)

  return (
    <a
      href={`/urun/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lift dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
            Görsel yok
          </div>
        )}

        {hasDiscount && (
          <span className="absolute bottom-2 left-2 inline-flex items-center rounded-md bg-zinc-900 px-2 py-1 text-2xs font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
            %{discountRate} İndirim
          </span>
        )}

        {!hasPrice && (
          <span className="absolute bottom-2 left-2 inline-flex items-center rounded-md bg-amber-500 px-2 py-1 text-2xs font-semibold text-white">
            Fiyat Sorunuz
          </span>
        )}

        {!inStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-zinc-950/70">
            <span className="badge-out">Tükendi</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3
          className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100"
          title={product.name}
        >
          {product.name}
        </h3>

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {showDirectPrice ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatPrice(directPrice)}
                </span>
                <span className="inline-flex items-center rounded bg-emerald-600 px-1.5 py-0.5 text-2xs font-semibold text-white">
                  %{directDiscountPercent} İndirimli
                </span>
              </div>
              <span className="text-xs text-zinc-400 line-through dark:text-zinc-500">
                Trendyol: {formatPrice(salePrice)}
              </span>
            </>
          ) : (
            <div className="flex items-baseline gap-2">
              {hasPrice ? (
                <>
                  <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {formatPrice(salePrice)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-zinc-400 line-through dark:text-zinc-500">
                      {formatPrice(basePrice)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Fiyat Sorunuz
                </span>
              )}
            </div>
          )}

          <span className="flex items-center gap-1.5 text-xs">
            {inStock ? (
              <>
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                <span className="text-emerald-700 dark:text-emerald-400">
                  Stokta
                </span>
              </>
            ) : (
              <>
                <span
                  className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                  aria-hidden="true"
                />
                <span className="text-zinc-500 dark:text-zinc-400">Tükendi</span>
              </>
            )}
          </span>
        </div>
      </div>
    </a>
  )
}
