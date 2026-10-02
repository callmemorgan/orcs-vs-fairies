import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

PLAN = json.loads(Path('/tmp/ovf-faction-827-readiness-20261001-r2/execution-plan.json').read_bytes())
OWN = PLAN['ownedCheckout']
OUT = Path(PLAN['evidenceParent'])
LOGS = OUT / 'logs'
mode = sys.argv[1]
units = [phase['unit'] for phase in PLAN['phases']] + [PLAN['preview']['unit']]
unit_records = []
known_groups = {}
if mode == 'drain':
    known_groups = {row['unit']: row['controlGroupPath'] for row in json.loads((LOGS / 'owned-processes-before-cleanup.json').read_bytes())['units']}
for unit in units:
    result = subprocess.run(['systemctl', '--user', 'show', unit, '--property=LoadState,ActiveState,SubState,MainPID,ControlGroup'], text=True, capture_output=True)
    properties = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    group = properties.get('ControlGroup') or known_groups.get(unit) or f'/user.slice/user-{os.getuid()}.slice/user@{os.getuid()}.service/app.slice/{unit}'
    path = Path('/sys/fs/cgroup') / group.lstrip('/')
    membership = {}
    if path.exists():
        for file in [path / 'cgroup.procs', *sorted(path.rglob('cgroup.procs'))]:
            if file.exists():
                membership[str(file)] = sorted(set(int(value) for value in file.read_text().split()))
    if mode == 'drain' and (any(membership.values()) or properties.get('MainPID') != '0' or properties.get('ActiveState') != 'inactive'):
        raise RuntimeError('Exact owned unit/cgroup has not drained: ' + unit)
    unit_records.append({'unit': unit, 'stateExitCode': result.returncode, 'stateStdout': result.stdout, 'stateStderr': result.stderr, 'controlGroupPath': group, 'cgroupExists': path.exists(), 'membership': membership})
ancestors = []
pid = os.getpid()
while pid > 0 and pid not in ancestors:
    ancestors.append(pid)
    try:
        pid = int((Path('/proc') / str(pid) / 'stat').read_text().split(') ', 1)[1].split()[1])
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        break
associated = []
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        command = (proc / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
        cwd = os.readlink(proc / 'cwd')
        exe = os.readlink(proc / 'exe')
        cgroups = (proc / 'cgroup').read_text()
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        continue
    if OWN in command or str(OUT) in command or cwd == OWN or any(row['controlGroupPath'] in cgroups for row in unit_records):
        associated.append({'pid': int(proc.name), 'exe': exe, 'cwd': cwd, 'command': command, 'cgroups': cgroups, 'currentProofObserverOrAncestor': int(proc.name) in ancestors})
survivors = [row for row in associated if not row['currentProofObserverOrAncestor']]
receipt = {'kind': 'exact-owned-cgroup-and-all-associated-process-observation', 'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'executionPin': PLAN['executionPin'], 'mode': mode, 'units': unit_records, 'associatedProcesses': associated, 'observerAndAncestorPids': ancestors, 'nonObserverAssociatedProcesses': survivors, 'executableNameFilterApplied': False, 'sourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
name = 'owned-processes-before-cleanup.json' if mode == 'capture' else 'owned-processes-after-cleanup.json'
with (LOGS / name).open('x') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
print(json.dumps({'receipt': str(LOGS / name), 'sha256': hashlib.sha256((LOGS / name).read_bytes()).hexdigest(), 'nonObserverAssociatedProcessCount': len(survivors), 'nonEmptyCgroups': sum(any(row['membership'].values()) for row in unit_records)}))
if mode == 'drain' and survivors:
    raise RuntimeError('Owned-associated process remains; preserve observation and do not kill other processes')
