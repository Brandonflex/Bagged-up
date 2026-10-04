#!/usr/bin/env bash
# Bagged Up - one time setup for the screenshot and layout browser.
#
# The sandbox has no browser, no apt mirror reachable and no Playwright CDN, so
# this uses the Chromium that @sparticuz/chromium ships for AWS Lambda and puts
# its own bundled libraries on the loader path. Everything lands in /tmp, which
# is wiped between sessions, so this is safe and cheap to run again.
#
#   scripts/browser-setup.sh
#   LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp/swiftshader node scripts/screenshot.mjs
set -euo pipefail

DIR=/tmp/shot
mkdir -p "$DIR"
cd "$DIR"

if [ ! -d node_modules/@sparticuz/chromium ]; then
  echo "installing the browser package into $DIR"
  npm install --silent --no-audit --no-fund @sparticuz/chromium puppeteer-core
fi

python3 -c "import brotli" 2>/dev/null || pip install --quiet --break-system-packages brotli

echo "extracting its bundled libraries"
python3 - <<'PY'
import brotli, tarfile, io, os, sys
base = '/tmp/shot/node_modules/@sparticuz/chromium/bin'
for name in ('al2023.tar.br', 'swiftshader.tar.br'):
    src = os.path.join(base, name)
    out = '/tmp/' + name.split('.')[0]
    data = brotli.decompress(open(src, 'rb').read())
    os.makedirs(out, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        t.extractall(out)
    print(' ', out)
PY

BIN=$(node -e "import('@sparticuz/chromium').then(m => m.default.executablePath().then(p => console.log(p)))")
echo "browser: $BIN"
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp/swiftshader "$BIN" --version || true
echo
echo "ready. example:"
echo "  LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp/swiftshader node scripts/screenshot.mjs"
