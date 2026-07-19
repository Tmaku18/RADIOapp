/**
 * Regenerate PWA / favicon PNGs from the official cyan square wordmark.
 *
 * Run from web/: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const src = path.join(webRoot, 'public/images/networx-logo-cyan.png');
const iconsDir = path.join(webRoot, 'public/icons');
const bg = '#05070d';

async function writeSquareIcon(outPath, size, { maskable = false } = {}) {
  const logoSize = maskable ? Math.round(size * 0.66) : size;
  const logo = await sharp(src)
    .resize(logoSize, logoSize, { fit: 'contain', background: bg })
    .png()
    .toBuffer();

  const left = Math.round((size - logoSize) / 2);
  const top = Math.round((size - logoSize) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(outPath);

  console.log(`Wrote ${path.relative(webRoot, outPath)} (${size}x${size}${maskable ? ', maskable' : ''})`);
}

await mkdir(iconsDir, { recursive: true });

await writeSquareIcon(path.join(iconsDir, 'pwa-192.png'), 192);
await writeSquareIcon(path.join(iconsDir, 'pwa-512.png'), 512);
await writeSquareIcon(path.join(iconsDir, 'maskable-512.png'), 512, { maskable: true });
await writeSquareIcon(path.join(webRoot, 'public/apple-touch-icon.png'), 180);
await writeSquareIcon(path.join(webRoot, 'src/app/icon.png'), 512);
