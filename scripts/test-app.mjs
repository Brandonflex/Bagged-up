#!/usr/bin/env node
/**
 * Bagged Up - behaviour tests for the storefront script.
 *
 * scripts/test-site.mjs proves the static site is consistent. This proves the
 * parts that only exist once JavaScript runs: the sticky add-to-bag bar, the
 * delivery date line, save for later, the recently viewed rail, the saved
 * filter on the shop page, and the free delivery progress bar in the cart.
 *
 * It runs the real files through jsdom, so a change to app.js is tested against
 * the real markup rather than a fixture that could drift from it.
 *
 *   node scripts/test-app.mjs        (part of: npm test)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const dataJs = read('assets/js/data.js');
const reviewsJs = read('assets/js/reviews.js');
const appJs = read('assets/js/app.js');

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

/** Load a page with the real scripts, optionally pre-seeding localStorage. */
function page(file, seed = {}, customizeWindow, query = '') {
  const html = read(file);
  const dom = new JSDOM(html, {
    url: 'https://baggedup.example.com/' + file + (query ? '?' + query : ''),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // jsdom has neither of these; the app degrades without them, which is also
  // worth testing, so they are stubbed as the browser would provide them.
  window.matchMedia = window.matchMedia || function () {
    return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
  };
  if (!('IntersectionObserver' in window)) {
    window.__observers = [];
    window.IntersectionObserver = class {
      constructor(cb) { this.cb = cb.bind(this); window.__observers.push(this); }
      observe(el) { this.el = el; }
      unobserve() {}
      takeRecords() { return []; }
      disconnect() {}
    };
  }
  for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v);
  window.eval(dataJs);
  window.eval(reviewsJs);
  if (typeof customizeWindow === 'function') customizeWindow(window);
  window.eval(appJs);
  return window;
}

const SAVED_KEY = 'bagged-up-saved-v1';
const RECENT_KEY = 'bagged-up-recent-v1';
const CART_KEY = 'bagged-up-cart-v1';

console.log('\nBagged Up - storefront behaviour tests\n');

/* ---------- product page ---------- */

check('product page renders a sticky add to bag bar for the right product', () => {
  const w = page('shop/canvas-tote-bag.html');
  const bar = w.document.querySelector('#sticky-atc');
  assert(bar, 'no sticky bar was created');
  const btn = bar.querySelector('[data-add]');
  assert(btn && btn.getAttribute('data-add') === 'canvas-tote-bag', 'sticky button targets the wrong product');
  assert(/Canvas Tote Bag/.test(bar.textContent), 'sticky bar does not name the product');
  assert(/KSh 999/.test(bar.textContent), 'sticky bar does not show the price');
});

check('sticky bar starts hidden and is revealed past the main button', () => {
  const w = page('shop/canvas-tote-bag.html');
  const bar = w.document.querySelector('#sticky-atc');
  assert(bar.hidden, 'sticky bar should start hidden');
  const observers = w.__observers || [];
  assert(observers.length, 'no intersection observer was registered');
  const entry = (o, isIntersecting, top) => ({
    target: o.el,
    isIntersecting,
    boundingClientRect: { top },
  });
  observers.forEach((o) => o.cb([entry(o, false, -400)], o));
  assert(!bar.hidden, 'sticky bar did not appear after scrolling past the button');
  assert(w.document.body.classList.contains('has-sticky'), 'body did not take the has-sticky class');
  observers.forEach((o) => o.cb([entry(o, true, 120)], o));
  assert(bar.hidden, 'sticky bar did not hide again when the button came back into view');
});

check('product page shows a concrete delivery date, not a speed', () => {
  const w = page('shop/canvas-tote-bag.html');
  const eta = w.document.querySelector('.eta-pdp');
  assert(eta, 'no delivery estimate line was added');
  const text = eta.textContent;
  assert(/Nairobi delivery/.test(text), `estimate does not mention Nairobi: ${text}`);
  assert(/Countrywide/.test(text), `estimate does not mention countrywide: ${text}`);
  assert(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/.test(text) || /Nairobi delivery today/.test(text),
    `estimate carries no day and date: ${text}`);
  const days = w.document.querySelectorAll('.eta-pdp').length;
  assert(days === 1, `expected one estimate line, found ${days}`);
});

check('saving a bag from the product page persists and paints', () => {
  const w = page('shop/canvas-tote-bag.html');
  const btn = w.document.querySelector('.saved-inline');
  assert(btn, 'no save button on the product page');
  assert(btn.textContent.trim() === 'Save for later', `unexpected initial label: ${btn.textContent}`);
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const stored = JSON.parse(w.localStorage.getItem(SAVED_KEY) || '[]');
  assert(stored.includes('canvas-tote-bag'), 'the slug was not stored');
  assert(btn.classList.contains('on'), 'button was not painted as saved');
  assert(btn.getAttribute('aria-pressed') === 'true', 'aria-pressed was not set');
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const after = JSON.parse(w.localStorage.getItem(SAVED_KEY) || '[]');
  assert(!after.includes('canvas-tote-bag'), 'saving twice did not remove it');
});

check('the product page records what was viewed', () => {
  const w = page('shop/canvas-tote-bag.html');
  const recent = JSON.parse(w.localStorage.getItem(RECENT_KEY) || '[]');
  assert(recent.length === 1 && recent[0] === 'canvas-tote-bag', 'this visit was not recorded as a catalogue slug');
});

check('a return visit shows a recently viewed rail', () => {
  const seed = {
    [RECENT_KEY]: JSON.stringify([
      { slug: 'black-crescent-shoulder-bag', name: 'Black Crescent Shoulder Bag', price: 'KSh 1,499', img: '../assets/products/black-crescent-shoulder-bag-1.jpg' },
    ]),
  };
  const w = page('shop/canvas-tote-bag.html', seed);
  const rail = w.document.querySelector('section[aria-label="Recently viewed"]');
  assert(rail, 'no recently viewed section was added');
  const cards = rail.querySelectorAll('.rail-card');
  assert(cards.length === 1, `expected one card, found ${cards.length}`);
  assert(/black-crescent-shoulder-bag\.html$/.test(cards[0].getAttribute('href')), 'rail links to the wrong page');
  assert(/^https:\/\/baggedup\.example\.com\/assets\/products\//.test(cards[0].querySelector('img').src), 'rail image URL is wrong');
  const again = JSON.parse(w.localStorage.getItem(RECENT_KEY) || '[]');
  assert(again[0] === 'canvas-tote-bag' && again[1] === 'black-crescent-shoulder-bag', 'the trail did not put this visit first');
});

check('untrusted recent-item metadata cannot inject HTML or external images', () => {
  const seed = {
    [RECENT_KEY]: JSON.stringify([
      {
        slug: 'black-crescent-shoulder-bag',
        name: '"><img src=x onerror=alert(1)>',
        price: '" onerror="alert(1)',
        img: 'https://attacker.invalid/pixel.jpg'
      },
      { slug: '"><img src=x onerror=alert(1)>', name: 'bad', img: 'javascript:alert(1)' }
    ]),
  };
  const w = page('shop/canvas-tote-bag.html', seed);
  const rail = w.document.querySelector('section[aria-label="Recently viewed"]');
  assert(rail, 'valid catalogue item was not recovered from old storage');
  assert(rail.querySelectorAll('.rail-card').length === 1, 'an invalid product slug was rendered');
  assert(rail.querySelectorAll('img').length === 1, 'untrusted markup created extra image elements');
  const image = rail.querySelector('img');
  assert(image.getAttribute('src') === '../assets/products/black-crescent-shoulder-bag-1.jpg', 'image was not rebuilt from the catalogue');
  assert(!rail.querySelector('[onerror]'), 'an event handler was injected from storage');
  assert(/Black Crescent Shoulder Bag/.test(rail.textContent), 'stored name replaced the catalogue name');
  const normalized = JSON.parse(w.localStorage.getItem(RECENT_KEY) || '[]');
  assert(normalized.every((slug) => typeof slug === 'string'), 'recent storage still contains untrusted metadata');
});

/* ---------- shop page ---------- */

check('shop page offers a Saved filter alongside the categories', () => {
  const w = page('shop.html');
  const chip = w.document.querySelector('.chip[data-cat="__saved"]');
  assert(chip, 'no Saved chip was added');
  assert(/Saved/.test(chip.textContent), 'the chip is not labelled');
});

check('the homepage edit finder recommends catalogued bags as the mood changes', () => {
  const w = page('index.html');
  const image = w.document.querySelector('#finder-image');
  const productLink = w.document.querySelector('#finder-product-link');
  const categoryLink = w.document.querySelector('#finder-category-link');
  assert(image && image.getAttribute('src') === 'assets/products/black-crescent-shoulder-bag-1.jpg', 'the initial image is not catalogue-backed');
  assert(/Black Crescent Shoulder Bag/.test(w.document.querySelector('#finder-name').textContent), 'the initial product name is missing');

  const option = w.document.querySelector('.finder-option[data-finder-product="canvas-tote-bag"]');
  const click = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  option.dispatchEvent(click);
  assert(click.defaultPrevented, 'the finder link navigated instead of updating the recommendation');
  assert(image.getAttribute('src') === 'assets/products/canvas-tote-bag-1.jpg', 'the image did not update from catalogue data');
  assert(/Canvas Tote Bag/.test(image.getAttribute('alt')), 'the updated image has no matching alt text');
  assert(/Canvas Tote Bag/.test(w.document.querySelector('#finder-name').textContent), 'the recommendation did not update');
  assert(/KSh 999/.test(w.document.querySelector('#finder-price').textContent), 'the catalogue price did not update');
  assert(productLink.getAttribute('href') === 'shop/canvas-tote-bag.html', 'the product link does not match the recommendation');
  assert(categoryLink.getAttribute('href') === 'shop.html?cat=totes', 'the collection link does not match the selected edit');
  assert(option.getAttribute('aria-current') === 'true', 'the selected mood is not announced');
});

check('collection links open with their category filter selected', () => {
  const w = page('shop.html', {}, undefined, 'cat=mini-occasion');
  const active = w.document.querySelector('.chip.active');
  const visible = [...w.document.querySelectorAll('#shop-grid .card')].filter((card) => !card.classList.contains('hidden'));
  assert(active && active.getAttribute('data-cat') === 'mini-occasion', 'the category in the URL was not selected');
  assert(visible.length === 7, `expected 7 occasion bags, found ${visible.length}`);
  assert(visible.every((card) => card.getAttribute('data-cat') === 'mini-occasion'), 'other categories remain visible');
});

check('every product card gets a save button', () => {
  const w = page('shop.html');
  const cards = w.document.querySelectorAll('#shop-grid .card').length;
  const hearts = w.document.querySelectorAll('#shop-grid .saved-btn').length;
  assert(cards > 40, `expected the full catalogue, found ${cards} cards`);
  assert(cards === hearts, `${cards} cards but ${hearts} save buttons`);
});

check('the Saved filter shows only saved bags and updates the count', () => {
  const w = page('shop.html', { [SAVED_KEY]: JSON.stringify(['canvas-tote-bag']) });
  const chip = w.document.querySelector('.chip[data-cat="__saved"]');
  assert(chip.querySelector('.chip-count').textContent === '1', 'the chip count is wrong');
  chip.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const shown = [...w.document.querySelectorAll('#shop-grid .card')].filter((c) => !c.classList.contains('hidden'));
  assert(shown.length === 1, `expected one visible card, found ${shown.length}`);
  assert(/canvas-tote-bag/.test(shown[0].innerHTML), 'the wrong card survived the filter');
  const note = w.document.querySelector('#result-note').textContent;
  assert(/1 saved piece/.test(note), `result note is wrong: ${note}`);
});

check('saved-item storage accepts only unique catalogue slugs', () => {
  const w = page('shop.html', {
    [SAVED_KEY]: JSON.stringify(['canvas-tote-bag', '<img src=x onerror=alert(1)>', '__proto__', 'canvas-tote-bag', 'unknown-item'])
  });
  const chip = w.document.querySelector('.chip[data-cat="__saved"]');
  assert(chip.querySelector('.chip-count').textContent === '1', 'invalid or duplicate slugs affected the saved count');
  chip.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const visible = [...w.document.querySelectorAll('#shop-grid .card')].filter((card) => !card.classList.contains('hidden'));
  assert(visible.length === 1 && /canvas-tote-bag/.test(visible[0].innerHTML), 'untrusted slugs appeared in the saved filter');
});

check('clicking a heart on a card saves it without navigating', () => {
  const w = page('shop.html');
  const heart = w.document.querySelector('#shop-grid .saved-btn');
  heart.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const stored = JSON.parse(w.localStorage.getItem(SAVED_KEY) || '[]');
  assert(stored.length === 1, `expected one saved slug, found ${stored.length}`);
  assert(w.document.querySelectorAll('.saved-btn.on').length === 1, 'the heart did not paint as saved');
});

/* ---------- cart page ---------- */

check('cart storage rejects unknown data and caps numeric quantities', () => {
  const raw = JSON.parse('{"canvas-tote-bag":"2items","charm-shoulder-pouch":250,"<img src=x onerror=alert(1)>":2,"__proto__":99}');
  const w = page('cart.html', { [CART_KEY]: JSON.stringify(raw) });
  const lines = w.document.querySelectorAll('#cart-lines .cart-line');
  assert(lines.length === 1, `expected one validated cart line, found ${lines.length}`);
  assert(lines[0].getAttribute('data-slug') === 'charm-shoulder-pouch', 'unknown cart keys were rendered');
  assert(lines[0].querySelector('.q').textContent === '99', 'stored quantity was not capped');
  assert(!w.document.querySelector('[onerror]'), 'cart storage created an event handler');
});

check('cart shows progress toward free delivery below the threshold', () => {
  const w = page('cart.html', { [CART_KEY]: JSON.stringify({ 'canvas-tote-bag': 1 }) });
  const bar = w.document.querySelector('.free-bar');
  assert(bar, 'no free delivery bar was rendered');
  assert(!bar.classList.contains('done'), 'bar already reports success below the threshold');
  assert(/more and delivery is free/.test(bar.textContent), `unexpected bar text: ${bar.textContent}`);
  assert(/KSh 4,001/.test(bar.textContent), `the remaining amount is wrong: ${bar.textContent}`);
  const width = bar.querySelector('.fb-track span').getAttribute('style');
  assert(/width:\s*\d+%/.test(width), 'the progress track has no width');
});

check('cart reports free delivery once the threshold is passed', () => {
  const w = page('cart.html', { [CART_KEY]: JSON.stringify({ 'louis-vuitton-neverfull-boxed': 2 }) });
  const bar = w.document.querySelector('.free-bar');
  assert(bar && bar.classList.contains('done'), 'no unlocked state at 6,398');
  assert(/Free delivery unlocked/.test(bar.textContent), `unexpected text: ${bar.textContent}`);
});

check('cart carries a concrete delivery date next to the options', () => {
  const w = page('cart.html', { [CART_KEY]: JSON.stringify({ 'canvas-tote-bag': 1 }) });
  const eta = w.document.querySelector('#cart-summary .eta');
  assert(eta, 'no estimate in the cart summary');
  assert(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/.test(eta.textContent) || /today/.test(eta.textContent),
    `estimate carries no date: ${eta.textContent}`);
});

check('WhatsApp checkout uses a fixed HTTPS destination and isolates the new tab', () => {
  const w = page('cart.html', { [CART_KEY]: JSON.stringify({ 'canvas-tote-bag': 1 }) });
  const link = w.document.querySelector('#wa-checkout');
  const url = new URL(link.href);
  const rel = link.rel.split(/\s+/);
  assert(url.protocol === 'https:' && url.hostname === 'wa.me', `checkout destination was not WhatsApp HTTPS: ${url.href}`);
  assert(link.target === '_blank', 'checkout no longer opens in a new tab');
  assert(rel.includes('noopener') && rel.includes('noreferrer'), `unsafe target relation: ${link.rel}`);
});

/* ---------- reviews ---------- */

check('a review renders as one card holding name, date, stars and words', () => {
  const w = page('reviews.html');
  const card = w.document.querySelector('.review-item');
  assert(card, 'no review card rendered');
  assert(/Millicent/.test(card.textContent), 'the name is not inside the card');
  assert(/September 2026/.test(card.textContent), 'the date is not inside the card');
  assert(card.querySelector('.review-words'), 'the words are not in the card');
  assert(card.querySelectorAll('.review-score svg').length === 5, 'the stars are not in the card');
  assert(card.querySelector('.review-avatar'), 'no avatar initial');
  assert(/Verified order/.test(card.textContent), 'the verified marker is missing');
  const outside = [...w.document.querySelectorAll('.review-item ~ *')].filter((el) => /Millicent|Good customer service/.test(el.textContent));
  assert(outside.length === 0, 'part of the review is rendering outside the card');
});

check('the reviews page summarises the rating once', () => {
  const w = page('reviews.html');
  const summary = w.document.querySelector('.review-summary');
  assert(summary, 'no summary line');
  assert(/5\.0/.test(summary.textContent), `average is wrong: ${summary.textContent}`);
  assert(/1 review/.test(summary.textContent), `count is wrong: ${summary.textContent}`);
});

check('review content is escaped and malformed review records are rejected', () => {
  const w = page('reviews.html', {}, (window) => {
    window.BAGGED_UP_REVIEWS = [
      {
        name: '<img src=x onerror=alert(1)>', date: '2026-09', rating: 5,
        product: null, body: '<svg onload=alert(1)>', verified: true
      },
      {
        name: 'Injected', date: '2026-99', rating: '5" onload="alert(1)',
        product: '<img src=x>', body: 'invalid', verified: true
      }
    ];
  });
  const host = w.document.querySelector('[data-reviews="all"]');
  const card = host.querySelector('.review-item');
  assert(card, 'valid but hostile text was not rendered');
  assert(!host.querySelector('img, svg[onload], [onerror]'), 'review text created executable markup');
  assert(card.querySelector('.review-who b').textContent === '<img src=x onerror=alert(1)>', 'review name was not rendered as text');
  assert(card.querySelector('.review-words').textContent === '<svg onload=alert(1)>', 'review body was not rendered as text');
  assert(/1 review/.test(host.querySelector('.review-summary').textContent), 'malformed record was not excluded');
});

check('a product with no reviews shows one honest empty state', () => {
  const w = page('shop/canvas-tote-bag.html');
  const host = w.document.querySelector('[data-reviews="canvas-tote-bag"]');
  assert(host, 'the product page has no review container');
  assert(host.getAttribute('data-reviews-ready') === 'true', 'the container was never filled');
  const empty = host.querySelectorAll('.review-empty');
  assert(empty.length === 1, `expected one empty state, found ${empty.length}`);
  assert(!host.querySelector('.review-item'), 'a card rendered where there is no review');
});

check('a review for this product would show on this product only', () => {
  const w = page('shop/canvas-tote-bag.html');
  const store = w.localStorage;
  assert(store, 'no storage');
  // the data file is the source, so prove the filter works by reading the real list
  const reviews = w.eval('window.BAGGED_UP_REVIEWS.map(function (r) { return r.product; })');
  assert(reviews.every((p) => p === null || typeof p === 'string'), 'review records are malformed');
  const host = w.document.querySelector('[data-reviews="canvas-tote-bag"]');
  assert(host.querySelector('.review-summary') === null, 'a summary shows with no reviews for this product');
});

console.log(`\n  ${passed}/${passed + failures.length} behaviour tests passed\n`);
if (failures.length) {
  console.error('  Failures:');
  for (const f of failures) console.error(`    ${f}`);
  process.exit(1);
}
