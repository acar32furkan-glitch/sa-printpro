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
 * Google Consent Mode v2 — onay verildiğinde çağrılan güncelleme.
 * `gtag` henüz yüklenmemişse (script async olduğu için) sessizce atlanır;
 * `initConsent()` sayfa yüklenirken tekrar dener.
 */
function grantConsent() {
  if (typeof window === 'undefined' || !hasValidGa4Id()) {
    return
  }

  if (typeof window.gtag !== 'function') {
    return
  }

  window.gtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted',
  })
}

/**
 * Persists the consent decision and updates Google Consent Mode accordingly.
 *
 * Not: GA4 etiketi artık [`Layout.astro`](../layouts/Layout.astro) içinde
 * STATİK olarak basılır (Google doğrulama robotu çerez kabul etmeyen statik
 * HTML taramasında etiketi görebilsin diye). Bu yüzden burada script
 * enjekte edilmez; yalnızca consent durumu güncellenir.
 *
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

  if (accepted === true) {
    grantConsent()
  }
  // accepted === false: consent zaten varsayılan olarak "denied" bırakılır,
  // ek bir `update` çağrısına gerek yoktur.
}

/**
 * Called on initial page load. Re-applies granted consent when a previous
 * visit already accepted, so returning visitors are tracked correctly.
 *
 * `gtag` async yüklendiği için hemen hazır olmayabilir; bu yüzden kısa bir
 * retry döngüsüyle (idempotent) tekrar denenir.
 */
export function initConsent() {
  if (getConsent() !== true) {
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  if (typeof window.gtag === 'function') {
    grantConsent()
    return
  }

  let attempts = 0
  const maxAttempts = 20
  const retry = window.setInterval(() => {
    attempts += 1
    if (typeof window.gtag === 'function') {
      window.clearInterval(retry)
      grantConsent()
      return
    }
    if (attempts >= maxAttempts) {
      window.clearInterval(retry)
    }
  }, 250)
}
