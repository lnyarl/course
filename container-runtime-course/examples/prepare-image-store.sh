#!/usr/bin/env bash
# Docker의 overlayfs 기반 rootfs 대신, whiteout과 upperdir를 지원하는 실습용 tmpfs.
# 새 일회용 privileged 컨테이너에서만: DISPOSABLE_IMAGE_STORE=1 bash prepare-image-store.sh
# 기존 데이터나 기존 마운트를 가리지 않는다. tmpfs 내용은 컨테이너 종료 시 사라진다.
set -euo pipefail
[ "${DISPOSABLE_IMAGE_STORE:-}" = 1 ] && [ -f /.dockerenv ] && [ "$(id -u)" = 0 ] || {
 echo "새 일회용 privileged Docker 컨테이너에서 명시적으로 실행하세요"; exit 1;
}
store=/var/lib/myctr
mkdir -p "$store"
! mountpoint -q "$store" || { echo "기존 store 마운트가 있습니다"; exit 1; }
[ -z "$(find "$store" -mindepth 1 -maxdepth 1 -print -quit)" ] || {
 echo "store가 비어 있지 않습니다. 기존 데이터를 보존하고 새 컨테이너를 사용하세요"; exit 1;
}
mount -t tmpfs -o mode=755,size=512m tmpfs "$store"
probe=$(mktemp -d "$store/.whiteout-probe.XXXXXX")
cleanup_on_error(){ rm -rf "$probe"; umount "$store"; exit 1; }
trap cleanup_on_error ERR
mknod "$probe/whiteout" c 0 0
python3 - "$probe" <<'PY'
import os,sys
os.setxattr(sys.argv[1],b'trusted.overlay.opaque',b'y')
assert os.getxattr(sys.argv[1],b'trusted.overlay.opaque')==b'y'
PY
rm -rf "$probe"
trap - ERR
printf 'image store ready: %s (tmpfs, 512MiB, whiteout/xattr 검증)\n' "$store"
