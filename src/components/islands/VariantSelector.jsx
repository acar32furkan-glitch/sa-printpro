import { useMemo, useState } from 'react'
import { ShoppingBag, MessageCircle } from 'lucide-react'
import { siteConfig } from '../../config/site.js'
import shopierMap from '../../config/shopier.json'

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
 * Builds a human readable attribute summary, e.g. "Renk: Beyaz, Boyut: 16cm".
 * @param {object} attributes
 * @returns {string}
 */
function formatAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') {
    return ''
  }
  return Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

/**
 * Resolves the Shopier product URL for a given variant barcode.
 * @param {object} map
 * @param {string} barcode
 * @returns {string|null}
 */
function resolveShopierUrl(map, barcode) {
  if (!map || typeof map !== 'object' || !barcode) {
    return null
  }
  const value = map[barcode]
  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }
  if (value && typeof value === 'object' && typeof value.url === 'string') {
    return value.url
  }
  return null
}

/**
 * Interactive variant selector: variant buttons, reactive pricing/stock and a
 * dual-channel purchase CTA (Shopier primary, WhatsApp fallback).
 *
 * @param {object} props
 * @param {object} props.product
 * @param {object} [props.shopier]
 */
export default function VariantSelector({ product, shopier }) {
  const variants = useMemo(
    () => (Array.isArray(product?.variants) ? product.variants : []),
    [product]
  )

  const shopierData = shopier && typeof shopier === 'object' ? shopier : shopierMap

  const [selectedIndex, setSelectedIndex] = useState(0)

  // Clamp during render so a changed product can never select a stale index.
  const resolvedIndex =
    selectedIndex >= 0 && selectedIndex < variants.length ? selectedIndex : 0

  const selectedVariant = variants[resolvedIndex] || variants[0] || null

  const rawPrice = selectedVariant ? Number(selectedVariant.price) : 0
  const rawSalePrice = selectedVariant ? Number(selectedVariant.salePrice) : 0
  const stock = selectedVariant ? Number(selectedVariant.stock) : 0

  // Trendyol satışta olmayan ürünlerde `salePrice: 0` döner; bu durumda
  // liste fiyatı gösterilir (aksi halde "0 TL" görünür).
  const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0
  const salePrice =
    Number.isFinite(rawSalePrice) && rawSalePrice > 0 ? rawSalePrice : price

  const hasDiscount = price > 0 && salePrice > 0 && salePrice < price
  const discountRate = hasDiscount
    ? Math.round(((price - salePrice) / price) * 100)
    : 0
  const inStock = stock > 0

  const barcode = selectedVariant?.barcode || ''
  const sku = selectedVariant?.sku || ''
  const shopierUrl = resolveShopierUrl(shopierData, barcode)

  const whatsappNumber = String(siteConfig.contact.whatsapp || '').replace(/\D/g, '')
  const attributeSummary = formatAttributes(selectedVariant?.attributes)
  const whatsappMessage = `Merhaba, ${product?.name || ''} (${
    attributeSummary || 'Varsayılan'
  } - Barkod: ${barcode}) siparişi vermek istiyorum.`
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    whatsappMessage
  )}`

  return (
    <div className="flex flex-col gap-6">
      {/* Price block. */}
      <div className="flex flex-col gap-2 border-y border-zinc-200 py-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatPrice(hasDiscount ? salePrice : price)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-lg text-zinc-400 line-through dark:text-zinc-500">
                {formatPrice(price)}
              </span>
              <span className="inline-flex items-center rounded-md bg-zinc-900 px-2 py-1 text-2xs font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
                %{discountRate} İndirim
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          KDV Dahil · Barkod {barcode || '—'}
          {sku ? ` · SKU ${sku}` : ''}
        </span>
      </div>

      {variants.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Varyant Seçimi
          </span>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Ürün varyantları"
          >
            {variants.map((variant, index) => {
              const isSelected = index === resolvedIndex
              const variantStock = Number(variant.stock)
              const variantInStock = variantStock > 0
              const label =
                formatAttributes(variant.attributes) ||
                variant.sku ||
                `Varyant ${index + 1}`

              return (
                <button
                  key={variant.barcode || variant.sku || index}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  disabled={!variantInStock}
                  aria-pressed={isSelected}
                  className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-all duration-200 ease-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900 ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500'
                  }`}
                >
                  <span className={!variantInStock ? 'line-through' : undefined}>
                    {label}
                  </span>
                  {!variantInStock && (
                    <span className="ml-2 font-normal no-underline">(Tükendi)</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Stock status row. */}
      <div className="flex items-center gap-2 text-xs">
        {inStock ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Stokta ({stock} adet)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-500 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            Tükendi
          </span>
        )}
      </div>

      {/* Dual-channel purchase CTA. */}
      <div className="flex flex-col gap-3">
        {shopierUrl ? (
          <a
            href={shopierUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            Shopier ile Güvenli Al
          </a>
        ) : (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp w-full"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            WhatsApp ile Sipariş Ver
          </a>
        )}

        {shopierUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp ile Sipariş Ver
          </a>
        )}

        <p className="flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          Güvenli ödeme · 2 günde kargoda
        </p>
      </div>
    </div>
  )
}
