#!/usr/bin/env python3
"""One isolated native process; no signals, browser, server or database access."""
import ast
import datetime
import hashlib
import json
import os
from pathlib import Path
import select
import subprocess
import threading
import time

ROOT = Path(__file__).resolve().parent
HELPERS = {'require', 'now', 'process_observation', 'pidfd_live',
           'require_managed_identity', 'managed_process_observation', 'owned_observation'}


def load_helpers(path):
    raw = path.read_bytes()
    tree = ast.parse(raw)
    nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in HELPERS]
    assert {node.name for node in nodes} == HELPERS
    namespace = {'datetime': datetime, 'os': os, 'select': select, 'Path': Path, 'json': json}
    # Execute only the listed process-observation helpers. No wrapper entry point or imports run.
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), 'exec'), namespace)
    return namespace


def state(pid):
    raw = Path('/proc', str(pid), 'stat').read_text()
    fields = raw[raw.rfind(')') + 2:].split()
    return {'pid': pid, 'state': fields[0], 'session': int(fields[3]), 'startTicks': int(fields[19])}


def links(pid):
    result = {}
    for name in ['exe', 'cwd']:
        try:
            result[name] = {'value': os.readlink(Path('/proc', str(pid), name))}
        except OSError as error:
            result[name] = {'error': type(error).__name__, 'errno': error.errno}
    return result


def expected_failure(action):
    try:
        action()
    except RuntimeError as error:
        return str(error)
    raise AssertionError('Expected fail-closed RuntimeError')


def main():
    original = load_helpers(ROOT / 'original-run-minimal63.py')
    candidate = load_helpers(ROOT / 'candidate-run-minimal63.py')
    native = ROOT / 'leader-exit'
    build = subprocess.run(['/usr/bin/cc', '-O2', '-pthread', '-o', str(native), str(ROOT / 'leader-exit.c')], capture_output=True, timeout=10)
    (ROOT / 'native-build.stdout').write_bytes(build.stdout)
    (ROOT / 'native-build.stderr').write_bytes(build.stderr)
    assert build.returncode == 0
    ready_read, ready_write = os.pipe()
    leader_read, leader_write = os.pipe()
    worker_read, worker_write = os.pipe()
    process = None
    pidfd = None
    timer = None
    result = {'schema': 'feature63-isolated-native-leader-exit-proof-v1',
              'signalsSent': 0, 'nativeChildrenStarted': 0, 'wrapperEntryPointExecuted': False,
              'databaseAccess': False, 'browserOrServerStarted': False, 'checks': []}
    try:
        process = subprocess.Popen([str(native), str(ready_write), str(leader_read), str(worker_read)],
            cwd=ROOT, pass_fds=(ready_write, leader_read, worker_read),
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True)
        result['nativeChildrenStarted'] = 1
        os.close(ready_write); ready_write = None
        os.close(leader_read); leader_read = None
        os.close(worker_read); worker_read = None
        deadline = time.monotonic() + 2
        ready = b''
        while len(ready) < 2:
            remaining = deadline - time.monotonic()
            assert remaining > 0 and select.select([ready_read], [], [], remaining)[0]
            chunk = os.read(ready_read, 2 - len(ready))
            assert chunk
            ready += chunk
        assert set(ready) == {ord('M'), ord('W')}
        initial = original['process_observation'](process.pid)
        assert initial is not None
        pidfd = os.pidfd_open(process.pid)
        assert original['pidfd_live'](pidfd)
        immutable = initial['immutableIdentity']
        record = {'identity': initial['identity'], 'immutableIdentity': immutable,
                  'family': 'isolated-native', 'pidfd': pidfd, 'admitted': True, 'directRoot': True,
                  'lifetimeIdentity': {key: immutable[key] for key in ('pid', 'startTicks')},
                  'originalAdmittedSession': immutable['session']}
        assert candidate['owned_observation'](record) is not None
        result['initialState'] = state(process.pid)
        bad_record = dict(record, lifetimeIdentity=dict(record['lifetimeIdentity'], startTicks=immutable['startTicks'] + 1))
        result['checks'].append({'name': 'live-lifetime-mismatch-fails-closed',
            'error': expected_failure(lambda: candidate['owned_observation'](bad_record)), 'signalsSent': 0})
        # Release the leader only. The worker remains blocked on its separate pipe.
        os.write(leader_write, b'L')
        deadline = time.monotonic() + 2
        while state(process.pid)['state'] != 'Z':
            assert time.monotonic() < deadline
            time.sleep(.001)
        leader_state = state(process.pid)
        assert leader_state['startTicks'] == immutable['startTicks']
        assert leader_state['session'] == process.pid
        assert original['pidfd_live'](pidfd)
        assert process.returncode is None
        result['leaderZombieWhileHeldPidfdLive'] = {'state': leader_state, 'links': links(process.pid),
            'heldPidfdReady': False, 'popenReturncode': process.returncode}
        assert original['process_observation'](process.pid) is None
        assert original['managed_process_observation'](record) is None
        result['checks'].append({'name': 'original-direct-root-observation-reproduces-failure',
            'error': expected_failure(lambda: original['owned_observation'](record))})
        descendant = dict(record, directRoot=False)
        result['checks'].append({'name': 'original-descendant-observation-reproduces-failure',
            'error': expected_failure(lambda: original['owned_observation'](descendant))})
        started = time.monotonic()
        error = expected_failure(lambda: candidate['owned_observation'](descendant))
        elapsed = time.monotonic() - started
        assert .45 <= elapsed < 1.5
        assert original['pidfd_live'](pidfd)
        result['checks'].append({'name': 'unknown-live-snapshot-still-fails-closed-after-bound',
            'seconds': elapsed, 'error': error, 'heldPidfdReady': False, 'signalsSent': 0})
        # End the remaining native thread naturally, during the candidate's held-PIDFD wait.
        timer = threading.Timer(.05, lambda: os.write(worker_write, b'W'))
        timer.start()
        started = time.monotonic()
        observed = candidate['owned_observation'](record)
        elapsed = time.monotonic() - started
        timer.join(timeout=1)
        assert observed is None and not original['pidfd_live'](pidfd)
        assert elapsed < .5
        assert process.returncode is None
        final_state = state(process.pid)
        assert final_state['state'] == 'Z' and final_state['startTicks'] == immutable['startTicks']
        assert final_state['session'] == process.pid
        result['checks'].append({'name': 'last-thread-natural-exit-accepted-only-after-held-pidfd-readiness',
            'seconds': elapsed, 'observation': observed, 'heldPidfdReady': True,
            'unreapedDirectRoot': final_state, 'links': links(process.pid), 'signalsSent': 0})
        result['checks'].append({'name': 'unadmitted-direct-root-exit-has-held-pidfd-proof',
            'observation': candidate['owned_observation'](dict(record, admitted=False)), 'heldPidfdReady': True})
        code = process.wait(timeout=2)
        assert code == 0
        result['nativeExitCode'] = code
        result['nativeChildReapedAfterExitProof'] = True
        result['status'] = 'PASS'
    finally:
        if timer is not None: timer.join(timeout=1)
        for write_fd in [leader_write, worker_write]:
            if write_fd is not None:
                try: os.write(write_fd, b'E')
                except (BrokenPipeError, OSError): pass
        if process is not None and process.returncode is None:
            process.wait(timeout=3)
        for fd in [ready_read, ready_write, leader_read, leader_write, worker_read, worker_write, pidfd]:
            if fd is not None:
                try: os.close(fd)
                except OSError: pass
    result['candidateSha256'] = hashlib.sha256((ROOT / 'candidate-run-minimal63.py').read_bytes()).hexdigest()
    result['originalSha256'] = hashlib.sha256((ROOT / 'original-run-minimal63.py').read_bytes()).hexdigest()
    (ROOT / 'native-proof.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'directory': str(ROOT), 'checks': len(result['checks']),
                      'signalsSent': 0, 'nativeExitCode': result['nativeExitCode']}))


if __name__ == '__main__':
    main()
