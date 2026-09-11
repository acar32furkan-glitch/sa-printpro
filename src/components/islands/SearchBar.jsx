import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

const SEARCH_INDEX_URL = '/search-index.json'
const DEBOUNCE_MS = 200
const MAX_RESULTS = 6

/**
 * Formats a numeric price as a Turkish Lira string.
 * @param {number} value
 * @returns {string}
 */
function formatPrice(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return ''
  }
  return `${numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} TL`
}

/**
 * Normalizes a string for Turkish-aware, case-insensitive comparison.
 * @param {string} str
 * @returns {string}
 */
function normalizeTr(str) {
  return String(str || '')
    .replace(/[İIıi]/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
}

/**
 * Computes the Levenshtein edit distance between two strings using a
 * rolling single-row dynamic-programming approach (pure JS, no deps).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const s = String(a || '')
  const t = String(b || '')
  if (s === t) return 0
  if (s.length === 0) return t.length
  if (t.length === 0) return s.length

  let prev = Array.from({ length: t.length + 1 }, (_, i) => i)
  for (let i = 1; i <= s.length; i += 1) {
    const curr = [i]
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[t.length]
}

/**
 * Returns the smallest edit distance between the query and any word of the
 * given text, enabling typo-tolerant ("jant serdi" → "jant şeridi") matches.
 * @param {string} text
 * @param {string} query
 * @returns {number}
 */
function minWordDistance(text, query) {
  const words = normalizeTr(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  return words.reduce(
    (min, word) => Math.min(min, levenshtein(word, query)),
    Number.POSITIVE_INFINITY
  )
}

/**
 * Filters the slim search index by name, category or barcode.
 *
 * First performs a fast substring pass. When that yields no results, it falls
 * back to a typo-tolerant pass that keeps items whose closest word is within
 * an edit distance of 2 from the query.
 *
 * @param {Array<object>} index
 * @param {string} query
 * @returns {Array<object>}
 */
function filterIndex(index, query) {
  const normalizedQuery = normalizeTr(query.trim())
  if (normalizedQuery === '') {
    return []
  }

  const exact = index.filter((item) => {
    if (normalizeTr(item.name).includes(normalizedQuery)) {
      return true
    }
    if (normalizeTr(item.category).includes(normalizedQuery)) {
      return true
    }
    return normalizeTr(item.barcode).includes(normalizedQuery)
  })

  if (exact.length > 0) {
    return exact
  }

  // Typo-tolerant fallback: distance <= 2 against the closest word.
  return index.filter((item) => {
    const candidates = [item.name, item.category, item.barcode]
    return candidates.some((value) => minWordDistance(value, normalizedQuery) <= 2)
  })
}

/**
 * Client-side product search with an instant dropdown result list (barcode,
 * category, price). The product index is fetched lazily from
 * `/search-index.json` on first focus and cached in a ref, so the island
 * bundle no longer embeds the full catalog. Input changes are debounced.
 *
 * @param {object} props
 * @param {string} [props.placeholder]
 */
export default function SearchBar({ placeholder = 'Ürün / barkod ara...' }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [index, setIndex] = useState([])

  const containerRef = useRef(null)
  const indexRef = useRef(null)
  const fetchPromiseRef = useRef(null)
  const debounceRef = useRef(null)

  /**
   * Fetches the search index once and caches both the promise and the result.
   * Subsequent calls reuse the in-flight promise or the cached array.
   */
  const loadIndex = useCallback(() => {
    if (indexRef.current) {
      return Promise.resolve(indexRef.current)
    }
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current
    }

    const promise = fetch(SEARCH_INDEX_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Arama dizini yüklenemedi (${response.status})`)
        }
        return response.json()
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        indexRef.current = list
        setIndex(list)
        return list
      })
      .catch(() => {
        // Allow a later retry if the network request failed.
        fetchPromiseRef.current = null
        return []
      })

    fetchPromiseRef.current = promise
    return promise
  }, [])

  const handleFocus = useCallback(() => {
    loadIndex()
    setIsOpen(query.trim() !== '')
  }, [loadIndex, query])

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
      loadIndex()

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(value)
      }, DEBOUNCE_MS)
    },
    [loadIndex, syncUrl]
  )

  const handleClear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    setQuery('')
    setDebouncedQuery('')
    setIsOpen(false)
    syncUrl('')
  }, [syncUrl])

  // Clear any pending debounce timer on unmount.
  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    },
    []
  )

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

  const results = useMemo(
    () => filterIndex(index, debouncedQuery).slice(0, MAX_RESULTS),
    [index, debouncedQuery]
  )

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
          onFocus={handleFocus}
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
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {product.name}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                        <span className="truncate">{product.barcode}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{product.category}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatPrice(product.salePrice ?? product.price) || 'Fiyat Sorunuz'}
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
