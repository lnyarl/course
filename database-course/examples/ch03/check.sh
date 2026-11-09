#!/usr/bin/env bash
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
rustc --edition=2024 --test "$HERE/btree.rs" -o "$D/tests"
"$D/tests"
rustc --edition=2024 "$HERE/btree.rs" -o "$D/btree"
first=$(printf '%s\n' 'set 10 100' 'set 20 200' 'set 30 300' 'set 40 400' 'get 30' 'range 15 40' '.exit' | "$D/btree" "$D/tree.pages")
[ "$first" = "$(printf 'OK\nOK\nOK\nOK\n300\n20:200 30:300 40:400')" ]
second=$(printf '%s\n' 'get 10' 'get 40' 'get 99' 'range 30 30' '.exit' | "$D/btree" "$D/tree.pages")
[ "$second" = "$(printf '100\n400\n(nil)\n30:300')" ]
[ "$(wc -c < "$D/tree.pages" | tr -d '[:space:]')" = 16384 ]
[ "$(od -An -tx1 -N12 "$D/tree.pages" | tr -d '[:space:]')" = 504730320100f00ff00f1000 ]
meta=$(dd if="$D/tree.pages" bs=1 skip=4080 count=16 2>/dev/null | od -An -tx1 | tr -d '[:space:]')
[ "$meta" = 42543033030000000300000000000000 ]
printf '%s\n' 'PASS: CLI, separator equality, range, reopen, size, actual metadata bytes'
