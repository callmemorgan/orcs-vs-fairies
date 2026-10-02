import ast
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO = Path('/home/morgana/.codex/worktrees/hosted-team-proof/orcs-vs-Fairies')
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
OLD = '473ab17642211c3610aed648ae5f813b7680edc1'
PIN = 'a144ad3f3dddd0003f9553541908e2254f2444c6'
FREEZE = '453c2218af9973b9eca8fb78392435bd9d46a740'
BASE = REPO / 'work/final-freeze-proof-20261001'
FAILED = BASE / f'hosted-{OLD}-run1'
BEFORE = Path('/tmp/ovf-native-combat-453c221-retry-20261001-85q9lr0g/protected-root-before.json')
SELECTED = re.compile(r'^(src/|public/|scripts/|package(?:-lock)?\.json$|tsconfig[^/]*\.json$|vite\.config\.|(?:index|editor)\.html$|Dockerfile\.server$|\.dockerignore$)')

def digest(data):
    return hashlib.sha256(data).hexdigest()

def file_record(path):
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    return {'path': str(path), 'bytes': path.stat().st_size, 'sha256': hasher.hexdigest()}

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2) + '\n')

def proc_identity(pid):
    base = Path('/proc') / str(pid)
    fields = (base / 'stat').read_text().rsplit(')', 1)[1].split()
    return {'pid': pid, 'startTicks': int(fields[19]),
        'cmdline': (base / 'cmdline').read_bytes().replace(b'\0', b' ').decode(),
        'cwd': str((base / 'cwd').resolve())}

def protected_snapshot():
    dist = ROOT / 'dist'
    files = {str(p.relative_to(dist)): {k:v for k,v in file_record(p).items() if k != 'path'}
        for p in sorted(dist.rglob('*')) if p.is_file()}
    port = subprocess.check_output(['ss', '-lntp', 'sport', '=', ':4173'], text=True)
    assert 'pid=1063,' in port
    return {'pid': proc_identity(1063), 'port4173': port, 'rootDist': str(dist), 'distFiles': files}

assert git('rev-parse', 'HEAD').decode().strip() == OLD
assert git('status', '--porcelain', '--untracked-files=no') == b''
out = Path(tempfile.mkdtemp(prefix='ovf-hosted-only-retry-a144-readiness-'))
old_protected = json.loads(BEFORE.read_bytes())
protected = protected_snapshot()
assert protected['pid']['cmdline'] == old_protected['pidCmdline']
assert protected['pid']['cwd'] == old_protected['pidCwd']
assert protected['distFiles'] == old_protected['distFiles']
write_json(out / 'protected-root-preparation.json', protected)

rows = git('ls-tree', '-r', '-z', '--full-tree', PIN).split(b'\0')
files = {}
source_digest = hashlib.sha256()
build_digest = hashlib.sha256()
for row in sorted((r for r in rows if r), key=lambda r:r.split(b'\t',1)[1]):
    meta, name_bytes = row.split(b'\t', 1)
    name = name_bytes.decode()
    if not SELECTED.search(name):
        continue
    mode, kind, blob = meta.decode().split()
    assert kind == 'blob'
    data = git('cat-file', 'blob', blob)
    files[name] = {'gitBlob': blob, 'bytes': len(data), 'sha256': digest(data), 'mode': mode}
    source_digest.update(name_bytes + b'\0' + data + b'\0')
    if name.startswith('src/') and re.search(r'\.(ts|css)$', name):
        build_digest.update(name_bytes[4:]); build_digest.update(data)
source = {'head': PIN, 'tree': git('rev-parse', PIN + '^{tree}').decode().strip(),
    'selectedFileCount': len(files), 'sha256': source_digest.hexdigest(), 'buildId': build_digest.hexdigest(),
    'saveVersion': 4, 'simulationRevision': '4.0.1', 'files': files,
    'method': 'Read immutable Git tree/blob bytes at target pin; owned checkout stays at473. This is an expected source inventory, not a fresh build or runtime result.'}
write_json(out / 'source-a144.json', source)
assert git('diff', OLD, PIN, '--', 'src', 'public', 'tests') == b''
proof_paths = ['scripts/server/verify-hosted-teams.mjs', 'scripts/server/verify-hosted-teams-browser.mjs', 'scripts/build-server.mjs']
proofs = {p:files[p] for p in proof_paths}
proof_diff = git('diff', OLD, PIN, '--', 'scripts/server').decode()
assert 'if (method === \'GET\') assert(mutations >= 1' in proof_diff
(out / 'reviewed-proof-change.diff').write_text(proof_diff)

supervisor_source = BASE / 'supervise-proof-live-rules401.mjs'
supervisor = out / 'supervise-proof-live-rules401.mjs'
shutil.copyfile(supervisor_source, supervisor)
assert supervisor.read_bytes() == supervisor_source.read_bytes()
runtime_source = BASE / 'browser-runtime-readiness.json'
runtime_path = out / 'browser-runtime-readiness.json'
shutil.copyfile(runtime_source, runtime_path)
runtime = json.loads(runtime_path.read_bytes())
runtime_files = []
for name, expected in runtime['files'].items():
    actual = file_record(Path(name))
    assert actual['sha256'] == expected['sha256'] and actual['bytes'] == expected['bytes']
    runtime_files.append(actual)
headless = Path(runtime['headlessExecutable'])
assert headless.is_file() and os.access(headless, os.X_OK)
assert not Path('/home/morgana/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome').exists()
node = Path(shutil.which('node')).resolve()
npm = Path(shutil.which('npm')).resolve()

failed_db = FAILED / 'private-data/server.sqlite'
preserved = [file_record(p) for p in [FAILED/'result.json', BASE/f'hosted-{OLD}-run1-audit.json',
    FAILED/'native-browser/summary.json', FAILED/'native-browser/4v4-failure-wire.json.gz', failed_db,
    failed_db.with_name(failed_db.name+'-wal'), failed_db.with_name(failed_db.name+'-shm')]]
assert next(x for x in preserved if x['path'] == str(failed_db))['bytes'] == 378163200
old_result = json.loads((FAILED/'result.json').read_bytes())
assert old_result['status'] == 'failed'
write_json(out / 'historical-hosted-package-identities.json', {'sourcePin': OLD, 'resultStatus': 'failed',
    'resultArtifact': file_record(FAILED/'result.json'), 'packagesCopied': old_result['packages'],
    'scope': 'Historical473 package identities only. The retry will build fresh app/server destinations and capture/compare its own package and served-byte identities.'})

GUARD = r'''#!/usr/bin/env python3
"""Prepared hosted-only dispatcher. Execute only after root releases its heavy slot."""
import hashlib,json,os,re,signal,subprocess,sys,time
from pathlib import Path

HERE=Path(__file__).resolve().parent
PLAN=json.loads((HERE/'plan.json').read_bytes())
REPO=Path(PLAN['ownedCheckout'])
PIN=PLAN['targetPin']
OUT=Path(PLAN['freshPaths']['hostedOutput'])
STOP=False
owned={}

def sha_file(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for part in iter(lambda:f.read(1048576),b''):h.update(part)
    return h.hexdigest()
def pin_file(record):
    p=Path(record['path'])
    assert p.is_file() and p.stat().st_size==record['bytes'] and sha_file(p)==record['sha256'],str(p)
def git(*args):
    return subprocess.check_output(['git',*args],cwd=REPO).decode().strip()
def proc(pid):
    p=Path('/proc')/str(pid)
    try:
        f=(p/'stat').read_text().rsplit(')',1)[1].split()
        return {'pid':pid,'ppid':int(f[1]),'startTicks':int(f[19]),'state':f[0]}
    except (FileNotFoundError,ProcessLookupError,PermissionError):return None
def process_identity(pid):
    p=Path('/proc')/str(pid);r=proc(pid);assert r
    return {'pid':pid,'startTicks':r['startTicks'],'cmdline':(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(),'cwd':str((p/'cwd').resolve())}
def protected_snapshot():
    expected=json.loads(Path(PLAN['protectedRoot']['preparedSnapshot']['path']).read_bytes())
    dist=Path(expected['rootDist'])
    current={'pid':process_identity(1063),'port4173':subprocess.check_output(['ss','-lntp','sport','=',':4173'],text=True),
        'rootDist':str(dist),'distFiles':{str(p.relative_to(dist)):{'bytes':p.stat().st_size,'sha256':sha_file(p)} for p in sorted(dist.rglob('*')) if p.is_file()}}
    assert current['pid']==expected['pid'],'Protected PID identity changed'
    assert 'pid=1063,' in current['port4173'],'Protected4173 listener changed'
    assert current['distFiles']==expected['distFiles'],'Protected root dist changed'
    return current
def scan_owned(leader):
    rows={}
    for p in Path('/proc').iterdir():
        if p.name.isdigit():
            r=proc(int(p.name))
            if r:rows[r['pid']]=r
    ancestors={pid for pid,start in owned.items() if pid in rows and rows[pid]['startTicks']==start}
    if leader in rows and (leader not in owned or rows[leader]['startTicks']==owned[leader]):ancestors.add(leader)
    changed=True
    while changed:
        changed=False
        for pid,r in rows.items():
            if r['ppid'] in ancestors and pid not in ancestors:ancestors.add(pid);changed=True
    for pid in ancestors:
        assert pid!=1063 and pid!=os.getpid(),'Protected process entered owned descendant set'
        owned[pid]=rows[pid]['startTicks']
def live_owned():
    return [pid for pid,start in owned.items() if (r:=proc(pid)) and r['startTicks']==start and r['state']!='Z']
def signal_owned(sig):
    for pid in reversed(live_owned()):
        assert pid!=1063 and pid!=os.getpid()
        try:os.kill(pid,sig)
        except ProcessLookupError:pass
def interrupted(signum,frame):
    global STOP
    STOP=True
def write(name,data):
    (HERE/name).write_text(json.dumps(data,indent=2)+'\n')

assert sys.argv[1:]==['--execute-after-root-release'],'This dispatcher is held; use only after explicit root assignment.'
assert os.environ.get('OVF_HEAVY_SLOT_RELEASE')==PIN,'Root heavy-slot release must name the prepared pin.'
assert git('rev-parse','HEAD')==PIN,'Root must authorize/perform the owned checkout move before this dispatcher.'
assert git('diff','--name-only','HEAD')=='','Owned tracked source is dirty'
assert not OUT.exists() and not Path(PLAN['freshPaths']['audit']).exists(),'Retry output must be new'
assert not (HERE/'execution-receipt.json').exists(),'Do not reuse a completed dispatch packet'
for record in PLAN['preparedExecutableFiles']+PLAN['runtime']['currentByteRecords']+PLAN['preservedOriginal473Artifacts']:pin_file(record)
expected=json.loads(Path(PLAN['sourceManifest']['path']).read_bytes())
selected=re.compile(PLAN['sourceSelectionPattern'])
paths=sorted(p for p in git('ls-files','-z','--cached','--others','--exclude-standard').split('\0') if selected.search(p))
assert paths==sorted(expected['files']),'Owned source path inventory differs from target pin'
for p,record in expected['files'].items():
    assert (REPO/p).stat().st_size==record['bytes'] and sha_file(REPO/p)==record['sha256'],p
before=protected_snapshot();write('protected-root-before-dispatch.json',before)
env=os.environ.copy();env['OVF_PLAYWRIGHT_MODULE']=PLAN['runtime']['module']
for key in ['PWDEBUG','PLAYWRIGHT_BROWSERS_PATH','XDG_CACHE_HOME']:
    assert not env.get(key),f'Unexpected browser selection override {key}'
command=PLAN['invocation']
failure=None;status=None;after=None;child=None;owned_ports=[]
started=time.monotonic()
for sig in [signal.SIGINT,signal.SIGTERM]:signal.signal(sig,interrupted)
try:
    with (HERE/'hosted-supervisor.log').open('xb') as log:
        child=subprocess.Popen(command,cwd=REPO,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        scan_owned(child.pid)
        while child.poll() is None:
            scan_owned(child.pid)
            if STOP:raise RuntimeError('Hosted retry cancelled')
            if time.monotonic()-started>1260:raise TimeoutError('Hosted retry dispatcher exceeded21minutes')
            time.sleep(.25)
        status=child.returncode
        scan_owned(child.pid)
    assert status==0,f'Hosted supervisor exited{status}; retained log/result/audit identify failure'
except BaseException as error:
    failure=repr(error)
finally:
    # Stop only retained PID/start-time identities from this supervisor's descendants.
    # No pkill, all-browser sweep, root PID kill, or shared port-based kill.
    if child:
        scan_owned(child.pid)
        if live_owned():
            signal_owned(signal.SIGTERM)
            end=time.monotonic()+8
            while live_owned() and time.monotonic()<end:time.sleep(.1)
            if live_owned():signal_owned(signal.SIGKILL)
            end=time.monotonic()+5
            while live_owned() and time.monotonic()<end:time.sleep(.1)
        try:child.wait(timeout=1)
        except subprocess.TimeoutExpired:failure=failure or 'Owned supervisor did not exit after bounded cleanup'
    for p in OUT.glob('server-*.log') if OUT.exists() else []:
        m=re.search(r'authoritative server: http://127\.0\.0\.1:(\d+)',p.read_text())
        if m and int(m.group(1)) not in owned_ports:owned_ports.append(int(m.group(1)))
    ports={str(p):subprocess.check_output(['ss','-lntp','sport','=',f':{p}'],text=True) for p in owned_ports}
    if live_owned() or any('LISTEN' in value for value in ports.values()):failure=failure or 'Owned process/port remained after cleanup'
    try:
        after=protected_snapshot();write('protected-root-after-dispatch.json',after)
        for record in PLAN['preservedOriginal473Artifacts']+PLAN['runtime']['currentByteRecords']:pin_file(record)
        assert git('rev-parse','HEAD')==PIN and git('diff','--name-only','HEAD')==''
    except BaseException as error:failure=failure or repr(error)
    write('execution-receipt.json',{'targetPin':PIN,'producer':PLAN['producer'],'invocation':command,
        'supervisorExit':status,'elapsedSeconds':time.monotonic()-started,'failure':failure,
        'protectedRootBefore':before,'protectedRootAfter':after,'ownedPidStartIdentities':owned,
        'ownedSurvivors':live_owned(),'ownedPortsAfterCleanup':ports,'original473ArtifactsRechecked':True if after and not failure else 'Read failure/guards above',
        'scope':'Hosted only. Root must inspect actual result/audit/native receipts before admission; no canonical/daily dispatch and no status promotion.'})
if failure:raise RuntimeError(failure)
print('Hosted retry finished; inspect result/audit and execution-receipt before admission.')
'''
ast.parse(GUARD)
guard = out / 'dispatch-hosted-after-release.py'
guard.write_text(GUARD)
fresh = BASE / f'hosted-{PIN}-run1'
assert not fresh.exists() and not fresh.with_name(fresh.name+'-audit.json').exists()
plan = {
    'formatVersion': 1, 'preparedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'Prepared by static reads only; heavy execution held.',
    'producer': {'harness': 'Codex', 'model': 'GPT-6', 'modelIdentitySource': 'Active developer context',
        'modelVariant': 'Not supplied by this session; no Sol/Luna/Terra override claimed.', 'agent': '/root/ranked_challenges'},
    'ownedCheckout': str(REPO), 'ownedCheckoutObservedHead': OLD, 'targetPin': PIN, 'productFreeze': FREEZE,
    'sourceManifest': file_record(out/'source-a144.json'), 'sourceSelectionPattern': SELECTED.pattern,
    'targetSourceSummary': {k:v for k,v in source.items() if k != 'files'},
    'proofInputs': proofs, 'proofChangeArtifact': file_record(out/'reviewed-proof-change.diff'),
    'proofChangeScope': 'Only scripts/server/verify-hosted-teams-browser.mjs changes under source selection: GET matching count permits>=1 and retains recorded count, strict single POST, response status/data and lobby outcome guards.',
    'srcPublicTestsEqualOriginal473': True,
    'freshPaths': {'hostedOutput': str(fresh), 'audit': str(fresh.with_name(fresh.name+'-audit.json')),
        'externalSupervisorLog': str(out/'hosted-supervisor.log'), 'externalExecutionReceipt': str(out/'execution-receipt.json')},
    'runtime': {'module': runtime['module'], 'playwrightVersionFromPackageJson': json.loads(Path(runtime['module']).with_name('package.json').read_bytes())['version'],
        'playwrightCoreVersionFromPackageJson': json.loads(Path(runtime['module']).parent.parent.joinpath('playwright-core/package.json').read_bytes())['version'],
        'selection': 'chromium.launch({headless:true,args:[--disable-dev-shm-usage]}) without channel/executable override selects installed chromium_headless_shell1234.',
        'headlessExecutable': str(headless), 'fullChromium1234Absent': True,
        'historicalActualLaunchVersion': runtime['headlessChromiumVersion'],
        'freshLaunchesDuringPreparation': 0, 'currentByteRecords': runtime_files,
        'copiedRuntimeManifest': file_record(runtime_path), 'sourceRuntimeManifest': file_record(runtime_source),
        'nodeExecutable': file_record(node), 'npmCli': file_record(npm),
        'nodeVersionHistoricalReadinessOnly': runtime['nodeVersion']},
    'preparedExecutableFiles': [file_record(supervisor), file_record(guard), file_record(runtime_path), file_record(node), file_record(npm)],
    'invocation': [str(node), str(supervisor), 'hosted', str(fresh), PIN],
    'dispatchInvocationAfterExplicitRootRelease': ['python3', str(guard), '--execute-after-root-release'],
    'dispatchEnvironmentAfterExplicitRootRelease': {'OVF_HEAVY_SLOT_RELEASE': PIN, 'OVF_PLAYWRIGHT_MODULE': runtime['module']},
    'protectedRoot': {'preparedSnapshot': file_record(out/'protected-root-preparation.json'),
        'priorBaseline': file_record(BEFORE), 'pid': 1063, 'port': 4173, 'dist': str(ROOT/'dist'),
        'current397DistFilesEqualPriorBaseline': True, 'currentPidCmdlineCwdEqualPriorBaseline': True,
        'cleanupRule': 'Only child/descendant PID+start-time identities. Never killPID1063 or another browser/process by global name or shared port.'},
    'preservedOriginal473Artifacts': preserved,
    'historicalPackages': file_record(out/'historical-hosted-package-identities.json'),
    'newPackageIdentityMethod': 'Runner builds fresh app/server destinations. Supervisor records complete package hashes before/after, served index/favicon/JS/CSS bytes for generation1, both packaged generation launch records, source identity and selected browser runtime. Historical473 packages are not reused or relabeled.',
    'serialSteps': [
        'Keep execution held until root explicitly assigns/releases the heavy slot and confirms a144 remains the execution pin. If a combat fix produces a later pin, regenerate this readiness packet rather than editing its pin.',
        'After that assignment, move only the owned detached checkout to the target pin; this packet does not move it. Recheck clean tracked source and selected paths/hashes. Existing work/final-freeze-proof outputs and oversized473 DB stay untouched.',
        'Run the single prepared dispatcher with the pin-specific release environment. It compares protectedPID1063/4173/rootdist and original473 artifacts before spawning the byte-identical existing supervisor.',
        'The hosted runner builds fresh packages, launches generation1, and serially exercises human2v2, human3v3, supplemental human4v4, cooperative skirmishes and delayed player/team spectators. It then gracefully stops and relaunches the same packages/data for zero-delay spectators and reconnect/receipt checks.',
        'Inspect actual hosted result/audit/native wire and controller configs. Original61/62 admission review proceeds separately;63 cooperative coordinated opponents and64 optional delayed/live spectators remain runtime targets. Preserve any failure exactly.',
        'The supervisor has a20minute bound; dispatcher has a21minute bound plus at most8second TERM/5second KILL cleanup and1second child reap. Record owned process identities/ports and protected-root comparison. Rehash original473 result/audit/wire/SQLite and selected browser files after cleanup.',
        'Hand root hashes and evidence scope. Do not rerun canonical/daily, edit the ledger/trail, promote statuses, deploy, delete historical evidence or write root files.'
    ],
    'limits': ['No build, test, server, browser, simulation or checkout move occurred in preparation.',
        'The dispatcher was parsed with Python ast only; its runtime and cancellation paths have not been executed. Root can statically review it before dispatch.',
        'The existing supervisor is copied byte-for-byte. Its historical review remains historical; this plan binds its current bytes to the new source/proof pin.',
        'Fresh package hashes and fresh browser version/feature observations will exist only after the held retry.'],
    'functionalRuns': 0, 'checkoutMoves': 0, 'sharedRootWrites': 0,
}
write_json(out/'plan.json', plan)
read_back = json.loads((out/'plan.json').read_bytes())
assert read_back['targetPin'] == PIN and read_back['freshPaths']['hostedOutput'] == str(fresh)
assert git('rev-parse','HEAD').decode().strip() == OLD
assert git('status','--porcelain','--untracked-files=no') == b''
assert protected_snapshot() == protected
for record in preserved:
    assert file_record(Path(record['path'])) == record
inventory = {p.name: file_record(p) for p in sorted(out.iterdir()) if p.is_file()}
write_json(out/'packet-manifest.json', {'producer':plan['producer'], 'targetPin':PIN,
    'scope':'Bounded preparation packet only; raw original473 runtime data stays in place.', 'files':inventory,
    'totalBytes':sum(x['bytes'] for x in inventory.values())})
verification = {'plan':file_record(out/'plan.json'), 'manifest':file_record(out/'packet-manifest.json'),
    'preparedSourceFiles':len(files), 'targetSourceSha256':source['sha256'], 'buildId':source['buildId'],
    'proofBrowserSha256':proofs['scripts/server/verify-hosted-teams-browser.mjs']['sha256'],
    'headlessExecutableSha256':next(x['sha256'] for x in runtime_files if x['path']==str(headless)),
    'copiedSupervisorBytesEqualOriginal':True, 'pythonDispatcherAstParsed':True,
    'original473ArtifactsBytesUnchanged':True, 'protectedRootPreparationReadsUnchanged':True,
    'ownedCheckoutStill473AndTrackedClean':True, 'packetFiles':len(inventory),
    'packetBytesExcludingManifest':sum(x['bytes'] for x in inventory.values()), 'functionalRuns':0,
    'checkoutMoves':0, 'sharedRootWrites':0, 'status':'Held'}
write_json(out/'verification.json',verification)
print(json.dumps(verification,indent=2))
