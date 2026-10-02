from pathlib import Path
import copy,datetime,hashlib,json,os,shutil,stat,subprocess,sys,tempfile
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREVIOUS=Path('/tmp/ovf-root-feature63-r3-package-bind-aa0pwqy6/bindings')
PIN=sys.argv[1];REVIEW=Path(sys.argv[2]);REVIEW_SHA=sys.argv[3]
PREFIX=OWNED/'work/feature63-human-wave-composition-r5';PRIOR=OWNED/'work/feature63-human-wave-composition-r4'
OUT=Path(tempfile.mkdtemp(prefix='ovf-root-feature63-r5-bindings-',dir='/tmp'))
print(json.dumps({'rootOutput':str(OUT)}),flush=True)
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def desc(p):return {'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}
def mode(v):return int(v,8) if isinstance(v,str) else v
def inv(base):return sorted([{'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':sha(p),'mode':stat.S_IMODE(p.stat().st_mode)} for p in base.rglob('*') if p.is_file()],key=lambda r:r['path'])
def auth(base,rows,complete=False):
 for r in rows:
  p=base/r['path'];assert p.is_file() and not p.is_symlink() and p.stat().st_size==r['bytes'] and sha(p)==r['sha256'] and stat.S_IMODE(p.stat().st_mode)==mode(r['mode']),p
 if complete:assert inv(base)==sorted([{**r,'mode':mode(r['mode'])} for r in rows],key=lambda r:r['path'])
def put(n,v):
 p=OUT/n
 with p.open('x') as f:json.dump(v,f,indent=2,sort_keys=True);f.write('\n')
 p.chmod(0o644);return desc(p)
R3_READBACK=PREVIOUS/'binding-readback.json'
assert sha(R3_READBACK)=='510f81922a5987163247eb9623b138068cdcb1d727d5389582607cfc8195cb7f'
R3_RECORDS={Path(r['path']).name:r for r in json.loads(R3_READBACK.read_text())['generated']}
def load(n):
 p=PREVIOUS/n;r=R3_RECORDS[n]
 assert desc(p)=={k:r[k] for k in ('path','bytes','sha256')} and stat.S_IMODE(p.stat().st_mode)==r['mode']
 return json.loads(p.read_text())
assert sha(REVIEW)==REVIEW_SHA;review=json.loads(REVIEW.read_text());assert review['status']=='PASS_STATIC_R5_RENDER_SYNC_RUNTIME_HELD'
R4_READBACK=Path('/tmp/ovf-root-feature63-r4-bindings-m9z4ndhm/root-binding-readback.json')
assert R4_READBACK.stat().st_size==3548 and sha(R4_READBACK)=='daa6e000a7c0be6b1ad7d2320a46436feeaba75ee87741acfba03b29ca175328'
R4_PACKAGE=R4_READBACK.parent/'root-fresh-package-result.json'
r4_package_record=next(r for r in json.loads(R4_READBACK.read_text())['completeOutputRecords'] if r['path']==R4_PACKAGE.name)
assert desc(R4_PACKAGE)=={'path':str(R4_PACKAGE),'bytes':r4_package_record['bytes'],'sha256':r4_package_record['sha256']} and stat.S_IMODE(R4_PACKAGE.stat().st_mode)==r4_package_record['mode']
for base in (ROOT,OWNED):
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=base,text=True).strip()==PIN
 assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=base,text=True)
assert not PREFIX.exists()
previous=load('capture-assignment.json');source=load('source-binding.json');build=load('build-binding.json');tests=load('tested-build.json');runtime_review=load('root-review.json');browser=load('browser-binding.json')
product=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json').read_text())
protected=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json').read_text())['dist']
for base in (ROOT,OWNED):auth(base,product)
auth(ROOT/'dist',protected,True);assert len(product)==570 and len(protected)==397
assert len(browser['dependencyRecords'])==114 and len(browser['chromiumDependencyRecords'])==303
assert len(build['webRecords'])==398 and len(build['serverRecords'])==22
for key in ('dependencyRecords','chromiumDependencyRecords'):auth(Path(browser['dependencyRoot' if key=='dependencyRecords' else 'chromiumDependencyRoot']),browser[key],True)
for r in source['records']:
 p=ROOT/r['path'];r.update({'bytes':p.stat().st_size,'sha256':sha(p),'mode':stat.S_IMODE(p.stat().st_mode)})
auth(OWNED,source['records']);assert len(source['records'])==966
for k in ('nodeExecutable','pythonExecutable','auditor'):assert desc(Path(previous[k]['path']))==previous[k]
for k,n in [('publicProducer','public-producer.mjs'),('collector','collect-launched-waves.py')]:previous[k]=desc(OWNED/'scripts/feature63'/n)
previous['wrapperSha256']=sha(OWNED/'scripts/feature63/run-minimal63.py')
PREFIX.mkdir()
for n,rows in [('dist',build['webRecords']),('server',build['serverRecords'])]:
 auth(PRIOR/n,rows,True);shutil.copytree(PRIOR/n,PREFIX/n,copy_function=shutil.copy2);auth(PREFIX/n,rows,True)
assert sorted(p.name for p in PREFIX.iterdir())==['dist','server']
package=put('root-fresh-package-result.json',{'schema':1,'status':'EXACT_WEB_AND_SERVER_COPY_PASSED','sourcePin':PIN,'sourcePrefix':str(PRIOR),'freshPrefix':str(PREFIX),'counts':{'dist':398,'server':22},'completeInventories':[{'directory':n,'files':inv(PREFIX/n)} for n in ('dist','server')],'priorPackagingReceipt':desc(R4_PACKAGE),'productBuildExecuted':False,'serverBrowserDatabaseRuntimeExecuted':False,'databaseProfileOrOldDataCopied':False,'sourcePrefixRuntimeDataRead':False,'captureAuthorized':False})
slot={'approved':True,'holder':'/root/ai_modes','token':'heavy-runtime-1-feature63-r5-'+PIN[:12]+'-'+OUT.name.rsplit('-',1)[-1],'validUntil':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=2)).isoformat()}
for value in (source,build,tests,runtime_review,browser):
 value.update({'sourcePin':PIN,'createdAt':stamp})
 value['provenance']={'priorR3Binding':desc(PREVIOUS/({'feature63-new-source-binding-v1':'source-binding.json','feature63-build-binding-v1':'build-binding.json','feature63-tested-build-v1':'tested-build.json','feature63-dedicated-wrapper-review-v1':'root-review.json','feature63-browser-binding-v1':'browser-binding.json'}[value['schema']])),'r5StaticReview':desc(REVIEW),'r5RootPackage':package,'scope':'Root independently authenticated current bytes and files; retained r3 descriptors are historical provenance only.'}
source_d=put('source-binding.json',source)
build.update({'producerSha256':previous['publicProducer']['sha256'],'publicDriverSha256':previous['wrapperSha256'],'webDistPath':str(PREFIX/'dist'),'serverBuildPath':str(PREFIX/'server')});build_d=put('build-binding.json',build)
tests.update({'sourceBinding':source_d,'buildBinding':build_d});tests_d=put('tested-build.json',tests)
runtime_review.update({'wrapperSha256':previous['wrapperSha256'],'publicProducerSha256':previous['publicProducer']['sha256'],'collectorSha256':previous['collector']['sha256'],'staticDriverReviews':runtime_review['staticDriverReviews']+[desc(REVIEW)],'reviewScope':'Root admits exact current r5 bytes and fresh bindings after bounded r5 static review. Prior reviews retain original scopes. Finite descendant observation and provider identity limitations remain.'});runtime_review_d=put('root-review.json',runtime_review)
browser.update({'producerSha256':previous['publicProducer']['sha256'],'buildBindingSha256':build_d['sha256'],'exclusiveSlotToken':slot['token']});browser_d=put('browser-binding.json',browser)
a=previous;a.update({'sourcePin':PIN,'freshPrefix':'work/feature63-human-wave-composition-r5','exclusiveHeavyApproval':slot,'sourceBinding':source_d,'buildBinding':build_d,'testedBuildReceipt':tests_d,'reviewReceipt':runtime_review_d,'browserBinding':browser_d})
public=a['publicAssignmentTemplate'];public.update({'sourcePin':PIN,'freshPrefix':a['freshPrefix'],'outputRoot':str(PREFIX/'public'),'publicDriverSha256':a['wrapperSha256'],'reviewedProducer':a['publicProducer'],'exclusiveHeavyApproval':slot,'sourceBinding':source_d,'buildBinding':build_d,'browserBinding':browser_d,'serverOwnership':None,'externalBrowserOwnership':None})
collector=a['collectorAssignmentTemplate'];collector.update({'sourcePin':PIN,'outputPrefix':a['freshPrefix'],'sourceInventory':source_d,'reviewReceipt':runtime_review_d,'collectorSha256':a['collector']['sha256'],'heavySlot':{'assigned':True,'exclusive':True,'slotId':slot['token']},'freshDatabase':{**collector['freshDatabase'],'path':str(PREFIX/'server-data/server.sqlite')},'publicMatchIdentity':None})
assignment=put('capture-assignment.json',a)
control=Path(tempfile.mkdtemp(prefix='ovf-feature63-r5-capture-control-',dir='/tmp'));assert not list(control.iterdir()) and stat.S_IMODE(control.stat().st_mode)==0o700
d={'schema':1,'status':'PASS_ROOT_R5_FRESH_CAPTURE_BINDINGS_AUTHENTICATED','at':stamp,'captureAdmitted':True,'captureInvocationsAuthorized':1,'slotExclusivelyAssignedTo':'/root/ai_modes','noAutomaticRetryAuthorized':True,'sourcePin':PIN,'captureAssignment':assignment,'slot':slot,'feature63Qualified':False,'unobservedDescendantsExcluded':False,'freshPrivateEmptyControl':{'path':str(control),'mode':0o700,'filenames':[]},'rootProduct570BothSource966OwnedAndProtectedDist397Authenticated':True,'dependency114Playwright303ChromiumAuthenticated':True,'web398Server22FreshIndependentCopies':True,'priorFailedDbProfileBindingsNotReused':True}
disposition=put('root-capture-disposition.json',d)
template=Path('/tmp/ovf-feature63-static-prep-r3-zsttudqb/independent-launcher/launch-capture.r3.template.py');assert sha(template)=='1b99137e822c004361ee4ff1906f10f4284453312914092441666dd721f0feb3'
text=template.read_text().replace('feature63-human-wave-composition-r3','feature63-human-wave-composition-r5').replace("SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r3-')","SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r5-')")
mapping={'ROOT_RUNTIME_ANCHORS_FILLED=False':'ROOT_RUNTIME_ANCHORS_FILLED=True','CONTROL=None':f'CONTROL=Path({str(control)!r})','ASSIGNMENT=None':f'ASSIGNMENT=Path({assignment["path"]!r})','DIGEST=None':f'DIGEST={assignment["sha256"]!r}','DISPOSITION=None':f'DISPOSITION=Path({disposition["path"]!r})','DISPOSITION_SHA=None':f'DISPOSITION_SHA={disposition["sha256"]!r}','PIN=None':f'PIN={PIN!r}','SLOT_TOKEN=None':f'SLOT_TOKEN={slot["token"]!r}',"WRAPPER_SHA='f5b5428c531e99f15885cd48a513d4167aea02bab461f998a99719315d9ddc70'":f'WRAPPER_SHA={a["wrapperSha256"]!r}'}
for old,new in mapping.items():assert text.count(old)==1;text=text.replace(old,new)
p=OUT/'launch-capture.r5.py';p.write_text(text);p.chmod(0o600)
put('root-binding-readback.json',{'schema':1,'sourcePin':PIN,'r5StaticReview':desc(REVIEW),'captureAssignment':assignment,'launcher':desc(p),'launcherChanges':mapping,'freshControl':str(control),'completeOutputRecords':inv(OUT),'runtimeExecuted':False,'qualification':'Bindings authorize one capture; no feature qualification, native custody/extraction/audit or complete descendant enumeration is asserted.'})
assert not list(control.iterdir())
print(json.dumps({'rootOutput':str(OUT),'captureAssignment':assignment,'disposition':disposition,'launcher':desc(p),'control':str(control),'slot':slot,'sourcePin':PIN}))
