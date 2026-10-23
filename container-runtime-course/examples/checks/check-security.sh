#!/usr/bin/env bash
# 기본 capability/seccomp를 유지한다. 개별 t 호출의 override만 해당실험에적용한다.
set -u
B=${B:-./target/debug/myctr}; R=${ROOTFS:-./rootfs}
pass=0 fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ng(){ echo "FAIL  $1"; fail=$((fail+1)); }
eq(){ [ "$2" = "$3" ] && ok "$1" || ng "$1: $2 (기대 $3)"; }
run(){ "$B" run --rootfs "$R" "$@"; }
t(){ local want=$1; shift; run "$@" >/dev/null 2>&1; local got=$?; eq "[$want] $*" "$got" "$want"; }
st(){ run "$@" | awk -F'\t' -v k="$ST" '$1==k":"{print $2}'; }
DEFAULT=00000000a80425fb
ST=CapBnd; eq "기본 bounding 14개" "$(st cat /proc/self/status)" "$DEFAULT"
ST=CapEff; eq "기본 effective" "$(st cat /proc/self/status)" "$DEFAULT"
ST=CapInh; eq "inheritable 비움" "$(st cat /proc/self/status)" 0000000000000000
eq "setup hostname 유지" "$(run --hostname box hostname)" box
t 1 hostname changed-inside
t 2 ip link add vX type veth peer name vY
t 0 --cap-add NET_ADMIN ip link add vX type veth peer name vY
if [ "$(id -u)" = 0 ]; then
 # 기본권한에서는 성공하는 mapped UID1 chown을 cap-drop으로만 제한한다.
 run sh -c 'f=$(mktemp); chown 1 "$f"; r=$?; rm -f "$f"; exit $r' >/dev/null 2>&1
 [ "$?" = 0 ] || { echo "CHOWN positive control 실패"; exit 1; }
 t 1 --cap-drop CHOWN sh -c 'f=$(mktemp); chown 1 "$f"; r=$?; rm -f "$f"; exit $r'
else
 # single-map에서 UID1 자체가 unmapped이므로 chown실패를capability증거로오인하지않는다.
 ST=CapEff; eq "rootless CHOWN bit 제거" "$(st --cap-drop CHOWN cat /proc/self/status)" 00000000a80425fa
fi
ST=CapEff; eq "cap-drop ALL" "$(st --cap-drop ALL cat /proc/self/status)" 0000000000000000
t 1 --cap-add NO_SUCH_CAP true
init_eff=$(run --init sh -c 'read -r _ _ _ pp _ < /proc/self/stat; grep ^CapEff /proc/$pp/status' | cut -f2)
eq "init도 기본 제한" "$init_eff" "$DEFAULT"
ST=NoNewPrivs; eq "no_new_privs" "$(st cat /proc/self/status)" 1
ST=Seccomp; eq "seccomp 필터" "$(st cat /proc/self/status)" 2
t 1 unshare -U true
t 0 --no-seccomp unshare -U true
t 1 --cap-add SYS_ADMIN unshare -m true
t 0 --cap-add SYS_ADMIN --no-seccomp unshare -m true
t 1 --no-seccomp unshare -m true
# 원문31개 중 이전장검사는누적모듈이담당하고rootless도이모듈전체를별도실행한다.
run sh -c 'test ! -e /sys/fs/cgroup/cgroup.procs'; eq "권한제한뒤에도 cgroupfs 비노출" "$?" 0
echo "통과 $pass / $((pass+fail))"; [ "$fail" = 0 ]
