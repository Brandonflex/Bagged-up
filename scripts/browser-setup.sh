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
  npm install --silent --no-save --package-lock=false --ignore-scripts --no-audit --no-fund \
    @sparticuz/chromium@153.0.0 puppeteer-core@25.12.0
fi

PYTHON=$(command -v python3)
VENV="$DIR/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  "$PYTHON" -m venv "$VENV"
fi
PYTHON="$VENV/bin/python"
if ! "$PYTHON" -c "import brotli" 2>/dev/null; then
  echo "installing the pinned Brotli decoder into the temporary browser environment"
  "$PYTHON" -m pip install --quiet --disable-pip-version-check --only-binary=:all: Brotli==1.2.0
fi

echo "extracting its bundled libraries"
"$PYTHON" - <<'PY'
import brotli, io, os, pathlib, shutil, tarfile

base = '/tmp/shot/node_modules/@sparticuz/chromium/bin'

def safe_extract(archive, destination):
    root = os.path.realpath(destination)
    members = archive.getmembers()

    for member in members:
        relative = pathlib.PurePosixPath(member.name)
        if relative.is_absolute() or not relative.parts or '..' in relative.parts:
            raise RuntimeError(f'refusing unsafe archive path: {member.name!r}')
        target = os.path.realpath(os.path.join(root, *relative.parts))
        if os.path.commonpath((root, target)) != root:
            raise RuntimeError(f'refusing archive path outside destination: {member.name!r}')
        if member.isdev() or member.isfifo():
            raise RuntimeError(f'refusing special archive member: {member.name!r}')
        if not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
            raise RuntimeError(f'refusing unsupported archive member: {member.name!r}')

        if member.issym() or member.islnk():
            if os.path.isabs(member.linkname):
                raise RuntimeError(f'refusing absolute archive link: {member.linkname!r}')
            link_root = os.path.dirname(target) if member.issym() else root
            link_target = os.path.realpath(os.path.join(link_root, member.linkname))
            if os.path.commonpath((root, link_target)) != root:
                raise RuntimeError(f'refusing archive link outside destination: {member.linkname!r}')

        # Do not preserve ownership or special permission bits from the archive.
        member.uid = member.gid = 0
        member.uname = member.gname = ''
        member.mode &= 0o777

    archive.extractall(root, members=members)

for name in ('al2023.tar.br', 'swiftshader.tar.br'):
    src = os.path.join(base, name)
    out = '/tmp/' + name.split('.')[0]
    data = brotli.decompress(open(src, 'rb').read())
    if os.path.lexists(out):
        if os.path.islink(out) or not os.path.isdir(out):
            os.unlink(out)
        else:
            shutil.rmtree(out)
    os.makedirs(out, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        safe_extract(archive, out)
    print(' ', out)
PY

BIN=$(node -e "import('@sparticuz/chromium').then(m => m.default.executablePath().then(p => console.log(p)))")
echo "browser: $BIN"
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp/swiftshader "$BIN" --version || true
echo
echo "ready. example:"
echo "  LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp/swiftshader node scripts/screenshot.mjs"
