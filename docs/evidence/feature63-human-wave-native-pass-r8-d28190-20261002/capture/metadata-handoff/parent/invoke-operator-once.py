import datetime
import hashlib
import json
import os
from pathlib import Path
import select
import stat
import subprocess
import sys

DIRECTORY = Path(__file__).parent
OPERATOR = Path('/tmp/ovf-feature63-r8-capture-execution-pdp0sxap/operator-launch-once.py')
RECEIPT = Path('/tmp/ovf-root-feature63-r8-capture-dispatch-cphuh098/root-dispatch.json')
ARGV = ['/home/linuxbrew/.linuxbrew/Cellar/python@3.14/3.14.7/bin/python3.14', str(OPERATOR)]
CWD = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns, info.st_mode, info.st_nlink, info.st_uid, info.st_gid)

def authenticated(path, count, digest):
    if path.resolve() != path or path.is_symlink():
        raise RuntimeError('Noncanonical source')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size != count or stat.S_IMODE(before.st_mode) != 0o400:
            raise RuntimeError('Source bytes or mode differ')
        raw = b''
        while len(raw) < count:
            chunk = os.read(fd, min(count - len(raw), 1024 * 1024))
            if not chunk:
                raise RuntimeError('Short source read')
            raw += chunk
        if os.read(fd, 1) or identity(before) != identity(os.fstat(fd)) or identity(before) != identity(path.stat()):
            raise RuntimeError('Source read unstable')
        if hashlib.sha256(raw).hexdigest() != digest:
            raise RuntimeError('Source hash differs')
        return raw, {'path': str(path), 'bytes': len(raw), 'mode': 0o400, 'sha256': digest, 'identity': list(identity(before))}
    finally:
        os.close(fd)

def write_once(name, value):
    raw = value if isinstance(value, bytes) else (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
    path = DIRECTORY / name
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as file:
        file.write(raw)
    os.chmod(path, 0o400)
    return {'path': str(path), 'bytes': len(raw), 'mode': 0o400, 'sha256': hashlib.sha256(raw).hexdigest()}

if sys.flags.optimize != 0 or 'PYTHONOPTIMIZE' in os.environ:
    raise RuntimeError('Parent optimization forbidden')
raw, receipt_descriptor = authenticated(RECEIPT, 1736, '0c1c414fac04f086129492f37b6fff303e7e4467c9575eda8903ec531ecb01cb')
receipt = json.loads(raw)
if not (receipt['schema'] == 'feature63-r8-root-explicit-once-capture-dispatch-v1' and receipt['approved'] is True and receipt['assignedBy'] == '/root' and receipt['holder'] == '/root/ai_modes' and receipt['captureInvocationsAuthorized'] == 1 and receipt['automaticRetriesAuthorized'] == 0 and receipt['argv'] == ARGV and receipt['cwd'] == str(CWD) and receipt['sourcePin'] == 'd28190fcd376156d6af016cd62fab8915d719fa7' and receipt['slotToken'] == 'heavy-runtime-1-feature63-r8-d28190fcd376-8v654jsk'):
    raise RuntimeError('Root dispatch fields differ')
receipt_copy = write_once('root-dispatch.literal.json', raw)
env = dict(os.environ)
original_optimization_present = 'PYTHONOPTIMIZE' in env
env.pop('PYTHONOPTIMIZE', None)
if 'PYTHONOPTIMIZE' in env or any(arg in ('-O', '-OO') for arg in ARGV):
    raise RuntimeError('Child optimization forbidden')
_, operator_descriptor = authenticated(OPERATOR, 12529, 'fda6656f6a77fddf1fb80b5afc986dc49c52bbc66f554dc9ffab6aea591d48f4')
authentication = write_once('parent-dispatch-authentication.json', {'schema': 'feature63-r8-parent-one-shot-authentication-v1', 'at': now(), 'rootDispatch': receipt_descriptor, 'rootDispatchLiteralCopy': receipt_copy, 'operator': operator_descriptor, 'actualArgv': ARGV, 'cwd': str(CWD), 'effectiveEnvironment': {'inheritsParentExceptRemovedKeys': ['PYTHONOPTIMIZE'], 'PYTHONOPTIMIZEPresentBeforeRemoval': original_optimization_present, 'PYTHONOPTIMIZEPresentAfterRemoval': False}, 'parentPythonExecutable': sys.executable, 'parentPythonOptimize': sys.flags.optimize, 'optimizationFlagsInActualArgv': False, 'captureInvocationsAuthorized': 1, 'automaticRetries': 0, 'slotReleaseAuthorized': False, 'databaseAccessAuthorized': False})
_, immediate = authenticated(OPERATOR, 12529, 'fda6656f6a77fddf1fb80b5afc986dc49c52bbc66f554dc9ffab6aea591d48f4')
if immediate != operator_descriptor:
    raise RuntimeError('Operator changed immediately before execution')
process = subprocess.Popen(ARGV, cwd=CWD, env=env, stdin=subprocess.DEVNULL)
pidfd = os.pidfd_open(process.pid, 0)
poll = select.poll()
poll.register(pidfd, select.POLLIN)
initial_ready = poll.poll(0)
process_stat = Path('/proc') / str(process.pid) / 'stat'
try:
    stat_raw = process_stat.read_text()
    fields = stat_raw[stat_raw.rfind(')') + 2:].split()
    start_ticks = int(fields[19])
except FileNotFoundError:
    start_ticks = None
invocation = write_once('parent-operator-invocation.json', {'schema': 'feature63-r8-parent-actual-one-shot-invocation-v1', 'at': now(), 'authentication': authentication, 'parentPid': os.getpid(), 'actualOperatorPid': process.pid, 'actualOperatorStartTicks': start_ticks, 'actualArgv': ARGV, 'cwd': str(CWD), 'PYTHONOPTIMIZEPresentInActualEnvironment': 'PYTHONOPTIMIZE' in env, 'optimizationFlagsInActualArgv': False, 'concreteOperatorInvocations': 1, 'automaticRetries': 0, 'independentHeldPidfd': {'fdInParent': pidfd, 'openedAfterActualSpawn': True, 'initialPollEvents': initial_ready}, 'databaseReadHashedQueriedSealedCopied': False, 'slotReleased': False})
print(json.dumps({'at': now(), 'actualOperatorPid': process.pid, 'actualOperatorStartTicks': start_ticks, 'concreteOperatorInvocations': 1, 'actualArgv': ARGV, 'cwd': str(CWD), 'PYTHONOPTIMIZEPresent': False, 'invocation': invocation}), flush=True)
code = process.wait()
ready = poll.poll(0)
completion = write_once('parent-operator-completion.json', {'schema': 'feature63-r8-parent-actual-one-shot-completion-v1', 'at': now(), 'invocation': invocation, 'actualOperatorPid': process.pid, 'actualOperatorStartTicks': start_ticks, 'actualOperatorExitCode': code, 'concreteOperatorInvocations': 1, 'automaticRetries': 0, 'independentHeldPidfd': {'fdInParent': pidfd, 'heldThroughOperatorWait': True, 'finalPollEvents': ready, 'readyForExit': any(mask & select.POLLIN for _, mask in ready)}, 'databaseReadHashedQueriedSealedCopied': False, 'slotReleased': False, 'rootDispositionRequired': True, 'unobservedDescendantsExcluded': False, 'feature63Qualified': False})
print(json.dumps({'at': now(), 'actualOperatorExitCode': code, 'concreteOperatorInvocations': 1, 'completion': completion, 'slotReleased': False}), flush=True)
os.close(pidfd)
sys.exit(code)
