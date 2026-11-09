#!/usr/bin/env bash
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
rustc --edition=2024 --test "$HERE/transactions.rs" -o "$D/tests"
"$D/tests" --quiet
rustc --edition=2024 "$HERE/transactions.rs" -o "$D/transactions"
python3 - "$D/transactions" "$D" <<'PY'
import json,pathlib,subprocess,sys
binary=pathlib.Path(sys.argv[1]);root=pathlib.Path(sys.argv[2]);database=root/'db'
def session(lines):
    process=subprocess.run([str(binary),str(database)],input='\n'.join(lines)+'\n',text=True,capture_output=True)
    assert process.returncode==0,process.stderr
    return [json.loads(line) for line in process.stdout.splitlines()]
def values(reply):
    return [[None if v['type']=='null' else int(v['value']) if v['type']=='int' else v['value'] for v in row] for row in reply['rows']]
setup=session(['CREATE TABLE people(id INT NOT NULL,name TEXT)',"INSERT INTO people VALUES(1,'Roy')"])
assert len(setup)==2 and not any('error' in reply for reply in setup)
replies=session(['begin;',"INSERT INTO people VALUES(2,'Ana')",'SELECT name FROM people WHERE id=2','rollback;','SELECT * FROM people WHERE id=2'])
assert replies[0]['status']=='T' and values(replies[2])==[['Ana']]
assert replies[3]['status']=='I' and values(replies[4])==[]
# An SQL failure leaves E and earlier writes cannot commit.
replies=session(['BEGIN',"INSERT INTO people VALUES(2,'Ana')",'SELECT missing FROM people','SELECT * FROM people','COMMIT','ROLLBACK','SELECT * FROM people WHERE id=2'])
assert all(replies[i]['status']=='E' and 'error' in replies[i] for i in (2,3,4))
assert replies[5]['status']=='I' and values(replies[6])==[]
# Duplicate BEGIN is an explicit control error, and recovery requires rollback.
replies=session(['BEGIN','BEGIN','COMMIT','ROLLBACK'])
assert replies[1]['status']=='E' and replies[2]['status']=='E' and replies[3]['status']=='I'
# EOF discards a still-active transaction and its private files.
session(['BEGIN',"INSERT INTO people VALUES(3,'EOF rollback')"])
assert values(session(['SELECT * FROM people WHERE id=3'])[0])==[]
replies=session(['BEGIN',"INSERT INTO people VALUES(2,'Ana')",'COMMIT'])
assert replies[-1]['tag']=='COMMIT' and replies[-1]['status']=='I'
assert values(session(['SELECT id FROM people ORDER BY id'])[0])==[[1],[2]]
# Commit acknowledgment precedes the forced process stop; reopen preserves it.
process=subprocess.Popen([str(binary),str(database)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
for line in ['BEGIN',"INSERT INTO people VALUES(4,'committed before kill')",'COMMIT']:
    process.stdin.write(line+'\n');process.stdin.flush()
    reply=json.loads(process.stdout.readline());assert 'error' not in reply,reply
assert reply['tag']=='COMMIT'
process.kill();process.wait(timeout=10)
assert values(session(['SELECT name FROM people WHERE id=4'])[0])==[['committed before kill']]
print('PASS: SQL session states, own writes, SQL/control errors, rollback and EOF cleanup, durable commit acknowledgment and forced-stop reopen')
PY
