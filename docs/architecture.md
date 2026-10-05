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
assets/css/style.css     1,216 lines: tokens, base, components, PDP, utilities
assets/js/data.js         543 lines: window.BAGGED_UP_PRODUCTS (the catalogue)
assets/js/app.js          645 lines: one IIFE, all behaviour, no dependencies
assets/img/               8 shared images (hero, about, favicon, 5 styling frames)
assets/products/          141 product photos, named <slug>-<n>.jpg
assets/fonts/             3 .woff2 files, currently unreferenced (see below)
scripts/                  test-site.mjs, check-design.mjs, build-site.mjs
design/                   tokens.json + brand marks (source, not shipped)
docs/                     this file and design-system.md
wrangler.jsonc  vercel.json  robots.txt  sitemap.xml
```

61 pages, ~18,900 lines of HTML, 16 KB of CSS and 44 KB of JS before fonts.

## Page types

| Type | Count | Shape |
| --- | --- | --- |
| Home | 1 | hero, new arrivals, review, WhatsApp band |
| Collection | 1 | toolbar (category chips, sort), 50 cards |
| Product (PDP) | 50 | gallery + lightbox, buy box, assurance accordions, styling band, review block, related pieces |
| Cart | 1 | line items, delivery choice, totals, WhatsApp checkout, message preview |
| Trust and policy | 7 | about, reviews, contact, faq, delivery, returns, privacy, terms |

Every page carries the same skeleton: skip link, sticky header with theme toggle
and cart badge, slide-in nav panel, footer, floating WhatsApp button, and the two
scripts. The footer markup is byte-identical on all 61 pages apart from its
relative path prefix.

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

## Behaviour (`assets/js/app.js`)

One IIFE, no modules, sections in order: storage helpers, cart store, badge,
toast, nav overlay, add-to-cart delegation, shop filter/sort, PDP gallery +
lightbox, review form, cart rendering and WhatsApp message building, clipboard,
scroll reveals with fallbacks, hover second-image, PDP tilt, theme cycle,
lightbox keyboard/swipe. It degrades rather than throws: `localStorage` can fail
in sandboxed frames, `IntersectionObserver` can report nothing as visible, and the
async clipboard API can hang. Each has a documented fallback.

State lives in `localStorage` under `bagged-up-cart-v1`, `bagged-up-delivery-v1`
and `bagged-up-theme`. There is no account, no server, no payment integration: the
order leaves as a pre-filled WhatsApp message.

## Styling (`assets/css/style.css`)

Order: font faces, tokens (`:root`, then the two dark blocks), base elements,
layout, components, PDP, responsive overrides, reduced-motion. One class per
component, hyphenated, mostly flat (`.card`, `.card-media`, `.pdp-gallery`,
`.delivery-opt`, `.cta`). Tokens are the only place colours are defined; the
values live in `design/tokens.json` and the check keeps the two in step.

## Build and deploy

`npm run build` copies the publishable set into `dist/` and proves it is
self-contained: 61 pages, 220 files, 14.4 MB, every reference resolving inside the
export, no tooling or docs leaked in. Both hosts serve that folder:

| Host | Config | Branch behaviour |
| --- | --- | --- |
| Cloudflare Workers Builds | `wrangler.jsonc` | `main` deploys; other branches run `wrangler versions upload`, which publishes a per-commit preview URL |
| Vercel | `vercel.json` | production on `main`, preview URL per commit |

## The gate

`npm run verify` runs lint (html-validate over every page, eslint over the JS),
types (`tsc --checkJs` with JSDoc annotations), the integrity suite (26 checks:
catalogue agreement, links, meta URLs, robots, structure, no em dashes, no tracked
tooling state), the design check (4 groups: tokens vs stylesheet, contrast, brand marks),
and the export check. CI runs the same five steps on every push and pull request
and uploads `dist/` as an artifact.

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
3. **Unreferenced font files.** `assets/fonts/*.woff2` (88 KB) ship to nobody but
   sit in the repo while the same fonts are base64-inlined in the stylesheet,
   which inflates every page load by 166 KB. Pick one: reference the woff2 files
   from `@font-face` and drop the inline copies from the CSS, or delete the files.
   The latter is the smaller change and improves first paint the most.
4. **Video is styled but not built.** `.pdp-video` exists in CSS; nothing renders
   a player. Either wire it up in the PDP template or remove the dead block.
5. **Catalogue metadata is thin.** Category, price and photos only. Sizes,
   materials and colours are not modelled, which is why the product copy cannot
   make specific claims. Adding those fields is the prerequisite for the next
   copy and filter pass.
