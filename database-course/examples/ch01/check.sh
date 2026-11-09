#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
cargo build --locked --quiet --manifest-path "$here/Cargo.toml" --target-dir "$work/target"
B="$work/target/debug/mydb" bash "$here/completion.sh"
