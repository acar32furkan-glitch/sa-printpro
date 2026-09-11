import { useMemo, useState } from 'react'

/**
 * Product detail image gallery: a 4:5 primary frame with a thumbnail strip
 * below. Falls back to a neutral placeholder when no images exist.
 *
 * @param {object} props
 * @param {string[]} [props.images]
 * @param {string} [props.title]
 */
export default function Gallery({ images = [], title = '' }) {
  const safeImages = useMemo(
    () => (Array.isArray(images) ? images.filter(Boolean) : []),
    [images]
  )

  const [activeIndex, setActiveIndex] = useState(0)

  // Clamp the index during render instead of resetting it in an effect, so a
  // changed image list can never point past the end of the array.
  const resolvedIndex =
    activeIndex >= 0 && activeIndex < safeImages.length ? activeIndex : 0

  const activeImage = safeImages[resolvedIndex] || safeImages[0] || ''

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        {activeImage ? (
          <img
            key={activeImage}
            src={activeImage}
            alt={
              title
                ? `${title} - Motosiklet Reflektif Sticker SA Printpro`
                : 'Motosiklet Reflektif Sticker SA Printpro'
            }
            className="h-full w-full animate-fade-in object-cover"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-600">
            Görsel yok
          </div>
        )}
      </div>

      {safeImages.length > 1 && (
        <ul
          className="grid grid-cols-4 gap-2 sm:grid-cols-5"
          aria-label="Ürün görselleri"
        >
          {safeImages.map((image, index) => {
            const isActive = index === resolvedIndex
            return (
              <li key={`${image}-${index}`}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`${index + 1}. görseli göster`}
                  aria-current={isActive}
                  className={`block aspect-square w-full overflow-hidden rounded-lg border bg-zinc-100 transition-all duration-200 ease-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-900 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900 ${
                    isActive
                      ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100'
                      : 'border-zinc-200 opacity-60 hover:opacity-100 dark:border-zinc-800'
                  }`}
                >
                  <img
                    src={image}
                    alt={
                      title
                        ? `${title} - Motosiklet Reflektif Sticker SA Printpro`
                        : 'Motosiklet Reflektif Sticker SA Printpro'
                    }
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
