import { useSyncExternalStore } from 'react'
import { ShoppingCart } from 'lucide-react'
import { subscribe, getCount } from '../../lib/cart.js'

/**
 * Sunucu render'ında `0`, istemcide gerçek değeri döndürür. Bu sayede
 * hidrasyon uyuşmazlığı (hydration mismatch) yaşanmaz; rozet yalnızca
 * istemcide localStorage'dan okunur.
 *
 * `getCount` primitive (number) döndürdüğü için referans kararlılığı
 * sorunu yoktur; yine de fonksiyonlar modül seviyesinde tanımlanır.
 * @returns {number}
 */
function getCountSnapshot() {
  return getCount()
}

function getServerCountSnapshot() {
  return 0
}

function useCartCount() {
  return useSyncExternalStore(subscribe, getCountSnapshot, getServerCountSnapshot)
}

/**
 * Navbar sepet ikonu + adet rozeti. Tıklanınca `/sepet` sayfasına gider.
 * Adet 0 iken rozet gizlenir.
 */
export default function CartButton() {
  const count = useCartCount()

  return (
    <a
      href="/sepet"
      aria-label={
        count > 0 ? `Sepetim, ${count} ürün` : 'Sepetim, sepet boş'
      }
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition-all duration-200 ease-smooth hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {count > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-2xs font-bold text-white"
          aria-hidden="true"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </a>
  )
}
