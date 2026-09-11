// Shopier uygulama mağazası varlıkları üretici
// - 512x512 ve 256x256 kare PNG uygulama ikonu (logo/sa-printpro-icon-kare.jfif)
// - 1200x800 tanıtıcı ekran görselleri (public/uploads/products/*.webp)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'public/shopier';
const ICON_SRC = 'logo/sa-printpro-icon-kare.jfif';
const PRODUCTS_DIR = 'public/uploads/products';

// Marka arka plan rengi (beyaz)
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

fs.mkdirSync(OUT_DIR, { recursive: true });

async function makeIcon(size) {
  const out = path.join(OUT_DIR, `app-icon-${size}.png`);
  // Logoyu kare tuvale sığdır (contain), beyaz arka planla düzleştir
  await sharp(ICON_SRC)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(out);
  const m = await sharp(out).metadata();
  console.log(`OK ${out} ${m.width}x${m.height} ${m.format} ${(fs.statSync(out).size / 1024).toFixed(1)}KB`);
}

async function makeScreenshot(srcFile, index) {
  const out = path.join(OUT_DIR, `screenshot-${index}.png`);
  const W = 1200;
  const H = 800;
  const PAD = 60; // kenar boşluğu
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  // Ürün görselini iç alana sığdır
  const product = await sharp(path.join(PRODUCTS_DIR, srcFile))
    .resize(innerW, innerH, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toBuffer();

  // Beyaz tuval + ince kenarlık + ortalanmış ürün
  const border = await sharp({
    create: {
      width: innerW,
      height: innerH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: product, top: 0, left: 0 }])
    .png()
    .toBuffer();

  await sharp({
    create: { width: W, height: H, channels: 4, background: BG },
  })
    .composite([{ input: border, top: PAD, left: PAD }])
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(out);

  const m = await sharp(out).metadata();
  console.log(`OK ${out} ${m.width}x${m.height} ${m.format} ${(fs.statSync(out).size / 1024).toFixed(1)}KB`);
}

// En büyük dosya boyutuna sahip (en detaylı) 3 ürün görselini seç
function pickTopProducts(n) {
  const files = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => ({ f, size: fs.statSync(path.join(PRODUCTS_DIR, f)).size }))
    .sort((a, b) => b.size - a.size);
  return files.slice(0, n).map((x) => x.f);
}

await makeIcon(512);
await makeIcon(256);

const picks = pickTopProducts(3);
console.log('Seçilen ürün görselleri:', picks.join(', '));
for (let i = 0; i < picks.length; i++) {
  await makeScreenshot(picks[i], i + 1);
}
