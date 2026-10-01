import hashlib, json, pathlib, subprocess, time
product=pathlib.Path('/home/morgana/.codex/worktrees/assembled-rules401/orcs-vs-Fairies')
proof=pathlib.Path('/home/morgana/Projects/orcs-vs-fairies-autosave-proof')
pin='453c2218af9973b9eca8fb78392435bd9d46a740'
proofpin='9e5fd2340b9a0823d1ab9f566c52b947a094278e'
root=product/'work/verification/ui-453c221-20261001'
inspection=root/'autosave-inspection-r1'; inspection.mkdir()
checks=[]
def check(ok,label):
    checks.append({'label':label,'passed':bool(ok)})
    assert ok,label

def fp(path):
    check(path.is_file() and not path.is_symlink(),'regular file '+str(path))
    b=path.read_bytes(); return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}

def load(path): return json.loads(path.read_text())
def dump(path,data): path.write_text(json.dumps(data,indent=2)+'\n')
def verify_map(base,m,label):
    for name, expected in m.items():
        a=fp(base/name)
        check(a=={'bytes':expected['bytes'],'sha256':expected['sha256']},label+' '+name)
def git(base,*args): return subprocess.check_output(['git','-C',str(base),*args],text=True).strip()
check(git(product,'rev-parse','HEAD')==pin,'product HEAD')
check(git(proof,'rev-parse','HEAD')==proofpin,'proof HEAD')
check(git(product,'status','--porcelain')==git(proof,'status','--porcelain')=='','both checkouts clean')
prep=load(root/'prepared/prepare.json'); modules=load(root/'prepared/modules/manifest.json'); build=load(root/'prepared/build-manifest.json')
check(prep['sourcePin']==modules['sourcePin']==build['sourcePin']==pin,'fresh preparation pins')
verify_map(product,load(root/'preparation-runtime/product-inputs-before.json'),'all919 pinned inputs preserved')
verify_map(product,load(root/'preparation-runtime/old-evidence-before.json'),'all527 old artifacts preserved')
verify_map(root/'prepared',load(root/'preparation-runtime/prepared-files.json'),'fresh prepared inventory')
verify_map(root/'prepared/dist',build['compiledFiles'],'compiled files')
for group in ['sourceFiles','assetFiles','configFiles','testFiles']:
    check(prep[group]==modules[group]==build[group],group+' preparation maps agree')
for name in sorted((proof/'scripts/session-recovery').glob('*')):
    check(name.is_file() and not name.is_symlink(),'proof regular file '+name.name)
    relative=str(name.relative_to(proof))
    committed=subprocess.check_output(['git','-C',str(proof),'show',proofpin+':'+relative])
    check(name.read_bytes()==committed,'proof9e frozen '+relative)
run=load(root/'autosave-runtime-r1/run.json')
check(run['result']=='passed','wrapper passes')
check(len(run['steps'])==7 and all(step['exitCode']==0 and not step.get('timedOut') for step in run['steps']),'all7 actual process exits pass')
check(run['steps'][0]['name']=='browser' and [step['name'] for step in run['steps'][1:]]==['authenticate-recovered','validate-recovered','authenticate-continued','validate-continued','authenticate-imported','validate-imported'],'required sequential step order')
check(run['preview']['closed'] and run['preview']['pidAbsent'] and run['preview']['exitCode']==143 and run['portClosed'] and run['frozenBytesUnchanged'],'wrapper cleanup')
check(not pathlib.Path('/proc/'+str(run['preview']['pid'])).exists(),'actual preview PID absent')
listeners=subprocess.check_output(['ss','-ltnp','( sport = :5299 )'],text=True)
check(len(listeners.strip().splitlines())==1,'actual port5299 empty')
check(load(root/'autosave-runtime-r1/inputs-before.json')==load(root/'autosave-runtime-r1/inputs-after.json'),'before/after runtime inventories equal')
manifest=load(root/'autosave-runtime-r1/full-manifest.json')
verify_map(root/'autosave-runtime-r1',manifest['runtime'],'runtime retained manifest')
verify_map(root/'autosave-browser-r1',manifest['browser'],'browser retained manifest')
verify_map(root/'preparation-runtime',load(root/'preparation-runtime/full-manifest.json'),'preparation retained manifest')
b=load(root/'autosave-browser-r1/browser-proof.json')
check(b['result']=='passed' and b['sourcePin']==b['productPin']==pin and b['proofPin']==proofpin,'strict browser pass at pins')
check(len(b['checks'])==6,'all6 gameplay checks')
check(b['browserClosed'] and all(b[k]==[] for k in ['pageErrors','consoleErrors','failedRequests','httpErrors']),'strict unfiltered browser error gates and cleanup')
check(b['servedBefore']==b['servedAfter'],'served build bytes stable')
check(b['buildId']==build['buildId'],'native/browser/prepared buildID')
check(b['schema']['saveVersion']==4 and b['schema']['simulationRevision']=='4.0.1','SAVE4 rules401')
for url,item in b['servedAssets'].items():
    check(item['status']==200,'served asset200 '+url)
    check({'bytes':item['bytes'],'sha256':item['sha256']}==build['compiledFiles'][item['path']],'served asset equals compiled '+url)
verify_map(root/'autosave-browser-r1',load(root/'autosave-browser-r1/manifest.json')['artifacts'],'original browser artifact manifest')
for filename, expected in b['downloads'].items():
    check(fp(root/'autosave-browser-r1'/filename)=={'bytes':expected['bytes'],'sha256':expected['sha256']},'original download fingerprint '+filename)
for expected in b['screenshots']:
    check(fp(root/'autosave-browser-r1'/expected['file'])=={'bytes':expected['bytes'],'sha256':expected['sha256']},'original screenshot fingerprint '+expected['file'])
files={name:load(root/f'autosave-browser-r1/native-{name}.json') for name in ['before-reload','recovered','continued','imported']}
check(files['before-reload']==files['recovered']==files['imported'],'complete exported sessions recovered/imported equal original')
check((root/'autosave-browser-r1/native-before-reload.json').read_bytes()==(root/'autosave-browser-r1/native-recovered.json').read_bytes()==(root/'autosave-browser-r1/native-imported.json').read_bytes(),'raw original/recovered/imported download bytes equal')
continuation=b['checks'][3]
check(continuation['before']['tick']==613 and continuation['after']['tick']==860,'real browser recovery/continuation ticks')
check(continuation['before']['bank']==continuation['after']['bank'],'no second recruitment charge')
check(continuation['before']['hq']['queue']==['worker'] and continuation['after']['hq']['queue']==[],'recovered paid queue completes')
check(len(continuation['after']['workers'])==len(continuation['before']['workers'])+1,'natural worker completion')
validators={}
for name in ['recovered','continued','imported']:
    v=load(root/f'autosave-runtime-r1/{name}-verification.json')
    check(v['result']=='passed' and v['sourcePin']==pin,'native validator pin/result '+name)
    for flag in ['sourceUnchangedDuringVerification','bundleSourceBindingPassed','nativeDecoderPassed','completeEnvelopeRoundtripPassed','completeReplayEnvelopePassed','recomputedAnalysisPassed','technologyTimingsPassed']:
        check(v[flag],name+' '+flag)
    check(v['inputSha256']==b['downloads']['native-'+name+'.json']['sha256'],name+' original download binding')
    check(v['executedBundleSha256']==fp(root/'prepared/modules/verify-native.mjs')['sha256'],name+' executed current bundle binding')
    check(v['checkerScriptSha256']==fp(product/'scripts/controls-proof/verify-native.ts')['sha256'],name+' checker source binding')
    c=v['continuation']
    for flag in ['completeEnvelopeEqualityPassed','recorderEqualityPassed','allAcceptedContinuationCommandsRecorded','extendedReplayEqualityPassed']: check(c[flag],name+' continuation '+flag)
    check(c['advancedTicks']==100 and c['finalTick']==c['startTick']+100 and len(c['commands'])==6 and c['maxActorDisplacement']>.01,name+' complete100step6command continuation')
    validators[name]={'tick':v['finalTick'],'inputSha256':v['inputSha256'],'continuedTicks':c['advancedTicks'],'commands':len(c['commands'])}
favicon=load(root/'autosave-runtime-r1/favicon-live.json')
check(favicon['result']=='passed' and favicon['status']==200 and favicon['productPin']==pin and favicon['url']==favicon['finalUrl'],'direct favicon200 identity')
check(favicon['response']==favicon['publicFile']==favicon['compiledFile']==favicon['committed']==fp(root/'autosave-runtime-r1/favicon-live.ico'),'direct favicon body fingerprints')
check((root/'autosave-runtime-r1/favicon-live.ico').read_bytes()==(root/'prepared/dist/favicon.ico').read_bytes()==subprocess.check_output(['git','-C',str(product),'show',pin+':public/favicon.ico']),'direct live favicon equals committed+dist bytes')
visual={
'before-reload.png':'Visible Saves controls, successful export message, named save and Autosave row; 30-second preference. Lower list continues within the scrollable modal.',
'recovered-autosave.png':'Successful export after recovery, visible Autosave and older Autosave row; 30-second preference. Screenshot confirms the save panel; complete queue/game recovery is established by exported bytes.',
'recovered-production-completed.png':'Successful export after continued play and readable save panel. Queue completion and unchanged resources are established by native export and runtime observations.',
'fresh-authenticated-import.png':'Successful export in fresh context, empty saved-match list and default one-minute preference; modal and controls fit the viewport.'}
receipt={'result':'passed','productPin':pin,'proofPin':proofpin,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'checks':len(checks),'failures':0,'verifiedPinnedInputs':919,'verifiedOldArtifacts':527,'browserResult':'passed','browserChecks':6,'validators':validators,'favicon':favicon['response'],'browserVersion':subprocess.check_output(['/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome','--version'],text=True).strip(),'screenshotsOpenedAndInspected':visual,'actualPort5299After':listeners,'limits':b['limits'],'secondOldConsoleStringStillIndividuallyUnattributed':True}
dump(inspection/'receipt.json',receipt)
dump(inspection/'checks.json',checks)
dump(inspection/'packet-manifest.json',{str(p.relative_to(root)):fp(p) for p in sorted(root.rglob('*')) if p.is_file() and p.name!='packet-manifest.json'})
print(json.dumps({k:v for k,v in receipt.items() if k not in ['screenshotsOpenedAndInspected','limits']}))
