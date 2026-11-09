"""Dependency-free PostgreSQL simple-query integration checks against the real server."""
import os, socket, struct, subprocess, sys, tempfile
BIN=sys.argv[1]
def exact(s,n):
    b=b''
    while len(b)<n:
        p=s.recv(n-len(b))
        if not p: raise EOFError('socket closed')
        b+=p
    return b
def receive(s):
    k=exact(s,1); n=struct.unpack('!I',exact(s,4))[0]
    assert 4<=n<=9*1024*1024
    return k,exact(s,n-4)
def connect(addr):
    s=socket.create_connection(addr,timeout=5)
    s.sendall(struct.pack('!II',8,80877103)); assert exact(s,1)==b'N'
    p=struct.pack('!I',196608)+b'user\0mydb\0database\0mydb\0client_encoding\0UTF8\0\0'
    s.sendall(struct.pack('!I',len(p)+4)+p)
    while receive(s)!=(b'Z',b'I'):pass
    return s
def query(s,sql):
    p=sql.encode()+b'\0';s.sendall(b'Q'+struct.pack('!I',len(p)+4)+p);msgs=[]
    while True:
        k,p=receive(s);msgs.append((k,p))
        if k==b'Z': return msgs
def rows(msgs):
    out=[]
    for k,p in msgs:
        if k!=b'D':continue
        n=struct.unpack('!H',p[:2])[0];offset=2;row=[]
        for _ in range(n):
            size=struct.unpack('!i',p[offset:offset+4])[0];offset+=4
            row.append(None if size==-1 else p[offset:offset+size].decode());offset+=max(size,0)
        out.append(row)
    return out
def ok(s,sql,state=b'I'):
    msgs=query(s,sql);assert not any(k==b'E' for k,p in msgs),(sql,msgs)
    assert msgs[-1]==(b'Z',state),msgs
    return msgs
def fail(s,sql,state=b'E'):
    msgs=query(s,sql);assert any(k==b'E' for k,p in msgs),(sql,msgs)
    assert msgs[-1]==(b'Z',state),msgs
    return msgs
with tempfile.TemporaryDirectory(prefix='mydb-wire-') as home:
    def start():
        p=subprocess.Popen([BIN,'serve',home,'127.0.0.1:0'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        line=p.stdout.readline().strip();assert line.startswith('LISTEN '),line
        host,port=line[7:].rsplit(':',1);return p,(host,int(port))
    p,addr=start()
    try:
        a,b=connect(addr),connect(addr)
        # TCP delivers arbitrary chunks: both Query header and body are fragmented.
        fragmented=connect(addr)
        statement=b'SELECT * FROM absent\0'
        for byte in b'Q'+struct.pack('!I',len(statement)+4)+statement:
            fragmented.sendall(bytes([byte]))
        seen=[]
        while True:
            message=receive(fragmented);seen.append(message)
            if message[0]==b'Z':break
        assert any(k==b'E' for k,v in seen) and seen[-1]==(b'Z',b'I')
        fragmented.close()
        ok(a,'CREATE TABLE t (id INT NOT NULL, name TEXT)')
        ok(a,"INSERT INTO t VALUES (1, '한글')")
        ok(a,"INSERT INTO t VALUES (2, '')")
        ok(a,'INSERT INTO t VALUES (3, NULL)')
        assert rows(ok(a,'SELECT * FROM t ORDER BY id'))==[['1','한글'],['2',''],['3',None]]
        assert any(k==b'T' for k,v in ok(a,'SELECT * FROM t LIMIT 0'))
        ok(a,'BEGIN',b'T');ok(b,'BEGIN',b'T')
        ok(a,"INSERT INTO t VALUES (4, 'a')",b'T');ok(a,'COMMIT')
        assert rows(ok(b,'SELECT * FROM t WHERE id = 4',b'T'))==[]
        ok(b,"INSERT INTO t VALUES (5, 'b')",b'T');fail(b,'COMMIT');fail(b,'SELECT * FROM t');ok(b,'ROLLBACK')
        assert rows(ok(a,'SELECT * FROM t WHERE id = 5'))==[]
        ok(a,'BEGIN',b'T');fail(a,'SELECT missing FROM t');fail(a,'COMMIT');ok(a,'ROLLBACK')
        ok(a,'BEGIN',b'T');fail(a,'BEGIN');ok(a,'ROLLBACK')
        fail(a,"INSERT INTO t VALUES (6, 'bad'); INSERT INTO t VALUES (7, 'bad')",b'I')
        assert rows(ok(a,'SELECT * FROM t WHERE id = 6'))==[]
        fail(a,'SELECT 이름 FROM t',b'I')
        assert any('PrimaryKeyLookup' in r[0] for r in rows(ok(a,'EXPLAIN ANALYZE SELECT * FROM t WHERE id = 1')))
        ok(a,'BEGIN',b'T');ok(a,"INSERT INTO t VALUES (8, 'disconnect')",b'T');a.close()
        # Server cleanup is asynchronous; no future write depends on it.
        assert rows(ok(b,'SELECT * FROM t WHERE id = 8'))==[]
        bad=connect(addr);bad.sendall(b'Q'+struct.pack('!I',MAX:=65537));assert bad.recv(1)==b'';bad.close()
        bad=connect(addr);bad.sendall(b'P'+struct.pack('!I',4));assert receive(bad)[0]==b'E';assert bad.recv(1)==b'';bad.close()
        b.close();p.kill();p.wait()
        p,addr=start();a=connect(addr)
        assert rows(ok(a,'SELECT id FROM t ORDER BY id'))==[['1'],['2'],['3'],['4']]
        a.close()
        print('wire PASS: UTF8 / NULL / metadata / I-T-E / conflict / no partial batch / EXPLAIN / disconnect / malformed / restart')
    finally:
        p.kill();p.wait()
