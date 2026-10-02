from pathlib import Path
import datetime,hashlib,json,os,shutil,stat,subprocess
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX=OWNED/'work/feature63-human-wave-composition-r5'
B=Path('/tmp/ovf-root-feature63-r5-bindings-g55vxapa')
CONTROL=Path('/tmp/ovf-feature63-r5-capture-control-ucu87_19')
OP=Path('/tmp/ovf-feature63-r5-capture-execution-m_grll52')
CUSTODY=Path('/tmp/ovf-root-feature63-r5-failed-closure-custody-jelcr55p')
TARGET=ROOT/'docs/evidence/feature63-lifetime-monitor-failure-r5-025f-20261001'
PIN='025fc8750a737af4beb63dceea6ffbcb975e2893'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def desc(p):return {'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}
def inv(base):
 rows=[]
 for p in base.rglob('*'):
  assert not p.is_symlink(),p
  if p.is_dir():continue
  assert stat.S_ISREG(p.stat().st_mode)
  rows.append({'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':sha(p),'mode':stat.S_IMODE(p.stat().st_mode)})
 return sorted(rows,key=lambda r:r['path'])
def auth(base,rows,complete=False):
 for r in rows:
  p=base/r['path'];m=int(r['mode'],8) if isinstance(r['mode'],str) else r['mode']
  assert p.is_file() and not p.is_symlink() and p.stat().st_size==r['bytes'] and sha(p)==r['sha256'] and stat.S_IMODE(p.stat().st_mode)==m,p
 if complete:assert inv(base)==sorted([{**r,'mode':int(r['mode'],8) if isinstance(r['mode'],str) else r['mode']} for r in rows],key=lambda r:r['path'])
a=json.loads((B/'capture-assignment.json').read_text())
assert sha(B/'capture-assignment.json')=='f7b73ce52bba06a8f8e5bd8f0ab1439636a6d5569eb8c27ae30fd7ede5ae6e7c'
source=json.loads(Path(a['sourceBinding']['path']).read_text());build=json.loads(Path(a['buildBinding']['path']).read_text());browser=json.loads(Path(a['browserBinding']['path']).read_text())
product=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json').read_text());protected=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json').read_text())['dist']
for base in (ROOT,OWNED):
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=base,text=True).strip()==PIN
 assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=base,text=True)
 auth(base,source['records']);auth(base,product)
for base,rows in [(ROOT/'dist',protected),(PREFIX/'dist',build['webRecords']),(PREFIX/'server',build['serverRecords']),(Path(browser['dependencyRoot']),browser['dependencyRecords']),(Path(browser['chromiumDependencyRoot']),browser['chromiumDependencyRecords'])]:auth(base,rows,True)
assert [len(source['records']),len(product),len(protected),len(build['webRecords']),len(build['serverRecords']),len(browser['dependencyRecords']),len(browser['chromiumDependencyRecords'])]==[966,570,397,398,22,114,303]
for k in ['sourceBinding','buildBinding','testedBuildReceipt','reviewReceipt','browserBinding','publicProducer','collector','auditor','nodeExecutable','pythonExecutable']:assert desc(Path(a[k]['path']))==a[k]
release=OP/'slot-release.json';assert release.stat().st_size==2599 and sha(release)=='98f4b9026014b6e057dfc38ee057c1e4b57022713594afb3ca6ece8580e38133'
custody=json.loads((CUSTODY/'root-failure-disposition.json').read_text())
for path in ('originalPath','custodyPath'):
 p=Path(custody[path]);s=p.stat();assert (s.st_dev,s.st_ino,s.st_size,stat.S_IMODE(s.st_mode),s.st_nlink)==(52,42606865,118833152,0o444,2)
assert not TARGET.exists();TARGET.mkdir()
mapping=[]
for label,base in [('bindings',B),('control',CONTROL),('execution',OP),('lifecycle',PREFIX/'lifecycle'),('public',PREFIX/'public'),('native-collector',PREFIX/'native-collector'),('root-readback',CUSTODY)]:
 before=inv(base);shutil.copytree(base,TARGET/label,copy_function=shutil.copy2);assert inv(base)==inv(TARGET/label)==before
 mapping.append({'source':str(base),'retained':str(TARGET/label),'records':before})
(TARGET/'root-utilities').mkdir()
for name in ['failed-r5-closure-and-custody.py','retain-r5-failure.py']:
 p=Path(__file__).parent/name;shutil.copy2(p,TARGET/'root-utilities'/name);assert sha(p)==sha(TARGET/'root-utilities'/name)
record={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'R5_MATCH_REACHED_PUBLIC_CANDIDATE_MONITOR_FAILURE_PRESERVED','sourcePin':PIN,'captureInvocations':1,'automaticRetries':0,'original63Pending':True,'verifiedCount':99,'rootRegisteredLifetimeClosureAdmittedSeparatelyFromDriverCleanupFailure':True,'all25RegisteredResourcesHaveIndependentPidfdExitEvidence':True,'unobservedDescendantsExcluded':False,'rootCustody':custody,'slotReleaseReceipt':desc(release),'slotReleasedAfterRootClosure':True,'allSevenInventoriesAuthenticatedAfterRuntime':[966,570,397,398,22,114,303],'productChanged':False,'sqlQueryExtractionOrAudit':False,'publicSummaryRemainsJsonNull':True,'selectedPublicWindowIsCandidateOnly':True,'preservedTrees':mapping,'failedRawExternalHardlinkRetainedWithoutQuery':True,'requestedReviewerModelForR5Preparation':'unspecified','actualProviderIdentity':'unavailable','freshClaudeRun':False}
(TARGET/'root-retention.json').write_text(json.dumps(record,indent=2)+'\n')
with (ROOT/'docs/features/decisions.tsv').open('a') as f:
 f.write('\t'.join([record['at'],'feature63-r5-process-monitor-failure','Preserved failed capture with public fight candidate and independently admitted bounded closure','Public result and cleanup were interrupted when process snapshot was unavailable despite live PIDFD','docs/evidence/feature63-lifetime-monitor-failure-r5-025f-20261001/root-retention.json','One match; public candidate remains unqualified; wrapper25registered heldPIDFDexit; privateportsclear; seveninventories unchanged; raw0444hardlink; no SQL/extraction/audit; slotreleased;99/1'])+'\n')
print(json.dumps({'target':str(TARGET),'files':len(inv(TARGET)),'bytes':sum(r['bytes'] for r in inv(TARGET)),'status':record['status']}))
