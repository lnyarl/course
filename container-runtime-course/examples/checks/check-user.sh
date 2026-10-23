#!/usr/bin/env bash
# 본인 소유 rootfs를 준비하고 sudo 없이 실행. root 전용 fixture는 바깥에서 준비.
set -u
B=${B:-./target/debug/myctr}; R=${ROOTFS:-./rootfs}
[ "$(id -u)" != 0 ] || { echo 일반사용자로실행; exit 1; }
F=${ROOT_ONLY_FIXTURE:-/root-only}
[ -f "$R$F" ] && [ "$(stat -c %u "$R$F")" = 0 ] && [ "$(stat -c %a "$R$F")" = 600 ] || {
 echo "rootfs 안 root 소유 mode600 fixture를 준비하세요: $R$F"; exit 1;
}
S=/usr/bin/setpriv
[ -x "$R$S" ] || S=/bin/setpriv
[ -x "$R$S" ] || { echo "rootfs에 util-linux setpriv를 설치하세요"; exit 1; }
sentinel=$(mktemp "${TMPDIR:-/tmp}/myctr-host-sentinel.XXXXXX")
printf 'outside-rootfs' > "$sentinel"
[ -f "$sentinel" ] || exit 1
marker=/tmp/myctr-user-$$
trap 'rm -f "$sentinel" "$R$marker"' EXIT
pass=0 fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ng(){ echo "FAIL  $1"; fail=$((fail+1)); }
eq(){ [ "$2" = "$3" ] && ok "$1" || ng "$1: $2 (기대 $3)"; }
run(){ "$B" run --rootfs "$R" "$@"; }
uid=$(id -u); gid=$(id -g)
eq "안쪽 UID 0" "$(run id -u)" 0
eq "안쪽 GID 0" "$(run id -g)" 0
eq "단일 uid_map" "$(run cat /proc/self/uid_map | awk '{$1=$1;print}')" "0 $uid 1"
eq "단일 gid_map" "$(run cat /proc/self/gid_map | awk '{$1=$1;print}')" "0 $gid 1"
eq "setgroups deny" "$(run cat /proc/self/setgroups)" deny
run /bin/sh -c '! cat "$1" >/dev/null 2>&1 && ! (exec 3<>"$1") 2>/dev/null' _ "$F"; eq "rootfs 안 host-root 소유 fixture 권한 거부" "$?" 0
run /bin/sh -c 'echo shared-data > "$1"' _ "$marker"; eq "쓰기 성공" "$?" 0
eq "rootfs 안 생성파일 바깥 UID" "$(stat -c %u "$R$marker")" "$uid"
eq "호스트에서 동일 데이터 관측" "$(cat "$R$marker")" shared-data
rm -f "$R$marker"
run /bin/sh -c 'test ! -e "$1"' _ "$sentinel"; eq "rootfs 바깥 호스트 sentinel 차단" "$?" 0
error=$(run "$S" --groups=0 true 2>&1); status=$?
[ "$status" -ne 0 ] && [[ "$error" == *setgroups* ]] && ok "setgroups 호출 거부" || ng "setgroups 호출 거부"
error=$(run "$S" --reuid 1 --keep-groups true 2>&1); status=$?
[ "$status" -ne 0 ] && [[ "$error" == *setresuid* || "$error" == *setuid* ]] && ok "단일 매핑 밖 UID 1 전환 거부" || ng "UID 매핑 밖 전환 거부"
for args in '--memory 16M' '--cpus 0.5' '--pids 8' '--userns-base 100000'; do
 run $args true >/dev/null 2>&1; eq "rootless 금지 옵션 $args" "$?" 1
done
# base suite 17개는 root 권한검사 한 줄만 바꾸어 아래 비특권 실행용으로 제공한다.
echo "통과 $pass / $((pass+fail))"; [ "$fail" = 0 ]
