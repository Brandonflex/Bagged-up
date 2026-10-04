# Screenshots of the running site

These are not mockups. They are screenshots of the built export, taken in a real
Chromium through Puppeteer, on a 390 x 844 phone viewport unless the name says
desktop. Every one is a page from `dist/`, which is the same file set both hosts
serve, so what you see here is what ships.

| File | What it shows |
| --- | --- |
| `01-home-phone.png` | The homepage on a phone |
| `02-product-phone.png` | A product page, the top of it |
| `03-sticky-add-to-bag.png` | The sticky add to bag bar, after scrolling past the button. Note the WhatsApp button has moved up so the two do not overlap |
| `04-delivery-date-and-save.png` | The delivery date and the Save for later button, straight under Add to bag |
| `05-recently-viewed.png` | The recently viewed rail at the foot of a product page |
| `06-saved-filter.png` | The Saved chip on the shop page doing its job, with two bags saved |
| `07-cart-free-delivery-progress.png` | The cart progress bar below the free delivery threshold, plus the delivery date |
| `08-cart-unlocked.png` | The same cart above the threshold, with free delivery unlocked |
| `09-home-desktop.png` | The homepage at 1280 wide. The sticky bar is deliberately absent here |

## How to take them again

The sandbox has no browser and no package manager that can reach a distribution
mirror, so the Chromium above is the one `@sparticuz/chromium` ships for AWS
Lambda. It works, including rendering text, once its own libraries are on the
loader path. This is not part of the project's dependencies on purpose: it is
200 MB, and CI has no use for it.

    mkdir -p /tmp/shot && cd /tmp/shot
    npm i --no-save @sparticuz/chromium puppeteer-core

    # its bundled libraries, which the binary needs
    python3 - <<'PY'
    import brotli, tarfile, io, os
    base = '/tmp/shot/node_modules/@sparticuz/chromium/bin'
    for name in ('al2023.tar.br', 'swiftshader.tar.br'):
        data = brotli.decompress(open(f'{base}/{name}', 'rb').read())
        out = '/tmp/' + name.split('.')[0]
        os.makedirs(out, exist_ok=True)
        with tarfile.open(fileobj=io.BytesIO(data)) as t:
            t.extractall(out)
    PY

Then serve the export and drive the browser. `scripts/screenshot.mjs` in this
repo does both: it starts a clean URL static server on port 4611, walks the list
of pages below, and writes the PNGs into this folder.

    cd /home/user/Bagged-up
    npm run build
    LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp/swiftshader node scripts/screenshot.mjs

If `/tmp/al2023` is missing, the extraction step above has not been run.
