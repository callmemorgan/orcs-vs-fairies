import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tarfile
import time
import urllib.request

PACKET = Path('/tmp/ovf-faction-827-readiness-20261001-r2')
PLAN_BYTES = (PACKET / 'execution-plan.json').read_bytes()
if hashlib.sha256(PLAN_BYTES).hexdigest() != '53feafc6b5d9bee15dd2c20ae0b85e2485410b5e8e88666ee49e9b45f8469893':
    raise RuntimeError('Reviewed plan changed')
PLAN = json.loads(PLAN_BYTES)
OWN = Path(PLAN['ownedCheckout'])
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
OUT = Path(PLAN['evidenceParent'])
LOGS = OUT / 'logs'

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def save(name, value):
    value['supportSourceSha256'] = digest(Path(__file__).read_bytes())
    with (LOGS / name).open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'receipt': str(LOGS / name), 'sha256': digest((LOGS / name).read_bytes())}))

def git(*args):
    return subprocess.check_output(['git', '--no-replace-objects', *args], cwd=OWN, text=True).strip()

def inventory(base):
    if not base.is_dir() or base.is_symlink():
        raise RuntimeError('Inventory root is not a real directory: ' + str(base))
    entries = {}
    for current, dirs, files in os.walk(base, followlinks=False):
        for name in sorted(dirs + files):
            path = Path(current) / name
            info = path.lstat()
            rel = path.relative_to(base).as_posix()
            if stat.S_ISLNK(info.st_mode):
                entries[rel] = {'kind': 'symlink', 'target': os.readlink(path)}
            elif stat.S_ISDIR(info.st_mode):
                entries[rel] = {'kind': 'directory'}
            elif stat.S_ISREG(info.st_mode):
                h = hashlib.sha256()
                with path.open('rb') as stream:
                    while data := stream.read(1024 * 1024):
                        h.update(data)
                entries[rel] = {'kind': 'file', 'bytes': info.st_size, 'mode': stat.S_IMODE(info.st_mode), 'sha256': h.hexdigest()}
            else:
                raise RuntimeError('Unexpected inventory kind: ' + str(path))
    return entries

def protected_pid():
    proc = Path('/proc/1063')
    return {'pid': 1063, 'startTimeTicks': (proc / 'stat').read_text().split(') ', 1)[1].split()[19], 'cwd': os.readlink(proc / 'cwd'), 'commandBase64': base64.b64encode((proc / 'cmdline').read_bytes()).decode()}

def ports():
    return subprocess.check_output(['ss', '-ltnp', '( sport = :4173 or sport = :5298 )'], text=True)

def source_check():
    preflight = json.loads((OUT / 'preflight-readiness.json').read_bytes())
    inputs = {**preflight['productInputs'], **preflight['acceptanceInventory'], **preflight['requiredHistoricalTestInputs'], **preflight['selectedFocusedTestFiles'], **preflight['reachableLocalTestDependencies']}
    for rel, item in inputs.items():
        path = OWN / rel
        info = path.lstat()
        data = path.read_bytes()
        mode = '100755' if info.st_mode & 73 else '100644'
        if path.is_symlink() or not stat.S_ISREG(info.st_mode) or len(data) != item['bytes'] or digest(data) != item['sha256'] or mode != item['mode']:
            raise RuntimeError('Owned input differs: ' + rel)
    if git('rev-parse', 'HEAD') != PLAN['executionPin'] or git('status', '--porcelain'):
        raise RuntimeError('Owned source is not clean at execution pin')
    return len(inputs)

def asset_inventory():
    entries = inventory(OWN / 'dist')
    preflight = json.loads((OUT / 'preflight-readiness.json').read_bytes())
    public = {rel: item for rel, item in preflight['productInputs'].items() if rel.startswith('public/')}
    for rel, item in public.items():
        copied = entries.get(rel[len('public/'):])
        if not copied or copied['kind'] != 'file' or copied['bytes'] != item['bytes'] or copied['sha256'] != item['sha256']:
            raise RuntimeError('Built public asset differs: ' + rel)
    if any(item['kind'] == 'symlink' for item in entries.values()):
        raise RuntimeError('Built dist contains a symlink')
    return entries, public

mode = sys.argv[1]
if mode == 'baseline':
    source_count = source_check()
    prior = json.loads((OWN.parent / 'faction-native-827-20261001-r1/logs/protection-baseline.json').read_bytes())
    dependencies = inventory(ROOT / 'node_modules')
    root_dist = inventory(ROOT / 'dist')
    identity = protected_pid()
    if dependencies != prior['installedDependencies'] or root_dist != prior['rootDist']:
        raise RuntimeError('Installed packages or protected root dist changed since r1')
    if identity != {'pid': 1063, 'startTimeTicks': prior['protectedPidStartTimeTicks'], 'cwd': prior['protectedPidCwd'], 'commandBase64': prior['protectedPidCommandBase64']}:
        raise RuntimeError('Protected PID identity changed')
    port_state = ports()
    if ':5298' in port_state or ':4173' not in port_state or 'pid=1063,' not in port_state:
        raise RuntimeError('Owned or protected port differs before runtime')
    save('protection-baseline.json', {'kind': 'r2-runtime-protection-baseline', 'capturedAt': now(), 'executionPin': PLAN['executionPin'], 'verifiedOwnedInputFiles': source_count, 'installedDependencies': dependencies, 'rootDist': root_dist, 'protectedPidIdentity': identity, 'ports': port_state, 'completeTreesMatchR1': True})
    save('start.receipt.json', {'kind': 'root-authorized-r2-start', 'startedAt': now(), 'executionPin': PLAN['executionPin'], 'executionPlanSha256': digest(PLAN_BYTES), 'reviewedReadinessSha256': digest((PACKET / 'readiness-r2.json').read_bytes()), 'freshPreflightSha256': digest((OUT / 'preflight-readiness.json').read_bytes()), 'runPath': str(OUT), 'releaseAuthority': 'Root explicitly released sole heavy slot after combat f18 cleanup; original admitted r2 only', 'phaseRunnerSha256': digest((LOGS / 'phase-runner.py').read_bytes()), 'protectedRootPort': 4173, 'protectedRootPid': 1063, 'ownedPreviewPort': 5298, 'retryPerformed': False})
    print(json.dumps({'sourceFiles': source_count, 'dependencyEntries': len(dependencies), 'protectedDistEntries': len(root_dist)}))
elif mode == 'link':
    env = os.environ.copy()
    env.update(PLAN['dependencyLinkEnvironment'])
    env.pop('ESBUILD_BINARY_PATH', None)
    start = now()
    with (LOGS / 'dependency-link.stdout.log').open('xb') as out, (LOGS / 'dependency-link.stderr.log').open('xb') as err:
        result = subprocess.run(PLAN['dependencyLinkCommand'], cwd=OWN, env=env, stdout=out, stderr=err)
    save('dependency-link.receipt.json', {'kind': 'approved-private-package-links', 'argv': PLAN['dependencyLinkCommand'], 'cwd': str(OWN), 'sourcePin': PLAN['executionPin'], 'environmentOverrides': PLAN['dependencyLinkEnvironment'], 'start': start, 'end': now(), 'exitCode': result.returncode, 'installedPackageMutationAuthorized': False})
    raise SystemExit(result.returncode)
elif mode == 'built-assets':
    entries, public = asset_inventory()
    save('complete-built-assets.json', {'kind': 'complete-actual-dist-and-public-inventory', 'capturedAt': now(), 'executionPin': PLAN['executionPin'], 'dist': entries, 'publicInputs': public, 'publicAssetCount': len(public), 'publicCopiesMatchFrozenSource': True, 'distIsSeparateFromOriginalHtmlJsCssFreeze': True})
    print(json.dumps({'actualDistEntries': len(entries), 'actualDistFiles': sum(item['kind'] == 'file' for item in entries.values()), 'publicAssets': len(public)}))
elif mode == 'preview-start':
    for name in ('preview.stdout.log', 'preview.stderr.log'):
        with (LOGS / name).open('xb'):
            pass
    start = now()
    with (LOGS / 'preview-start.stdout.log').open('xb') as out, (LOGS / 'preview-start.stderr.log').open('xb') as err:
        result = subprocess.run(PLAN['preview']['supervisorArgv'], cwd=OWN, stdout=out, stderr=err)
    state = subprocess.run(['systemctl', '--user', 'show', PLAN['preview']['unit'], '--property=LoadState,ActiveState,SubState,MainPID,ControlGroup'], text=True, capture_output=True)
    observation = {'argv': PLAN['preview']['supervisorArgv'], 'sourcePin': PLAN['executionPin'], 'cwd': str(OWN), 'start': start, 'observedAt': now(), 'exitCode': result.returncode, 'unit': PLAN['preview']['unit'], 'unitStateExitCode': state.returncode, 'unitStateStdout': state.stdout, 'unitStateStderr': state.stderr, 'readiness': False}
    if result.returncode == 0:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen('http://127.0.0.1:5298', timeout=2) as response:
                    data = response.read()
                if data != (OWN / 'dist/index.html').read_bytes():
                    raise RuntimeError('Preview HTML differs from owned dist')
                observation.update({'readiness': True, 'readyAt': now(), 'servedHtmlSha256': digest(data)})
                break
            except (ConnectionError, OSError) as error:
                observation['lastReadinessError'] = str(error)
                time.sleep(.25)
    save('preview.receipt.json', observation)
    if result.returncode or not observation['readiness']:
        raise RuntimeError('Owned preview did not become ready')
    print(json.dumps({'unit': PLAN['preview']['unit'], 'state': state.stdout, 'readiness': True}))
elif mode == 'cleanup':
    unit_states = []
    for unit in [phase['unit'] for phase in PLAN['phases']] + [PLAN['preview']['unit']]:
        argv = ['systemctl', '--user', 'show', unit, '--property=LoadState,ActiveState,SubState,MainPID,ControlGroup']
        result = subprocess.run(argv, text=True, capture_output=True)
        before = {'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
        stop = None
        if 'ActiveState=active\n' in result.stdout or 'ActiveState=activating\n' in result.stdout:
            stopped = subprocess.run(['systemctl', '--user', 'stop', unit], text=True, capture_output=True)
            stop = {'exitCode': stopped.returncode, 'stdout': stopped.stdout, 'stderr': stopped.stderr}
            if stopped.returncode:
                raise RuntimeError('Unable to stop exact owned unit ' + unit)
            result = subprocess.run(argv, text=True, capture_output=True)
        if 'ActiveState=active\n' in result.stdout or 'MainPID=0\n' not in result.stdout:
            raise RuntimeError('Owned unit remains active ' + unit)
        unit_states.append({'unit': unit, 'argv': argv, 'before': before, 'stop': stop, 'after': {'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}})
    runtime = []
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        try:
            command = (proc / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
            exe = os.readlink(proc / 'exe')
            cwd = os.readlink(proc / 'cwd')
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
        if os.path.basename(exe).split()[0] in ('node', 'chrome', 'chromium', 'systemd-run') and (str(OWN) in command or str(OUT) in command or cwd == str(OWN)):
            runtime.append({'pid': int(proc.name), 'exe': exe, 'cwd': cwd, 'command': command})
    if runtime:
        raise RuntimeError('Owned runtime remains: ' + repr(runtime))
    target = OWN / 'node_modules'
    archive = None
    private = None
    if target.exists() or target.is_symlink():
        if not target.is_dir() or target.is_symlink():
            raise RuntimeError('Owned dependency root is not a private real directory')
        private = inventory(target)
        archive_path = LOGS / 'owned-node-modules-after-run.tar.gz'
        with tarfile.open(archive_path, 'x:gz', dereference=False) as tar:
            tar.add(target, arcname='node_modules', recursive=True)
        archive = {'path': str(archive_path), 'bytes': archive_path.stat().st_size, 'sha256': digest(archive_path.read_bytes())}
        shutil.rmtree(target)
    source_count = source_check()
    baseline = json.loads((LOGS / 'protection-baseline.json').read_bytes())
    dependencies = inventory(ROOT / 'node_modules')
    root_dist = inventory(ROOT / 'dist')
    identity = protected_pid()
    port_state = ports()
    if dependencies != baseline['installedDependencies'] or root_dist != baseline['rootDist'] or identity != baseline['protectedPidIdentity']:
        raise RuntimeError('Protected dependencies, root dist or PID changed')
    if ':5298' in port_state or ':4173' not in port_state or 'pid=1063,' not in port_state:
        raise RuntimeError('Owned listener remains or protected preview differs')
    built = None
    if (LOGS / 'complete-built-assets.json').exists():
        initial = json.loads((LOGS / 'complete-built-assets.json').read_bytes())
        final_dist, public = asset_inventory()
        if final_dist != initial['dist'] or public != initial['publicInputs']:
            raise RuntimeError('Owned actual dist or public identity changed after build')
        built = {'allActualDistEntriesUnchanged': True, 'dist': final_dist, 'publicAssetCount': len(public), 'publicCopiesMatchFrozenSource': True}
    save('cleanup.receipt.json', {'kind': 'r2-scoped-cleanup-and-complete-protection-check', 'capturedAt': now(), 'executionPin': PLAN['executionPin'], 'verifiedOwnedInputFiles': source_count, 'ownedSourceStatus': git('status', '--porcelain'), 'ownedUnits': unit_states, 'ownedRuntimeProcesses': runtime, 'ports': port_state, 'sourceAndHistoricalInputsUnchanged': True, 'installedDependenciesMatchCompleteBaseline': True, 'installedDependencyEntries': len(dependencies), 'rootDistMatchesCompleteBaseline': True, 'rootDistEntries': len(root_dist), 'protectedPidIdentityUnchanged': True, 'privateDependencyDirectoryAbsent': not target.exists(), 'privateDependencyInventory': private, 'privateDependencyArchive': archive, 'completeBuiltAssets': built, 'retryPerformed': False})
    print(json.dumps({'clean': True, 'verifiedOwnedInputs': source_count, 'installedDependencyEntries': len(dependencies), 'protectedDistEntries': len(root_dist), 'runtimeProcesses': runtime, 'ownedPortClosed': True, 'rootPreviewPreserved': True}))
else:
    raise RuntimeError('Unknown support action')
