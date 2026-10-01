#!/usr/bin/env python3
import datetime, json, os, pathlib, re, signal, socket, sys, time

base = pathlib.Path('work/ai-save401-final-83941bc-r1')
repo = str(pathlib.Path.cwd())
server_pid = int(sys.argv[1])
expected_argv = ['node', 'work/ai-save401-final-83941bc-r1/server/rts-server.js']

def processes():
    table = {}
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit():
            continue
        try:
            stat = (p / 'stat').read_text().rsplit(') ', 1)[1].split()
            table[int(p.name)] = {'pid': int(p.name), 'parentPid': int(stat[1]), 'startTicks': int(stat[19]),
                                 'executable': os.readlink(p / 'exe'), 'cwd': os.readlink(p / 'cwd'),
                                 'argv': [a.decode(errors='replace') for a in (p / 'cmdline').read_bytes().split(b'\0') if a]}
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            pass
    return table

def listeners(port, table):
    sockets = []
    for name in ['tcp', 'tcp6']:
        for line in (pathlib.Path('/proc/net') / name).read_text().splitlines()[1:]:
            fields = line.split()
            if int(fields[1].rsplit(':', 1)[1], 16) == port and fields[3] == '0A':
                sockets.append({'network': name, 'localAddress': fields[1], 'inode': fields[9]})
    for item in sockets:
        item['holders'] = []
        for pid, row in table.items():
            try:
                if any(os.readlink(fd) == 'socket:[' + item['inode'] + ']' for fd in (pathlib.Path('/proc') / str(pid) / 'fd').iterdir()):
                    item['holders'].append({'pid': pid, 'startTicks': row['startTicks']})
            except (FileNotFoundError, PermissionError, ProcessLookupError):
                pass
    return sockets

browser_pids = set()
profiles = set()
captured = []
coverage = {}
for phase in ['coop-ui', 'online-ui']:
    directory = base / 'browser-runtime' / phase
    if not directory.exists():
        continue
    trace_path = directory / 'actual-launch-trace.json'
    process_path = directory / 'actual-process-r3.json'
    stderr_path = base / 'envelopes' / phase / 'stderr.log'
    coverage[phase] = {'completedTrace': trace_path.is_file(), 'liveProcessRecord': process_path.is_file(),
                       'originalStderr': stderr_path.is_file()}
    if trace_path.is_file():
        for launch in json.loads(trace_path.read_text())['launches']:
            browser_pids.add(launch['pid'])
            match = re.search(r'--user-data-dir=(\S+)', launch['launchLine'])
            if match:
                profiles.add(match.group(1))
    if process_path.is_file():
        record = json.loads(process_path.read_text())
        browser_pids.add(record['rootPid'])
        captured.extend(record['processes'])
        for row in record['processes']:
            match = re.search(r'--user-data-dir=(\S+)', ' '.join(row['argv']))
            if match:
                profiles.add(match.group(1))
    if stderr_path.is_file():
        text = stderr_path.read_text()
        browser_pids.update(int(pid) for pid in re.findall(r'pw:browser <launched> pid=(\d+)', text))
        profiles.update(re.findall(r'--user-data-dir=(\S+)', text))
    coverage[phase]['launchOwnershipObserved'] = bool(trace_path.is_file() or process_path.is_file() or
                                                      (stderr_path.is_file() and 'pw:browser <launching> ' in stderr_path.read_text()))

def snapshot():
    table = processes()
    root_pids = [pid for pid in browser_pids if pid in table]
    descendants = [row for row in captured if row['pid'] in table and row['startTicks'] == table[row['pid']]['startTicks']]
    profile_processes = [row for row in table.values() if any(profile in ' '.join(row['argv']) for profile in profiles)]
    return {'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'server': table.get(server_pid), 'browserCoverage': coverage, 'ownedBrowserRootPidsLive': root_pids,
            'ownedCapturedBrowserProcessesLive': descendants, 'ownedBrowserProfileProcessesLive': profile_processes,
            'port5371Listeners': listeners(5371, table), 'protectedPort4173Listeners': listeners(4173, table)}

before = snapshot()
assert before['server']['cwd'] == repo and before['server']['argv'] == expected_argv
assert any(any(holder['pid'] == server_pid for holder in row['holders']) for row in before['port5371Listeners'])
assert all(all(holder['pid'] != server_pid for holder in row['holders']) for row in before['protectedPort4173Listeners']), 'Signal target also owns protected4173'
assert all(item['launchOwnershipObserved'] for item in coverage.values()), 'Partial browser phase ownership is unknown; capture its actual launched PID before cleanup claims'
assert processes()[server_pid]['startTicks'] == before['server']['startTicks'], 'Server PID identity changed before signal'
assert not before['ownedBrowserRootPidsLive'] and not before['ownedCapturedBrowserProcessesLive'] and not before['ownedBrowserProfileProcessesLive']
out = base / 'cleanup'
out.mkdir(exist_ok=True)
with (out / 'before.json').open('x') as f:
    f.write(json.dumps(before, indent=2) + '\n')
os.kill(server_pid, signal.SIGTERM)
for attempt in range(50):
    if not (pathlib.Path('/proc') / str(server_pid)).exists():
        break
    time.sleep(0.1)
after = snapshot()
probe = socket.socket()
probe.settimeout(1)
after['port5371ConnectResult'] = probe.connect_ex(('127.0.0.1', 5371))
probe.close()
after['signalsSent'] = [{'pid': server_pid, 'startTicks': before['server']['startTicks'], 'signal': 'SIGTERM'}]
after['protectedPort4173IdentityUnchanged'] = after['protectedPort4173Listeners'] == before['protectedPort4173Listeners']
after['protectedPort4173SignalTargetsAbsent'] = all(all(holder['pid'] != server_pid for holder in row['holders']) for row in before['protectedPort4173Listeners'])
after['protectedPort4173Touched'] = not (after['protectedPort4173IdentityUnchanged'] and after['protectedPort4173SignalTargetsAbsent'])
after['passed'] = after['protectedPort4173IdentityUnchanged'] and after['protectedPort4173SignalTargetsAbsent'] and after['server'] is None and not after['port5371Listeners'] and after['port5371ConnectResult'] != 0 and not after['ownedBrowserRootPidsLive'] and not after['ownedCapturedBrowserProcessesLive'] and not after['ownedBrowserProfileProcessesLive']
with (out / 'after.json').open('x') as f:
    f.write(json.dumps(after, indent=2) + '\n')
assert after['passed'], 'Owned cleanup incomplete; direct observation preserved'
print(json.dumps({'passed': after['passed'], 'signalledServerPid': server_pid,
                  'ownedBrowserPidsAbsent': sorted(browser_pids), 'port5371ConnectResult': after['port5371ConnectResult'],
                  'protectedPort4173Touched': after['protectedPort4173Touched'], 'protectedPort4173Listeners': after['protectedPort4173Listeners']}))
