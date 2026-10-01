#!/usr/bin/env python3
import datetime, json, os, pathlib, sys

root_pid = int(sys.argv[1])
phase = sys.argv[2]
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
expected = '/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
ids = {root_pid}
while True:
    children = {pid for pid, row in table.items() if row['parentPid'] in ids}
    before = len(ids)
    ids |= children
    if len(ids) == before:
        break
root = table.get(root_pid)
checks = {'rootLive': root is not None,
          'selectedExecutable': bool(root and pathlib.Path(root['executable']).resolve() == pathlib.Path(expected).resolve()),
          'debuggingPipe': bool(root and any('--remote-debugging-pipe' in arg.split() for arg in root['argv']))}
record = {'phase': phase, 'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'rootPid': root_pid, 'expectedExecutable': expected, 'checks': checks,
          'processes': [table[pid] for pid in sorted(ids) if pid in table]}
out = pathlib.Path('work/ai-save401-final-83941bc-r1/browser-runtime') / phase / 'actual-process-r3.json'
with out.open('x') as f:
    f.write(json.dumps(record, indent=2) + '\n')
if not all(checks.values()):
    raise RuntimeError('Live process observation failed; raw observation preserved in ' + str(out))
print(json.dumps({'phase': phase, 'rootPid': root_pid, 'checks': checks, 'capturedProcesses': len(record['processes'])}))
