#!/usr/bin/env python3
"""Unexecuted preparation. The root authorizes one bounded run with an admitted pin/seal."""
from pathlib import Path
import argparse,subprocess,json,hashlib,datetime,os,signal,socket,time,shutil,traceback
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED=Path('/tmp/ovf-id6-integration-703fc-20261001')
TESTED=Path('/tmp/ovf-id6-composed-full-build-f7-r2-o0w9akew')
TESTED_PIN='f7f3e187ea40079492589a6fce39f0b33f77f04a'
TESTED_ID='9c5d2f1ff26bd6849b1ad5e311300669fb5f02feebbe4d311b6f8d670df243e1'
TESTED_MANIFEST_SHA='7439266f468c658d419b2c801b6a741a20b202aa8459169c96b47532640d3ec2'
NODE='/home/morgana/.local/bin/node'
CONFIGS=['package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','vitest.ladder.config.ts','vitest.ai.config.ts','vitest.ai-team.config.ts','vitest.ai-recovery.config.ts','index.html','editor.html','scenario-demo.html']
REQUIRED_HELPERS=['build-native-helpers.mjs','main-smoke-fixtures.ts','main-smoke-freeze.mjs','verify-main-smoke402.mjs','canonical-main-fixtures.ts','canonical-main-smoke.mjs','ruin-cover-fixtures.ts','ruin-cover-main-smoke.mjs','native-context.mjs','native-contract.mjs','native-audit.ts','main-smoke402-history-audit.ts','helper-provenance.mjs']
sha=lambda b:hashlib.sha256(b).hexdigest()
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def fp(p,base):
 assert p.is_file() and not p.is_symlink(),str(p)
 b=p.read_bytes();return {'path':str(p.relative_to(base)),'bytes':len(b),'sha256':sha(b),'mode':oct(p.stat().st_mode&0o777)}
def inventory(base,rels):return [fp(base/rel,base) for rel in sorted(rels)]
def full_files(base):return [fp(p,base) for p in sorted(base.rglob('*')) if p.is_file()]
def stat(pid):
 try:
  v=Path(f'/proc/{pid}/stat').read_text().rsplit(') ',1)[1].split()
  return {'pid':int(pid),'ppid':int(v[1]),'startTicks':int(v[19]),'state':v[0]}
 except FileNotFoundError:return None
def listeners(port):
 result=[]
 for table in ['tcp','tcp6']:
  for line in Path('/proc/net/'+table).read_text().splitlines()[1:]:
   v=line.split()
   if int(v[1].rsplit(':',1)[1],16)==port and v[3]=='0A':result.append({'table':table,'inode':v[9],'local':v[1]})
 return result
def holder(pid,rows):
 found=[];targets={f"socket:[{r['inode']}]" for r in rows}
 for fd in Path(f'/proc/{pid}/fd').iterdir():
  try:
   target=os.readlink(fd)
   if target in targets:found.append({'fd':fd.name,'target':target})
  except FileNotFoundError:pass
 return found
def protected_socket():
 identity=stat(1063);assert identity and identity['startTicks']==874,'Protected preview PID/start changed'
 rows=listeners(4173);assert rows,'Protected4173 LISTEN missing'
 owned=holder(1063,rows);assert owned,'Protected PID1063 no longer holds the4173 listener'
 assert all(any(f['target']==f"socket:[{r['inode']}]" for f in owned) for r in rows),'Another socket holder appeared on protected4173'
 return {'pid':1063,'startTicks':874,'port':4173,'listeners':rows,'matchingFds':owned}
def descendants(parent):
 data={}
 for p in Path('/proc').iterdir():
  if p.name.isdigit():
   s=stat(int(p.name))
   if s:data[s['pid']]=s
 result={};changed=True
 while changed:
  changed=False
  for pid,s in data.items():
   if pid not in result and (s['ppid']==parent or s['ppid'] in result):result[pid]=s;changed=True
 return result

def main():
 a=argparse.ArgumentParser()
 a.add_argument('--integration-pin',required=True)
 a.add_argument('--reviewed-source-seal',required=True)
 a.add_argument('--history-audit-review',required=True)
 a.add_argument('--playwright-module',required=True)
 a.add_argument('--chromium-executable',required=True)
 a.add_argument('--out',required=True)
 a.add_argument('--port',type=int,default=4187)
 args=a.parse_args();pin=args.integration_pin
 assert len(pin)==40 and all(c in '0123456789abcdef' for c in pin)
 assert args.port!=4173 and 1024<args.port<65536
 out=Path(args.out).resolve();assert str(out).startswith('/tmp/') and not out.exists()
 assert not str(out).startswith(str(OWNED)+'/') and not str(out).startswith(str(TESTED)+'/')
 out.mkdir();write=lambda n,v:(out/n).write_text(json.dumps(v,indent=2)+'\n')
 state={'startedAt':now(),'testedProductPin':TESTED_PIN,'integrationPin':pin,'testedBuildId':TESTED_ID,'phases':[],'status':'preflight','runtimeRetryCount':0,'browserExecuted':False,'buildExecuted':False,'artMode':'strict','previewPort':args.port,'fallbackExecuted':False}
 write('execution.json',state);children={};preview=None;primary=None;baseline=None;root_dist=None;product_before=None;helper_before=None;generated_before=None;dependency_before=None
 def remember(proc):
  identity=stat(proc.pid);assert identity;children[proc.pid]=identity
  return identity
 def observe_children(proc):
  for pid,identity in descendants(proc.pid).items():
   old=children.get(pid)
   if old:assert old['startTicks']==identity['startTicks'],'An owned child PID was reused'
   else:children[pid]=identity
 def send_exact(pid,start,sig):
  current=stat(pid)
  if not current or current['state']=='Z':return
  assert pid!=1063 and current['startTicks']==start,'Owned signal target identity changed'
  assert pid in children and children[pid]['startTicks']==start,'Signal target was not an owned child'
  # A pidfd binds the exact process; no group, name, port, service or broad kill is used.
  fd=os.pidfd_open(pid,0)
  try:
   after=stat(pid);assert after and after['startTicks']==start
   check=protected_socket() # Immediate protected holder/PID/start check before every signal.
   signal.pidfd_send_signal(fd,sig)
   state.setdefault('signals',[]).append({'at':now(),'pid':pid,'startTicks':start,'signal':int(sig),'protected4173':check});write('execution.json',state)
  finally:os.close(fd)
 def stop_owned(proc):
  if proc:observe_children(proc)
  live=[r for r in children.values() if (s:=stat(r['pid'])) and s['startTicks']==r['startTicks'] and s['state']!='Z']
  # Descendants first. The preview is stopped separately after the browser phase.
  for r in sorted(live,key=lambda r:r['pid'],reverse=True):send_exact(r['pid'],r['startTicks'],signal.SIGTERM)
  deadline=time.monotonic()+5
  while time.monotonic()<deadline and any((s:=stat(r['pid'])) and s['state']!='Z' and s['startTicks']==r['startTicks'] for r in live):time.sleep(.1)
  for r in live:send_exact(r['pid'],r['startTicks'],signal.SIGKILL)
  if proc:
   try:proc.wait(timeout=5)
   except subprocess.TimeoutExpired:raise RuntimeError('Exact owned child did not exit after bounded escalation')
 def git(base,*argv):return subprocess.check_output(['git',*argv],cwd=base)
 def phase(name,argv,bound,env):
  record={'name':name,'argv':argv,'cwd':str(OWNED),'boundSeconds':bound,'startedAt':now()};state['phases'].append(record);write('execution.json',state)
  with (out/(name+'.stdout.log')).open('wb') as stdout,(out/(name+'.stderr.log')).open('wb') as stderr:
   proc=subprocess.Popen(argv,cwd=OWNED,env=env,stdout=stdout,stderr=stderr);record['child']=remember(proc);write('execution.json',state);deadline=time.monotonic()+bound
   while proc.poll() is None:
    observe_children(proc)
    if time.monotonic()>=deadline:
     record.update(timedOut=True,finishedAt=now());write('execution.json',state);stop_owned(proc);raise RuntimeError(name+' timed out; no retry')
    time.sleep(.2)
   record.update(exitCode=proc.returncode,finishedAt=now());write('execution.json',state)
   if proc.returncode:raise RuntimeError(name+' failed exit '+str(proc.returncode)+'; no retry')
  return record
 def invariant(label):
  if product_before:
   assert inventory(ROOT,product_paths)==product_before and inventory(OWNED,product_paths)==product_before,'Tested product/config bytes changed'
  if helper_before:
   assert inventory(ROOT,helper_paths)==helper_before and inventory(OWNED,helper_paths)==helper_before,'Committed source/helper bytes changed'
  assert full_files(ROOT/'dist')==root_dist,'Protected root dist changed'
  assert full_files(OWNED/'dist')==tested_build_rows,'Owned tested build changed'
  assert protected_socket()==baseline,'Protected4173 listener identity changed'
  if generated_before:
   for r in generated_before:
    assert fp(OWNED/r['path'],OWNED)==r,'Preexisting owned generated byte changed'
  if dependency_before:
   for r in dependency_before:assert fp(OWNED/r['path'],OWNED)==r,'Owned dependency/runtime byte changed'
  write(label+'-readback.json',{'rootHead':git(ROOT,'rev-parse','HEAD').decode().strip(),'ownedHead':git(OWNED,'rev-parse','HEAD').decode().strip(),'rootProduct':inventory(ROOT,product_paths),'ownedProduct':inventory(OWNED,product_paths),'helpers':inventory(OWNED,helper_paths),'rootDist':full_files(ROOT/'dist'),'ownedDist':full_files(OWNED/'dist'),'protected4173':protected_socket(),'preexistingGeneratedExact':True,'ownedDependenciesExact':True})
 try:
  reviewed_path=Path(args.reviewed_source_seal).resolve();reviewed_bytes=reviewed_path.read_bytes();reviewed=json.loads(reviewed_bytes)
  assert reviewed['integrationPin']==pin and reviewed['runtimeAdmitted']==True
  review_path=Path(args.history_audit_review).resolve();review_bytes=review_path.read_bytes();history=json.loads(review_bytes)
  assert history['integrationPin']==pin and history['approved']==True and history['scope']=='main15 native event/history audit'
  write('root-admission-inputs.json',{'reviewedSourceSeal':{'path':str(reviewed_path),'sha256':sha(reviewed_bytes),'value':reviewed},'historyAuditReview':{'path':str(review_path),'sha256':sha(review_bytes),'value':history}})
  assert git(ROOT,'rev-parse','HEAD').decode().strip()==pin,'Root HEAD is the admitted committed pin'
  assert sha((TESTED/'run-artifact-manifest.json').read_bytes())==TESTED_MANIFEST_SHA
  assert json.loads((TESTED/'execution.json').read_text())['status']=='passed'
  expected=json.loads((TESTED/'expected-git-inputs.json').read_text())['files']
  product_paths=[r['path'] for r in expected if r['path'].startswith(('src/','public/')) or r['path'] in CONFIGS]
  expected_product=[{k:r[k] for k in ('path','bytes','sha256','mode')} for r in expected if r['path'] in product_paths]
  assert inventory(ROOT,product_paths)==expected_product and inventory(OWNED,product_paths)==expected_product
  product_before=expected_product;write('tested-product-before.json',product_before)
  build=json.loads((TESTED/'owned-build-outputs.json').read_text());assert build['expectedBuildId']==TESTED_ID
  tested_build_rows=[{**r,'path':r['path'][5:]} for r in build['files']]
  assert full_files(OWNED/'dist')==tested_build_rows
  assert TESTED_ID.encode() in (OWNED/'dist/assets/main-3vb5PXT5.js').read_bytes()
  baseline=protected_socket();root_dist=full_files(ROOT/'dist');assert len(root_dist)==397
  old_root=json.loads((TESTED/'protected-before.json').read_text())['files']
  assert root_dist==[{**r,'path':r['path'][5:]} for r in old_root]
  write('protected-before.json',{'socket':baseline,'dist':root_dist});write('owned-tested-build-before.json',tested_build_rows)
  modules=OWNED/'node_modules';assert modules.is_dir() and not modules.is_symlink()
  for p in modules.rglob('*'):
   if p.is_symlink():assert str(p.resolve()).startswith(str(modules.resolve())+'/'),'Dependency symlink leaves independent owned modules'
  dependency_before=[fp(p,OWNED) for p in sorted(modules.rglob('*')) if p.is_file() and not p.is_symlink()]
  write('owned-dependency-before.json',dependency_before)
  generated_before=[]
  for name in ['dist','dist-cli','dist-server','dist-tournament','work']:
   directory=OWNED/name
   if directory.exists():generated_before.extend(fp(p,OWNED) for p in sorted(directory.rglob('*')) if p.is_file())
  for r in generated_before:
   target=out/'preexisting-generated'/r['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(OWNED/r['path'],target);assert fp(target,out/'preexisting-generated')==r
  write('preexisting-generated-before.json',generated_before)
  assert listeners(args.port)==[],'Owned preview port is occupied'
  env=dict(os.environ);env.pop('ESBUILD_BINARY_PATH',None);env.pop('NODE_OPTIONS',None)
  env.update(OVF_ESBUILD_MODULE=(modules/'esbuild/lib/main.js').as_uri(),OVF_PLAYWRIGHT_MODULE=Path(args.playwright_module).resolve().as_uri(),OVF_CHROMIUM_EXECUTABLE=str(Path(args.chromium_executable).resolve()),TMPDIR=str(out/'temporary-output'),XDG_CACHE_HOME=str(out/'xdg-cache'))
  (out/'temporary-output').mkdir();guard=Path(__file__).with_name('protected-signal-guard.mjs');guard_bytes=guard.read_bytes();write('signal-guard-source.json',{'path':str(guard),'bytes':len(guard_bytes),'sha256':sha(guard_bytes)})
  write('external-browser-runtime.json',{'playwrightModule':fp(Path(args.playwright_module).resolve(),Path(args.playwright_module).resolve().parent),'chromium':fp(Path(args.chromium_executable).resolve(),Path(args.chromium_executable).resolve().parent)})
  # Import committed proof changes only; src/public/config/dist remain exact tested bytes.
  phase('fetch-admitted-script-pin',['git','fetch','--no-tags',str(ROOT),pin],30,env)
  phase('checkout-admitted-script-pin',['git','checkout','--detach','-f',pin],30,env)
  assert inventory(OWNED,product_paths)==product_before
  helper_paths=git(OWNED,'ls-tree','-r','--name-only',pin,'--','src','scripts/acceptance').decode().splitlines()
  assert all('scripts/acceptance/'+x in helper_paths for x in REQUIRED_HELPERS)
  helper_before=inventory(OWNED,helper_paths)
  assert inventory(ROOT,helper_paths)==helper_before
  reviewed_files={r['path']:r for r in reviewed['helpers']}
  for r in helper_before:
   if r['path'].startswith('scripts/acceptance/'):
    assert r['path'] in reviewed_files and all(r[k]==reviewed_files[r['path']][k] for k in ('bytes','sha256','mode')),'Helper is absent/different in reviewed committed seal'
  write('committed-source-helper-before.json',helper_before);invariant('preflight')
  bridge_source=Path(__file__).with_name('invoke-focused-history-audit.mjs');bridge_bytes=bridge_source.read_bytes();write('history-bridge-source.json',{'path':str(bridge_source),'bytes':len(bridge_bytes),'sha256':sha(bridge_bytes)})
  node=[NODE,'--import',str(guard)]
  helpers=out/'helpers';fixtures=out/'fixtures';freeze=out/'focused-freeze.json';browser_out=out/'browser'
  phase('build-focused-helpers',node+[str(OWNED/'scripts/acceptance/build-native-helpers.mjs'),str(OWNED),str(helpers),pin,'main-smoke'],90,env);invariant('helpers')
  phase('generate-fifteen-zero-tick-fixtures',node+[str(OWNED/'scripts/acceptance/main-smoke-freeze.mjs'),'--generate',str(OWNED),str(fixtures),pin,str(helpers/'fixtures.mjs')],90,env);invariant('fixtures')
  phase('seal-fifteen-focused-fixtures',node+[str(OWNED/'scripts/acceptance/verify-main-smoke402.mjs'),'--freeze',str(OWNED),str(fixtures),str(freeze),pin],90,env)
  frozen=json.loads(freeze.read_text());assert frozen['source']['expectedBuildId']==TESTED_ID
  assert len(json.loads((fixtures/'manifest.json').read_text())['scenarios'])==15
  fixture_before=full_files(fixtures);helper_outputs_before=full_files(helpers);write('frozen-fixture-before.json',fixture_before);write('built-helper-before.json',helper_outputs_before);invariant('freeze')
  preview_argv=node+[str(modules/'vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',str(args.port),'--strictPort']
  stdout=(out/'owned-preview.stdout.log').open('wb');stderr=(out/'owned-preview.stderr.log').open('wb')
  preview=subprocess.Popen(preview_argv,cwd=OWNED,env=env,stdout=stdout,stderr=stderr);preview_identity=remember(preview);state['ownedPreview']={'argv':preview_argv,**preview_identity};write('execution.json',state)
  deadline=time.monotonic()+20
  while time.monotonic()<deadline:
   assert preview.poll() is None,'Owned preview exited before readiness'
   rows=listeners(args.port)
   if rows and holder(preview.pid,rows):break
   time.sleep(.1)
  else:raise RuntimeError('Owned preview did not hold its distinct port within20seconds')
  state.update(status='browser running',browserExecuted=True);write('execution.json',state)
  base=f'http://127.0.0.1:{args.port}/index.html' # Strict art mode; no placeholder query/override.
  phase('main15-strict-art-browser',node+[str(OWNED/'scripts/acceptance/verify-main-smoke402.mjs'),base,str(OWNED),str(browser_out),str(fixtures),str(freeze),str(helpers/'audit.mjs'),'canonical,ruins'],900,env)
  receipt=json.loads((browser_out/'browser-main-smoke402.json').read_text());assert receipt['completed']==True and receipt['cleanup']['completed']==True
  assert receipt['groups']['canonical']['completed']==True and len(receipt['groups']['canonical']['caseNames'])==9
  assert len(receipt['groups']['ruins']['results'])==5 and 'capture' in receipt['groups']['ruins']
  assert full_files(fixtures)==fixture_before and full_files(helpers)==helper_outputs_before
  assert sha(reviewed_path.read_bytes())==sha(reviewed_bytes) and sha(review_path.read_bytes())==sha(review_bytes)
  assert guard.read_bytes()==guard_bytes and bridge_source.read_bytes()==bridge_bytes
  invariant('browser')
  # The separate focused event/history audit has no observeNative or implicit producer entry.
  history_bridge=Path(__file__).with_name('invoke-focused-history-audit.mjs')
  phase('focused-main15-history-audit',node+[str(history_bridge),str(OWNED),pin,str(helpers/'history.mjs'),str(browser_out),str(fixtures)],300,env)
  assert (browser_out/'main-smoke402-history-checks.json').is_file(),'No successful focused history audit receipt'
  assert full_files(fixtures)==fixture_before and full_files(helpers)==helper_outputs_before
  invariant('history-audit');state.update(status='data/history passed; visual review remains',completedAt=now(),caseCount=15,visualReviewRequired=True)
 except Exception as error:
  primary=error;state.update(status='failed; first failure retained; no runtime retry',failure={'message':str(error),'traceback':traceback.format_exc(),'at':now()})
 finally:
  cleanup=[]
  try:stop_owned(preview)
  except Exception as error:cleanup.append({'kind':'owned child cleanup','message':str(error),'traceback':traceback.format_exc()})
  try:
   if baseline and root_dist and helper_before:invariant('final')
   elif baseline:write('failure-protected-after.json',{'socket':protected_socket(),'dist':full_files(ROOT/'dist')})
  except Exception as error:cleanup.append({'kind':'final protected/source readback','message':str(error),'traceback':traceback.format_exc()})
  state['cleanupErrors']=cleanup;state['finishedAt']=now()
  if cleanup:state['status']='failed; cleanup/readback failure retained; no retry'
  write('execution.json',state)
  rows=[fp(p,out) for p in sorted(out.rglob('*')) if p.is_file()]
  write('run-artifact-manifest.json',{'sourcePin':pin,'testedProductPin':TESTED_PIN,'testedBuildId':TESTED_ID,'files':rows,'count':len(rows),'bytes':sum(r['bytes'] for r in rows),'manifestSelfExcluded':True,'status':state['status']})
 if primary or cleanup:raise SystemExit(1)
 print(json.dumps(state,indent=2))
if __name__=='__main__':main()
