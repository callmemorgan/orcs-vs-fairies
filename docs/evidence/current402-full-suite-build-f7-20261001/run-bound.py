from pathlib import Path
import subprocess,json,hashlib,datetime,os,shutil,sys,traceback
owned=Path('/tmp/ovf-id6-integration-703fc-20261001'); root=Path('/home/morgana/Projects/orcs-vs-Fairies'); out=Path('/tmp/ovf-id6-composed-full-build-f7-r2-o0w9akew'); pin='f7f3e187ea40079492589a6fce39f0b33f77f04a'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda b:hashlib.sha256(b).hexdigest()
def write(name,value): (out/name).write_text(json.dumps(value,indent=2)+'\n')
def git(args):return subprocess.check_output(['git',*args],cwd=owned)
def fingerprint(p,prefix):
 assert p.is_file() and not p.is_symlink(),('Source must be regular',str(p));b=p.read_bytes();return {'path':str(p.relative_to(prefix)),'bytes':len(b),'sha256':sha(b),'mode':oct(p.stat().st_mode&0o777)}
configs=['package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','vitest.ladder.config.ts','vitest.ai.config.ts','vitest.ai-team.config.ts','vitest.ai-recovery.config.ts','index.html','editor.html','scenario-demo.html']
external_fixtures=['docs/evidence/controls-final-af44da4-20261001/gamepad/gamepad-native-session.json','docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json','docs/evidence/content-root-integration-20261001/browser-save.json','docs/evidence/specialists-20261001/browser-save.json','docs/evidence/world-combined-20261001/world-browser-save.json','docs/evidence/native-combat-f18a50d-first-failure-20261001/raw/browser/cover-none-first-hit-save.json','docs/evidence/rules-3.1-replay-20261001/replay.json']
scopes=['src','tests','scripts','public',*configs,*external_fixtures]
expected={}
def committed_inventory():
 rows=subprocess.check_output(['git','ls-tree','-r','-z',pin,'--',*scopes],cwd=root).split(b'\0')
 result={}
 for row in rows:
  if not row:continue
  meta,rel=row.split(b'\t',1);mode,kind,blob=meta.split();rel=rel.decode()
  assert kind==b'blob' and mode in [b'100644',b'100755'],('Unsupported Git input',rel,meta)
  data=subprocess.check_output(['git','cat-file','blob',blob.decode()],cwd=root)
  result[rel]={'path':rel,'bytes':len(data),'sha256':sha(data),'mode':'0o755' if mode==b'100755' else '0o644','gitBlob':blob.decode()}
 assert all(p in result for p in configs+external_fixtures),'Missing declared config or immutable fixture'
 return result

def files(base):
 return [fingerprint(base/rel,base) for rel in sorted(expected)]

def validate_input_binding(base,rows):
 index_paths=set(subprocess.check_output(['git','ls-files','-z','--',*scopes],cwd=base).decode().rstrip('\0').split('\0'))
 assert index_paths==set(expected),('Disk tracked path set differs from frozen Git set',str(base),sorted(index_paths-set(expected)),sorted(set(expected)-index_paths))
 disk={r['path']:r for r in rows}
 assert set(disk)==set(expected),('Disk inventory path set differs from committed input paths',str(base))
 for rel,r in expected.items():
  assert disk[rel]=={k:v for k,v in r.items() if k!='gitBlob'},('Input differs from frozen Git blob',str(base),rel)

def excluded_generated_inputs(base):
 disk_paths={str(p.relative_to(base)) for directory in ['src','tests','scripts','public'] for p in (base/directory).rglob('*') if p.is_file()}
 extras=sorted(disk_paths-set(expected))
 result=[]
 for rel in extras:
  assert '/__pycache__/' in rel and rel.endswith('.pyc'),('Undeclared possible runtime input',str(base),rel)
  row=fingerprint(base/rel,base)
  row.update(reason='Generated CPython bytecode; absent from frozen Git inputs and not read by the authorized Node/Vitest/Vite test/build commands.',committedInput=False,executedInput=False,preservedWithoutDeletion=True)
  result.append(row)
 return result
def protected():
 data=Path('/proc/1063/stat').read_text().split(') ',1)[1].split();assert int(data[19])==874
 paths=sorted(p for p in (root/'dist').rglob('*') if p.is_file());assert len(paths)==397
 listen=any(line.split()[1].endswith(':104D') and line.split()[3]=='0A' for n in ['tcp','tcp6'] for line in Path('/proc/net/'+n).read_text().splitlines()[1:]);assert listen
 return {'pid':1063,'startTicks':874,'port4173Listening':listen,'files':[fingerprint(p,root) for p in paths]}
state={'startedAt':now(),'authorizedSourceCommit':pin,'ownedCheckout':str(owned),'rootCheckout':str(root),'phases':[],'status':'running','retryCount':0,'attempt':'r2 fresh preflight after r1 inventory selection failure','priorAttemptDirectory':'/tmp/ovf-id6-composed-full-build-f7-r1-w7q_z1jo','runtimeRetryCount':0,'buildExecuted':False,'browserExecuted':False,'serverLaunchedByWrapper':False}
write('execution.json',state)
def phase(label,argv,env=None):
 item={'label':label,'argv':argv,'cwd':str(owned),'startedAt':now()};state['phases'].append(item);write('execution.json',state)
 print('START '+label,flush=True)
 with (out/(label+'.stdout.log')).open('wb') as stdout,(out/(label+'.stderr.log')).open('wb') as stderr:r=subprocess.run(argv,cwd=owned,env=env,stdout=stdout,stderr=stderr)
 item.update(exitCode=r.returncode,completedAt=now());write('execution.json',state);print('END '+label+' exit='+str(r.returncode),flush=True)
 if r.returncode:raise RuntimeError(label+' failed exit '+str(r.returncode))
 return item
try:
 expected=committed_inventory();write('expected-git-inputs.json',{'sourcePin':pin,'selection':'Committed Git paths under src/tests/scripts/public, 12 declared root configs/HTML entry points, and seven declared immutable historical evidence fixtures. Generated work and caches are not inputs.','files':[expected[p] for p in sorted(expected)],'count':len(expected),'externalFixtures':external_fixtures})
 first=Path('/tmp/ovf-id6-composed-full-build-f7-r1-w7q_z1jo');first_originals=[fingerprint(p,first) for p in sorted(first.rglob('*')) if p.is_file()];write('r1-originals-readback.json',{'directory':str(first),'files':first_originals,'count':len(first_originals),'execution':json.loads((first/'execution.json').read_bytes()),'protectedBeforeAfterIdentical':json.loads((first/'protected-before.json').read_bytes())==json.loads((first/'failure-protected-after.json').read_bytes()),'rootBeforeAfterIdentical':json.loads((first/'root-inputs-before.json').read_bytes())==json.loads((first/'failure-root-inputs-after.json').read_bytes()),'ownedBeforeAfterIdentical':json.loads((first/'owned-inputs-before.json').read_bytes())==json.loads((first/'failure-owned-inputs-after.json').read_bytes())})
 assert json.loads((first/'execution.json').read_bytes())['buildExecuted']==False and [p['label'] for p in json.loads((first/'execution.json').read_bytes())['phases']]==['owned-fetch','owned-checkout']
 exclusions_before={'root':excluded_generated_inputs(root),'owned':excluded_generated_inputs(owned)};write('excluded-generated-inputs-before.json',exclusions_before)
 old=files(owned);write('previous-owned-dirty-inputs.json',old)
 (out/'previous-owned-dirty.patch').write_bytes(git(['diff','--binary','HEAD','--','src','tests','scripts','public']))
 (out/'previous-owned-status.txt').write_bytes(git(['status','--porcelain=v1']))
 retained=root/'docs/evidence/ruin-cover402-integration-20261001/focused/run-artifact-manifest.json';original=Path('/tmp/ovf-id6-focused-703fc-r1-z2xr05w6/run-artifact-manifest.json');assert retained.read_bytes()==original.read_bytes()
 seal=json.loads(original.read_bytes())
 for row in seal['files']:
  source=Path(row['absolutePath']);dest=root/'docs/evidence/ruin-cover402-integration-20261001/focused'/row['path'];b=source.read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'];assert dest.read_bytes()==b
 write('prior-original-seal-readback.json',{'manifestSha256':sha(original.read_bytes()),'originalFilesVerified':len(seal['files']),'originalBytesVerified':sum(r['bytes'] for r in seal['files']),'rootRetainedAllExact':True})
 protected_before=protected();write('protected-before.json',protected_before)
 root_before=files(root);write('root-inputs-before.json',root_before);validate_input_binding(root,root_before)
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==pin
 assert subprocess.check_output(['git','status','--porcelain=v1','--','src','tests','scripts','public'],cwd=root)==b''
 phase('owned-fetch',['git','fetch','--no-tags',str(root),pin])
 phase('owned-checkout',['git','checkout','--detach','-f',pin])
 assert git(['rev-parse','HEAD']).decode().strip()==pin
 hydrated=[]
 paths=git(['ls-tree','-r','--name-only',pin,'--','tests/fixtures']).decode().splitlines()+['docs/evidence/controls-final-af44da4-20261001/gamepad/gamepad-native-session.json','docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json','docs/evidence/content-root-integration-20261001/browser-save.json','docs/evidence/specialists-20261001/browser-save.json','docs/evidence/world-combined-20261001/world-browser-save.json','docs/evidence/native-combat-f18a50d-first-failure-20261001/raw/browser/cover-none-first-hit-save.json','docs/evidence/rules-3.1-replay-20261001/replay.json']
 for rel in paths:
  b=git(['show',pin+':'+rel]);p=owned/rel;before=p.read_bytes() if p.exists() else None;p.parent.mkdir(parents=True,exist_ok=True)
  if before!=b:p.write_bytes(b)
  assert p.read_bytes()==b;hydrated.append({'path':rel,'bytes':len(b),'sha256':sha(b),'gitBlob':git(['rev-parse',pin+':'+rel]).decode().strip(),'unchangedExistingBytes':before==b})
 write('historical-hydration.json',{'sourcePin':pin,'requiredDocs':7,'files':hydrated})
 owned_before=files(owned);write('owned-inputs-before.json',owned_before);validate_input_binding(owned,owned_before);assert owned_before==root_before,'Owned executed input inventory differs from root frozen source'
 assert git(['status','--porcelain=v1','--','src','tests','scripts','public'])==b''
 root_seal=json.loads((root/'docs/evidence/ruin-cover402-integration-20261001/root-integration-source.json').read_bytes())
 for row in root_seal['changedPaths']:
  b=(owned/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
 git_rows=git(['ls-tree','-r','-z',pin,'--','src','tests','scripts','public','package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','vitest.ladder.config.ts','index.html','editor.html','scenario-demo.html']).split(b'\0');by_path={r['path']:r for r in owned_before}
 for row in git_rows:
  if not row:continue
  meta,rel=row.split(b'\t',1);mode,kind,blob=meta.split();rel=rel.decode();assert kind==b'blob' and mode in [b'100644',b'100755'];b=git(['cat-file','blob',blob.decode()]);assert (owned/rel).read_bytes()==b;assert by_path[rel]['mode']==('0o755' if mode==b'100755' else '0o644')
 modules=(owned/'node_modules').resolve();assert str(modules).startswith(str(owned)+'/')
 for p in modules.rglob('*'):
  if p.is_symlink():assert str(p.resolve()).startswith(str(modules)+'/'),('Dependency escapes own checkout',str(p))
 cache=owned/'node_modules/.vite'
 if cache.exists():shutil.rmtree(cache)
 tools={}
 for name,path in [('node','/home/morgana/.local/bin/node'),('npm','/home/morgana/.local/bin/npm')]:
  phase(name+'-version',[path,'--version']);tools[name]={'path':path,'realPath':os.path.realpath(path),'version':(out/(name+'-version.stdout.log')).read_text().strip()}
 for name in ['vitest','vite','typescript','esbuild']:tools[name]={'version':json.loads((modules/name/'package.json').read_text())['version']}
 write('tools.json',tools)
 digest=hashlib.sha256()
 for p in sorted(p for p in (owned/'src').rglob('*') if p.is_file() and p.suffix in ['.ts','.css']):digest.update(str(p.relative_to(owned/'src')).encode());digest.update(p.read_bytes())
 build_id=digest.hexdigest();write('source-binding.json',{'sourcePin':pin,'rootAndOwnedInventoryEqual':True,'rootChangedPathsValidated':len(root_seal['changedPaths']),'executedInputs':len(owned_before),'committedInputSelection':True,'immutableHistoricalEvidenceFixtures':7,'generatedCPythonCacheExcludedAndPreserved':True,'firstAttemptOriginalCount':len(first_originals),'inputInventorySha256':sha((out/'owned-inputs-before.json').read_bytes()),'saveVersion':4,'simulationRevision':'4.0.2','expectedBuildId':build_id,'priorCandidatePreserved':True})
 env=dict(os.environ,npm_config_cache=str(out/'npm-cache'),XDG_CACHE_HOME=str(out/'xdg-cache'),TMPDIR=str(out/'temporary-output'),RUIN_COVER_PROOF_DIR=str(out/'full-suite-ruin-core'),NEUTRAL_PROOF_OUTPUT=str(out/'full-suite-neutral-core.json'));(out/'temporary-output').mkdir()
 def invariant(label):
  own=files(owned);other=files(root);write(label+'-owned-inputs-after.json',own);write(label+'-root-inputs-after.json',other);assert own==owned_before and other==root_before,'Source changed during '+label;validate_input_binding(owned,own);validate_input_binding(root,other)
  exclusions={'root':excluded_generated_inputs(root),'owned':excluded_generated_inputs(owned)};write(label+'-excluded-generated-inputs-after.json',exclusions);assert exclusions==exclusions_before,'Excluded generated cache changed during '+label
  first_after=[fingerprint(p,first) for p in sorted(first.rglob('*')) if p.is_file()];write(label+'-r1-originals-after.json',first_after);assert first_after==first_originals,'Preserved r1 originals changed during '+label
  protect=protected();write(label+'-protected-after.json',protect);assert protect==protected_before,'Protected preview or dist changed during '+label
 def reporter(name,expected=None):
  r=json.loads((out/name).read_bytes());assert r['success'] and r['numFailedTests']==0
  if expected is not None:assert r['numTotalTests']==r['numPassedTests']==expected and r['numPendingTests']==0 and all(a['status']=='passed' for t in r['testResults'] for a in t['assertionResults'])
  return {'files':len(r['testResults']),'tests':r['numTotalTests'],'passed':r['numPassedTests'],'failed':r['numFailedTests'],'pending':r['numPendingTests'],'describeSuites':r['numTotalTestSuites'],'success':r['success']}
 phase('composed',['timeout','--signal=TERM','--kill-after=5s','90s','/home/morgana/.local/bin/npm','test','--','tests/faction-original-clause-composition.test.ts','tests/faction-fairy-supplemental-witness.test.ts','--maxWorkers=1','--testTimeout=15000','--reporter=default','--reporter=json','--outputFile='+str(out/'composed-tests.json')],env)
 state['composed']=reporter('composed-tests.json',4);invariant('composed');write('execution.json',state)
 phase('full-suite',['timeout','--signal=TERM','--kill-after=10s','1800s','/home/morgana/.local/bin/npm','test','--','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+str(out/'full-tests.json')],env)
 state['fullSuite']=reporter('full-tests.json');invariant('full-suite');write('execution.json',state)
 state['buildExecuted']=True;write('execution.json',state)
 phase('build',['timeout','--signal=TERM','--kill-after=10s','300s','/home/morgana/.local/bin/npm','run','build'],env)
 invariant('build')
 dist_files=sorted(p for p in (owned/'dist').rglob('*') if p.is_file());assert (owned/'dist/index.html').is_file()
 outputs=[fingerprint(p,owned) for p in dist_files];write('owned-build-outputs.json',{'sourcePin':pin,'expectedBuildId':build_id,'files':outputs,'count':len(outputs),'bytes':sum(r['bytes'] for r in outputs),'embeddedBuildIdPaths':[str(p.relative_to(owned)) for p in dist_files if p.suffix=='.js' and build_id.encode() in p.read_bytes()]})
 assert any(p.suffix=='.js' and build_id.encode() in p.read_bytes() for p in dist_files),'Expected source build identity absent from built JS'
 state.update(status='passed',finishedAt=now(),sourceUnchanged=True,protectedPreviewAndDistUnchanged=True,buildId=build_id,ownedBuildOutputFiles=len(outputs));write('execution.json',state);print(json.dumps(state,indent=2),flush=True)
except Exception as error:
 state.update(status='failed; stopped with no retry or fixes',finishedAt=now(),failure={'message':str(error),'traceback':traceback.format_exc()});write('execution.json',state)
 try:write('failure-owned-inputs-after.json',files(owned));write('failure-root-inputs-after.json',files(root));write('failure-protected-after.json',protected())
 except Exception as secondary:state['failure']['readbackError']=str(secondary);write('execution.json',state)
 print(json.dumps(state,indent=2),flush=True);sys.exit(1)
