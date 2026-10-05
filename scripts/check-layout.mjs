#!/usr/bin/env node
/**
 * Bagged Up - layout checks in a real browser.
 *
 * These are the things jsdom cannot see: whether two buttons on the same row
 * actually line up, whether a card shows one add button or two, and whether the
 * sticky bar keeps out of the desktop layout. Each has been wrong at least once,
 * which is why they are checked here rather than trusted.
 *
 * The browser is found in this order, so it works both in CI and in a sandbox
 * with no system browser:
 *   1. CHROME_PATH
 *   2. Puppeteer's own Chrome lookup (GitHub runners ship Chrome)
 *   3. the Chromium bundled with @sparticuz/chromium, if installed
 *
 *   npm run build && npm run layout
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = 4612;

if (!fs.existsSync(DIST)) {
  console.error('\n  dist/ is missing. Run: npm run build\n');
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
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  try {
    // a copy installed outside the repo, which is how the sandbox gets one
    const { createRequire } = await import('node:module');
    const req = createRequire('/tmp/shot/package.json');
    puppeteer = req('puppeteer-core');
  } catch {
    puppeteer = null;
  }
}
if (!puppeteer) {
  console.log('\n  puppeteer-core is not installed, so layout checks are skipped.');
  console.log('  Run npm ci for the locked test tools, or see docs/screenshots/README.md\n');
  server.close();
  process.exit(0);
}

async function loadChromium() {
  try {
    const { createRequire } = await import('node:module');
    for (const from of ['file://' + path.join(ROOT, 'package.json'), 'file:///tmp/shot/package.json']) {
      try {
        const req = createRequire(from);
        return req('@sparticuz/chromium');
      } catch { /* next */ }
    }
  } catch { /* none */ }
  return null;
}

async function launch() {
  const attempts = [];
  if (process.env.CHROME_PATH) attempts.push({ executablePath: process.env.CHROME_PATH });
  attempts.push({ channel: 'chrome' });
  attempts.push({ channel: 'chromium' });
  const chromium = await loadChromium();
  if (chromium) {
    attempts.push({ executablePath: await chromium.default.executablePath(), args: chromium.default.args });
  }
  for (const attempt of attempts) {
    try {
      return await puppeteer.launch({ headless: true, args: attempt.args || [], ...attempt });
    } catch { /* try the next one */ }
  }
  return null;
}

const browser = await launch();
if (!browser) {
  console.log('\n  No browser available, so layout checks are skipped. See docs/screenshots/README.md\n');
  server.close();
  process.exit(0);
}

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log(`  FAIL  ${name}`);
    console.log(`  - ${e.message}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log('\nBagged Up - layout checks\n');

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function open(url, viewport = PHONE, seed = null) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  if (seed) await page.evaluateOnNewDocument((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500));
  return page;
}

/** Add-to-bag buttons per card, and how far each sits below its card's top. */
const cardButtonOffsets = (page) => page.evaluate(() => [...document.querySelectorAll('#shop-grid .card')]
  .filter((c) => !c.classList.contains('hidden'))
  .map((card) => {
    const rect = card.getBoundingClientRect();
    const visible = [...card.querySelectorAll('[data-add]')].filter((el) => {
      const cs = getComputedStyle(el);
      const own = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && own.height > 0;
    });
    return {
      name: (card.querySelector('.card-name') || {}).textContent || '',
      count: visible.length,
      offsets: visible.map((el) => Math.round(el.getBoundingClientRect().top - rect.top)),
      heights: visible.map((el) => Math.round(el.getBoundingClientRect().height)),
    };
  }));

/* 1. alignment across a row, which was wrong for one line names */
{
  const page = await open('/shop');
  const firstRow = (await cardButtonOffsets(page)).slice(0, 4);
  check('add to bag buttons share a baseline across a row', () => {
    const offsets = new Set(firstRow.map((c) => c.offsets[0]));
    assert(offsets.size === 1,
      `buttons sit at different heights: ${firstRow.map((c) => `${c.offsets[0]}px "${c.name.slice(0, 18)}"`).join(', ')}`);
  });
  check('every card carries exactly one add to bag button', () => {
    const bad = firstRow.filter((c) => c.count !== 1);
    assert(bad.length === 0, bad.map((c) => `${c.count} on "${c.name.slice(0, 20)}"`).join(', '));
  });
  await page.close();
}

/* 2. the same alignment in the two item saved view, where it was seen */
{
  const page = await open('/shop', PHONE, {
    'bagged-up-saved-v1': JSON.stringify(['canvas-tote-bag', 'black-crescent-shoulder-bag']),
  });
  await page.evaluate(() => document.querySelector('.chip[data-cat="__saved"]').click());
  await new Promise((r) => setTimeout(r, 400));
  const cards = await cardButtonOffsets(page);
  check('a one line name and a two line name still align their buttons', () => {
    assert(cards.length === 2, `expected two saved cards, found ${cards.length}`);
    const offsets = new Set(cards.map((c) => c.offsets[0]));
    assert(offsets.size === 1,
      `offsets differ: ${cards.map((c) => `${c.offsets[0]}px "${c.name.slice(0, 20)}"`).join(' vs ')}`);
  });
  await page.close();
}

/* 3. one add button per card, not two, on a touch device */
{
  const page = await open('/shop');
  const counts = (await cardButtonOffsets(page)).map((c) => c.count);
  check('no card shows a second add button over the photo', () => {
    const bad = counts.filter((n) => n !== 1).length;
    assert(bad === 0, `${bad} card(s) show more than one add button`);
  });
  await page.close();
}

/* 4. the sticky bar: present on a phone, absent on desktop */
{
  const page = await open('/shop/canvas-tote-bag');
  await page.evaluate(() => window.scrollTo(0, 2400));
  await new Promise((r) => setTimeout(r, 700));
  const phoneState = await page.evaluate(() => {
    const bar = document.querySelector('#sticky-atc');
    const cs = getComputedStyle(bar);
    const r = bar.getBoundingClientRect();
    const btn = bar.querySelector('.btn').getBoundingClientRect();
    return {
      hidden: bar.hidden,
      display: cs.display,
      onScreen: r.bottom <= window.innerHeight + 1 && r.top < window.innerHeight,
      barHeight: Math.round(r.height),
      buttonInside: btn.top >= r.top && btn.bottom <= r.bottom,
      overlapFab: (() => {
        const fab = document.querySelector('.wa-fab');
        if (!fab) return false;
        const f = fab.getBoundingClientRect();
        return !(f.bottom < r.top || f.top > r.bottom);
      })(),
    };
  });
  check('the sticky bar appears on a phone once the button is gone', () => {
    assert(!phoneState.hidden, 'the bar stayed hidden at 2400px');
    assert(phoneState.display === 'flex', `bar display is ${phoneState.display}`);
    assert(phoneState.buttonInside, 'the add button is not inside the bar');
  });
  check('the sticky bar is slim and never sits on the WhatsApp button', () => {
    assert(phoneState.barHeight <= 80, `bar is ${phoneState.barHeight}px tall, over the 80px limit`);
    assert(!phoneState.overlapFab, 'the bar overlaps the WhatsApp button');
  });
  await page.close();

  const desk = await open('/shop/canvas-tote-bag', DESKTOP);
  await desk.evaluate(() => window.scrollTo(0, 2400));
  await new Promise((r) => setTimeout(r, 700));
  const desktopState = await desk.evaluate(() => getComputedStyle(document.querySelector('#sticky-atc')).display);
  check('the sticky bar stays out of the desktop layout', () => {
    assert(desktopState === 'none', `bar display on desktop is ${desktopState}`);
  });
  await desk.close();
}

/* 5. the homepage testimonial is one centered figure, on desktop and phone */
for (const [device, viewport] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  const page = await open('/', viewport);
  await page.evaluate(() => document.querySelector('.quote-band').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 250));
  const layout = await page.evaluate(() => {
    const band = document.querySelector('.quote-band');
    const panel = band?.querySelector('.home-testimonial');
    const title = panel?.querySelector('#home-testimonial-title');
    const figure = panel?.querySelector('figure.home-review');
    const quote = figure?.querySelector('blockquote .review-quote');
    const attribution = figure?.querySelector('figcaption.review-attribution');
    if (!band || !panel || !title || !figure || !quote || !attribution) return null;
    const box = (el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, center: rect.left + rect.width / 2 };
    };
    const panelBox = box(panel);
    return {
      labelled: band.getAttribute('aria-labelledby') === title.id,
      figureSemantics: figure.tagName === 'FIGURE' && quote.closest('blockquote') && attribution.tagName === 'FIGCAPTION',
      quoteText: quote.textContent.trim(),
      attributionText: attribution.textContent.trim(),
      panel: panelBox,
      parts: [box(title), box(quote), box(attribution)],
      viewportWidth: window.innerWidth,
    };
  });
  check(`${device} testimonial label, quote and attribution form one aligned component`, () => {
    assert(layout, 'the labelled testimonial figure is incomplete');
    assert(layout.labelled, 'the section is not labelled by the testimonial title');
    assert(layout.figureSemantics, 'the quote and attribution are not grouped in a figure');
    assert(layout.quoteText === 'Good customer service, thank you!', `unexpected quote: ${layout.quoteText}`);
    assert(layout.attributionText.includes('Millicent') && layout.attributionText.includes('Verified buyer'),
      `reviewer attribution is incomplete: ${layout.attributionText}`);
    const misalignment = Math.max(...layout.parts.map((part) => Math.abs(part.center - layout.panel.center)));
    assert(misalignment <= 1.5, `testimonial elements are off center by ${misalignment.toFixed(1)}px`);
    assert(layout.panel.left >= -1 && layout.panel.right <= layout.viewportWidth + 1,
      `testimonial panel overflows the ${layout.viewportWidth}px viewport`);
  });
  await page.close();
}

/* 6. every homepage WhatsApp placement renders the shared vector mask */
{
  const page = await open('/', PHONE);
  const icons = await page.evaluate(async () => {
    const nodes = [...document.querySelectorAll('.wa-mark')];
    const entries = nodes.map((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        mask: style.maskImage || style.webkitMaskImage,
        color: style.backgroundColor,
        width: rect.width,
        height: rect.height,
        hidden: node.getAttribute('aria-hidden'),
        placement: node.closest('.wa-fab') ? 'floating button'
          : node.closest('.wa-band') ? 'CTA band'
            : node.closest('.footer-contact') ? 'footer'
              : node.closest('.wa-line') ? 'navigation' : 'other',
      };
    });
    const assetStatus = await fetch('/assets/img/whatsapp-mark.svg').then((response) => response.status).catch(() => 0);
    return { entries, assetStatus };
  });
  check('nav, CTA, footer and floating WhatsApp marks use one crisp, color-adaptive vector', () => {
    assert(icons.entries.length === 4, `homepage has ${icons.entries.length} WhatsApp mark(s), expected 4`);
    assert(icons.assetStatus === 200, `shared vector returned HTTP ${icons.assetStatus}`);
    const bad = icons.entries.filter((icon) => !String(icon.mask).includes('whatsapp-mark.svg')
      || icon.width < 18 || icon.height < 18 || icon.hidden !== 'true' || icon.color === 'rgba(0, 0, 0, 0)');
    assert(bad.length === 0, `${bad.length} mark(s) are missing the mask, visible size, color or decorative label: ${JSON.stringify(bad)}`);
  });
  await page.close();

  const contact = await open('/contact', DESKTOP);
  const cardMark = await contact.evaluate(() => {
    const mark = document.querySelector('.contact-card .wa-mark');
    if (!mark) return null;
    const rect = mark.getBoundingClientRect();
    const style = getComputedStyle(mark);
    return { width: rect.width, height: rect.height, mask: style.maskImage || style.webkitMaskImage };
  });
  check('the contact card uses the same WhatsApp mark at its larger icon size', () => {
    assert(cardMark, 'contact card WhatsApp mark is missing');
    assert(cardMark.width === 22 && cardMark.height === 22, `contact-card mark is ${cardMark.width}×${cardMark.height}px`);
    assert(String(cardMark.mask).includes('whatsapp-mark.svg'), 'contact-card mark does not use the shared vector');
  });
  await contact.close();
}

/* 7. the review card reads as one block */
{
  const page = await open('/reviews');
  const box = await page.evaluate(() => {
    const card = document.querySelector('.review-item');
    const quote = card.querySelector('.review-words').getBoundingClientRect();
    const head = card.querySelector('.review-head').getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    return { inside: quote.top >= cr.top && head.bottom <= quote.top, sameWidth: Math.abs(quote.width - head.width) < 4, cardH: Math.round(cr.height) };
  });
  check('name, stars and quote sit inside one card, stacked', () => {
    assert(box.inside, 'the quote is outside the card');
    assert(box.sameWidth, 'the head and quote are different widths');
  });
  await page.close();
}

/* 8. the layered campaign action is clear, accessible and deliberately arrow-free */
{
  const page = await open('/', DESKTOP);
  const button = await page.evaluate(() => {
    const cta = document.querySelector('.home-hero .hero-media .hero-image-cta');
    const index = cta?.querySelector('.hero-cta-index');
    const media = document.querySelector('.home-hero .hero-media');
    const plane = document.querySelector('.home-hero .hero-type-plane');
    if (!cta || !index || !media || !plane) return null;
    const style = getComputedStyle(cta);
    const indexStyle = getComputedStyle(index);
    const rect = cta.getBoundingClientRect();
    const indexRect = index.getBoundingClientRect();
    return {
      label: cta.getAttribute('aria-label'),
      background: style.backgroundColor,
      color: style.color,
      height: rect.height,
      indexText: index.textContent.trim(),
      indexBorder: indexStyle.borderTopStyle,
      indexWidth: indexRect.width,
      indexHeight: indexRect.height,
      planeZ: Number(getComputedStyle(plane).zIndex),
      mediaZ: Number(getComputedStyle(media).zIndex),
      ctaZ: Number(style.zIndex),
      insideMedia: cta.parentElement === media,
      hasArrow: /[↗↖↘↙→←↑↓]/.test(cta.textContent),
    };
  });
  check('hero primary CTA is a filled, high-contrast, touch-sized button with no arrow', () => {
    assert(button, 'the hero action, index or art-direction layers are missing');
    assert(button.label === 'Shop the edit', `accessible label is "${button.label}"`);
    assert(button.background === 'rgb(250, 247, 241)', `button fill is ${button.background}`);
    assert(button.color === 'rgb(30, 44, 37)', `button label is ${button.color}`);
    assert(button.height >= 44, `button is only ${Math.round(button.height)}px tall`);
    assert(button.indexText === '01', `button index is "${button.indexText}"`);
    assert(button.indexBorder === 'solid', `button index border is ${button.indexBorder}`);
    assert(button.indexWidth >= 30 && Math.abs(button.indexWidth - button.indexHeight) < 1,
      `button index is ${Math.round(button.indexWidth)}×${Math.round(button.indexHeight)}px`);
    assert(!button.hasArrow, 'the action contains a decorative arrow');
    assert(button.insideMedia, 'the foreground action is detached from the campaign image');
    assert(button.planeZ < button.mediaZ && button.mediaZ < button.ctaZ,
      `hero layers are out of order: type ${button.planeZ}, image ${button.mediaZ}, action ${button.ctaZ}`);
  });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const darkButton = await page.evaluate(() => {
    const cta = document.querySelector('.home-hero .hero-media .hero-image-cta');
    return { background: getComputedStyle(cta).backgroundColor, color: getComputedStyle(cta).color };
  });
  check('hero primary CTA remains clear when dark theme is selected', () => {
    assert(darkButton.background === 'rgb(250, 247, 241)', `dark-theme fill is ${darkButton.background}`);
    assert(darkButton.color === 'rgb(30, 44, 37)', `dark-theme label is ${darkButton.color}`);
  });
  await page.close();
}

/* 9. custom pointer states, fine-pointer fallback and branded page transitions */
{
  const page = await open('/', DESKTOP);
  const capability = await page.evaluate(() => ({
    fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    forced: matchMedia('(forced-colors: active)').matches,
  }));
  let cursorStates = null;
  if (capability.fine && !capability.reduced && !capability.forced) {
    const box = await page.$eval('.site-header .wordmark', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    const hover = await page.evaluate(() => document.querySelector('.atelier-cursor')?.dataset.state || 'missing');
    await page.mouse.down();
    const pressed = await page.evaluate(() => document.querySelector('.atelier-cursor')?.dataset.state || 'missing');
    await page.mouse.up();
    const released = await page.evaluate(() => document.querySelector('.atelier-cursor')?.dataset.state || 'missing');
    await page.evaluate(() => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('.home-hero h1'));
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    const selected = await page.evaluate(() => document.querySelector('.atelier-cursor')?.dataset.state || 'missing');
    cursorStates = { hover, pressed, released, selected };
  }
  const cursorFallback = capability.fine && !capability.reduced && !capability.forced
    ? null
    : await page.evaluate(() => !document.querySelector('.atelier-cursor')
      && !document.documentElement.classList.contains('has-custom-cursor'));
  check('custom pointer adapts to hover, press and text selection while preserving native fallbacks', () => {
    if (capability.fine && !capability.reduced && !capability.forced) {
      assert(cursorStates, 'no custom pointer state was recorded');
      assert(cursorStates.hover === 'hover', `hover state is ${cursorStates.hover}`);
      assert(cursorStates.pressed === 'pressed', `press state is ${cursorStates.pressed}`);
      assert(cursorStates.released === 'hover', `release state is ${cursorStates.released}`);
      assert(cursorStates.selected === 'selection', `selection state is ${cursorStates.selected}`);
    } else {
      assert(cursorFallback, 'native cursor was not preserved for this device or preference');
    }
  });
  await page.close();

  const transitionPage = await open('/about', DESKTOP);
  const reduced = await transitionPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduced) {
    const leaving = await transitionPage.evaluate(() => document.documentElement.classList.contains('page-leaving'));
    check('branded page transition respects reduced-motion preference', () => {
      assert(!leaving, 'unexpected active page-leaving class');
    });
  } else {
    const curtainState = await transitionPage.evaluate(() => {
      const link = document.createElement('a');
      link.href = '/delivery.html';
      link.textContent = 'Test destination';
      document.body.appendChild(link);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      link.dispatchEvent(click);
      const curtain = document.querySelector('.brand-transition');
      return {
        prevented: click.defaultPrevented,
        leaving: document.documentElement.classList.contains('page-leaving'),
        visible: curtain ? getComputedStyle(curtain).visibility : 'missing',
        signatureMask: curtain ? getComputedStyle(curtain.querySelector('.brand-transition__signature')).maskImage : '',
        loopMask: curtain ? getComputedStyle(curtain.querySelector('.brand-transition__loops')).maskImage : '',
      };
    });
    check('internal page navigation shows the animated signature loading curtain', () => {
      assert(curtainState.prevented, 'the navigation was not intercepted for its short transition');
      assert(curtainState.leaving, 'page-leaving state was not applied');
      assert(curtainState.visible === 'visible', `curtain visibility is ${curtainState.visible}`);
      assert(String(curtainState.signatureMask).includes('signature-mark.svg'), 'the curtain omits the signature mark');
      assert(String(curtainState.loopMask).includes('linked-loop-mark.svg'), 'the curtain omits the supporting linked-loop');
    });
    await transitionPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 });
  }
  await transitionPage.close();
}

await browser.close();
server.close();

console.log(`\n  ${passed}/${passed + failures.length} layout checks passed\n`);
if (failures.length) {
  console.error('  Failures:');
  for (const f of failures) console.error(`    ${f}`);
  process.exit(1);
}
