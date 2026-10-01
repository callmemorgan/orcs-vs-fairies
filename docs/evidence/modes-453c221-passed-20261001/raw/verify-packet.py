"""Read-only sealed packet inventory check; no product import or execution."""
import hashlib,json,os,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
manifest=json.loads((root/'packet-manifest.json').read_text())
artifacts=manifest['artifacts']
assert manifest['sourcePin']=='453c2218af9973b9eca8fb78392435bd9d46a740'
actual={}
def walk(directory,prefix=''):
 for path in sorted(directory.iterdir(),key=lambda item:item.name):
  name=f'{prefix}/{path.name}' if prefix else path.name
  if path.is_symlink():
   target=os.readlink(path);data=target.encode();actual[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'symlink':target}
  elif path.is_dir():walk(path,name)
  elif path.is_file():
   data=path.read_bytes();actual[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
walk(root)
for name in ['packet-manifest.json','packet-hashes.tsv']:actual.pop(name)
assert actual==artifacts
rows=(root/'packet-hashes.tsv').read_text().splitlines();assert rows[0]=='sha256\tbytes\tpath'
assert {name:(digest,int(size)) for digest,size,name in (row.split('\t') for row in rows[1:])}=={name:(record['sha256'],record['bytes']) for name,record in artifacts.items()}
print(json.dumps({'result':'passed sealed packet byte/path inventory','sourcePin':manifest['sourcePin'],'files':len(artifacts),'productExecution':False,'packetManifestSha256':hashlib.sha256((root/'packet-manifest.json').read_bytes()).hexdigest(),'packetHashesTsvSha256':hashlib.sha256((root/'packet-hashes.tsv').read_bytes()).hexdigest()}))
