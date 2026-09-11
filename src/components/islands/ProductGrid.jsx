import { useCallback, useEffect, useMemo, useState } from 'react'
import ProductCard from './ProductCard.jsx'
import SortFilterBar from './SortFilterBar.jsx'

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
    return { sort: 'default', inStock: false }
  }

  const params = new URLSearchParams(window.location.search)
  const sort = params.get('sort')
  const inStock = params.get('inStock')

  return {
    sort: ['price-asc', 'price-desc'].includes(sort) ? sort : 'default',
    inStock: inStock === 'true' || inStock === '1',
  }
}

/**
 * Reactive product grid with client-side sorting and stock filtering. The
 * initial state is hydrated from the URL so shared links keep their view.
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
  }, [])

  const visibleProducts = useMemo(() => {
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

  return (
    <div className="flex flex-col gap-6">
      <SortFilterBar onChange={handleChange} />

      {visibleProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Bu filtreye uyan ürün bulunamadı.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((product) => (
            <li key={product.id || product.slug}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
