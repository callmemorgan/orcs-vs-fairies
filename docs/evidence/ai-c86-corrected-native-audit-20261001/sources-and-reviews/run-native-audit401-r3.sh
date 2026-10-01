#!/usr/bin/env bash
set -euo pipefail
AI_SOURCE_PIN=c86e273c70738f144a00fe75f5ecf39e7fa324d8
AI_RUN=six-factions-save401-ladder-c86e273-r1
AI_AUDIT_DIR=work/ai-save401-final-c86e273-r1/native-audit-r3
AI_AUDIT_SOURCE=work/final-ai-prep/audit-ladder401-r3.ts
[[ "$(git rev-parse HEAD)" == "$AI_SOURCE_PIN" ]] || exit 2
python3 - "$AI_SOURCE_PIN" "$AI_AUDIT_SOURCE" <<'AUDIT_GATE'
from pathlib import Path
import hashlib,json,sys
pin,source=sys.argv[1:]
assert hashlib.sha256(Path(source).read_bytes()).hexdigest()=='5d1b9ff25dcae322675e68078ed95a714a206b4425b9c62504f6b30d2982cb54'
p=Path('work/ai-save401-final-c86e273-r1/envelopes/ladder')
m=json.loads((p/'manifest.json').read_text());r=json.loads((p/'run.json').read_text())
assert m['sourcePin']==r['sourcePin']==pin and m['result']==r['result']=='passed' and r['exit']['code']==0
for name,v in m['artifacts'].items():
 b=(p/name).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'],name
assert (p/'source-before.json').read_bytes()==(p/'source-after.json').read_bytes()
e=Path('work/ai-save401-final-c86e273-r1/executables/ladder')
assert (e/'before.json').read_bytes()==(e/'after.json').read_bytes()
AUDIT_GATE
mkdir "$AI_AUDIT_DIR"
cp "$AI_AUDIT_SOURCE" "$AI_AUDIT_DIR/proof-source.ts"
npx --no-install esbuild "$AI_AUDIT_SOURCE" --bundle --platform=node --format=esm \
  --outfile="$AI_AUDIT_DIR/proof-executed.mjs" --metafile="$AI_AUDIT_DIR/metafile.json"
python3 - "$AI_SOURCE_PIN" "$AI_AUDIT_DIR" "$AI_AUDIT_SOURCE" <<'AUDIT_GRAPH'
from pathlib import Path
import hashlib,json,subprocess,sys
pin,directory,entry=sys.argv[1:];out=Path(directory)
records={}
for name in json.loads((out/'metafile.json').read_text())['inputs']:
 b=Path(name).read_bytes();digest=hashlib.sha256(b).hexdigest()
 if name==entry:assert digest=='5d1b9ff25dcae322675e68078ed95a714a206b4425b9c62504f6b30d2982cb54'
 else:
  assert name.startswith('src/core/') and name.endswith('.ts'),name
  assert b==subprocess.check_output(['git','show',pin+':'+name]),name
 records[name]={'bytes':len(b),'sha256':digest,'pinnedGitBlob':None if name==entry else subprocess.check_output(['git','rev-parse',pin+':'+name],text=True).strip()}
assert entry in records
assert (out/'proof-source.ts').read_bytes()==Path(entry).read_bytes()
v={'sourcePin':pin,'entry':entry,'inputs':records,'executedBundle':{'bytes':len((out/'proof-executed.mjs').read_bytes()),'sha256':hashlib.sha256((out/'proof-executed.mjs').read_bytes()).hexdigest()},'scope':'Authenticates actual metafile inputs against the frozen Git commit and held audit source after bundling and before runtime import. The canonical envelope independently rechecks full pinned inputs before and after. Does not defend against transient mutations during bundling; this owned checkout has no concurrent source writer.'}
with (out/'build-inputs.json').open('x') as f:f.write(json.dumps(v,indent=2)+'\n')
AUDIT_GRAPH
node "$AI_AUDIT_DIR/proof-executed.mjs" "$AI_SOURCE_PIN" "$AI_RUN" "$AI_AUDIT_DIR/native-audit.json"
