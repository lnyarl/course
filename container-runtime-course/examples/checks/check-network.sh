#!/usr/bin/env bash
# 전용실습Linux에서 network-fixture.py를외부부모로실행해 DNS+HTTP fixture를 준비한다.
set -u
B=${B:-./target/debug/myctr}; R=${ROOTFS:-./rootfs}; RR=${RANGE_ROOTFS:-}
DNS_FIXTURE=${DNS_FIXTURE:-10.88.0.1}
pass=0 fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ng(){ echo "FAIL  $1"; fail=$((fail+1)); }
eq(){ [ "$2" = "$3" ] && ok "$1" || ng "$1: $2 (기대 $3)"; }
run(){ "$B" run --rootfs "$R" "$@"; }
UPIF="ip -br link | awk '\$2 != \"DOWN\" {sub(/@.*/, \"\", \$1); print \$1}' | sort | tr '\n' ' '"
[ "$(run readlink /proc/self/ns/net)" != "$(readlink /proc/self/ns/net)" ] && ok "none은 새 net ns" || ng "새 net ns"
eq "none은 lo만" "$(run sh -c "$UPIF")" "lo "
eq "host는 부모 net ns" "$(run --net host readlink /proc/self/ns/net)" "$(readlink /proc/self/ns/net)"
if [ "$(id -u)" != 0 ]; then
 run --net bridge true >/dev/null 2>&1; eq "rootless bridge 거부" "$?" 1
 echo "통과 $pass / $((pass+fail))"; [ "$fail" = 0 ]; exit
fi
veth_before=$(ip -br link | grep -c '^veth' || true)
resolver_before=$(sha256sum "$R/etc/resolv.conf" | cut -d' ' -f1)
eq "bridge는 eth0와 lo" "$(run --net bridge --dns "$DNS_FIXTURE" sh -c "$UPIF")" "eth0 lo "
[[ "$(run --net bridge --dns "$DNS_FIXTURE" ip -4 -br addr show eth0)" == *10.88.0.* ]] && ok "bridge IP" || ng "bridge IP"
[[ "$(run --net bridge --dns "$DNS_FIXTURE" ip route)" == *"default via 10.88.0.1"* ]] && ok "bridge 경로" || ng "bridge 경로"
[ -n "$RR" ] || { echo RANGE_ROOTFS필요; exit 1; }
[[ "$("$B" run --rootfs "$RR" --userns-base 100000 --net bridge --dns "$DNS_FIXTURE" ip -4 -br addr show eth0)" == *10.88.0.* ]] && ok "range bridge" || ng "range bridge"
[[ "$(ip -br addr show myctr0)" == *10.88.0.1/24* ]] && ok "부모 bridge" || ng "부모 bridge"
iptables -t nat -C POSTROUTING -s 10.88.0.0/24 ! -o myctr0 -j MASQUERADE 2>/dev/null && ok "NAT 규칙" || ng "NAT 규칙"
eq "local bridge HTTP" "$(run --net bridge --dns "$DNS_FIXTURE" curl --noproxy '*' -fsS --max-time 3 http://10.88.0.1:18080/)" LOCAL_DNS_OK
eq "local bridge DNS로 이름 접속" "$(run --net bridge --dns "$DNS_FIXTURE" curl --noproxy '*' -fsS --max-time 3 http://course.test:18080/)" LOCAL_DNS_OK
run --net none curl --noproxy '*' -fsS --max-time 2 http://10.88.0.1:18080/ >/dev/null 2>&1; eq "none은 fixture망 접근 불가" "$?" 7
eq "공유 rootfs resolver 내용 보존" "$(sha256sum "$R/etc/resolv.conf" | cut -d' ' -f1)" "$resolver_before"
run --net bridge --dns "$DNS_FIXTURE" sh -c '! echo changed >/etc/resolv.conf' >/dev/null 2>&1; eq "전용 resolver 읽기 전용" "$?" 0
for _ in {1..20}; do [ "$(ip -br link | grep -c '^veth' || true)" = "$veth_before" ] && break; sleep .1; done
eq "veth 누수 없음" "$(ip -br link | grep -c '^veth' || true)" "$veth_before"
if curl --noproxy '*' -s -o /dev/null --max-time 3 http://1.1.1.1; then
 code=$(run --net bridge --dns "$DNS_FIXTURE" curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 3 http://1.1.1.1)
 [ "$code" != 000 ] && ok "선택 외부 HTTP($code)" || ng "외부 HTTP"
else echo "SKIP 외부 egress(부모에서 연결 불가); local DNS/HTTP는 필수검사"; fi
echo "통과 $pass / $((pass+fail))"; [ "$fail" = 0 ]
