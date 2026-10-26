#!/bin/sh
# Runs every game's tests. Run: sh tools/test_all.sh
cd "$(dirname "$0")/.." || exit 1
fail=0
for f in tools/tests/*.js; do printf "%s: " "$(basename "$f" .js)"; node "$f" 2>&1 | tail -1 || fail=1; done
exit $fail
