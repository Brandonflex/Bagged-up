# Bagged Up

> **[Visit the Live Storefront &rarr;](https://baggedup-seven.vercel.app)**
>
> A curated 50-piece handbag boutique designed and engineered for the Kenyan market. Built as an ultra-fast, framework-free static storefront with zero runtime dependencies, pay-on-delivery economics, and WhatsApp customer engagement.

[![Live Site](https://img.shields.io/badge/Live%20Storefront-baggedup--seven.vercel.app-161616?style=for-the-badge&logo=vercel&logoColor=white)](https://baggedup-seven.vercel.app)
[![CI Status](https://img.shields.io/github/actions/workflow/status/Brandonflex/Bagged-up/ci.yml?branch=main&style=for-the-badge&label=Quality%20Gate)](https://github.com/Brandonflex/Bagged-up/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

---

### Client Handover Note

Bagged Up is a real, operational retail business designed and developed as a client commission. In October 2026, the complete platform and storefront were formally handed over to the boutique owner, with comprehensive training and documentation.

A dedicated non-technical handover package lives in [`handover/`](handover/): a ready-to-upload static archive (`Bagged-Up-website.zip`), a full 50-item price list in spreadsheet format (`Bagged-Up-prices.xlsx`), and complete step-by-step instructions for updating inventory on Vercel or Cloudflare Workers.

---

## What Bagged Up Is

Bagged Up is an editorial e-commerce storefront showcasing a 50-piece collection of women's handbags across five categories: Shoulder & Crescent, Totes, Crossbody, Top-Handle & Structured, and Mini & Clutches.

Rather than relying on generic e-commerce templates or heavy single-page application frameworks, Bagged Up was engineered from scratch as a high-performance static website (plain HTML, modern CSS, vanilla JavaScript) optimized for the Kenyan market, where M-Pesa and cash-on-delivery are the primary payment methods and WhatsApp is the expected customer service channel.

---

## Why It Is Built That Way

Standard Western e-commerce platforms (Shopify, WooCommerce, Stripe-centric checkouts) make assumptions that fail Kenyan consumers and boutique merchants:
- **Card-first checkouts increase friction and drop-off:** In Kenya, the dominant payment rails are M-Pesa mobile money and cash on delivery. Forcing shoppers through credit card forms leads to abandonment.
- **WhatsApp is the customer relationship channel:** High-consideration accessories require personal assurance. Kenyan shoppers want to confirm stock availability, verify dimensions, and request delivery to specific areas.
- **Transparent local delivery tiers:** Cart calculations reflect actual Nairobi logistics:
  - **Nairobi:** KSh 250 flat rate (next-day delivery).
  - **Countrywide (Upcountry Kenya):** KSh 400 flat rate (2–3 business days via courier).
  - **Free delivery:** Automatically unlocked on orders over KSh 5,000, with an interactive visual progress bar.
- **Concrete delivery dates, not abstract transit speeds:** Instead of vague labels ("standard shipping"), the storefront computes and displays exact dates (e.g. *"Order today, receive Wednesday"*) reflecting real Nairobi logistics windows.
- **Zero operational overhead:** As a pure static export, the site can be hosted for free on modern edge networks (Vercel, Cloudflare, Netlify) with instantaneous global CDN delivery, zero database costs, and zero server maintenance.

---

## Key Features

- **50 Pre-Rendered Product Pages:** Every piece has its own dedicated page with complete Open Graph / Twitter Card tags, microcopy, structured metadata, and SEO canonical links.
- **Curated Catalogue with Instant Filters:** Filter by category, sort by price (low to high, high to low), or view saved pieces with zero layout shifts.
- **Occasion Finder ("What are you carrying?"):** An interactive homepage selector that guides shoppers to the right piece based on mood and schedule (everyday, formal evenings, office days, casual weekends).
- **Interactive Lightbox & Multi-Angle Galleries:** Keyboard-accessible and touch-swipe enabled image lightboxes with labelled controls.
- **Saved Items & Recently Viewed Rails:** Shopper preferences and browsing history persist in `localStorage` without tracking cookies or user accounts. Untrusted inputs are strictly sanitized against DOM-based XSS.
- **Cart with Free Delivery Progress Bar:** Live calculation showing exactly how much more is needed to reach free delivery, complete with delivery date projection.
- **Per-Product Customer Reviews:** Dedicated verified-buyer review system with aggregate ratings and per-piece review filtering.
- **System-Aware Dark Theme:** Custom light/dark themes with pre-paint initialization to eliminate light flashes (FOUC).
- **Strict Clean URLs:** Pre-configured URL rewriting (`/shop/<slug>` instead of `/shop/<slug>.html`) synchronized across Vercel, Cloudflare, and `sitemap.xml`.

---

## How It Is Built

```
index.html  shop.html  cart.html  about.html  reviews.html  contact.html
faq.html  delivery.html  returns.html  privacy.html  terms.html   <- 11 root pages
shop/                    50 product pages, pre-rendered with complete metadata
assets/css/style.css    2,134 lines: tokens, components, PDP, editorial and motion
assets/js/data.js         543 lines: window.BAGGED_UP_PRODUCTS (the catalogue)
assets/js/app.js        1,096 lines: single IIFE, all storefront logic, zero deps
assets/js/brand-motion.js 238 lines: signature transitions and adaptive pointer
assets/js/reviews.js      single-file customer review records
assets/js/theme-init.js     15 lines: external pre-paint theme script
design/tokens.json        source of truth for palette, typography, and contrast
handover/                 complete client delivery package and instructions
```

- **Architecture:** 61 pre-rendered HTML pages, 1 consolidated stylesheet, and vanilla JavaScript split into single-responsibility modules.
- **Design System:** Design tokens in `design/tokens.json` govern colors, typography scales, spacing rhythm, and contrast pairs. All 42 contrast pairs are mechanically checked during build to guarantee WCAG AA compliance.
- **Zero-Dependency Core:** The user-facing storefront uses zero npm dependencies in production. All dev dependencies are locked to build, lint, and test validation.

---

## The Quality Gate

Every change is verified through a six-stage automated quality gate. Nothing deploys unless every step passes:

```bash
npm ci --ignore-scripts  # installs locked tools without running arbitrary lifecycle scripts
npm run verify           # audit + lint + typecheck + design + tests + build
```

| Step | Command | What It Enforces |
| --- | --- | --- |
| **Dependency Audit** | `npm audit --audit-level=low` | Zero vulnerabilities in dev tooling. |
| **Lint** | `npm run lint` | HTML standards and accessibility via `html-validate`; code rules via `eslint`. |
| **Type Check** | `npm run typecheck` | Full JSDoc type checking of all vanilla JS via `tsc --checkJs`. |
| **Design System** | `npm run design` | 7 groups: bidirectional sync between `tokens.json` and CSS, dark mode parity, WCAG AA contrast ratios, CSS variable resolution, and product page scale compliance. |
| **Integrity & Tests** | `npm test` | 38 storefront integrity tests + 25 browser behavior and security tests. Verifies catalogue ↔ pages ↔ sitemap parity, sanitized storage, and CSP compliance. |
| **Static Export** | `npm run build` | Assembles a self-contained production bundle in `dist/`, ensures security headers match, verifies 0 dead links, and blocks leaked dev files. |

In GitHub Actions (`.github/workflows/ci.yml`), CI runs on every push and pull request with least-privilege read-only permissions, SHA-pinned actions, and automated preview deployment checks.

---

## Known Limitations & Future Architecture

In the spirit of honest engineering (documented in detail in [`docs/architecture.md`](docs/architecture.md)), the current build has intentional architectural trade-offs:

1. **Markup Duplication across 61 Pages:** Because pages are pre-rendered static HTML files without a templating engine or server partials, global header or footer updates require editing each page (with tooling to automate). This is a known constraint, not a bug.
2. **Unoptimized Photography Pipeline:** Product images in `assets/products/` are committed at full resolution (~1000px, 12 MB total) without responsive `srcset` or modern `.webp`/`.avif` variants. A future version will optimize image serving with transforms on edge.
3. **Unreferenced Font Files vs Inline Data:** Three web fonts (`assets/fonts/*.woff2`) exist in the repo, while the stylesheet currently inlines font data via base64. Switching `@font-face` declarations to link the physical files would reduce CSS size by ~3%.
4. **Styled Video Block without Player:** A `.pdp-video` styling rule exists in `style.css` for product showcase clips, but no HTML video player has been wired up into the PDP templates yet.
5. **Catalogue Metadata Depth:** Products in `assets/js/data.js` currently model category, price, and photos. Expanding the schema to include dimensions, strap length, hardware finish, and material specifications would enable filtering and comparison views.

---

## Deploy

The deployable output is compiled into `dist/` by running `npm run build`. The root folder should not be served directly because it contains testing and documentation assets.

### Built-in hosting paths

| Host | Config in this repo | What a push produces |
| --- | --- | --- |
| **Cloudflare Workers Builds** | `wrangler.jsonc` (static assets from `./dist`, `html_handling: drop-trailing-slash`) and `_headers` | Production build on `main`; preview worker version on branches. Live at `baggedup.workers.dev`. |
| **Vercel** | `vercel.json` (`buildCommand: npm run build`, `outputDirectory: dist`, clean URLs and security headers) | Production deployment on `main` and per-commit preview deployments on branches. Live at `baggedup-seven.vercel.app`. |

### Security Headers & Content Security Policy

Both host configurations enforce an identical, hardened security posture:
- **Strict CSP:** `script-src 'self'` with zero inline scripts or unsafe evals.
- **Clickjacking Protection:** `frame-ancestors 'none'`.
- **HSTS:** `max-age=31536000; includeSubDomains; preload`.
- **MIME & Referrer:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Permissions Policy:** Disables geolocation, microphone, and camera access.

---

## Managing Catalogue & Media

- **Updating Products:** Product definitions live in `assets/js/data.js` (`window.BAGGED_UP_PRODUCTS`). When editing a product's price, name, or photos, update `data.js` and the corresponding page in `shop/<slug>/index.html`.
- **Adding Photos:** Save images to `assets/products/<slug>-<index>.jpg` (recommended 4:5 aspect ratio, ~1000px wide). Add the path to the product's `images` array in `assets/js/data.js` and link it in the product page template.

---

## Changelog

- **v3 (Current):** Refined editorial design; interactive mood finder; PDP showcase (3D interactive card tilt, scarcity alerts, styling band, related recommendations); embedded typography; clean URLs; WhatsApp checkout flow.
- **v2:** Initial dynamic experience layer (superseded by v3 editorial refinement).
- **v1:** Rebuild of legacy platform to pure static architecture: all 50 products migrated, full cart with localized Nairobi/Kenya delivery rates, WhatsApp checkout integration, customer reviews, and saved items.

---

## Rules of the Road

- Never edit CSS, JS, or HTML without running `npm run verify` (CI enforces this on every pull request).
- Only use designer brand names on pieces you stand behind as original.
- Every build round ships a fresh zip in `handover/` with updated pricing and instructions.

---

## License

This project's source code, documentation, and architectural designs are open source under the [MIT License](LICENSE).

**Commercial Rights & Proprietary Assets:**
- **Product Photography:** All product images (`assets/products/`) and promotional media (`assets/img/`) are proprietary assets and are **not** covered by the MIT license. All rights reserved.
- **Brand Identity:** The Bagged Up brand name, logo marks, and visual trade dress (including vector marks in `design/brand/` and `assets/img/`) are reserved and may not be used for commercial retail or competitive purposes without explicit permission.
