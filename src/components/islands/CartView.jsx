import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Minus, Plus, ShoppingBag, Trash2, MessageCircle } from 'lucide-react'
import { siteConfig } from '../../config/site.js'
import shopierMap from '../../config/shopier.json'
import {
  subscribe,
  getItems,
  updateQty,
  removeItem,
  clear,
  getItemKey,
  formatPrice,
} from '../../lib/cart.js'

/**
 * Sunucuda boş dizi, istemcide localStorage içeriğini döndürür.
 * `useSyncExternalStore` sayesinde hidrasyon uyuşmazlığı oluşmaz.
 * @returns {Array<object>}
 */
function useCartItems() {
  return useSyncExternalStore(
    subscribe,
    () => getItems(),
    () => []
  )
}

/**
 * Bir varyant barkodu için Shopier ürün URL'ini çözer.
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
 * Sepetin tamamını özetleyen Türkçe WhatsApp mesajı üretir.
 * @param {Array<object>} items
 * @param {number} total
 * @returns {string}
 */
function buildWhatsappMessage(items, total) {
  const lines = items.map((item, index) => {
    const variant = item.variant ? ` (${item.variant})` : ''
    return `${index + 1}. ${item.name}${variant} x${item.qty} = ${formatPrice(
      item.price * item.qty
    )}`
  })

  return [
    'Merhaba, aşağıdaki ürünler için sipariş vermek istiyorum:',
    '',
    ...lines,
    '',
    `Toplam: ${formatPrice(total)}`,
  ].join('\n')
}

/**
 * Sepet sayfası istemci bileşeni: ürün listesi, adet artır/azalt, sil,
 * toplam tutar ve checkout (Shopier / WhatsApp) akışı.
 */
export default function CartView() {
  const items = useCartItems()

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.qty, 0),
    [items]
  )

  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items]
  )

  // Tüm satırların Shopier linki varsa Shopier'e yönlendirilebilir.
  const allHaveShopier = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => Boolean(resolveShopierUrl(shopierMap, item.barcode))),
    [items]
  )

  const whatsappNumber = String(siteConfig.contact.whatsapp || '').replace(/\D/g, '')

  const whatsappUrl = useMemo(() => {
    const message = buildWhatsappMessage(items, total)
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
  }, [items, total, whatsappNumber])

  /**
   * Checkout: GA4 `begin_checkout` fırlatır. Tüm ürünlerin Shopier linki
   * varsa Shopier'e, aksi halde WhatsApp'a yönlendirir.
   */
  const handleCheckout = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'begin_checkout', {
        currency: 'TRY',
        value: total,
        items: items.map((item) => ({
          item_id: item.barcode || item.id,
          item_name: item.name,
          item_variant: item.variant,
          price: item.price,
          quantity: item.qty,
        })),
      })
    }

    if (allHaveShopier) {
      // Shopier OAuth onayı gelene kadar bu yol hazırdır; onay sonrası çalışır.
      const firstUrl = resolveShopierUrl(shopierMap, items[0]?.barcode)
      if (firstUrl && typeof window !== 'undefined') {
        window.open(firstUrl, '_blank', 'noopener,noreferrer')
      }
      return
    }

    if (typeof window !== 'undefined') {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    }
  }, [items, total, allHaveShopier, whatsappUrl])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <ShoppingBag
          className="h-10 w-10 text-zinc-300 dark:text-zinc-600"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Sepetiniz boş
        </h2>
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Beğendiğiniz reflektif sticker ve güvenlik etiketi ürünlerini sepete
          ekleyerek tek seferde sipariş verebilirsiniz.
        </p>
        <a
          href="/urunler"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ürünleri Keşfet
        </a>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Ürün listesi */}
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const key = getItemKey(item)
          return (
            <li
              key={key}
              className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <a
                href={`/urun/${item.slug}`}
                className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xs text-zinc-400">
                    Görsel yok
                  </span>
                )}
              </a>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <a
                  href={`/urun/${item.slug}`}
                  className="line-clamp-2 text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {item.name}
                </a>
                {item.variant && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.variant}
                  </span>
                )}
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatPrice(item.price)}
                </span>

                <div className="mt-auto flex items-center gap-3">
                  <div className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={() => updateQty(key, item.qty - 1)}
                      aria-label={`${item.name} adedini azalt`}
                      className="inline-flex h-8 w-8 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(key, item.qty + 1)}
                      aria-label={`${item.name} adedini artır`}
                      className="inline-flex h-8 w-8 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(key)}
                    aria-label={`${item.name} ürününü sepetten çıkar`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Sil
                  </button>
                </div>
              </div>

              <div className="hidden shrink-0 text-right text-sm font-semibold text-zinc-900 sm:block dark:text-zinc-100">
                {formatPrice(item.price * item.qty)}
              </div>
            </li>
          )
        })}

        <li>
          <button
            type="button"
            onClick={() => clear()}
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
          >
            Sepeti Boşalt
          </button>
        </li>
      </ul>

      {/* Özet + checkout */}
      <aside className="flex h-fit flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Sipariş Özeti
        </h2>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Ürün adedi</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{count}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <dt className="font-medium text-zinc-900 dark:text-zinc-100">Toplam</dt>
            <dd className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatPrice(total)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={handleCheckout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
        >
          {allHaveShopier ? (
            <>
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              Siparişi Tamamla
            </>
          ) : (
            <>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp ile Sipariş Ver
            </>
          )}
        </button>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          {allHaveShopier
            ? 'Shopier güvenli ödeme sayfasına yönlendirileceksiniz.'
            : 'Sipariş detaylarınız WhatsApp üzerinden iletilir.'}
        </p>
      </aside>
    </div>
  )
}
