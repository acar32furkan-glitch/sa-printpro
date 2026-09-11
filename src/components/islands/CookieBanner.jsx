import { useState } from 'react'
import { Cookie } from 'lucide-react'
import { getConsent, setConsent } from '../../lib/consent.js'

/**
 * Floating quality-control info card (bottom-right) for KVKK cookie consent.
 * Uses the shared consent module and never renders when a decision has already
 * been stored (SSR-safe hydration).
 */
export default function CookieBanner() {
  // Lazy initializer: on the server `getConsent()` returns null, so the banner
  // is not rendered during SSR. On the client it reflects the stored decision
  // immediately, avoiding a setState-in-effect cascade.
  const [visible, setVisible] = useState(() => getConsent() === null)

  const handleAccept = () => {
    setConsent(true)
    setVisible(false)
  }

  const handleReject = () => {
    setConsent(false)
    setVisible(false)
  }

  if (!visible) {
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
          kullanıyoruz. Detaylar için gizlilik politikamızı inceleyebilirsiniz.
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
