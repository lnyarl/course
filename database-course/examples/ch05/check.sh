#!/usr/bin/env bash
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
rustc --edition=2024 --test "$HERE/sql.rs" -o "$D/tests"
"$D/tests"
rustc --edition=2024 "$HERE/sql.rs" -o "$D/sql"
python3 - "$D/sql" <<'PY'
import json, subprocess, sys
binary=sys.argv[1]
def run(sql,*args):
    return subprocess.run([binary,*args],input=sql,text=True,capture_output=True)
r=run("SELECT name FROM people WHERE age>=20 OR id=1 AND name IS NOT NULL;")
assert r.returncode==0,r.stderr
ast=json.loads(r.stdout)
assert ast['filter']['type']=='or'
assert ast['filter']['right']['type']=='and'
r=run("INSERT INTO people VALUES (-9223372036854775808,'O''Reilly 한글',NULL);")
assert r.returncode==0,r.stderr
values=json.loads(r.stdout)['values']
assert values[0]['value']=='-9223372036854775808'
assert values[1]['value']=="O'Reilly 한글"
sql="INSERT INTO t VALUES ('한글');"
r=run(sql,'--tokens');assert r.returncode==0
text=next(t for t in json.loads(r.stdout) if t['kind']=='text')
assert sql.encode()[text['start']:text['end']]=="'한글'".encode()
for sql in ["SELECT * FROM t; DROP TABLE t;","SELECT * FROM t WHERE a=;","INSERT INTO t VALUES ('oops)","SELECT * FROM t LIMIT -1",'한'*6000]:
    r=run(sql);assert r.returncode==2,(sql,r)
    assert not r.stdout and 'ERROR byte=' in r.stderr,r
# Unknown catalog names are syntactically legal. Parsing does not execute SQL.
assert run("SELECT unknown FROM absent").returncode==0
print('PASS: CLI JSON, precedence, quoted UTF-8, exact token bytes, EOF rejection, bounded input, syntax/semantic boundary')
PY
