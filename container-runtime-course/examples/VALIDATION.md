# 통합 구현 실행 검증

2026-10-23에 Linux aarch64, Debian 12 기반 전용 privileged 컨테이너에서 실행했습니다. 커널은 `7.0.12-linuxkit`, Rust/Cargo는 `1.86.0`, Alpine minirootfs는 `3.22.2 aarch64`입니다. x86_64는 실행하지 않았습니다.

각 장의 소스와 Cargo.lock으로 빌드한 바이너리에 배포용 `chNN/check.sh`를 실행했습니다. 일반 사용자 launcher는 UID/GID 1000이고 `CapPrm`, `CapEff`, `CapAmb`가 모두 0입니다. root 결과로 rootless 통과를 대신하지 않았습니다.

| 장 | root 필수 결과 | 선택 외부 HTTP | rootless 필수 결과 |
|---|---:|---:|---:|
| 3 | 17 / 17 | 해당 없음 | 미지원 |
| 4 | 31 / 31 | 해당 없음 | 미지원 |
| 5 | 39 / 39 | 해당 없음 | 33 / 33 |
| 6 | 54 / 54 | 1 / 1 | 37 / 37 |
| 7 | 73 / 73 | 1 / 1 | 56 / 56 |
| 8 | 98 / 98 | 1 / 1 | 56 / 56 |

8장은 같은 Dir rootfs로 7장까지의 모듈을 전부 실행한 뒤 이미지 검사 25개를 더했습니다. 이미지는 root 실행이며 별도 UID/GID 범위 매핑을 사용하지 않을 때만 지원합니다. 실제 Docker Hub에서 Alpine 3.24를 받았으며, 실행별 overlay·이미지 설정·whiteout·opaque를 검증했습니다. Docker overlayfs 위에서는 whiteout 생성이 EPERM으로 실패하여 `/var/lib/myctr`를 새 실습 tmpfs에 준비했습니다. 배포용 저장소 준비 helper로도 실행했습니다.

`check-network.sh`의 root 출력은 필수 15개와 선택 1개를 합쳐 `16 / 16`입니다. 인터넷 연결이 불가능하면 선택 검사만 SKIP하며, 필수 15개는 그대로 실행합니다.

## 검사 모듈

| 모듈 | root | rootless | 확인하는 동작 |
|---|---:|---:|---|
| [check-base.sh](checks/check-base.sh) | 17 | 17 | 종료 코드·stdout·hostname·PID1·init·SIGPIPE·Alpine root·oldroot·proc·ps·dev·호스트 mount 보존 |
| [check-cgroup.sh](checks/check-cgroup.sh) | 14 | 해당 없음 | 부모의 소속/제한 관측·OOM·CPU throttling·pids·정상/실패 후 정리·cgroupfs 비노출 |
| [check-range.sh](checks/check-range.sh) | 8 | 해당 없음 | UID/GID0 선택·범위 매핑·보조 그룹 비우기·실제 파일 open 거부·바깥 소유권·범위 초과 거부 |
| [check-user.sh](checks/check-user.sh) | 해당 없음 | 16 | 단일 매핑·setgroups deny·실제 파일 open 거부·바깥 sentinel 비노출·소유권·UID1 전환/자원 옵션 거부 |
| [check-network.sh](checks/check-network.sh) | 15 + 선택 1 | 4 | none/host·bridge 주소/경로·range+bridge·NAT·로컬 DNS/HTTP·resolver 보존/읽기 전용·veth 정리 |
| [check-security.sh](checks/check-security.sh) | 19 | 19 | capability 집합/drop/add·hostname·NET_ADMIN·init·no_new_privs·seccomp와 명시적 비교 옵션 |
| [check-images.sh](checks/check-images.sh) | 25 | 해당 없음 | pull·내용 주소·overlay·upper 분리·Cmd/Entrypoint/Env/WorkingDir·로컬 DNS·읽기 전용 resolver·권한 제약·whiteout·정리 |

7장에서도 앞 장 검사에는 기본 capability/seccomp 정책을 유지했습니다. 보안 모듈의 개별 비교 검사에만 `--cap-add`/`--no-seccomp`를 사용했습니다. rootless에서 UID1 chown은 매핑 자체가 없어 실패하므로, 이를 CHOWN 제거의 증거로 사용하지 않고 capability 비트 제거를 관측합니다.

## 실행 기록

- [rootful.log](evidence/packaged-rootful-final.log): 배포용 driver로 3~7장 root 검사.
- [rootless.log](evidence/packaged-rootless-final.log): UID/GID·capability 확인 후 5~7장 일반 사용자 검사.
- [cgroup-lab.log](evidence/packaged-cgroup-helper.log): 배포용 일회용 환경 wrapper로 7장 누적 검사 실행.
- [prepare-rootfs.log](evidence/prepare-rootfs-proof.log): 사용자 소유 rootfs와 Alpine 도구 설치·fixture 준비.
- [manifest.json](manifest.json): 검증 환경, 장별 구성과 배포 파일 SHA-256.

로그의 `/work/package`, `/input`, PID 등은 검증한 일회용 컨테이너의 경로와 값입니다. 배포된 driver는 자기 위치를 기준으로 검사 모듈과 기본 바이너리를 찾습니다. 모드 불일치·추가 인자 거부도 별도로 확인했습니다.

HTML은 3~8장 모두 오프라인 Chromium에서 위젯·퀴즈·앵커·중복 ID·참조 소스 동일성, 360/768/1280px의 light/dark 화면과 모든 접힌 코드를 펼친 상태를 검사했습니다. 페이지 가로 넘침, 브라우저 오류, 외부 네트워크 요청은 없었습니다.

8장 추가 실행 기록은 [rootful](evidence/ch08/packaged-rootful-final.log)과 [rootless](evidence/ch08/packaged-rootless-final.log)에 있습니다. rootful 로그는 17+14+8+네트워크16(선택1 포함)+19+25, rootless는 17+16+4+19로 집계합니다.
