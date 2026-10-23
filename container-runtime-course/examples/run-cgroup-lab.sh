#!/usr/bin/env bash
# 새 privileged Docker 컨테이너(--cgroupns=private) 안에서만 사용한다.
# DISPOSABLE_CGROUP_LAB=1 bash run-cgroup-lab.sh <검사 명령> [인자...]
set -euo pipefail
[ "${DISPOSABLE_CGROUP_LAB:-}" = 1 ] && [ -f /.dockerenv ] && [ "$(cat /proc/self/cgroup)" = '0::/' ] || {
 echo "새 일회용 privileged Docker + private cgroup namespace에서만 실행하세요"; exit 1;
}
[ "$(id -u)" = 0 ] && [ "$#" -gt 0 ] || exit 1
cg=/sys/fs/cgroup
[ ! -e "$cg/myctr" ] || { echo "기존 myctr cgroup이 있습니다. 새 실습 컨테이너를 쓰세요"; exit 1; }
# PID 1과 이 래퍼 외의 장기 실행 프로세스가 있으면 기존 상태를 건드리지 않는다.
while read -r pid; do
 if [ "$pid" != 1 ] && [ "$pid" != "$$" ] && kill -0 "$pid" 2>/dev/null; then
   echo "먼저 별도 실습 프로세스를 종료하세요: PID $pid"; exit 1
 fi
done < "$cg/cgroup.procs"
initial=$(cat "$cg/cgroup.subtree_control")
added=()
runner=$cg/course-check-$$
mkdir "$runner"
cleanup(){
 result=$?; trap - EXIT; set +e
 # 이 래퍼 시작 시 없었던 부모만 지운다. 살아 있는 프로세스는 강제로 죽이지 않는다.
 [ ! -d "$cg/myctr" ] || rmdir "$cg/myctr" || echo "검사 cgroup이 비어 있지 않습니다" >&2
 for controller in "${added[@]}"; do printf '%s\n' "-$controller" > "$cg/cgroup.subtree_control"; done
 printf '1\n' > "$cg/cgroup.procs"
 printf '%s\n' "$$" > "$cg/cgroup.procs"
 rmdir "$runner"
 exit "$result"
}
trap cleanup EXIT
printf '1\n' > "$runner/cgroup.procs"
printf '%s\n' "$$" > "$runner/cgroup.procs"
for controller in memory cpu pids; do
 if [[ " $initial " != *" $controller "* ]]; then
   printf '%s\n' "+$controller" > "$cg/cgroup.subtree_control"
   added+=("$controller")
 fi
done
"$@"
