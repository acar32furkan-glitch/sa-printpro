/**
 * FAZ B — B5: Sepet mantığı için küçük Node testi.
 *
 * `src/lib/cart.js` tarayıcı API'lerine (window.localStorage) bağlıdır. Bu
 * test, modülü import etmeden ÖNCE global `window`/`localStorage` taklitlerini
 * kurar ve ekle/çıkar/adet/toplam davranışını doğrular.
 *
 * Kullanım: node scripts/test-cart.mjs
 */

// --- localStorage taklidi -------------------------------------------------
const store = new Map()

// `storage` olayını taklit edebilmek için basit bir dinleyici kaydı tutuyoruz.
const storageListeners = new Set()

globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
  addEventListener: (type, handler) => {
    if (type === 'storage') {
      storageListeners.add(handler)
    }
  },
  removeEventListener: (type, handler) => {
    if (type === 'storage') {
      storageListeners.delete(handler)
    }
  },
}

/**
 * Başka bir sekmede yapılan değişikliği taklit eder: localStorage'a yazar ve
 * `storage` olayını tetikler.
 * @param {string} key
 * @param {string} value
 */
function simulateOtherTabWrite(key, value) {
  store.set(key, String(value))
  for (const handler of storageListeners) {
    handler({ key, newValue: String(value) })
  }
}

const {
  addItem,
  removeItem,
  updateQty,
  getItems,
  clear,
  getCount,
  getTotal,
  getItemKey,
  subscribe,
  getSnapshot,
  getServerSnapshot,
} = await import('../src/lib/cart.js')

let passed = 0
let failed = 0

/**
 * Basit assertion yardımcısı.
 * @param {string} label
 * @param {boolean} condition
 */
function assert(label, condition) {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    console.error(`  ✗ ${label}`)
  }
}

console.log('\n=== SEPET TESTİ ===')

// 1) Başlangıçta boş.
clear()
assert('Başlangıçta sepet boş', getItems().length === 0)
assert('Başlangıçta adet 0', getCount() === 0)
assert('Başlangıçta toplam 0', getTotal() === 0)

// 2) Ürün ekleme.
addItem({
  id: '1',
  name: 'Reflektif Sticker',
  slug: 'reflektif-sticker',
  variant: 'Renk: Beyaz',
  barcode: 'BC-1',
  price: 100,
  qty: 1,
  image: '/uploads/products/1.webp',
})
assert('Bir ürün eklendi', getItems().length === 1)
assert('Adet 1', getCount() === 1)
assert('Toplam 100', getTotal() === 100)

// 3) Aynı varyant tekrar eklenince adet artar (yeni satır açılmaz).
addItem({
  id: '1',
  name: 'Reflektif Sticker',
  slug: 'reflektif-sticker',
  variant: 'Renk: Beyaz',
  barcode: 'BC-1',
  price: 100,
  qty: 2,
})
assert('Aynı varyant tek satırda birleşti', getItems().length === 1)
assert('Adet 3 oldu', getCount() === 3)
assert('Toplam 300', getTotal() === 300)

// 4) Farklı varyant ayrı satır olur.
addItem({
  id: '1',
  name: 'Reflektif Sticker',
  slug: 'reflektif-sticker',
  variant: 'Renk: Siyah',
  barcode: 'BC-2',
  price: 150,
  qty: 1,
})
assert('Farklı varyant ayrı satır', getItems().length === 2)
assert('Toplam 450', getTotal() === 450)

// 5) Adet güncelleme.
updateQty('bc:BC-1', 5)
assert('BC-1 adedi 5', getItems().find((i) => i.barcode === 'BC-1').qty === 5)
assert('Toplam 650', getTotal() === 650)

// 6) Adet 0 → satır silinir.
updateQty('bc:BC-2', 0)
assert('Adet 0 satırı sildi', getItems().length === 1)

// 7) removeItem.
removeItem('bc:BC-1')
assert('removeItem satırı sildi', getItems().length === 0)
assert('Toplam 0', getTotal() === 0)

// 8) Bozuk veriye dayanıklılık.
store.set('saprintpro_cart_v1', '{bozuk json')
assert('Bozuk JSON güvenli (boş dizi)', getItems().length === 0)

// 9) getItemKey barkod önceliği.
assert(
  'getItemKey barkod kullanır',
  getItemKey({ barcode: 'X', id: '1', variant: 'v' }) === 'bc:X'
)
assert(
  'getItemKey barkod yoksa id::variant',
  getItemKey({ barcode: '', id: '1', variant: 'v' }) === 'id:1::v'
)

// 10) clear.
addItem({ id: '9', name: 'Test', slug: 'test', barcode: 'BC-9', price: 10, qty: 3 })
clear()
assert('clear sepeti boşalttı', getItems().length === 0)

// ---------------------------------------------------------------------------
// REGRESYON TESTLERİ — bildirilen sepet hataları
// ---------------------------------------------------------------------------

console.log('\n--- Regresyon: barkodlu/barkodsuz satır karışması ---')

// 11) Barkodlu bir satır ile barkodsuz bir satır ASLA birleşmemeli.
clear()
addItem({
  id: '42',
  name: 'Ürün',
  slug: 'urun',
  variant: 'Renk: Beyaz',
  barcode: 'BC-A',
  price: 100,
  qty: 1,
})
addItem({
  id: '42',
  name: 'Ürün',
  slug: 'urun',
  variant: 'Renk: Beyaz',
  barcode: '',
  price: 100,
  qty: 1,
})
assert('Barkodlu + barkodsuz ayrı satır kaldı', getItems().length === 2)
assert('Toplam 200 (yanlış birleşme yok)', getTotal() === 200)

// 12) Barkodsuz iki farklı varyant ayrı satır olmalı.
clear()
addItem({ id: '7', name: 'Ürün', slug: 'urun', variant: 'Renk: Beyaz', barcode: '', price: 50, qty: 1 })
addItem({ id: '7', name: 'Ürün', slug: 'urun', variant: 'Renk: Siyah', barcode: '', price: 60, qty: 1 })
assert('Barkodsuz farklı varyantlar ayrı satır', getItems().length === 2)
assert('Toplam 110', getTotal() === 110)

// 13) Barkodsuz aynı varyant birleşmeli.
addItem({ id: '7', name: 'Ürün', slug: 'urun', variant: 'Renk: Beyaz', barcode: '', price: 50, qty: 2 })
assert('Barkodsuz aynı varyant birleşti', getItems().length === 2)
assert('Beyaz varyant adedi 3', getItems().find((i) => i.variant === 'Renk: Beyaz').qty === 3)

console.log('\n--- Regresyon: fiyat/adet doğruluğu ---')

// 14) Toplam = Σ (birim fiyat × adet).
clear()
addItem({ id: '1', name: 'A', slug: 'a', variant: 'v1', barcode: 'P1', price: 199, qty: 3 })
addItem({ id: '2', name: 'B', slug: 'b', variant: 'v2', barcode: 'P2', price: 55, qty: 2 })
assert('Toplam doğru (199*3 + 55*2 = 707)', getTotal() === 707)
assert('Adet doğru (3 + 2 = 5)', getCount() === 5)

// 15) Fiyat güncellemesi mevcut satıra yansır (aynı varyant tekrar eklenince).
addItem({ id: '1', name: 'A', slug: 'a', variant: 'v1', barcode: 'P1', price: 149, qty: 1 })
assert('Güncel fiyat korundu (149)', getItems().find((i) => i.barcode === 'P1').price === 149)
assert('Adet 4 oldu', getItems().find((i) => i.barcode === 'P1').qty === 4)
assert('Toplam 149*4 + 55*2 = 706', getTotal() === 706)

console.log('\n--- Regresyon: adet sınırları ---')

// 16) Negatif adet satırı siler.
clear()
addItem({ id: '1', name: 'A', slug: 'a', variant: 'v1', barcode: 'N1', price: 10, qty: 2 })
updateQty('bc:N1', -5)
assert('Negatif adet satırı sildi', getItems().length === 0)

// 17) Ondalıklı adet aşağı yuvarlanır.
clear()
addItem({ id: '1', name: 'A', slug: 'a', variant: 'v1', barcode: 'F1', price: 10, qty: 1 })
updateQty('bc:F1', 3.9)
assert('Ondalıklı adet 3e yuvarlandı', getItems()[0].qty === 3)

// 18) Geçersiz adet (NaN) satırı silmez, 0'a düşer → silinir.
clear()
addItem({ id: '1', name: 'A', slug: 'a', variant: 'v1', barcode: 'G1', price: 10, qty: 2 })
updateQty('bc:G1', 'abc')
assert('Geçersiz adet satırı sildi (0)', getItems().length === 0)

console.log('\n--- Regresyon: sepet kalıcılığı (localStorage) ---')

// 19) Yazılan sepet localStorage\'dan yeniden okunabilir (sayfa yenileme).
clear()
addItem({ id: '1', name: 'Kalıcı', slug: 'kalici', variant: 'v1', barcode: 'K1', price: 77, qty: 2 })
const persisted = JSON.parse(store.get('saprintpro_cart_v1'))
assert('localStorage\'a yazıldı', Array.isArray(persisted) && persisted.length === 1)
assert('Kalıcı adet 2', persisted[0].qty === 2)
assert('Kalıcı fiyat 77', persisted[0].price === 77)

console.log('\n--- Regresyon: sekmeler arası senkronizasyon (storage event) ---')

// 20) Başka sekmede yapılan değişiklik aboneye bildirilir.
clear()
let notified = null
const unsubscribe = subscribe((items) => {
  notified = items
})

simulateOtherTabWrite(
  'saprintpro_cart_v1',
  JSON.stringify([
    { id: '1', name: 'Diğer Sekme', slug: 'd', variant: 'v', barcode: 'X1', price: 12, qty: 4 },
  ])
)
assert('storage olayı aboneye ulaştı', notified !== null)
assert('Abone güncel sepeti gördü', Array.isArray(notified) && notified.length === 1)
assert('Abone adedi doğru (4)', notified && notified[0].qty === 4)

// 21) İlgisiz anahtar aboneyi tetiklememeli.
notified = null
simulateOtherTabWrite('baska_anahtar', 'deger')
assert('İlgisiz anahtar aboneyi tetiklemedi', notified === null)

unsubscribe()

console.log('\n--- Regresyon: useSyncExternalStore snapshot referans kararlılığı ---')

// 22) getSnapshot aynı içerik için AYNI referansı döndürmeli (sonsuz döngü fix).
clear()
addItem({ id: '1', name: 'A', slug: 'a', variant: 'v1', barcode: 'S1', price: 10, qty: 1 })
const snapA = getSnapshot()
const snapB = getSnapshot()
assert('getSnapshot aynı referansı döndürdü (Object.is)', Object.is(snapA, snapB))

// 23) İçerik değişince YENİ referans üretilmeli.
addItem({ id: '2', name: 'B', slug: 'b', variant: 'v2', barcode: 'S2', price: 20, qty: 1 })
const snapC = getSnapshot()
assert('İçerik değişince yeni referans üretildi', !Object.is(snapB, snapC))
assert('Yeni snapshot 2 satır içeriyor', snapC.length === 2)

// 24) getServerSnapshot her çağrıda aynı referansı döndürmeli.
const serverA = getServerSnapshot()
const serverB = getServerSnapshot()
assert('getServerSnapshot aynı referansı döndürdü', Object.is(serverA, serverB))

// 25) getItems da kararlı referans döndürmeli (aynı içerik).
const itemsA = getItems()
const itemsB = getItems()
assert('getItems aynı referansı döndürdü', Object.is(itemsA, itemsB))

// 26) Aboneye iletilen snapshot, getSnapshot ile aynı referans olmalı.
clear()
let emitted = null
const unsub2 = subscribe((items) => {
  emitted = items
})
addItem({ id: '3', name: 'C', slug: 'c', variant: 'v3', barcode: 'S3', price: 30, qty: 1 })
assert('Aboneye iletilen snapshot güncel', emitted !== null && emitted.length === 1)
assert('Aboneye iletilen referans getSnapshot ile aynı', Object.is(emitted, getSnapshot()))
unsub2()

console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız\n`)
process.exit(failed > 0 ? 1 : 0)
