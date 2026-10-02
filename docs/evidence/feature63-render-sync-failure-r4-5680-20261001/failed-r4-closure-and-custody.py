from pathlib import Path
import datetime,hashlib,json,os,select,stat,tempfile
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX=OWNED/'work/feature63-human-wave-composition-r4'
CONTROL=Path('/tmp/ovf-feature63-r4-capture-control-v3vru3_u')
B=Path('/tmp/ovf-root-feature63-r4-bindings-m9z4ndhm')
OUT=Path(tempfile.mkdtemp(prefix='ovf-root-feature63-r4-failed-closure-custody-',dir='/tmp'))
print(json.dumps({'rootOutput':str(OUT)}),flush=True)
def desc(p):return {'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
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
a=json.loads((B/'capture-assignment.json').read_text());p=PREFIX/'lifecycle/driver-result.json';capture=json.loads(p.read_text());c=json.loads((CONTROL/'independent-closure.json').read_text())
assert capture['status']=='FAIL_CLEANUP_HELD_NO_UNVERIFIED_SIGNAL' and isinstance(capture.get('matchId'),str) and capture['protectedFinalReadback']['status']=='PASS'
assert c['wrapperExitCode']==1 and c['wrapperLifetimeReadback']['rememberedIdentityStillLive'] is False and c['wrapperLifetimeReadback']['observationFailure'] is None
assert c['allRememberedRegisteredIdentitiesNotLive'] is True and c['everyRememberedLifetimeObservationComplete'] is True and c['privateListenersAbsent'] is True and c['unobservedDescendantsExcluded'] is False
launch=json.loads((CONTROL/'launch.json').read_text())
lifetimes=[r['lifetimeIdentity'] for r in c['rememberedResources']]+[{k:launch[name]['identity'][k] for k in ('pid','startTicks')} for name in ('launcher','wrapper')]
readbacks=[observed_exit(l) for l in lifetimes]
actual=kernel(1063);assert actual['startTicks']==874 and actual['session']==1063
protected=a['protectedProcess'];assert os.readlink('/proc/1063/cwd')==protected['cwd'] and os.readlink('/proc/1063/exe')==protected['executable'] and [x.decode() for x in Path('/proc/1063/cmdline').read_bytes().split(b'\0') if x]==protected['argv']
assert ports()=={'4173':['socket:[3783]'],'5373':[],'5374':[]} and os.readlink('/proc/1063/fd/22')=='socket:[3783]'
baseline=json.loads(Path('/tmp/ovf-root-feature63-r4-bindings-m9z4ndhm/root-independent-prelaunch-readback.json').read_text())['existingRawCustody']
assert baseline=={p:meta(Path(p)) for p in baseline}
raw=PREFIX/'server-data/server.sqlite';before=meta(raw);fresh=json.loads((PREFIX/'lifecycle/server-ownership.json').read_text())['freshDatabase']
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
 custody=Path(tempfile.mkdtemp(prefix='feature63-coordinate-failure-r4-5680-',dir='/home/morgana/Projects/orcs-vs-Fairies-evidence'))/'closed-server.sqlite'
 os.link(raw,custody);assert meta(raw)=={**before,'mode':0o444,'links':2}
 assert hashlib.sha256(custody.read_bytes()).hexdigest()==h.hexdigest()
finally:os.close(fd)
assert baseline=={p:meta(Path(p)) for p in baseline}
record={'status':'FAILED_R4_PUBLIC_COORDINATE_RAW_RETAINED_NO_EXTRACTION','sourcePin':a['sourcePin'],'originalPath':str(raw),'custodyPath':str(custody),'device':before['device'],'inode':before['inode'],'bytes':before['bytes'],'sha256':h.hexdigest(),'mode':0o444,'links':2,'sidecarsAbsent':True,'rootNativeLifetimeDisposition':closure,'matchId':capture.get('matchId'),'captureInvocations':1,'automaticRetries':0,'sqlQueryExtractionOrAudit':False,'feature63Qualified':False,'slotReleased':True,'firstFailure':capture['firstFailure']}
put('root-failure-disposition.json',record)
print(json.dumps({'rootOutput':str(OUT),'custody':record,'status':'PASS'}))
