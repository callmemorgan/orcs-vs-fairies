"""Retain the frozen AI839 allowlist without rewriting any original bytes."""
import datetime
import hashlib
import json
import pathlib
import stat
import subprocess

ROOT = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
PLAN = pathlib.Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-839-runtime-import-r1/bounded-import-plan.json')
PLAN_SHA = 'a3a8632012df3638643056a53510041010d440a8d0f6231894ba4d2bb9de69b3'
PREFIX = 'docs/evidence/assembled-allied-ai-83941bc-runtime-r1'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def git(*args, data=None):
    return subprocess.run(['git', *args], cwd=ROOT, input=data, capture_output=True, check=True).stdout

def safe(relative):
    p = pathlib.PurePosixPath(relative)
    assert not p.is_absolute() and '..' not in p.parts
    assert str(p).startswith(PREFIX + '/')
    target = ROOT / p
    assert target.resolve().is_relative_to(ROOT / PREFIX)
    return target

def authenticated(path, size, digest):
    assert stat.S_ISREG(path.lstat().st_mode), str(path)
    data = path.read_bytes()
    assert len(data) == size and sha(data) == digest, str(path)
    return data

raw = authenticated(PLAN, 734059, PLAN_SHA)
plan = json.loads(raw)
assert plan['repositoryRoot'] == str(ROOT) and plan['repositoryPrefix'] == PREFIX
rows = plan['copies'] + [{'source': str(PLAN), 'destination': PREFIX + '/import-plan/bounded-import-plan.json', 'bytes': len(raw), 'sha256': PLAN_SHA, 'kind': 'original-final-plan'}]
assert len(rows) == 253 and sum(r['bytes'] for r in rows) == 45392276
assert len({r['destination'] for r in rows}) == len(rows)
for row in rows:
    assert not safe(row['destination']).exists(), row['destination']

# Git references are verified against immutable tree/blob metadata. Their original
# SHA-256 seals remain attributed to the earlier full-read authentication.
pin = plan['sourcePin']
tree = git('rev-parse', pin + '^{tree}').decode().strip()
entries = {}
for item in git('ls-tree', '-r', '-z', pin, '--', 'public').split(b'\0'):
    if item:
        header, path = item.split(b'\t', 1)
        mode, kind, blob = header.decode().split()
        entries[path.decode()] = (mode, kind, blob)
refs = plan['immutablePublicReferences']
assert len(refs) == 394
objects = git('cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)', data=('\n'.join(r['public_source']['git_blob'] for r in refs) + '\n').encode()).decode().splitlines()
for row, obj in zip(refs, objects, strict=True):
    source = row['public_source']
    assert source['commit'] == pin and source['root_tree'] == tree
    assert entries[source['repository_relative_source']] == (source['mode'], 'blob', source['git_blob'])
    assert obj == f"{source['git_blob']} blob {source['bytes']}"
reachable = git('for-each-ref', '--format=%(refname)', '--contains', pin).decode().splitlines()
assert reachable, 'Immutable source pin needs a reachable Git ref'
natural = []
for row in plan['previouslyRetainedNaturalEvidenceReferences']:
    data = git('show', row['commit'] + ':' + row['path'])
    assert len(data) == row['bytes'] and sha(data) == row['sha256']
    assert git('rev-parse', row['commit'] + ':' + row['path']).decode().strip() == row['gitBlob']
    natural.append({'path': row['path'], 'commit': row['commit'], 'bytes': len(data), 'sha256': sha(data), 'passed': True})
external = []
for row in plan['externalRawReferences']:
    source = pathlib.Path(row['external_source']['absolute_path'])
    s = source.lstat()
    assert stat.S_ISREG(s.st_mode) and s.st_size == row['bytes']
    external.append({'path': str(source), 'bytes': s.st_size, 'sha256': row['sha256'], 'identityBasis': 'Previously full-read seal; current stat checked only', 'readHashedCopiedEncodedDeleted': False})

copied = []
for row in rows:
    source = pathlib.Path(row['source'])
    data = authenticated(source, row['bytes'], row['sha256'])
    target = safe(row['destination'])
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('xb') as f:
        f.write(data)
    assert authenticated(target, row['bytes'], row['sha256']) == data
    copied.append({**row, 'sourceFullByteReadbackPassed': True, 'destinationFullByteReadbackPassed': True})

receipt = {
    'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'producer': {'harness': 'Codex', 'model': 'GPT-6', 'agent': '/root'},
    'plan': {'source': str(PLAN), 'bytes': len(raw), 'sha256': PLAN_SHA},
    'copiedOriginalFiles': len(copied), 'copiedOriginalBytes': sum(r['bytes'] for r in copied),
    'copies': copied, 'immutablePublicReferenceCount': len(refs),
    'immutablePublicReferencesMetadataVerified': True, 'sourcePinReachableThrough': reachable,
    'previouslyRetainedNaturalReferences': natural, 'externalRawReferences': external,
    'runtime': 'No new runtime, build, test, codec or database operation performed by this importer.',
    'outcomes': {'coop': 'Passed14checks; coordinated-opponent evidence is later same-match data', 'online': 'Failed after6partialchecks; candidate retained only'},
    'limits': plan['limits'], 'status': 'all_original_copies_full_byte_verified'
}
out = ROOT / PREFIX / 'root-retention.json'
with out.open('x') as f:
    json.dump(receipt, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(json.dumps({'receipt': str(out), 'files': len(copied), 'bytes': receipt['copiedOriginalBytes'], 'publicRefs': len(refs), 'externalDBRead': False, 'status': receipt['status']}))
