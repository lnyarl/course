# 누적 참조 구현: 3장부터 8장까지

각 `chNN`은 해당 장까지 만든 전체 프로젝트입니다. 앞 장의 `main.rs`를 다음 장의 코드로 교체하며 진행하거나, 각 폴더에서 독립적으로 빌드할 수 있습니다. HTML의 접힌 참조 코드와 이 소스는 같습니다.

| 장 | 누적 기능 | root 필수 검사 | 일반 사용자 검사 |
|---|---|---:|---:|
| [3](ch03/src/main.rs) | exec·UTS·PID·init + mount namespace·pivot_root·proc·dev | 17 | 해당 없음 |
| [4](ch04/src/main.rs) | 3장 + cgroup v2 | 31 | 해당 없음 |
| [5](ch05/src/main.rs) | 4장 + 단일/범위 UID·GID 매핑·부모 장벽 | 39 | 33 |
| [6](ch06/src/main.rs) | 5장 + none/host/bridge·NAT·실행별 DNS | 54 | 37 |
| [7](ch07/src/main.rs) | 6장 + capability·no_new_privs·seccomp | 73 | 56 |
| [8](ch08/src/main.rs) | 7장 + OCI 이미지·overlay·이미지 실행 설정 | 98 | 56 |

6~8장은 외부 HTTP 접속 1개를 선택 검사로 더합니다. 필수 DNS·HTTP 검사는 로컬 fixture를 사용하므로 인터넷 연결 성공으로 대체하지 않습니다. 일반 사용자 검사는 cgroup·범위 매핑·bridge를 포함하지 않습니다.

## 실행 환경

Linux 로컬 디스크에서 실행합니다. Rust 1.86 이상, cgroup v2, 호스트의 `bash`, `curl`, `tar`, `sha256sum`, `ip`(iproute2), `nsenter`(util-linux), `iptables`, `python3`가 필요합니다. rootless는 커널과 외부 보안 정책이 비특권 user namespace를 허용해야 합니다.

검증은 Debian 12 기반의 **전용 privileged Linux aarch64 컨테이너**에서 했습니다. macOS에서는 직접 실행할 수 없습니다. Docker Desktop의 공유 폴더 대신 Linux 내부 파일시스템에 프로젝트와 rootfs를 둡니다. x86_64용 분기는 포함하지만 실행 검증은 하지 않았습니다.

root 검사는 쓰기 가능한 cgroup v2와 memory/cpu/pids controller가 필요합니다. 4장의 controller 준비 절차를 먼저 수행하세요. 6장의 bridge는 `myctr0`(10.88.0.1/24), IP forwarding, iptables 규칙을 만듭니다. 실행별 veth·cgroup은 종료 시 지우지만 bridge·공통 NAT 규칙·forwarding 설정은 유지합니다. 격리한 실습 VM이나 일회용 컨테이너에서 사용합니다.

## rootfs 준비

다음 명령은 이 `examples` 디렉터리에서 실행합니다. Alpine 3.22.2 minirootfs를 다운로드하고 SHA-256을 확인합니다. 후속 장의 도구(iproute2·curl·python3·util-linux·libcap-utils)도 설치합니다. 기존 디렉터리를 덮어쓰지 않습니다.

```bash
# root 실행용: UID/GID 0 소유
sudo env OWNER_UID=0 OWNER_GID=0 bash prepare-rootfs.sh ./rootfs

# 일반 사용자 실행용: 현재 사용자 소유
OWNER_UID=$(id -u) OWNER_GID=$(id -g) bash prepare-rootfs.sh ./rootfs-user

# root의 범위 매핑 실험용: 바깥 UID/GID 100000 소유
sudo env OWNER_UID=100000 OWNER_GID=100000 bash prepare-rootfs.sh ./rootfs-range
```

일반 사용자용 준비도 패키지 설치와 권한 fixture 생성에는 `sudo`를 사용합니다. **준비 후 myctr 실행과 rootless 검사는 일반 사용자로** 수행합니다. `rootfs-user`를 root 소유로 준비하거나 root의 기존 rootfs를 그대로 재사용하면 mount 지점 생성·파일 쓰기가 실패할 수 있습니다.

`/root-only`는 비밀이 없는 검사 파일이며 root 소유·0600으로 남깁니다. 단일/범위 매핑으로 이 파일을 실제로 읽거나 쓰지 못하는지 확인합니다. 나머지 이미지 파일은 선택한 실행 모드의 바깥 UID/GID 소유로 준비합니다. single-ID 매핑은 안의 UID 1을 지원하지 않습니다.

## 빌드와 실행

```bash
cd ch05
cargo build --locked

# 일반 사용자: 안에서는 UID/GID 0, /는 Alpine
./target/debug/myctr run --rootfs ../rootfs-user id
ROOTFS="$PWD/../rootfs-user" bash check.sh rootless

# 별도 root 검사
sudo env ROOTFS="$PWD/../rootfs" RANGE_ROOTFS="$PWD/../rootfs-range" bash check.sh rootful
```

다른 장도 같은 명령을 각 `chNN`에서 실행합니다. 3·4장은 root 검사만 지원하고 `RANGE_ROOTFS`가 필요하지 않습니다. 5~8장 root 검사는 범위 매핑용 rootfs도 요구합니다. 다른 바이너리를 검사하려면 `B=/absolute/path/myctr`를 지정합니다. 검사 모드와 실행자의 UID가 다르면 시작 전에 거부합니다.

3~7장은 `--rootfs`가 필수입니다. 8장은 `--rootfs` 또는 `--image` 중 하나를 반드시 지정합니다. rootful 기본은 root 소유 rootfs, rootless는 사용자 소유 rootfs, `--userns-base 100000`은 100000 소유 rootfs를 사용합니다. 새 `/proc`에서 PID를 확인하고, cgroup 설정과 통계는 **호스트의** `/sys/fs/cgroup/myctr/ctr-<launcher PID>`에서 관측합니다. 호스트의 cgroupfs 전체를 rootfs 안에 붙이지 않습니다.

## 6~8장의 DNS와 네트워크 검사

```bash
cd ch06
cargo build --locked
sudo env ROOTFS="$PWD/../rootfs" RANGE_ROOTFS="$PWD/../rootfs-range" bash check.sh rootful
ROOTFS="$PWD/../rootfs-user" bash check.sh rootless

# 직접 실행할 때는 해당 네트워크에서 접근 가능한 DNS 서버를 지정
sudo ./target/debug/myctr run --rootfs ../rootfs --net bridge --dns <DNS_IP> curl https://example.com
```

root 검사 driver는 bridge를 준비한 뒤 10.88.0.1의 UDP 53과 HTTP 18080에 로컬 fixture를 열고 종료 시 닫습니다. 포트가 사용 중이면 검사 환경을 분리하세요. `course.test`의 DNS 조회와 HTTP 응답을 실제로 확인합니다. rootless 검사는 none/host와 bridge 거부만 검사하므로 fixture가 필요하지 않습니다.

`--dns`는 여러 번 지정할 수 있습니다. 옵션이 없으면 호스트 resolver를 사용하며, bridge에서 호스트 resolver가 loopback이면 clone 전에 오류를 반환합니다. 실행 전용 파일을 rootfs의 `etc/resolv.conf`에 읽기 전용 bind mount하므로 rootfs의 기존 내용을 덮어쓰지 않습니다. none 모드에는 외부 경로가 없습니다.

## 검사 구성과 범위

`checks/`의 모듈을 각 장의 `check.sh`가 순서대로 실행합니다. 옵션 거부 검사는 올바른 rootfs로 실행하며, 파일 접근 거부는 대상 파일의 존재·소유자·권한을 먼저 확인합니다. 검사 항목·실행 기록·소스 해시는 [VALIDATION.md](VALIDATION.md)에 있습니다.

7장은 기존 rootfs와 mount 작업을 **완료한 후** capability와 seccomp를 적용합니다. 앞 장 검사에도 기본 보안 정책을 유지합니다. 권한을 더하거나 seccomp를 끄는 옵션은 보안 동작을 비교하는 개별 검사에만 사용합니다. rootfs 읽기 전용화, 민감한 proc 경로 마스킹, 환경 변수·상속 FD 정리, 악성 이미지 검증은 추가 과제입니다. 현재 코드는 신뢰하는 Alpine rootfs를 사용하는 학습용입니다.

새 privileged Docker 컨테이너의 private cgroup namespace에서는 [run-cgroup-lab.sh](run-cgroup-lab.sh)가 이 검사에 필요한 controller를 켜고 runner cgroup을 정리할 수 있습니다. PID 1과 래퍼만 있는 새 실습 환경을 요구합니다. 기존 `myctr` cgroup이 있으면 거부하고, 시작 전 controller 상태를 복원합니다.

```bash
# examples 디렉터리, 새 전용 컨테이너 안에서 준비·빌드 후
DISPOSABLE_CGROUP_LAB=1 ROOTFS="$PWD/rootfs" RANGE_ROOTFS="$PWD/rootfs-range" \
  bash run-cgroup-lab.sh bash ch07/check.sh rootful
```

## 8장의 이미지 루트

기존 디렉터리 rootfs 경로와 rootless·범위 매핑은 유지합니다. `--image`는 root로만 실행하며, `--userns-base`와 함께 사용할 수 없습니다. 이미지 lower/cache/upper를 여러 user namespace의 소유권으로 변환하는 기능은 구현하지 않았습니다.

```bash
cd ch08
cargo build --locked
sudo ./target/debug/myctr pull alpine:3.24
sudo ./target/debug/myctr run --image alpine:3.24 --hostname box id
sudo env ROOTFS="$PWD/../rootfs" RANGE_ROOTFS="$PWD/../rootfs-range" bash check.sh rootful
ROOTFS="$PWD/../rootfs-user" bash check.sh rootless
```

이미지 검사는 7장까지의 root 필수 73개에 25개를 더합니다. Docker Hub pull에는 인터넷이 필요합니다. `src/image.rs`의 fixture builder로 whiteout·opaque·Entrypoint·WorkingDir을 가진 작은 이미지를 만들고 실제 overlay로 실행합니다. 실행별 upper/work는 정상 종료 때 지우고, 다운로드한 blob/layer/ref는 저장소에 남깁니다. 디렉터리 `--rootfs` 자체도 실행 후 그대로 남습니다.

이미지 mode의 Env·PATH·Cmd·Entrypoint·WorkingDir 설정을 적용하며, Dir mode는 이전 환경 상속을 유지합니다. DNS는 6장과 같은 명시적 `--dns`와 실행별 읽기 전용 bind 정책을 사용합니다. Docker 안에서는 `/var/lib/myctr`를 ext4/xfs 기반 별도 볼륨에 둡니다. 검증 환경의 Docker overlayfs 위에서는 whiteout용 `mknod(0:0)`도 EPERM으로 실패해 새 tmpfs 저장소에서 실행했습니다. 새 전용 실습 환경은 `DISPOSABLE_IMAGE_STORE=1 bash prepare-image-store.sh`로 빈 저장소를 tmpfs에 준비할 수 있습니다([스크립트](prepare-image-store.sh)). 기존 저장소를 숨기거나 덮어쓰지 않습니다.
