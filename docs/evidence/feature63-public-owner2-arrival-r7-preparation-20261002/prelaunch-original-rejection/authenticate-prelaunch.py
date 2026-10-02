from pathlib import Path
import ast,hashlib,json,os,stat,subprocess,sys
OUT=Path(sys.argv[1]);PHASE=sys.argv[2]
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies');OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
def desc(p):return {'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def auth(base,rows,complete=False):
 for r in rows:
  p=base/r['path'];m=int(r['mode'],8) if isinstance(r['mode'],str) else r['mode'];assert p.is_file() and not p.is_symlink() and p.stat().st_size==r['bytes'] and stat.S_IMODE(p.stat().st_mode)==m and desc(p)['sha256']==r['sha256'],p
 if complete:assert {r['path'] for r in rows}=={str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()}
a=json.loads((OUT/'capture-assignment.json').read_text());r=json.loads((OUT/'root-binding-readback.json').read_text())
for v in r['completeOutputRecords']:
 p=OUT/v['path'];assert desc(p)=={'path':str(p),'bytes':v['bytes'],'sha256':v['sha256']} and stat.S_IMODE(p.stat().st_mode)==v['mode']
assert {v['path'] for v in r['completeOutputRecords']}|{'root-binding-readback.json'}=={p.name for p in OUT.iterdir()}
s=json.loads(Path(a['sourceBinding']['path']).read_text());build=json.loads(Path(a['buildBinding']['path']).read_text());b=json.loads(Path(a['browserBinding']['path']).read_text())
for base in (ROOT,OWNED):auth(base,s['records']);auth(base,json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json').read_text()))
auth(ROOT/'dist',json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json').read_text())['dist'],True)
for base,rows in [(Path(build['webDistPath']),build['webRecords']),(Path(build['serverBuildPath']),build['serverRecords']),(Path(b['dependencyRoot']),b['dependencyRecords']),(Path(b['chromiumDependencyRoot']),b['chromiumDependencyRecords'])]:auth(base,rows,True)
for k in ['sourceBinding','buildBinding','testedBuildReceipt','reviewReceipt','browserBinding','publicProducer','collector','auditor','nodeExecutable','pythonExecutable']:assert desc(Path(a[k]['path']))==a[k]
assert [len(s['records']),len(build['webRecords']),len(build['serverRecords']),len(b['dependencyRecords']),len(b['chromiumDependencyRecords'])]==[966,398,22,114,303]
for base in (ROOT,OWNED):assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=base,text=True).strip()==a['sourcePin'] and not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=base,text=True)
control=Path(r['freshControl']);assert not list(control.iterdir()) and stat.S_IMODE(control.stat().st_mode)==0o700
origin=Path('/tmp/ovf-feature63-static-prep-r3-zsttudqb/independent-launcher/launch-capture.r3.template.py').read_text();expected=origin.replace('feature63-human-wave-composition-r3','feature63-human-wave-composition-'+PHASE).replace("SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r3-')",f"SLOT_TOKEN.startswith('heavy-runtime-1-feature63-{PHASE}-')")
for old,new in r['launcherChanges'].items():assert expected.count(old)==1;expected=expected.replace(old,new)
launcher=Path(r['launcher']['path']);assert expected==launcher.read_text();ast.parse(expected)
protected=a['protectedProcess'];p=Path('/proc/1063');f=(p/'stat').read_text();f=f[f.rfind(')')+2:].split();assert int(f[19])==874 and int(f[3])==1063 and os.readlink(p/'cwd')==protected['cwd'] and os.readlink(p/'exe')==protected['executable'] and [x.decode() for x in (p/'cmdline').read_bytes().split(b'\0') if x]==protected['argv'] and os.readlink(p/'fd/22')=='socket:[3783]'
meta=lambda p:{'path':str(p),'device':p.stat().st_dev,'inode':p.stat().st_ino,'bytes':p.stat().st_size,'mode':stat.S_IMODE(p.stat().st_mode),'links':p.stat().st_nlink}
v={'sourcePin':a['sourcePin'],'assignment':desc(OUT/'capture-assignment.json'),'launcher':desc(launcher),'currentSourceBothRootsAndWholeProductBuildDependencySetsAuthenticated':True,'launcherOnlyReviewedLiteralAndAnchorChanges':True,'freshControlEmpty700':True,'counts':[966,570,397,398,22,114,303],'existingRawCustody':{str(p):meta(p) for p in Path('/home/morgana/Projects/orcs-vs-Fairies-evidence').rglob('*.sqlite')},'runtimeNotExecutedYet':True,'unobservedDescendantsExcluded':False}
(OUT/'root-independent-prelaunch-readback.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps({k:v[k] for k in ['sourcePin','assignment','launcher','counts']}))
