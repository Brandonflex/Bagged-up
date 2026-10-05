#!/usr/bin/env node
/**
 * Bagged Up - change the WhatsApp / contact number everywhere.
 *
 * The number is baked into the pre-rendered pages in two forms:
 *   - 254XXXXXXXXX        inside every wa.me/ link, and in assets/js/app.js
 *   - +254 XXX XXX XXX    as the human-readable text beside those links
 *
 * Hand-editing 800+ occurrences is exactly how a site ends up with "Ask about
 * this bag" buttons that still message the previous owner, so this does the
 * whole tree in one pass. The current number is detected from app.js, so the
 * script can be run again whenever the number changes.
 *
 *   node scripts/set-contact.mjs 254712345678
 *   node scripts/set-contact.mjs 0712345678
 *   node scripts/set-contact.mjs "+254 712 345 678"
 *
 * Then rebuild and re-zip:
 *   npm run verify && npm run build   (see handover/START-HERE.html)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_JS = path.join(ROOT, 'assets', 'js', 'app.js');

/* ---------- discover the number currently baked in ---------- */
function currentNumber() {
  const src = fs.readFileSync(APP_JS, 'utf8');
  const m = src.match(/var\s+WA_NUMBER\s*=\s*['"](\d+)['"]/);
  if (!m) {
    console.error(`\n  FAIL  couldn't find "var WA_NUMBER = '...'" in assets/js/app.js\n`);
    process.exit(1);
  }
  return m[1];
}

/* ---------- normalise whatever they typed into 254XXXXXXXXX ---------- */
function normalise(input, fallback) {
  let d = String(input).replace(/^\+/, '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '254' + d.slice(1);
  if (d.length === 9) d = '254' + d;
  if (!/^254\d{9}$/.test(d)) {
    if (fallback && /^254\d{9}$/.test(fallback)) return fallback;
    console.error(`\n  FAIL  can't read "${input}" as a Kenyan number.`);
    console.error('        Try 0712345678, 254712345678, or +254 712 345 678\n');
    process.exit(1);
  }
  return d;
}

/** 254712345678 -> "+254 712 345 678" */
function display(d) {
  return `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
}

const arg = process.argv[2];
if (!arg || arg === '--help' || arg === '-h') {
  const now = fs.existsSync(APP_JS) ? currentNumber() : null;
  console.log('\n  Usage: node scripts/set-contact.mjs <new-number>');
  console.log('  e.g.   node scripts/set-contact.mjs 0712345678');
  if (now) console.log(`\n  Current number on the site: ${display(now)}  (${now})\n`);
  process.exit(arg ? 0 : 1);
}

const from = currentNumber();
const to = normalise(arg, null);
if (to === from) {
  console.log(`\n  Site is already on ${display(from)} - nothing to do.\n`);
  process.exit(0);
}

const fromDisplay = display(from);
const toDisplay = display(to);

/* ---------- walk the tree ---------- */
const SKIP = new Set(['node_modules', '.git', 'dist', '.wrangler', 'handover', 'docs', 'design']);
// Never rewrite this script - it quotes example numbers in its own comments.
const SELF = path.resolve(fileURLToPath(import.meta.url));
const countIn = (hay, needle) => hay.split(needle).length - 1;

let files = 0, hits = 0;
const touched = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(html|js|json|xml)$/.test(entry.name)) continue;
    if (path.resolve(full) === SELF) continue;

    const before = fs.readFileSync(full, 'utf8');
    // Display form first, so a compact match never lands inside a half-rewritten string.
    let after = before.split(fromDisplay).join(toDisplay);
    after = after.split(from).join(to);

    if (after !== before) {
      const n = countIn(before, from) + countIn(before, fromDisplay);
      fs.writeFileSync(full, after);
      files++; hits += n;
      touched.push(`  ${path.relative(ROOT, full).padEnd(46)} ${n}`);
    }
  }
}

walk(ROOT);

if (!files) {
  console.log(`\n  No occurrences of ${from} found - already changed?\n`);
  process.exit(0);
}

console.log('\nContact number updated\n');
console.log(`  old   ${fromDisplay}  (${from})`);
console.log(`  new   ${toDisplay}  (${to})`);
console.log(`\n  files changed   ${files}`);
console.log(`  occurrences     ${hits}\n`);
console.log(touched.slice(0, 12).join('\n'));
if (touched.length > 12) console.log(`  ... and ${touched.length - 12} more`);
console.log(`
  Next:
    npm run verify          # proves nothing else broke
    npm run build           # rebuild dist/
    then re-zip dist/ into handover/Bagged-Up-website.zip
`);
