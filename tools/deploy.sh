#!/bin/sh
# Publishes Spielkiste: writes the file list and a version into sw.js, commits, pushes to GitHub (Pages serves main).
# Run: sh tools/deploy.sh "what changed"
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FILES=$(ls index.html css/*.css js/*.js js/games/*.js manifest.webmanifest icon.png | sed "s/.*/'&'/" | paste -sd, -)
VERSION=$(cat index.html css/*.css js/*.js js/games/*.js | shasum | cut -c1-12)
python3 - "$VERSION" "$FILES" <<'PY'
import sys, re
v, files = sys.argv[1], sys.argv[2]
s = open('sw.js').read()
s = re.sub(r"var VERSION = '[^']*';", "var VERSION = '%s';" % v, s, 1)
s = re.sub(r"var FILES = \[[^\]]*\];", "var FILES = ['./', %s];" % files, s, 1)
open('sw.js', 'w').write(s)
PY
git add -A
git commit -q -m "${1:-Update}" || true
git push -q origin main
echo "pushed $(git log -1 --format=%h), version $VERSION"
