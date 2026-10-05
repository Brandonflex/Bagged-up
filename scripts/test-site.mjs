#!/usr/bin/env node
/**
 * Bagged Up - storefront integrity suite.
 *
 * The site is plain HTML/CSS/JS with no framework and no bundler, so the
 * things that actually break in production are reference and consistency
 * bugs: a link that 404s, a catalogue that disagrees with the pages, a
 * canonical URL that fights the host's clean-URL config. This suite checks
 * those invariants across every shipped file, plus the CI workflow files
themselves: a workflow that fails to parse never runs at all, and no other
check will ever notice. One dev dependency (js-yaml) exists for that last
check; everything else stays dependency-free, no network.
 *
 *   node scripts/test-site.mjs        (or: npm test)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { load as yamlLoad } from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://bagged-up.vercel.app';

const failures = [];
const checks = [];
const info = [];

function check(name, fn) {
  const before = failures.length;
  let detail = '';
  try {
    detail = fn() || '';
  } catch (err) {
    failures.push(`${name} → threw: ${err.message}`);
    checks.push({ name, ok: false, detail: err.message });
    return;
  }
  const ok = failures.length === before;
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name} → ${detail}`);
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
/* every text file under a directory, relative to the repo root */
function walk(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const child = path.join(dir, e.name);
    return e.isDirectory() ? walk(child) : [child];
  }).filter((f) => /\.(?:md|mjs|js|json|jsonc|css|html|svg|txt|yml|xml)$/.test(f));
}
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ---------- inputs ---------- */
const ROOT_PAGES = [
  'index.html', 'shop.html', 'cart.html', 'about.html', 'reviews.html', 'contact.html',
  'faq.html', 'delivery.html', 'returns.html', 'privacy.html', 'terms.html',
];
const PDP_PAGES = fs.readdirSync(path.join(ROOT, 'shop'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => `shop/${f}`);
const PAGES = [...ROOT_PAGES, ...PDP_PAGES];
const SCRIPT_PAGES = [...PDP_PAGES]; // product pages carry per-product markup

/* ---------- catalogue ---------- */
let products = [];
check('catalogue parses (assets/js/data.js)', () => {
  const src = read('assets/js/data.js');
  const json = src.replace(/^window\.BAGGED_UP_PRODUCTS\s*=\s*/, '').replace(/;\s*$/, '');
  products = JSON.parse(json);
  if (!Array.isArray(products) || products.length === 0) throw new Error('not a non-empty array');
  return `${products.length} products`;
});

check('catalogue entries are complete', () => {
  const bad = [];
  for (const p of products) {
    if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) bad.push(`bad slug: ${JSON.stringify(p.slug)}`);
    if (!p.name) bad.push(`${p.slug}: missing name`);
    if (typeof p.price !== 'number' || !(p.price > 0)) bad.push(`${p.slug}: missing price`);
    if (!Array.isArray(p.images) || p.images.length === 0) bad.push(`${p.slug}: no images`);
  }
  if (bad.length) throw new Error(bad.slice(0, 8).join('; '));
  return `${products.length} entries have slug, name, price and photos`;
});

check('catalogue slugs are unique', () => {
  const seen = new Set();
  const dupes = products.filter((p) => (seen.has(p.slug) ? true : (seen.add(p.slug), false)));
  if (dupes.length) throw new Error(dupes.map((p) => p.slug).join(', '));
  return `${products.length} unique slugs`;
});

check('every catalogue photo exists on disk', () => {
  const missing = [];
  for (const p of products) for (const img of p.images) if (!exists(img)) missing.push(img);
  if (missing.length) throw new Error(missing.slice(0, 8).join(', '));
  return `${products.reduce((n, p) => n + p.images.length, 0)} photo references resolve`;
});

/* ---------- catalogue ↔ pages ↔ sitemap ---------- */
const slugs = new Set(products.map((p) => p.slug));
const pdpSlugs = new Set(PDP_PAGES.map((p) => path.basename(p, '.html')));

check('every product has a page', () => {
  const missing = [...slugs].filter((s) => !pdpSlugs.has(s));
  if (missing.length) throw new Error(missing.join(', '));
  return `${slugs.size} products → ${pdpSlugs.size} pages`;
});

check('reviews parse and point at real products (assets/js/reviews.js)', () => {
  const src = read('assets/js/reviews.js');
  const json = src.replace(/^[\s\S]*?window\.BAGGED_UP_REVIEWS\s*=\s*/, '').replace(/;\s*$/, '');
  const list = JSON.parse(json);
  if (!Array.isArray(list)) throw new Error('reviews are not a list');
  const slugs = new Set(products.map((p) => p.slug));
  list.forEach((r, i) => {
    if (!r.name) throw new Error(`review ${i} has no name`);
    if (!/^\d{4}-\d{2}$/.test(r.date || '')) throw new Error(`review ${i} has no month, found ${r.date}`);
    if (!(r.rating >= 1 && r.rating <= 5)) throw new Error(`review ${i} rating is ${r.rating}`);
    if (!r.body) throw new Error(`review ${i} has no words`);
    if (r.product !== null && !slugs.has(r.product)) {
      throw new Error(`review ${i} is about "${r.product}", which is not in the catalogue`);
    }
  });
  return `${list.length} review(s), ${list.filter((r) => r.product).length} about a product`;
});

check('every page loads the reviews script', () => {
  const missing = PAGES.filter((page) => !read(page).includes('assets/js/reviews.js'));
  if (missing.length) throw new Error(`${missing.length} page(s) do not load it: ${missing.slice(0, 3).join(', ')}`);
  return `${PAGES.length} pages`;
});

check('every product page has a catalogue entry', () => {
  const orphans = [...pdpSlugs].filter((s) => !slugs.has(s));
  if (orphans.length) throw new Error(orphans.join(', '));
  return 'no orphan pages';
});

check('product copy and metadata stay specific, consistent and supportable', () => {
  const bad = [];
  for (const page of PDP_PAGES) {
    const html = read(page);
    const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1] || '';
    const ogDescription = html.match(/<meta property="og:description" content="([^"]*)">/)?.[1] || '';
    const productCopy = html.match(/<p class="pdp-desc">([\s\S]*?)<\/p>/)?.[1]?.trim() || '';
    const reviewLede = html.match(/<p class="fr-lede">([\s\S]*?)<\/p>/)?.[1]?.trim() || '';
    if (!description || description.length > 155 || /…|\.\.\./.test(description)) {
      bad.push(`${page}: missing, truncated or overlong search description`);
    }
    if (description !== ogDescription) bad.push(`${page}: search and Open Graph descriptions differ`);
    if (!productCopy || !reviewLede || !productCopy.startsWith(reviewLede)) {
      bad.push(`${page}: product copy and full-review lede are missing or out of sync`);
    }
    if (!html.includes('<h3>What fits</h3>') || !html.includes('Message us about this bag')) {
      bad.push(`${page}: missing the product-specific fit-check prompt`);
    }
    if (!html.includes('Inspected before dispatch') || /Inspected &amp; cleaned before dispatch|Premium look and feel/.test(html)) {
      bad.push(`${page}: unsupported or generic assurance/spec copy`);
    }
  }
  if (bad.length) throw new Error(bad.slice(0, 8).join('; '));
  return `${PDP_PAGES.length} pages keep meta, Open Graph, PDP and review copy aligned`;
});

check('product lightboxes retain visible labelled navigation controls', () => {
  const bad = [];
  for (const page of PDP_PAGES) {
    const html = read(page);
    for (const [id, label] of [['lb-prev', 'Previous photo'], ['lb-next', 'Next photo']]) {
      const control = new RegExp(`<button type="button" class="lb-nav [^"]+" id="${id}" aria-label="${label}"><svg\\b`);
      if (!control.test(html)) bad.push(`${page}: ${label}`);
    }
  }
  if (bad.length) throw new Error(bad.slice(0, 8).join('; '));
  return `${PDP_PAGES.length} pages have labelled SVG prev/next controls`;
});

check('sitemap matches the catalogue', () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) throw new Error('no <loc> entries');
  const sitemapProducts = new Set(
    locs.filter((l) => l.includes('/shop/')).map((l) => l.replace(/^.*\/shop\//, ''))
  );
  const missing = [...slugs].filter((s) => !sitemapProducts.has(s));
  const extra = [...sitemapProducts].filter((s) => !slugs.has(s));
  if (missing.length || extra.length) {
    throw new Error(`missing: ${missing.slice(0, 5).join(', ') || 'none'} | extra: ${extra.slice(0, 5).join(', ') || 'none'}`);
  }
  return `${locs.length} URLs, all ${slugs.size} products listed`;
});

check('sitemap lists every page and no cart', () => {
  const xml = read('sitemap.xml');
  const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const expected = PAGES.filter((p) => p !== 'cart.html').map((p) => (p === 'index.html' ? SITE + '/' : `${SITE}/${p.replace(/\.html$/, '')}`));
  const missing = expected.filter((u) => !locs.has(u));
  if (missing.length) throw new Error(missing.join(', '));
  if ([...locs].some((l) => l.includes('cart'))) throw new Error('cart is listed (robots.txt disallows it)');
  return 'all non-cart pages listed';
});

/* ---------- links and assets ---------- */
check('every local link and asset resolves', () => {
  const broken = [];
  let checked = 0;
  for (const page of PAGES) {
    const html = read(page);
    const dir = path.dirname(page);
    for (const m of html.matchAll(/(?:src|href)="([^"]*)"/g)) {
      const ref = m[1];
      if (!ref || /^(?:https?:|mailto:|tel:|data:|whatsapp:|javascript:|\/\/)/.test(ref)) continue;
      const clean = ref.split('#')[0].split('?')[0];
      if (!clean) continue;
      checked++;
      if (!exists(path.normalize(path.join(dir, clean)))) broken.push(`${page} → ${ref}`);
    }
  }
  if (broken.length) throw new Error(broken.slice(0, 10).join('; '));
  return `${checked} references across ${PAGES.length} pages`;
});

check('no references to a missing depth', () => {
  const wrong = [];
  for (const page of PDP_PAGES) {
    const html = read(page);
    for (const m of html.matchAll(/(?:src|href)="\.\.\/\.\.\/[^"]*"/g)) wrong.push(`${page} → ${m[0]}`);
  }
  if (wrong.length) throw new Error(wrong.slice(0, 5).join('; '));
  return 'product pages stay one level deep';
});

check('no asset is orphaned', () => {
  const referenced = new Set();
  for (const page of PAGES) {
    const html = read(page);
    for (const m of html.matchAll(/(?:src|href)="([^"]*)"/g)) referenced.add(path.basename(m[1]));
  }
  const css = read('assets/css/style.css');
  const orphans = [];
  for (const dir of ['assets/img', 'assets/products', 'assets/fonts']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!referenced.has(f) && !css.includes(f)) orphans.push(`${dir}/${f}`);
    }
  }
  info.push(`${orphans.length} asset file(s) not referenced by any page${orphans.length ? ': ' + orphans.join(', ') : ''}`);
  return orphans.length ? `${orphans.length} orphaned file(s) - see notes` : 'all assets referenced';
});

check('WhatsApp marks share one scalable decorative vector on every page', () => {
  const css = read('assets/css/style.css');
  const svg = read('assets/img/whatsapp-mark.svg');
  if (!css.includes('url("../img/whatsapp-mark.svg")') || !css.includes('background-color: currentColor')) {
    throw new Error('the reusable vector mask or its contextual color is missing');
  }
  if (!/<svg[^>]*viewBox="0 0 24 24"/.test(svg) || !/<path\b[^>]*d="[^"]+"/.test(svg)) {
    throw new Error('the WhatsApp vector has no scalable viewBox or path');
  }
  let total = 0;
  const broken = [];
  for (const page of PAGES) {
    const html = read(page);
    const marks = [...html.matchAll(/<span\s+class="wa-mark" aria-hidden="true"><\/span>/g)].length;
    total += marks;
    if (marks < 3) broken.push(`${page}: ${marks} mark(s)`);
    if (html.includes('class="ic-fill"') || html.includes('M12.04 2a9.9')) broken.push(`${page}: legacy WhatsApp path remains`);
  }
  if (broken.length) throw new Error(broken.slice(0, 8).join('; '));
  return `${total} consistent vector placements across ${PAGES.length} pages`;
});

/* ---------- per-page head + structure ---------- */
const EXPECT = {
  canonical: true,
  'og:url': true,
  'og:image': true,
  'og:title': true,
  'og:description': true,
  description: true,
  viewport: true,
};

check('every page has title, meta and social head tags', () => {
  const bad = [];
  for (const page of PAGES) {
    const html = read(page);
    if (!/<title>\s*[^<]+\s*<\/title>/.test(html)) bad.push(`${page}: title`);
    for (const key of Object.keys(EXPECT)) {
      const has = key === 'canonical'
        ? /<link rel="canonical" href="[^"]+">/.test(html)
        : key === 'viewport'
          ? /<meta name="viewport" content="[^"]+">/.test(html)
          : key === 'description'
            ? /<meta name="description" content="[^"]+">/.test(html)
            : new RegExp(`<meta property="${key}" content="[^"]+">`).test(html);
      if (!has) bad.push(`${page}: ${key}`);
    }
  }
  if (bad.length) throw new Error(bad.slice(0, 10).join('; '));
  return `${PAGES.length} pages complete`;
});

check('exactly one <h1> per page', () => {
  const bad = [];
  for (const page of PAGES) {
    const n = (read(page).match(/<h1[\s>]/g) || []).length;
    if (n !== 1) bad.push(`${page}: ${n}`);
  }
  if (bad.length) throw new Error(bad.join('; '));
  return `${PAGES.length} pages have one h1`;
});

check('no duplicate element ids within a page', () => {
  const bad = [];
  for (const page of PAGES) {
    const ids = [...read(page).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (dupes.length) bad.push(`${page}: ${dupes.join(', ')}`);
  }
  if (bad.length) throw new Error(bad.join('; '));
  return 'ids are unique';
});

/* ---------- URL shape: clean URLs, correct host ---------- */
check('canonical and og:url use clean URLs on the live host', () => {
  const bad = [];
  for (const page of PAGES) {
    const html = read(page);
    const urls = [
      ...[...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((m) => ['canonical', m[1]]),
      ...[...html.matchAll(/<meta property="og:url" content="([^"]+)">/g)].map((m) => ['og:url', m[1]]),
    ];
    for (const [key, url] of urls) {
      if (!url.startsWith(SITE)) bad.push(`${page}: ${key} host (${url})`);
      if (/\.html$/.test(url)) bad.push(`${page}: ${key} ends in .html (${url})`);
      if (url.includes('/../') || url.includes('//shop') || url.includes('example.com')) bad.push(`${page}: ${key} malformed (${url})`);
    }
    const expectedCanonical = page === 'index.html' ? `${SITE}/` : `${SITE}/${page.replace(/\.html$/, '')}`;
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
    if (canonical !== expectedCanonical) bad.push(`${page}: canonical is ${canonical}, expected ${expectedCanonical}`);
  }
  if (bad.length) throw new Error(bad.slice(0, 10).join('; '));
  return `${PAGES.length} pages self-reference their clean URL`;
});

check('og:image is absolute, normalised and exists', () => {
  const bad = [];
  for (const page of PAGES) {
    const html = read(page);
    const img = (html.match(/<meta property="og:image" content="([^"]+)">/) || [])[1];
    if (!img) { bad.push(`${page}: missing`); continue; }
    if (!img.startsWith(SITE + '/')) bad.push(`${page}: host (${img})`);
    if (img.includes('/../') || img.includes('/./')) bad.push(`${page}: not normalised (${img})`);
    const local = img.slice((SITE + '/').length);
    if (!exists(local)) bad.push(`${page}: file missing (${local})`);
  }
  if (bad.length) throw new Error(bad.slice(0, 10).join('; '));
  return `${PAGES.length} pages point at a real image`;
});

/* ---------- host config ---------- */
check('vercel.json still enables clean URLs', () => {
  const cfg = JSON.parse(read('vercel.json'));
  if (cfg.cleanUrls !== true) throw new Error('cleanUrls is not true');
  if (cfg.trailingSlash !== false) throw new Error('trailingSlash is not false');
  return 'cleanUrls + no trailing slash';
});

check('robots.txt points at the sitemap and hides the cart clean URL', () => {
  const txt = read('robots.txt');
  if (!txt.includes(`Sitemap: ${SITE}/sitemap.xml`)) throw new Error('sitemap line missing or wrong host');
  const disallow = [...txt.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);
  if (!disallow.includes('/cart')) throw new Error(`cart not disallowed (found: ${disallow.join(', ') || 'none'})`);
  return `sitemap advertised, disallow: ${disallow.join(' ')}`;
});

check('Vercel config builds and serves the same export', () => {
  const cfg = JSON.parse(read('vercel.json'));
  if (cfg.cleanUrls !== true) throw new Error('cleanUrls is not true');
  if (cfg.trailingSlash !== false) throw new Error('trailingSlash is not false');
  if (cfg.buildCommand !== 'npm run build') throw new Error(`buildCommand is "${cfg.buildCommand}", expected "npm run build"`);
  if (cfg.outputDirectory !== 'dist') throw new Error(`outputDirectory is "${cfg.outputDirectory}", expected "dist"`);
  return 'builds dist/ and serves it with clean URLs';
});

check('Vercel and Cloudflare apply the same security headers', () => {
  const vercel = JSON.parse(read('vercel.json'));
  if (!read('scripts/build-site.mjs').includes("'_headers'")) throw new Error('Cloudflare _headers file is not included in the static export');
  const rule = (vercel.headers || []).find((entry) => entry.source === '/(.*)');
  if (!rule) throw new Error('Vercel has no catch-all security-header rule');
  const vercelHeaders = new Map((rule.headers || []).map((header) => [header.key.toLowerCase(), header.value]));
  const cloudflareHeaders = new Map();
  for (const line of read('_headers').split(/\r?\n/)) {
    const match = line.match(/^\s{2}([^:\s]+):\s*(.+)$/);
    if (match) cloudflareHeaders.set(match[1].toLowerCase(), match[2]);
  }
  const required = [
    'content-security-policy', 'referrer-policy', 'x-content-type-options',
    'x-frame-options', 'permissions-policy', 'strict-transport-security',
    'cross-origin-opener-policy',
  ];
  for (const name of required) {
    const a = vercelHeaders.get(name);
    const b = cloudflareHeaders.get(name);
    if (!a || !b || a !== b) throw new Error(`${name} differs or is missing (Vercel: ${a || 'missing'}, Cloudflare: ${b || 'missing'})`);
  }
  const csp = vercelHeaders.get('content-security-policy');
  const directives = new Map(csp.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values.join(' ')];
  }));
  const requiredDirectives = {
    'default-src': "'self'", 'base-uri': "'self'", 'object-src': "'none'",
    'script-src': "'self'", 'script-src-attr': "'none'",
    'frame-ancestors': "'none'", 'form-action': "'self'",
  };
  for (const [name, value] of Object.entries(requiredDirectives)) {
    if (directives.get(name) !== value) throw new Error(`CSP ${name} must be ${value}`);
  }
  if (!directives.has('upgrade-insecure-requests')) throw new Error('CSP must upgrade insecure requests');
  return `${required.length} matching response headers; CSP blocks inline scripts, objects and framing`;
});

check('every page uses only external scripts under the strict CSP', () => {
  const bad = [];
  for (const page of PAGES) {
    const html = read(page);
    const depth = page.includes('/') ? '../' : '';
    if (!html.includes(`<script src="${depth}assets/js/theme-init.js"></script>`)) bad.push(`${page}: theme initializer`);
    for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
      if (!/\bsrc\s*=/.test(match[1])) bad.push(`${page}: inline script`);
    }
    if (/\son[a-z][a-z0-9_-]*\s*=/i.test(html)) bad.push(`${page}: inline event handler`);
    if (/(?:href|src)\s*=\s*["']?\s*javascript\s*:/i.test(html)) bad.push(`${page}: javascript URL`);
  }
  if (bad.length) throw new Error(bad.slice(0, 8).join('; '));
  return `${PAGES.length} pages have no inline JavaScript, event handlers or javascript: URLs`;
});

check('new-tab links prevent access to the opener', () => {
  const bad = [];
  let checked = 0;
  for (const page of PAGES) {
    for (const match of read(page).matchAll(/<a\b[^>]*>/gi)) {
      const tag = match[0];
      if (!/\btarget="_blank"/i.test(tag)) continue;
      checked++;
      const rel = (tag.match(/\brel="([^"]*)"/i) || [])[1] || '';
      if (!/(?:^|\s)noopener(?:\s|$)/i.test(rel)) bad.push(`${page}: ${tag.slice(0, 100)}`);
    }
  }
  if (bad.length) throw new Error(bad.slice(0, 5).join('; '));
  return `${checked} new-tab links use rel=noopener`;
});

check('Cloudflare Worker config matches the build output', () => {
  const cfg = JSON.parse(read('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''));
  if (cfg.name !== 'bagged-up') throw new Error(`worker name is "${cfg.name}", expected "bagged-up"`);
  const dir = (cfg.assets || {}).directory;
  if (dir !== './dist') throw new Error(`assets.directory is "${dir}", expected "./dist"`);
  if (!(cfg.build && cfg.build.command)) throw new Error('no build.command: a Cloudflare build would upload a non-existent directory');
  if (cfg.preview_urls !== true) throw new Error('preview_urls is off: branch builds would not publish a preview URL');
  if ((cfg.assets || {}).html_handling !== 'drop-trailing-slash') {
    throw new Error('html_handling must stay "drop-trailing-slash" to match the clean URLs used in canonicals and the sitemap');
  }
  const builder = read('scripts/build-site.mjs');
  const out = (builder.match(/const DIST = path\.join\(ROOT, '([^']+)'\)/) || [])[1];
  if (out !== 'dist') throw new Error(`scripts/build-site.mjs writes to "${out}" but the Worker serves "./${'dist'}"`);
  return `worker "${cfg.name}" serves ./dist, cleanup: ${cfg.assets.html_handling}`;
});

check('no em dashes in shipped copy', () => {
  // House rule: em dashes read as machine-written. \u2014 is the em dash,
  // \u2013 the en dash, which stays for genuine ranges like "1–3 days".
  const EM = '\u2014';
  const scan = [
    ...PAGES,
    ...fs.readdirSync(path.join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js')).map((f) => `assets/js/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs')).map((f) => `scripts/${f}`),
    'assets/css/style.css', 'README.md', 'wrangler.jsonc', 'robots.txt', 'sitemap.xml',
    'package.json', 'eslint.config.mjs', '.github/workflows/ci.yml',
    ...walk('docs'), ...walk('design'),
  ];
  const bad = [];
  for (const file of scan) {
    const text = read(file);
    const n = (text.match(new RegExp(EM, 'g')) || []).length;
    if (n) bad.push(`${file} (${n})`);
    const entities = ['&' + 'mdash;', '&#' + '8212;', '&#x' + '2014;'];
    if (entities.some((e) => text.toLowerCase().includes(e))) bad.push(`${file} (HTML entity)`);
  }
  if (bad.length) throw new Error(bad.slice(0, 10).join(', '));
  const en = PAGES.reduce((n, p) => n + (read(p).match(/\u2013/g) || []).length, 0);
  return `${scan.length} files clean (en dashes kept for ranges: ${en})`;
});

check('no tooling or build state is tracked by git', () => {
  let tracked;
  try {
    tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return 'skipped (git not available)';
  }
  const junk = tracked.filter((f) => /^(?:node_modules|dist|\.wrangler|\.next|coverage|\.cache)\//.test(f));
  if (junk.length) throw new Error(`${junk.length} tracked path(s), e.g. ${junk.slice(0, 5).join(', ')}`);
  return `${tracked.length} tracked files, no tooling state`;
});

check('sitemap.xml is well-formed and on the live host', () => {
  const xml = read('sitemap.xml');
  if (!/^<\?xml/.test(xml.trim())) throw new Error('missing XML declaration');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const offHost = locs.filter((l) => !l.startsWith(SITE));
  if (offHost.length) throw new Error(offHost.slice(0, 5).join(', '));
  const open = (xml.match(/<url>/g) || []).length;
  const close = (xml.match(/<\/url>/g) || []).length;
  if (open !== close) throw new Error(`unbalanced <url> tags (${open}/${close})`);
  return `${locs.length} URLs, all on ${SITE}`;
});

/* ---------- shipped JS ---------- */
check('every product page wires its own add-to-bag button', () => {
  const bad = [];
  for (const page of SCRIPT_PAGES) {
    const slug = path.basename(page, '.html');
    if (!read(page).includes(`data-add="${slug}"`)) bad.push(page);
  }
  if (bad.length) throw new Error(bad.slice(0, 5).join(', '));
  return `${SCRIPT_PAGES.length} pages have data-add`;
});

check('product pages load the catalogue and app script', () => {
  const bad = [];
  for (const page of PAGES) {
    const html = read(page);
    const depth = page.includes('/') ? '../' : '';
    if (!html.includes(`src="${depth}assets/js/data.js"`)) bad.push(`${page}: data.js`);
    if (!html.includes(`src="${depth}assets/js/app.js"`)) bad.push(`${page}: app.js`);
  }
  if (bad.length) throw new Error(bad.join('; '));
  return 'catalogue + behaviour loaded everywhere';
});

check('the WhatsApp checkout number is consistent', () => {
  const numbers = new Set();
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/wa\.me\/(\d+)/g)) numbers.add(m[1]);
  }
  const app = [...read('assets/js/app.js').matchAll(/WA_NUMBER\s*=\s*'(\d+)'/g)].map((m) => m[1]);
  for (const n of app) numbers.add(n);
  if (numbers.size !== 1) throw new Error(`mixed numbers: ${[...numbers].join(', ')}`);
  return `one number everywhere: ${[...numbers][0]}`;
});

/* ---------- report ---------- */
check('CI workflow files parse as YAML with jobs', () => {
  const dir = path.join(ROOT, '.github', 'workflows');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (!files.length) throw new Error('no workflow files found in .github/workflows');
  const summary = files.map((f) => {
    const doc = yamlLoad(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!doc || typeof doc.jobs !== 'object' || !Object.keys(doc.jobs).length) {
      throw new Error(`${f} parsed but has no jobs`);
    }
    return `${f} (${Object.keys(doc.jobs).length} job)`;
  });
  return summary.join(', ');
});

check('GitHub Actions are pinned to immutable commit SHAs', () => {
  const refs = [...read('.github/workflows/ci.yml').matchAll(/^\s*- uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  const mutable = refs.filter((ref) => !/^[^@]+@[0-9a-f]{40}$/i.test(ref));
  if (!refs.length || mutable.length) throw new Error(`unpinned refs: ${mutable.join(', ') || 'no action refs found'}`);
  return `${refs.length} actions pinned to full SHAs`;
});

check('CI runs with read-only permissions and skips install scripts', () => {
  const cfg = yamlLoad(read('.github/workflows/ci.yml'));
  if (!cfg.permissions || cfg.permissions.contents !== 'read' || Object.keys(cfg.permissions).length !== 1) {
    throw new Error('workflow permissions are not restricted to contents: read');
  }
  const steps = cfg.jobs.gate.steps;
  const checkout = steps.find((step) => String(step.uses || '').startsWith('actions/checkout@'));
  if (!checkout || !checkout.with || checkout.with['persist-credentials'] !== false) {
    throw new Error('checkout credentials are persisted');
  }
  if (!steps.some((step) => step.run === 'npm ci --ignore-scripts')) throw new Error('npm install lifecycle scripts are not disabled');
  if (!steps.some((step) => /npm audit --audit-level=low/.test(step.run || ''))) throw new Error('dependency audit is missing');
  return 'contents:read only, no persisted checkout token, locked install scripts disabled';
});

check('Dependabot checks npm and GitHub Actions updates weekly', () => {
  const cfg = yamlLoad(read('.github/dependabot.yml'));
  if (!cfg || cfg.version !== 2 || !Array.isArray(cfg.updates)) throw new Error('invalid Dependabot v2 config');
  for (const ecosystem of ['npm', 'github-actions']) {
    const update = cfg.updates.find((entry) => entry['package-ecosystem'] === ecosystem && entry.directory === '/');
    if (!update || !update.schedule || update.schedule.interval !== 'weekly') {
      throw new Error(`${ecosystem} updates are not scheduled weekly`);
    }
  }
  return 'npm dependencies and action SHA pins have weekly update PRs';
});

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
console.log('\nBagged Up - storefront integrity suite\n');
for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${pad(c.name, 52)} ${c.detail}`);
for (const note of info) console.log(`  NOTE  ${note}`);
console.log(`\n  ${checks.filter((c) => c.ok).length}/${checks.length} checks passed\n`);

if (failures.length) {
  console.error('Failures:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  process.exit(1);
}
