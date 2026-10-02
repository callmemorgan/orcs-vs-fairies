"""One admitted native invocation with a deadline and owned-process drain."""
import datetime
import ctypes
import hashlib
import json
import os
import pathlib
import signal
import subprocess
import sys
import time

execution = pathlib.Path('/tmp/ovf-scenario-453-readiness.yqkz996z/execution')
control = execution / 'native-control'
control.mkdir()
command = ['bash', '/tmp/ovf-scenario-rules401-readiness.UCDZqh/run-native.sh',
           str(execution / 'source'), '453c2218af9973b9eca8fb78392435bd9d46a740',
           '4.0.1', str(execution / 'native')]
if (execution / 'native').exists():
    raise RuntimeError('Native output already exists; no retry is permitted.')
if hashlib.sha256(pathlib.Path(command[1]).read_bytes()).hexdigest() != '1908122b4f016e96a0134e6398838bd3b03b480b562a97e85f811ecb946e5a22':
    raise RuntimeError('Accepted native recipe changed.')

def write(name, value):
    with (control / name).open('x') as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write('\n')

def processes():
    result = {}
    for entry in pathlib.Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            raw = (entry / 'stat').read_text()
            fields = raw[raw.rfind(')') + 2:].split()
            result[int(entry.name)] = {'pid': int(entry.name), 'ppid': int(fields[1]),
                'pgid': int(fields[2]), 'startTimeTicks': int(fields[19]), 'state': fields[0]}
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    return result

cancel = None
def cancelled(signum, _frame):
    global cancel
    cancel = signum
for owned_signal in [signal.SIGTERM, signal.SIGINT, signal.SIGHUP]:
    signal.signal(owned_signal, cancelled)

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
start_wall = time.monotonic()
deadline_seconds = 900
# Adopt every orphan from this single owned invocation, including workers that
# detach between observations. Identity-bound pidfds handle later signaling.
libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(36, 1, 0, 0, 0) != 0:
    raise OSError(ctypes.get_errno(), 'Cannot establish child subreaper custody')
if not hasattr(os, 'pidfd_open') or not hasattr(signal, 'pidfd_send_signal'):
    raise RuntimeError('Identity-bound process signaling is unavailable')
log = (control / 'native-invocation.log').open('xb')
child = subprocess.Popen(command, cwd=str(execution / 'source'), start_new_session=True,
                         stdout=log, stderr=subprocess.STDOUT)
initial = processes()
known = {child.pid: initial[child.pid]}
pidfds = {}
reaped_descendants = []
receipt = {'format': 'ovf-scenario-453-native-once-control-start', 'version': 1,
           'wrapper': initial[os.getpid()], 'child': initial[child.pid], 'command': command,
           'startedAt': started, 'deadlineSeconds': deadline_seconds,
           'source': str(execution / 'source'), 'output': str(execution / 'native'),
           'protectedPid': 1063, 'protectedStartTimeTicks': 874, 'retryPermitted': False,
           'subreaperCustody': True, 'signaling': 'pidfd_send_signal'}
write('native-control-start.json', receipt)
print(json.dumps(receipt), flush=True)

def observe():
    table = processes()
    active = {}
    # The live controller PID is never reused while this function executes.
    # Only its direct children are admitted; subreaper adoption exposes every
    # still-live deeper descendant after an ancestor exits.
    for pid, current in table.items():
        if current['ppid'] != os.getpid():
            continue
        if pid in pidfds and pidfds[pid]['startTimeTicks'] != current['startTimeTicks']:
            os.close(pidfds.pop(pid)['descriptor'])
        if pid not in pidfds:
            try:
                descriptor = os.pidfd_open(pid)
            except ProcessLookupError:
                continue
            confirmed = processes().get(pid)
            if confirmed is None or confirmed['startTimeTicks'] != current['startTimeTicks'] or confirmed['ppid'] != os.getpid():
                os.close(descriptor)
                continue
            pidfds[pid] = {'descriptor': descriptor, 'startTimeTicks': current['startTimeTicks']}
        known[pid] = current
        original_child = pid == child.pid and current['startTimeTicks'] == initial[child.pid]['startTimeTicks']
        if not original_child and current['state'] == 'Z':
            try:
                reaped, wait_status = os.waitpid(pid, os.WNOHANG)
                if reaped:
                    reaped_descendants.append({'pid': reaped, 'waitStatus': wait_status})
            except ChildProcessError:
                pass
        elif current['state'] != 'Z':
            active[pid] = current
    return active

failure = None
while child.poll() is None:
    observe()
    if cancel is not None or time.monotonic() - start_wall >= deadline_seconds:
        failure = 'cancelled' if cancel is not None else 'native deadline exceeded'
        break
    time.sleep(.25)

active = observe()
signals = []
if failure or child.poll() is not None:
    # A pidfd identifies the observed process across later numeric PID reuse.
    for signum, allowance in [(signal.SIGTERM, 5), (signal.SIGKILL, 5)]:
        drain_deadline = time.monotonic() + allowance
        sent = set()
        while time.monotonic() < drain_deadline:
            active = observe()
            if not active:
                break
            for pid, item in active.items():
                if pid == 1063:
                    raise RuntimeError('Protected process entered owned set; refusing cleanup.')
                identity = (pid, item['startTimeTicks'])
                if identity in sent:
                    continue
                try:
                    binding = pidfds.get(pid)
                    if binding is None or binding['startTimeTicks'] != item['startTimeTicks']:
                        continue
                    signal.pidfd_send_signal(binding['descriptor'], signum)
                    signals.append({'pid': pid, 'startTimeTicks': item['startTimeTicks'], 'signal': int(signum)})
                    sent.add(identity)
                except ProcessLookupError:
                    pass
            child.poll()
            time.sleep(.1)
        if not observe():
            break

status = child.poll()
if status is None:
    try:
        status = child.wait(timeout=1)
    except subprocess.TimeoutExpired:
        failure = failure or 'owned child could not be drained'
log.close()
remaining = observe()
report = {'format': 'ovf-scenario-453-native-once-control-result', 'version': 1,
          'command': command, 'startedAt': started,
          'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'wallSeconds': time.monotonic() - start_wall, 'nativeExitCode': status,
          'failure': failure, 'cancelSignal': cancel, 'observedOwnedProcesses': list(known.values()),
          'cleanupSignals': signals, 'remainingOwnedLiveProcesses': list(remaining.values()),
          'subreaperCustody': True, 'signaling': 'pidfd_send_signal',
          'reapedDescendants': reaped_descendants,
          'retryPerformed': False}
write('native-control-final.json', report)
print(json.dumps(report), flush=True)
for binding in pidfds.values():
    os.close(binding['descriptor'])
sys.exit(124 if failure else (95 if remaining or status is None else status))
