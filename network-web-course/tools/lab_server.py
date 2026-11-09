#!/usr/bin/env python3
"""Network learning lab. Python standard library only; local HTTP/1.1, no TLS."""
import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

CLIENT = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>로컬 CORS 실험</title><style>body{font:17px/1.7 sans-serif;max-width:800px;margin:40px auto;padding:20px}button{padding:12px;margin:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef3f2;padding:20px}</style><h1>실제 브라우저 CORS 실험</h1><p>http://127.0.0.1:8765/ 로 접속하세요. 버튼은 호스트 이름이 다른 http://localhost:8765 로 요청합니다. 서버는 같아도 origin은 다릅니다. 포트를 바꿔 실행했다면 아래 요청은 현재 포트를 사용합니다.</p><button data-mode="deny">CORS 허용 없음</button><button data-mode="allow">CORS 허용</button><label><input id="custom" type="checkbox"> X-Demo 헤더로 preflight 발생</label><pre id="out" aria-live="polite">Network와 Console 탭도 함께 확인하세요.</pre><script>document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const host=location.hostname==='localhost'?'127.0.0.1':'localhost';const url=`http://${host}:${location.port}/cors?mode=${b.dataset.mode}`;document.getElementById('out').textContent='요청 중: '+url;try{const r=await fetch(url,{headers:document.getElementById('custom').checked?{'X-Demo':'hello'}:{}});document.getElementById('out').textContent='JS 읽기 성공: '+r.status+'\\n'+await r.text()}catch(e){document.getElementById('out').textContent='JS 읽기 실패: '+e.message+'\\nNetwork에서 OPTIONS와 실제 요청 유무를 구분하세요.'}})</script></html>'''

class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def send(self, status, data=b'', headers=None):
        self.send_response(status)
        base = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}
        base.update(headers or {})
        for key, value in base.items():
            self.send_header(key, value)
        if status not in (204, 304):
            self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD' and status not in (204, 304):
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass  # Expected when the learner tests a client timeout.

    def options_headers(self, query):
        origin = self.headers.get('Origin', '')
        port = self.server.server_port
        allowed = {f'http://localhost:{port}', f'http://127.0.0.1:{port}'}
        if query.get('mode', ['deny'])[0] == 'allow' and origin in allowed:
            return {'Access-Control-Allow-Origin': origin,
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Demo, Content-Type',
                    'Vary': 'Origin'}
        return {}

    def do_OPTIONS(self):
        u = urlsplit(self.path)
        self.send(204, headers=self.options_headers(parse_qs(u.query)))

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        u = urlsplit(self.path)
        q = parse_qs(u.query)
        headers = {}
        if u.path == '/':
            self.send(200, CLIENT.encode(), {'Content-Type': 'text/html; charset=utf-8'})
            return
        if u.path == '/redirect':
            self.send(302, b'{"redirect":"/inspect"}', {'Location': '/inspect'})
            return
        if u.path == '/cache':
            headers = {'ETag': '"v1"', 'Cache-Control': 'public, max-age=60'}
            if self.headers.get('If-None-Match') in ('"v1"', 'W/"v1"', '*'):
                self.send(304, headers=headers)
            else:
                self.send(200, b'{"version":"v1","message":"stored representation"}', headers)
            return
        if u.path == '/delay':
            try:
                delay = max(0, min(5000, int(q.get('ms', ['800'])[0])))
            except ValueError:
                self.send(400, b'{"error":"ms must be an integer"}')
                return
            time.sleep(delay / 1000)
            self.send(200, json.dumps({'delay_ms': delay}).encode())
            return
        if u.path == '/status':
            try:
                status = int(q.get('code', ['503'])[0])
            except ValueError:
                status = 400
            if status not in (200, 400, 401, 403, 404, 429, 500, 502, 503, 504):
                status = 400
            self.send(status, json.dumps({'status': status, 'synthetic': True}).encode())
            return
        if u.path == '/cors':
            headers = self.options_headers(q)
        elif u.path != '/inspect':
            self.send(404, b'{"error":"use /inspect /cache /delay /redirect /status /cors"}')
            return
        self.inspect(headers)

    def do_POST(self):
        if urlsplit(self.path).path not in ('/inspect', '/cors'):
            self.close_connection = True
            self.send(405, b'{"error":"use GET or HEAD for this endpoint"}',
                      {'Allow': 'GET, HEAD, OPTIONS', 'Connection': 'close'})
            return
        self.do_GET()

    def do_PUT(self):
        self.do_POST()

    def inspect(self, headers):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send(400, b'{"error":"invalid content length"}')
            return
        if length < 0 or length > 65536:
            self.close_connection = True
            self.send(413, b'{"error":"body limit 64KiB"}')
            return
        body = self.rfile.read(length).decode('utf-8', 'replace') if length else ''
        data = {'method': self.command, 'path': self.path,
                'headers': dict(self.headers), 'body': body,
                'note': 'Local educational server. No authentication or persistence.'}
        self.send(200, json.dumps(data, ensure_ascii=False, indent=2).encode(), headers)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    httpd = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Lab: http://127.0.0.1:{httpd.server_port}/ (Ctrl+C to stop)', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
