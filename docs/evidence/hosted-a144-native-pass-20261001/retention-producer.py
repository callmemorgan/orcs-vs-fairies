import datetime
import hashlib
import json
import os
import stat
import subprocess
import tempfile
from pathlib import Path

REPO = Path('/home/morgana/.codex/worktrees/hosted-team-proof/orcs-vs-Fairies')
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
PIN = 'a144ad3f3dddd0003f9553541908e2254f2444c6'
FREEZE = '453c2218af9973b9eca8fb78392435bd9d46a740'
SUITE = '4a71cd07bacc12d214acaf5a0f95a7d9b486f52c'
ADMISSION = '9a4921fbcb16e59d89d409f1806fb7317285648d'
RUN = REPO / 'work/final-freeze-proof-20261001' / f'hosted-{PIN}-run1'
PACKET = Path('/tmp/ovf-hosted-only-retry-a144-readiness-jmgrn3ta')
START = Path('/tmp/ovf-hosted-a144-run-start-jpf8o0mr')
COMPLETION = Path('/tmp/ovf-hosted-a144-run-completion-kui38v2s/completion-cleanup.json')
DESTINATION = 'docs/evidence/hosted-a144-native-pass-20261001'
out = Path(tempfile.mkdtemp(prefix='ovf-hosted-a144-lossless-retention-'))
payload = out / 'payload'
entries = []
git_aliases = []

def sha(data):
    return hashlib.sha256(data).hexdigest()

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

def load(path):
    return json.loads(path.read_bytes())

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')

def copy_file(source, rel, classification, expected=None):
    assert not source.is_symlink() and source.is_file(), str(source)
    before = source.stat()
    assert before.st_size < 30_000_000, 'Large files must stay external; no large DB read is authorized.'
    data = source.read_bytes()
    after = source.stat()
    assert (before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_ino, after.st_size, after.st_mtime_ns)
    digest = sha(data)
    if expected:
        assert len(data) == expected['bytes'] and digest == expected['sha256'], str(source)
    target = payload / rel
    assert not target.exists(), str(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    mode = stat.S_IMODE(before.st_mode)
    os.chmod(target, mode)
    assert target.read_bytes() == data and stat.S_IMODE(target.stat().st_mode) == mode
    entry = {'originPath': str(source), 'stagedPath': str(target),
        'proposedDestinationRelativePath': DESTINATION + '/' + rel,
        'bytes': len(data), 'sha256': digest, 'mode': oct(mode), 'classification': classification,
        'originalAndStagedBytesEqual': True}
    entries.append(entry)
    return entry

def blob_record(ref, path):
    if subprocess.run(['git', 'cat-file', '-e', f'{ref}:{path}'], cwd=REPO,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
        return {'present': False, 'qualification': 'This path is absent at this historical pin; no equality is inferred.'}
    blob = git('rev-parse', f'{ref}:{path}').decode().strip()
    data = git('cat-file', 'blob', blob)
    return {'present': True, 'gitBlob': blob, 'bytes': len(data), 'sha256': sha(data)}

def source_block(ref, path, first, last):
    lines = git('show', f'{ref}:{path}').decode().splitlines()
    assert 1 <= first <= last <= len(lines), (ref, path, first, last, len(lines))
    return {'ref': ref, 'path': path, 'startLine': first, 'endLine': last,
        'lines': [{'line': n, 'text': lines[n-1]} for n in range(first,last+1)]}

plan = load(PACKET / 'plan.json')
result = load(RUN / 'result.json')
audit_path = RUN.with_name(RUN.name + '-audit.json')
audit = load(audit_path)
summary = load(RUN / 'native-browser/summary.json')
restart = load(RUN / 'native-browser/restart.json')
completion = load(COMPLETION)
assert result['status'] == audit['status'] == 'passed'
assert summary['passed'] and restart['passed'] and result['cleanupErrors'] == []
assert completion['heavySlotReleased'] is True
assert {k:v for k,v in result['browser'].items() if k!='restart'} == summary
assert result['browser']['restart'] == restart
assert result['source']['head'] == audit['source']['head'] == PIN
assert audit['packagesBefore'] == audit['packagesAfter'] == result['packages']

# Retain every produced regular runtime file except immutable public duplicates
# and the closed large database. No gzip, PNG, archive or game codec is invoked.
public = {path[7:]:record for path,record in audit['source']['files'].items() if path.startswith('public/')}
public_aliases = []
external = []
runtime_entries = []
for source in sorted(RUN.rglob('*')):
    rel = str(source.relative_to(RUN))
    if source.is_symlink():
        external.append({'path':str(source),'relativePath':rel,'type':'symlink',
            'linkText':os.readlink(source),'resolvedTarget':str(source.resolve()),
            'scope':'Original dependency link preserved in place; installed dependency tree was not copied or comprehensively pinned.'})
        continue
    if not source.is_file():
        continue
    if rel.startswith('private-data/'):
        s = source.stat()
        assert rel=='private-data/server.sqlite'
        assert (s.st_size,s.st_ino,s.st_mtime_ns)==(899215360,40470094,1790899915190180874)
        external.append({'path':str(source),'relativePath':rel,'type':'regular',
            'bytes':s.st_size,'inode':s.st_ino,'mtimeNs':s.st_mtime_ns,'mode':oct(stat.S_IMODE(s.st_mode)),
            'sha256':None,'hashQualification':'No fresh database read/hash: root explicitly prohibited large DB rehash during the light retention phase.',
            'preservation':'Original closed file remains unchanged at its external owned-checkout path. Preserve before any worktree cleanup; it is outside the bounded Git import.'})
        continue
    if rel.startswith('app/') and rel[4:] in public:
        name = rel[4:]
        pin = public[name]
        assert result['packages']['browser'][name]['sha256'] == pin['sha256']
        assert result['packages']['browser'][name]['bytes'] == pin['bytes']
        assert source.stat().st_size == pin['bytes']
        public_aliases.append({'originalPath':str(source),'relativePath':rel,'immutableRef':PIN,
            'immutablePath':'public/'+name,'gitBlob':pin['gitBlob'],'bytes':pin['bytes'],'sha256':pin['sha256'],
            'qualification':'Execution audit authenticated the before/after package bytes and frozen public source. Metadata size rechecked here; large repeated assets were not recopied.'})
        continue
    runtime_entries.append(copy_file(source, 'raw-run/' + rel, 'original-runtime-output'))
copy_file(audit_path, 'raw-run-audit.json', 'original-runtime-audit')
assert len([r for r in external if r['type']=='regular'])==1

# All dispatch/start/cleanup artifacts are losslessly copied.
for source in sorted(START.iterdir()):
    if source.is_file():copy_file(source,'execution-start/'+source.name,'original-start-or-sealed-preflight')
for name in ['execution-receipt.json','protected-root-before-dispatch.json','protected-root-after-dispatch.json','hosted-supervisor.log']:
    copy_file(PACKET/name,'execution/'+name,'original-execution-control-receipt')
copy_file(COMPLETION,'completion/completion-cleanup.json','original-personal-cleanup-receipt')

# Retain the exact authorizing independent review originals and preparation
# closure; authenticate them against root's admitted immutable Git copies.
admitted_base = 'docs/evidence/hosted-only-retry-a144-static-readiness-20261001/'
import_manifest = json.loads(git('show', ADMISSION+':'+admitted_base+'import-plan/import-manifest.json'))
for record in import_manifest['entries']:
    source = Path(record['sourcePath'])
    data = source.read_bytes()
    assert len(data)==record['bytes'] and sha(data)==record['sha256']
    assert stat.S_IMODE(source.stat().st_mode)==int(record['mode'],8)
    committed = git('show',ADMISSION+':'+record['destinationRelativePath'])
    assert committed==data
    relative = record['destinationRelativePath'][len(admitted_base):]
    copy_file(source,'authorizing-static-admission/'+relative,record['classification'],record)
for name in ['import-manifest.json','plan-hashes.json','preflight-result.json','verify-import-manifest.py']:
    source = Path('/tmp/ovf-hosted-only-retry-a144-root-import-plan-20261001-gpt6-sol')/name
    committed = git('show',ADMISSION+':'+admitted_base+'import-plan/'+name)
    assert source.read_bytes()==committed
    copy_file(source,'authorizing-static-admission/import-plan/'+name,'original-root-import-plan-metadata')
for name in ['root-README.md','root-retention.json']:
    path = admitted_base+name
    data = git('show',ADMISSION+':'+path)
    target = payload/'authorizing-static-admission'/name
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);os.chmod(target,0o644)
    entries.append({'originGitRef':ADMISSION,'originGitPath':path,'originGitBlob':git('rev-parse',ADMISSION+':'+path).decode().strip(),
        'stagedPath':str(target),'proposedDestinationRelativePath':DESTINATION+'/authorizing-static-admission/'+name,
        'bytes':len(data),'sha256':sha(data),'mode':'0o644','classification':'root-authored-admission-receipt',
        'originalAndStagedBytesEqual':target.read_bytes()==data})
git_aliases = import_manifest['deduplicatedAliases']

# Original473 hashes are copied from the completed personal rehash receipt.
# No original large SQLite/WAL/SHM is opened again in this light phase.
historical_artifacts = completion['original473ArtifactsRehashedUnchanged']
for record in historical_artifacts:
    source = Path(record['path'])
    assert source.is_file() and source.stat().st_size==record['bytes']
    if 'private-data/' not in str(source):
        copy_file(source,'historical473/'+source.name if source.name!='summary.json' else 'historical473/native-summary.json',
            'original473-failed-receipt',record)
copy_file(Path('/tmp/ovf-ranked-473-raw-packets-k67xwdxw/retention-plan.json'),
    'historical473/previous-raw-retention-plan.json','original473-complete-raw-retention-map')

cooperative = next(x for x in summary['layouts'] if x['name']=='two-human-cooperative-vs-two-ai')
assert [p['controller'] for p in cooperative['fixture']['players']]==['human','human','ai','ai']
assert [p['teamId'] for p in cooperative['fixture']['players']]==[0,0,1,1]
assert len({s['account']['id'] for s in cooperative['lobby']['seats'] if s['controller']=='human'})==2
assert [x['side'] for x in cooperative['commands']['nativeStops']]==[0,1]
assert all(x['ack']['accepted'] for x in cooperative['commands']['nativeStops'])
assert cooperative['commands']['transfer']['ack']['accepted']
assert not cooperative['commands']['rejectedOwnership']['ack']['accepted']
wave = cooperative['coordinatedAi']
assert [wave[x]['tick'] for x in ['previous','launch','moved']]==[1420,1424,1428]
assert wave['destinations'][0]==wave['destinations'][1]
assert {u['side'] for owner in wave['owners'] for u in owner}=={2,3}
live = restart['liveSpectator']
assert live['hello']['role']=='spectator' and live['hello']['delayTicks']==0 and live['renderer']['readOnly']
assert [live['initialTick'],live['advancingTick']]==[1768,1772]

# Directly authenticate retained compressed originals without running codecs.
descriptor_checks=[]
def inspect_descriptors(value):
    if isinstance(value,dict):
        if 'path' in value and 'gzipSha256' in value:
            p=RUN/value['path'];data=p.read_bytes()
            assert len(data)==value['gzipBytes'] and sha(data)==value['gzipSha256']
            descriptor_checks.append({'descriptorCopied':value,'actualCompressedBytesAndSha256Match':True,
                'decompressedHashQualification':'Producer-recorded decompressed hash retained; no codec rerun in light retention.'})
        for item in value.values():inspect_descriptors(item)
    elif isinstance(value,list):
        for item in value:inspect_descriptors(item)
inspect_descriptors(summary);inspect_descriptors(restart)
pair_checks=[]
for label,key in [('first','firstFrames'),('advancing','advancingFrames')]:
    a,b=live[key];equal=(RUN/a['path']).read_bytes()==(RUN/b['path']).read_bytes();assert equal
    pair_checks.append({'capture':label,'tick':a['tick'],'spectatorAndPlayerCompressedOriginalsByteEqual':True,
        'paths':[a['path'],b['path']],'gzipSha256':a['gzipSha256']})

# Source applicability uses only immutable Git reads. No project codec or test.
root_pin = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
product_paths=['src','public','tests','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','editor.html','Dockerfile.server','.dockerignore']
freeze_diff=git('diff','--name-status',FREEZE,PIN,'--',*product_paths).decode()
root_diff=git('diff','--name-status',PIN,root_pin,'--',*product_paths).decode()
root_working_product_diff=subprocess.check_output(['git','diff','--name-status',root_pin,'--',*product_paths],cwd=ROOT,text=True)
assert freeze_diff==root_diff==root_working_product_diff==''
requirements=json.loads(git('show',FREEZE+':docs/features/requirements.json'))['features']
original_requirements=[x for x in requirements if x['id'] in [63,64]]
relevant_paths=['src/main.ts','src/server/server.ts','src/server/store.ts','src/server/views.ts','src/server/team-view.ts',
    'src/core/simulation.ts','src/core/team-ai.ts','src/core/ai-policy.ts','src/core/saves.ts','src/core/versions.ts',
    'src/online/OnlineConnection.ts','src/online/render-state.ts','src/ui/OnlineLobby.ts',
    'scripts/server/verify-hosted-teams.mjs','scripts/server/verify-hosted-teams-browser.mjs','scripts/build-server.mjs',
    'tests/allied-ai.test.ts','tests/team-ai-policy.test.ts','tests/server-teams.test.ts','tests/server.test.ts']
applicability=[]
for path in relevant_paths:
    # Retain only paths present in the execution Git tree; no inferred filenames.
    if subprocess.run(['git','cat-file','-e',PIN+':'+path],cwd=REPO,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
        continue
    records={name:blob_record(ref,path) for name,ref in [('suite',SUITE),('freeze',FREEZE),('execution',PIN),('rootObserved',root_pin)]}
    applicability.append({'path':path,'pins':records,
        'executionAndRootEqual':records['execution']['gitBlob']==records['rootObserved'].get('gitBlob'),
        'suiteAndExecutionEqual':records['suite'].get('gitBlob')==records['execution']['gitBlob'] if records['suite']['present'] else None})
old_bridge=load(Path('/tmp/ovf-hosted-original-clause-bridge-453.json'))
copy_file(Path('/tmp/ovf-hosted-original-clause-bridge-453.json'),
    'historical-suite/original-clause-bridge-453.json', 'original-historical-clause-bridge')
# Retain the actual historical suite report and full input inventories alongside
# its original assertion records. These are immutable Git bytes, not fresh runs.
historical_suite_originals=[]
for name,record in old_bridge['admittedSuiteArtifacts'].items():
    data=git('cat-file','blob',record['gitBlob'])
    assert len(data)==record['bytes'] and sha(data)==record['sha256']
    target=payload/'historical-suite'/name
    assert not target.exists()
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);os.chmod(target,0o644)
    entry={'originGitBlob':record['gitBlob'],'originHistoricalSuitePin':SUITE,
        'stagedPath':str(target),'proposedDestinationRelativePath':DESTINATION+'/historical-suite/'+name,
        'bytes':len(data),'sha256':sha(data),'mode':'0o644','classification':'original-historical-suite-artifact',
        'originalAndStagedBytesEqual':target.read_bytes()==data}
    entries.append(entry);historical_suite_originals.append(entry)
suite_bytes=git('cat-file','blob',old_bridge['admittedSuiteArtifacts']['tests.json']['gitBlob'])
assert sha(suite_bytes)==old_bridge['admittedSuiteArtifacts']['tests.json']['sha256']
suite_data=json.loads(suite_bytes)
titles={
    'keeps one distinct scout and launches both approved armies in the same tick despite different decision cadences',
    'uses combined readiness below a solo threshold and launches all owners once in one pass',
    'starts cooperative human seats without AI readiness and runs both computer opponents through delayed team observations',
    'delays actual spectator frames and rejects spectator commands',
}
actual_assertions=[]
for file_result in suite_data['testResults']:
    for assertion in file_result['assertionResults']:
        if assertion['title'] in titles:
            assert assertion['status']=='passed'
            actual_assertions.append({'suiteFileName':file_result['name'],'suiteFileStatus':file_result['status'],'assertionResultCopied':assertion})
assert len(actual_assertions)==4
# Compare every execution-selected input by immutable Git identity. Public
# bitmap blobs are never opened or decoded here; the run audit supplies their
# authenticated bytes and SHA values. Missing old proof scripts stay explicit.
def tree_inputs(ref):
    rows={}
    for item in git('ls-tree','-r','-z',ref).split(b'\0'):
        if not item: continue
        metadata,path=item.split(b'\t',1)
        mode,kind,oid=metadata.decode().split(' ')
        rows[path.decode()]={'gitMode':mode,'gitType':kind,'gitBlob':oid}
    return rows
trees={name:tree_inputs(ref) for name,ref in [('suite',SUITE),('freeze',FREEZE),('execution',PIN),('rootObserved',root_pin)]}
complete_inputs=[]
for path,record in audit['source']['files'].items():
    assert trees['execution'][path]['gitBlob']==record['gitBlob'],path
    pins={name:rows.get(path,{'present':False}) for name,rows in trees.items()}
    complete_inputs.append({'path':path,'executionAuthenticatedRecordCopied':record,'pins':pins,
        'executionAndRootBlobEqual':pins['execution']['gitBlob']==pins['rootObserved'].get('gitBlob'),
        'freezeAndExecutionBlobEqual':pins['execution']['gitBlob']==pins['freeze'].get('gitBlob'),
        'suiteAndExecutionBlobEqual':pins['execution']['gitBlob']==pins['suite'].get('gitBlob')})
selected_input_differences={name:[r['path'] for r in complete_inputs if not r[name+'AndExecutionBlobEqual']]
    for name in ['freeze','suite']}
selected_input_differences['executionToRootObserved']=[r['path'] for r in complete_inputs if not r['executionAndRootBlobEqual']]
root_selected_paths=selected_input_differences['executionToRootObserved']
root_selected_diff=git('diff',PIN,root_pin,'--',*root_selected_paths).decode() if root_selected_paths else ''
assert len(complete_inputs)==748
copy_file(Path(__file__), 'retention-producer.py', 'light-lossless-retention-producer')
qualification={
    'formatVersion':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'producer':plan['producer'],
    'scope':'Light static lossless-retention and original63/64 qualification. No build/test/server/browser/simulation, codec, large DB read/rehash, retry, checkout move, root write, ledger/status promotion or heavy-slot use.',
    'executionPin':PIN,'admittedPreparationPin':ADMISSION,'productFreeze':FREEZE,'rootObservedPin':root_pin,
    'originalRequirementsCopied':original_requirements,
    'resultStatusCopied':result['status'],'auditStatusCopied':audit['status'],'nativeChecksCopied':result['checks'],
    'actualBrowserIdentityCopied':result['checks'][0]['evidence'],
    'sourceApplicability':{'freezeToExecutionProductDiff':freeze_diff,'executionToRootObservedProductDiff':root_diff,
        'rootObservedToWorkingProductDiff':root_working_product_diff,
        'comparedProductPaths':product_paths,'inputBlobs':applicability,
        'completeExecutionSelectedInputsCopiedAndCompared':complete_inputs,
        'completeSelectedInputDifferences':selected_input_differences,
        'completeSelectedInputDifferenceQualification':'The execution inventory includes proof scripts beyond this hosted recipe. Every differing or absent path remains listed. Product applicability is established by the separate complete product-scope comparison; no equality of all historical or current proof scripts is inferred.',
        'executionToRootSelectedInputDiff':root_selected_diff,
        'suiteToExecutionSrcTestsFullDiff':git('diff',SUITE,PIN,'--','src','tests').decode(),
        'executionSourceSha256':audit['source']['sha256'],'executionSourceFiles':len(audit['source']['files']),
        'qualification':'Complete product scope is unchanged from453 througha144 and observed root pin. Historical4a71 tests keep their own identity; their only src/tests bridge difference is the anonymous cosmetic refresh guard in main, covered by current mounted app. Future product pins require a new applicability comparison.'},
    'packageAndRuntimeIdentity':{'serverGenerationsCopied':audit['serverGenerations'],'servedBytesCopied':audit['served'],
        'sourceIntegrityPassed':True,'packagesBeforeAfterEqualResult':True,'packageCounts':{k:len(v) for k,v in result['packages'].items()},
        'selectedRuntimeCopied':audit['browserRuntime'],'runtimeManifestCopied':audit['runtimeManifest'],
        'qualification':'Actual installed default headless shell1234 launched as151.0.7922.34. Both packaged generations retained launch records; generation-one static bytes were observed, and complete packages rehashed unchanged. Full host/dependency environment and remote deployment were not comprehensively pinned/tested.'},
    'cooperativeNativeEvidenceCopied':cooperative,
    'restartEvidenceCopied':restart,
    'nativeDescriptorAuthentication':descriptor_checks,'zeroDelayRawCompressedPairChecks':pair_checks,
    'historicalSupplementalSuite':{'pin':SUITE,'testsArtifact':old_bridge['admittedSuiteArtifacts']['tests.json'],
        'originalArtifactsRetained':historical_suite_originals,'originalReportCopied':old_bridge['suiteReportCopied'],
        'countsCopied':{k:suite_data[k] for k in ['numPassedTests','numFailedTests','success']},
        'actualPassedAssertionsCopied':actual_assertions,
        'qualification':'The old exact-step AI tests supplement the current200ms public-frame observation. They are not a fresh native same-step capture or a natural victory.'},
    'recipeSourceBlocks':[source_block(PIN,'scripts/server/verify-hosted-teams-browser.mjs',26,34),
        source_block(PIN,'scripts/server/verify-hosted-teams-browser.mjs',300,347),
        source_block(PIN,'scripts/server/verify-hosted-teams-browser.mjs',395,437),
        source_block(PIN,'scripts/server/verify-hosted-teams-browser.mjs',446,508),
        source_block(PIN,'scripts/server/verify-hosted-teams.mjs',109,129)],
    'recommendations':[
        {'id':63,'originalRequirement':'human teammates fight coordinated computer opponents.',
            'recommendation':'Recommend admission of original63 from the current native cooperative case and unchanged-source historical AI coordination tests.',
            'observed':'Distinct human Orc/Fairy accounts on team0 enter the mounted authoritative match and each issue accepted native stop input. Published lobby settings use two undead AI owners on team1. Team spectator frames observe both AI owners change to matching formation destinations within ticks1420→1424, with both owners moving by1428. Both human accounts rejoin after packaged-server restart and issue accepted next-sequence stop commands; the unchanged transfer receipt returns without another bank debit.',
            'limits':['Controlled public lobby setup: large map, starting age3, fixed unequal human banks with incomeFactor0, and AI banks10000wood/10000ore/1000crystal with incomeFactor1/populationCap100.',
                'Native human commands prove control, ownership and team transfers; no native human attack order or human-inflicted damage is claimed.',
                'Current public frames expose a200ms interval, not the exact internal coordinator step. No natural victory, completed combat outcome, canonical replay or native save export is claimed.',
                'Do not introduce exact-step native coordination, a natural team victory or a new human4v4 gate into the original wording.']},
        {'id':64,'originalRequirement':'watch matches with optional delayed viewing.',
            'recommendation':'Recommend admission of original64 from current native delayed player/team spectators and advancing zero-delay spectators after restart.',
            'observed':'Native spectator entry mounts read-only player/team views with delayTicks20. The cooperative player frame tick164 is followed by live tick187; team frame356 is followed by live379. Both UI stop input and recruitment are blocked, and direct authenticated spectator probes return spectator errors without player acknowledgments. After the same packages/data restart with delay0, native spectator hello reports delayTicks0 and the rendered read-only player view matches the live player compressed raw frame at1768, then both advance to1772 with matching raw frame bytes.',
            'limits':['The zero-delay run proves player perspective; it does not separately claim zero-delay team perspective or public remote deployment.',
                'Public frame and rendered values are preserved; no native save/replay export is manufactured.',
                'Root owns final admission and requirement status updates.']}
    ],
    'supplemental4v4':'Current full eight-browser human4v4 passed. It remains supplemental; original61/62 were admitted using their existing evidence and are not reopened by this run.',
    'original473Preservation':{'hashSource':'Personal completion receipt from the just-finished authorized heavy phase; no large historicalDB rehash now.',
        'artifactsCopied':historical_artifacts,'previousCompleteRawRetentionMap':'historical473/previous-raw-retention-plan.json',
        'status':'Original473 failed result and all raw historical bytes remain unchanged.'},
    'freshLargeDatabaseQualification':external,
    'cleanupQualification':{'completionReceiptCopied':completion,'scope':'Personal ownedPID/port and all397rootdist/protected1063 comparisons were completed before heavy slot release. Root independently confirmed dispatcher absence/37823closed/4173intact. No new process control in this light phase.'},
    'admissionState':'Recommendation only; no status promotion or root edits.'
}
write_json(payload/'qualification-original63-64.json',qualification)
readme=(
    'The single admitted hosted run ata144 passed all eight checks. This packet retains the original result, audit, native JSON/gzip/PNG files, compiled app/server code, logs, start/preflight/control receipts, personal cleanup receipt, and every original authorizing preparation/independent-review file. Copies preserve bytes and modes. No image, archive or game codec ran during retention.\n\n'
    'Original63 evidence is a mounted two-human/two-AI cooperative match with accepted human controls and a matching two-owner AI attack interval at1420→1424 followed by movement at1428. Original64 evidence includes delayed player/team spectators with20ticks delay and advancing zero-delay spectators at1768→1772 after packaged restart. Exact internal AI-step attribution and natural victory are outside the native observation. Qualification records the controlled lobby resources, source applicability and historical supplemental tests.\n\n'
    'Repeated public app assets remain recoverable from their immutablea144Git blobs and authenticated package hashes. The closed899215360-byte currentSQLite and original473SQLite/WAL/SHM stay external at their original paths. Root prohibited largeDB rehash during this light phase; the currentSQLite reference therefore records file metadata without a freshSHA. Preserve it before worktree cleanup. The original473SHA values come from the completed personal rehash receipt and its failure remains unchanged.\n\n'
    'Root owns import and final admission. The heavy slot was explicitly released after direct cleanup/protected-root checks. No canonical/daily run, repair/retry, root write or status promotion occurred.\n'
)
(payload/'README.md').write_text(readme)
for path,classification in [(payload/'qualification-original63-64.json','derived-original-clause-qualification'),(payload/'README.md','derived-retention-readme')]:
    data=path.read_bytes();entries.append({'stagedPath':str(path),'proposedDestinationRelativePath':DESTINATION+'/'+path.name,
        'bytes':len(data),'sha256':sha(data),'mode':oct(stat.S_IMODE(path.stat().st_mode)),'classification':classification,'derived':True})
manifest={'formatVersion':1,'producer':plan['producer'],'executionPin':PIN,'proposedDestination':DESTINATION,
    'status':'Prepared external lossless copies; no root import performed.',
    'entries':entries,'publicImmutableAliases':public_aliases,'authorizingPreparationDeduplicatedAliases':git_aliases,
    'externalOriginalLargeFilesAndDependencies':external,'original473ExternalPreservation':historical_artifacts,
    'bounds':{'copyFiles':len(entries),'copyBytes':sum(x['bytes'] for x in entries),'publicAliasFiles':len(public_aliases),
        'publicAliasBytes':sum(x['bytes'] for x in public_aliases),'runtimeOriginalRegularFilesCopied':len(runtime_entries),
        'largeDatabaseFilesCopiedOrRead':0,'codecsRun':0,'rootWrites':0,'heavySlotUse':0},
    'copyRules':['Copy each staged payload file byte for byte and preserve its recorded mode; reject changes or symlinks.',
        'Retain original failure/pass statuses and historical run identities. Never rewrite raw results to alter scope.',
        'Public aliases resolve to immutableGit blobs. Large SQLite and dependency links remain external and must survive any worktree cleanup.',
        'Root may independently inspect original raw receipts/frames. Qualification does not promote requirement statuses.']}
write_json(out/'import-manifest.json',manifest)
# Re-read all bounded staged copies, including every original authorizing review.
read_back=load(out/'import-manifest.json')
for entry in read_back['entries']:
    p=Path(entry['stagedPath']);data=p.read_bytes()
    assert len(data)==entry['bytes'] and sha(data)==entry['sha256']
    assert stat.S_IMODE(p.stat().st_mode)==int(entry['mode'],8)
assert len({x['proposedDestinationRelativePath'] for x in entries})==len(entries)
assert git('rev-parse','HEAD').decode().strip()==PIN and git('status','--porcelain','--untracked-files=no')==b''
verification={'manifest':{'path':str(out/'import-manifest.json'),'bytes':(out/'import-manifest.json').stat().st_size,'sha256':sha((out/'import-manifest.json').read_bytes())},
    'qualification':{'path':str(payload/'qualification-original63-64.json'),'bytes':(payload/'qualification-original63-64.json').stat().st_size,'sha256':sha((payload/'qualification-original63-64.json').read_bytes())},
    'allStagedCopiesBytesAndModesMatch':True,'destinationPathsUnique':True,'nativeCompressedDescriptorsAuthenticated':len(descriptor_checks),
    'zeroDelayCompressedPairsByteEqual':pair_checks,'sourceProductFreezeExecutionRootEqual':True,'rootObservedPin':root_pin,
    'originalAuthorizing20Plus4AndRootReceiptsRetained':True,'noLargeDBReadOrRehash':True,'noCodecsOrRuntime':True,
    'bounds':manifest['bounds'],'ownedTrackedCleanAtA144':True,'heavySlot':'Released; Scenario453 owns it.'}
write_json(out/'verification.json',verification)
print(json.dumps(verification,indent=2))
