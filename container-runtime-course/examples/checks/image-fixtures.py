#!/usr/bin/env python3
"""실제로 pull한 Alpine 레이어를 재사용하는 config 전용 OCI fixture 두 개."""
import hashlib,json,pathlib,platform
store=pathlib.Path('/var/lib/myctr')
def blob(data):
 digest=hashlib.sha256(data).hexdigest(); (store/'blobs/sha256'/digest).write_bytes(data)
 return 'sha256:'+digest
base_digest=(store/'refs/library/alpine/3.24').read_text().strip().split(':')[1]
base=json.loads((store/'blobs/sha256'/base_digest).read_bytes())
for name,config in [
 ('course/entrypoint',{'Env':['PATH=/bin'],'Entrypoint':['/bin/echo','ENTRY'],'Cmd':['default'],'WorkingDir':'/'}),
 ('course/environment',{'Env':['PATH=/bin','COURSE_ENV=fixture'],'Cmd':['/bin/sh'],'WorkingDir':'/tmp'}),
]:
 raw=json.dumps({'architecture':{'aarch64':'arm64','x86_64':'amd64'}.get(platform.machine(),platform.machine()),'os':'linux','config':config},separators=(',',':')).encode()
 digest=blob(raw); manifest=dict(base)
 manifest['config']={'mediaType':'application/vnd.oci.image.config.v1+json','digest':digest,'size':len(raw)}
 digest=blob(json.dumps(manifest,separators=(',',':')).encode())
 path=store/'refs'/name/'fixture'; path.parent.mkdir(parents=True,exist_ok=True);path.write_text(digest)
print('config fixtures ready')
