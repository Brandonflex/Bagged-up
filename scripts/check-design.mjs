#!/usr/bin/env node
/**
 * Bagged Up - design system check.
 *
 * Keeps three things honest:
 *   1. design/tokens.json and assets/css/style.css agree, both directions, so
 *      the documented palette cannot drift from the shipped one.
 *   2. The two dark-theme blocks in the stylesheet stay identical (the OS
 *      media query and the explicit [data-theme="dark"] override).
 *   3. Every declared contrast pair still meets its WCAG minimum, computed
 *      from the values actually in the stylesheet, not from the docs.
 *   4. The brand marks exist, carry a viewBox, use no <text>, and only use
 *      palette colours.
 *
 *   node scripts/check-design.mjs      (part of: npm run verify)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- colour maths (WCAG 2.1) ---------- */
const toRgb = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const isOpaqueColour = (v) => /^#[0-9A-Fa-f]{3,6}$/.test(v.trim());

/* ---------- parse the stylesheet ---------- */
const css = read('assets/css/style.css');

function declarationsIn(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function blockAfter(marker) {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`stylesheets marker not found: ${marker}`);
  const open = css.indexOf('{', start);
  // match braces so nested rules do not confuse us
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces after ${marker}`);
}

const cssLight = declarationsIn(blockAfter(':root {'));
const darkMedia = declarationsIn(blockAfter('@media (prefers-color-scheme: dark)'));
const darkOverride = declarationsIn(blockAfter(':root[data-theme="dark"]'));

const tokens = JSON.parse(read('design/tokens.json'));
const failures = [];
const checks = [];

const fail = (msg) => failures.push(msg);
/* a group reports PASS only if it added no failures */
function group(name, detail) {
  checks.push({ name, detail, ok: failures.length === startCount });
}
let startCount = 0;

/* ---------- 1. light tokens match ---------- */
startCount = failures.length;
{
  const doc = tokens.tokens.light;
  const missingInCss = Object.keys(doc).filter((k) => !(k in cssLight));
  const missingInDoc = Object.keys(cssLight).filter((k) => !(k in doc));
  const different = Object.keys(doc)
    .filter((k) => k in cssLight && cssLight[k] !== doc[k])
    .map((k) => `${k}: css "${cssLight[k]}" vs tokens "${doc[k]}"`);
  if (missingInCss.length) fail(`in tokens.light but not in the stylesheet: ${missingInCss.join(', ')}`);
  if (missingInDoc.length) fail(`in the stylesheet but not in tokens.light: ${missingInDoc.join(', ')}`);
  if (different.length) fail(`light token mismatch: ${different.join('; ')}`);
  group('light tokens match the stylesheet', `${Object.keys(doc).length} tokens, both directions`);
}

/* ---------- 2. dark tokens match, and both dark blocks agree ---------- */
startCount = failures.length;
{
  const doc = tokens.tokens.dark;
  const missingInCss = Object.keys(doc).filter((k) => !(k in darkMedia));
  const missingInDoc = Object.keys(darkMedia).filter((k) => !(k in doc));
  const different = Object.keys(doc)
    .filter((k) => k in darkMedia && darkMedia[k] !== doc[k])
    .map((k) => `${k}: css "${darkMedia[k]}" vs tokens "${doc[k]}"`);
  if (missingInCss.length) fail(`in tokens.dark but not in the stylesheet: ${missingInCss.join(', ')}`);
  if (missingInDoc.length) fail(`in the dark block but not in tokens.dark: ${missingInDoc.join(', ')}`);
  if (different.length) fail(`dark token mismatch: ${different.join('; ')}`);

  const drift = [...new Set([...Object.keys(darkMedia), ...Object.keys(darkOverride)])]
    .filter((k) => darkMedia[k] !== darkOverride[k]);
  if (drift.length) fail(`the two dark blocks disagree: ${drift.join(', ')}`);

  group('dark tokens match, both blocks agree', `${Object.keys(doc).length} overrides`);
}

/* ---------- 3. contrast pairs ---------- */
startCount = failures.length;
{
  const rows = [];
  for (const pair of tokens.contrast) {
    const theme = tokens.tokens[pair.theme];
    const fg = theme[pair.fg];
    const bg = theme[pair.bg];
    if (!fg || !bg) {
      fail(`contrast pair "${pair.name}" (${pair.theme}) references an unknown token`);
      continue;
    }
    if (!isOpaqueColour(fg) || !isOpaqueColour(bg)) {
      rows.push({ ...pair, ratio: null });
      continue;
    }
    const ratio = contrast(fg, bg);
    rows.push({ ...pair, ratio, fgHex: fg, bgHex: bg });
    if (ratio < pair.min) {
      fail(`${pair.theme} ${pair.name}: ${ratio.toFixed(2)}:1, needs ${pair.min}:1 (${fg} on ${bg})`);
    }
  }
  group('contrast pairs meet their minimum', `${rows.filter((r) => r.ratio).length} measured, ${rows.filter((r) => !r.ratio).length} alpha skipped`);
  if (process.argv.includes('--report')) {
    console.log('\ncontrast report:');
    for (const r of rows) {
      const value = r.ratio ? `${r.ratio.toFixed(2)}:1` : 'alpha (n/a)';
      console.log(`  ${r.theme.padEnd(5)} ${r.name.padEnd(28)} ${String(r.fgHex || r.fg).padEnd(9)} on ${String(r.bgHex || r.bg).padEnd(9)} ${value}`);
    }
  }
}

/* ---------- 4. brand marks ---------- */
startCount = failures.length;
{
  const dir = path.join(ROOT, 'design/brand');
  const marks = ['wordmark.svg', 'wordmark-reverse.svg', 'monogram.svg', 'favicon.svg'];
  const missing = marks.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) fail(`missing brand mark(s): ${missing.join(', ')}`);

  const approved = new Set(
    Object.values(tokens.tokens).flatMap((theme) => Object.values(theme))
      .filter(isOpaqueColour)
      .map((c) => c.toUpperCase())
  );
  for (const f of marks) {
    const file = path.join(dir, f);
    if (!fs.existsSync(file)) continue;
    const svg = fs.readFileSync(file, 'utf8');
    const used = [...svg.matchAll(/#[0-9A-Fa-f]{3,6}/g)].map((m) => m[0].toUpperCase());
    const offPalette = used.filter((c) => !approved.has(c));
    if (offPalette.length) fail(`${f} uses off-palette colour(s): ${[...new Set(offPalette)].join(', ')}`);
    if (!/<svg[^>]*viewBox="/.test(svg)) fail(`${f} has no viewBox, so it cannot be scaled`);
    if (/<text[\s>]/.test(svg)) {
      fail(`${f} draws its lettering as <text>, which only renders correctly where that font is installed; outline it to a path`);
    }
  }
  group('brand marks exist, scale, and stay on palette', `${marks.length} marks, ${approved.size} approved colours`);
}

/* ---------- 5. every var() reference resolves ---------- */
startCount = failures.length;
{
  const declared = new Set([...Object.keys(cssLight), ...Object.keys(darkMedia), ...Object.keys(darkOverride)]);
  // custom properties set inline in markup (--d, --montage-n, ...) or by app.js
  const html = [...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
    ...fs.readdirSync(path.join(ROOT, 'shop')).filter((f) => f.endsWith('.html')).map((f) => `shop/${f}`)]
    .map((f) => read(f)).join('\n');
  const inline = new Set([...html.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const appJs = read('assets/js/app.js');
  for (const m of appJs.matchAll(/setProperty\(\s*'--([a-z0-9-]+)'/g)) inline.add(m[1]);

  const unresolved = new Set();
  for (const m of css.matchAll(/var\(\s*--([a-z0-9-]+)\s*([,)])/g)) {
    const name = m[1];
    const hasFallback = m[2] === ',';
    if (hasFallback) continue;
    if (!declared.has(name) && !inline.has(name)) unresolved.add(name);
  }
  if (unresolved.size) fail(`var() with no declaration and no fallback: ${[...unresolved].join(', ')}`);
  group('every var() reference resolves', `${declared.size} tokens declared, ${inline.size} set in markup/JS`);
}

/* ---------- 6. raw colours outside the token blocks are deliberate ---------- */
startCount = failures.length;
{
  // a raw colour that is not a token cannot flip with the theme, so every one
  // of them has to be on this list with a reason. Anything that is not is
  // either a bug (it will drift in the other theme) or a token that was
  // never declared.
  const allow = {
    '#F5F1E9': 'ivory text on the always-dark surfaces: hero, footer, .on-dark, flags, lightbox',
    '#C9B99A': 'tan icons on the always-dark surfaces (hero strip, footer, lightbox)',
    '#FAF7F1': 'hero headline, which sits on --bg-dark in both themes',
    '#E9DDC8': 'hero accent word, on --bg-dark in both themes',
    '#F7F3EB': 'hero caption, on --bg-dark in both themes',
    '#EFE9DE': 'footer text, footer is --bg-dark in both themes',
    '#fff': 'footer link hover, footer is always dark',
    '#F4F6F0': 'text on the green pill; the green token carries a dark override that keeps the contrast',
    'rgba(250,247,241,0.55)': '.overline.light, used on always-dark surfaces',
    'rgba(250,247,241,0.72)': '.on-dark .overline, used on always-dark surfaces',
    'rgba(250,247,241,0.7)': '.text-link.light, only used on always-dark surfaces',
    'rgba(250,247,241,0.78)': 'hero subline, on --bg-dark in both themes',
    'rgba(250,247,241,0.8)': 'hero strip, on --bg-dark in both themes',
    'rgba(250,247,241,0.6)': '.review-by on the homepage, which sits in an always-dark section',
    'rgba(245,241,233,0.62)': 'footer, always dark',
    'rgba(245,241,233,0.78)': 'footer links and contact lines, always dark',
    'rgba(245,241,233,0.5)': 'footer fine print, always dark',
    'rgba(24,18,13,0.9)': 'hero scrim over the photo',
    'rgba(24,18,13,0.62)': 'hero scrim over the photo',
    'rgba(24,18,13,0.08)': 'hero scrim over the photo',
    'rgba(24,18,13,0.24)': 'hero primary CTA shadow over the campaign photo',
    'rgba(24,18,13,0.42)': 'hero scrim over the photo',
    'rgba(24,18,13,0.55)': 'hero and montage scrim over the photo',
    'rgba(24,18,13,0.66)': 'hero caption scrim over the photo',
    'rgba(24,18,13,0)': 'scrim gradient stop over the photo',
    'rgba(33,27,21,0.4)': 'shadow under the open nav panel',
    'rgba(33,27,21,0.75)': 'sold out flag, dark in both themes',
    'rgba(46,58,38,0.55)': 'shadow of the WhatsApp button',
    'rgba(255,252,244,0.16)': 'the tilt highlight over a card photo',
    'rgba(16,12,9,0.96)': 'lightbox backdrop, always dark',
    'rgba(250,247,241,0.3)': 'lightbox nav border over the dark backdrop',
    'rgba(250,247,241,0.12)': 'lightbox nav hover over the dark backdrop',
    'rgba(0,0,0,0.5)': 'text shadow over photos',
  };
  const norm = (v) => v.replace(/\s+/g, '');
  const tokenBlocks = [':root {', ':root:not([data-theme="light"]) {', ':root[data-theme="dark"] {']
    .map((marker) => {
      const start = css.indexOf(marker);
      const open = css.indexOf('{', start);
      let depth = 0;
      for (let i = open; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) return [open + 1, i]; }
      }
      throw new Error(`unbalanced braces after ${marker}`);
    });
  const inTokenBlock = (pos) => tokenBlocks.some(([a, b]) => pos >= a && pos < b);

  const found = new Map();
  const lines = css.split('\n');
  let offset = 0;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    for (const m of line.matchAll(/(#[0-9A-Fa-f]{3,6}\b|rgba?\([^)]*\))/g)) {
      if (!inTokenBlock(offset + m.index)) {
        const v = norm(m[1]);
        const at = found.get(v) || [];
        at.push(n + 1);
        found.set(v, at);
      }
    }
    offset += line.length + 1;
  }
  const unlisted = [...found.entries()].filter(([v]) => !(v in allow));
  const stale = Object.keys(allow).filter((v) => !found.has(v));
  if (unlisted.length) fail(`raw colour outside the token blocks with no entry in the allow list: ${unlisted.map(([v, ls]) => `${v} (line ${ls[0]})`).join('; ')}`);
  if (stale.length) fail(`allow list entries that no longer match anything in the stylesheet: ${stale.join(', ')}`);
  group('raw colours outside tokens are deliberate', `${found.size} raw colours, all accounted for`);
}

/* ---------- 7. the product page follows the documented scale ---------- */
startCount = failures.length;
{
  // The product page carries the most components, so it is the surface where
  // a one-off size or gap is most likely to creep in and the rhythm to fall
  // apart. Everything here is read from the docs: a step added to
  // tokens.json is allowed everywhere, without touching this check.
  const PDP = /^(\.pdp|\.fr-|\.full-review|\.carry-|\.spec-|\.mini-assure|\.assure|\.rail|\.sticky-atc|\.eta\b|\.free-bar|\.saved-|\.wa-band|\.review-|\.stock|\.scarcity|\.card-name)/;

  const fixedSizes = new Set(
    Object.values(tokens.type.scale)
      .filter((v) => /^\d/.test(v))
      .map((v) => v.match(/^(\d+\.?\d*)rem/)[1] + 'rem')
  );
  const steps = new Set(
    tokens.space.steps.split('rem;')[0].split('/').map((v) => v.trim() + 'rem')
  );

  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const walk = (text) => {
    let i = 0;
    while (i < text.length) {
      const brace = text.indexOf('{', i);
      if (brace < 0) break;
      const sel = text.slice(i, brace).trim();
      let depth = 1;
      let j = brace + 1;
      while (j < text.length && depth) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(brace + 1, j - 1);
      if (sel.startsWith('@')) walk(body);
      else rules.push([sel, body]);
      i = j;
    }
  };
  walk(clean);

  const off = [];
  for (const [sel, body] of rules) {
    if (!PDP.test(sel.split(',')[0].trim())) continue;
    for (const m of body.matchAll(/font-size:\s*([^;]+);/g)) {
      const v = m[1].trim();
      if (v.startsWith('clamp(') || fixedSizes.has(v)) continue;
      off.push(`${sel.split(',')[0].trim()}: font-size ${v} is not on the type scale`);
    }
    for (const m of body.matchAll(/(?:margin[a-z-]*|padding[a-z-]*|gap)\s*:\s*([^;]+);/g)) {
      for (const v of m[1].matchAll(/(-?\d+\.?\d*)rem/g)) {
        if (!steps.has(v[1] + 'rem')) {
          off.push(`${sel.split(',')[0].trim()}: spacing ${v[1]}rem is not on the space scale`);
        }
      }
    }
  }
  if (off.length) fail(`${off.length} value(s) off the documented scale: ${off.slice(0, 6).join('; ')}${off.length > 6 ? ` and ${off.length - 6} more` : ''}`);
  group('product page follows the documented scale', `${fixedSizes.size} type steps, ${steps.size} space steps, all product-page values on them`);
}

/* ---------- report ---------- */
console.log('\nBagged Up - design system check\n');
for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(42)} ${c.detail}`);
console.log(`\n  ${checks.filter((c) => c.ok).length}/${checks.length} groups passed\n`);
if (failures.length) {
  console.error('Failures:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  process.exit(1);
}
