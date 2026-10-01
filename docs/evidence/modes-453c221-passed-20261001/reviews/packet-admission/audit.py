"""Read-only independent admission audit. No product imports or runtime execution."""
import datetime, hashlib, json, os, pathlib, subprocess

P = pathlib.Path('/tmp/ovf-modes-complete-packet-453c221.dgl9yk4w')
OUT = pathlib.Path(__file__).parent
REPO = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
checks = []
reads = {}
def sha(data): return hashlib.sha256(data).hexdigest()
def read(path):
    path = pathlib.Path(path)
    data = path.read_bytes()
    reads[str(path)] = {'bytes': len(data), 'sha256': sha(data)}
    return data
def load(name): return json.loads(read(P / name))
def check(name, value, details=None):
    checks.append({'name': name, 'passed': bool(value), **({'details': details} if details is not None else {})})
def inventory(directory):
    result = {}
    def visit(folder, prefix=''):
        for path in sorted(folder.iterdir()):
            name = f'{prefix}/{path.name}' if prefix else path.name
            if path.is_symlink():
                target = os.readlink(path); data = target.encode()
                result[name] = {'bytes': len(data), 'sha256': sha(data), 'symlink': target}
            elif path.is_dir(): visit(path, name)
            elif path.is_file():
                data = read(path); result[name] = {'bytes': len(data), 'sha256': sha(data)}
            else: raise RuntimeError(f'Unsupported entry: {path}')
    visit(directory)
    return result
def tree(pin):
    data = subprocess.check_output(['git', '-C', str(REPO), 'ls-tree', '-r', '-z', pin])
    result = {}
    for entry in data.split(b'\0'):
        if not entry: continue
        meta, path = entry.split(b'\t', 1)
        mode, kind, blob = meta.decode().split()
        result[path.decode()] = {'mode': mode, 'type': kind, 'gitBlob': blob}
    return result

seal_path = pathlib.Path('/tmp/ovf-modes-packet-seal-453c221.jthgfixe/seal.json')
seal = json.loads(read(seal_path))
check('external seal bytes', sha(read(seal_path)) == '3c103c4186767f5a68aafeb5a508e1ea4609d890a2e7bb40eb341edbe5a667d4')
manifest = load('packet-manifest.json')
summary = load('packet-summary.json')
check('manifest external SHA256', sha(read(P/'packet-manifest.json')) == seal['packetManifestSha256'] == '07af4b0f3e142056a7d87f191ca74b8686195bc5f602701c99ec7495b23c7b40')
check('TSV external SHA256', sha(read(P/'packet-hashes.tsv')) == seal['packetHashesTsvSha256'] == '8e362ffcc4b998d71f61a37363e6c343fd3ba7ecdbfa6d760e9fc198e937cd43')
check('summary external SHA256', sha(read(P/'packet-summary.json')) == seal['packetSummarySha256'])
check('seal identities', seal['sourcePin'] == manifest['sourcePin'] == summary['sourcePin'] == PIN and seal['packetDirectory'] == str(P))
actual = inventory(P)
for path in ('packet-manifest.json','packet-hashes.tsv'): actual.pop(path)
check('all packet paths', set(actual) == set(manifest['artifacts']))
for path, item in manifest['artifacts'].items(): check('packet entry '+path, actual.get(path) == item)
rows = read(P/'packet-hashes.tsv').decode().splitlines()
tsv = [(name, {'sha256':digest,'bytes':int(size)}) for digest,size,name in (row.split('\t') for row in rows[1:])]
check('packet TSV no duplicate entries', len(tsv) == len(dict(tsv)))
check('packet TSV exact inventory', rows[0] == 'sha256\tbytes\tpath' and dict(tsv) == {path:{k:item[k] for k in ('sha256','bytes')} for path,item in actual.items()})
check('packet count and bytes', len(actual) == manifest['fileCount'] == seal['inventoriedFiles'] == 1141 and sum(x['bytes'] for x in actual.values()) == manifest['bytes'] == seal['inventoryBytes'] == 164978883)

prep = load('proof/prepare.json')
build = load('proof/build-manifest.json')
module = load('proof/modules/manifest.json')
final = load('proof/final-manifest.json')
browserprov = load('proof/browser/provenance.json')
groups = ('sourceFiles','assetFiles','configFiles','scriptFiles','testFiles','modeScriptFiles')
inputs = {}
for group in groups:
    for path,item in prep['provenance'][group].items():
        if path in inputs: check('duplicate input agrees '+path, inputs[path] == item)
        inputs[path] = item
    for name,obj in [('build',build),('modules',module),('final',final)]: check(name+' pinned '+group, obj[group] == prep['provenance'][group])
    if group in browserprov: check('browser pinned '+group, browserprov[group] == prep['provenance'][group])
source_actual = inventory(P/'source-inputs')
check('source input paths/count', set(source_actual) == set(inputs) and len(inputs) == 596)
git_tree = tree(PIN)
check('immutable commit available', subprocess.check_output(['git','-C',str(REPO),'rev-parse',PIN+'^{commit}'],text=True).strip() == PIN)
gitproc = subprocess.Popen(['git','-C',str(REPO),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
sourcefacts = {}
for path,item in sorted(inputs.items()):
    blob = git_tree.get(path,{})
    if blob.get('type') != 'blob': check('git blob type '+path,False);continue
    gitproc.stdin.write((blob['gitBlob']+'\n').encode());gitproc.stdin.flush()
    head = gitproc.stdout.readline().decode().split(); data = gitproc.stdout.read(int(head[2])); terminator = gitproc.stdout.read(1)
    fact = {'bytes':len(data),'sha256':sha(data),'gitBlob':blob['gitBlob']}
    sourcefacts[path] = {**blob,**fact}
    check('immutable input '+path, fact == item and source_actual[path] == {k:item[k] for k in ('bytes','sha256')} and terminator == b'\n')
gitproc.stdin.close();gitproc.wait()
source_digest = sha(''.join(f'{path}\0{item["sha256"]}\n' for path,item in sorted({**prep['provenance']['sourceFiles'],**prep['provenance']['configFiles']}.items())).encode())
buildhash = hashlib.sha256()
for path in sorted(prep['provenance']['sourceFiles']):
    if pathlib.Path(path).suffix in ('.ts','.css'): buildhash.update(path[4:].encode());buildhash.update(read(P/'source-inputs'/path))
build_id = buildhash.hexdigest()
check('source digest recomputed', source_digest == prep['sourceDigest'] == module['sourceDigest'] == summary['actualSourceDigest'] == '10eb86d645b975e0066a98e7617a24b25fb3861a65e0b07ac9c94d5665bb11b0')
check('source build ID recomputed', build_id == build['buildId'] == module['buildId'] == final['buildId'] == browserprov['buildId'] == summary['actualBuildId'] == '5e49e689af13d4eef08c0760f904ad0bce2c2eebaa1144dea5d89cadecf310c0')
for name,obj in [('prepare',prep),('build',build),('modules',module),('final',final),('browser',browserprov)]: check(name+' source pin',obj['sourcePin'] == PIN)
check('schema unchanged all manifests', prep['schema'] == module['schema'] == final['schema'] == browserprov['schema'] == summary['schema'])
check('SAVE4 source schema', 'export const SAVE_VERSION=4;' in read(P/'source-inputs/src/core/saves.ts').decode() and prep['schema']['saveVersion'] == 4)
versions = read(P/'source-inputs/src/core/versions.ts').decode()
check('current rules 4.0.1 and legacy SAVE4 rules 4.0.0', "export const SIMULATION_REVISION = '4.0.1';" in versions and "4:'4.0.0'" in versions and prep['schema']['simulationRevision'] == '4.0.1')
for folder,key in [('dist','compiledFiles'),('dist-server','serverFiles'),('modules','moduleFiles')]:
    inv = inventory(P/'proof'/folder)
    check('prepared '+folder+' bytes', inv == prep[key])
    if key in build: check('build '+folder+' bytes', inv == build[key])
check('module nested inventory', {path:entry for path,entry in inventory(P/'proof/modules').items() if path != 'manifest.json'} == module['modules'])
for name,bundleinputs in module['bundleInputs'].items():
    metadata = load('proof/modules/'+name+'.meta.json')
    check('module metadata input paths '+name, set(metadata['inputs']) == set(bundleinputs))
    for path,item in bundleinputs.items(): check('module input '+name+' '+path, item == {k:inputs[path][k] for k in item})
    body = read(P/'proof/modules'/name).decode()
    if name != 'schema.mjs':
        check('module embedded pin '+name, PIN in body)
        check('module embedded digest '+name, source_digest in body)
    else:
        check('schema manifest pin/digest binding', module['sourcePin'] == PIN and module['sourceDigest'] == source_digest,
              'schema.ts does not use the define constants, so esbuild omits them. Its retained bundle hash and all 49 source inputs bind it to the pinned module manifest.')
    matching_outputs = [item for path,item in metadata['outputs'].items() if path.endswith('/modules/'+name)]
    check('module output size/entry '+name, len(matching_outputs) == 1 and matching_outputs[0]['bytes'] == len(body.encode()) and matching_outputs[0]['entryPoint'] == module['entries'][name])
check('browser module manifest binding', browserprov['moduleManifestSha256'] == sha(read(P/'proof/modules/manifest.json')))
check('browser build manifest binding', browserprov['buildManifestSha256'] == sha(read(P/'proof/build-manifest.json')))
check('browser schema binding', browserprov['schemaModule']['sha256'] == sha(read(P/'proof/modules/schema.mjs')))
occurrences = []
for path in build['compiledFiles']:
    if path.endswith('.js'):
        count = read(P/'proof/dist'/path).decode().count(build_id)
        if count: occurrences.append({'path':path,'count':count})
check('compiled source fingerprint', occurrences == browserprov['fingerprintOccurrences'] and bool(occurrences))

proof_inventory = inventory(P/'proof')
for path in ('final-manifest.json','final-hashes.tsv'): proof_inventory.pop(path)
check('all original proof artifact paths', set(proof_inventory) == set(final['artifacts']))
for path,item in final['artifacts'].items(): check('original proof artifact '+path, proof_inventory.get(path) == item)
check('original proof count',len(final['artifacts']) == 478)
rows = read(P/'proof/final-hashes.tsv').decode().splitlines()
records = [(name,{'sha256':digest,'bytes':int(size)}) for digest,size,name in (row.split('\t') for row in rows[1:])]
check('original TSV inventory', len(records) == len(dict(records)) == 478 and dict(records) == {path:{k:item[k] for k in ('sha256','bytes')} for path,item in final['artifacts'].items()})
postflight = load('external-postflight/postflight.json')
check('original postflight bindings', postflight['sourcePin'] == PIN and postflight['artifactCount'] == 478 and postflight['result'] == 'passed structural/hash audit' and postflight['simulationsExecuted'] is False and postflight['serverClosed'] is True)
check('original final manifest hash', sha(read(P/'proof/final-manifest.json')) == postflight['finalManifestSha256'] == seal['originalFinalManifestSha256'])
check('original final TSV hash', sha(read(P/'proof/final-hashes.tsv')) == postflight['finalHashesTsvSha256'] == seal['originalFinalHashesSha256'])

launch = load('preparation-launch/execution.json')
dispatch = load('dispatch/prepared-paths-and-acceptance-dispatch.json')
run = load('proof/run.json')
check('preparation session/exit', dispatch['preparationToolSession'] == summary['executionSessions']['preparation']['toolSession'] == 30808 and dispatch['preparationToolExitCode'] == launch['exitCode'] == summary['executionSessions']['preparation']['toolExitCode'] == 0)
check('preparation stages', [x['name'] for x in launch['stages']] == ['pin-validation','worktree','dependencies','prepare'] and all(x['exitCode'] == x['cleanup']['leaderExitCode'] == 0 and x['cleanup']['verifiedGone'] for x in launch['stages']))
check('preparation receipt binding', dispatch['preparationReceiptSha256'] == sha(read(P/'preparation-launch/execution.json')) and launch['prepareJsonSha256'] == dispatch['prepareJsonSha256'] == sha(read(P/'proof/prepare.json')))
check('four acceptance steps', [x['name'] for x in run['steps']] == ['natural-matches','main-browser','native-local-custom-hill.session','native-local-build-report.session'] and all(x['result']=='passed' for x in run['steps']) and run['result']=='passed')
check('acceptance pin and server',run['sourcePin'] == PIN and run['server']['port']==9241 and run['server']['pid']==747583 and run['server']['exitCode']==0 and run['server']['signal'] is None and run['serverClosed'] and run['server']['aliveBeforePlannedShutdown'])
check('server artifact binding',run['server']['bundleSha256'] == sha(read(P/'proof/dist-server/rts-server.js')) == prep['serverFiles']['rts-server.js']['sha256'] and run['serverPackageFiles']==prep['serverFiles'] and run['serverDependencies']==prep['serverDependencies'])
failed = load('dispatch/first-cleanup-observer-failure.json')
details = load('dispatch/cleanup-bind-capture-details.json')
cleanup = load('dispatch/final-direct-cleanup-observation.json')
check('acceptance session/exit', failed['acceptanceToolSession']==cleanup['acceptanceToolSession']==summary['executionSessions']['acceptance']['toolSession']==12484 and failed['acceptanceToolExitCode']==cleanup['acceptanceToolExitCode']==summary['executionSessions']['acceptance']['toolExitCode']==0)
check('original postflight tool exit', failed['originalExternalPostflightToolExitCode']==summary['executionSessions']['originalPostflight']['toolExitCode']==0)
check('cleanup necessary observations',cleanup['serverPid']==run['server']['pid'] and cleanup['pidDirectlyAbsent'] and not cleanup['listenersAfter'].splitlines()[1:] and cleanup['connectEx']==111 and not cleanup['remainingOwnedNodeProcesses'] and not cleanup['remainingPlaywrightHeadlessChromiumProcesses'])
check('first cleanup errno98 preserved',failed['failedCommandToolExitCode']==1 and failed['errno']==98 and failed['cleanupObserverResult']=='failed direct temporary bind' and '[Errno 98] Address already in use' in read(P/'dispatch/first-cleanup-bind-traceback.txt').decode())
check('observer cause/time not asserted', details['causeAttributed'] is False and details['exactFailedBindTimestampCaptured'] is False and details['soReuseaddrSetByObserver'] is False)
check('observer raw byte binding',details['originalFailureReceiptSha256']==sha(read(P/'dispatch/first-cleanup-observer-failure.json')) and details['rawTracebackSha256']==sha(read(P/'dispatch/first-cleanup-bind-traceback.txt')))
check('later cleanup kept separate',cleanup['checkedAtUtc'] > failed['recordedAtUtc'] and cleanup['directBindWithoutReusePassed'] and cleanup['earlierBindFailureCause']=='not observed; no attribution asserted' and not cleanup['acceptanceRerun'] and not cleanup['sourceChange'])

receipt = load('external-assets/favicon-http-receipt.json')
favicon_names = ['external-assets/favicon-response.ico','proof/dist/favicon.ico','source-inputs/public/favicon.ico']
fav = [read(P/name) for name in favicon_names]
check('favicon response source dist equality',fav[0]==fav[1]==fav[2] and len(fav[0])==receipt['responseBytes']==32038 and sha(fav[0])==receipt['responseSha256']=='5e0bf0f72488bc693d779cd7a3ebc7fdfca8db9916a6e3e0811fff59113253c2')
check('favicon actual HTTP status/mime',receipt['method']=='GET' and receipt['status']==200 and receipt['responseHeaders']['Content-Type']=='image/x-icon' and receipt['url']=='http://127.0.0.1:9241/favicon.ico' and receipt['sourcePin']==PIN)
check('favicon same owned live server',receipt['serverPid']==run['server']['pid'] and receipt['serverBundle']==run['server']['bundle'] and receipt['serverBundleSha256']==run['server']['bundleSha256'] and receipt['serverAliveAfterResponse'] and run['steps'][1]['startedAt'][:19] < receipt['requestAtUtc'][:19] < run['steps'][1]['finishedAt'][:19])

helpers = load('dispatch/preparation-dispatch.json')['unchangedHelperHashes']
for name,expected in helpers.items():
    body=read(P/'admitted-helpers'/name)
    check('admitted helper hash '+name,len(body)==expected['bytes'] and sha(body)==expected['sha256'])
    check('original helper byte equality '+name,body==read(pathlib.Path(expected['path'])))
baseline=tree('c86e273c70738f144a00fe75f5ecf39e7fa324d8')
for path in inputs:
    if path.startswith('scripts/') or path.startswith('tests/'):
        check('unchanged baseline recipe/test '+path,git_tree[path]['gitBlob']==baseline[path]['gitBlob'])

staging=load('staging-receipt.json')
historical_run=load('historical-c86-failure-records/run.json')
check('historical c86 failure remains failed',historical_run['sourcePin']=='c86e273c70738f144a00fe75f5ecf39e7fa324d8' and historical_run['result']=='failed' and [x['name'] for x in historical_run['steps']]==['natural-matches','main-browser'] and historical_run['steps'][-1]['result']=='failed')
for archived,original in staging['copiedDirectories'].items():
    if archived not in ('historical-prebind','historical-c074-plan','historical-c074-plan-review'): continue
    archived_inv = inventory(P/archived)
    original_inv = inventory(pathlib.Path(original))
    check('historical directory unchanged '+archived, archived_inv == original_inv)
original_proof_inventory = inventory(pathlib.Path(staging['copiedDirectories']['proof']))
check('original live proof path inventory', set(original_proof_inventory) == set(inventory(P/'proof')))
for path,item in original_proof_inventory.items():
    check('original live proof bytes '+path, actual['proof/'+path] == item)
historical_originals = {}
historical_root = pathlib.Path('/tmp/ovf-modes-final-proof.pk292s0o')
for path in inventory(P/'historical-c86-failure-records'):
    if (historical_root/path).is_file(): historical_originals[path] = historical_root/path
historical_originals.update({
    'failure-cleanup.json': pathlib.Path('/tmp/ovf-modes-final-dispatch.nb_ieevo/failure-cleanup.json'),
    'http-error-capture-limitations.json': pathlib.Path('/tmp/ovf-modes-final-dispatch.nb_ieevo/http-error-capture-limitations.json'),
    'audit.json': pathlib.Path('/tmp/ovf-modes-preparation-provenance-audit.Hn4Vp2hK/audit.json'),
    'visual-inspection.json': pathlib.Path('/tmp/ovf-modes-failed-visual-inspection.rhqagjx8/visual-inspection.json'),
})
for path,original in historical_originals.items(): check('historical c86 original bytes '+path, read(P/'historical-c86-failure-records'/path) == read(original))
survival = load('proof/runtime/runtime-results.json')[-1]
check('Original69 increasing natural attack waves', survival['name'] == 'survival-five-waves' and [x['wave'] for x in survival['waves']] == [1,2,3,4,5] and [x['attackers'] for x in survival['waves']] == [1,2,3,4,5] and survival['winningTeam'] == 0 and survival['tick'] == 8190 and survival['objectives']['survival']['phase'] == 'complete')
check('no runtime during independent audit', True, 'Only standard-library file/hash/JSON inspection and read-only git cat-file/ls-tree/rev-parse were used.')
result={'result':'passed read-only structural/hash admission audit' if all(x['passed'] for x in checks) else 'failed read-only audit','sourcePin':PIN,'packet':str(P),'externalSeal':str(seal_path),'productExecution':False,'checkCount':len(checks),'passedCount':sum(x['passed'] for x in checks),'packetEntries':len(actual),'packetInventoryBytes':sum(x['bytes'] for x in actual.values()),'sourceInputs':len(inputs),'originalProofArtifacts':len(final['artifacts']),'recomputedBuildId':build_id,'recomputedSourceDigest':source_digest,'checks':checks,'sourceFacts':sourcefacts,'reads':reads,'stagingOriginalDirectoryMappings':staging['copiedDirectories'],'finishedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('checks','sourceFacts','reads','stagingOriginalDirectoryMappings')}))
print(json.dumps({'failures':[x for x in checks if not x['passed']],'directoryMappings':staging['copiedDirectories']}))
