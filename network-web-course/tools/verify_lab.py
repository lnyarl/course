#!/usr/bin/env python3
"""Exercise actual local HTTP lab responses; no external traffic."""
import http.client
import json
import re
import subprocess
import sys
import time
from pathlib import Path

server = subprocess.Popen([sys.executable, str(Path(__file__).with_name('lab_server.py')), '--port', '0'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
checks = 0
try:
    line = server.stdout.readline()
    port = int(re.search(r':(\d+)/', line).group(1))

    def request(method, target, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
        conn.request(method, target, body=body, headers=headers or {})
        resp = conn.getresponse()
        result = resp.status, dict(resp.getheaders()), resp.read()
        conn.close()
        return result

    def check(condition):
        global checks
        assert condition
        checks += 1

    s,h,b=request('GET','/inspect');check(s==200);check(json.loads(b)['method']=='GET')
    s,h,b=request('POST','/inspect',body='{"hello":1}',headers={'Content-Type':'application/json'});check(json.loads(b)['body']=='{"hello":1}');check(json.loads(b)['method']=='POST')
    s,h,b=request('GET','/cache');check(s==200 and h['ETag']=='"v1"');check(int(h['Content-Length'])==len(b))
    s,h,b=request('GET','/cache',headers={'If-None-Match':'"v1"'});check(s==304 and not b and 'Content-Length' not in h)
    s,h,b=request('HEAD','/cache');check(s==200 and not b and int(h['Content-Length'])>0)
    s,h,b=request('GET','/redirect');check(s==302 and h['Location']=='/inspect')
    origin=f'http://localhost:{port}'
    s,h,b=request('OPTIONS','/cors?mode=allow',headers={'Origin':origin,'Access-Control-Request-Headers':'X-Demo'});check(s==204 and not b);check('Content-Length' not in h);check(h['Access-Control-Allow-Origin']==origin)
    s,h,b=request('GET','/cors?mode=deny',headers={'Origin':origin});check(s==200 and 'Access-Control-Allow-Origin' not in h)
    s,h,b=request('POST','/cors?mode=allow',body='{}',headers={'Origin':origin,'Content-Type':'application/json'});check(s==200 and json.loads(b)['body']=='{}' and h['Access-Control-Allow-Origin']==origin)
    s,h,b=request('OPTIONS','/cors?mode=allow',headers={'Origin':'https://other.example'});check('Access-Control-Allow-Origin' not in h)
    # Regression: unsupported POST must not leave its body in a reusable connection.
    s,h,b=request('POST','/delay?ms=0',body='abc');check(s==405 and h['Connection']=='close' and h['Allow']=='GET, HEAD, OPTIONS')
    s,h,b=request('GET','/inspect');check(s==200)
    start=time.monotonic();s,h,b=request('GET','/delay?ms=80');check(s==200 and time.monotonic()-start>=.07)
    s,h,b=request('GET','/delay?ms=oops');check(s==400)
    s,h,b=request('GET','/status?code=503');check(s==503 and json.loads(b)['synthetic'])
    url=f'http://127.0.0.1:{port}'
    r=subprocess.run(['curl','-sS','--max-time','0.05',url+'/delay?ms=300'],capture_output=True);check(r.returncode==28)
    s,h,b=request('GET','/');check(b'fetch(' in b and b'X-Demo' in b)
    print(json.dumps({'local_http_checks':checks,'result':'PASS','browser_cors':'not tested; HTTP headers verified'}))
finally:
    server.terminate()
    server.wait(timeout=3)
