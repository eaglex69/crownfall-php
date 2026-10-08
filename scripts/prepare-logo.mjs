// Делает белый фон логотипа прозрачным, обрезает поля и сохраняет в public/images/logo.png.
// Использование: node scripts/prepare-logo.mjs путь/к/логотипу.png
// После этого игра сама начнёт показывать этот файл вместо логотипа, нарисованного на CSS.
import sharp from 'sharp';

const input = process.argv[2];
const output = process.argv[3] || 'public/images/logo.png';
if (!input) { console.error('Укажите путь к файлу логотипа.'); process.exit(1); }

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const px = w * h;
const flooded = new Uint8Array(px);
const lum = (i) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
const sat = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) - lum(i);
const isBg = (i) => lum(i) >= 150 && sat(i) <= 110;

// Заливка фона от краёв: фоном считаем светлые пиксели, связанные с границей картинки.
const queue = new Int32Array(px);
let head = 0, tail = 0;
const push = (i) => { if (!flooded[i] && isBg(i)) { flooded[i] = 1; queue[tail++] = i; } };
for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
while (head < tail) {
  const i = queue[head++]; const x = i % w; const y = (i - x) / w;
  if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
}

// Фон и мягкое свечение вокруг логотипа становятся полупрозрачными.
const out = Buffer.alloc(px * 4);
let minX = w, minY = h, maxX = 0, maxY = 0;
for (let i = 0; i < px; i++) {
  let r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = 255;
  if (flooded[i]) {
    a = Math.max(0, Math.min(255, Math.round((255 * (255 - lum(i))) / 105)));
    if (a > 0) {
      const k = a / 255;
      r = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - k)) / k)));
      g = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - k)) / k)));
      b = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - k)) / k)));
    }
  }
  out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  if (a > 12) { const x = i % w, y = (i - x) / w; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
}

const pad = 8;
const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
const width = Math.min(w - left, maxX - minX + 1 + pad * 2), height = Math.min(h - top, maxY - minY + 1 + pad * 2);
await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .extract({ left, top, width, height })
  .resize({ width: Math.min(900, width) })
  .png({ compressionLevel: 9 })
  .toFile(output);
console.log(`Готово: ${output} (${width}x${height}, фон прозрачный)`);
