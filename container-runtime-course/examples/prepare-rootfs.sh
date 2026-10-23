#!/usr/bin/env bash
# Linux 로컬 디스크의 새 디렉터리에 준비한다. 기존 디렉터리는 덮어쓰지 않는다.
# rootful: ./prepare-rootfs.sh ./rootfs
# rootless: OWNER_UID=$(id -u) OWNER_GID=$(id -g) ./prepare-rootfs.sh ./rootfs-user
# range: OWNER_UID=100000 OWNER_GID=100000 ./prepare-rootfs.sh ./rootfs-range
set -euo pipefail
case "$(uname -m)" in aarch64|arm64) arch=aarch64;; x86_64) arch=x86_64;; *) echo unsupported; exit 1;; esac
ver=3.22.2
rootfs=$(realpath -m "${1:-./rootfs}")
[ "$rootfs" != / ] && [ ! -e "$rootfs" ] || { echo "새 rootfs 경로를 지정하세요"; exit 1; }
uid=${OWNER_UID:-$(id -u)}; gid=${OWNER_GID:-$(id -g)}
SUDO=(); [ "$(id -u)" = 0 ] || SUDO=(sudo)
cache=$(mktemp -d); trap 'rm -rf "$cache"' EXIT
archive=alpine-minirootfs-$ver-$arch.tar.gz
url=https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/$arch
curl -fL "$url/$archive" -o "$cache/$archive"
curl -fL "$url/$archive.sha256" -o "$cache/$archive.sha256"
(cd "$cache" && sha256sum -c "$archive.sha256")
mkdir "$rootfs"
tar -xzf "$cache/$archive" -C "$rootfs"
mkdir -p "$rootfs/proc" "$rootfs/dev"
# 준비 시에만 resolver를 복사한다. 런타임은 별도 파일을 bind한다.
cp /etc/resolv.conf "$rootfs/etc/resolv.conf"
if [ "${WITH_TOOLS:-1}" = 1 ]; then
  "${SUDO[@]}" chroot "$rootfs" /sbin/apk add --no-cache iproute2 curl python3 util-linux libcap-utils
fi
"${SUDO[@]}" chown -R "$uid:$gid" "$rootfs"
# 권한 경계 검사 전용 비밀이 아닌 fixture. rootfs 안에서만 만든다.
"${SUDO[@]}" install -o 0 -g 0 -m 600 /dev/null "$rootfs/root-only"
printf 'course-root-only-fixture\n' | "${SUDO[@]}" tee "$rootfs/root-only" >/dev/null
printf 'rootfs=%s owner=%s:%s\n' "$rootfs" "$uid" "$gid"
