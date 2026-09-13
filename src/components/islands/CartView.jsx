import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Minus, Plus, ShoppingBag, Trash2, MessageCircle } from 'lucide-react'
import { siteConfig } from '../../config/site.js'
import shopierMap from '../../config/shopier.json'
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  updateQty,
  removeItem,
  clear,
  getItemKey,
  formatPrice,
} from '../../lib/cart.js'

/**
 * Sunucuda boş dizi, istemcide localStorage içeriğini döndürür.
 *
 * KRİTİK: `getSnapshot` ve `getServerSnapshot` modül seviyesinde KARARLI
 * referanslar döndürür (bkz. `src/lib/cart.js`). Inline `() => getItems()`
 * kullanımı her render'da yeni dizi üretip React'in sonsuz döngüye girmesine
 * ("The result of getSnapshot should be cached") yol açıyordu.
 * @returns {Array<object>}
 */
function useCartItems() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
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
 * GA4 `view_cart` olayını fırlatır (gtag guard'lı). GA4 yüklü değilse
 * sessizce atlanır; mevcut `add_to_cart` / `begin_checkout` deseniyle aynı.
 * @param {Array<object>} items
 * @param {number} total
 */
function trackViewCart(items, total) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'view_cart', {
      currency: 'TRY',
      value: total,
      items: items.map((item) => ({
        item_id: item.barcode || item.id,
        item_name: item.name,
        item_variant: item.variant,
        price: Number(item.price) || 0,
        quantity: Number(item.qty) || 1,
      })),
    })
  }
}

/**
 * Sepet sayfası istemci bileşeni: ürün listesi, adet artır/azalt, sil,
 * toplam tutar ve checkout (Shopier / WhatsApp) akışı.
 */
export default function CartView() {
  const items = useCartItems()

  // Hukuki zorunluluk: Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu
  // onayı işaretlenmeden sipariş tamamlanamaz.
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsWarning, setShowTermsWarning] = useState(false)
  // Ödeme sağlayıcısı hazır olmadığında veya bir hata oluştuğunda gösterilen
  // nazik uyarı. Sepet bu durumda ASLA temizlenmez.
  const [checkoutNotice, setCheckoutNotice] = useState(null)

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.qty, 0),
    [items]
  )

  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items]
  )

  // Shopier yönlendirmesi YALNIZCA tek satırlık sepetlerde güvenlidir: Shopier
  // ürün URL'i tek bir ürünü temsil eder ve sepetin geri kalanını sessizce
  // düşürür. Birden fazla satır varsa WhatsApp akışına düşülür; böylece hiçbir
  // ürün kaybolmaz.
  const allHaveShopier = useMemo(
    () =>
      items.length === 1 &&
      Boolean(resolveShopierUrl(shopierMap, items[0]?.barcode)),
    [items]
  )

  // GA4 `view_cart`: sepet sayfası açıldığında yalnızca BİR kez fırlatılır.
  // Sepet boşsa veya GA4 yüklü değilse sessizce atlanır.
  const viewCartTracked = useRef(false)
  useEffect(() => {
    if (viewCartTracked.current || items.length === 0) {
      return
    }
    viewCartTracked.current = true
    trackViewCart(items, total)
  }, [items, total])

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
    // Onay kutusu işaretlenmeden checkout başlatılamaz.
    if (!termsAccepted) {
      setShowTermsWarning(true)
      return
    }

    // Yeni denemede önceki uyarıyı temizle.
    setCheckoutNotice(null)

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

    // Ödeme sağlayıcısı (Shopier) hazır olduğunda: ödeme sayfasına yönlendir.
    // Dönüşte kullanıcı /siparis-basarili veya /siparis-basarisiz sayfasına
    // düşer. Sepet, başarılı ödeme onayı gelene kadar TEMİZLENMEZ.
    if (allHaveShopier) {
      try {
        const firstUrl = resolveShopierUrl(shopierMap, items[0]?.barcode)
        if (firstUrl && typeof window !== 'undefined') {
          window.location.href = firstUrl
          return
        }
        // Shopier linki çözülemedi: kullanıcıyı hata sayfasına yönlendir.
        if (typeof window !== 'undefined') {
          window.location.href = '/siparis-basarisiz/?reason=shopier-link'
        }
      } catch {
        setCheckoutNotice(
          'Ödeme sayfasına yönlendirilirken bir sorun oluştu. Sepetiniz korunuyor; lütfen tekrar deneyin veya WhatsApp ile sipariş verin.'
        )
      }
      return
    }

    // Ödeme sağlayıcısı hazır değilse WhatsApp akışına düş.
    if (typeof window !== 'undefined') {
      try {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      } catch {
        setCheckoutNotice(
          'WhatsApp yönlendirmesi açılamadı. Sepetiniz korunuyor; lütfen tekrar deneyin.'
        )
      }
    }
  }, [items, total, allHaveShopier, whatsappUrl, termsAccepted])

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
          href="/urunler/"
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
                href={`/urun/${item.slug}/`}
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
                  href={`/urun/${item.slug}/`}
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

              <div className="shrink-0 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100">
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

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => {
              setTermsAccepted(event.target.checked)
              if (event.target.checked) {
                setShowTermsWarning(false)
              }
            }}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <span>
            <a
              href="/mesafeli-satis-sozlesmesi/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 underline underline-offset-2 hover:text-emerald-700 dark:text-zinc-100 dark:hover:text-emerald-400"
            >
              Mesafeli Satış Sözleşmesi
            </a>
            {'’ni ve Ön Bilgilendirme Formu’nu okudum, onaylıyorum.'}
          </span>
        </label>

        {showTermsWarning && !termsAccepted && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
          >
            Siparişi tamamlamak için lütfen sözleşme onayını işaretleyin.
          </p>
        )}

        {checkoutNotice && (
          <p
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          >
            {checkoutNotice}
          </p>
        )}

        <button
          type="button"
          onClick={handleCheckout}
          disabled={!termsAccepted}
          aria-disabled={!termsAccepted}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
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
