import { useCallback, useEffect, useRef, useState } from 'react'
import { Share2, MessageCircle, Check } from 'lucide-react'

/**
 * Builds the absolute product URL from the current location, falling back to
 * the canonical path when rendered outside a browser context.
 * @param {string} slug
 * @returns {string}
 */
function resolveUrl(slug) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/urun/${slug}`
  }
  return `https://saprintpro.com/urun/${slug}`
}

/**
 * Product share widget for motorcycle communities.
 *
 * - Uses the native Web Share API (`navigator.share`) when available.
 * - Falls back to copying the link to the clipboard with a "Bağlantı
 *   Kopyalandı!" confirmation.
 * - Always exposes a direct "WhatsApp'ta Paylaş" button.
 *
 * @param {object} props
 * @param {string} props.slug
 * @param {string} props.title
 */
export default function ProductShare({ slug, title }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    },
    []
  )

  const showCopied = useCallback(() => {
    setCopied(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleShare = useCallback(async () => {
    const url = resolveUrl(slug)
    const shareData = { title, text: `${title} — SA Printpro`, url }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData)
        return
      } catch (error) {
        // Kullanıcı paylaşımı iptal ettiyse sessizce çık.
        if (error && error.name === 'AbortError') {
          return
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      showCopied()
    } catch {
      // Pano erişimi yoksa sessizce yut.
    }
  }, [slug, title, showCopied])

  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `${title} — SA Printpro ${resolveUrl(slug)}`
  )}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Share2 className="h-4 w-4" aria-hidden="true" />
        )}
        {copied ? 'Bağlantı Kopyalandı!' : 'Paylaş'}
      </button>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2 text-sm font-medium text-[#128C7E] transition-colors hover:border-[#25D366] hover:bg-[#25D366]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 dark:text-[#25D366] dark:focus-visible:ring-offset-zinc-900"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {'WhatsApp\u2019ta Payla\u015f'}
      </a>
    </div>
  )
}
