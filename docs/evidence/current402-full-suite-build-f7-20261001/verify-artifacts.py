from pathlib import Path
import json,hashlib,datetime,subprocess,os,shutil
out=Path('/tmp/ovf-id6-composed-full-build-f7-r2-o0w9akew')
owned=Path('/tmp/ovf-id6-integration-703fc-20261001')
root=Path('/home/morgana/Projects/orcs-vs-Fairies')
pin='f7f3e187ea40079492589a6fce39f0b33f77f04a'
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(name):return json.loads((out/name).read_bytes())
def row(path,base):
 assert path.is_file() and not path.is_symlink(),str(path)
 b=path.read_bytes();return {'path':str(path.relative_to(base)),'bytes':len(b),'sha256':sha(b),'mode':oct(path.stat().st_mode&0o777)}
def check_rows(base,rows):
 for r in rows:assert row(base/r['path'],base)=={k:r[k] for k in ('path','bytes','sha256','mode')},(str(base),r['path'])
state=read('execution.json');assert state['status']=='passed',state
assert state['authorizedSourceCommit']==pin and state['retryCount']==0 and state['runtimeRetryCount']==0
assert state['browserExecuted']==False and state['serverLaunchedByWrapper']==False
expected=read('expected-git-inputs.json');assert expected['count']==956 and len(expected['externalFixtures'])==7
check_rows(root,expected['files']);check_rows(owned,expected['files'])
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=owned,text=True).strip()==pin
checks={}
for name in ('composed','full-suite','build'):
 for base,key in ((root,'root'),(owned,'owned')):
  assert read(name+'-'+key+'-inputs-after.json')==read(key+'-inputs-before.json')
 assert read(name+'-protected-after.json')==read('protected-before.json')
 assert read(name+'-excluded-generated-inputs-after.json')==read('excluded-generated-inputs-before.json')
 assert read(name+'-r1-originals-after.json')==read('r1-originals-readback.json')['files']
checks['inputInvariantPhases']=['composed','full-suite','build']
for key,base in (('root',root),('owned',owned)):
 for r in read('excluded-generated-inputs-before.json')[key]:check_rows(base,[r])
first=read('r1-originals-readback.json');check_rows(Path(first['directory']),first['files']);assert first['count']==18
protected=read('protected-before.json');check_rows(root,protected['files']);assert len(protected['files'])==397
assert protected==json.loads((Path(first['directory'])/'failure-protected-after.json').read_bytes())
prior_manifest_path=Path('/tmp/ovf-id6-focused-703fc-r1-z2xr05w6/run-artifact-manifest.json')
prior_manifest_bytes=prior_manifest_path.read_bytes();prior_manifest=json.loads(prior_manifest_bytes)
prior_root=root/'docs/evidence/ruin-cover402-integration-20261001/focused'
assert (prior_root/'run-artifact-manifest.json').read_bytes()==prior_manifest_bytes
for r in prior_manifest['files']:
 b=Path(r['absolutePath']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'];assert (prior_root/r['path']).read_bytes()==b
assert len(prior_manifest['files'])==31
stat=Path('/proc/1063/stat').read_text().split(') ',1)[1].split();assert int(stat[19])==874
assert any(line.split()[1].endswith(':104D') and line.split()[3]=='0A' for n in ['tcp','tcp6'] for line in Path('/proc/net/'+n).read_text().splitlines()[1:])
reports={}
for name in ('composed-tests.json','full-tests.json'):
 r=read(name);assert r['success'] and r['numFailedTests']==0
 assertions=[a for t in r['testResults'] for a in t['assertionResults']]
 assert all(a['status'] in ('passed','pending','skipped') for a in assertions)
 reports[name]={'files':len(r['testResults']),'tests':r['numTotalTests'],'passed':r['numPassedTests'],'failed':r['numFailedTests'],'pending':r['numPendingTests'],'assertionCount':len(assertions)}
assert reports['composed-tests.json']['passed']==4 and reports['composed-tests.json']['pending']==0
assert reports['full-tests.json']['files']==160
ruin_file=[r for r in read('full-tests.json')['testResults'] if r['name'].endswith('/tests/ruin-cover.test.ts')];assert len(ruin_file)==1 and len(ruin_file[0]['assertionResults'])==17 and all(a['status']=='passed' for a in ruin_file[0]['assertionResults'])
observations=read('full-suite-ruin-core/observations.json');assert observations['simulationRevision']=='4.0.2';v=observations['observations']
for name in ['covered','near-victim-inside','ruin-only','ruin-building','two-ruins','two-ruins-building','reverse-covered','site-order-012','site-order-210']:assert v[name]['loss']==6.75
for name in ['uncovered','off-lane','other-level','behind-shooter','too-far-from-victim','at-victim','beyond-victim','too-close-to-shooter','near-victim-outside','reverse-control']:assert v[name]['loss']==12
for name,r in v.items():
 if 'loss' in r:
  assert abs(r['hpBefore']-r['hpAfter']-r['loss'])<1e-9 and abs(sum(a['amount'] for a in r['attacks'])-r['loss'])<1e-9,name
assert v['capture']['owner']==0 and v['capture']['checkpointTick']==80 and v['capture']['identicalResumedTicks']==125 and v['capture']['tick']==205
assert v['continuation']['finalTick']==40 and v['continuation']['finalChecksum']=='ff6620c2'
build=read('owned-build-outputs.json');check_rows(owned,build['files']);binding=read('source-binding.json');assert build['expectedBuildId']==binding['expectedBuildId']==state['buildId']
actual=[str(p.relative_to(owned)) for p in sorted((owned/'dist').rglob('*')) if p.is_file()];assert actual==[r['path'] for r in build['files']]
assert build['embeddedBuildIdPaths'] and all(state['buildId'].encode() in (owned/path).read_bytes() for path in build['embeddedBuildIdPaths'])
factions=['orcs','fairies','dwarves','undead','tideborn','automata'];pairings=[]
generated=owned/'work/three-ages/regression-matches';retention=out/'skirmish-generated-work';retention.mkdir(exist_ok=True)
for source in sorted(generated.glob('*.json')):
 b=source.read_bytes();dest=retention/source.name
 if dest.exists():assert dest.read_bytes()==b
 else:dest.write_bytes(b)
 assert dest.read_bytes()==b
for a in factions:
 for b in factions:
  p=retention/(a+'-'+b+'.json');r=json.loads(p.read_bytes())
  assert r['faction']==a and r['opponent']==b and r['seed']==4127
  assert all(n>5 for n in r['trained']) and all(n>10 for n in r['deposited']) and all(n>10 for n in r['attacks'])
  assert all('barracks' in n and 'depot' in n for n in r['built'])
  assert r.get('winner') in (0,1) or r.get('draw')==True
  pairings.append({'faction':a,'opponent':b,'seconds':r['seconds'],'winner':r.get('winner'),'draw':r.get('draw'),'trained':r['trained'],'deposited':r['deposited'],'attacks':r['attacks'],'sha256':sha(p.read_bytes())})
assert len(pairings)==36
assert not list(retention.glob('*-unfinished.json')),'Unfinished pairing report requires diagnosis; no retry'
receipt={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePin':pin,'status':'passed direct artifact readback','testReports':reports,'ruinCases':17,'ruinDamage':{'uncovered':12,'covered':6.75,'twoRuinsPlusBuilding':6.75},'captureCheckpointTick':80,'captureResumedTicks':125,'captureFinalTick':205,'continuationFinalTick':40,'continuationChecksum':'ff6620c2','committedInputPaths':956,'declaredHistoricalFixtures':7,'rootAndOwnedDiskInputsExact':True,'firstAttemptOriginalsPreserved':18,'priorFocusedOriginalsReverified':31,'rootPycExcludedWithoutDeletion':read('excluded-generated-inputs-before.json')['root'],'protectedPreview':{'pid':1063,'startTicks':874,'port':4173,'distFiles':397,'exactBytesPreserved':True},'buildId':state['buildId'],'buildOutputFiles':build['count'],'buildOutputBytes':build['bytes'],'buildIdFoundInActualBuiltJs':build['embeddedBuildIdPaths'],'generatedSkirmishReportCopies':36,'skirmishPairings':pairings,'browserAcceptance':'pending; this run executed no browser acceptance','sourceEditsMadeByReview':False,**checks}
(out/'direct-artifact-readback.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ('skirmishPairings','rootPycExcludedWithoutDeletion')},indent=2))
