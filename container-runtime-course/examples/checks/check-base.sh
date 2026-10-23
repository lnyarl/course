#!/usr/bin/env bash
# 3장 완료 기준: sudo ./check.sh  (rootfs 위치는 ROOTFS로 바꿀 수 있다)
B=${B:-./target/debug/myctr}
R=${ROOTFS:-./rootfs}
[ -x "$R/bin/busybox" ] || { echo "$R 에 Alpine rootfs가 없습니다"; exit 1; }
pass=0 fail=0
ok() { echo "PASS  $1"; pass=$((pass+1)); }
ng() { echo "FAIL  $1"; fail=$((fail+1)); }
run() { "$B" run --rootfs "$R" "$@"; }
t()  { local want=$1; shift; run "$@" >/dev/null 2>&1; local got=$?
       [ "$got" = "$want" ] && ok "[$want] $*" || ng "[$want] $*  (실제 $got)"; }
eq() { [ "$2" = "$3" ] && ok "$1" || ng "$1: '$2' (기대 '$3')"; }
mounts_before=$(wc -l < /proc/self/mounts)

# 1·2장 기준 (이제 rootfs 안의 busybox로 실행된다)
t 0   true
t 1   false
t 3   /bin/sh -c 'exit 3'
t 127 no-such-command
eq "stdout 전달" "$(run echo hello world)" "hello world"
eq "hostname 격리" "$(run --hostname box hostname)" "box"
eq "명령이 PID 1" "$(run /bin/sh -c 'echo $$')" "1"
t 143 --init /bin/sh -c 'kill -TERM $$'
eq "SIGPIPE 기본값" "$(run /bin/sh -c 'yes | head -1' 2>&1)" "y"

# 3장: 파일시스템 격리
eq "루트가 Alpine" "$(run /bin/sh -c '. /etc/os-release; echo $ID')" "alpine"
eq "이전 루트가 보이지 않음" "$(run /bin/sh -c 'ls -a / | grep -c oldroot')" "0"
eq "/proc/self가 컨테이너 PID" "$(run readlink /proc/self)" "1"
eq "ps에는 컨테이너 프로세스만" "$(run ps -o pid | tail -n +2 | tr -d ' ')" "1"
eq "/dev/null 동작" "$(run /bin/sh -c 'echo x > /dev/null && echo ok')" "ok"
eq "/dev/zero 동작" "$(run /bin/sh -c 'head -c 4 /dev/zero | od -An -tx1 | tr -d " "')" "00000000"
eq "호스트 마운트 개수 그대로" "$(wc -l < /proc/self/mounts)" "$mounts_before"
[ ! -e "$R/.oldroot" ] && ok "rootfs에 .oldroot 흔적 없음" || ng "rootfs에 .oldroot 흔적 없음"

echo "---"; echo "통과 $pass / $((pass+fail))"
[ $fail -eq 0 ]
