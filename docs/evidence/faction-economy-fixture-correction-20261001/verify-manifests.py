"""Verify isolated source, build, evidence, and unchanged production bytes."""
import hashlib
import json
from pathlib import Path
import subprocess


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
manifest = json.loads((evidence / 'source-manifest.json').read_text())
for key in ('sourceSha256', 'buildArtifactsSha256'):
    for name, expected in manifest[key].items():
        assert digest(root / name) == expected, f'{key}: {name}'
    print(f'{key}: {len(manifest[key])} hashes match')
artifacts = (evidence / 'artifacts.sha256').read_text().splitlines()
for line in artifacts:
    expected, name = line.split('  ', 1)
    assert digest(evidence / name) == expected, f'evidence: {name}'
print(f'evidence: {len(artifacts)} hashes match')
changed = subprocess.check_output([
    'git', 'diff', '--name-only', manifest['productionCommit'], '--', 'src'
], cwd=root, text=True)
assert not changed, f'production differs: {changed}'
for name, expected in manifest['productionSha256'].items():
    actual = subprocess.check_output([
        'git', 'show', f"{manifest['productionCommit']}:{name}"
    ], cwd=root)
    assert hashlib.sha256(actual).hexdigest() == expected, name
print(f"production: {len(manifest['productionSha256'])} pinned Git bytes match")
