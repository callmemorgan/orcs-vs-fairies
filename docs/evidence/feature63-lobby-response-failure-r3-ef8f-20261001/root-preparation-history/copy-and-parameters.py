from pathlib import Path
import datetime, hashlib, json, os, shutil, stat, subprocess, tempfile
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
OUT=Path(tempfile.mkdtemp(prefix='ovf-root-feature63-r3-package-bind-',dir='/tmp'))
print(json.dumps({'rootOutput':str(OUT)}),flush=True)
PRIOR=Path('/tmp/ovf-root-feature63-fresh-r2-package-w5gp__sx/root-fresh-package-result.json')
R2=OWNED/'work/feature63-human-wave-composition-r2'
R3=OWNED/'work/feature63-human-wave-composition-r3'
OLD=Path('/tmp/ovf-root-feature63-r2-bindings-3jv6a1en')
def sha(b):return hashlib.sha256(b).hexdigest()
def desc(p):return {'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
def meta(p):
 s=p.stat();return {'path':str(p),'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size,'mode':stat.S_IMODE(s.st_mode),'links':s.st_nlink}
def inv(base):
 rows=[]
 for p in sorted(base.rglob('*')):
  assert not p.is_symlink()
  if p.is_dir():continue
  rows.append({'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes()),'mode':stat.S_IMODE(p.stat().st_mode)})
 return sorted(rows,key=lambda r:r['path'])
def put(n,v):
 p=OUT/n
 with p.open('x') as f:json.dump(v,f,indent=2);f.write('\n')
 return desc(p)
def normalize(rows):return [{**r,'mode':int(r['mode'],8) if isinstance(r['mode'],str) else r['mode']} for r in rows]
def auth(base,rows,complete=False):
 rows=normalize(rows)
 for r in rows:
  p=base/r['path'];assert not p.is_symlink() and p.is_file() and p.stat().st_size==r['bytes'] and stat.S_IMODE(p.stat().st_mode)==r['mode'] and sha(p.read_bytes())==r['sha256'],p
 if complete:assert inv(base)==sorted(rows,key=lambda r:r['path'])
def proc(pid):
 p=Path('/proc')/str(pid);s=(p/'stat').read_text();f=s[s.rfind(')')+2:].split()
 return {'pid':pid,'startTicks':int(f[19]),'session':int(f[3]),'executable':os.readlink(p/'exe'),'cwd':os.readlink(p/'cwd'),'argv':[x.decode() for x in (p/'cmdline').read_bytes().split(b'\0') if x]}
def ports():
 result={str(x):[] for x in (4173,5373,5374)}
 for name in ('tcp','tcp6'):
  for line in (Path('/proc/net')/name).read_text().splitlines()[1:]:
   f=line.split();port=str(int(f[1].rsplit(':',1)[1],16))
   if f[3]=='0A' and port in result:result[port].append('socket:['+f[9]+']')
 return result
pin=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
assert pin==subprocess.check_output(['git','rev-parse','HEAD'],cwd=OWNED,text=True).strip()
for base in (ROOT,OWNED):assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=base,text=True)
assignment=json.loads((OLD/'capture-assignment.json').read_text());browser=json.loads((OLD/'browser-binding.json').read_text());build=json.loads((OLD/'build-binding.json').read_text());source=json.loads((OLD/'source-binding.json').read_text())
before=proc(1063);expected=assignment['protectedProcess']
assert {k:before[k] for k in expected}==expected and before['session']==1063 and os.readlink('/proc/1063/fd/22')=='socket:[3783]'
assert ports()=={'4173':['socket:[3783]'],'5373':[],'5374':[]}
protected=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json').read_text())['dist'];auth(ROOT/'dist',protected,True)
custody={str(p):meta(p) for p in Path('/home/morgana/Projects/orcs-vs-Fairies-evidence').rglob('*.sqlite')}
product=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json').read_text())
for base in (ROOT,OWNED):auth(base,product)
changed={'scripts/feature63/run-minimal63.py','scripts/feature63/public-producer.mjs','scripts/feature63/collect-launched-waves.py'}
for base in (ROOT,OWNED):auth(base,[r for r in source['records'] if r['path'] not in changed])
for n in changed:assert (ROOT/n).read_bytes()==(OWNED/n).read_bytes()
auth(Path(browser['dependencyRoot']),browser['dependencyRecords'],True);auth(Path(browser['chromiumDependencyRoot']),browser['chromiumDependencyRecords'],True)
auth(Path(build['originalTestedWebPath']),build['originalTestedWebRecords'],True)
assert desc(PRIOR)=={'path':str(PRIOR),'bytes':87864,'sha256':'27875d606ea53538d30e238a463b4cb17a691d36f0769f4d06675a30e0353c27'}
receipt=json.loads(PRIOR.read_text())
assert not R3.exists();R3.mkdir()
for r in receipt['completeInventories']:
 n=r['directory'];assert n in ('dist','server');auth(R2/n,r['files'],True)
 shutil.copytree(R2/n,R3/n,copy_function=shutil.copy2);auth(R3/n,r['files'],True)
assert sorted(p.name for p in R3.iterdir())==['dist','server']
assert proc(1063)==before and ports()=={'4173':['socket:[3783]'],'5373':[],'5374':[]};auth(ROOT/'dist',protected,True)
assert custody=={p:meta(Path(p)) for p in custody}
fresh=put('root-fresh-package-result.json',{'schema':1,'status':'EXACT_WEB_AND_SERVER_COPY_PASSED','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePin':pin,'sourcePrefix':str(R2),'freshPrefix':str(R3),'priorPackagingReceipt':desc(PRIOR),'completeInventories':receipt['completeInventories'],'counts':{'dist':398,'server':22},'productBuildExecuted':False,'serverBrowserDatabaseRuntimeExecuted':False,'databaseProfileOrOldDataCopied':False,'sourcePrefixRuntimeDataRead':False,'captureAuthorized':False,'rootProtectedIdentityUnchanged':True})
put('root-independent-prebinding-readback.json',{'sourcePin':pin,'protected':before,'protectedDist397Authenticated':True,'product570AuthenticatedBothCheckouts':True,'source966AuthenticatedBothCheckoutsWithThreeReviewedScripts':True,'dependency114Playwright303ChromiumAuthenticated':True,'allExistingRawCustodyMetadataUnchanged':True,'existingRawCustody':custody,'privatePorts':ports(),'newPrefixContainsOnlyCopiedDistServer':True,'captureNotYetAuthorized':True})
params=json.loads(Path('/tmp/ovf-feature63-r3-generator-draft-S6wC5ekG/root-parameters.r3.pending.json').read_text())
bindings=OUT/'bindings'
params.update({'sourcePin':pin,'outputDirectory':str(bindings),'nodeExecutablePath':assignment['nodeExecutable']['path'],'pythonExecutablePath':assignment['pythonExecutable']['path'],'playwrightDependencyRoot':browser['dependencyRoot'],'playwrightModulePath':browser['playwrightModulePath'],'chromiumExecutablePath':browser['chromiumExecutable']['path'],'chromiumDependencyRoot':browser['chromiumDependencyRoot'],'rootPackagingReceipt':fresh,'protectedProcess':expected,'protectedListenerSockets':assignment['protectedListenerSockets']})
params['rootAdmission']={k:True for k in params['rootAdmission']}
params['exclusiveHeavyApproval']={'approved':True,'holder':'/root/ai_modes','token':'heavy-runtime-1-feature63-r3-'+pin[:12]+'-'+OUT.name.rsplit('-',1)[-1],'validUntil':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=2)).isoformat()}
d=put('root-parameters.json',params)
print(json.dumps({'rootOutput':str(OUT),'parameters':d,'bindings':str(bindings),'slot':params['exclusiveHeavyApproval'],'sourcePin':pin}))
