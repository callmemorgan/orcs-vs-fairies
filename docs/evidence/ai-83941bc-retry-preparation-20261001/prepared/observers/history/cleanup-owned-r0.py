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

traces = {phase: json.loads((base / 'browser-runtime' / phase / 'actual-launch-trace.json').read_text())
          for phase in ['coop-ui', 'online-ui']
          if (base / 'browser-runtime' / phase / 'actual-launch-trace.json').is_file()}
browser_pids = [launch['pid'] for trace in traces.values() for launch in trace['launches']]
profiles = [re.search(r'--user-data-dir=(\S+)', launch['launchLine']).group(1)
            for trace in traces.values() for launch in trace['launches']]
captured = []
for phase in traces:
    captured.extend(json.loads((base / 'browser-runtime' / phase / 'actual-process-r3.json').read_text())['processes'])

def snapshot():
    table = processes()
    root_pids = [pid for pid in browser_pids if pid in table]
    descendants = [row for row in captured if row['pid'] in table and row['startTicks'] == table[row['pid']]['startTicks']]
    profile_processes = [row for row in table.values() if any(profile in ' '.join(row['argv']) for profile in profiles)]
    return {'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'server': table.get(server_pid), 'ownedBrowserRootPidsLive': root_pids,
            'ownedCapturedBrowserProcessesLive': descendants, 'ownedBrowserProfileProcessesLive': profile_processes,
            'port5371Listeners': listeners(5371, table), 'protectedPort4173Listeners': listeners(4173, table)}

before = snapshot()
assert before['server']['cwd'] == repo and before['server']['argv'] == expected_argv
assert any(any(holder['pid'] == server_pid for holder in row['holders']) for row in before['port5371Listeners'])
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
after['protectedPort4173Touched'] = False
after['passed'] = after['server'] is None and not after['port5371Listeners'] and after['port5371ConnectResult'] != 0 and not after['ownedBrowserRootPidsLive'] and not after['ownedCapturedBrowserProcessesLive'] and not after['ownedBrowserProfileProcessesLive']
with (out / 'after.json').open('x') as f:
    f.write(json.dumps(after, indent=2) + '\n')
assert after['passed'], 'Owned cleanup incomplete; direct observation preserved'
print(json.dumps({'passed': after['passed'], 'signalledServerPid': server_pid,
                  'ownedBrowserPidsAbsent': browser_pids, 'port5371ConnectResult': after['port5371ConnectResult'],
                  'protectedPort4173Touched': False, 'protectedPort4173Listeners': after['protectedPort4173Listeners']}))
