#!/usr/bin/env python3
"""Read/hash terminal custody after first failure; never runs product code."""
from pathlib import Path
import datetime, hashlib, json, os, socket, stat, subprocess, urllib.request

BASE = Path('/tmp/ovf-scenario-453-readiness.yqkz996z/execution')
OUT = BASE / 'final-custody'
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'

def read(path):
    return json.loads(Path(path).read_text())

def raw(path):
    path = Path(path)
    h = hashlib.sha256()
    length = 0
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
            length += len(chunk)
    return {'sha256': h.hexdigest(), 'bytes': length}

errors = []
checks = {}

def verify(path, expected, category):
    try:
        got = raw(path)
        if any(got[k] != expected[k] for k in ('sha256', 'bytes')):
            errors.append({'category': category, 'path': str(path), 'expected': expected, 'observed': got})
        if 'modeOctal' in expected and oct(stat.S_IMODE(Path(path).stat().st_mode)) != expected['modeOctal']:
            errors.append({'category': category, 'path': str(path), 'modeChanged': True})
        return got
    except Exception as e:
        errors.append({'category': category, 'path': str(path), 'error': str(e)})

preflight = read(BASE / 'preflight/sealed-preflight.json')
independent = read('/tmp/ovf-scenario-453-readonly-preflight-3467gndi/audit.json')
for field in ('staticOriginalInputs', 'rawByteOriginAliases', 'historicalExternalInputs'):
    for item in independent[field]:
        verify(item['path'], item, field)
    checks[field] = len(independent[field])
for name, item in preflight['artifacts'].items():
    verify(item['path'], item, 'sealedPreflightInput:' + name)
checks['sealedPreflightBoundInputs'] = len(preflight['artifacts'])

source = read(BASE / 'preflight/source-authenticated.json')
for path, item in source['files'].items():
    verify(BASE / 'source' / path, item, 'frozenTrackedSource')
checks['frozenTrackedSource'] = len(source['files'])
root_application = {p: i for p, i in source['files'].items() if p.startswith(('src/', 'public/'))}
for path, item in root_application.items():
    verify(ROOT / path, item, 'protectedRootApplication')
checks['protectedRootApplication'] = len(root_application)
checks['sourceHead'] = subprocess.check_output(['git', '-C', str(BASE / 'source'), 'rev-parse', 'HEAD'], text=True).strip()
if checks['sourceHead'] != PIN:
    errors.append({'category': 'sourceHead', 'observed': checks['sourceHead']})
checks['sourceStatusPorcelain'] = subprocess.check_output(['git', '-C', str(BASE / 'source'), 'status', '--porcelain=v1', '--untracked-files=all'], text=True)

deps = read(BASE / 'preflight/dependency-and-root-before.json')
for name, item in deps['dependencies'].items():
    verify(item['path'], item, 'dependencyMetadata:' + name)
    verify(item['retainedPath'], item, 'retainedDependencyMetadata:' + name)
checks['dependencyMetadata'] = len(deps['dependencies'])
for name, item in deps['executables'].items():
    verify(item['resolvedPath'], item, 'executableEntry:' + name)
checks['executableEntry'] = len(deps['executables'])
for path, item in deps['protectedPreviewDistFiles'].items():
    verify(ROOT / path, item, 'protectedPreviewDist')
checks['protectedPreviewDist'] = len(deps['protectedPreviewDistFiles'])

producer = read(BASE / 'preflight/producer-read-map.json')
for inventory, root in [('packetInventory', 'packetRoot'), ('preparedInventory', 'preparedRoot')]:
    for path, item in producer[inventory].items():
        verify(Path(producer[root]) / path, item, 'admittedProducer:' + inventory)
    checks[inventory] = len(producer[inventory])

native = read(BASE / 'native/native-admission.json')
origin_map = []
for path, item in native['artifacts'].items():
    verify(path, item, 'nativeOriginal')
    retained = BASE / 'native' / item['retainedPath'] if item.get('retainedPath') else Path(path)
    verify(retained, item, 'nativeRetained')
    origin_map.append({'originPath': path, 'retainedPath': str(retained), **{k: item[k] for k in ('sha256', 'bytes')}, 'relocated': False})
checks['nativeArtifacts'] = len(origin_map)
checks['nativeSourceBeforeAfterEqual'] = (BASE / 'native/source-before.json').read_bytes() == (BASE / 'native/source-after.json').read_bytes()
if not checks['nativeSourceBeforeAfterEqual']:
    errors.append({'category': 'nativeSourceBeforeAfterEqual'})
checks['nativeFirstFailureAbsent'] = not (BASE / 'native/first-failure.txt').exists()
control = read(BASE / 'native-control/native-control-final.json')
checks['nativeControllerFinal'] = control
if control['nativeExitCode'] != 0 or control['failure'] or control['remainingOwnedLiveProcesses'] or control['retryPerformed']:
    errors.append({'category': 'nativeControllerFinal'})
fixture = read(BASE / 'primary-fixtures/generation-status.json')
checks['fixtureGenerationStatus'] = fixture
checks['fixturesManifestAbsent'] = not (BASE / 'primary-fixtures/fixtures.json').exists()
for name in ('server-build', 'browser-package', 'exclusive-db', 'unavailable-server-build', 'supplemental-fixtures'):
    checks[name + 'Absent'] = not (BASE / name).exists()
checks['browserOutputFiles'] = sorted(str(p.relative_to(BASE / 'browser-output')) for p in (BASE / 'browser-output').rglob('*') if p.is_file())

def process(pid):
    path = Path('/proc') / str(pid)
    try:
        proc_stat = (path / 'stat').read_text()
        fields = proc_stat[proc_stat.rfind(')') + 2:].split()
        cmdline = (path / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
        try:
            cwd = str((path / 'cwd').resolve(strict=True))
        except OSError:
            cwd = None
        return {'pid': int(pid), 'startTimeTicks': int(fields[19]), 'state': fields[0], 'ppid': int(fields[1]), 'pgid': int(fields[2]), 'cwd': cwd, 'cmdline': cmdline}
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        return None

baseline = read(BASE / 'preflight/protected-preview-before.json')
preview = process(baseline['pid'])
checks['protectedPreviewProcess'] = preview
if not preview or any(preview[k] != baseline[k] for k in ('pid', 'startTimeTicks', 'cwd', 'cmdline')):
    errors.append({'category': 'protectedPreviewIdentity'})
with urllib.request.urlopen(baseline['index']['url'], timeout=5) as response:
    body = response.read()
    index = {'status': response.status, 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'headers': dict(response.headers)}
checks['protectedPreviewIndex'] = index
if any(index[k] != baseline['index'][k] for k in ('status', 'sha256', 'bytes')):
    errors.append({'category': 'protectedPreviewIndex'})
(OUT / 'protected-preview-index-after.html').write_bytes(body)
owned = []
related = []
for pid in os.listdir('/proc'):
    if not pid.isdigit() or int(pid) == os.getpid():
        continue
    p = process(pid)
    if not p:
        continue
    if (p['cwd'] and p['cwd'].startswith(str(BASE))) or str(BASE) in p['cmdline'] or 'generate-browser-fixtures.mjs' in p['cmdline']:
        owned.append(p)
    elif 'esbuild' in p['cmdline']:
        related.append(p)
checks['ownedMatchingProcesses'] = owned
checks['otherEsbuildProcessesNotClaimedOrSignaled'] = related
checks['knownNativeControllerAndRunnerNow'] = [process(1539144), process(1539145)]
if any(p['state'] != 'Z' for p in owned):
    errors.append({'category': 'ownedLiveProcesses', 'processes': owned})
ports = {}
for port in (5307, 37823):
    with socket.socket() as s:
        s.settimeout(1)
        ports[str(port)] = {'connected': s.connect_ex(('127.0.0.2', port)) == 0}
checks['unlaunchedOwnedEndpoints'] = ports
if any(p['connected'] for p in ports.values()):
    errors.append({'category': 'unexpectedOwnedEndpoint', 'ports': ports})

recipes = []
for copied in sorted((OUT / 'raw-recipes').iterdir()):
    original = Path('/tmp/ovf-scenario-rules401-readiness.UCDZqh') / copied.name
    expected = raw(original)
    verify(copied, expected, 'recipeCopy')
    recipes.append({'originPath': str(original), 'retainedPath': str(copied), **expected})
checks['retainedExternalRecipeFiles'] = len(recipes)
(OUT / 'native-origin-map.json').write_text(json.dumps({'format': 'ovf-raw-origin-and-retained-path-map', 'version': 1, 'rawHashDomain': 'sha256-of-original-file-bytes', 'relocationsPerformed': False, 'entries': origin_map, 'recipeCopies': recipes}, indent=2) + '\n')
(OUT / 'custody-checks.json').write_text(json.dumps({'format': 'ovf-scenario-453-terminal-custody-checks', 'version': 1, 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'productFreeze': PIN, 'status': 'passed' if not errors else 'failed', 'checks': checks, 'errors': errors, 'limits': ['Generator used the direct exec tool, which returned exit1 with no persistent session; no generator descendant PID custody was assigned. The final direct process scan reports matching processes and leaves unrelated processes untouched.', 'Package metadata and executable entry bytes do not independently authenticate all dynamic libraries or transitive dependency files.', 'These custody checks run no simulation, fixture derivation, build, replay, gameplay or browser; failed canonical phase remains failed.']}, indent=2) + '\n')

files = {}
symlinks = {}
for directory, dirs, names in os.walk(BASE, followlinks=False):
    for name in list(dirs):
        path = Path(directory) / name
        if path.is_symlink():
            symlinks[str(path.relative_to(BASE))] = os.readlink(path)
            dirs.remove(name)
    for name in names:
        path = Path(directory) / name
        rel = str(path.relative_to(BASE))
        if path.is_symlink():
            symlinks[rel] = os.readlink(path)
        elif rel not in ('final-custody/complete-raw-inventory.json', 'final-custody/execution-admission.json'):
            files[rel] = {**raw(path), 'modeOctal': oct(stat.S_IMODE(path.stat().st_mode)), 'originalAbsolutePath': str(path)}
inventory = {'format': 'ovf-scenario-453-complete-raw-execution-inventory', 'version': 1, 'executionRoot': str(BASE), 'inventoryExcludesOnly': ['final-custody/complete-raw-inventory.json', 'final-custody/execution-admission.json'], 'symlinksNotTraversed': symlinks, 'fileCount': len(files), 'totalBytes': sum(x['bytes'] for x in files.values()), 'files': files, 'rawHashDomain': 'sha256-of-original-file-bytes', 'physicalCustody': 'All original paths stay present. No execution payload was moved or deleted; recipes alone have additional verified raw copies.'}
(OUT / 'complete-raw-inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
admission = {'format': 'ovf-scenario-453-bounded-execution-admission', 'version': 1, 'productFreeze': PIN, 'saveVersion': 4, 'simulationRevision': '4.0.1', 'status': 'native-passed; first-canonical-phase-failed; stopped-without-retry', 'nativeStatus': native['status'], 'nativeCounts': native['counts'], 'nativeWallSeconds': control['wallSeconds'], 'firstFailurePhase': 'primary-fixture-generator', 'firstFailure': fixture['failure'], 'followingPhasesAttempted': False, 'repairPerformed': False, 'retryPerformed': False, 'custodyCheckStatus': 'passed' if not errors else 'failed', 'remainingOwnedMatchingLiveProcesses': [p for p in owned if p['state'] != 'Z'], 'heavySlotReleasedByThisRecord': False, 'artifacts': {name: {'path': str(OUT / name), **raw(OUT / name)} for name in ['check-custody.py', 'fixture-generator-tool-result.json', 'fixture-generator-tool-output.log', 'custody-checks.json', 'native-origin-map.json', 'complete-raw-inventory.json']}, 'preservation': 'All originals, failed partial fixtures and full native packet stay intact. No root product/ledger/evidence edits or commits were made. Root owns imports, final decisions and subsequent dispatch.'}
(OUT / 'execution-admission.json').write_text(json.dumps(admission, indent=2) + '\n')
print(json.dumps({'custodyErrors': errors, 'fileCount': inventory['fileCount'], 'totalBytes': inventory['totalBytes'], 'admission': {'path': str(OUT / 'execution-admission.json'), **raw(OUT / 'execution-admission.json')}}))
raise SystemExit(1 if errors else 0)
