#!/usr/bin/env python3
"""One isolated coordinator and descendant; prove setsid preserves held pidfd lifetime."""
import datetime
import json
import os
from pathlib import Path
import select
import subprocess
import sys

OUT = Path(__file__).resolve().parent
CWD = OUT / 'session-cwd'
CWD.mkdir()
CHILD = OUT / 'session-child.py'
COORDINATOR = OUT / 'session-coordinator.py'
CHILD.write_text("""import os
print('READY', flush=True)
if input() != 'SETSID':
    raise SystemExit(2)
os.setsid()
print('SETSID_DONE', flush=True)
if input() != 'EXIT':
    raise SystemExit(2)
""")
COORDINATOR.write_text("""import subprocess
import sys
child = subprocess.Popen([sys.executable, '-I', '-u', sys.argv[1]],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
assert child.stdout.readline().strip() == 'READY'
print('CHILD_READY ' + str(child.pid), flush=True)
assert input() == 'SETSID'
child.stdin.write('SETSID\\n')
child.stdin.flush()
assert child.stdout.readline().strip() == 'SETSID_DONE'
print('SETSID_DONE', flush=True)
assert input() == 'EXIT'
child.stdin.write('EXIT\\n')
child.stdin.flush()
assert child.wait(timeout=3) == 0
print('CHILD_EXITED', flush=True)
assert input() == 'FINAL_EXIT'
child.stdin.close()
child.stdout.close()
""")


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def poll(fd):
    waiter = select.poll()
    waiter.register(fd, select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
    events = waiter.poll(0)
    return {'ready': bool(events), 'events': events,
            'valid': not any(flags & (select.POLLERR | select.POLLNVAL) for _, flags in events)}


def observe(pid, fd, phase):
    before_poll = poll(fd)
    proc = Path('/proc') / str(pid)
    before = (proc / 'stat').read_text()
    fields = before[before.rfind(')') + 2:].split()
    executable = os.readlink(proc / 'exe')
    cwd = os.readlink(proc / 'cwd')
    raw = (proc / 'cmdline').read_bytes()
    after = (proc / 'stat').read_text()
    after_fields = after[after.rfind(')') + 2:].split()
    after_poll = poll(fd)
    stable = fields[19] == after_fields[19] and fields[3] == after_fields[3]
    stable = stable and executable == os.readlink(proc / 'exe') and cwd == os.readlink(proc / 'cwd')
    assert stable and fields[0] not in ('Z', 'X') and after_fields[0] not in ('Z', 'X')
    assert before_poll['valid'] and after_poll['valid']
    assert not before_poll['ready'] and not after_poll['ready']
    return {'at': stamp(), 'phase': phase,
            'identity': {'pid': pid, 'startTicks': int(fields[19]), 'session': int(fields[3]),
                         'executable': executable, 'cwd': cwd,
                         'argv': [part.decode() for part in raw.split(b'\0') if part]},
            'rawStatBefore': before, 'rawStatAfter': after, 'rawCmdlineHex': raw.hex(),
            'pidfdBefore': before_poll, 'pidfdAfter': after_poll, 'withinObservationStable': stable}


command = [sys.executable, '-I', '-u', str(COORDINATOR), str(CHILD)]
fds = []
transcript = []
env = {key: value for key, value in os.environ.items()
       if key not in ('PYTHONPATH', 'PYTHONHOME', 'PYTHONOPTIMIZE')}
with (OUT / 'session-child.stderr').open('xb') as stderr:
    root = subprocess.Popen(command, cwd=CWD, env=env, stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=stderr, text=True,
                            start_new_session=True)
    try:
        root_fd = os.pidfd_open(root.pid)
        fds.append(root_fd)
        line = root.stdout.readline().strip()
        transcript.append(line)
        assert line.startswith('CHILD_READY ')
        child_pid = int(line.split()[1])
        child_fd = os.pidfd_open(child_pid)
        fds.append(child_fd)
        root_before = observe(root.pid, root_fd, 'coordinator before descendant setsid')
        child_before = observe(child_pid, child_fd, 'descendant admitted in coordinator session')
        assert root_before['identity']['session'] == root.pid
        assert child_before['identity']['session'] == root.pid
        root.stdin.write('SETSID\n')
        root.stdin.flush()
        line = root.stdout.readline().strip()
        transcript.append(line)
        assert line == 'SETSID_DONE'
        child_after = observe(child_pid, child_fd, 'same admitted descendant after setsid')
        root_after = observe(root.pid, root_fd, 'coordinator after descendant setsid')
        root.stdin.write('EXIT\n')
        root.stdin.flush()
        line = root.stdout.readline().strip()
        transcript.append(line)
        assert line == 'CHILD_EXITED'
        child_exit_poll = poll(child_fd)
        assert child_exit_poll['valid'] and child_exit_poll['ready']
        root_before_exit = observe(root.pid, root_fd, 'unreaped coordinator before natural exit')
        root.stdin.write('FINAL_EXIT\n')
        root.stdin.flush()
        code = root.wait(timeout=3)
        assert code == 0
        root_exit_poll = poll(root_fd)
        before = child_before['identity']
        after = child_after['identity']
        roots = [root_before, root_after, root_before_exit]
        result = {
            'schema': 'feature63-isolated-descendant-session-semantics-v1',
            'at': stamp(), 'status': 'PASS', 'command': command,
            'heldPidfds': {'coordinator': root_fd, 'descendant': child_fd},
            'heldPidfdsClosedOnlyAfterAllObservations': True,
            'observations': [root_before, child_before, child_after, root_after, root_before_exit],
            'exitCode': code, 'descendantPidfdAfterNaturalExit': child_exit_poll,
            'coordinatorPidfdAfterNaturalExit': root_exit_poll,
            'checks': {
                'newDescendantInitiallyInOriginalCoordinatorSession': before['session'] == root.pid,
                'descendantPidAndStartUnchanged': before['pid'] == after['pid'] and before['startTicks'] == after['startTicks'],
                'descendantSessionChangesToItsOwnPid': before['session'] != after['session'] and after['session'] == after['pid'],
                'descendantExecutableCwdAndArgvUnchanged': all(before[key] == after[key] for key in ('executable', 'cwd', 'argv')),
                'coordinatorPidStartAndReservedSessionUnchanged': all(item['identity']['pid'] == root.pid and item['identity']['startTicks'] == root_before['identity']['startTicks'] and item['identity']['session'] == root.pid for item in roots),
                'heldPidfdsValidAndNonreadyAroundEveryLiveObservation': all(item['pidfdBefore']['valid'] and item['pidfdAfter']['valid'] and not item['pidfdBefore']['ready'] and not item['pidfdAfter']['ready'] for item in [*roots, child_before, child_after]),
                'bothHeldPidfdsReadyAfterNaturalExits': child_exit_poll['valid'] and child_exit_poll['ready'] and root_exit_poll['valid'] and root_exit_poll['ready'],
            },
            'scope': {'ordinaryCoordinatorAndDescendantOnly': True,
                      'gameBrowserServerOrDatabaseUsed': False, 'signalsSent': 0,
                      'rootCheckoutWritten': False, 'r2OffendingTupleOrCauseEstablished': False,
                      'broadPpidArgvOrSessionGroupAdmissionUsed': False},
        }
        assert all(result['checks'].values())
        with (OUT / 'session-proof.json').open('x') as handle:
            json.dump(result, handle, sort_keys=True, indent=2)
            handle.write('\n')
        with (OUT / 'session-transcript.json').open('x') as handle:
            json.dump(transcript, handle, indent=2)
            handle.write('\n')
        print(json.dumps({'status': result['status'], 'proof': str(OUT / 'session-proof.json'),
                          'identities': [item['identity'] for item in result['observations']],
                          'checks': result['checks'], 'signalsSent': 0}, sort_keys=True))
    finally:
        for fd in fds:
            os.close(fd)
        root.stdin.close()
        root.stdout.close()
