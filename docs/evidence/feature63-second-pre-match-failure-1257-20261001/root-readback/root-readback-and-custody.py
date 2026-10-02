from pathlib import Path
import os, stat, json, hashlib, tempfile, subprocess, datetime
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
CONTROL=Path('/tmp/ovf-feature63-r2-capture-control-V8aSd0IH')
OUT=Path(__file__).parent
PIN='1257b24db0121a72a12a6de10592397dc4996038'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(data):return hashlib.sha256(data).hexdigest()
def put(name,value):
 p=OUT/name
 with p.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
 return {'path':str(p),'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())}
def proc(pid):
 try:
  p=Path('/proc')/str(pid);s=(p/'stat').read_text();f=s[s.rfind(')')+2:].split()
  return {'pid':pid,'startTicks':int(f[19]),'session':int(f[3]),'state':f[0],'cwd':os.readlink(p/'cwd'),'executable':os.readlink(p/'exe'),'argv':[x.decode() for x in (p/'cmdline').read_bytes().split(b'\0') if x]}
 except (FileNotFoundError,ProcessLookupError):return None
def listeners():
 r={str(p):[] for p in [4173,5373,5374]}
 for name in ['tcp','tcp6']:
  for line in (Path('/proc/net')/name).read_text().splitlines()[1:]:
   f=line.split(); port=str(int(f[1].rsplit(':',1)[1],16))
   if f[3]=='0A' and port in r:r[port].append('socket:['+f[9]+']')
 return r
def metadata(p):
 s=p.stat();return {'path':str(p),'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size,'mode':stat.S_IMODE(s.st_mode),'links':s.st_nlink}
def authenticate(base,rows,complete=False):
 for row in rows:
  p=base/row['path'];s=p.stat(); mode=row['mode'];mode=int(mode,8) if isinstance(mode,str) else mode
  assert p.is_file() and not p.is_symlink() and s.st_size==row['bytes'] and stat.S_IMODE(s.st_mode)==mode and digest(p.read_bytes())==row['sha256'],str(p)
 if complete:assert sorted(r['path'] for r in rows)==sorted(str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()),str(base)
 return len(rows)
readback=json.loads((CONTROL/'final-independent-live-readback.json').read_text())
for n,sha in [('final-independent-live-readback.json','925b1c304716d2db5f192fef71fd2982c839c281cb6fc5b0238c387ba1eaea4d'),('lifecycle-retention-readback.json','494a2178068041643058ca1047d8745b209029decb4e943f3cd14bab47fcadc3'),('closure-slot-release.json','ed7b1c8621ddd3e62b5ac5a952c317b98c635cea13418d96793e536985f1e7b8')]:assert digest((CONTROL/n).read_bytes())==sha,n
launch=json.loads((CONTROL/'launch.json').read_text()); rows=[v['rememberedImmutableIdentity'] for v in readback['rememberedResources']]+[launch[k]['immutableIdentity'] for k in ['launcher','wrapper']]
current=[{'bound':r,'current':proc(r['pid'])} for r in rows]
assert all(v['current'] is None or v['current']['startTicks']!=v['bound']['startTicks'] or v['current']['state'] in ['Z','X'] for v in current)
sessions=set(readback['finiteObservedSessions']);members=[]
for p in Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  s=(p/'stat').read_text();f=s[s.rfind(')')+2:].split()
  if int(f[3]) in sessions and f[0] not in ['Z','X']:members.append({'pid':int(p.name),'session':int(f[3]),'startTicks':int(f[19])})
 except (FileNotFoundError,ProcessLookupError):pass
assert not members
expected=json.loads((CONTROL/'command.json').read_text())['protectedBefore']['process']['identity'];actual=proc(1063)
assert {k:actual[k] for k in expected}==expected and actual['session']==1063 and os.readlink('/proc/1063/fd/22')=='socket:[3783]'
ports=listeners();assert ports['4173']==['socket:[3783]'] and not ports['5373'] and not ports['5374']
for p in [ROOT,OWNED]:
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=p,text=True).strip()==PIN
 assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=p,text=True)
build=json.loads((CONTROL/'buildBinding.actual.json').read_text());browser=json.loads((CONTROL/'browserBinding.actual.json').read_text());sources=json.loads((CONTROL/'sourceBinding.actual.json').read_text());product=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json').read_text());protected=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json').read_text())
counts={'rootSources':authenticate(ROOT,sources['records']),'ownedSources':authenticate(OWNED,sources['records']),'rootProduct':authenticate(ROOT,product),'ownedProduct':authenticate(OWNED,product),'rootProtectedDist':authenticate(ROOT/'dist',protected['dist'],True),'ownedTestedDist':authenticate(Path(build['originalTestedWebPath']),build['originalTestedWebRecords'],True),'r2Web':authenticate(Path(build['webDistPath']),build['webRecords'],True),'r2Server':authenticate(Path(build['serverBuildPath']),build['serverRecords'],True),'playwright':authenticate(Path(browser['dependencyRoot']),browser['dependencyRecords'],True),'chromium':authenticate(Path(browser['chromiumDependencyRoot']),browser['chromiumDependencyRecords'],True)}
retention=json.loads((CONTROL/'lifecycle-retention-readback.json').read_text())
for r in retention['records']:
 a=Path(r['sourcePath']).read_bytes();b=Path(r['retainedPath']).read_bytes();assert a==b and len(a)==r['bytes'] and digest(a)==r['sha256']
DB=OWNED/'work/feature63-human-wave-composition-r2/server-data/server.sqlite';dbmeta=metadata(DB)
initial=json.loads((CONTROL/'lifecycle-server-ownership.json').read_text())['freshDatabase']
assert dbmeta['device']==initial['device'] and dbmeta['inode']==initial['inode'] and dbmeta['links']==1 and not DB.is_symlink()
assert all(not Path(str(DB)+s).exists() for s in ['-wal','-shm','-journal'])
holders=[]
for p in Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  for fd in (p/'fd').iterdir():
   try:
    s=fd.stat()
    if (s.st_dev,s.st_ino)==(dbmeta['device'],dbmeta['inode']):holders.append(str(fd))
   except (FileNotFoundError,ProcessLookupError):pass
 except (FileNotFoundError,ProcessLookupError,PermissionError):pass
assert not holders
existing={str(p):metadata(p) for p in Path('/home/morgana/Projects/orcs-vs-Fairies-evidence').rglob('*.sqlite')}
life={'at':now(),'sourcePin':PIN,'status':'ROOT_READBACK_PASS_FAILED_PRE_MATCH_CLOSURE','remembered':current,'observedSessions':sorted(sessions),'observedSessionMembers':members,'finiteScanCannotExcludeMissedFinalForkOrReparent':True,'ports':ports,'protectedActual':actual,'protectedFd22':os.readlink('/proc/1063/fd/22'),'inventoryCounts':counts,'allInventoryByteModeFilenameChecksPassed':True,'databaseBefore':dbmeta,'databaseOpenHoldersObserved':holders,'sidecarsAbsent':True,'databaseContentReadYet':False,'feature63Qualified':False,'slotReleased':True,'captureInvocations':1,'automaticRetries':0,'mismatchFieldNotCaptured':True}
lifetime=put('root-native-lifetime-disposition.json',life)
fd=os.open(DB,os.O_RDONLY|os.O_NOFOLLOW)
try:
 s=os.fstat(fd);assert (s.st_dev,s.st_ino,s.st_size,s.st_nlink)==(dbmeta['device'],dbmeta['inode'],dbmeta['bytes'],1)
 os.fchmod(fd,0o444)
 h=hashlib.sha256()
 while True:
  b=os.read(fd,1024*1024)
  if not b:break
  h.update(b)
 rawsha=h.hexdigest()
 custody=Path(tempfile.mkdtemp(prefix='feature63-pre-match-failure-r2-1257-',dir='/home/morgana/Projects/orcs-vs-Fairies-evidence'))/'closed-server.sqlite'
 os.link(DB,custody)
 assert metadata(DB)=={**dbmeta,'mode':0o444,'links':2}
 assert metadata(custody)=={**metadata(DB),'path':str(custody)}
 assert digest(custody.read_bytes())==rawsha
 assert existing=={p:metadata(Path(p)) for p in existing}
 raw={'at':now(),'status':'CLOSED_FAILED_PRE_MATCH_RAW_RETAINED_NO_EXTRACTION','sourcePin':PIN,'originalPath':str(DB),'custodyPath':str(custody),'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size,'sha256':rawsha,'mode':0o444,'links':2,'sidecarsAbsent':True,'matchId':None,'sqlQueryPerformed':False,'extractionPerformed':False,'nativeAuditAuthorized':False,'rootNativeLifetimeDisposition':lifetime,'existingCustodyFilesModified':False}
 put('root-failed-raw-custody.json',raw)
finally:os.close(fd)
put('root-failure-disposition.json',{'at':now(),'status':'FAILED_R2_ATTEMPT_RETAINED_OWNED_CLOSURE_ADMITTED','sourcePin':PIN,'feature63Qualified':False,'captureReachedMatch':False,'firstFailure':json.loads((CONTROL/'lifecycle-driver-result.json').read_text())['firstFailure'],'expectedActualMismatchNotCaptured':True,'fdOwnershipCrashesPersisted':True,'slotReleased':True,'rootNativeLifetimeDisposition':lifetime,'rawCustody':raw,'noRetryExtractionOrAudit':True,'originalPrefixPreservedExceptRootRawModeAndHardlinkCustody':True})
print(json.dumps({'rootOutput':str(OUT),'counts':counts,'custody':str(custody),'sha256':rawsha,'status':'PASS'}))
