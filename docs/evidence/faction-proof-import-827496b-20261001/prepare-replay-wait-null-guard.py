import argparse
import hashlib
import json
import os
import stat
import subprocess
from datetime import datetime, timezone
from pathlib import Path

OWN = Path('/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies')
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
OUT = Path(__file__).parent
SOURCE = '906e0bd25577a9d99473c88cc50e71700235754a'
RECIPE = '0bd7d51476cd855505b91ce76b232795afae867f'
TARGET = '8b96f5197adf5b4ddfa160c2fe5a550afdf7e9d8'
PRODUCT = '453c2218af9973b9eca8fb78392435bd9d46a740'
PATH = 'scripts/acceptance/faction-powers.mjs'
OLD = b"await ctx.wait(()=>window.rts.mode==='replay',null,60000);"
NEW = b"await ctx.wait(()=>window.rts?.mode==='replay',null,60000);"


def git(*args, cwd=OWN, env=None):
    return subprocess.check_output(['git', *args], cwd=cwd, env=env)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tree(pin):
    result = {}
    for row in git('ls-tree', '-r', '-z', pin).split(b'\0'):
        if row:
            meta, path = row.split(b'\t', 1)
            mode, kind, oid = meta.decode().split()
            result[path.decode()] = {'mode': mode, 'type': kind, 'gitBlob': oid}
    return result


def live_matches(root, path, identity):
    file = root / path
    metadata = file.lstat()
    assert stat.S_ISREG(metadata.st_mode) and not file.is_symlink(), path
    mode = '100755' if metadata.st_mode & 0o111 else '100644'
    assert mode == identity['mode'], path + ' mode'
    data = file.read_bytes()
    assert len(data) == identity['bytes'] and sha(data) == identity['sha256'], path + ' bytes'


args = argparse.ArgumentParser()
args.add_argument('--fixed-source', required=True)
args.add_argument('--target-root', default=TARGET)
parsed = args.parse_args()
fixed = parsed.fixed_source
TARGET = parsed.target_root
assert len(fixed) == 40
assert len(TARGET) == 40
original_bytes = (OUT / 'import-manifest.json').read_bytes()
assert sha(original_bytes) == 'b746476407100be6e6728647081ab471ed5997528939768c5d9459417510b95a'
original = json.loads(original_bytes)
assert sha((OUT / 'seven-file-import.patch').read_bytes()) == '15ad7a6372cf3529a0ecd6f93893521bfe7336a25ba0cf19d69379ea77522899'
files = list(original['sourceFiles'])
assert len(files) == 7 and PATH in files
assert git('rev-parse', 'HEAD').decode().strip() == fixed and not git('status', '--porcelain')
assert git('rev-parse', fixed + '^').decode().strip() == SOURCE
assert git('diff-tree', '--no-commit-id', '--name-only', '-r', SOURCE, fixed).decode().splitlines() == [PATH]
assert git('rev-parse', 'HEAD', cwd=ROOT).decode().strip() == TARGET and not git('status', '--porcelain', cwd=ROOT)
source_tree, fixed_tree, recipe_tree, target_tree, product_tree = map(tree, [SOURCE, fixed, RECIPE, TARGET, PRODUCT])
before = git('show', SOURCE + ':' + PATH)
after = git('show', fixed + ':' + PATH)
assert before.count(OLD) == 1 and after == before.replace(OLD, NEW)
assert len(after) == len(before) + 1
assert source_tree[PATH]['mode'] == fixed_tree[PATH]['mode'] == '100644'
assert (OWN / PATH).read_bytes() == after
for path in files:
    assert source_tree[path] == recipe_tree[path]
    original_target = original['sourceFiles'][path]['targetBefore']
    if original_target is None:
        assert path not in target_tree
    else:
        assert target_tree[path] == {key: original_target[key] for key in ('mode', 'type', 'gitBlob')}
    if path != PATH:
        assert fixed_tree[path] == recipe_tree[path]
    live_matches(OWN, path, {**fixed_tree[path], 'bytes': len(git('show', fixed + ':' + path)), 'sha256': sha(git('show', fixed + ':' + path))})

product_paths = list(original['productInputs'])
assert len(product_paths) == 568
root_live_paths = sorted(path.relative_to(ROOT).as_posix() for directory in ('src', 'public') for path in (ROOT / directory).rglob('*') if path.is_file() or path.is_symlink())
assert root_live_paths == sorted(path for path in product_paths if path.startswith(('src/', 'public/')))
for path, identity in original['productInputs'].items():
    expected = {key: identity[key] for key in ('mode', 'type', 'gitBlob')}
    assert target_tree[path] == product_tree[path] == expected
    live_matches(ROOT, path, identity)
for path, identity in original['retainedApprovedProofFiles'].items():
    live_matches(ROOT, path, identity)

env = {**os.environ, 'GIT_INDEX_FILE': str(OUT / 'null-guard-candidate.index')}
git('read-tree', TARGET, env=env)
for path in files:
    identity = fixed_tree[path]
    git('update-index', '--add', '--cacheinfo', identity['mode'], identity['gitBlob'], path, env=env)
candidate = git('write-tree', env=env).decode().strip()
candidate_tree = tree(candidate)
changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', TARGET, candidate).decode().splitlines()
assert sorted(changed) == sorted(files)
for path in product_paths:
    assert candidate_tree[path] == target_tree[path]
for path in original['retainedApprovedProofFiles']:
    assert candidate_tree[path] == target_tree[path]
for path in files:
    assert candidate_tree[path] == fixed_tree[path]
assert 'window.rts?.mode' in git('show', TARGET + ':scripts/acceptance/native-context.mjs').decode()
assert 'nativePointerInputs' in git('show', TARGET + ':scripts/acceptance/native-context.mjs').decode()
assert 'source.y = target.y = 23.9' in git('show', TARGET + ':scripts/acceptance/direction-defense-fixtures.ts').decode()

patch = git('diff', '--binary', '--full-index', '--no-ext-diff', SOURCE, fixed, '--', PATH)
patch_path = OUT / 'replay-wait-null-guard.patch'
patch_path.write_bytes(patch)
syntax = subprocess.run(['node', '--check', str(OWN / PATH)], capture_output=True, text=True)
assert syntax.returncode == 0, syntax.stderr
commit_message = git('log', '-1', '--format=%B', fixed).decode()
assert commit_message.endswith('🤖 Generated with [Codex](https://openai.com/codex/)\n\nCo-Authored-By: GPT-6 <noreply@openai.com>\n\n')
result = {
    'kind': 'separate-one-character-faction-proof-replay-wait-amendment',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'sourcePin': SOURCE, 'immutableRecipePin': RECIPE, 'fixedSourcePin': fixed,
    'targetRootPin': TARGET, 'immutableProductPin': PRODUCT,
    'originalPacketTargetRootPin': original['targetRootPin'],
    'targetChangesSinceOriginalPacket': git('diff', '--name-status', original['targetRootPin'], TARGET).decode().splitlines(),
    'sevenImportBaseIdentitiesUnchangedSinceOriginalPacket': True,
    'path': PATH, 'line': 29, 'beforePredicate': OLD.decode(), 'afterPredicate': NEW.decode(),
    'before': {**source_tree[PATH], 'bytes': len(before), 'sha256': sha(before)},
    'after': {**fixed_tree[PATH], 'bytes': len(after), 'sha256': sha(after)},
    'changedBytes': 'One ASCII question mark inserted; every other byte unchanged.',
    'fixedCommitChangesOnlyOneProofFile': True, 'sixOtherFilesMatchImmutableRecipe': True,
    'originalPacketHashesUnchanged': True, 'all568RootProductInputsMatchFreeze': True,
    'amendedCandidateTree': candidate, 'candidateIsPreviewTreeNotIntegratedCommit': True,
    'amendedCandidateChangesExactlySevenPaths': changed,
    'amendedCandidateRetainsAll568ProductInputs': True,
    'amendedCandidateRetainsThreeApprovedRootHelpers': True,
    'rootImportedOrExecuted': False, 'newIntegratedCommitStillRequired': True,
    'acceptanceBoundaryUnchanged': 'Existing default groups and all original native assertions remain unchanged; no additional gate.',
    'syntaxCheck': {'command': ['node', '--check', str(OWN / PATH)], 'exitCode': syntax.returncode, 'stdout': syntax.stdout, 'stderr': syntax.stderr, 'parserOnly': True},
    'patch': {'path': str(patch_path), 'bytes': len(patch), 'sha256': sha(patch)},
    'attribution': {'harness': 'Codex', 'model': 'GPT-6', 'email': 'noreply@openai.com'},
    'commitMessage': commit_message,
    'executionLimits': 'Static Git/live-byte checks, scratch index and Node syntax parser only. Runtime remains held; no application import/build/test/fixture/browser/server/dependency execution.',
    'allChecksPassed': True,
}
assert git('rev-parse', 'HEAD').decode().strip() == fixed and not git('status', '--porcelain')
assert git('rev-parse', 'HEAD', cwd=ROOT).decode().strip() == TARGET and not git('status', '--porcelain', cwd=ROOT)
manifest_path = OUT / 'replay-wait-null-guard-manifest.json'
manifest_path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'fixedSourcePin': fixed, 'amendedCandidateTree': candidate, 'patchSha256': sha(patch), 'manifestSha256': sha(manifest_path.read_bytes()), 'allChecksPassed': True}, indent=2))
