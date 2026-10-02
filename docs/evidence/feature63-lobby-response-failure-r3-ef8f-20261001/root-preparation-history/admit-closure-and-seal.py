from pathlib import Path
import datetime,hashlib,json,os,select,stat,tempfile
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX=OWNED/'work/feature63-human-wave-composition-r3'
CONTROL=Path('/tmp/ovf-feature63-r3-capture-control-jm6i42o8')
B=Path('/tmp/ovf-root-feature63-r3-package-bind-aa0pwqy6/bindings')
OUT=Path(tempfile.mkdtemp(prefix='ovf-root-feature63-r3-closure-seal-',dir='/tmp'))
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
assert capture['status']=='CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING' and capture['firstFailure'] is None and capture['cleanupFailures']==[] and capture['protectedFinalReadback']['status']=='PASS'
assert c['wrapperExitCode'] is not None and c['wrapperExitCode']==0
assert c['wrapperLifetimeReadback']['rememberedIdentityStillLive'] is False and c['wrapperLifetimeReadback']['observationFailure'] is None
assert c['allRememberedRegisteredIdentitiesNotLive'] is True and c['everyRememberedLifetimeObservationComplete'] is True and c['privateListenersAbsent'] is True and c['unobservedDescendantsExcluded'] is False
assert c['rememberedResources'] and all(r['observationFailure'] is None and r['rememberedIdentityStillLive'] is False for r in c['rememberedResources'])
launch=json.loads((CONTROL/'launch.json').read_text())
lifetimes=[r['lifetimeIdentity'] for r in c['rememberedResources']]+[{k:launch[name]['identity'][k] for k in ('pid','startTicks')} for name in ('launcher','wrapper')]
readbacks=[observed_exit(l) for l in lifetimes]
protected=a['protectedProcess'];actual=kernel(1063);assert actual['startTicks']==874 and actual['session']==1063
assert {**protected,'cwd':os.readlink('/proc/1063/cwd'),'executable':os.readlink('/proc/1063/exe'),'argv':[x.decode() for x in Path('/proc/1063/cmdline').read_bytes().split(b'\0') if x]}==protected
assert ports()=={'4173':['socket:[3783]'],'5373':[],'5374':[]} and os.readlink('/proc/1063/fd/22')=='socket:[3783]'
baseline=json.loads(Path('/tmp/ovf-root-feature63-r3-package-bind-aa0pwqy6/root-independent-prebinding-readback.json').read_text())['existingRawCustody']
assert baseline=={p:meta(Path(p)) for p in baseline}
raw=PREFIX/'server-data/server.sqlite';before=meta(raw);fresh=capture['closedFreshDatabaseIdentity']
assert fresh=={k:before[k] for k in ('path','device','inode')} and before['links']==1 and not raw.is_symlink()
assert all(not Path(str(raw)+suffix).exists() for suffix in ('-wal','-shm','-journal'))
holders=[]
for proc in Path('/proc').iterdir():
 if not proc.name.isdigit():continue
 try:
  for entry in (proc/'fd').iterdir():
   try:
    s=entry.stat()
    if (s.st_dev,s.st_ino)==(before['device'],before['inode']):holders.append(str(entry))
   except (FileNotFoundError,ProcessLookupError):pass
 except (FileNotFoundError,ProcessLookupError,PermissionError):pass
assert not holders
e=put('root-independent-native-closure.json',{'sourcePin':a['sourcePin'],'captureResult':desc(p),'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapperExitCode':c['wrapperExitCode'],'wrapperClosureRequiredSeparately':True,'rootRememberedLifetimeReadbacks':readbacks,'independentLauncherClosure':desc(CONTROL/'independent-closure.json'),'ports':ports(),'protectedLifetime':actual,'rawOpenHoldersObserved':holders,'rawSidecarsAbsent':True,'unobservedDescendantsExcluded':False,'limit':'Finite registered-lifetime observations do not exclude a missed final fork or reparent; no complete descendant enumeration claim.','oldCustodyMetadataUnchanged':True,'rawContentsNotReadYet':True})
life=put('root-native-lifetime.json',{'schema':'feature63-root-native-lifetime-disposition-v1','approved':True,'assignedBy':'/root','sourcePin':a['sourcePin'],'matchId':capture['matchId'],'captureResult':desc(p),'ownedNativeLifetimeIndependentlyAdmitted':True,'closureEvidenceDescriptors':[e,desc(CONTROL/'independent-closure.json')],'unobservedDescendantsExcluded':False})
fd=os.open(raw,os.O_RDONLY|os.O_NOFOLLOW)
try:
 s=os.fstat(fd);assert (s.st_dev,s.st_ino,s.st_size,s.st_nlink)==(before['device'],before['inode'],before['bytes'],1)
 os.fchmod(fd,0o444);sealed=os.fstat(fd);h=hashlib.sha256()
 while True:
  chunk=os.read(fd,1024*1024)
  if not chunk:break
  h.update(chunk)
 after=os.fstat(fd);assert (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns,after.st_mode,after.st_nlink)==(sealed.st_dev,sealed.st_ino,sealed.st_size,sealed.st_mtime_ns,sealed.st_ctime_ns,sealed.st_mode,sealed.st_nlink)
 assert meta(raw)=={**before,'mode':0o444}
 rawd={'path':str(raw),'bytes':s.st_size,'sha256':h.hexdigest(),'device':s.st_dev,'inode':s.st_ino}
finally:os.close(fd)
closed=put('closed-raw.json',{'schema':'feature63-closed-raw-v1','sourcePin':a['sourcePin'],'matchId':capture['matchId'],'sealId':'feature63-r3-'+a['sourcePin'][:12]+'-'+OUT.name.rsplit('-',1)[-1],'producerClosed':True,'ownedProcessesClosed':True,'rootSealed':True,'sidecarsAbsent':True,'dbIdentity':{'device':rawd['device'],'inode':rawd['inode']},'rawBytes':rawd['bytes'],'rawSha256':rawd['sha256']})
custody=put('root-custody.json',{'schema':'feature63-root-raw-custody-v1','approved':True,'assignedBy':'/root','sourcePin':a['sourcePin'],'matchId':capture['matchId'],'rawDatabase':rawd,'captureResult':desc(p),'closedRawReceipt':closed,'freshDatabaseAuthenticated':True,'oldRawNeverReadOrReused':True,'rootSealed':True,'noLivePrivateReadback':True,'links':1,'mode':0o444})
schema=put('native-schema-review.json',{'approved':True,'status':'PASS','sourcePin':a['sourcePin'],'auditorSha256':a['auditor']['sha256']})
assert baseline=={p:meta(Path(p)) for p in baseline}
print(json.dumps({'rootOutput':str(OUT),'nativeLifetime':life,'closedRaw':closed,'custody':custody,'nativeSchemaReview':schema,'rawDatabase':rawd,'extractionNotExecuted':True}))
