#!/usr/bin/env python3
"""Check source preservation, prepared files, and the eight owned child jobs."""
import hashlib
import json
from pathlib import Path
import subprocess

WORK = Path(__file__).resolve().parent
PREP = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1')
REPO = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
initial = json.loads((WORK / 'receipts/initial-state.json').read_text())
static_bytes = (PREP / 'prepared-files.json').read_bytes()
assert hashlib.sha256(static_bytes).hexdigest() == initial['prepared_files_manifest_sha256']
static = json.loads(static_bytes)
for rel, expected in static['files'].items():
    data = (PREP / rel).read_bytes()
    assert {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} == expected, rel
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO).decode().strip()
tracked = subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=no'], cwd=REPO)
untracked_sha = hashlib.sha256(subprocess.check_output(
    ['git', 'status', '--porcelain=v1', '-uall'], cwd=REPO)).hexdigest()
assert head == initial['original_source_pin'] and not tracked
assert untracked_sha == initial['untracked_status_sha256']
ends = sorted((WORK / 'receipts').glob('*-end.json'))
assert len(ends) == 8, 'Expected eight recorded verification/codec/copy child jobs'
identities = []
for end in ends:
    value = json.loads(end.read_text())
    assert value['exit_code'] == 0 and not value['same_process_live_after_wait']
    assert value['pid_path_absent_after_wait']
    proc = Path('/proc') / str(value['child_identity']['pid'])
    assert not proc.exists(), str(proc)
    identities.append(value['child_identity'])
patterns = [str(PREP / 'retention/held-sqlite-lossless.py'),
            str(PREP / 'retention/restore-public-duplicates.py'),
            str(WORK / 'retain-and-verify.py')]
live = []
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        argv = (proc / 'cmdline').read_bytes().rstrip(b'\0').decode(errors='replace').split('\0')
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        continue
    if any(pattern in argv for pattern in patterns):
        live.append({'pid': int(proc.name), 'argv': argv})
assert not live, live
assert not (REPO / 'work/ai-save401-final-83941bc-r1').exists()
original = json.loads((WORK / 'receipts/original-after.log').read_text())
historical = json.loads((WORK / 'receipts/history-after.log').read_text())
assert original['passed'] and original['files'] == 590
assert original['manifestSha256'] == 'bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681'
assert historical['sameAsBefore'] and historical['historicalEntries'] == 838
assert historical['fileBytes'] == 68452550
record = {'state': 'originals_unchanged_and_owned_processes_absent', 'head': head,
          'tracked_clean': True, 'untracked_status_unchanged': True,
          'untracked_status_sha256': untracked_sha, 'original_packet_entries': 590,
          'original_packet_bytes': 373014330,
          'original_manifest_sha256': original['manifestSha256'],
          'historical_entries': 838, 'historical_file_bytes': 68452550,
          'historical_files_and_dependency_symlink_unchanged': True,
          'static_preparation_files_checked': len(static['files']) + 1,
          'static_preparation_unchanged': True, 'owned_child_identities': identities,
          'owned_child_jobs': len(identities), 'owned_child_pid_paths_absent': True,
          'owned_codec_restore_retain_commands_live': live,
          'browser_or_server_started': False, 'future_839_execution_directory_absent': True,
          'port_4173_touched': False,
          'scope': 'Old 453 retention only; hosted failed SQLite excluded; old acceptance results unchanged.'}
with (WORK / 'receipts/closing-state.json').open('x') as out:
    json.dump(record, out, indent=2)
    out.write('\n')
print(json.dumps({k: v for k, v in record.items() if k != 'owned_child_identities'}, indent=2))
