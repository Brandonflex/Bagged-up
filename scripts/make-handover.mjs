#!/usr/bin/env node
/**
 * Bagged Up - rebuild the non-technical handover pack.
 *
 * Produces everything a non-technical owner needs in one folder, ready to be
 * emailed, dropped on a USB stick or shared on Drive:
 *
 *   handover/Bagged-Up-website.zip      the live site, index.html at the root
 *   handover/Bagged-Up-price-list.csv   all products + prices, opens in Excel
 *   handover/START-HERE.html            plain-English guide (date-stamped)
 *
 *   npm run handover
 *
 * The zip is written with no external tools so it works on Windows too. Files
 * are stored uncompressed: the payload is almost entirely JPEG, which is
 * already compressed, so deflating it would save ~3% and cost a dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'handover');
const ZIP_NAME = 'Bagged-Up-website.zip';
const CSV_NAME = 'Bagged-Up-price-list.csv';
const GUIDE_NAME = 'START-HERE.html';

function fail(msg) {
  console.error(`\n  FAIL  ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  fail('dist/ is missing or incomplete - run `npm run build` first.');
}

const today = new Date().toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
});

/* ---------------------------- zip (store, no deps) ---------------------------- */
const crc = zlib.crc32
  ? (buf) => zlib.crc32(buf)
  : (() => {
      const table = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
      }
      return (buf) => {
        let c = -1;
        for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        return (c ^ -1) >>> 0;
      };
    })();

/** Fixed timestamp: 1980-01-01 00:00 - keeps the zip byte-identical between runs. */
const DOS_TIME = 0;      // 00:00:00
const DOS_DATE = 0x0021; // 1980-01-01

function collect(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...collect(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

function zipFolder(dir, dest) {
  const names = collect(dir);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const name of names) {
    const data = fs.readFileSync(path.join(dir, name));
    const nameBuf = Buffer.from(name, 'utf8');
    const sum = crc(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);        // version needed
    local.writeUInt16LE(0, 6);         // flags
    local.writeUInt16LE(0, 8);         // method: store
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);        // extra length
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);      // version made by
    central.writeUInt16LE(20, 6);      // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);      // method: store
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(sum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);      // extra
    central.writeUInt16LE(0, 32);      // comment
    central.writeUInt16LE(0, 34);      // disk
    central.writeUInt16LE(0, 36);      // internal attrs
    central.writeUInt32LE(0, 38);      // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(dest, Buffer.concat([...locals, centralBuf, end]));
  return names.length;
}

/* ---------------------------- price list ---------------------------- */
function products() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'data.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
}

function writeCsv() {
  const p = products();
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['Product', 'Category', 'Price (KSh)', 'Photos', 'Page']];
  for (const x of p) {
    rows.push([esc(x.name), esc(x.category), x.price, x.images.length, `/shop/${x.slug}`]);
  }
  // BOM so Excel opens the UTF-8 cleanly.
  fs.writeFileSync(path.join(OUT, CSV_NAME), '\uFEFF' + rows.map((r) => r.join(',')).join('\n') + '\n');
  return p.length;
}

/* ---------------------------- stamp the guide ---------------------------- */
function stampGuide() {
  const file = path.join(OUT, GUIDE_NAME);
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(
    /((?:Prepared|prepared)\s+)\d{1,2}\s+\w+\s+\d{4}/g,
    (_m, lead) => `${lead}${today}`,
  );
  if (html !== before) fs.writeFileSync(file, html);
  return html !== before;
}

/* ---------------------------- run ---------------------------- */
fs.mkdirSync(OUT, { recursive: true });

const fileCount = zipFolder(DIST, path.join(OUT, ZIP_NAME));
const productCount = writeCsv();
const stamped = stampGuide();

const zipBytes = fs.statSync(path.join(OUT, ZIP_NAME)).size;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

console.log(`
Bagged Up - handover pack rebuilt

  ${ZIP_NAME.padEnd(26)} ${String(fileCount).padStart(4)} files   ${mb(zipBytes)}
  ${CSV_NAME.padEnd(26)} ${String(productCount).padStart(4)} products
  ${GUIDE_NAME.padEnd(26)} dated ${today}${stamped ? '' : ' (left as-is)'}

  Ready to send: ${path.relative(process.cwd(), OUT) || OUT}
`);
