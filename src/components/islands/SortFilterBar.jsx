import { useCallback, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'default', label: 'Varsayılan' },
  { value: 'price-asc', label: 'Fiyat: Artan' },
  { value: 'price-desc', label: 'Fiyat: Azalan' },
]

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
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : 'default',
    inStock: inStock === 'true' || inStock === '1',
  }
}

/**
 * Sorting and stock filtering bar. Reflects changes into the URL search params.
 *
 * @param {object} props
 * @param {(state: {sort: string, inStock: boolean}) => void} [props.onChange]
 * @param {boolean} [props.syncUrl]
 */
export default function SortFilterBar({ onChange, syncUrl = true }) {
  // Lazy initializers read the URL once on the client. On the server they fall
  // back to defaults, avoiding a setState-in-effect cascade after hydration.
  const [sort, setSort] = useState(() => readInitialState().sort)
  const [inStock, setInStock] = useState(() => readInitialState().inStock)

  const emitChange = useCallback(
    (nextSort, nextInStock) => {
      if (syncUrl && typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (nextSort === 'default') {
          url.searchParams.delete('sort')
        } else {
          url.searchParams.set('sort', nextSort)
        }
        if (nextInStock) {
          url.searchParams.set('inStock', 'true')
        } else {
          url.searchParams.delete('inStock')
        }
        window.history.replaceState({}, '', url.toString())
      }

      if (typeof onChange === 'function') {
        onChange({ sort: nextSort, inStock: nextInStock })
      }
    },
    [onChange, syncUrl]
  )

  const handleSortChange = useCallback(
    (event) => {
      const nextSort = event.target.value
      setSort(nextSort)
      emitChange(nextSort, inStock)
    },
    [emitChange, inStock]
  )

  const handleStockToggle = useCallback(
    (event) => {
      const nextInStock = event.target.checked
      setInStock(nextInStock)
      emitChange(sort, nextInStock)
    },
    [emitChange, sort]
  )

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Sırala ve Filtrele
      </span>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <ArrowDownUp className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Sıralama</span>
          <select
            value={sort}
            onChange={handleSortChange}
            aria-label="Fiyata göre sırala"
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
          <span>Sadece Stokta</span>
          <span className="relative inline-flex">
            <input
              type="checkbox"
              checked={inStock}
              onChange={handleStockToggle}
              className="peer sr-only"
              aria-label="Sadece stokta olan ürünleri göster"
            />
            <span className="h-5 w-9 rounded-full border border-zinc-300 bg-zinc-200 transition-colors peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900 peer-focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-700 dark:peer-checked:border-zinc-100 dark:peer-checked:bg-zinc-100 dark:peer-focus-visible:ring-zinc-100 dark:peer-focus-visible:ring-offset-zinc-900" />
            <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4 dark:bg-zinc-900" />
          </span>
        </label>
      </div>
    </div>
  )
}
