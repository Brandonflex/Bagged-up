# Bagged Up brand marks

Four files, all SVG, all built from the palette in `design/tokens.json`.
`scripts/check-design.mjs` fails the build if a mark appears here using a colour
that is not a token, or if one of the four goes missing.

| File | Use it for | Background |
| --- | --- | --- |
| `wordmark.svg` | headers, invoices, packaging cards, footer | light (`--bg`, `--bg-raised`, white) |
| `wordmark-reverse.svg` | dark bands, photographs, video end cards | dark (`--bg-dark`, photos) |
| `monogram.svg` | avatars, packaging seal, social profile, when the wordmark is too wide | any; it carries its own tile |
| `favicon.svg` | browser icon; this is the same file the site ships as `assets/img/favicon.svg` | any |

## Rules

- **Clear space.** Leave at least the height of the lowercase `a` on every side.
  Nothing overlaps the mark, no drop shadows, no outlines, no gradients.
- **Minimum sizes.** Wordmark 120px wide on screen, 30mm in print. Monogram 24px,
  favicon intentionally at 16px.
- **Do not** stretch, rotate, recolour outside the palette, retype the wordmark in
  another font, or place the dark wordmark on a dark or busy background. Use the
  reverse version there.
- **Colour.** The wordmark is `--ink` on light and `--bg` on dark. The monogram
  tile is `--bg-dark` with a `--bg` letter and a `--gold` rule.

## How the wordmark is implemented today

The site does not use an image for the wordmark. Every page renders it as live
type in the `.wordmark` element, styled with `--serif` (Cormorant Garamond, self
hosted), which keeps it crisp at any size and costs nothing to download. The SVG
files here are for places the site cannot reach: packaging, social, print.

Every mark here is outlined: the lettering is vector paths, not live text, so the
files render identically on a machine that has never heard of Cormorant Garamond.
That matters for a logo, which travels to printers, partners and favicon
renderers that will never load the site's fonts. It also means the curves are
frozen: if the wordmark ever changes, the outlines have to be rebuilt, not
retyped.

They were built with HarfBuzz and fontTools from `assets/fonts`, the same files
the site serves, so the shapes are the typeface's own, kerning and the `gg` ligature
included, and each mark is centred on its ink rather than on its advance
width. The checker enforces the two rules that keep them usable: a `viewBox` on
every file, and no `<text>` anywhere.

## Type licence

Cormorant Garamond and Jost are both SIL Open Font License 1.1, which permits
commercial use, self-hosting and embedding. Keep the licence files from the
original releases with the fonts if the fonts are ever moved out of this repo.

## Identity exploration

[`identity-routes.html`](identity-routes.html) is a visual comparison of three
unapproved concepts. It is not copied by the static build; none of its marks or
palette replaces the live brand assets until a direction is selected.
