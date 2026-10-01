#!/usr/bin/env python3
"""Retain raw output and a receipt for an unchanged admitted command."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

run = Path(__file__).resolve().parent
root = Path('/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies')
name, *argv = sys.argv[1:]
assert name and argv
assert all(c in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in name)
receipt_path = run / 'logs' / (name + '.receipt.json')
assert not receipt_path.exists()
stdout_path = run / 'logs' / (name + '.stdout.log')
stderr_path = run / 'logs' / (name + '.stderr.log')
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
begin = time.monotonic()
executable = Path(shutil.which(argv[0]) or argv[0]).resolve()
with stdout_path.open('xb') as stdout, stderr_path.open('xb') as stderr:
    result = subprocess.run(argv, cwd=root, stdout=stdout, stderr=stderr)
receipt = {
    'argv': argv,
    'cwd': str(root),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'startedAt': start,
    'endedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'durationSeconds': time.monotonic() - begin,
    'exitCode': result.returncode,
    'executable': str(executable),
    'executableSha256': hashlib.sha256(executable.read_bytes()).hexdigest(),
    'launcherSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'environment': {k: os.environ[k] for k in ['OVF_PLAYWRIGHT_MODULE', 'OVF_CHROMIUM_EXECUTABLE'] if k in os.environ},
    'stdout': {'path': str(stdout_path), 'bytes': stdout_path.stat().st_size, 'sha256': hashlib.sha256(stdout_path.read_bytes()).hexdigest()},
    'stderr': {'path': str(stderr_path), 'bytes': stderr_path.stat().st_size, 'sha256': hashlib.sha256(stderr_path.read_bytes()).hexdigest()},
}
receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
if result.returncode:
    print(stdout_path.read_text(errors='replace')[-18000:])
    print(stderr_path.read_text(errors='replace')[-18000:], file=sys.stderr)
sys.exit(result.returncode)
