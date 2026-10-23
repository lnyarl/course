#!/usr/bin/env bash
# root + 전용 실습 cgroup v2 환경. 컨테이너에 cgroupfs를 노출하지 않는다.
set -u
B=${B:-./target/debug/myctr}; R=${ROOTFS:-./rootfs}
pass=0 fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ng(){ echo "FAIL  $1"; fail=$((fail+1)); }
eq(){ [ "$2" = "$3" ] && ok "$1" || ng "$1: $2 (기대 $3)"; }
run(){ "$B" run --rootfs "$R" "$@"; }
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
"$B" run --rootfs "$R" --memory 64M --cpus 0.5 --pids 8 /bin/sleep 2 & launcher=$!
cg=/sys/fs/cgroup/myctr/ctr-$launcher
for _ in {1..100}; do [ -n "$(cat "$cg/cgroup.procs" 2>/dev/null)" ] && break; sleep .01; done
[ -n "$(cat "$cg/cgroup.procs" 2>/dev/null)" ] && ok "부모가 실행 중 cgroup 소속 관측" || ng "cgroup 소속"
eq "memory.max" "$(cat "$cg/memory.max")" 67108864
eq "cpu.max" "$(cat "$cg/cpu.max")" "50000 100000"
eq "pids.max" "$(cat "$cg/pids.max")" 8
wait "$launcher"; eq "정상 명령 종료" "$?" 0
[ ! -d "$cg" ] && ok "정상 종료 cgroup 회수" || ng "cgroup 회수"
run --memory 64M /bin/dd if=/dev/zero of=/dev/null bs=16M count=1 >/dev/null 2>&1; eq "상한 아래 메모리" "$?" 0
run --memory 64M /bin/dd if=/dev/zero of=/dev/null bs=200M count=1 >"$work/oom" 2>&1; eq "OOM 종료" "$?" 137
grep -q OOM "$work/oom" && ok "OOM 안내" || ng "OOM 안내"
"$B" run --rootfs "$R" --cpus 0.5 /bin/sh -c 'timeout 1 /bin/sh -c "while :; do :; done"; sleep 2' >/dev/null 2>&1 & launcher=$!
cg=/sys/fs/cgroup/myctr/ctr-$launcher
sleep 1.3
usage=$(awk '/^usage_usec/{print $2}' "$cg/cpu.stat"); thr=$(awk '/^nr_throttled/{print $2}' "$cg/cpu.stat")
[ "${usage:-999999}" -lt 700000 ] && [ "${thr:-0}" -gt 0 ] && ok "CPU 제한과 throttling (usage=${usage}us, throttled=$thr)" || ng "CPU 제한 usage=$usage thr=$thr"
wait "$launcher"
run --pids 1 --init true >/dev/null 2>&1; eq "pids로 fork 차단" "$?" 1
mkdir -p "$work/bad-rootfs/"{bin,proc,dev,etc}
touch "$work/bad-rootfs/bin/sh" "$work/bad-rootfs/.oldroot"
"$B" run --rootfs "$work/bad-rootfs" true >/dev/null 2>&1; eq "잘못된 rootfs setup 실패" "$?" 1
left=$(find /sys/fs/cgroup/myctr -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
eq "실패 뒤 cgroup 누수 없음" "$left" 0
run /bin/sh -c 'test ! -e /sys/fs/cgroup/cgroup.procs'; eq "cgroupfs 전체 비노출" "$?" 0
echo "통과 $pass / $((pass+fail))"; [ "$fail" = 0 ]
