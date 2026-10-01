#!/usr/bin/env bash
set -euo pipefail
: "${OVF_MODES_CPU_RELEASE:?Root must release CPU before this preparation is invoked}"
[[ "$OVF_MODES_CPU_RELEASE" == 1 ]]
final_pin="${1:?Pass the full final source pin}"
[[ "$final_pin" =~ ^[0-9a-f]{40}$ ]]
# The controller owns the children and handles signals without exiting during
# launch or registration. No installation/build runs in this Bash wrapper.
exec python3 - "$final_pin" /home/morgana/Projects/orcs-vs-Fairies <<'PY'
import ctypes
import hashlib
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

cancel_signal = 0
active_process = None

def request_cancel(number, _frame):
    global cancel_signal
    if not cancel_signal:
        cancel_signal = number

signal.signal(signal.SIGINT, request_cancel)
signal.signal(signal.SIGTERM, request_cancel)

def now():
    return datetime.now(timezone.utc).isoformat()

pin, repository = sys.argv[1:]
launch = Path(tempfile.mkdtemp(prefix='ovf-modes-final-launch.', dir='/tmp'))
checkout = Path(tempfile.mkdtemp(prefix='ovf-modes-final-checkout.', dir='/tmp'))
output = Path(tempfile.mkdtemp(prefix='ovf-modes-final-proof.', dir='/tmp'))
receipt = {
    'sourcePin': pin, 'checkout': str(checkout), 'output': str(output),
    'launchDirectory': str(launch), 'startedAtUtc': now(), 'result': 'preparing',
    'independentDependencies': True, 'naturalMatchesRun': False,
    'browserRun': False, 'serverStarted': False, 'stages': [],
}

def persist():
    temporary = launch / 'execution.json.pending'
    temporary.write_text(json.dumps(receipt, indent=2) + '\n')
    temporary.replace(launch / 'execution.json')

class PreparationStopped(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status

def check_cancel():
    if cancel_signal:
        raise PreparationStopped(128 + cancel_signal, 'Preparation cancelled')

def group_exists(group):
    try:
        os.killpg(group, 0)
        return True
    except ProcessLookupError:
        return False

def signal_group(group, number):
    try:
        os.killpg(group, number)
        return True
    except ProcessLookupError:
        return False

def reap_group(process, reaped):
    # Let Popen reap its leader first so waitpid below cannot lose its status.
    process.poll()
    if process.returncode is None:
        return
    while True:
        try:
            child, status = os.waitpid(-process.pid, os.WNOHANG)
        except ChildProcessError:
            return
        if not child:
            return
        reaped.append({'pid': child, 'exitCode': os.waitstatus_to_exitcode(status)})

def cleanup_group(process):
    started = time.monotonic()
    result = {'processGroup': process.pid, 'termSent': False, 'killSent': False,
              'reapedDescendants': [], 'verifiedGone': False}
    reap_group(process, result['reapedDescendants'])
    if group_exists(process.pid):
        result['termSent'] = signal_group(process.pid, signal.SIGTERM)
    for number, duration in ((signal.SIGTERM, 10), (signal.SIGKILL, 10)):
        if number == signal.SIGKILL and group_exists(process.pid):
            result['killSent'] = signal_group(process.pid, number)
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            reap_group(process, result['reapedDescendants'])
            if not group_exists(process.pid):
                result['verifiedGone'] = True
                break
            time.sleep(.05)
        if result['verifiedGone']:
            break
    reap_group(process, result['reapedDescendants'])
    result['verifiedGone'] = not group_exists(process.pid)
    result['leaderExitCode'] = process.returncode
    result['wallSeconds'] = time.monotonic() - started
    return result

def run_stage(name, log_name, arguments, cwd):
    global active_process
    check_cancel()
    stage = {'name': name, 'argv': arguments, 'cwd': str(cwd),
             'log': str(launch / log_name), 'startedAtUtc': now()}
    receipt['stages'].append(stage)
    receipt['activeStage'] = name
    persist()
    started = time.monotonic()
    print(f"Preparing {name}; log {stage['log']}", flush=True)
    with open(stage['log'], 'wb') as log:
        # Popen's exec-error handshake returns after setsid succeeds. A signal
        # during launch only sets a flag, so registration always finishes.
        active_process = subprocess.Popen(arguments, cwd=cwd, stdin=subprocess.DEVNULL,
                                          stdout=log, stderr=subprocess.STDOUT,
                                          start_new_session=True)
        process = active_process
        stage['pid'] = process.pid
        stage['processGroup'] = process.pid
        persist()
        while not cancel_signal:
            try:
                process.wait(timeout=.2)
                break
            except subprocess.TimeoutExpired:
                pass
        reaped = []
        reap_group(process, reaped)
        # Build services may finish reading EOF just after their Node leader
        # exits. Allow bounded natural exit before rejecting surviving children.
        drain_started = time.monotonic()
        deadline = drain_started + 1
        while not cancel_signal and process.returncode is not None and group_exists(process.pid):
            if time.monotonic() >= deadline:
                break
            time.sleep(.05)
            reap_group(process, reaped)
        stage['naturalDrainWallSeconds'] = time.monotonic() - drain_started
        lingering = group_exists(process.pid)
        cleanup = cleanup_group(process)
        cleanup['reapedDescendants'] = reaped + cleanup['reapedDescendants']
        stage.update(finishedAtUtc=now(), wallSeconds=time.monotonic() - started,
                     exitCode=process.returncode, cleanup=cleanup)
        active_process = None
        persist()
        if not cleanup['verifiedGone']:
            raise PreparationStopped(125, f'Process group {process.pid} remains alive')
        check_cancel()
        if process.returncode:
            status = process.returncode if process.returncode > 0 else 128 - process.returncode
            raise PreparationStopped(status, f'{name} failed with exit {process.returncode}')
        if lingering:
            raise PreparationStopped(1, f'{name} left descendants after its leader exited')
    receipt.pop('activeStage', None)
    persist()

status = 0
try:
    persist()
    print(json.dumps(receipt), flush=True)
    # Adopt orphaned descendants so group cleanup can reap them after leader exit.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # Linux PR_SET_CHILD_SUBREAPER
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    receipt['linuxChildSubreaper'] = True
    run_stage('pin-validation', 'pin-validation.log',
              ['git', '-C', repository, 'cat-file', '-e', pin + '^{commit}'], repository)
    run_stage('worktree', 'worktree.log',
              ['git', '-C', repository, 'worktree', 'add', '--detach', str(checkout), pin], repository)
    check_cancel()
    text = (checkout / 'src/core/versions.ts').read_text()
    assert "SIMULATION_REVISION = '4.0.1'" in text and "4:'4.0.0'" in text
    run_stage('dependencies', 'npm-ci.log', ['npm', 'ci'], checkout)
    run_stage('prepare', 'prepare-command.log',
              ['node', 'scripts/modes/prepare.mjs', pin, str(output)], checkout)
    check_cancel()
    prepared = json.loads((output / 'prepare.json').read_text())
    assert prepared['sourcePin'] == pin
    assert prepared['schema']['saveVersion'] == 4 and prepared['schema']['simulationRevision'] == '4.0.1'
    assert not prepared['naturalMatchesRun'] and not prepared['browserRun']
    assert not any((output / name).exists() for name in ('run.json', 'runtime', 'browser'))
    receipt.update(result='prepared', preparedAtUtc=now(), sourceDigest=prepared['sourceDigest'],
                   buildId=prepared['provenance']['buildId'], schema=prepared['schema'],
                   prepareJsonSha256=hashlib.sha256((output / 'prepare.json').read_bytes()).hexdigest())
    check_cancel()
except PreparationStopped as error:
    status = error.status
    receipt.update(result='cancelled' if cancel_signal else 'failed', error=str(error))
except Exception as error:
    status = 1
    receipt.update(result='failed', error=f'{type(error).__name__}: {error}')
finally:
    if active_process is not None:
        cleanup = cleanup_group(active_process)
        receipt['exceptionCleanup'] = cleanup
        if not cleanup['verifiedGone']:
            status = 125
        active_process = None
    # With all owned groups checked, take one cancellation snapshot and keep
    # these signals blocked through terminal receipt writing and process exit.
    # Signals received after this completion point do not restart cancellation.
    signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGINT, signal.SIGTERM})
    pending = signal.sigpending()
    if not cancel_signal:
        cancel_signal = next((number for number in (signal.SIGINT, signal.SIGTERM)
                              if number in pending), 0)
    receipt['completionPoint'] = 'Owned-group cleanup completed; INT/TERM blocked and cancellation snapshot taken'
    if cancel_signal and status != 125:
        status = 128 + cancel_signal
        receipt['result'] = 'cancelled'
    receipt.update(exitCode=status, finishedAtUtc=now(), cancellationSignal=cancel_signal)
    persist()
    print(json.dumps(receipt), flush=True)
    if status:
        print(f'Preparation stopped; preserve checkout, output and logs at {launch}', file=sys.stderr)
sys.exit(status)
PY
