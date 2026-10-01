#!/usr/bin/env python3
"""UNEXECUTED recipe. Restore indexed public bytes into a new retention directory."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/retention')
REPO = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
OLD_PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
PIN = '83941bc80ce9ec08840b0645d9b33e8018d5309a'
MANIFEST_SHA256 = 'bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681'
INVENTORY_SHA256 = 'eb414c0a5c82b49110c36e83c8fad83e16c35ff886560d1116511a334b52c910'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def tree(ref):
    raw = subprocess.check_output(['git', 'ls-tree', '-r', '-l', '-z', ref, 'public'], cwd=REPO)
    result = {}
    for record in raw.split(b'\0'):
        if not record:
            continue
        head, path = record.split(b'\t', 1)
        mode, kind, blob, size = head.split()
        require(kind == b'blob', 'Unexpected Git object type')
        result[path.decode()] = (mode.decode(), blob.decode(), int(size))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-name', required=True)
    args = parser.parse_args()
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', args.run_name), 'Invalid run name')
    require(ROOT.is_dir() and not ROOT.is_symlink(), 'Pinned retention directory is unavailable')
    manifest_bytes = (ROOT / 'sealed-final-manifest.json').read_bytes()
    inventory_bytes = (ROOT / 'sealed-public-asset-source-before.json').read_bytes()
    require(hashlib.sha256(manifest_bytes).hexdigest() == MANIFEST_SHA256, 'Copied manifest hash differs')
    require(hashlib.sha256(inventory_bytes).hexdigest() == INVENTORY_SHA256, 'Copied source inventory hash differs')
    manifest, inventory = json.loads(manifest_bytes), json.loads(inventory_bytes)
    require(manifest['sourcePin'] == OLD_PIN and inventory['sourcePin'] == OLD_PIN, 'Original source pin differs')
    old_tree, new_tree = tree(OLD_PIN), tree(PIN)
    with (ROOT / 'source-backed-public-duplicates.tsv').open(newline='') as handle:
        rows = list(csv.DictReader(handle, delimiter='\t'))
    require(len(rows) == 394 and len({r['original_path'] for r in rows}) == 394, 'Duplicate index count differs')
    require(sum(int(r['original_bytes']) for r in rows) == 68373454, 'Duplicate index size differs')
    run_dir = ROOT / args.run_name
    require(run_dir.parent.resolve() == ROOT.resolve(), 'Output directory escapes retention')
    run_dir.mkdir(exist_ok=False)
    records = []
    for row in rows:
        original_path, source_path = row['original_path'], row['source_path']
        require(source_path.startswith('public/') and original_path == 'dist/' + source_path[len('public/'):], 'Unexpected path mapping')
        require('..' not in Path(original_path).parts, 'Unsafe output path')
        expected = manifest['files'][original_path]
        asset = inventory['assetFiles'][source_path]
        require(row['original_source_pin'] == OLD_PIN and row['comparison_source_pin'] == PIN, 'Indexed source pin differs')
        require(row['sealed_manifest_sha256'] == MANIFEST_SHA256 and row['source_inventory_sha256'] == INVENTORY_SHA256, 'Indexed metadata hash differs')
        require(row['original_sha256'] == expected['sha256'] and int(row['original_bytes']) == expected['bytes'], 'Indexed original record differs')
        require(asset['sha256'] == expected['sha256'] and asset['bytes'] == expected['bytes'], 'Source asset record differs')
        expected_tree = ('100644', asset['gitBlob'], asset['bytes'])
        require(old_tree[source_path] == new_tree[source_path] == expected_tree, 'Pinned Git trees differ')
        require(row['original_git_blob'] == row['comparison_git_blob'] == asset['gitBlob'], 'Indexed Git blob differs')
        payload = subprocess.check_output(['git', 'cat-file', 'blob', asset['gitBlob']], cwd=REPO)
        require(len(payload) == expected['bytes'] and hashlib.sha256(payload).hexdigest() == expected['sha256'], 'Restored Git blob differs from original record')
        destination = run_dir / original_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open('xb') as handle:
            handle.write(payload)
        written = destination.read_bytes()
        require(len(written) == expected['bytes'] and hashlib.sha256(written).hexdigest() == expected['sha256'], 'Written restored bytes differ')
        records.append({'path': original_path, 'source_path': source_path, 'gitBlob': asset['gitBlob'], **expected})
    result = {'state': 'restored_and_sha256_verified', 'original_source_pin': OLD_PIN,
              'comparison_source_pin': PIN, 'original_manifest_sha256': MANIFEST_SHA256,
              'entries': len(records), 'bytes': sum(r['bytes'] for r in records),
              'output': str(run_dir), 'files': records, 'original_packet_mutated': False}
    with (run_dir / 'restore-result.json').open('x') as handle:
        json.dump(result, handle, indent=2)
        handle.write('\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'files'}, indent=2))


if __name__ == '__main__':
    main()
