import subprocess,pathlib,json,hashlib,shutil,datetime,os,time,urllib.request,traceback,sys,re
if len(sys.argv)!=3:raise SystemExit('Usage: python3 run-world-content-frozen-pin.py FULL_SOURCE_PIN NEW_OUTPUT_ROOT')
pin=sys.argv[1];assert re.fullmatch(r'[0-9a-f]{40}',pin),'Pass the full frozen source pin'
cwd=pathlib.Path.cwd();root=pathlib.Path(sys.argv[2]).resolve();root.mkdir(exist_ok=False)
for directory in ['logs','builds','native-reports','bug-report-sessions']: (root/directory).mkdir()
sha=lambda b:hashlib.sha256(b).hexdigest();preview=None;previewLog=None;provenance=None;prepared=None
report={'kind':'actual-final-world-content-recipe','sourcePin':pin,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'running','port':5183,'port4173Touched':False,'steps':[],'nativeChecks':[],'scope':'World menu/actions, native complete replay/continuation, ordinary CLI traversal/resume/log replay, local mod, map/flat/layered editors and two-account community map/mod publication/install/play/restart.'}
env={**os.environ,'OVF_PRODUCTION_SOURCE_COMMIT':pin,'OVF_PLAYWRIGHT_MODULE':'/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'}
def persist(): (root/'run.json').write_text(json.dumps(report,indent=2)+'\n')
def run(label,args,extra=None,required=False):
 step={'name':label,'args':args,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'running'};report['steps'].append(step);persist();log=root/'logs'/(label+'.log')
 with log.open('x') as output:
  completed=subprocess.run(args,cwd=cwd,env={**env,**(extra or {})},stdout=output,stderr=output)
 step.update({'exitCode':completed.returncode,'result':'passed' if completed.returncode==0 else 'failed','finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'log':str(log.relative_to(root)),'logSha256':sha(log.read_bytes())});persist();print(json.dumps({'step':label,'result':step['result'],'exitCode':completed.returncode}),flush=True)
 if required and completed.returncode:raise RuntimeError(label+' failed; first failed output retained at '+str(log))
 return completed.returncode==0,log
proofCode='const {worldSourceProof}=await import("./scripts/world/proof-common.mjs");console.log(JSON.stringify(await worldSourceProof(process.argv[1])));'
def native(label,input):
 path=pathlib.Path(input);assert path.exists(),str(path)
 output=root/'native-reports'/(label+'.json');ok,log=run('native-'+label,['node','scripts/world/run-native.mjs',pin,prepared['modulesDir'],prepared['preparationSha256'],'native',str(path),str(output)])
 item={'name':label,'input':str(path.relative_to(root)),'inputSha256':sha(path.read_bytes()),'result':'passed' if ok else 'failed','report':str(output.relative_to(root))};report['nativeChecks'].append(item);persist()
def nativeIfPresent(label,path):
 if pathlib.Path(path).exists():native(label,path)
def bugNative(label,path):
 path=pathlib.Path(path)
 if path.exists():
  bug=json.loads(path.read_text());assert bug['versions']['buildId']==provenance['buildId'] and bug['versions']['save']==4 and bug['versions']['simulationRevision']==provenance['simulationRevision']
  target=root/'bug-report-sessions'/(label+'.json');target.write_text(json.dumps(bug['session'],indent=2)+'\n');native('bug-'+label,target)
def inventory(directory):return {str(path.relative_to(directory)):{'bytes':path.stat().st_size,'sha256':sha(path.read_bytes())} for path in sorted(directory.rglob('*')) if path.is_file()}
try:
 assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==pin
 _,log=run('source-before',['node','--input-type=module','-e',proofCode,pin],required=True);provenance=json.loads(log.read_text());(root/'source-before.json').write_text(json.dumps(provenance,indent=2)+'\n');report['sourceDigest']=provenance['sourceDigest'];report['buildId']=provenance['buildId'];report['saveVersion']=provenance['saveVersion'];report['simulationRevision']=provenance['simulationRevision'];persist()
 for directory in ['dist','dist-cli','dist-server','dist-tournament']:
  path=cwd/directory;assert not path.is_symlink()
  if path.exists():shutil.rmtree(path)
 for name in ['build','build:cli','build:server','build:tournament']:run(name.replace(':','-'),['npm','run',name],required=True)
 builds={}
 for directory in ['dist','dist-cli','dist-server','dist-tournament']:
  files=inventory(cwd/directory);copy=root/'builds'/directory;shutil.copytree(cwd/directory,copy);assert inventory(copy)==files;builds[directory]=files
  (root/'builds'/(directory+'-manifest.json')).write_text(json.dumps({'sourcePin':pin,'sourceDigest':provenance['sourceDigest'],'buildId':provenance['buildId'],'sourceFiles':provenance['sourceFiles'],'configFiles':provenance['configFiles'],'assetFiles':provenance['assetFiles'],'compiledFiles':files},indent=2)+'\n')
 report['compiledCounts']={k:len(v) for k,v in builds.items()}
 _,log=run('prepare-modules',['node','scripts/world/prepare.mjs',pin,str(root/'modules')],required=True);prepared=json.loads(log.read_text());(root/'preparation-output.json').write_text(json.dumps(prepared,indent=2)+'\n');env.update({'OVF_WORLD_MODULES':prepared['modulesDir'],'OVF_WORLD_PREPARATION_SHA256':prepared['preparationSha256'],'OVF_PROOF_DIST':str(root/'builds/dist')});report['modulePreparation']=prepared;persist()
 launch=['node','scripts/world/run-native.mjs',pin,prepared['modulesDir'],prepared['preparationSha256']]
 run('generate',launch+['generate',str(root/'fixtures')],required=True);run('mod-fixture',launch+['mod-fixture',str(root/'mod-fixtures')],required=True)
 run('cli',launch+['cli',str(root/'cli')]);
 for name in ['neutral','surface','dusk','thaw']:native('fixture-'+name,root/'fixtures'/(name+'.json'))
 nativeIfPresent('cli',root/'cli/cli-world-session.json')
 listeners=subprocess.check_output(['ss','-ltn','( sport = :5183 )'],text=True).strip().splitlines();assert len(listeners)==1,'Owned preview port must be unused'
 previewArgs=['node','node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5183','--strictPort','--outDir',str(root/'builds/dist')];previewLog=(root/'logs/preview.log').open('x');preview=subprocess.Popen(previewArgs,cwd=cwd,env=env,stdout=previewLog,stderr=previewLog);report['preview']={'args':previewArgs,'pid':preview.pid};persist()
 for attempt in range(100):
  assert preview.poll() is None,'Owned preview exited before readiness'
  try:
   with urllib.request.urlopen('http://127.0.0.1:5183',timeout=1) as response:
    if response.status==200:break
  except Exception:time.sleep(.25)
 else:raise RuntimeError('Owned preview not ready')
 base='http://127.0.0.1:5183'
 run('served-index-before',['node','scripts/verify_served_build.mjs',base,str(root/'served-index-before.json'),str(root/'builds/dist')],required=True)
 run('served-editor-before',['node','scripts/verify_served_build.mjs',base+'/editor.html',str(root/'served-editor-before.json'),str(root/'builds/dist')],required=True)
 run('world-menu',['node','scripts/verify_world.mjs',base,str(root/'browser')])
 for biome in ['desert','marsh','snow','forest']:nativeIfPresent('world-'+biome,root/'browser'/(biome+'-world-save.json'))
 bugNative('world',root/'browser/world-native-build-report.json')
 run('world-actions',['node','scripts/verify_world_actions.mjs',base,str(root/'actions'),str(root/'fixtures')])
 for name in ['neutral','surface','dusk','thaw']:nativeIfPresent('actions-imported-'+name,root/'actions'/('native-'+name+'-imported.json'))
 for name in ['world','surface','thaw']:nativeIfPresent('actions-'+name,root/'actions'/(name+'-world-save.json' if name!='world' else 'world-browser-save.json'))
 bugNative('actions',root/'actions/world-actions-native-build-report.json')
 run('mods',['node','scripts/verify_mods.mjs',base],{'OVF_MOD_FIXTURE_DIR':str(root/'mod-fixtures'),'OVF_MOD_EVIDENCE_DIR':str(root/'mods')})
 for name in ['browser-save.json','browser-replay-final.save.json']:nativeIfPresent('mods-'+name.removesuffix('.json'),root/'mods'/name)
 bugNative('mods',root/'mods/browser-build-report.json')
 run('map-editor',['node','scripts/verify_editors.mjs',base],{'OVF_EDITOR_EVIDENCE_DIR':str(root/'map'),'OVF_EDITOR_PLAY':'1'})
 nativeIfPresent('map',root/'map/edited-map-in-play.save.json');bugNative('map',root/'map/edited-map-build-report.json')
 run('flat-editor',['node','scripts/verify_scenario_editor.mjs',base],{'OVF_EDITOR_EVIDENCE_DIR':str(root/'flat')})
 nativeIfPresent('flat',root/'flat/convoy-playing.save.json');bugNative('flat',root/'flat/convoy-build-report.json')
 if (root/'map/two-level-map.json').exists():
  run('layered-editor',['node','scripts/verify_layered_scenario_editor.mjs',base],{'OVF_EDITOR_EVIDENCE_DIR':str(root/'layered'),'OVF_EDITOR_MAP_FIXTURE':str(root/'map/two-level-map.json')});nativeIfPresent('layered',root/'layered/cave-scenario-playing.save.json');bugNative('layered',root/'layered/cave-scenario-build-report.json')
 else:report['steps'].append({'name':'layered-editor','result':'blocked','reason':'Map editor did not export its required fresh two-level map'});persist()
 run('community-map',['node','scripts/verify_community_browser.mjs'],{'OVF_EDITOR_EVIDENCE_DIR':str(root/'community-map'),'OVF_COMMUNITY_MAP_STATIC_DIR':str(root/'builds/dist')})
 for file in sorted((root/'community-map').glob('browser-replay-*.save.json')):native('community-map-'+file.name.removesuffix('.save.json'),file)
 nativeIfPresent('community-map-complete',root/'community-map/browser-played-complete.save.json');bugNative('community-map',root/'community-map/community-map-build-report.json')
 run('community-mod',['node','scripts/verify_community_mod.mjs'],{'OVF_EDITOR_EVIDENCE_DIR':str(root/'community-mod'),'OVF_COMMUNITY_MOD_STATIC_DIR':str(root/'builds/dist')})
 nativeIfPresent('community-mod',root/'community-mod/community-mod-trained.save.json');bugNative('community-mod',root/'community-mod/community-mod-build-report.json')
 run('served-index-after',['node','scripts/verify_served_build.mjs',base,str(root/'served-index-after.json'),str(root/'builds/dist')],required=True)
 run('served-editor-after',['node','scripts/verify_served_build.mjs',base+'/editor.html',str(root/'served-editor-after.json'),str(root/'builds/dist')],required=True)
 _,log=run('source-after',['node','--input-type=module','-e',proofCode,pin],required=True);assert json.loads(log.read_text())==provenance,'Source changed across actual recipe'
 for directory,files in builds.items():assert inventory(cwd/directory)==files and inventory(root/'builds'/directory)==files,'Build changed during actual proof '+directory
 report['result']='passed' if all(step['result']=='passed' for step in report['steps']) else 'failed'
except BaseException as error:
 report['result']='failed';report['failure']={'message':str(error),'traceback':traceback.format_exc()};print(json.dumps({'fatal':str(error)}),flush=True)
finally:
 if preview is not None and preview.poll() is None:
  preview.terminate()
  try:preview.wait(timeout=5)
  except subprocess.TimeoutExpired:preview.kill();preview.wait(timeout=5)
 if previewLog:previewLog.close()
 report['previewClosed']=preview is None or preview.poll() is not None;report['listenersAfter']=subprocess.check_output(['ss','-ltnp','( sport = :5183 )'],text=True).strip();report['worktreeStatus']=subprocess.check_output(['git','status','--short'],text=True).strip();report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();persist()
 files=inventory(root);files.pop('artifact-hashes.json',None);files.pop('artifact-hashes.tsv',None);(root/'artifact-hashes.json').write_text(json.dumps(files,indent=2)+'\n');(root/'artifact-hashes.tsv').write_text('sha256\tbytes\tpath\n'+''.join(f"{v['sha256']}\t{v['bytes']}\t{k}\n" for k,v in files.items()));print(json.dumps({'result':report['result'],'root':str(root),'run':str(root/'run.json'),'steps':len(report['steps']),'nativeChecks':len(report['nativeChecks']),'previewClosed':report['previewClosed']}),flush=True)
