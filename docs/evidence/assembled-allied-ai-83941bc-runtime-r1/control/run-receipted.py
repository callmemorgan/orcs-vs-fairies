#!/usr/bin/env python3
"""Run one approved child, retain its output, and check its PID after exit."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--name', required=True)
parser.add_argument('--cwd', required=True)
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
root = Path(__file__).resolve().parent / 'receipts'
command = args.command[1:] if args.command[:1] == ['--'] else args.command
assert command and '/' not in args.name and '..' not in args.name
start_path = root / (args.name + '-start.json')
end_path = root / (args.name + '-end.json')
log_path = root / (args.name + '.log')
assert not any(p.exists() for p in (start_path, end_path, log_path))

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def identity(pid):
    proc = Path('/proc') / str(pid)
    raw_stat = (proc / 'stat').read_text()
    return {'pid': pid, 'exe': os.readlink(proc / 'exe'),
            'cwd': os.readlink(proc / 'cwd'),
            'argv': (proc / 'cmdline').read_bytes().rstrip(b'\0').decode().split('\0'),
            'start_ticks': int(raw_stat.rsplit(')', 1)[1].split()[19])}

with log_path.open('xb') as log:
    child = subprocess.Popen(command, cwd=args.cwd, stdin=subprocess.DEVNULL,
                             stdout=log, stderr=subprocess.STDOUT,
                             start_new_session=True)
    record = {'started_at': now(), 'command': command, 'cwd': args.cwd,
              'child_identity': identity(child.pid)}
    with start_path.open('x') as handle:
        json.dump(record, handle, indent=2)
        handle.write('\n')
    exit_code = child.wait()
    log.flush()
    os.fsync(log.fileno())
proc_path = Path('/proc') / str(child.pid)
remaining = identity(child.pid) if proc_path.exists() else None
same_process_live = (remaining is not None and
                     remaining['start_ticks'] == record['child_identity']['start_ticks'])
result = {'ended_at': now(), 'exit_code': exit_code,
          'child_identity': record['child_identity'],
          'pid_path_absent_after_wait': not proc_path.exists(),
          'same_process_live_after_wait': same_process_live,
          'current_pid_identity': remaining, 'log': str(log_path)}
with end_path.open('x') as handle:
    json.dump(result, handle, indent=2)
    handle.write('\n')
print(json.dumps(result, indent=2))
assert not same_process_live, 'Owned child remains live'
raise SystemExit(exit_code)
