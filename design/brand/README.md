# Bagged Up brand marks

Six files, all SVG, built from the palette in `design/tokens.json`. The mark
checker verifies palette use, scalable viewBoxes, and that the shipped copies of
the signature, linked-loop motif and favicon stay in sync.

| File | Use it for | Background |
| --- | --- | --- |
| `wordmark.svg` | invoices, packaging cards, print and places that need an outlined wordmark | light (`--bg`, `--bg-raised`) |
| `wordmark-reverse.svg` | dark bands, photographs, video end cards and print | dark (`--bg-dark`, photos) |
| `signature.svg` | primary B/U signature; used as the source for the site’s theme-aware wordmark mark | transparent; it inherits the site ink through a CSS mask |
| `monogram.svg` | avatars, packaging seal, social profile, when the wordmark is too wide | forest tile, paper B, clay U, brass stitch |
| `linked-loops.svg` | supporting stitch motif in campaign art and secondary applications; never the lead logo | transparent; it can be recoloured with a CSS mask |
| `favicon.svg` | browser icon; this is the same artwork shipped as `assets/img/favicon.svg` | deep forest tile |

## Rules

- **Clear space.** Leave at least the height of the lowercase `a` on every side.
  Nothing overlaps the wordmark, no drop shadows, outlines or gradients.
- **Minimum sizes.** Wordmark 120px wide on screen, 30mm in print. Signature 24px,
  monogram 24px, favicon intentionally at 16px.
- **Do not** stretch, rotate, recolour outside the palette, retype the wordmark in
  another font, or place the dark wordmark on a dark or busy background. Use the
  reverse version there.
- **Hierarchy.** The custom B/U signature is the primary symbol. The linked loops
  are a quiet stitch detail that can support a composition, but should never
  replace or compete with the signature.
- **Colour.** The wordmark is `--ink` on light and paper on dark. The signature is
  forest and clay with a brass join in artwork; the live header uses a single
  `currentColor` mask so it automatically follows either theme.

## How the live wordmark works

The shared stylesheet renders “Bagged Up” in the self-hosted Cormorant Garamond
face and adds the custom B/U signature as a CSS mask from
`assets/img/signature-mark.svg`. The wordmark text stays crisp live type; the
mark inherits its colour, so headers and footers stay legible in light and dark
without separate logo variants. The linked-loop support motif is used as a small
mask on the campaign hero, not as a second primary logo.

The outlined SVG files remain available for packaging, social, print and other
places the live site cannot reach. Their lettering is vector paths rather than
live text, so it renders identically without the project fonts. The outlined
wordmark was built with HarfBuzz and fontTools from the same Cormorant Garamond
files served by the site.

## Type licence

Cormorant Garamond and Jost are both SIL Open Font License 1.1, which permits
commercial use, self-hosting and embedding. Keep the licence files from the
original releases with the fonts if the fonts are ever moved out of this repo.

## Identity exploration and development

[`identity-routes.html`](identity-routes.html) compares the three initial visual
territories. [`city-atelier-concept.html`](city-atelier-concept.html) is the
reference for the approved City Collectors direction with Modern Atelier
restraint, the custom B/U mark, layered art direction and the human voice system.
It remains outside the static build; the live storefront now carries the approved
identity while preserving its catalogue and checkout behaviour.
