import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import traceback

OPERATOR = Path('/tmp/ovf-feature63-r7-capture-execution-1hxb_yrj')
BINDINGS = Path('/tmp/ovf-root-feature63-r7-bindings-wnogqe6l')
CHECKOUT = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
CONTROL = Path('/tmp/ovf-feature63-r7-capture-control-bm4i57oz')
PREFIX = CHECKOUT / 'work/feature63-human-wave-composition-r7'
PIN = 'a8152d0dc83dff49fb93f09606e7bbf2c3510894'
TOKEN = 'heavy-runtime-1-feature63-r7-a8152d0dc83d-wnogqe6l'
EXPECTED = {
    'capture-assignment.json': (6958, '7291c791bfcc16f303f424b8df42bb927d2da388b97957af50123cb10de01984'),
    'root-capture-disposition.json': (1183, '0745a56d40943da558fdb48565fe9b5f4019fc170a0b8445d8c5021c8dde16cd'),
    'launch-capture.r7.py': (19765, 'd3b2b92ada67e8ece37c933d9405aedd4e918d90d353687a038c1298408d071d'),
}

class Mirror:
    def __init__(self, original, path):
        self.original = original
        self.file = os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w')
    def write(self, text):
        self.file.write(text)
        self.file.flush()
        return self.original.write(text)
    def flush(self):
        self.file.flush()
        self.original.flush()

sys.stdout = Mirror(sys.stdout, OPERATOR / 'supervisor.stdout')
sys.stderr = Mirror(sys.stderr, OPERATOR / 'supervisor.stderr')

def retain_exception(kind, value, trace):
    traceback.print_exception(kind, value, trace, file=sys.stderr)
    payload = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'type': kind.__name__,
               'message': str(value), 'concreteLauncherDispatchRecordExists': (OPERATOR / 'operator-launch.json').exists(),
               'slotReleased': False, 'automaticRetries': 0, 'rootDispositionRequired': True}
    fd = os.open(OPERATOR / 'supervisor-failure.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as file:
        file.write(json.dumps(payload, indent=2) + '\n')

sys.excepthook = retain_exception

def now():
    return datetime.datetime.now(datetime.timezone.utc)

def descriptor(path):
    assert path.resolve() == path and path.is_file() and not path.is_symlink(), path
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        assert stat.S_ISREG(before.st_mode)
        data = bytearray()
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            data.extend(chunk)
        after = os.fstat(fd)
        current = path.stat()
        stable = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns, value.st_mode)
        assert stable(before) == stable(after) == stable(current), path
    finally:
        os.close(fd)
    return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def write_once(name, value):
    data = (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
    fd = os.open(OPERATOR / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as file:
        file.write(data)

def bound(value):
    actual = descriptor(Path(value['path']))
    assert actual == value, (actual, value)
    return actual

def complete_tree(base, rows):
    assert base.is_dir() and not base.is_symlink()
    for row in rows:
        path = base / row['path']
        assert descriptor(path) == {'path': str(path), 'bytes': row['bytes'], 'sha256': row['sha256']}, path
        mode = int(row['mode'], 8) if isinstance(row['mode'], str) else row['mode']
        assert stat.S_IMODE(path.stat().st_mode) == mode, path
    assert {row['path'] for row in rows} == {str(path.relative_to(base)) for path in base.rglob('*') if path.is_file()}

def listeners(port):
    result = set()
    for name in ('tcp', 'tcp6'):
        for line in (Path('/proc/self/net') / name).read_text().splitlines()[1:]:
            fields = line.split()
            if fields[3] == '0A' and int(fields[1].rsplit(':', 1)[1], 16) == port:
                result.add('socket:[' + fields[9] + ']')
    return sorted(result)

def protected_identity(assignment):
    process = Path('/proc/1063')
    first = (process / 'stat').read_text()
    one = first[first.rfind(')') + 2:].split()
    actual = {'pid': 1063, 'startTicks': int(one[19]), 'executable': os.readlink(process / 'exe'),
              'cwd': os.readlink(process / 'cwd'),
              'argv': [part.decode() for part in (process / 'cmdline').read_bytes().split(b'\0') if part]}
    second = (process / 'stat').read_text()
    two = second[second.rfind(')') + 2:].split()
    assert int(one[19]) == int(two[19]) == 874 and int(one[3]) == int(two[3]) == 1063
    assert actual == assignment['protectedProcess']
    assert os.readlink(process / 'fd/22') == 'socket:[3783]'
    assert listeners(4173) == assignment['protectedListenerSockets'] == ['socket:[3783]']
    assert os.readlink(process / 'ns/net') == os.readlink('/proc/self/ns/net')
    return {'identity': actual, 'session': 1063, 'fd22': 'socket:[3783]', 'listeners4173': listeners(4173)}

assert sys.flags.optimize == 0
assert 'PYTHONOPTIMIZE' not in os.environ
assert os.path.samefile(sys.executable, '/home/linuxbrew/.linuxbrew/Cellar/python@3.14/3.14.7/bin/python3.14')
assert Path.cwd() == CHECKOUT
assert stat.S_IMODE(OPERATOR.stat().st_mode) == 0o700
authenticated = {}
for filename, (byte_count, digest) in EXPECTED.items():
    actual = descriptor(BINDINGS / filename)
    assert actual['bytes'] == byte_count and actual['sha256'] == digest, filename
    authenticated[filename] = actual

assignment = json.loads((BINDINGS / 'capture-assignment.json').read_text())
disposition = json.loads((BINDINGS / 'root-capture-disposition.json').read_text())
root_readback_path = Path('/tmp/ovf-feature63-r7-prelaunch-report-qyexlrq8/root-independent-prelaunch-readback.json')
assert descriptor(root_readback_path) == {'path': str(root_readback_path), 'bytes': 4053, 'sha256': 'de360bbc998a00a7866cbe89685a6f1557ce848d68f34ec49f3e38bbfec072c3'}
assert stat.S_IMODE(root_readback_path.stat().st_mode) == 0o400
root_readback = json.loads(root_readback_path.read_text())
assert root_readback['sourcePin'] == assignment['sourcePin'] == disposition['sourcePin'] == PIN
assert root_readback['status'] == 'PASS_ROOT_EXPECTATION_BOUND_R7_PRELAUNCH_AUTHENTICATION_ONLY'
for report_key, filename, mode in [('assignment', 'capture-assignment.json', 0o644), ('launcher', 'launch-capture.r7.py', 0o600), ('disposition', 'root-capture-disposition.json', 0o644)]:
    assert {key: root_readback[report_key][key] for key in ('path', 'bytes', 'sha256')} == authenticated[filename]
    assert root_readback[report_key]['mode'] == mode == stat.S_IMODE((BINDINGS / filename).stat().st_mode)
assert root_readback['captureLaunchedByThisUtility'] is False
assert root_readback['serverBrowserOrProductRuntimeLaunchedByThisUtility'] is False
assert root_readback['allBoundFilesAuthenticatedWithStableSingleFdReads'] is True
assert root_readback['launcherOnlyReviewedR3ToR7LiteralsAndRootAnchors'] is True
assert root_readback['rootAndOwnedHeadMatchExpectedPinAndTrackedStateClean'] is True
assert root_readback['control'] == {'path': str(CONTROL), 'mode': 0o700, 'empty': True}
assert root_readback['counts'] == {'sourceEachCheckout': 966, 'productEachCheckout': 570, 'protectedDist': 397, 'web': 398, 'server': 22, 'playwright': 114, 'chromium': 303}
assert root_readback['unobservedDescendantsExcluded'] is False
assert root_readback['slot'] == assignment['exclusiveHeavyApproval']
assert assignment['approved'] is True and assignment['assignedBy'] == '/root' and assignment['phase'] == 'capture'
assert disposition['captureAdmitted'] is True and disposition['captureInvocationsAuthorized'] == 1
assert disposition['slotExclusivelyAssignedTo'] == '/root/ai_modes' and disposition['noAutomaticRetryAuthorized'] is True
assert assignment['exclusiveHeavyApproval'] == disposition['slot']
assert assignment['exclusiveHeavyApproval']['token'] == TOKEN
assert now() < datetime.datetime.fromisoformat(assignment['exclusiveHeavyApproval']['validUntil'])
assert assignment['freshPrefix'] == 'work/feature63-human-wave-composition-r7'
assert {path.name for path in PREFIX.iterdir()} == {'dist', 'server'}
assert CONTROL.resolve() == CONTROL and CONTROL.is_dir() and not CONTROL.is_symlink()
assert stat.S_IMODE(CONTROL.stat().st_mode) == 0o700 and not list(CONTROL.iterdir())
for root in (ROOT, CHECKOUT):
    assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip() == PIN
    assert subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=root, text=True) == ''
for key in ('sourceBinding', 'buildBinding', 'testedBuildReceipt', 'reviewReceipt', 'browserBinding',
            'publicProducer', 'collector', 'auditor', 'nodeExecutable', 'pythonExecutable'):
    bound(assignment[key])
assert descriptor(CHECKOUT / 'scripts/feature63/run-minimal63.py')['sha256'] == assignment['wrapperSha256']
build = json.loads(Path(assignment['buildBinding']['path']).read_text())
assert Path(build['webDistPath']) == PREFIX / 'dist' and Path(build['serverBuildPath']) == PREFIX / 'server'
complete_tree(PREFIX / 'dist', build['webRecords'])
complete_tree(PREFIX / 'server', build['serverRecords'])
protected_rows = json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json').read_text())['dist']
assert len(protected_rows) == 397
complete_tree(ROOT / 'dist', protected_rows)
before = protected_identity(assignment)
assert listeners(5373) == listeners(5374) == []

command = [assignment['pythonExecutable']['path'], str(BINDINGS / 'launch-capture.r7.py')]
write_once('prelaunch-authentication.json', {
    'at': now().isoformat(), 'authenticatedBindings': authenticated, 'rootReadback': descriptor(root_readback_path),
    'sourcePin': PIN, 'slot': assignment['exclusiveHeavyApproval'], 'controlEmpty700': True,
    'prefixContainsOnlyDistAndServer': True, 'webFiles': len(build['webRecords']),
    'serverFiles': len(build['serverRecords']), 'protectedDistFiles': 397, 'protectedBefore': before,
    'command': command, 'cwd': str(CHECKOUT), 'captureInvocationsAuthorized': 1, 'automaticRetries': 0,
    'operatorDatabaseReadsHashesSealsCopiesOrAudits': False,
    'pythonFlagsOptimize': sys.flags.optimize, 'pythonOptimizeEnvironmentAbsent': 'PYTHONOPTIMIZE' not in os.environ,
    'launcherArgvHasNoOptimizationFlag': not any(argument in ('-O', '-OO') for argument in command),
})
assert not list(CONTROL.iterdir()) and {path.name for path in PREFIX.iterdir()} == {'dist', 'server'}
assert now() < datetime.datetime.fromisoformat(assignment['exclusiveHeavyApproval']['validUntil'])
print(json.dumps({'operatorDirectory': str(OPERATOR), 'prelaunchAuthenticated': True, 'launchInvocations': 1}), flush=True)
stdout = os.fdopen(os.open(OPERATOR / 'launcher.stdout', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb')
stderr = os.fdopen(os.open(OPERATOR / 'launcher.stderr', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb')
env = dict(os.environ)
env.pop('PYTHONOPTIMIZE', None)
assert sys.flags.optimize == 0 and 'PYTHONOPTIMIZE' not in env and not any(argument in ('-O', '-OO') for argument in command)
process = subprocess.Popen(command, cwd=CHECKOUT, env=env, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr)
write_once('operator-launch.json', {'at': now().isoformat(), 'launcherPid': process.pid, 'command': command,
                                 'cwd': str(CHECKOUT), 'concreteLauncherInvocations': 1, 'automaticRetries': 0,
                                 'pythonFlagsOptimize': sys.flags.optimize, 'pythonOptimizeEnvironmentAbsent': True})
code = process.wait()
stdout.close()
stderr.close()
after = protected_identity(assignment)
complete_tree(ROOT / 'dist', protected_rows)
result = {'at': now().isoformat(), 'concreteLauncherExitCode': code, 'concreteLauncherInvocations': 1,
          'automaticRetries': 0, 'protectedAfter': after, 'protectedDist397Unchanged': True,
          'rootDispositionRequired': True, 'slotReleased': False, 'operatorDatabaseReadHashedCopiedSealedOrAudited': False,
          'pythonFlagsOptimize': sys.flags.optimize, 'pythonOptimizeEnvironmentAbsent': True}
write_once('operator-result.json', result)
print(json.dumps({'operatorDirectory': str(OPERATOR), **result}), flush=True)
