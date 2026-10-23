#!/usr/bin/env bash
# image 모드 전용 25개. rootfs 기반 앞 장 누적 검사는 다른 모듈이 담당한다.
set -u
[ "$(id -u)" = 0 ] || { echo "이미지 검사는 initial user namespace root로 실행하세요"; exit 1; }
B=${B:-./target/debug/myctr}; IMG=alpine:3.24; STORE=/var/lib/myctr
IMAGE_PROJECT=${IMAGE_PROJECT:?ch08 프로젝트 경로 지정}
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
public=$(mktemp -d /tmp/myctr-image-guard.XXXXXX)
chmod 755 "$public"
cp "$B" "$public/myctr"; chmod 755 "$public/myctr"
trap 'rm -rf "$work" "$public"' EXIT
pass=0 fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ng(){ echo "FAIL  $1"; fail=$((fail+1)); }
eq(){ [ "$2" = "$3" ] && ok "$1" || ng "$1: '$2' (기대 '$3')"; }
run(){ "$B" run --image "$IMG" "$@"; }
"$B" pull "$IMG" >"$work/pull" 2>&1 && ok "Docker Hub pull" || { cat "$work/pull"; ng "pull"; exit 1; }
[[ "$("$B" images)" == *library/alpine:3.24* ]] && ok "images 목록" || ng "images"
bad=0; count=0
for f in "$STORE"/blobs/sha256/*; do
 [ -f "$f" ] || continue; count=$((count+1))
 [ "$(sha256sum "$f" | cut -d' ' -f1)" = "$(basename "$f")" ] || bad=1
done
[ "$count" -gt 0 ] && [ "$bad" = 0 ] && ok "blob 내용 주소 검증" || ng "blob 검증"
cargo test --manifest-path "$IMAGE_PROJECT/Cargo.toml" --locked -- --ignored --test-threads=1 >"$work/fixture" 2>&1 || { cat "$work/fixture"; exit 1; }
python3 "$here/image-fixtures.py" >"$work/config" || exit 1
eq "이미지 Alpine 루트" "$(run sh -c '. /etc/os-release; echo $ID')" alpine
eq "이미지 Cmd 기본값" "$(printf 'echo hi\n' | run)" hi
eq "이미지 PATH" "$(run sh -c 'echo "$PATH"')" /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
eq "HOSTNAME 환경" "$(run --hostname box sh -c 'echo "$HOSTNAME"')" box
eq "HOME 기본 환경" "$(run sh -c 'echo "$HOME"')" /root
eq "이미지 proc PID1" "$(run readlink /proc/self)" 1
[[ "$(run cat /proc/self/mountinfo | awk '$5=="/"')" == *" - overlay "* ]] && ok "overlay 루트" || ng "overlay"
run sh -c 'echo upper > /course-upper' >/dev/null 2>&1; write_status=$?
run test -e /course-upper >/dev/null 2>&1; absent_status=$?
[ "$write_status" = 0 ] && [ "$absent_status" = 1 ] && ok "upper 쓰기와 실행 간 폐기" || ng "upper 격리"
eq "이미지 hostname 파일" "$(run --hostname box cat /etc/hostname)" box
run --hostname box grep -q '127.0.1.1.*box' /etc/hosts; eq "이미지 hosts 파일" "$?" 0
run --dns 10.88.0.1 sh -c '! echo changed >/etc/resolv.conf' >/dev/null 2>&1; eq "이미지 DNS 읽기 전용" "$?" 0
eq "이미지 local DNS/HTTP" "$(run --net bridge --dns 10.88.0.1 wget -qO- -T 3 http://course.test:18080/)" LOCAL_DNS_OK
eq "이미지 기본 capability" "$(run cat /proc/self/status | awk -F'\t' '$1=="CapEff:"{print $2}')" 00000000a80425fb
run --init sh -c 'kill -TERM $$' >/dev/null 2>&1; eq "이미지 init SIGTERM" "$?" 143
run no-such-command >/dev/null 2>&1; eq "이미지 명령 탐색 실패" "$?" 127
"$B" run true >/dev/null 2>&1; neither=$?
"$B" run --image "$IMG" --rootfs /tmp true >/dev/null 2>&1; both=$?
[ "$neither" = 2 ] && [ "$both" = 2 ] && ok "root 선택 하나만 필수" || ng "root 선택"
setpriv --reuid 1000 --regid 1000 --clear-groups "$public/myctr" run --image course/guard:absent true >"$work/rootless" 2>&1; status=$?
[ "$status" = 1 ] && grep -q 'root 실행' "$work/rootless" && ok "rootless image 다운로드 전 거부" || ng "rootless image 거부"
"$B" run --image course/guard:absent --userns-base 100000 true >"$work/range" 2>&1; status=$?
[ "$status" = 1 ] && grep -q 'root 실행' "$work/range" && ok "range image 다운로드 전 거부" || ng "range image 거부"
default=$("$B" run --image course/entrypoint:fixture)
override=$("$B" run --image course/entrypoint:fixture override)
[ "$default" = 'ENTRY default' ] && [ "$override" = 'ENTRY override' ] && ok "Entrypoint + Cmd/명령 override" || ng "Entrypoint/Cmd"
eq "image Env·WorkingDir와 호스트 환경 차단" "$(HOST_ONLY_COURSE=host "$B" run --image course/environment:fixture sh -c 'printf "%s|%s|%s" "$COURSE_ENV" "$PWD" "${HOST_ONLY_COURSE-unset}"')" 'fixture|/tmp|unset'
"$B" run --image course/whiteout:fixture sh -c 'test ! -e /course/remove && test ! -e /course/opaque/old && test "$(cat /course/opaque/new)" = present' >/dev/null 2>&1; eq "실제 whiteout·opaque overlay 숨김" "$?" 0
left=$(find "$STORE/containers" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
eq "이미지 작업 공간 회수" "$left" 0
echo "통과 $pass / $((pass+fail))"; [ "$fail" = 0 ]
