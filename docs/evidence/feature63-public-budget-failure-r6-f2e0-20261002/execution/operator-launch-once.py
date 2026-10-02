import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

OPERATOR = Path('/tmp/ovf-feature63-r6-capture-execution-xjoswxem')
BINDINGS = Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02')
CHECKOUT = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
CONTROL = Path('/tmp/ovf-feature63-r6-capture-control-2crngtsw')
PREFIX = CHECKOUT / 'work/feature63-human-wave-composition-r6'
PIN = 'f2e0025937b8caf5dc8f6f9f3de134d92a2d547a'
TOKEN = 'heavy-runtime-1-feature63-r6-f2e0025937b8-xyvt_n02'
EXPECTED = {
    'capture-assignment.json': (6958, '470e711127a4bb12c9e00e30a06a97529e2bd0e46ade9d1da6d637f1931210e5'),
    'root-capture-disposition.json': (1183, '06e2eb935c28da4a34b42634162e4d14c616dc3797058de41be3d13fea5331c5'),
    'launch-capture.r6.py': (19765, '0b8872f913edecc1527ddf891f9145d513144142f42b2fc258089f3a4d59edc4'),
}

def now():
    return datetime.datetime.now(datetime.timezone.utc)

def descriptor(path):
    assert path.resolve() == path and path.is_file() and not path.is_symlink(), path
    data = path.read_bytes()
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

assert Path.cwd() == CHECKOUT
assert stat.S_IMODE(OPERATOR.stat().st_mode) == 0o700
authenticated = {}
for filename, (byte_count, digest) in EXPECTED.items():
    actual = descriptor(BINDINGS / filename)
    assert actual['bytes'] == byte_count and actual['sha256'] == digest, filename
    authenticated[filename] = actual

assignment = json.loads((BINDINGS / 'capture-assignment.json').read_text())
disposition = json.loads((BINDINGS / 'root-capture-disposition.json').read_text())
root_readback_path = BINDINGS / 'root-independent-prelaunch-readback.json'
root_readback = json.loads(root_readback_path.read_text())
assert root_readback['sourcePin'] == assignment['sourcePin'] == disposition['sourcePin'] == PIN
assert root_readback['assignment'] == authenticated['capture-assignment.json']
assert root_readback['launcher'] == authenticated['launch-capture.r6.py']
assert root_readback['runtimeNotExecutedYet'] is True
assert root_readback['currentSourceBothRootsAndWholeProductBuildDependencySetsAuthenticated'] is True
assert root_readback['launcherOnlyReviewedLiteralAndAnchorChanges'] is True
assert root_readback['freshControlEmpty700'] is True
assert root_readback['counts'] == [966, 570, 397, 398, 22, 114, 303]
assert root_readback['unobservedDescendantsExcluded'] is False
assert assignment['approved'] is True and assignment['assignedBy'] == '/root' and assignment['phase'] == 'capture'
assert disposition['captureAdmitted'] is True and disposition['captureInvocationsAuthorized'] == 1
assert disposition['slotExclusivelyAssignedTo'] == '/root/ai_modes' and disposition['noAutomaticRetryAuthorized'] is True
assert assignment['exclusiveHeavyApproval'] == disposition['slot']
assert assignment['exclusiveHeavyApproval']['token'] == TOKEN
assert now() < datetime.datetime.fromisoformat(assignment['exclusiveHeavyApproval']['validUntil'])
assert assignment['freshPrefix'] == 'work/feature63-human-wave-composition-r6'
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

command = [assignment['pythonExecutable']['path'], str(BINDINGS / 'launch-capture.r6.py')]
write_once('prelaunch-authentication.json', {
    'at': now().isoformat(), 'authenticatedBindings': authenticated, 'rootReadback': descriptor(root_readback_path),
    'sourcePin': PIN, 'slot': assignment['exclusiveHeavyApproval'], 'controlEmpty700': True,
    'prefixContainsOnlyDistAndServer': True, 'webFiles': len(build['webRecords']),
    'serverFiles': len(build['serverRecords']), 'protectedDistFiles': 397, 'protectedBefore': before,
    'command': command, 'cwd': str(CHECKOUT), 'captureInvocationsAuthorized': 1, 'automaticRetries': 0,
    'operatorDatabaseReadsHashesSealsCopiesOrAudits': False,
})
assert not list(CONTROL.iterdir()) and {path.name for path in PREFIX.iterdir()} == {'dist', 'server'}
assert now() < datetime.datetime.fromisoformat(assignment['exclusiveHeavyApproval']['validUntil'])
print(json.dumps({'operatorDirectory': str(OPERATOR), 'prelaunchAuthenticated': True, 'launchInvocations': 1}), flush=True)
stdout = os.fdopen(os.open(OPERATOR / 'launcher.stdout', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb')
stderr = os.fdopen(os.open(OPERATOR / 'launcher.stderr', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb')
process = subprocess.Popen(command, cwd=CHECKOUT, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr)
write_once('operator-launch.json', {'at': now().isoformat(), 'launcherPid': process.pid, 'command': command,
                                 'cwd': str(CHECKOUT), 'concreteLauncherInvocations': 1, 'automaticRetries': 0})
code = process.wait()
stdout.close()
stderr.close()
after = protected_identity(assignment)
complete_tree(ROOT / 'dist', protected_rows)
result = {'at': now().isoformat(), 'concreteLauncherExitCode': code, 'concreteLauncherInvocations': 1,
          'automaticRetries': 0, 'protectedAfter': after, 'protectedDist397Unchanged': True,
          'rootDispositionRequired': True, 'slotReleased': False, 'operatorDatabaseReadHashedCopiedSealedOrAudited': False}
write_once('operator-result.json', result)
print(json.dumps({'operatorDirectory': str(OPERATOR), **result}), flush=True)
