#!/usr/bin/env bash
# 1장 완료 기준: ./check.sh   (macOS와 Linux 모두)
B=${B:-./target/debug/mydb}
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
F="$D/test.log"
pass=0 fail=0
ok() { echo "PASS  $1"; pass=$((pass+1)); }
ng() { echo "FAIL  $1"; fail=$((fail+1)); }
eq() { [ "$2" = "$3" ] && ok "$1" || ng "$1: '$2' (기대 '$3')"; }
# 명령 여러 줄을 한 번의 실행으로. 실행할 때마다 로그를 처음부터 다시 읽는다
q() { printf '%s\n' "$@" | "$B" "$F" 2>/dev/null; }
size() { wc -c < "$F" | tr -d ' '; }
NL=$'\n'

eq "set / get"              "$(q 'set a 1' 'get a')"     "OK${NL}1"
eq "없는 키"                "$(q 'get nope')"            "(nil)"
eq "재시작해도 남는다"      "$(q 'get a')"               "1"
eq "덮어쓰기는 최신 값"     "$(q 'set a 2' 'get a')"     "OK${NL}2"
eq "공백이 든 값"           "$(q 'set greet hello world' 'get greet')" "OK${NL}hello world"
eq "del"                    "$(q 'del a' 'get a' 'del a')" "1${NL}(nil)${NL}0"
eq "del은 재시작 후에도"    "$(q 'get a')"               "(nil)"
eq "count"                  "$(q 'count')"               "1"
# 레코드 = 머리 12 + 키 + 값. set a 1(14) + set a 2(14) + set greet ..(28) + del a(13)
eq "파일 크기 = 레코드 합"  "$(size)"                     "69"

# 찢어진 쓰기: 마지막 레코드의 끝 1바이트가 디스크에 닿지 못한 상황
q 'set torn value' >/dev/null
head -c $(( $(size) - 1 )) "$F" > "$D/cut" && mv "$D/cut" "$F"
warn=$(printf 'get torn\n' | "$B" "$F" 2>&1 >/dev/null)
[[ "$warn" == *"깨진 꼬리"* ]] && ok "찢어진 꼬리를 알린다" || ng "찢어진 꼬리 경고: '$warn'"
eq "찢어진 레코드는 버리고 나머지는 산다" "$(q 'get torn' 'get greet')" "(nil)${NL}hello world"
eq "잘라 낸 뒤 파일 크기"   "$(size)"                     "69"

# 손상: 마지막 레코드의 값 1바이트를 바꾼다. crc가 맞지 않아야 한다
q 'set c xyz' >/dev/null
printf 'Q' | dd of="$F" bs=1 seek=$(( $(size) - 1 )) conv=notrunc 2>/dev/null
eq "crc가 손상을 잡는다"    "$(q 'get c' 'get greet')"   "(nil)${NL}hello world"

# compact: 같은 키를 200번 덮어쓰면 로그는 커지지만 살아 있는 값은 하나
for i in $(seq 1 200); do echo "set k v$i"; done | "$B" "$F" >/dev/null
before=$(size)
q 'compact' >/dev/null
after=$(size)
[ "$after" -lt "$before" ] && ok "compact로 줄어든다 ($before → $after 바이트)" || ng "compact: $before → $after"
eq "compact 후에도 최신 값" "$(q 'get k' 'get greet' 'count')" "v200${NL}hello world${NL}2"
eq "compact 결과 = 살아 있는 레코드만" "$after" "$(( (12+1+4) + (12+5+11) ))"
[[ "$(q 'oops')" == 에러:* ]] && ok "알 수 없는 명령은 에러" || ng "알 수 없는 명령"

echo "---"; echo "통과 $pass / $((pass+fail))"
[ $fail -eq 0 ]