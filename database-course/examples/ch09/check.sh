#!/bin/sh
set -eu
cd "$(dirname "$0")"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
rustc --edition=2024 --test server.rs -o "$work/tests"
"$work/tests"
rustc --edition=2024 server.rs -o "$work/server"
python3 check_wire.py "$work/server"
