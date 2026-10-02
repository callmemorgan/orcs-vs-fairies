from pathlib import Path
import datetime,hashlib,json,os,select,stat,tempfile
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX=OWNED/'work/feature63-human-wave-composition-r6'
CONTROL=Path('/tmp/ovf-feature63-r6-capture-control-2crngtsw')
B=Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02')
OUT=Path(tempfile.mkdtemp(prefix='ovf-root-feature63-r6-failed-closure-custody-',dir='/tmp'))
print(json.dumps({'rootOutput':str(OUT)}),flush=True)
ROOT_INPUT_ANCHORS={'/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/capture-assignment.json': {'path': '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/capture-assignment.json', 'bytes': 6958, 'sha256': '470e711127a4bb12c9e00e30a06a97529e2bd0e46ade9d1da6d637f1931210e5'}, '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/root-independent-prelaunch-readback.json': {'path': '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/root-independent-prelaunch-readback.json', 'bytes': 3290, 'sha256': '20e3702a8e1386a1cd110317b1c147542fa7f986ad94a7875c0240d8fef3813c'}, '/tmp/ovf-feature63-r6-capture-control-2crngtsw/independent-closure.json': {'path': '/tmp/ovf-feature63-r6-capture-control-2crngtsw/independent-closure.json', 'bytes': 311499, 'sha256': 'ca3f5b8ffd8eaf1a799785b2583c0bfb99c3a79b12acefa18d58f23a9c3b88b2'}, '/tmp/ovf-feature63-r6-capture-control-2crngtsw/launch.json': {'path': '/tmp/ovf-feature63-r6-capture-control-2crngtsw/launch.json', 'bytes': 2400, 'sha256': '9fb485ee1be3f06a10e8eb52ff9661cdf601e90ecfa49fb17c5adf21f5106631'}, '/tmp/ovf-feature63-r6-capture-control-2crngtsw/capture-assignment.actual.json': {'path': '/tmp/ovf-feature63-r6-capture-control-2crngtsw/capture-assignment.actual.json', 'bytes': 6958, 'sha256': '470e711127a4bb12c9e00e30a06a97529e2bd0e46ade9d1da6d637f1931210e5'}, '/tmp/ovf-feature63-r6-capture-control-2crngtsw/command.json': {'path': '/tmp/ovf-feature63-r6-capture-control-2crngtsw/command.json', 'bytes': 2133, 'sha256': 'c201f35cdf3e59ac6be159c68e878e97252a1bb71ca869bbe95cbf1e884434f2'}, '/tmp/ovf-feature63-r6-capture-control-2crngtsw/capture-launch-consumed.json': {'path': '/tmp/ovf-feature63-r6-capture-control-2crngtsw/capture-launch-consumed.json', 'bytes': 189, 'sha256': '660ce17f6c171160ebc1f7a0fef1ac6a91d11044e80a5bdd19bb5fe5c77f0645'}, '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r6/lifecycle/driver-result.json': {'path': '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r6/lifecycle/driver-result.json', 'bytes': 1775, 'sha256': '8e62c3fa27b29fe89ebea4d9f65c393cd8d1c6ddd5efce1c4fc8eda56a50ed37'}, '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r6/lifecycle/server-ownership.json': {'path': '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r6/lifecycle/server-ownership.json', 'bytes': 1155, 'sha256': 'fd9de0d2977f5c9007579c47fc53111cbbd397644a3617ed8c36bb28cac4e642'}, '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r6/lifecycle/driver-events.ndjson': {'path': '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r6/lifecycle/driver-events.ndjson', 'bytes': 415459, 'sha256': '53f2af233687aa93972c62db51746aa32acf0760a931fdb2de3699859bb583c3'}, '/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json': {'path': '/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json', 'bytes': 101264, 'sha256': '582f809d9a4e0180dd3d59147b7edfd881b091334f715d86bd56ea93c9db4a06'}, '/tmp/ovf-main402-remaining-2e5-r1/protected-before.json': {'path': '/tmp/ovf-main402-remaining-2e5-r1/protected-before.json', 'bytes': 74175, 'sha256': 'ed80088ef418debe90883929c364a588521815d14dbdd9703d8c6927c5855a5b'}, '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/source-binding.json': {'path': '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/source-binding.json', 'bytes': 183042, 'sha256': 'c4d955a934327536725ad34b44d8452d639aa0b42cc2643b62f3097e0b053c71'}, '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/build-binding.json': {'path': '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/build-binding.json', 'bytes': 150736, 'sha256': '4dd8072c907077d57d43a3d121bbbac6bee4af89c3b69926c055b5483baa6c5c'}, '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/browser-binding.json': {'path': '/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/browser-binding.json', 'bytes': 79255, 'sha256': '1f1c640911d52ad68ed3462abf83555e60185b96b8126dfa4e436610547ae46a'}}
INPUT_BYTES={}
INPUT_JSON={}
def stable_bytes(p,expected=None):
 p=Path(p)
 if p in INPUT_BYTES:
  raw=INPUT_BYTES[p]
 else:
  assert p.resolve()==p and not p.is_symlink()
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   before=os.fstat(fd);assert stat.S_ISREG(before.st_mode) and before.st_nlink==1
   chunks=[]
   while True:
    chunk=os.read(fd,1024*1024)
    if not chunk:break
    chunks.append(chunk)
   raw=b''.join(chunks);after=os.fstat(fd)
   identity=lambda st:(st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns,st.st_ctime_ns,st.st_mode,st.st_nlink)
   assert identity(before)==identity(after)==identity(p.lstat()) and len(raw)==before.st_size
  finally:os.close(fd)
  if str(p) in ROOT_INPUT_ANCHORS:INPUT_BYTES[p]=raw
 record={'path':str(p),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
 if expected is not None:assert record==expected
 if str(p) in ROOT_INPUT_ANCHORS:assert record==ROOT_INPUT_ANCHORS[str(p)]
 return raw
def retained_json(p):
 p=Path(p)
 if p not in INPUT_JSON:INPUT_JSON[p]=json.loads(stable_bytes(p,ROOT_INPUT_ANCHORS[str(p)]))
 return INPUT_JSON[p]

def desc(p):
 b=stable_bytes(p);return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def put(n,v):
 p=OUT/n
 with p.open('x') as f:json.dump(v,f,indent=2);f.write('\n')
 p.chmod(0o600);return desc(p)
def meta(p):
 s=p.stat();return {'path':str(p),'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size,'mode':stat.S_IMODE(s.st_mode),'links':s.st_nlink}
def kernel(pid):
 try:
  p=Path('/proc')/str(pid);s=(p/'stat').read_text();f=s[s.rfind(')')+2:].split()
  return {'pid':pid,'startTicks':int(f[19]),'session':int(f[3]),'state':f[0]}
 except (FileNotFoundError,ProcessLookupError):return None
def observed_exit(lifetime):
 first=kernel(lifetime['pid'])
 if first is None or first['startTicks']!=lifetime['startTicks']:
  return {'lifetimeIdentity':lifetime,'actual':first,'rememberedLifetimeExited':True,'scope':'bounded PID/start absent or different'}
 fd=os.pidfd_open(lifetime['pid'])
 try:
  second=kernel(lifetime['pid']);assert second is not None and second['startTicks']==lifetime['startTicks']
  poll=select.poll();poll.register(fd,select.POLLIN|select.POLLHUP|select.POLLERR|select.POLLNVAL);ready=poll.poll(0)
  assert ready and not any(flags&(select.POLLERR|select.POLLNVAL) for _,flags in ready),'Still-live or invalid remembered lifetime'
  return {'lifetimeIdentity':lifetime,'actual':second,'pidfdEvents':ready,'rememberedLifetimeExited':True,'scope':'root held PIDFD readiness after matching PID/start'}
 finally:os.close(fd)
def ports():
 r={str(x):[] for x in (4173,5373,5374)}
 for n in ('tcp','tcp6'):
  for line in (Path('/proc/net')/n).read_text().splitlines()[1:]:
   f=line.split();port=str(int(f[1].rsplit(':',1)[1],16))
   if f[3]=='0A' and port in r:r[port].append('socket:['+f[9]+']')
 return r
assert desc(B/'capture-assignment.json')['sha256']=='470e711127a4bb12c9e00e30a06a97529e2bd0e46ade9d1da6d637f1931210e5'
a=retained_json(B/'capture-assignment.json');p=PREFIX/'lifecycle/driver-result.json';capture=retained_json(p);c=retained_json(CONTROL/'independent-closure.json')
assert capture['status']=='FAIL_FIRST_FAILURE_NO_RETRY' and isinstance(capture.get('matchId'),str) and capture['protectedFinalReadback']['status']=='PASS'
assert c['wrapperExitCode']==1 and c['wrapperLifetimeReadback']['rememberedIdentityStillLive'] is False and c['wrapperLifetimeReadback']['observationFailure'] is None
assert c['allRememberedRegisteredIdentitiesNotLive'] is True and c['everyRememberedLifetimeObservationComplete'] is True and c['privateListenersAbsent'] is True and c['unobservedDescendantsExcluded'] is False
assert c['rememberedResources'] and all(r['observationFailure'] is None and r['rememberedIdentityStillLive'] is False for r in c['rememberedResources'])

assert a['sourcePin']=='f2e0025937b8caf5dc8f6f9f3de134d92a2d547a'
assert capture['schema']=='feature63-dedicated-capture-result-v1'
assert capture['firstFailure']['type']=='RuntimeError' and capture['firstFailure']['message']=='Auditor public-input 64 MiB budget exceeded; bytes preserved' and capture['cleanupFailures']==[]
assert len(c['rememberedResources'])==25 and all(r['independentPidfdOpenedWhileLive'] is True and r['independentPidfdEvents'] and r['lifetimeEvidenceScope'].startswith('INDEPENDENT_HELD_PIDFD_READY') for r in c['rememberedResources'])
def auth(base,rows,complete=False):
 for r in rows:
  p=base/r['path'];m=int(r['mode'],8) if isinstance(r['mode'],str) else r['mode'];assert p.is_file() and not p.is_symlink() and p.stat().st_size==r['bytes'] and stat.S_IMODE(p.stat().st_mode)==m and desc(p)['sha256']==r['sha256'],p
 if complete:assert {r['path'] for r in rows}=={str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()}
def auth_descriptor(record):
 p=Path(record['path']);raw=stable_bytes(p,record)
 if p not in INPUT_JSON:INPUT_JSON[p]=json.loads(raw)
 return INPUT_JSON[p]
source=auth_descriptor(a['sourceBinding']);build=auth_descriptor(a['buildBinding']);browser=auth_descriptor(a['browserBinding'])
assert source['sourcePin']==build['sourcePin']==browser['sourcePin']==capture['sourcePin']==a['sourcePin']
import subprocess
for base in (ROOT,OWNED):
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=base,text=True).strip()==a['sourcePin'] and not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=base,text=True)
product_path=Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json');protected_path=Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json')
assert desc(product_path)=={'path':str(product_path),'bytes':101264,'sha256':'582f809d9a4e0180dd3d59147b7edfd881b091334f715d86bd56ea93c9db4a06'}
assert desc(protected_path)=={'path':str(protected_path),'bytes':74175,'sha256':'ed80088ef418debe90883929c364a588521815d14dbdd9703d8c6927c5855a5b'}
for p in (product_path,protected_path):
 assert stable_bytes(p)==subprocess.check_output(['git','show',a['sourcePin']+':docs/evidence/main402-remaining-witness-2e5-20261001/raw/'+p.name],cwd=ROOT)
assert retained_json(CONTROL/'capture-assignment.actual.json')==a
command=retained_json(CONTROL/'command.json');consumed=retained_json(CONTROL/'capture-launch-consumed.json')
assert command['sourcePin']==a['sourcePin'] and command['cwd']==a['sourceRoot']==str(OWNED) and command['wrapperSha256']==a['wrapperSha256'] and command['slot']==a['exclusiveHeavyApproval']
assert command['environmentAnchor']['OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256']==consumed['assignmentSha256']==desc(B/'capture-assignment.json')['sha256'] and consumed['captureInvocations']==1 and consumed['automaticRetries']==0
assert command['command']==[a['pythonExecutable']['path'],'scripts/feature63/run-minimal63.py','capture',str(B/'capture-assignment.json')]
assert command['protectedBefore']==c['protectedBefore'] and c['protectedBefore']['process']['identity']==c['protectedAfter']['process']['identity']==a['protectedProcess']
launch=retained_json(CONTROL/'launch.json');assert launch['wrapper']==c['wrapperInitial'] and launch['controlDirectory']==str(CONTROL) and launch['wrapperPidfdOpened'] is True
server=retained_json(PREFIX/'lifecycle/server-ownership.json');assert server['schema']=='feature63-owned-server-v1' and server['sourcePin']==a['sourcePin'] and server['freshPrefix']==a['freshPrefix'] and server['exclusiveSlotToken']==a['exclusiveHeavyApproval']['token']
assert capture['closedFreshDatabaseIdentity']==server['freshDatabase'] and server['freshDatabase']['path']==str(PREFIX/'server-data/server.sqlite')
events=[json.loads(line) for line in stable_bytes(PREFIX/'lifecycle/driver-events.ndjson').decode().splitlines()]
registered=[e for e in events if e.get('action')=='registered native resource']
key=lambda r:(r['family'],r['lifetimeIdentity']['pid'],r['lifetimeIdentity']['startTicks'],r['originalAdmittedSession'],r['directRoot'])
assert len(registered)==25 and {key(r) for r in registered}=={key(r) for r in c['rememberedResources']}
assert desc(B/'root-independent-prelaunch-readback.json')['sha256']=='20e3702a8e1386a1cd110317b1c147542fa7f986ad94a7875c0240d8fef3813c'
assert retained_json(B/'root-independent-prelaunch-readback.json')['sourcePin']==a['sourcePin']

for base in (ROOT,OWNED):
 auth(base,source['records']);auth(base,retained_json(product_path))
auth(ROOT/'dist',retained_json(protected_path)['dist'],True)
for base,rows in [(Path(build['webDistPath']),build['webRecords']),(Path(build['serverBuildPath']),build['serverRecords']),(Path(browser['dependencyRoot']),browser['dependencyRecords']),(Path(browser['chromiumDependencyRoot']),browser['chromiumDependencyRecords'])]:auth(base,rows,True)
assert [len(source['records']),len(build['webRecords']),len(build['serverRecords']),len(browser['dependencyRecords']),len(browser['chromiumDependencyRecords'])]==[966,398,22,114,303]

launch=retained_json(CONTROL/'launch.json')
lifetimes=[r['lifetimeIdentity'] for r in c['rememberedResources']]+[{k:launch[name]['identity'][k] for k in ('pid','startTicks')} for name in ('launcher','wrapper')]
readbacks=[observed_exit(l) for l in lifetimes]
actual=kernel(1063);assert actual['startTicks']==874 and actual['session']==1063
protected=a['protectedProcess'];assert os.readlink('/proc/1063/cwd')==protected['cwd'] and os.readlink('/proc/1063/exe')==protected['executable'] and [x.decode() for x in Path('/proc/1063/cmdline').read_bytes().split(b'\0') if x]==protected['argv']
assert ports()=={'4173':['socket:[3783]'],'5373':[],'5374':[]} and os.readlink('/proc/1063/fd/22')=='socket:[3783]'
baseline=retained_json(Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/root-independent-prelaunch-readback.json'))['existingRawCustody']
assert baseline=={p:meta(Path(p)) for p in baseline}
raw=PREFIX/'server-data/server.sqlite';before=meta(raw);fresh=retained_json(PREFIX/'lifecycle/server-ownership.json')['freshDatabase']
assert fresh=={k:before[k] for k in ('path','device','inode')} and before['links']==1 and not raw.is_symlink()
assert all(not Path(str(raw)+suffix).exists() for suffix in ('-wal','-shm','-journal'))
holders=[]
for proc in Path('/proc').iterdir():
 if not proc.name.isdigit():continue
 try:
  for entry in (proc/'fd').iterdir():
   try:
    st=entry.stat()
    if (st.st_dev,st.st_ino)==(before['device'],before['inode']):holders.append(str(entry))
   except (FileNotFoundError,ProcessLookupError):pass
 except (FileNotFoundError,ProcessLookupError,PermissionError):pass
assert not holders
closure=put('root-native-lifetime-disposition.json',{'status':'ROOT_FAILED_CAPTURE_REGISTERED_LIFETIMES_CLOSED','sourcePin':a['sourcePin'],'captureResult':desc(p),'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapperExitCode':1,'wrapperClosureRequiredSeparately':True,'rootRememberedLifetimeReadbacks':readbacks,'independentLauncherClosure':desc(CONTROL/'independent-closure.json'),'ports':ports(),'protectedLifetime':actual,'rawOpenHoldersObserved':holders,'rawSidecarsAbsent':True,'unobservedDescendantsExcluded':False,'limit':'Finite registered-lifetime observations do not exclude missed forks or reparenting.','oldCustodyMetadataUnchanged':True,'rawContentsNotReadYet':True})
fd=os.open(raw,os.O_RDONLY|os.O_NOFOLLOW)
try:
 st=os.fstat(fd);assert (st.st_dev,st.st_ino,st.st_size,st.st_nlink)==(before['device'],before['inode'],before['bytes'],1)
 os.fchmod(fd,0o444);h=hashlib.sha256()
 while True:
  chunk=os.read(fd,1024*1024)
  if not chunk:break
  h.update(chunk)
 custody=Path(tempfile.mkdtemp(prefix='feature63-public-budget-failure-r6-f2e0-',dir='/home/morgana/Projects/orcs-vs-Fairies-evidence'))/'closed-server.sqlite'
 os.link(raw,custody);assert meta(raw)=={**before,'mode':0o444,'links':2}
 assert hashlib.sha256(custody.read_bytes()).hexdigest()==h.hexdigest()
finally:os.close(fd)
assert baseline=={p:meta(Path(p)) for p in baseline}
record={'status':'FAILED_R6_PUBLIC_BUDGET_RAW_RETAINED_NO_EXTRACTION','sourcePin':a['sourcePin'],'originalPath':str(raw),'custodyPath':str(custody),'device':before['device'],'inode':before['inode'],'bytes':before['bytes'],'sha256':h.hexdigest(),'mode':0o444,'links':2,'sidecarsAbsent':True,'rootNativeLifetimeDisposition':closure,'matchId':capture.get('matchId'),'captureInvocations':1,'automaticRetries':0,'sqlQueryExtractionOrAudit':False,'feature63Qualified':False,'slotReleased':False,'firstFailure':capture['firstFailure']}
put('root-failure-disposition.json',record)
print(json.dumps({'rootOutput':str(OUT),'custody':record,'status':'PASS'}))
