/**
 * FAZ B — B5: Basit sepet (client-side, localStorage).
 *
 * Bu modül TAMAMEN istemci tarafında çalışır ve SSR sırasında hiçbir yan etki
 * üretmez. Astro statik derlemesinde (Node) `window`/`localStorage` bulunmadığı
 * için tüm okuma/yazma işlemleri güvenli biçimde no-op'a düşer; böylece aynı
 * modül hem build sırasında (import edilse bile) hem de tarayıcıda sorunsuzdur.
 *
 * Sepet öğesi şeması:
 *   {
 *     id: string,        // ürün id
 *     name: string,      // ürün adı
 *     slug: string,      // ürün slug'ı (ürün sayfası linki için)
 *     variant: string,   // seçilen varyant etiketi (ör. "Renk: Beyaz")
 *     barcode: string,   // varyant barkodu (Shopier eşleşmesi için)
 *     price: number,     // birim fiyat (doğrudan indirimli fiyat)
 *     qty: number,       // adet
 *     image: string,     // görsel URL'i
 *   }
 *
 * Aynı ürün + aynı varyant (barkod) tekrar eklenirse adet artırılır.
 */

const STORAGE_KEY = 'saprintpro_cart_v1'

/** Sepet değiştiğinde tetiklenen abonelikler (React island'ları için). */
const listeners = new Set()

/**
 * Tarayıcı ortamında mıyız? SSR sırasında `false` döner.
 * @returns {boolean}
 */
function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Bir değeri güvenli biçimde sayıya çevirir; geçersizse 0 döner.
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

/**
 * Sepet öğesini normalize eder; eksik/bozuk alanları güvenli varsayılanlara
 * çeker. localStorage'dan gelen veri her zaman güvenilmez kabul edilir.
 * @param {object} item
 * @returns {object|null}
 */
function normalizeItem(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const id = String(item.id ?? '').trim()
  const slug = String(item.slug ?? '').trim()
  if (id === '' && slug === '') {
    return null
  }

  const qty = Math.max(1, Math.floor(toNumber(item.qty) || 1))

  return {
    id,
    name: String(item.name ?? '').trim(),
    slug,
    variant: String(item.variant ?? '').trim(),
    barcode: String(item.barcode ?? '').trim(),
    price: Math.max(0, toNumber(item.price)),
    qty,
    image: String(item.image ?? '').trim(),
  }
}

/**
 * İki sepet öğesinin aynı varyantı temsil edip etmediğini belirler.
 * Öncelik: barkod → id + varyant etiketi.
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function isSameLine(a, b) {
  if (a.barcode && b.barcode) {
    return a.barcode === b.barcode
  }
  return a.id === b.id && a.variant === b.variant
}

/**
 * localStorage'dan ham sepet dizisini okur. Bozuk JSON veya erişim hatasında
 * boş dizi döner (asla throw etmez).
 * @returns {Array<object>}
 */
function readRaw() {
  if (!isBrowser()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map(normalizeItem).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Sepeti localStorage'a yazar ve abonelere haber verir.
 * @param {Array<object>} items
 */
function writeRaw(items) {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Kota dolu / private mode — sessizce yut, sepet bellekte kalır.
  }

  emit()
}

/**
 * Tüm abonelere güncel sepeti bildirir.
 */
function emit() {
  const snapshot = readRaw()
  for (const listener of listeners) {
    try {
      listener(snapshot)
    } catch {
      // Bir abone hata verirse diğerlerini etkilemesin.
    }
  }
}

/**
 * Sepet değişikliklerine abone olur (React `useSyncExternalStore` uyumlu).
 * @param {(items: Array<object>) => void} listener
 * @returns {() => void} Abonelikten çıkma fonksiyonu.
 */
export function subscribe(listener) {
  if (typeof listener !== 'function') {
    return () => {}
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Sepetteki tüm öğeleri döndürür (kopya).
 * @returns {Array<object>}
 */
export function getItems() {
  return readRaw()
}

/**
 * Sepete ürün ekler. Aynı varyant varsa adedi artırır.
 * @param {object} item
 * @returns {Array<object>} Güncel sepet.
 */
export function addItem(item) {
  const normalized = normalizeItem(item)
  if (!normalized) {
    return getItems()
  }

  const items = readRaw()
  const existing = items.find((entry) => isSameLine(entry, normalized))

  if (existing) {
    existing.qty += normalized.qty
    // Fiyat/görsel güncellenmiş olabilir; taze değerleri koru.
    existing.price = normalized.price || existing.price
    existing.name = normalized.name || existing.name
    existing.image = normalized.image || existing.image
  } else {
    items.push(normalized)
  }

  writeRaw(items)
  return items
}

/**
 * Sepetten bir satırı (barkod veya id+varyant ile) çıkarır.
 * @param {string} key Barkod ya da `id::variant` biçiminde anahtar.
 * @returns {Array<object>} Güncel sepet.
 */
export function removeItem(key) {
  const target = String(key ?? '')
  if (target === '') {
    return getItems()
  }

  const items = readRaw().filter((entry) => {
    const entryKey = entry.barcode || `${entry.id}::${entry.variant}`
    return entryKey !== target
  })

  writeRaw(items)
  return items
}

/**
 * Bir satırın adedini günceller. Adet 1'in altına düşerse satır silinir.
 * @param {string} key Barkod ya da `id::variant` biçiminde anahtar.
 * @param {number} qty Yeni adet.
 * @returns {Array<object>} Güncel sepet.
 */
export function updateQty(key, qty) {
  const target = String(key ?? '')
  const nextQty = Math.floor(toNumber(qty))

  if (target === '') {
    return getItems()
  }

  let items = readRaw()

  if (nextQty <= 0) {
    items = items.filter((entry) => {
      const entryKey = entry.barcode || `${entry.id}::${entry.variant}`
      return entryKey !== target
    })
  } else {
    for (const entry of items) {
      const entryKey = entry.barcode || `${entry.id}::${entry.variant}`
      if (entryKey === target) {
        entry.qty = nextQty
        break
      }
    }
  }

  writeRaw(items)
  return items
}

/**
 * Sepeti tamamen boşaltır.
 * @returns {Array<object>} Boş dizi.
 */
export function clear() {
  writeRaw([])
  return []
}

/**
 * Sepetteki toplam ürün adedini döndürür (rozet için).
 * @returns {number}
 */
export function getCount() {
  return readRaw().reduce((sum, entry) => sum + entry.qty, 0)
}

/**
 * Sepetin toplam tutarını (TL) döndürür.
 * @returns {number}
 */
export function getTotal() {
  return readRaw().reduce((sum, entry) => sum + entry.price * entry.qty, 0)
}

/**
 * Bir satır için kararlı anahtar üretir (barkod varsa barkod).
 * @param {object} item
 * @returns {string}
 */
export function getItemKey(item) {
  if (!item) {
    return ''
  }
  return item.barcode || `${item.id}::${item.variant}`
}

/**
 * Fiyatı Türk Lirası biçiminde biçimlendirir.
 * @param {number} value
 * @returns {string}
 */
export function formatPrice(value) {
  const numeric = toNumber(value)
  return `${numeric.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} TL`
}
