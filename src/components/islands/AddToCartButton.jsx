import { useCallback, useState } from 'react'
import { Check, ShoppingCart } from 'lucide-react'
import { addItem } from '../../lib/cart.js'

/**
 * GA4 `add_to_cart` olayını fırlatır (gtag guard'lı). Mevcut
 * `outbound_trendyol_click` deseniyle aynı yaklaşım.
 * @param {object} item
 */
function trackAddToCart(item) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'add_to_cart', {
      currency: 'TRY',
      value: Number(item.price) || 0,
      items: [
        {
          item_id: item.barcode || item.id,
          item_name: item.name,
          item_variant: item.variant,
          price: Number(item.price) || 0,
          quantity: Number(item.qty) || 1,
        },
      ],
    })
  }
}

/**
 * "Sepete Ekle" butonu. Mevcut WhatsApp/Shopier butonlarının YANINA eklenir;
 * onları değiştirmez. Sepete ekleme başarılı olduğunda kısa süreliğine
 * "Eklendi" geri bildirimi gösterir.
 *
 * @param {object} props
 * @param {object} props.item Sepet öğesi (id, name, slug, variant, barcode, price, image)
 * @param {string} [props.className] Ek sınıflar.
 * @param {string} [props.label] Buton metni.
 * @param {boolean} [props.disabled] Stok yoksa devre dışı.
 */
export default function AddToCartButton({
  item,
  className = '',
  label = 'Sepete Ekle',
  disabled = false,
}) {
  const [added, setAdded] = useState(false)

  const handleClick = useCallback(() => {
    if (disabled || !item) {
      return
    }

    addItem({ ...item, qty: Number(item.qty) || 1 })
    trackAddToCart({ ...item, qty: Number(item.qty) || 1 })

    setAdded(true)
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setAdded(false), 1800)
    }
  }, [item, disabled])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={disabled ? 'Stokta yok' : `${item?.name || 'Ürün'} sepete ekle`}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-900 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-all duration-200 ease-smooth hover:bg-zinc-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900 ${className}`}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Sepete Eklendi
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {label}
        </>
      )}
    </button>
  )
}
