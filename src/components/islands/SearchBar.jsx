import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import productsData from '../../data/products.json'
import { searchProducts } from '../../lib/products.js'

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
 * Returns the effective display price for a product (lowest sale price).
 * @param {object} product
 * @returns {number}
 */
function displayPrice(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  if (variants.length === 0) {
    return 0
  }
  return (
    variants.reduce((min, variant) => {
      const value = Number(variant.salePrice ?? variant.price)
      if (!Number.isFinite(value)) {
        return min
      }
      return min === null || value < min ? value : min
    }, null) ?? 0
  )
}

/**
 * Resolves the primary barcode / SKU shown on the result row.
 * @param {object} product
 * @returns {string}
 */
function primaryCode(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const first = variants[0]
  return first?.barcode || first?.sku || String(product?.id || '')
}

/**
 * Client-side product search with an instant dropdown result list (barcode,
 * category, price). Reflects the query into the URL via `?q=` and closes on
 * outside click or Escape.
 *
 * @param {object} props
 * @param {Array<object>} [props.products]
 * @param {string} [props.placeholder]
 */
export default function SearchBar({
  products,
  placeholder = 'Ürün / barkod ara...',
}) {
  const allProducts = useMemo(
    () => (Array.isArray(products) ? products : productsData.products || []),
    [products]
  )

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const results = useMemo(() => {
    const trimmed = query.trim()
    if (trimmed === '') {
      return []
    }
    return searchProducts(allProducts, trimmed).slice(0, 6)
  }, [allProducts, query])

  const syncUrl = useCallback((value) => {
    if (typeof window === 'undefined') {
      return
    }
    const url = new URL(window.location.href)
    const trimmed = value.trim()
    if (trimmed === '') {
      url.searchParams.delete('q')
    } else {
      url.searchParams.set('q', trimmed)
    }
    window.history.replaceState({}, '', url.toString())
  }, [])

  const handleChange = useCallback(
    (event) => {
      const value = event.target.value
      setQuery(value)
      setIsOpen(value.trim() !== '')
      syncUrl(value)
    },
    [syncUrl]
  )

  const handleClear = useCallback(() => {
    setQuery('')
    setIsOpen(false)
    syncUrl('')
  }, [syncUrl])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const showDropdown = isOpen && query.trim() !== ''

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(query.trim() !== '')}
          placeholder={placeholder}
          aria-label="Ürün ara"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          autoComplete="off"
          className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-9 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Aramayı temizle"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-zinc-300 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900"
        >
          {/* Header row. */}
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Arama Sonucu
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {results.length} kayıt
            </span>
          </div>

          {results.length === 0 ? (
            <p className="px-3 py-4 text-xs text-zinc-500 dark:text-zinc-400">
              Kayıt bulunamadı.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((product) => (
                <li key={product.id || product.slug}>
                  <a
                    href={`/urun/${product.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                      {product.images?.[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {product.name}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                        <span className="truncate">{primaryCode(product)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{product.category?.name}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatPrice(displayPrice(product))}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
