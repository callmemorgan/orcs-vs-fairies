#!/usr/bin/env python3
"""Read-only authentication of retained suite inputs and AI case results."""
import hashlib,json,pathlib,subprocess,sys
owned=pathlib.Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
root=pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
out=pathlib.Path(__file__).resolve().parent
suite=root/'docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0'
suite_pin='4a71cd07bacc12d214acaf5a0f95a7d9b486f52c'
freeze='c86e273c70738f144a00fe75f5ecf39e7fa324d8'
ui_pin='c074cc5e610fc128d7b6ac894a61258d418463d4'
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(p.read_bytes())
def check(ok,msg):
 if not ok:raise RuntimeError(msg)
def git(*args):return subprocess.check_output(['git','-C',str(owned),*args])
def tree(ref):
 rows={}
 for line in git('ls-tree','-r','-z',ref).split(b'\0'):
  if line:
   meta,path=line.split(b'\t');mode,kind,blob=meta.decode().split();rows[path.decode()]={'mode':mode,'kind':kind,'gitBlob':blob}
 return rows
report=read(suite/'report.json');before=read(suite/'source-before.json');after=read(suite/'source-after.json');tests=read(suite/'tests.json')
check(report['head']==suite_pin and before['head']==suite_pin and after['head']==suite_pin,'suite pin')
check((suite/'source-before.json').read_bytes()==(suite/'source-after.json').read_bytes(),'suite inputs changed')
artifacts={}
for path,expected in report['artifactHashes'].items():
 data=(suite/path).read_bytes();actual=sha(data);check(actual==expected,'artifact hash '+path);artifacts[path]={'sha256':actual,'bytes':len(data)}
check(report['passed'] is True and report['inputIntegrityPassed'] is True,'suite failed')
check(report['commands'][0]['exitCode']==0,'suite command failed')
check(tests['success'] is True and tests['numTotalTests']==2920 and tests['numPassedTests']==2920 and tests['numFailedTests']==0,'test totals')
trees={ref:tree(ref) for ref in [suite_pin,freeze,ui_pin]}
blobs=sorted({v['gitBlob'] for v in before['files'].values()} | {trees[ui_pin][p]['gitBlob'] for p in before['files']})
data=subprocess.check_output(['git','-C',str(owned),'cat-file','--batch'],input=('\n'.join(blobs)+'\n').encode())
contents={};offset=0
for expected in blobs:
 end=data.index(b'\n',offset);header=data[offset:end].decode().split();offset=end+1
 check(len(header)==3 and header[0]==expected and header[1]=='blob','cat-file header')
 length=int(header[2]);contents[expected]=data[offset:offset+length];offset+=length;check(data[offset:offset+1]==b'\n','cat-file separator');offset+=1
check(offset==len(data),'cat-file trailing bytes')
rows=[];ui_changes=[]
for path,meta in sorted(before['files'].items()):
 for ref in [suite_pin,freeze]:
  item=trees[ref].get(path);check(item is not None and item['kind']=='blob','missing input '+path)
  check(item['gitBlob']==meta['gitBlob'] and item['mode']==meta['mode'],'pin identity '+path+' '+ref)
 content=contents[meta['gitBlob']];check(sha(content)==meta['sha256'] and len(content)==meta['bytes'],'pinned bytes '+path)
 live=owned/path;check(live.is_file() and not live.is_symlink(),'not regular owned input '+path)
 check(live.read_bytes()==content,'owned live byte mismatch '+path)
 check(('100755' if live.stat().st_mode&0o111 else '100644')==meta['mode'],'owned live mode '+path)
 current=trees[ui_pin][path];change=current['gitBlob']!=meta['gitBlob'] or current['mode']!=meta['mode']
 if change:ui_changes.append({'path':path,'before':meta,'after':{**current,'sha256':sha(contents[current['gitBlob']]),'bytes':len(contents[current['gitBlob']])}})
 rows.append({'path':path,**meta,'suitePinIdentity':True,'c86PinIdentity':True,'ownedLiveBytes':True,'ownedLiveMode':True,'c074SameIdentity':not change})
check(len(rows)==917,'input inventory count')
check([x['path'] for x in ui_changes]==['src/main.ts'],'unexpected c074 input changes')
selected=['ai-modes.test.ts','ai-policy.test.ts','ai-recovery.test.ts','ai-cost-recovery.test.ts','ai-saves.test.ts','skirmish-options.test.ts','team-ai-policy.test.ts','allied-ai.test.ts','team-match.test.ts','skirmish-roster.test.ts','server-teams.test.ts','server-allied.test.ts','ally-directives-ui.test.ts','team-ai-tools.test.ts','combat-tactics.test.ts']
focused=[]
for f in tests['testResults']:
 name=pathlib.Path(f['name']).name
 if name not in selected:continue
 cases=[{'fullName':a['fullName'],'status':a['status']} for a in f['assertionResults']]
 check(all(a['status']=='passed' for a in cases),'focused failed '+name)
 focused.append({'path':'tests/'+name,'actualSuitePath':f['name'],'cases':cases,'count':len(cases),'allPassed':True})
check(sorted(pathlib.Path(f['path']).name for f in focused)==sorted(selected),'focused files missing')
native_rel='work/ai-save401-final-c86e273-r1/native-audit-r3/native-audit.json'
native=read(owned/native_rel);check(native['sourcePin']==freeze and native['result']=='passed','native audit result')
check(native['actualReports']==108 and native['actualNativeSaves']==108 and len(native['records'])==108,'native audit totals')
check(all(r['exactNativeEnvelopeLoadResave'] is True for r in native['records']),'native equality')
expected_native='c37517373f6c098723ea41dfbcb3cd0fe48a4f0afbe2bbee4538812adfcb54ff'
check(sha((owned/native_rel).read_bytes())==expected_native,'native audit digest')
summary_rel='docs/evidence/six-factions-save401-ladder-c86e273-r1/summary.json'
summary=read(owned/summary_rel);check(sha((owned/summary_rel).read_bytes())==native['summarySha256'],'canonical summary digest')
check(summary['games']==108 and summary['completed']==108 and summary['timeouts']==0 and summary['draws']==0,'canonical matrix result')
requirement_file=root/'docs/features/requirements.json';requirements=read(requirement_file)
clauses=[x for x in requirements['features'] if 51<=x['id']<=58]
source_report={'suitePin':suite_pin,'runtimeFreeze':freeze,'uiProductPin':ui_pin,'suiteArtifacts':artifacts,'suiteReport':{'path':str(suite/'report.json'),'sha256':sha((suite/'report.json').read_bytes())},'selectedInputCount':len(rows),'allSuiteInputsMatchC86AndOwnedLive':True,'c074InputChanges':ui_changes,'focusedFileCount':len(focused),'focusedPassedCases':sum(f['count'] for f in focused),'nativeAudit':{'path':str(owned/native_rel),'sha256':expected_native,'loadedResaved':108,'advancedTerminalTicks':0,'fullMatchReplayPlayback':False},'canonicalSummary':{'path':str(owned/summary_rel),'sha256':native['summarySha256'],'counts':{k:summary[k] for k in ['games','completed','draws','timeouts','invalidEconomy','invalidPosition','movementStallEpisodes','gamesWithMovementStalls']}},'originalRequirements':{'path':str(requirement_file),'sha256':sha(requirement_file.read_bytes()),'rootHeadAtRead':subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD']).decode().strip(),'clauses':clauses},'scope':'Read-only artifact authentication and source-equivalence comparison; no new tests, gameplay, builds, servers, or browsers executed. 917 selected inputs are authenticated, not all host/transitive dependencies.'}
for name,payload in [('input-bridge.json',{'rows':rows}),('passed-case-extract.json',{'suitePin':suite_pin,'testsJsonSha256':artifacts['tests.json']['sha256'],'files':focused}),('authentication.json',source_report)]:
 (out/name).write_text(json.dumps(payload,indent=2)+'\n')
print(json.dumps({'result':'passed','inputs':len(rows),'focusedFiles':len(focused),'focusedCases':sum(f['count'] for f in focused),'counts':{f['path']:f['count'] for f in focused},'c074Changes':[x['path'] for x in ui_changes],'outputs':[str(out/name) for name in ['authentication.json','input-bridge.json','passed-case-extract.json']]},indent=2))
