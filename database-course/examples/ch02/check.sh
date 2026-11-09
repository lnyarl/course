#!/usr/bin/env bash
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
rustc --edition=2024 --test "$HERE/pages.rs" -o "$D/tests"
"$D/tests"
rustc --edition=2024 "$HERE/pages.rs" -o "$D/pages"
first=$("$D/pages" "$D/data.pages")
second=$("$D/pages" "$D/data.pages")
[ "$first" = "$(printf 'page=0 slot=0 value=abc\nreads=1 writes=1')" ]
[ "$second" = "$(printf 'page=0 slot=0 value=abc\nreads=1 writes=0')" ]
[ "$(wc -c < "$D/data.pages" | tr -d '[:space:]')" = 4096 ]
[ "$(od -An -tx1 -N12 "$D/data.pages" | tr -d '[:space:]')" = 504730320100fd0ffd0f0300 ]
[ "$(tail -c 3 "$D/data.pages")" = abc ]
printf '%s\n' 'PASS: reopen, clean flush, size, header/slot bytes, record bytes'
