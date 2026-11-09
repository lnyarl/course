"""Final lab: real psql -> COMMIT/ROLLBACK -> kill/restart -> Seq/Index parity.
Usage: python3 capstone.py /path/to/server [--psql /path/to/psql]
Requires an already installed psql client. All database files are temporary.
"""
import argparse, json, pathlib, subprocess, tempfile

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('server',type=pathlib.Path)
parser.add_argument('--psql',default='psql')
args=parser.parse_args()
binary=str(args.server.resolve())
with tempfile.TemporaryDirectory(prefix='mydb-capstone-') as tmp:
    home=pathlib.Path(tmp)/'database'
    server=None
    def start():
        global server
        server=subprocess.Popen([binary,'serve',str(home),'127.0.0.1:0'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        line=server.stdout.readline().strip()
        if not line.startswith('LISTEN '):raise RuntimeError('server did not start: '+server.stderr.read())
        return line[7:].rsplit(':',1)[1]
    def stop():
        if server is not None and server.poll() is None:
            server.kill();server.wait(timeout=10)
    def psql(port,sql):
        command=[args.psql,'-X','-A','-t','-v','ON_ERROR_STOP=1','-P','null=(NULL)',f'host=127.0.0.1 port={port} user=mydb dbname=mydb sslmode=disable connect_timeout=5']
        # stdin lets psql send each statement as a separate simple Query.
        reply=subprocess.run(command,input=sql,text=True,capture_output=True,timeout=30)
        if reply.returncode:raise RuntimeError(reply.stderr)
        return reply.stdout.strip()
    try:
        port=start()
        psql(port,'CREATE TABLE people (id INT NOT NULL, name TEXT);\n')
        print(psql(port,"BEGIN;\nINSERT INTO people VALUES (1, 'Roy');\nINSERT INTO people VALUES (2, NULL);\nCOMMIT;\nBEGIN;\nINSERT INTO people VALUES (3, 'rollback');\nROLLBACK;\n"))
        # COMMIT response has arrived; force process termination, then reopen same DB.
        stop();port=start()
        result=psql(port,'SELECT * FROM people ORDER BY id;\n')
        assert result=='1|Roy\n2|(NULL)',repr(result)
        print(result)
        print(psql(port,'EXPLAIN ANALYZE SELECT * FROM people WHERE id = 1;\n'))
        stop()  # CLI uses the same process-exclusive DB lock.
        results={}
        for mode in ['--seq','--index']:
            reply=subprocess.run([binary,'sql',str(home),mode],input='SELECT * FROM people WHERE id = 1',text=True,capture_output=True,timeout=15,check=True)
            results[mode]=json.loads(reply.stdout)
        assert results['--seq']['columns']==results['--index']['columns']
        assert results['--seq']['rows']==results['--index']['rows']
        assert results['--seq']['stats']['scan_rows']==2
        assert results['--index']['stats']['scan_rows']==1
        print('PASS: psql COMMIT/ROLLBACK, forced-stop recovery, Seq/Index equal rows (logical scan_rows 2 vs 1)')
    finally:
        stop()
