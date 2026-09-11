import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import ProductCard from './ProductCard.jsx'
import SortFilterBar from './SortFilterBar.jsx'
import { detectProductBrand } from '../../lib/products.js'

/**
 * İstemci tarafında mı çalışıyoruz? `useSyncExternalStore` sunucuda `false`,
 * istemcide `true` döner ve hidrasyon uyuşmazlığı yaratmaz. Bu sayede stok
 * filtresi yalnızca hidrasyondan sonra uygulanır; SSR çıktısı tüm ürünleri
 * (tükendi dahil) içerir.
 *
 * @returns {boolean}
 */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
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
 * Sums the stock across all variants of a product.
 * @param {object} product
 * @returns {number}
 */
function totalStock(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  return variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0)
}

/**
 * Reads the initial sort/filter/brand state from the current URL search params.
 * @returns {{sort: string, inStock: boolean, brand: string}}
 */
function readInitialState() {
  if (typeof window === 'undefined') {
    return { sort: 'default', inStock: true, brand: 'all' }
  }

  const params = new URLSearchParams(window.location.search)
  const sort = params.get('sort')
  const inStock = params.get('inStock')
  const brand = params.get('brand')

  return {
    sort: ['price-asc', 'price-desc'].includes(sort) ? sort : 'default',
    // Stokta olmayan ürünler varsayılan olarak gizlenir; kullanıcı
    // `?inStock=false` ile tümünü görebilir.
    inStock: inStock === null ? true : inStock === 'true' || inStock === '1',
    brand: brand && brand.trim() !== '' ? brand : 'all',
  }
}

/**
 * FAZ B — B4: Statik sayfalama ile uyumlu ürün ızgarası.
 *
 * `ProductGrid`'den farkı: "Daha Fazla Göster" düğmesi YOKTUR ve sayfalama
 * artık sunucu tarafında (path-based) yapılır. Bu ada (island) yalnızca
 * **o sayfadaki 24 ürün** üzerinde sıralama, stok filtresi ve marka pill
 * filtresini client-side uygular.
 *
 * Astro bu React bileşenini sunucuda da render ettiği için ilk HTML gerçek
 * ürün kartları içerir (arama motorları ve JS'siz istemciler görebilir);
 * hidrasyondan sonra etkileşim devreye girer.
 *
 * @param {object} props
 * @param {Array<object>} props.products Sayfadaki ürünler (en fazla 24)
 * @param {Array<{name: string, slug: string, count: number}>} [props.brands]
 */
export default function ProductGridStatic({ products = [], brands = [] }) {
  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products]
  )

  const safeBrands = useMemo(() => (Array.isArray(brands) ? brands : []), [brands])

  const [state, setState] = useState(readInitialState)

  // Sunucu render'ında (SSR) stok filtresi UYGULANMAZ; böylece tükendi
  // durumundaki ürünler de statik HTML'de yer alır ve arama motorları /
  // JS'siz istemciler tarafından görülebilir. Filtre yalnızca hidrasyondan
  // sonra devreye girer.
  const hydrated = useIsClient()

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

  /**
   * Applies a brand filter and mirrors it into the URL (`?brand=slug`).
   * The category filter (handled server-side) stays untouched, so both
   * filters compose naturally.
   */
  const handleBrandChange = useCallback((brandSlug) => {
    setState((prev) => ({ ...prev, brand: brandSlug }))

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (!brandSlug || brandSlug === 'all') {
        url.searchParams.delete('brand')
      } else {
        url.searchParams.set('brand', brandSlug)
      }
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const filteredProducts = useMemo(() => {
    let list = [...safeProducts]

    if (state.brand && state.brand !== 'all') {
      list = list.filter((product) => detectProductBrand(product).slug === state.brand)
    }

    // Stok filtresi yalnızca hidrasyondan sonra uygulanır (SSR'da tüm
    // ürünler statik HTML'e girer).
    if (hydrated && state.inStock) {
      list = list.filter((product) => totalStock(product) > 0)
    }

    if (state.sort === 'price-asc') {
      list.sort((a, b) => displayPrice(a) - displayPrice(b))
    } else if (state.sort === 'price-desc') {
      list.sort((a, b) => displayPrice(b) - displayPrice(a))
    }

    return list
  }, [safeProducts, state, hydrated])

  return (
    <div className="flex flex-col gap-6">
      <SortFilterBar onChange={handleChange} />

      {safeBrands.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Motosiklet Markanı Seç
          </span>
          <div
            className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Motosiklet markasına göre filtrele"
          >
            <button
              type="button"
              onClick={() => handleBrandChange('all')}
              aria-pressed={state.brand === 'all'}
              className={`shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900 ${
                state.brand === 'all'
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500'
              }`}
            >
              Tümü
              <span className="ml-1.5 font-normal opacity-70">{safeProducts.length}</span>
            </button>

            {safeBrands.map((brand) => {
              const isActive = state.brand === brand.slug
              return (
                <button
                  key={brand.slug}
                  type="button"
                  onClick={() => handleBrandChange(brand.slug)}
                  aria-pressed={isActive}
                  className={`shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900 ${
                    isActive
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500'
                  }`}
                >
                  {brand.name}
                  <span className="ml-1.5 font-normal opacity-70">{brand.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Bu filtreye uyan ürün bulunamadı.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <li key={product.id || product.slug}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
