# Bagged Up - Storefront

Static e-commerce site (plain HTML/CSS/JS, no framework, no build step on
the host). This folder is deployable as-is.

## Deploy (GitHub -> Vercel)

1. Replace the files in your repo with the contents of this folder.
2. Commit and push - Vercel redeploys automatically.
3. vercel.json is included: it enables clean URLs so old links like
   /shop/<product-slug> keep working after the old site is replaced.

## Updating products (prices, stock, new pieces)

Product data lives in data/products.json in the build workspace. Change it
there, re-run the build, and re-upload this folder. For a quick hot-fix you
can edit a generated HTML file directly, but it will be overwritten on the
next build.

## Adding photos & videos for a product

- Photos: assets/products/<slug>-1.jpg, -2.jpg, ... (4:5 ratio, ~1000px wide
  is plenty) - list them in the product's images in data/products.json.
- Video: drop assets/videos/<slug>.mp4 (or .webm) in place and rebuild -
  a "See it in motion" player appears on that product's page automatically.
  Shoot vertical or square on a phone in daylight; 5-15 seconds of the bag
  being opened, worn, or rotated is ideal.

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


- Never edit CSS/JS without re-running the test suite.
- Only use designer brand names on pieces you stand behind as original.
- Every build round ships a fresh zip - commit it, push it, note the date.
