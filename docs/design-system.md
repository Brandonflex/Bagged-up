# Design system

The source of truth is `design/tokens.json`. The stylesheet must match it, and
`node scripts/check-design.mjs` (part of `npm run verify` and CI) fails the build
if the two drift apart in either direction, if the two dark-theme blocks in the
stylesheet disagree, if a declared contrast pair drops below its minimum, or if a
brand mark uses a colour that is not a token.

Run `node scripts/check-design.mjs --report` for the full contrast table.

## Palette

Four families, one meaning each: **ivory** surfaces, **espresso** ink, **olive**
for actions and links, **muted gold** for small accents. Dark theme is a
re-tuned set, not an inversion.

| Token | Light | Dark | Carries |
| --- | --- | --- | --- |
| `--bg` | `#FAF7F1` | `#171310` | page background |
| `--bg-raised` | `#F1EBE1` | `#1E1914` | alternate bands, image wells |
| `--bg-dark` | `#201A15` | (same) | footer and bands that always sit dark |
| `--ink` | `#211B15` | `#F0EAE0` | body text, headings, solid buttons |
| `--ink-soft` | `#6E6459` | `#B5AB9D` | lede, secondary copy |
| `--ink-faint` | `#716758` | `#918679` | meta, overlines, captions |
| `--line` | `#E3DBCE` | `#332B23` | decorative hairlines and card edges |
| `--line-strong` | `#8F8372` | `#756A5C` | input borders, steppers, radio cards |
| `--cta-bg` / `--cta-ink` | `#4D5A42` / `#FFFFFF` | `#93A87D` / `#211C17` | primary button (WhatsApp checkout, floating chat) |
| `--cta-bg-hover` / `--cta-ink-hover` | `#3D4834` / `#FFFFFF` | `#A9BC93` / `#211C17` | primary button, hover |
| `--green-deep` | `#3D4834` | `#93A87D` | links, "in stock", free-delivery tag |
| `--green-tint` / `--green-line` | `#EDF0E8` / `#DDE3D5` | `rgba(147,168,125,.12)` / `rgba(147,168,125,.28)` | tinted callout bands |
| `--gold` | `#8A6A3D` | `#C9A76B` | stars, small bullets, icon strokes, one display accent |
| `--white` | `#FFFFFF` | `#211C17` | card and input fill (the raised surface, whatever the theme) |

### Contrast

Every pair below is measured from the stylesheet, not from this document.

| Pair | Light | Dark | Minimum |
| --- | --- | --- | --- |
| body text on background | 15.94:1 | 15.43:1 | 4.5 |
| body text on raised | 14.37:1 | 14.57:1 | 4.5 |
| secondary text | 5.41:1 | 8.16:1 | 4.5 |
| secondary on raised | 4.88:1 | 7.70:1 | 4.5 |
| meta text | 5.19:1 | 5.18:1 | 4.5 |
| meta on raised | 4.68:1 | 4.89:1 | 4.5 |
| gold accent | 4.67:1 | 8.11:1 | 4.5 |
| links | 9.03:1 | 7.16:1 | 4.5 |
| primary button label | 7.35:1 | 6.55:1 | 4.5 |
| primary button label, hover | 9.66:1 | 8.29:1 | 4.5 |
| input boundary (non-text) | 3.47:1 | 3.30:1 | 3 |

### What changed on 2026-10-04, and why

The palette had four pairs below AA before this pass. Each was fixed at the token
level so the correction applies everywhere at once:

| Before | Ratio | After | Ratio |
| --- | --- | --- | --- |
| light `--ink-faint` `#9C9285` | 2.86:1 | `#716758` | 5.19:1 |
| light `--ink-faint` on `--bg-raised` | 2.58:1 | same token | 4.68:1 |
| light `--gold` `#A5814F` | 3.36:1 | `#8A6A3D` | 4.67:1 |
| dark `--ink-faint` `#857A6D` | 4.40:1 | `#918679` | 5.18:1 |
| dark primary button label `#211C17` on `--green` | 2.66:1 | `--cta` tokens: `#211C17` on `#93A87D` | 6.55:1 |
| dark button hover, white on `--green-deep` | 2.16:1 | `--cta-*` tokens: `#211C17` on `#A9BC93` | 8.29:1 |
| input borders `--line` (all themes) | 1.28:1 | `--line-strong` on inputs | 3.47:1 |

Two structural changes came out of it:

1. **`--cta-bg` / `--cta-ink` / `--cta-bg-hover` / `--cta-ink-hover`** replace the
   hardcoded `#F4F6F0` and `#fff` on the primary button, the floating WhatsApp
   button and text selection. The old values only worked in the light theme; in
   dark theme they produced a 2.66:1 label on the most important control on the
   site. Tokens make the pair correct in both themes by construction.
2. **`--line` vs `--line-strong`.** Hairlines stay subtle (they are decoration).
   Anything that defines a control or a selectable boundary (inputs, textareas,
   selects, the quantity stepper, delivery radio cards) now uses `--line-strong`,
   because WCAG 1.4.11 asks for 3:1 on those.

## Type

| Role | Family | Notes |
| --- | --- | --- |
| Display | Cormorant Garamond, self-hosted variable (300-700, roman + italic) | headings, wordmark, pull quotes |
| Text | Jost, self-hosted variable (100-900) | body, buttons, labels, meta |

Scale: h1 `clamp(2.6rem, 7vw, 5.4rem)` at 1.04 line-height and -0.015em tracking,
h2 `clamp(1.9rem, 4.4vw, 3.1rem)`, h3 `1.45rem`, body `1rem` at 1.65, lede
`1.12rem` in `--ink-soft`, overline `0.7rem` uppercase at 0.2em, button `0.8rem`
uppercase at 0.14em.

Both faces are SIL Open Font License 1.1, so commercial use and self-hosting are
fine. They are embedded as base64 inside `assets/css/style.css`, which is why that
file is 166 KB. The three `.woff2` files in `assets/fonts/` are leftovers from an
earlier approach and are currently referenced by nothing; either wire them back in
and drop the inline copies, or delete them. Tracked as cleanup.

## Geometry and motion

Radius is 2px everywhere (deliberately square, it reads as tailoring). Borders are
1px. The header is 72px with the sticky offset exposed as `--header-h`. Product
photos are 4:5 source, shown at 4/4.7 on product pages. Motion uses one easing
curve, `cubic-bezier(0.22, 0.61, 0.36, 1)`, scroll reveals gated behind
IntersectionObserver with a 700ms fallback, and `prefers-reduced-motion` disables
animation entirely. Nothing carries meaning through motion alone.

## Imagery

Product photos: 4:5, about 1000px on the long edge, plain warm background, natural
daylight, no heavy retouching, one bag per frame. Styling photos: one lifestyle
frame per category shot in the same light. Naming is fixed:
`assets/products/<slug>-1.jpg`, `-2.jpg`, in catalogue order, and the suite fails
if a listed photo is missing or a file on disk is referenced nowhere.

## Voice

The copy rules are part of the design system, not an afterthought, because the
site sells on plainness:

- plain sentences, contractions, second person
- **no em dashes anywhere**; the suite fails the build if one appears in any
  shipped file, including scripts and docs
- specific over superlative: the fee, the town, the timing, the material
- no rule-of-three padding, no abstract benefits, no hype adjectives
- if a claim cannot be checked, it does not go on the page

Words we avoid: exquisite, effortless, luxurious, elevated, unlock, seamless.
Words we use: inspected, in stock, pay on delivery, countrywide, WhatsApp.

## Brand marks

`design/brand/` holds the wordmark (light and reversed), the monogram and the
favicon, with usage rules in its own README. All four are checked against the
palette. The site currently sets the wordmark as live type rather than an image,
which is why no page changed when the marks were added.
