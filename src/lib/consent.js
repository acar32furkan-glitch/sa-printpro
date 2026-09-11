import { siteConfig } from '../config/site.js'

export const STORAGE_KEY = 'sa-cookie-consent'

/**
 * Reads the stored cookie consent value from localStorage.
 * @returns {boolean|null} true if accepted, false if rejected, null if unknown/unavailable.
 */
export function getConsent() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') {
      return true
    }
    if (stored === 'false') {
      return false
    }
    return null
  } catch {
    return null
  }
}

/**
 * Checks whether the configured GA4 id is a real, usable measurement id.
 * @returns {boolean}
 */
function hasValidGa4Id() {
  const id = siteConfig.ga4Id
  return typeof id === 'string' && id.trim() !== '' && id !== 'G-XXXXXXXXXX'
}

/**
 * Injects the GA4 gtag config + external script tags into <head>.
 * Idempotent: does nothing if already injected.
 */
function injectGa4() {
  if (typeof document === 'undefined') {
    return
  }

  if (document.getElementById('sa-ga4-config')) {
    return
  }

  const ga4Id = siteConfig.ga4Id

  const configScript = document.createElement('script')
  configScript.id = 'sa-ga4-config'
  configScript.textContent = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${ga4Id}');`

  const externalScript = document.createElement('script')
  externalScript.id = 'sa-ga4-src'
  externalScript.async = true
  externalScript.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`

  document.head.appendChild(configScript)
  document.head.appendChild(externalScript)
}

/**
 * Persists the consent decision and, when accepted, activates GA4.
 * @param {boolean} accepted
 */
export function setConsent(accepted) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, accepted ? 'true' : 'false')
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }

  if (accepted === true && hasValidGa4Id()) {
    injectGa4()
  }
}

/**
 * Called on initial page load. Re-activates GA4 if consent was previously granted.
 */
export function initConsent() {
  if (getConsent() === true) {
    setConsent(true)
  }
}
