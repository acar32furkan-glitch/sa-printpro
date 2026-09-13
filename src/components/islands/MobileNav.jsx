import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Menu, Search, ShoppingCart, X } from 'lucide-react'
import SearchBar from './SearchBar.jsx'
import { subscribe, getCount } from '../../lib/cart.js'

/**
 * Sunucuda 0, istemcide gerçek sepet adedini döndürür (hidrasyon güvenli).
 * @returns {number}
 */
function useCartCount() {
  return useSyncExternalStore(
    subscribe,
    () => getCount(),
    () => 0
  )
}

/**
 * Mobile-only navigation: a slide-down menu plus a full-width search overlay.
 * Keeps the desktop navbar uncluttered while giving small screens a first-class
 * search experience instead of a squeezed inline input.
 *
 * @param {object} props
 * @param {Array<{label: string, href: string}>} props.links
 * @param {string} props.currentPath
 */
export default function MobileNav({ links = [], currentPath = '/' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const cartCount = useCartCount()

  const closeAll = useCallback(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [])

  // Lock body scroll while an overlay is open and close on Escape.
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const isOpen = menuOpen || searchOpen
    const previousOverflow = document.body.style.overflow

    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAll()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen, searchOpen, closeAll])

  return (
    <div className="flex items-center gap-2 md:hidden">
      <button
        type="button"
        onClick={() => {
          setSearchOpen((open) => !open)
          setMenuOpen(false)
        }}
        aria-label="Ürün ara"
        aria-expanded={searchOpen}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition-all duration-200 ease-smooth hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => {
          setMenuOpen((open) => !open)
          setSearchOpen(false)
        }}
        aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
        aria-expanded={menuOpen}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition-all duration-200 ease-smooth hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      >
        {menuOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {searchOpen && (
        <div className="fixed inset-x-0 top-[88px] z-40 animate-fade-in border-b border-zinc-200 bg-white/95 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
          <SearchBar autoFocus onNavigate={closeAll} />
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-x-0 top-[88px] z-40 animate-fade-in border-b border-zinc-200 bg-white/95 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
          <ul className="flex flex-col gap-1">
            <li>
              <a
                href="/sepet/"
                onClick={closeAll}
                aria-current={currentPath === '/sepet/' ? 'page' : undefined}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  currentPath === '/sepet/'
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                    : 'border-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Sepetim
                </span>
                {cartCount > 0 && (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-2xs font-bold text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </a>
            </li>
            {links.map((link) => {
              const isActive = currentPath === link.href
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={closeAll}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                        : 'border-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
