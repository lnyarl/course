#!/usr/bin/env bash
set -u
B=${B:-./target/debug/myctr}; R=${RANGE_ROOTFS:?100000 소유 별도 rootfs 지정}
[ "$(id -u)" = 0 ] || exit 1
[ "$(stat -c %u "$R")" = 100000 ] || { echo "range rootfs를 100000 소유로 준비하세요"; exit 1; }
[ -f "$R/root-only" ] && [ "$(stat -c %u "$R/root-only")" = 0 ] && [ "$(stat -c %a "$R/root-only")" = 600 ] || exit 1
pass=0 fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ng(){ echo "FAIL  $1"; fail=$((fail+1)); }
eq(){ [ "$2" = "$3" ] && ok "$1" || ng "$1: $2 (기대 $3)"; }
run(){ "$B" run --rootfs "$R" --userns-base 100000 "$@"; }
eq "range UID0" "$(run id -u)" 0
eq "range GID0" "$(run id -g)" 0
eq "range UID map" "$(run cat /proc/self/uid_map | awk '{$1=$1;print}')" "0 100000 65536"
eq "range GID map" "$(run cat /proc/self/gid_map | awk '{$1=$1;print}')" "0 100000 65536"
eq "range 보조 그룹 정리" "$(run id -G)" 0
run /bin/sh -c '! cat /root-only >/dev/null 2>&1 && ! (exec 3<>/root-only) 2>/dev/null'; eq "host-root 소유 fixture 실제 open 거부" "$?" 0
marker=/tmp/myctr-range-$$; trap 'rm -f "$R$marker"' EXIT
run /bin/sh -c 'echo range > "$1"' _ "$marker"
eq "생성파일 host UID100000" "$(stat -c %u "$R$marker")" 100000
"$B" run --rootfs "$R" --userns-base 4294901760 true >/dev/null 2>&1; eq "범위 초과 base 거부" "$?" 1
echo "통과 $pass / $((pass+fail))"; [ "$fail" = 0 ]
