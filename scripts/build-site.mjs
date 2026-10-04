#!/usr/bin/env node
/**
 * Bagged Up - static export check.
 *
 * The hosts (Vercel / Cloudflare) can serve this folder exactly as it is, so
 * there is no compile step. What this script does instead is prove the site is
 * deployable: it assembles the published file set into dist/, asserts nothing
 * that belongs to development (tooling, tests, docs, CI) leaks into it, and
 * re-checks that every link and asset resolves *inside the export*.
 *
 *   node scripts/build-site.mjs        (or: npm run build)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const PUBLISH = [
  'index.html', 'shop.html', 'cart.html', 'about.html', 'reviews.html', 'contact.html',
  'faq.html', 'delivery.html', 'returns.html', 'privacy.html', 'terms.html',
  'robots.txt', 'sitemap.xml', 'vercel.json',
];
const DEV_ONLY = [
  'package.json', 'package-lock.json', 'README.md', 'scripts', 'node_modules',
  'dist', '.github', '.gitignore', '.gitattributes', 'eslint.config.mjs',
  'jsconfig.json', '.htmlvalidate.json', '.wrangler', 'wrangler.jsonc',
  'design', 'docs',.
];

function fail(msg) {
  console.error(`\n  FAIL  ${msg}\n`);
  process.exit(1);
}

/* ---------- assemble ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const files = [];
function copy(from, to) {
  const src = path.join(ROOT, from);
  const dst = path.join(DIST, to);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) copy(path.join(from, entry), path.join(to, entry));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    files.push({ rel: to, bytes: stat.size });
  }
}

for (const f of PUBLISH) copy(f, f);
copy('shop', 'shop');
copy('assets', 'assets');

/* ---------- verify the export ---------- */
const pages = files.filter((f) => f.rel.endsWith('.html')).map((f) => f.rel);
const missing = PUBLISH.filter((f) => !f.endsWith('.html') && !fs.existsSync(path.join(DIST, f)));
if (missing.length) fail(`export is missing: ${missing.join(', ')}`);
if (pages.length !== 61) fail(`expected 61 pages in the export, found ${pages.length}`);

for (const dev of DEV_ONLY) {
  if (fs.existsSync(path.join(DIST, dev))) fail(`development file leaked into the export: ${dev}`);
}

let broken = [];
let checked = 0;
for (const page of pages) {
  const dir = path.dirname(path.join(DIST, page));
  const html = fs.readFileSync(path.join(DIST, page), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]*)"/g)) {
    const ref = m[1];
    if (!ref || /^(?:https?:|mailto:|tel:|data:|whatsapp:|javascript:|\/\/)/.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    checked++;
    if (!fs.existsSync(path.resolve(dir, clean))) broken.push(`${page} → ${ref}`);
  }
}

const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
const biggest = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

console.log('\nBagged Up - static export check\n');
console.log(`  pages exported      ${pages.length}`);
console.log(`  files exported      ${files.length}`);
console.log(`  output size         ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`  largest files       ${biggest.map((f) => `${f.rel} (${kb(f.bytes)})`).join(', ')}`);
console.log(`  references checked  ${checked}`);

if (broken.length) fail(`${broken.length} reference(s) do not resolve inside dist/:\n    ${broken.slice(0, 10).join('\n    ')}`);

console.log('  result              self-contained export in dist/\n');
