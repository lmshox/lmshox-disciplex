// Renders client/public/icons/icon.svg into the PNG sizes PWAs need.
// Usage: npm run icons   (requires Playwright + Chromium)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/public/icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');

// Maskable icons need the mark inside the central 80% safe zone.
const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.86 },
  { file: 'favicon-32.png', size: 32, scale: 1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, scale } of targets) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * scale);
  await page.setContent(
    `<html><body style="margin:0;background:#000;display:grid;place-items:center;width:${size}px;height:${size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
     </body></html>`,
  );
  await page.screenshot({ path: path.join(dir, file), omitBackground: false });
  console.log('wrote', file);
}
await browser.close();
