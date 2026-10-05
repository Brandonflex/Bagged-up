# Architecture

Bagged Up is a static storefront: plain HTML, CSS and JavaScript, no framework,
no bundler, no server code. Everything is pre-rendered at authoring time and
shipped as files. That is a deliberate fit for the business: 50 products, a
WhatsApp checkout, and a host that can serve files for free.

## Layout

```
index.html  shop.html  cart.html  about.html  reviews.html  contact.html
faq.html  delivery.html  returns.html  privacy.html  terms.html   ← 11 root pages
shop/                    50 product pages, one per catalogue slug
assets/css/style.css    2,134 lines: tokens, components, PDP, editorial and motion layers
assets/js/data.js         543 lines: window.BAGGED_UP_PRODUCTS (the catalogue)
assets/js/app.js        1,096 lines: one IIFE, all storefront behaviour, no runtime dependencies
assets/js/brand-motion.js 238 lines: signature transitions and adaptive pointer
assets/js/reviews.js      reviews in one file; name, date, rating, text, product slug
assets/js/theme-init.js     15 lines: pre-paint theme, external for strict CSP
assets/js/globals.d.ts   browser globals used by the JS typecheck
assets/img/               11 shared assets (hero, about, favicon, B/U signature mask, linked-loop mask, 5 styling frames, WhatsApp mark)
assets/products/          141 product photos, named <slug>-<n>.jpg
assets/fonts/             3 .woff2 files, currently unreferenced (see below)
scripts/                  tests, checks, build, and optional browser tooling
_headers                  Cloudflare Workers Static Assets security headers
wrangler.jsonc  vercel.json  robots.txt  sitemap.xml
design/                   tokens.json + brand marks (source, not shipped)
docs/                     architecture and design notes
```

61 pages, ~18,900 lines of HTML, 198 KB of CSS (including about 118 KB of
inline font data) and about 73 KB of JavaScript.

## Page types

| Type | Count | Shape |
| --- | --- | --- |
| Home | 1 | campaign hero, latest edit, interactive occasion finder, story, unified customer testimonial, WhatsApp band |
| Collection | 1 | oversized editorial introduction, deep-linked category chips, sort, 50 cards |
| Product (PDP) | 50 | gallery + lightbox, buy box, assurance accordions, styling band, review block, related pieces |
| Cart | 1 | line items, delivery choice, totals, WhatsApp checkout, message preview |
| Trust and policy | 8 | about, reviews, contact, faq, delivery, returns, privacy, terms |

Every page carries the same skeleton: skip link, sticky header with theme toggle
and cart badge, slide-in nav panel, footer, floating WhatsApp button, and five
external scripts (theme setup, reviews, catalogue, storefront app, brand motion).
The footer markup is
byte-identical on all 61 pages apart from its relative path prefix.

## Data flow

There is one catalogue, `assets/js/data.js`, assigning an array to
`window.BAGGED_UP_PRODUCTS`. It is loaded before the deferred `app.js` on every
page. Each entry is `{slug, name, price, category, images[]}`.

From that single file:

- **`shop.html`** carries a pre-rendered card per product (`data-cat`,
  `data-price`, `data-name`) which `app.js` filters and sorts in the DOM. The
  cards are not built from the catalogue at runtime.
- **Each product page** is pre-rendered HTML with its own title, meta tags,
  gallery and buy button (`data-add="<slug>"`).
- **`sitemap.xml`** lists all 50 products plus the 10 indexable pages.
- **The cart** resolves slugs against the catalogue at runtime, so a slug missing
  from `data.js` silently disappears from the cart.

Because the catalogue exists in four places (data.js, the 50 pages, shop.html's
cards, sitemap.xml), the suite checks all four agree. That check is the safety net
for what is otherwise the main structural weakness of a hand-built site.

## Paths and depth

Root pages set `data-depth="0"`; product pages set `data-depth="1"` and use
`../` prefixes. `app.js` derives a `ROOT` prefix from that attribute for cart and
product links. Clean URLs are the public form (`/shop/<slug>`), configured twice:
`vercel.json` (`cleanUrls`, `trailingSlash: false`) and `wrangler.jsonc`
(`html_handling: "drop-trailing-slash"`). Canonicals, `og:url` and `sitemap.xml`
all use the clean form, which is why the suite pins them together.

The WhatsApp mark lives once in `assets/img/whatsapp-mark.svg`; `.wa-mark` applies
it as a CSS mask so each nav, CTA, footer and floating-button placement keeps the
same sharp silhouette while inheriting its local color. The approved B/U signature
and linked-loop stitch motif are also SVG masks in `assets/img/`; `.wordmark`
adds the signature before the live Cormorant wordmark, and the loop appears as a
small secondary detail in the homepage campaign. Both inherit theme-aware colors.
The WhatsApp icon's Font Awesome Free Brands attribution is retained in the SVG header.

## Behaviour (`assets/js/app.js`)

One IIFE, no modules, sections in order: storage helpers, cart store, badge,
toast, nav overlay, add-to-cart delegation, shop filter/sort with category
query links, home edit finder, PDP gallery + lightbox, review form, cart rendering
and WhatsApp message building, clipboard, scroll reveals with fallbacks, hover
second-image, PDP tilt, theme cycle, lightbox keyboard/swipe. It degrades rather than throws: `localStorage` can fail
in sandboxed frames, `IntersectionObserver` can report nothing as visible, and the
async clipboard API can hang. Each has a documented fallback.

State lives in `localStorage` under `bagged-up-cart-v1`, `bagged-up-delivery-v1`,
`bagged-up-saved-v1`, `bagged-up-recent-v1` and `bagged-up-theme`. Saved and
recent items contain catalogue slugs only; display names, prices and image paths
are re-derived from the shipped catalogue. Reads reject malformed/unknown values,
cap quantities and list sizes, and treat storage as untrusted. There is no account,
no server, no payment integration: the order leaves as a pre-filled WhatsApp
message.

## Security

`vercel.json` and the Cloudflare Workers Static Assets `_headers` file define the
same response policy: CSP, HSTS, MIME sniffing and framing protections, a
cross-origin opener policy, referrer control and a restrictive permissions
policy. The export includes `_headers`, and tests compare the two host configs.
The pre-paint theme initializer is external, so CSP can use `script-src 'self'`
without `unsafe-inline` or inline event handlers. `style-src` still allows inline
styles because the existing templates use style attributes; that is the remaining
CSP exception to remove if those styles are migrated to classes.

CI pins GitHub Actions to full commit SHAs, uses read-only permissions and does
not persist checkout credentials. `npm ci --ignore-scripts` is followed by an
`npm audit`; Dependabot checks npm and action updates weekly. The export builder
rejects symbolic links so an unexpected source link cannot copy files from outside
the repository into the deployed artifact.

The cart is browser-side UI, not a payment boundary. Local storage can always be
edited by the shopper; if a payment, inventory or account backend is introduced,
prices, quantities and fulfillment must be verified server-side.

## Styling (`assets/css/style.css`)

Order: font faces, tokens (`:root`, then the two dark blocks), base elements,
layout, components, PDP, responsive overrides, reduced-motion. One class per
component, hyphenated, mostly flat (`.card`, `.card-media`, `.pdp-gallery`,
`.delivery-opt`, `.cta`). Tokens are the only place colours are defined; the
theme-level values live in `design/tokens.json` and the check keeps the two in
step. Fixed photo treatments use a small explicit raw-colour allow-list, checked
in both directions so unused exceptions are caught.

## Build and deploy

`npm run build` copies the publishable set into `dist/` and proves it is
self-contained: 61 pages, 227 files, 14.3 MB, every reference resolving inside the
export, the Cloudflare `_headers` file present, no symbolic links, and no tooling
or docs leaked in. Both hosts serve that folder:

| Host | Config | Branch behaviour |
| --- | --- | --- |
| Cloudflare Workers Builds | `wrangler.jsonc` | production deploys only; branch builds are not used for PR validation |
| Vercel | `vercel.json` | production on `main`, preview URL per commit |

## The gate

`npm run verify` runs `npm audit`, lint (html-validate over every page, eslint
over the JS), types (`tsc --checkJs` with JSDoc annotations), design checks (7
groups), 38 storefront integrity checks, 25 behaviour/security tests, and the
export check. The suite covers response-header parity, strict-CSP compatibility,
SHA-pinned workflow actions, Dependabot, and malicious local-storage/review inputs.
CI runs the audit and verification steps plus browser layout checks on every push
and pull request, then uploads the static export as an artifact.

## Known weaknesses, and what to do about them

1. **Duplication across 61 pages.** A header change means editing 61 files. Two
   options: keep hand-editing with the suite as the safety net (fine at this
   size, and it is what happens today), or introduce a small generator that
   renders pages from `data.js` plus a layout partial. If a generator arrives, the
   suite must keep passing on its output, and the README's "these HTML files are
   the source of truth" rule stops being true.
2. **No real photography pipeline.** Photos are committed at full size (12 MB
   total, up to 273 KB each) with no responsive variants. Next step worth doing
   before any traffic push: two widths per product photo and `srcset`.
3. **Unreferenced font files.** `assets/fonts/*.woff2` (88 KB) sit in the repo
   unused while the same fonts are base64-inlined in the shared stylesheet,
   adding about 118 KB to its transfer. Either switch `@font-face` to the files
   and remove the inline data (so fonts can be cached independently), or delete
   the unused files; only the first option changes what the browser downloads.
4. **Video is styled but not built.** `.pdp-video` exists in CSS; nothing renders
   a player. Either wire it up in the PDP template or remove the dead block.
5. **Catalogue metadata is thin.** Category, price and photos only. Sizes,
   materials and colours are not modelled, which is why the product copy cannot
   make specific claims. Adding those fields is the prerequisite for the next
   copy and filter pass.
