// Генератор PWA-іконок для Flolux.
// Малює базовий SVG (квітку Flower2 на градієнтному фоні), рендерить sharp у PNG усіх потрібних розмірів.
// Запуск: node apps/web/scripts/generate-icons.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// Маскабельні іконки мають "safe-area" близько 80% — потрібно тримати важливий
// контент у центральному колі 80%-діаметра.
function buildSvg({ size = 512, maskable = false }) {
  // Контент-зона: 100% (any) або 80% (maskable). Лого масштабуємо відповідно.
  const safe = maskable ? 0.8 : 1.0;
  // Малюємо Flower2 (Lucide) — спрощена SVG-копія з білого кольору.
  // viewBox 24x24 — наша троянда; центруємо у viewBox 512x512.
  const scale = (size * safe * 0.55) / 24;
  const cx = size / 2;
  const cy = size / 2;
  const offset = (24 * scale) / 2;
  const tx = cx - offset;
  const ty = cy - offset;

  // Дві м'які тіні: одна під квіткою, друга по краях для глибини.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="55%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#be185d"/>
    </radialGradient>
    <radialGradient id="shadow" cx="50%" cy="58%" r="40%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Тло: квадрат для maskable, кругле для any -->
  ${maskable
    ? `<rect width="${size}" height="${size}" fill="url(#bg)"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="url(#bg)"/>`}
  <!-- Тінь під квіткою -->
  <ellipse cx="${cx}" cy="${cy + size * 0.02}" rx="${size * 0.36 * safe}" ry="${size * 0.36 * safe}" fill="url(#shadow)"/>
  <!-- Flower2 (Lucide) — біла обведена троянда -->
  <g transform="translate(${tx} ${ty}) scale(${scale})" fill="none" stroke="#fff7ed" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V9m-4.5 3a4.5 4.5 0 1 0 4.5 4.5M7.5 12H9m7.5 0a4.5 4.5 0 1 1-4.5 4.5m4.5-4.5H15m-3 4.5V15"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 17.5V14"/>
    <path d="m11 14 1.5-2.5L14 14"/>
    <path d="M12 6.5V10"/>
    <path d="M17.5 12H14"/>
    <path d="M6.5 12H10"/>
  </g>
</svg>`;
}

async function emit(name, size, maskable, opts = {}) {
  const svg = buildSvg({ size, maskable });
  const buf = Buffer.from(svg);
  const out = path.join(OUT_DIR, name);
  let pipe = sharp(buf, { density: 384 }).resize(size, size, { fit: 'cover' });
  if (opts.png !== false) pipe = pipe.png({ compressionLevel: 9, quality: 90 });
  await pipe.toFile(out);
  const stat = await fs.stat(out);
  console.log(`✓ ${name}  ${size}×${size}  ${(stat.size / 1024).toFixed(1)} KB`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Основні
  await emit('icon-192.png', 192, false);
  await emit('icon-512.png', 512, false);

  // Maskable (80% safe-зона, квадратне тло)
  await emit('icon-192-maskable.png', 192, true);
  await emit('icon-512-maskable.png', 512, true);

  // Apple
  await emit('apple-touch-icon.png', 180, false);

  // Favicons
  await emit('favicon-32.png', 32, false);
  await emit('favicon-16.png', 16, false);

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('[generate-icons] failed:', e);
  process.exit(1);
});
