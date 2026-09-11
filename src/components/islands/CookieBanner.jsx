import { useCallback, useState, useSyncExternalStore } from 'react'
import { Cookie } from 'lucide-react'
import { getConsent, setConsent } from '../../lib/consent.js'

/**
 * Consent değişikliklerine abone olur. `setConsent` çağrıldığında tüm
 * aboneler bilgilendirilir; böylece banner aynı sekmede anında gizlenir.
 */
const consentListeners = new Set()

/**
 * Abonelik kaydı. `useSyncExternalStore` uyumludur.
 * @param {() => void} listener
 * @returns {() => void}
 */
function subscribeConsent(listener) {
  consentListeners.add(listener)
  return () => {
    consentListeners.delete(listener)
  }
}

/**
 * Tüm abonelere consent değişikliğini bildirir.
 */
function emitConsentChange() {
  for (const listener of consentListeners) {
    try {
      listener()
    } catch {
      // Bir abone hata verirse diğerlerini etkilemesin.
    }
  }
}

/**
 * Floating quality-control info card (bottom-right) for KVKK cookie consent.
 * Uses the shared consent module and never renders when a decision has already
 * been stored (SSR-safe hydration).
 */
export default function CookieBanner() {
  // `useSyncExternalStore` sunucuda `null` (banner gizli), istemcide ise
  // localStorage'daki gerçek değeri döndürür. Bu sayede:
  //  - SSR ile ilk istemci render'ı BİREBİR aynıdır (hydration uyuşmazlığı yok),
  //  - effect içinde setState çağrılmaz (cascading render yok),
  //  - tercih kaydedilmişse banner hiç görünmez.
  const consent = useSyncExternalStore(
    subscribeConsent,
    () => getConsent(),
    () => null
  )

  // Kullanıcı bu oturumda bir karar verdi mi? (Banner'ı anında gizlemek için.)
  const [decided, setDecided] = useState(false)

  const handleAccept = useCallback(() => {
    setConsent(true)
    setDecided(true)
    emitConsentChange()
  }, [])

  const handleReject = useCallback(() => {
    setConsent(false)
    setDecided(true)
    emitConsentChange()
  }, [])

  // Karar verilmişse (bu oturumda veya daha önce) banner gösterilmez.
  if (decided || consent !== null) {
    return null
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Çerez bildirimi"
      className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm animate-fade-in-up rounded-lg border border-zinc-300 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* Header strip. */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
          Çerez Bildirimi
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Deneyiminizi iyileştirmek ve site trafiğini analiz etmek için çerezler
          kullanıyoruz. Detaylar için{' '}
          <a
            href="/cerez-politikasi"
            className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
          >
            çerez politikamızı
          </a>{' '}
          inceleyebilirsiniz.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReject}
            className="btn-secondary flex-1 px-4 py-2 text-xs"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="btn-primary flex-1 px-4 py-2 text-xs"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  )
}
