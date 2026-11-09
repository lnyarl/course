#!/usr/bin/env bash
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
rustc --edition=2024 --test "$HERE/tables.rs" -o "$D/tests"
"$D/tests" --quiet
rustc --edition=2024 "$HERE/tables.rs" -o "$D/tables"
first=$(printf '%s\n' 'create|people|id:int|name:text?|age:int?' 'insert|people|1|Roy|NULL' 'get|people|1' '.exit' | "$D/tables" "$D/db")
[ "$first" = "$(printf 'CREATED\nRID 1:1\n1|Roy|NULL')" ]
# One catalog page and one heap page. Index pages are in a separate file.
[ "$(wc -c < "$D/db/tables.pages" | tr -d '[:space:]')" = 8192 ]
head=$(dd if="$D/db/tables.pages" bs=1 skip=4096 count=16 2>/dev/null | od -An -tx1 | tr -d '[:space:]')
[ "$head" = 504730320200da0ff80f0800da0f1e00 ]
row=$(dd if="$D/db/tables.pages" bs=1 skip=8154 count=30 2>/dev/null | od -An -tx1 | tr -d '[:space:]')
[ "$row" = 03000401000000000000001b000000030000000000000000000000526f79 ]
second=$(printf '%s\n' 'insert|people|2||25' 'insert|people|3|NULL|NULL' 'get|people|1' 'scan|people' '.exit' | "$D/tables" "$D/db")
[ "$second" = "$(printf 'RID 1:2\nRID 1:3\n1|Roy|NULL\n1|Roy|NULL\n2||25\n3|NULL|NULL')" ]
if printf '%s\n' 'insert|people|1|duplicate|NULL' | "$D/tables" "$D/db" >"$D/out" 2>"$D/error"; then
  echo 'FAIL: duplicate primary key was accepted'; exit 1
fi
third=$(printf '%s\n' 'scan|people' '.exit' | "$D/tables" "$D/db")
[ "$third" = "$(printf '1|Roy|NULL\n2||25\n3|NULL|NULL')" ]
printf '%s\n' 'PASS: CLI, catalog/index reopen, NULL vs empty text, duplicate rejection, actual heap and row bytes'
