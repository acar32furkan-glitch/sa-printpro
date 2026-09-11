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

globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
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
updateQty('BC-1', 5)
assert('BC-1 adedi 5', getItems().find((i) => i.barcode === 'BC-1').qty === 5)
assert('Toplam 650', getTotal() === 650)

// 6) Adet 0 → satır silinir.
updateQty('BC-2', 0)
assert('Adet 0 satırı sildi', getItems().length === 1)

// 7) removeItem.
removeItem('BC-1')
assert('removeItem satırı sildi', getItems().length === 0)
assert('Toplam 0', getTotal() === 0)

// 8) Bozuk veriye dayanıklılık.
store.set('saprintpro_cart_v1', '{bozuk json')
assert('Bozuk JSON güvenli (boş dizi)', getItems().length === 0)

// 9) getItemKey barkod önceliği.
assert(
  'getItemKey barkod kullanır',
  getItemKey({ barcode: 'X', id: '1', variant: 'v' }) === 'X'
)
assert(
  'getItemKey barkod yoksa id::variant',
  getItemKey({ barcode: '', id: '1', variant: 'v' }) === '1::v'
)

// 10) clear.
addItem({ id: '9', name: 'Test', slug: 'test', barcode: 'BC-9', price: 10, qty: 3 })
clear()
assert('clear sepeti boşalttı', getItems().length === 0)

console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız\n`)
process.exit(failed > 0 ? 1 : 0)
