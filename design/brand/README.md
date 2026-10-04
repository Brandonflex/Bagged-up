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

Both SVGs rely on the font stack `'Cormorant Garamond', Georgia, serif`. On a
machine without Cormorant the mark falls back to Georgia, which is close but not
identical. **Before using these files for print or for any partner, convert the
text to outlines** (Illustrator: Type → Create Outlines; Inkscape: Path → Object
to Path; Figma: right click → Outline stroke/fill). After conversion the file no
longer needs the font installed anywhere, and the checker's colour rule still
applies.

## Type licence

Cormorant Garamond and Jost are both SIL Open Font License 1.1, which permits
commercial use, self-hosting and embedding. Keep the licence files from the
original releases with the fonts if the fonts are ever moved out of this repo.
