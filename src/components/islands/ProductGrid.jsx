import { useCallback, useEffect, useMemo, useState } from 'react'
import ProductCard from './ProductCard.jsx'
import SortFilterBar from './SortFilterBar.jsx'

const PAGE_SIZE = 24

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
 * Sums the stock across all variants of a product.
 * @param {object} product
 * @returns {number}
 */
function totalStock(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  return variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0)
}

/**
 * Reads the initial sort/filter state from the current URL search params.
 * @returns {{sort: string, inStock: boolean}}
 */
function readInitialState() {
  if (typeof window === 'undefined') {
    return { sort: 'default', inStock: true }
  }

  const params = new URLSearchParams(window.location.search)
  const sort = params.get('sort')
  const inStock = params.get('inStock')

  return {
    sort: ['price-asc', 'price-desc'].includes(sort) ? sort : 'default',
    // Stokta olmayan ürünler varsayılan olarak gizlenir; kullanıcı
    // `?inStock=false` ile tümünü görebilir.
    inStock: inStock === null ? true : inStock === 'true' || inStock === '1',
  }
}

/**
 * Reactive product grid with client-side sorting, stock filtering and
 * incremental rendering. Only the first `PAGE_SIZE` products are mounted at
 * once; the rest are appended via a "Daha Fazla Göster" button to keep the
 * initial DOM small. The initial state is hydrated from the URL so shared
 * links keep their view.
 *
 * @param {object} props
 * @param {Array<object>} props.products
 */
export default function ProductGrid({ products = [] }) {
  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products]
  )

  const [state, setState] = useState(readInitialState)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Keep the grid in sync when the user navigates back/forward with URL params.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handlePopState = () => setState(readInitialState())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleChange = useCallback((next) => {
    setState(next)
    // Any filter/sort change resets pagination to the first page.
    setVisibleCount(PAGE_SIZE)
  }, [])

  const filteredProducts = useMemo(() => {
    let list = [...safeProducts]

    if (state.inStock) {
      list = list.filter((product) => totalStock(product) > 0)
    }

    if (state.sort === 'price-asc') {
      list.sort((a, b) => displayPrice(a) - displayPrice(b))
    } else if (state.sort === 'price-desc') {
      list.sort((a, b) => displayPrice(b) - displayPrice(a))
    }

    return list
  }, [safeProducts, state])

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  )

  const remaining = Math.max(filteredProducts.length - visibleProducts.length, 0)

  const handleLoadMore = useCallback(() => {
    setVisibleCount((count) => count + PAGE_SIZE)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <SortFilterBar onChange={handleChange} />

      {filteredProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Bu filtreye uyan ürün bulunamadı.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <li key={product.id || product.slug}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>

          {remaining > 0 && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                aria-label={`Daha fazla ürün göster, ${remaining} ürün kaldı`}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
              >
                Daha Fazla Göster
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  (Kalan {remaining} Ürün)
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
