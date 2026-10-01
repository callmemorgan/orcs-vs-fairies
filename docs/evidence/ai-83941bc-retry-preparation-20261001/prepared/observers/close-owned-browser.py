#!/usr/bin/env python3
import datetime, json, os, pathlib, re, signal, sys, time

phase, pid_text, ticks_text = sys.argv[1:]
assert phase in ['coop-ui', 'online-ui']
pid, expected_ticks = int(pid_text), int(ticks_text)
repo = '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies'
expected = '/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
directory = pathlib.Path(repo) / 'work/ai-save401-final-83941bc-r1/browser-runtime' / phase
assert directory.is_dir()
p = pathlib.Path('/proc') / str(pid)
stat = (p / 'stat').read_text().rsplit(') ', 1)[1].split()
argv = [arg.decode(errors='replace') for arg in (p / 'cmdline').read_bytes().split(b'\0') if arg]
before = {'pid': pid, 'startTicks': int(stat[19]), 'executable': os.readlink(p / 'exe'),
          'cwd': os.readlink(p / 'cwd'), 'argv': argv}
assert before['startTicks'] == expected_ticks
assert before['cwd'] == repo and before['executable'] == expected
assert any('--remote-debugging-pipe' in arg.split() for arg in argv)
match = re.search(r'--user-data-dir=(\S+)', ' '.join(argv))
assert match and match.group(1).startswith('/tmp/playwright_chromiumdev_profile-')
profile = match.group(1)
protected = []
for network in ['tcp', 'tcp6']:
    for line in (pathlib.Path('/proc/net') / network).read_text().splitlines()[1:]:
        fields = line.split()
        if int(fields[1].rsplit(':', 1)[1], 16) == 4173 and fields[3] == '0A':
            protected.append({'network': network, 'localAddress': fields[1], 'inode': fields[9]})
root_sockets = {os.readlink(fd) for fd in (p / 'fd').iterdir()}
assert all('socket:[' + row['inode'] + ']' not in root_sockets for row in protected)
record = {'phase': phase, 'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'rootBefore': before, 'profile': profile, 'protected4173Before': protected,
          'limits': 'Signals only this directly checked owned root PID. Remaining profile processes must be observed and closed by their recorded PID/start-ticks; no broad process kill is allowed.'}
path = directory / 'manual-owned-browser-close.json'
with path.open('x') as f:
    f.write(json.dumps(record, indent=2) + '\n')
current_stat = (p / 'stat').read_text().rsplit(') ', 1)[1].split()
assert int(current_stat[19]) == expected_ticks
os.kill(pid, signal.SIGTERM)
for attempt in range(50):
    if not p.exists():
        break
    time.sleep(0.1)
record['signalSent'] = {'pid': pid, 'startTicks': expected_ticks, 'signal': 'SIGTERM'}
record['rootPidAbsentAfter'] = not p.exists()
after = []
for network in ['tcp', 'tcp6']:
    for line in (pathlib.Path('/proc/net') / network).read_text().splitlines()[1:]:
        fields = line.split()
        if int(fields[1].rsplit(':', 1)[1], 16) == 4173 and fields[3] == '0A':
            after.append({'network': network, 'localAddress': fields[1], 'inode': fields[9]})
record['protected4173After'] = after
record['protected4173IdentityUnchanged'] = protected == after
path.write_text(json.dumps(record, indent=2) + '\n')
assert record['rootPidAbsentAfter'] and record['protected4173IdentityUnchanged']
print(json.dumps({'phase': phase, 'signalledOwnedRootPid': pid, 'rootPidAbsentAfter': True,
                  'protected4173IdentityUnchanged': True, 'profile': profile}))
