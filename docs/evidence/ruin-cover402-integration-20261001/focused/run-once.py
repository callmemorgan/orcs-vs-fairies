from pathlib import Path
import subprocess,json,hashlib,datetime,os,shutil,sys,traceback
root=Path('/tmp/ovf-id6-integration-703fc-20261001'); protected=Path('/home/morgana/Projects/orcs-vs-Fairies'); out=Path('/tmp/ovf-id6-focused-703fc-r1-z2xr05w6')
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def write(name,value): (out/name).write_text(json.dumps(value,indent=2)+'\n')
def inventory(paths):
 rows=[]
 for p in sorted(paths):
  b=p.read_bytes();rows.append({'path':str(p),'bytes':len(b),'sha256':sha(b),'mode':oct(p.stat().st_mode&0o777)})
 return rows
def source_inventory():
 paths=[]
 for d in ['src','tests','scripts']:
  paths += [p for p in (root/d).rglob('*') if p.is_file()]
 paths += [root/p for p in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','index.html','editor.html']]
 return inventory(paths)
def protected_state():
 stat=(Path('/proc/1063/stat').read_text()).split(') ',1)[1].split();start=int(stat[19]);assert start==874,('protected process startTicks',start)
 files=[p for p in (protected/'dist').rglob('*') if p.is_file()];assert len(files)==397,('protected dist file count',len(files))
 listening=any(line.split()[1].endswith(':104D') and line.split()[3]=='0A' for n in ['tcp','tcp6'] for line in Path('/proc/net/'+n).read_text().splitlines()[1:]);assert listening,'protected4173 is not listening'
 return {'pid':1063,'startTicks':start,'port4173Listening':listening,'dist':inventory(files)}
state={'startedAt':now(),'testsExecuted':False,'dependencyCommand':['cp','-a','--reflink=auto',str(protected/'node_modules'),str(root/'node_modules')],'testCommand':['/home/morgana/.local/bin/npm','test','--','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+str(out/'focused-tests.json'),'tests/ruin-cover.test.ts','tests/combat-tactics.test.ts','tests/neutral-world-integration.test.ts','tests/save4-rule-revision.test.ts','tests/save4-corpus.test.ts','tests/scenario-recording-compatibility.test.ts','tests/scenario-save4-wrapper-migration.test.ts','tests/session-scenario-profile.test.ts']}
try:
 before_protected=protected_state();write('protected-before.json',before_protected)
 assert not (root/'node_modules').exists(),'owned dependencies must be fresh'
 with (out/'dependencies.stdout.log').open('wb') as stdout,(out/'dependencies.stderr.log').open('wb') as stderr:
  dependency=subprocess.run(state['dependencyCommand'],cwd=root,stdout=stdout,stderr=stderr)
 state['dependencyExitCode']=dependency.returncode;assert dependency.returncode==0,'dependency copy failed'
 owned_modules=(root/'node_modules').resolve();assert str(owned_modules).startswith(str(root)+'/')
 links=[]
 for p in (root/'node_modules').rglob('*'):
  if p.is_symlink():
   target=p.resolve();assert str(target).startswith(str(owned_modules)+'/'),('dependency link escapes owned directory',str(p),str(target));links.append({'path':str(p.relative_to(root)),'target':str(target)})
 copied_cache=root/'node_modules/.vite'
 if copied_cache.exists(): shutil.rmtree(copied_cache)
 write('dependencies.json',{'command':state['dependencyCommand'],'exitCode':dependency.returncode,'links':links,'removedOnlyOwnedCopiedCache':str(copied_cache),'nodeRealPath':os.path.realpath('/home/morgana/.local/bin/node'),'npmRealPath':os.path.realpath('/home/morgana/.local/bin/npm'),'packageLock':inventory([root/'package-lock.json'])})
 historical=list(subprocess.check_output(['git','ls-tree','-r','--name-only','703fc036c6327a830a79d5746eec805188cbbaa6','--','tests/fixtures'],cwd=root,text=True).splitlines())
 historical += ['docs/evidence/controls-final-af44da4-20261001/gamepad/gamepad-native-session.json','docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json','docs/evidence/content-root-integration-20261001/browser-save.json','docs/evidence/specialists-20261001/browser-save.json','docs/evidence/world-combined-20261001/world-browser-save.json','docs/evidence/native-combat-f18a50d-first-failure-20261001/raw/browser/cover-none-first-hit-save.json']
 hydrated=[]
 for rel in historical:
  b=subprocess.check_output(['git','show','703fc036c6327a830a79d5746eec805188cbbaa6:'+rel],cwd=root);p=root/rel;p.parent.mkdir(parents=True,exist_ok=True)
  original=p.read_bytes() if p.exists() else None
  if original!=b:p.write_bytes(b)
  assert p.read_bytes()==b;hydrated.append({'path':rel,'bytes':len(b),'sha256':sha(b),'unchangedExistingBytes':original==b,'sourceCommit':'703fc036c6327a830a79d5746eec805188cbbaa6','gitBlob':subprocess.check_output(['git','rev-parse','703fc036c6327a830a79d5746eec805188cbbaa6:'+rel],cwd=root,text=True).strip()})
 write('historical-hydration.json',hydrated)
 source_before=source_inventory();write('source-before.json',source_before)
 diff_before=subprocess.check_output(['git','diff','--binary','--','src','tests','scripts'],cwd=root);(out/'source-before.patch').write_bytes(diff_before)
 state['testStartedAt']=now();state['testsExecuted']=True;write('execution.json',state)
 env=dict(os.environ,RUIN_COVER_PROOF_DIR=str(out/'ruin-native-core'),npm_config_cache=str(out/'npm-cache'),XDG_CACHE_HOME=str(out/'xdg-cache'))
 with (out/'focused.stdout.log').open('wb') as stdout,(out/'focused.stderr.log').open('wb') as stderr:
  test=subprocess.run(state['testCommand'],cwd=root,env=env,stdout=stdout,stderr=stderr)
 state['testExitCode']=test.returncode;state['testCompletedAt']=now()
 source_after=source_inventory();write('source-after.json',source_after);assert source_after==source_before,'source/test/script bytes changed during execution'
 diff_after=subprocess.check_output(['git','diff','--binary','--','src','tests','scripts'],cwd=root);(out/'source-after.patch').write_bytes(diff_after);assert diff_after==diff_before,'source patch changed during execution'
 protected_after=protected_state();write('protected-after.json',protected_after);assert protected_after==before_protected,'protected preview or dist changed during execution'
 state['sourceUnchanged']=True;state['protectedPreviewAndDistUnchanged']=True;state['finishedAt']=now();state['status']='passed' if test.returncode==0 else 'failed; stopped with no retry or edits';write('execution.json',state)
 print(json.dumps(state,indent=2),flush=True)
 sys.exit(test.returncode)
except Exception as error:
 state['failure']={'message':str(error),'traceback':traceback.format_exc()};state['finishedAt']=now();state['status']='failed; stopped with no retry or edits';write('execution.json',state);print(json.dumps(state,indent=2),flush=True);raise
