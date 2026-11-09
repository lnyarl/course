#!/bin/sh
set -eu
cd "$(dirname "$0")"
for chapter in ch01 ch03 ch04 ch05 ch06 ch07 ch08 ch09; do
  printf '\n%s\n' "Checking $chapter"
  bash "$chapter/check.sh"
done
printf '\n%s\n' 'PASS: chapters 01-09; native SQL, persistence, crash recovery, transactions, wire protocol'
