import { useCallback, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'theme'

/**
 * Resolves the theme that should be active on first paint.
 * Priority: stored preference > light (default). The OS preference is
 * intentionally ignored so the site always starts in light mode.
 * @returns {'light'|'dark'}
 */
function resolveInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light'
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') {
      return stored
    }
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }

  return 'light'
}

/**
 * Applies the theme to <html> and keeps the `dark` class in sync.
 * @param {'light'|'dark'} theme
 */
function applyTheme(theme) {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export default function ThemeToggle() {
  // Lazy initializers resolve the theme once on the client. On the server they
  // fall back to 'light', so no setState-in-effect cascade is needed.
  const [theme, setTheme] = useState(resolveInitialTheme)
  const [mounted] = useState(() => typeof window !== 'undefined')

  // Synchronize the resolved theme with the <html> element (external system).
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      applyTheme(next)

      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Ignore storage failures (private mode, quota, etc.)
      }

      return next
    })
  }, [])

  const isDark = theme === 'dark'
  const label = isDark ? 'Açık temaya geç' : 'Koyu temaya geç'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition-all duration-200 ease-smooth hover:border-zinc-400 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
    >
      {mounted && isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  )
}
