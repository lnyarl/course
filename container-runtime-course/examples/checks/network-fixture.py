import socket,struct,threading,http.server,argparse
p=argparse.ArgumentParser();p.add_argument("--bind",default="10.88.0.1");a=p.parse_args()
s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.bind((a.bind,53))
def dns():
 while True:
  data,peer=s.recvfrom(4096)
  try:
   i=12
   while data[i]:i+=1+data[i]
   i+=1;qtype=struct.unpack('!H',data[i:i+2])[0];question=data[12:i+4]
   answer=b'\xc0\x0c'+struct.pack('!HHIH',1,1,30,4)+socket.inet_aton('10.88.0.1') if qtype==1 else b''
   out=data[:2]+struct.pack('!HHHHH',0x8180,1,int(bool(answer)),0,0)+question+answer
   s.sendto(out,peer)
  except (IndexError,struct.error):pass
threading.Thread(target=dns,daemon=True).start()
class HTTP(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200);self.end_headers();self.wfile.write(b'LOCAL_DNS_OK')
 def log_message(self,*args):pass
http.server.HTTPServer((a.bind,18080),HTTP).serve_forever()
