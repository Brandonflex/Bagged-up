#!/usr/bin/env node
/**
 * Bagged Up - screenshot the built site.
 *
 * Serves dist/ with clean URLs and drives it in the Chromium that
 * @sparticuz/chromium ships, then writes the PNGs into docs/screenshots/.
 * Not part of the gate: the browser is 200 MB and CI does not need it. See
 * docs/screenshots/README.md for the one time setup.
 *
 *   npm run build
 *   LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp/swiftshader node scripts/screenshot.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs/screenshots');
const PORT = 4611;

if (!fs.existsSync(DIST)) {
  console.error('\n  dist/ is missing. Run: npm run build\n');
  process.exit(1);
}

const require = createRequire(import.meta.url);
let chromium;
let puppeteer;
try {
  chromium = (await import('@sparticuz/chromium')).default;
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('\n  The screenshot browser is not installed. See docs/screenshots/README.md.\n');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.txt': 'text/plain', '.xml': 'application/xml',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  for (const candidate of [url, url + '.html', path.join(url, 'index.html')]) {
    const file = path.join(DIST, candidate);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(file));
    }
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
fs.mkdirSync(OUT, { recursive: true });

const CART = { 'bagged-up-cart-v1': JSON.stringify({ 'canvas-tote-bag': 1 }) };
const CART_BIG = { 'bagged-up-cart-v1': JSON.stringify({ 'louis-vuitton-neverfull-boxed': 2 }) };
const SAVED = { 'bagged-up-saved-v1': JSON.stringify(['canvas-tote-bag', 'black-crescent-shoulder-bag']) };
const RECENT = {
  'bagged-up-recent-v1': JSON.stringify([
    { slug: 'black-crescent-shoulder-bag', name: 'Black Crescent Shoulder Bag', price: 'KSh 1,499', img: '../assets/products/black-crescent-shoulder-bag-1.jpg' },
    { slug: 'amber-accent-handbag', name: 'Amber Accent Handbag', price: 'KSh 1,299', img: '../assets/products/amber-accent-handbag-1.jpg' },
    { slug: 'aria-shoulder-bag', name: 'Aria Shoulder Bag', price: 'KSh 1,199', img: '../assets/products/aria-shoulder-bag-1.jpg' },
  ]),
};

const SHOTS = [
  { name: '01-home-phone', url: '/', h: 844 },
  { name: '02-product-phone', url: '/shop/canvas-tote-bag', h: 844 },
  { name: '03-sticky-add-to-bag', url: '/shop/canvas-tote-bag', h: 844, scroll: 2000 },
  { name: '04-delivery-date-and-save', url: '/shop/canvas-tote-bag', h: 700, selector: '.pdp-ctas' },
  { name: '05-recently-viewed', url: '/shop/canvas-tote-bag', h: 700, seed: RECENT, selector: 'section[aria-label="Recently viewed"]' },
  { name: '06-saved-filter', url: '/shop', h: 844, seed: SAVED, selector: '.chips', click: '.chip[data-cat="__saved"]' },
  { name: '07-cart-free-delivery-progress', url: '/cart', h: 700, seed: CART, selector: '#cart-summary' },
  { name: '08-cart-unlocked', url: '/cart', h: 700, seed: CART_BIG, selector: '#cart-summary' },
  { name: '09-home-desktop', url: '/', w: 1280, h: 860, scale: 1 },
];

const browser = await puppeteer.launch({
  args: [...chromium.args, '--font-render-hinting=none'],
  executablePath: await chromium.executablePath(),
  headless: true,
});

console.log(`\nBagged Up - screenshots from ${path.relative(ROOT, DIST)}/\n`);

for (const shot of SHOTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: shot.w || 390, height: shot.h || 844, deviceScaleFactor: shot.scale || 2 });
  if (shot.seed) {
    await page.evaluateOnNewDocument((seed) => {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }, shot.seed);
  }
  await page.goto(`http://127.0.0.1:${PORT}${shot.url}`, { waitUntil: 'networkidle2', timeout: 60000 });
  if (shot.selector) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120);
    }, shot.selector);
  } else if (shot.scroll) {
    await page.evaluate((y) => window.scrollTo(0, y), shot.scroll);
  }
  if (shot.click) await page.evaluate((sel) => document.querySelector(sel).click(), shot.click);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
  const errors = await page.evaluate(() => window.__pageErrors || 0);
  console.log(`  ${shot.name}${errors ? '  (' + errors + ' page errors)' : ''}`);
  await page.close();
}

await browser.close();
server.close();
console.log(`\n  written to docs/screenshots/\n`);
