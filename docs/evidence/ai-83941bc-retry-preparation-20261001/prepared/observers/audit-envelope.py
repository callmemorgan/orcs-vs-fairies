#!/usr/bin/env python3
import hashlib,json,pathlib,sys
phase=sys.argv[1];base=pathlib.Path('work/ai-save401-final-83941bc-r1');root=base/'envelopes'/phase
sha=lambda b:hashlib.sha256(b).hexdigest()
def check(ok,label):
 if not ok:raise RuntimeError(label)
def inventory(p):
 return {str(f.relative_to(p)):{'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())} for f in sorted(p.rglob('*')) if f.is_file()}
manifest=json.loads((root/'manifest.json').read_text());run=json.loads((root/'run.json').read_text())
check(manifest['result']=='passed' and run['result']=='passed' and run['exit']['code']==0,'phase result')
check(run['sourcePin']==manifest['sourcePin']=='83941bc80ce9ec08840b0645d9b33e8018d5309a','phase pin')
for rel,item in manifest['artifacts'].items():
 data=(root/rel).read_bytes();check(len(data)==item['bytes'] and sha(data)==item['sha256'],'envelope artifact '+rel)
check(set(manifest['artifacts'])==set(inventory(root))-{'manifest.json'},'envelope inventory')
source_before=(root/'source-before.json').read_bytes();source_after=(root/'source-after.json').read_bytes();check(source_before==source_after,'source changed')
check(source_before==(base/'envelopes/build-web/source-before.json').read_bytes(),'phase source differs from fresh web build')
check((root/'build-before.json').read_bytes()==(root/'build-after.json').read_bytes(),'compiled/served/build bindings changed')
artifacts=json.loads((root/'artifacts.json').read_text())
for directory,expected in artifacts.items():check(inventory(pathlib.Path(directory))==expected,'output inventory '+directory)
exe=base/'executables'/phase
if exe.exists():check((exe/'before.json').read_bytes()==(exe/'after.json').read_bytes(),'executable/package bytes changed')
record={'phase':phase,'result':'passed','sourcePin':run['sourcePin'],'command':run['command'],'envelopeManifestSha256':sha((root/'manifest.json').read_bytes()),'runSha256':sha((root/'run.json').read_bytes()),'sourceBeforeAfterEqual':True,'sameSourceAsFreshWebBuild':True,'sourceSha256':sha(source_before),'artifactDirectories':{directory:len(files) for directory,files in artifacts.items()},'recordedExecutablePackagesEqual':exe.exists(),'scope':'Direct artifact byte/inventory authentication. Gameplay claims require actual phase reports/native artifacts.'}
out=base/'audits';out.mkdir(exist_ok=True);(out/(phase+'-envelope.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
