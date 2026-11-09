#!/usr/bin/env bash
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
rustc --edition=2024 --test "$HERE/wal.rs" -o "$D/tests"
"$D/tests" --quiet
rustc --edition=2024 "$HERE/wal.rs" -o "$D/wal"
python3 - "$D/wal" "$D" <<'PY'
import json, os, pathlib, struct, subprocess, sys, zlib
binary, root = sys.argv[1], pathlib.Path(sys.argv[2])
CREATE = "CREATE TABLE people (id INT NOT NULL, name TEXT NOT NULL, age INT)"
INSERT = "INSERT INTO people VALUES (1,'Roy',35)"
SELECT = "SELECT id,name,age FROM people ORDER BY id"
def run(db, sql='', point=None, option=None):
    env = os.environ.copy()
    env.pop('MYDB_CRASH_POINT', None)
    if point: env['MYDB_CRASH_POINT'] = point
    args = [binary, str(db)] + ([option] if option else [])
    return subprocess.run(args, input=sql, text=True, capture_output=True, env=env)
def ok(result):
    assert result.returncode == 0, (result.returncode, result.stdout, result.stderr)
    return result
def rows(db): return json.loads(ok(run(db, SELECT)).stdout)['rows']
# Each crash is a fresh process. Process exit is not a simulated device power loss.
for point in ['before-commit-record','after-wal-sync','during-apply','after-data-sync','after-checkpoint']:
    db = root / ('crash-' + point)
    ok(run(db, CREATE))
    result = run(db, INSERT, point=point)
    assert result.returncode == 86, (point, result.stderr)
    # OS must release the stable-inode flock when the process exits.
    recovered = ok(run(db, option='--recover')).stdout.strip()
    expected_revision = 1 if point == 'before-commit-record' else 2
    assert recovered == 'revision=' + str(expected_revision), (point, recovered)
    result_rows = rows(db)
    assert len(result_rows) == (0 if point == 'before-commit-record' else 1), (point, result_rows)
    if result_rows:
        # The heap and primary index are both restored, not only one afterimage.
        found = json.loads(ok(run(db, 'SELECT name FROM people WHERE id=1')).stdout)['rows']
        assert found and 'Roy' in json.dumps(found), found
    assert rows(db) == result_rows  # repeated recovery is idempotent
    assert not list(db.glob('.wal-work-*')), point
    assert (db / '.wal.lock').is_file(), point
# Keep a committed WAL before installation, then corrupt a COMPLETE frame.
db = root / 'bad-crc'
ok(run(db, CREATE))
assert run(db, INSERT, point='after-wal-sync').returncode == 86
wal = db / 'wal.log'
log = bytearray(wal.read_bytes())
assert len(log) > 32
log[-1] ^= 1
wal.write_bytes(log)
before = (db / 'tables.pages').read_bytes()
assert run(db, option='--recover').returncode != 0
assert (db / 'tables.pages').read_bytes() == before
assert wal.read_bytes() == log  # fail closed, do not silently erase acknowledged data
# Complete invalid length CRC also fails, rather than being mistaken for an EOF tail.
db = root / 'bad-length'
ok(run(db, CREATE))
assert run(db, INSERT, point='after-wal-sync').returncode == 86
log = bytearray((db / 'wal.log').read_bytes()); log[20] ^= 1
(db / 'wal.log').write_bytes(log)
assert run(db, option='--recover').returncode != 0
# Actual OS lock contention against another live process (macOS/Linux flock).
db = root / 'locked'
ok(run(db, CREATE))
import fcntl
with open(db / '.wal.lock','r+b') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    assert run(db, option='--recover').returncode != 0
ok(run(db, option='--recover'))
# A successful checkpoint is just the CRC-protected header, revision preserved.
header = (db / 'wal.log').read_bytes()
assert len(header) == 20 and header[:8] == b'MYWAL07\0'
assert struct.unpack('<Q', header[8:16])[0] == 1
assert struct.unpack('<I', header[16:20])[0] == zlib.crc32(header[:16])
# A crash may leave the reserved workspace directory before marker publication.
# Such unproven directories are retained, never recursively deleted, and ignored
# while committed WAL/data recovery continues.
for i, marker in enumerate([None,b'',b'MYDB_W',b'MYDB_WORK07 ',b'foreign marker']):
    db=root / ('bootstrap-orphan-'+str(i));ok(run(db,CREATE));ok(run(db,INSERT))
    orphan=db / ('.wal-work-12345-'+str(i+1));orphan.mkdir()
    if marker is not None:(orphan / '.wal-owner').write_bytes(marker)
    assert ok(run(db,option='--recover')).stdout.strip()=='revision=2'
    assert len(rows(db))==1 and orphan.is_dir()
    if marker is not None:assert (orphan / '.wal-owner').read_bytes()==marker
# Complete canonical, same-UID ownership evidence still permits orphan cleanup.
db=root / 'owned-orphan';ok(run(db,CREATE));orphan=db / '.wal-work-12345-99';orphan.mkdir()
(orphan / '.wal-owner').write_bytes(b'MYDB_WORK07 17')
ok(run(db,option='--recover'));assert not orphan.exists()
# Unknown content is retained even when it carries a marker, and symlinks fail closed.
orphan=db / '.wal-work-12345-100';orphan.mkdir();(orphan / '.wal-owner').write_bytes(b'MYDB_WORK07 17');(orphan / 'notes.txt').write_text('keep')
ok(run(db,option='--recover'));assert (orphan / 'notes.txt').read_text()=='keep'
sentinel=root / 'marker-sentinel';sentinel.write_text('untouched')
linked=db / '.wal-work-12345-101';linked.mkdir();(linked / '.wal-owner').symlink_to(sentinel)
assert run(db,option='--recover').returncode!=0 and sentinel.read_text()=='untouched'
print('PASS: 5 separate-process crash boundaries, REDO/idempotence, no uncommitted publish, real heap/index SELECT, flock release/contention, CRC fail-closed, checkpoint bytes, bootstrap-orphan recovery and ownership/link-safe cleanup')
PY
