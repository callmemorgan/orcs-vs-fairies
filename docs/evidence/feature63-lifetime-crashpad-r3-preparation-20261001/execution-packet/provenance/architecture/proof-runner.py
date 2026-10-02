#!/usr/bin/env python3
"""One isolated ordinary-child lifetime proof; no game, database, or signals."""
import datetime
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import time

OUT = Path(__file__).resolve().parent
INITIAL = OUT / 'initial-cwd'
CHANGED = OUT / 'changed-cwd'
INITIAL.mkdir()
CHANGED.mkdir()
CHILD = OUT / 'ordinary-child.py'
CHILD.write_text("""import os
import sys
print('READY', flush=True)
if input() != 'CHDIR':
    raise SystemExit(2)
os.chdir(sys.argv[1])
print('CHDIR_DONE', flush=True)
if input() != 'EXEC':
    raise SystemExit(2)
print('EXECING_SLEEP', flush=True)
os.execv('/usr/bin/sleep', ['/usr/bin/sleep', '0.8'])
""")


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def pidfd_state(fd):
    poller = select.poll()
    poller.register(fd, select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
    flags = poller.poll(0)
    return {'ready': bool(flags), 'events': flags,
            'valid': not any(event & (select.POLLERR | select.POLLNVAL) for _, event in flags)}


def observation(pid, fd, phase):
    before_poll = pidfd_state(fd)
    proc = Path('/proc') / str(pid)
    raw_before = (proc / 'stat').read_text()
    fields_before = raw_before[raw_before.rfind(')') + 2:].split()
    executable = os.readlink(proc / 'exe')
    cwd = os.readlink(proc / 'cwd')
    cmdline = (proc / 'cmdline').read_bytes()
    raw_after = (proc / 'stat').read_text()
    fields_after = raw_after[raw_after.rfind(')') + 2:].split()
    exe_after = os.readlink(proc / 'exe')
    cwd_after = os.readlink(proc / 'cwd')
    after_poll = pidfd_state(fd)
    result = {
        'at': stamp(), 'phase': phase,
        'identity': {'pid': pid, 'startTicks': int(fields_before[19]),
                     'session': int(fields_before[3]), 'executable': executable,
                     'cwd': cwd, 'argv': [part.decode() for part in cmdline.split(b'\0') if part]},
        'rawStatBefore': raw_before, 'rawStatAfter': raw_after,
        'rawCmdlineHex': cmdline.hex(),
        'pidfdBefore': before_poll, 'pidfdAfter': after_poll,
        'withinObservationStable': fields_before[19] == fields_after[19]
            and fields_before[3] == fields_after[3]
            and executable == exe_after and cwd == cwd_after,
    }
    assert result['withinObservationStable']
    assert before_poll['valid'] and after_poll['valid']
    assert not before_poll['ready'] and not after_poll['ready']
    assert fields_before[0] not in ('Z', 'X') and fields_after[0] not in ('Z', 'X')
    return result


command = [sys.executable, '-I', '-u', str(CHILD), str(CHANGED)]
records = []
transcript = []
fd = None
env = {key: value for key, value in os.environ.items()
       if key not in ('PYTHONPATH', 'PYTHONHOME', 'PYTHONOPTIMIZE')}
with (OUT / 'child.stderr').open('xb') as stderr:
    child = subprocess.Popen(command, cwd=INITIAL, env=env, stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=stderr, text=True,
                             start_new_session=True)
    try:
        fd = os.pidfd_open(child.pid)
        line = child.stdout.readline().strip()
        transcript.append(line)
        assert line == 'READY'
        records.append(observation(child.pid, fd, 'initial Python'))
        child.stdin.write('CHDIR\n')
        child.stdin.flush()
        line = child.stdout.readline().strip()
        transcript.append(line)
        assert line == 'CHDIR_DONE'
        records.append(observation(child.pid, fd, 'after chdir in Python'))
        child.stdin.write('EXEC\n')
        child.stdin.flush()
        line = child.stdout.readline().strip()
        transcript.append(line)
        assert line == 'EXECING_SLEEP'
        deadline = time.monotonic() + 0.5
        while os.readlink(Path('/proc') / str(child.pid) / 'exe') != '/usr/bin/sleep':
            assert time.monotonic() < deadline
            time.sleep(0.001)
        records.append(observation(child.pid, fd, 'after exec to sleep'))
        code = child.wait(timeout=3)
        assert code == 0
        after_exit = pidfd_state(fd)
        assert after_exit['valid'] and after_exit['ready']
        identities = [record['identity'] for record in records]
        first = identities[0]
        kernel_keys = ('pid', 'startTicks', 'session')
        complete_keys = (*kernel_keys, 'executable', 'cwd')
        result = {
            'schema': 'feature63-isolated-process-identity-semantics-v1',
            'at': stamp(), 'status': 'PASS', 'command': command,
            'heldPidfd': fd, 'heldPidfdClosedOnlyAfterAllObservations': True,
            'observations': records, 'exitCode': code, 'pidfdAfterExit': after_exit,
            'checks': {
                'samePidStartAndSessionThroughout': all(all(item[key] == first[key] for key in kernel_keys) for item in identities),
                'chdirChangesCwdWithoutChangingExecutable': identities[1]['cwd'] != first['cwd'] and identities[1]['executable'] == first['executable'],
                'execChangesExecutableWithoutChangingCwd': identities[2]['executable'] != identities[1]['executable'] and identities[2]['cwd'] == identities[1]['cwd'],
                'originalFiveFieldEqualityRejectsBothLaterSnapshots': all(any(item[key] != first[key] for key in complete_keys) for item in identities[1:]),
                'heldPidfdValidAndNonreadyAroundEachLiveObservation': all(item['pidfdBefore']['valid'] and item['pidfdAfter']['valid'] and not item['pidfdBefore']['ready'] and not item['pidfdAfter']['ready'] for item in records),
                'heldPidfdBecomesReadyAfterNaturalExit': after_exit['valid'] and after_exit['ready'],
            },
            'scope': {'ordinaryChildOnly': True, 'gameBrowserServerOrDatabaseUsed': False,
                      'signalsSent': 0, 'rootCheckoutWritten': False,
                      'r2OffendingTupleOrCauseEstablished': False,
                      'sessionTransitionExercised': False},
        }
        assert all(result['checks'].values())
        with (OUT / 'proof.json').open('x') as handle:
            json.dump(result, handle, sort_keys=True, indent=2)
            handle.write('\n')
        with (OUT / 'child-transcript.json').open('x') as handle:
            json.dump(transcript, handle, indent=2)
            handle.write('\n')
        print(json.dumps({'status': result['status'], 'proof': str(OUT / 'proof.json'),
                          'identities': identities, 'checks': result['checks'],
                          'signalsSent': 0}, sort_keys=True))
    finally:
        # The child exits on an unexpected input or after its short sleep. No signal is used.
        if child.poll() is None:
            try:
                child.stdin.write('STOP\n')
                child.stdin.flush()
            except (BrokenPipeError, ValueError):
                pass
            child.wait(timeout=3)
        if fd is not None:
            os.close(fd)
        child.stdin.close()
        child.stdout.close()
