# Bagged Up - Storefront

Static e-commerce site (plain HTML/CSS/JS, no framework, no build step on
the host). This folder is deployable as-is.

## Deploy

The site is a static export. `npm run build` writes it to `dist/`, and the
`dist/` folder is the only thing that should ever be served: it excludes the
tooling, tests and docs by design.

### Built-in hosting paths

| Host | Config in this repo | What a push produces |
| --- | --- | --- |
| Cloudflare Workers Builds | `wrangler.jsonc` (static assets from `./dist`, `html_handling: drop-trailing-slash`) and `_headers` | production build on `main`; on other branches `wrangler versions upload`, which publishes a per-commit preview URL and is posted in the pull request as "Preview Deployments by commit" |
| Vercel | `vercel.json` (`buildCommand: npm run build`, `outputDirectory: dist`, clean URLs and security headers) | a production deployment on `main` and a per-commit preview URL on other branches, commented on the pull request |

Both hosts need the project to be created once in their dashboard and pointed
at this repository; the build and output settings above are already in the
repo, so no dashboard build configuration is required beyond that.

### Server-side notes

`cleanUrls` on Vercel and `drop-trailing-slash` on Cloudflare both mean the
same thing: `/shop/<product-slug>` serves `shop/<product-slug>.html`, and the
`.html` form redirects to the clean one. Canonical tags, `sitemap.xml` and
`robots.txt` all use the clean form, so keep them in step if the host changes:
the integrity suite fails if they drift.

Security headers are defined in both host formats (`vercel.json` and the
Cloudflare Workers Static Assets `_headers` file) and checked for parity. They
include a restrictive Content Security Policy (`script-src 'self'`, no inline
scripts or event handlers), clickjacking/MIME/referrer protections, a one-year
HSTS policy, and a restrictive Permissions Policy. `_headers` is copied into
`dist/` by the build. Inline styles remain allowed because existing templates
use style attributes; there are no third-party scripts or remotely hosted
assets.

The storefront has no server-side cart or payment authority. Local storage is
client-controlled and is validated against the shipped catalogue; final order
confirmation happens in WhatsApp. Do not use browser-supplied cart values as
payment or inventory authority if a backend is added later.

## Quality gate

Everything that ships is checked with one command:

```bash
npm ci --ignore-scripts  # once - installs the locked tools without dependency lifecycle scripts
npm run verify  # audit + lint + typecheck + design + tests + build
```

The verification toolchain requires Node `^22.22.2`, `^24.15.0`, or `>=26.0.0`
(as declared in `package.json`).

| Step | Command | What it proves |
| --- | --- | --- |
| dependency audit | `npm audit --audit-level=low` | the locked dependency tree has no published advisories |
| lint | `npm run lint` | HTML validity/accessibility (`html-validate`) and JS rules (`eslint`) |
| types | `npm run typecheck` | the storefront JS type-checks under `tsc --checkJs` (JSDoc types) |
| design | `npm run design` | `design/tokens.json` and the stylesheet agree in both directions, the two dark blocks stay identical, every contrast pair meets its WCAG minimum, every `var()` resolves, and the brand marks scale, avoid `<text>` and stay on palette |
| tests | `npm test` | catalogue ↔ pages ↔ sitemap agree; stored cart/recent/review data is treated as untrusted; scripts, security headers and CI pins follow the security policy |
| build | `npm run build` | the published file set is self-contained in `dist/`, includes Cloudflare response headers, rejects symlinks, and leaks no dev files |

CI uses least-privilege read-only GitHub permissions, disables persisted checkout
credentials, pins every action to a full commit SHA, and installs locked packages
without lifecycle scripts. Dependabot checks npm packages and GitHub Actions
weekly.

## Design and architecture

- `design/tokens.json` - the palette, type, spacing and motion tokens, plus the
  contrast pairs and their minimums. The stylesheet must match it.
- `design/brand/` - wordmark (light and reversed), monogram and favicon, with
  usage rules.
- `docs/design-system.md` - the system, the contrast table, and what changed when
  the palette was corrected to pass WCAG AA.
- `docs/architecture.md` - how the site is put together, where to change what,
  and the known weaknesses worth fixing next.

`node scripts/check-design.mjs --report` prints the full contrast table.

The same gate runs in CI (`.github/workflows/ci.yml`) on every push and pull
request. Lint rules that are deliberately switched off are listed in
`.htmlvalidate.json` - all four are cosmetic (DOCTYPE casing, attribute quote
style, trailing whitespace, inline `style=` attributes), not correctness.

## Updating products (prices, stock, new pieces)

Product data lives in `assets/js/data.js` (`window.BAGGED_UP_PRODUCTS`), and the
product pages under `shop/` are pre-rendered from it. The README used to point at
`data/products.json` in a build workspace; that workspace is **not part of this
repository**, so for now the files here are the source of truth: edit
`assets/js/data.js` and the matching page together, then run `npm run verify`.
If that generator is restored, it must be updated first - otherwise this HTML is
overwritten on the next build. `npm run build` does not regenerate pages; it only
produces and checks the deployable `dist/` folder.

## Adding photos & videos for a product

- Photos: assets/products/<slug>-1.jpg, -2.jpg, ... (4:5 ratio, ~1000px wide
  is plenty) - list them in the product's `images` array in assets/js/data.js
  and reference them on the matching page in shop/. The integrity suite fails
  if a listed photo is missing, and it reports photos no page references.
- Video: the stylesheet has a `.pdp-video` block, but nothing in the shipped
  pages or scripts renders a player yet, so dropping an mp4 in today does not
  produce one. Treat video as unbuilt until a player is wired up.

## Changelog

- v3 (current) - restraint pass: removed marquee/service-index/style tiles/
  splurge rail; PDP showcase (3D tilt, quiet ask-link, scarcity note,
  styling band, you-may-also-like); fonts embedded (sandbox-proof);
  reveal animations JS-gated; clean URLs via vercel.json; repo docs added.
- v2 - experience layer (superseded by v3 simplifications).
- v1 - full rebuild of bagged-up.vercel.app: all 50 products migrated, cart
  with delivery fees (Nairobi 250 / countrywide 400 / free over 5,000),
  WhatsApp order checkout, policy pages, FAQ, About, Reviews, Contact.

## Rules of the road


- Never edit CSS/JS/HTML without running `npm run verify` (CI runs it too).
- Only use designer brand names on pieces you stand behind as original.
- Every build round ships a fresh zip - commit it, push it, note the date.
