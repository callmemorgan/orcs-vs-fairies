#!/usr/bin/env python3
import datetime, hashlib, json, pathlib, re, sys

phase = sys.argv[1]
base = pathlib.Path('work/ai-save401-final-453c221-r1')
trace = base / 'envelopes' / phase / 'stderr.log'
data = trace.read_bytes()
lines = data.decode().splitlines()
expected = '/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
launches = []
for i, line in enumerate(lines):
    if 'pw:browser <launching> ' not in line:
        continue
    command = line.split('pw:browser <launching> ', 1)[1]
    if not command.startswith(expected + ' ') or '--remote-debugging-pipe' not in command.split():
        raise RuntimeError('Unexpected browser launch')
    following = lines[i + 1:]
    launched = next(x for x in following if 'pw:browser <launched> pid=' in x)
    pid = int(launched.rsplit('pid=', 1)[1])
    closed = [x for x in following if f'[pid={pid}] <process did exit:' in x]
    if len(closed) != 1 or 'exitCode=0, signal=null' not in closed[0]:
        raise RuntimeError('Owned browser did not exit normally')
    launches.append({'pid': pid, 'executablePath': expected, 'launchLine': line,
                     'launchedLine': launched, 'exitLine': closed[0]})
if not launches:
    raise RuntimeError('No launch evidence')
record = {'phase': phase, 'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'trace': str(trace), 'traceBytes': len(data), 'traceSha256': hashlib.sha256(data).hexdigest(),
          'launches': launches,
          'limits': 'Authenticates Playwright DEBUG launch and normal-exit trace. Does not recover a past live /proc observation or browser.version(). Before/after browser identity records separately authenticate selected executable and package bytes.'}
out = base / 'browser-runtime' / phase / 'actual-launch-trace.json'
with out.open('x') as f:
    f.write(json.dumps(record, indent=2) + '\n')
print(json.dumps({'phase': phase, 'launches': len(launches), 'pids': [x['pid'] for x in launches],
                  'traceSha256': record['traceSha256'], 'record': str(out)}))
