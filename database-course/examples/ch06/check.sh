#!/usr/bin/env bash
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
rustc --edition=2024 --test "$HERE/executor.rs" -o "$D/tests"
"$D/tests" --quiet
rustc --edition=2024 "$HERE/executor.rs" -o "$D/executor"
python3 - "$D/executor" "$D" <<'PY'
import hashlib,json,pathlib,subprocess,sys
binary=pathlib.Path(sys.argv[1]); scratch=pathlib.Path(sys.argv[2]); database=scratch/'db'
def sql(text,ok=True,directory=database):
    result=subprocess.run([str(binary),str(directory)],input=text,text=True,capture_output=True)
    if ok:
        assert result.returncode==0,result.stderr
        return json.loads(result.stdout)
    assert result.returncode==2,(text,result.returncode,result.stdout,result.stderr)
    assert not result.stdout,('partial output',result.stdout)
    return result.stderr

def values(result):
    def value(d):
        return None if d['type']=='null' else int(d['value']) if d['type']=='int' else d['value']
    return [[value(d) for d in row] for row in result['rows']]

def snapshot():
    return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in database.iterdir() if p.is_file()}

# Neither syntax errors nor invalid CREATE policy create a database directory.
absent=scratch/'must-not-exist'
sql('SELECT * FROM people; DROP TABLE people;',False,absent)
assert not absent.exists()
sql('CREATE TABLE broken(id INT)',False,absent)
assert not absent.exists()
assert sql('CREATE TABLE people(id INT NOT NULL,name TEXT,age INT,dept INT)')['type']=='create'
for statement in [
    "INSERT INTO people VALUES(1,'Roy',35,10)",
    "INSERT INTO people VALUES(2,'Ana',20,20)",
    "INSERT INTO people VALUES(3,'Bo',NULL,10)",
    "INSERT INTO people VALUES(4,'Dana',28,NULL)",
    "INSERT INTO people VALUES(5,'Eli',40,30)",
]:
    assert sql(statement)['type']=='insert'
# Every sql() call starts a new process, so each query checks persisted reopen behavior.
result=sql('SELECT name,age FROM people WHERE age>=25 OR age IS NULL ORDER BY age DESC LIMIT 3')
assert result['columns']==['name','age']
assert values(result)==[['Bo',None],['Eli',40],['Roy',35]],result
assert result['stats']==dict(scan_rows=5,filter_checks=5,sort_rows=4,output_rows=3,join_checks=0,hash_build=0,hash_probe=0),result
result=sql('SELECT name FROM people ORDER BY age ASC')
assert values(result)==[['Ana'],['Dana'],['Roy'],['Eli'],['Bo']]
assert sql('SELECT * FROM people ORDER BY age DESC LIMIT 0')['stats']==dict(scan_rows=0,filter_checks=0,sort_rows=0,output_rows=0,join_checks=0,hash_build=0,hash_probe=0)
result=sql('SELECT id FROM people LIMIT 2')
assert values(result)==[[1],[2]] and result['stats']['scan_rows']==2
result=sql('SELECT id FROM people WHERE age=NULL')
assert result['rows']==[] and result['stats']['filter_checks']==5
sql('CREATE TABLE empty(id INT NOT NULL,age INT)')
before=snapshot()
for statement in [
    'SELECT missing FROM empty LIMIT 0',
    'SELECT id FROM empty WHERE age=\'wrong type\' LIMIT 0',
    'SELECT id FROM empty ORDER BY missing LIMIT 0',
    'SELECT * FROM absent LIMIT 0',
    "INSERT INTO people(id,missing) VALUES(6,'x')",
    'INSERT INTO people(id,id) VALUES(6,7)',
    "INSERT INTO people(name) VALUES('x')",
    "INSERT INTO people VALUES(6,'x','bad',NULL)",
    "INSERT INTO people VALUES(1,'duplicate',NULL,NULL)",
]:
    sql(statement,False)
assert snapshot()==before,'binding/constraint failure modified database files'
sql("INSERT INTO people(name,id) VALUES('Fox',6)")
assert values(sql('SELECT name,age,dept FROM people WHERE id=6'))==[['Fox',None,None]]
# Preserve i64 without floating-point JSON conversion and round-trip UTF-8 text.
sql("INSERT INTO people VALUES(9223372036854775807,'한글',NULL,NULL)")
result=sql('SELECT id,name FROM people WHERE id=9223372036854775807')
assert result['rows'][0][0]=={'type':'int','value':'9223372036854775807'}
assert values(result)==[[9223372036854775807,'한글']]
join_results={}
for strategy in ['nested','hash']:
    process=subprocess.run([str(binary),'--join-demo',strategy],text=True,capture_output=True)
    assert process.returncode==0,process.stderr
    result=json.loads(process.stdout);join_results[strategy]=result
    assert result['columns']==['id','name','age','dept','dept_key','label']
    assert [(row[1],row[5]) for row in values(result)]==[('Roy','Eng'),('Roy','Field'),('Ana','Ops'),('Bo','Eng'),('Bo','Field')]
    assert result['stats']['scan_rows']==result['stats']['filter_checks']==result['stats']['sort_rows']==0
    assert result['stats']['output_rows']==5
assert join_results['nested']['rows']==join_results['hash']['rows']
assert join_results['nested']['stats']['join_checks']==25
assert join_results['hash']['stats']['join_checks']==0
assert join_results['hash']['stats']['hash_build']==join_results['hash']['stats']['hash_probe']==4
assert 'expected end' in sql('SELECT * FROM people JOIN depts ON dept=dept_key',False)
print('PASS: SQL create/insert/reopen, binding before row access, no writes on rejected statements, pull LIMIT, NULL semantics/order, exact JSON/stats, both join demos')
PY
