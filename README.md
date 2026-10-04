# Bagged Up - Storefront

Static e-commerce site (plain HTML/CSS/JS, no framework, no build step on
the host). This folder is deployable as-is.

## Deploy (GitHub -> Vercel)

1. Replace the files in your repo with the contents of this folder.
2. Commit and push - Vercel redeploys automatically.
3. vercel.json is included: it enables clean URLs so old links like
   /shop/<product-slug> keep working after the old site is replaced.

## Quality gate

Everything that ships is checked with one command:

```bash
npm ci          # once — installs the lint/type tools (no runtime deps)
npm run verify  # lint + typecheck + tests + build
```

| Step | Command | What it proves |
| --- | --- | --- |
| lint | `npm run lint` | HTML validity/accessibility (`html-validate`) and JS rules (`eslint`) |
| types | `npm run typecheck` | the storefront JS type-checks under `tsc --checkJs` (JSDoc types) |
| tests | `npm test` | catalogue ↔ pages ↔ sitemap agree; every link and asset resolves; canonicals, `og:*` and `robots.txt` match the clean-URL host config |
| build | `npm run build` | the published file set is self-contained in `dist/` and leaks no dev files |

The same gate runs in CI (`.github/workflows/ci.yml`) on every push and pull
request. Lint rules that are deliberately switched off are listed in
`.htmlvalidate.json` — all four are cosmetic (DOCTYPE casing, attribute quote
style, trailing whitespace, inline `style=` attributes), not correctness.

## Updating products (prices, stock, new pieces)

Product data lives in `assets/js/data.js` (`window.BAGGED_UP_PRODUCTS`), and the
product pages under `shop/` are pre-rendered from it. The README used to point at
`data/products.json` in a build workspace; that workspace is **not part of this
repository**, so for now the files here are the source of truth: edit
`assets/js/data.js` and the matching page together, then run `npm run verify`.
If that generator is restored, it must be updated first — otherwise this HTML is
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
