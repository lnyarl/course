#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
checks=$(cd "$here/../checks" && pwd)
export B=${B:-$here/target/debug/myctr}
chapter=6
[ "$#" -le 1 ] || { echo "사용법: bash check.sh [rootful|rootless]"; exit 2; }
mode=${1:-auto}
case "$mode" in
 auto) ;;
 rootful) [ "$(id -u)" = 0 ] || { echo "rootful은 root로 실행하세요"; exit 2; } ;;
 rootless) [ "$(id -u)" != 0 ] && [ "$chapter" -ge 5 ] || { echo "rootless는 5장 이후를 일반 사용자로 실행하세요"; exit 2; } ;;
 *) echo "모드는 rootful 또는 rootless입니다"; exit 2 ;;
esac
export ROOTFS=${ROOTFS:?준비한 rootfs 경로를 지정하세요}
ROOTFS=$(realpath "$ROOTFS"); export ROOTFS
if [ "$(id -u)" = 0 ]; then
  if [ "$chapter" -ge 5 ]; then
    export RANGE_ROOTFS=${RANGE_ROOTFS:?100000 소유 별도 rootfs를 지정하세요}
    RANGE_ROOTFS=$(realpath "$RANGE_ROOTFS"); export RANGE_ROOTFS
  fi
else
  [ "$chapter" -ge 5 ] || { echo "이 장은 root로 실행하세요"; exit 1; }
fi
bash "$checks/check-base.sh"
if [ "$(id -u)" = 0 ]; then
  if [ "$chapter" -ge 4 ]; then bash "$checks/check-cgroup.sh"; fi
  if [ "$chapter" -ge 5 ]; then bash "$checks/check-range.sh"; fi
  if [ "$chapter" -ge 6 ]; then
    # 이 실행의 bridge만 먼저 준비하고, 그 주소에만 로컬 fixture를 연다.
    export DNS_FIXTURE=10.88.0.1
    "$B" run --rootfs "$ROOTFS" --net bridge --dns "$DNS_FIXTURE" true
    fixture_log=$(mktemp)
    python3 "$checks/network-fixture.py" --bind "$DNS_FIXTURE" >"$fixture_log" 2>&1 & fixture_pid=$!
    cleanup(){ kill "$fixture_pid" 2>/dev/null || true; wait "$fixture_pid" 2>/dev/null || true; rm -f "$fixture_log"; }
    trap cleanup EXIT
    for _ in {1..50}; do
      kill -0 "$fixture_pid" 2>/dev/null || { cat "$fixture_log"; exit 1; }
      [ "$(curl --noproxy '*' -fsS --max-time 1 "http://$DNS_FIXTURE:18080/" 2>/dev/null || true)" = LOCAL_DNS_OK ] && break
      sleep .1
    done
    kill -0 "$fixture_pid" 2>/dev/null || { cat "$fixture_log"; exit 1; }
    bash "$checks/check-network.sh"
  fi
else
  bash "$checks/check-user.sh"
  if [ "$chapter" -ge 6 ]; then bash "$checks/check-network.sh"; fi
fi
if [ "$chapter" -ge 7 ]; then bash "$checks/check-security.sh"; fi
