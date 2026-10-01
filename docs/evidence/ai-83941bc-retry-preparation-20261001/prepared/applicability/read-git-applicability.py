#!/usr/bin/env python3
import hashlib, json, pathlib, subprocess

repo = pathlib.Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
out = pathlib.Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/applicability')
old = '453c2218af9973b9eca8fb78392435bd9d46a740'
new = '83941bc80ce9ec08840b0645d9b33e8018d5309a'
sha = lambda data: hashlib.sha256(data).hexdigest()
def git(*args):
    return subprocess.check_output(['git', '-C', str(repo), *args])
def blob(pin, path):
    return git('show', pin + ':' + path)
def tree(pin, paths):
    result = {}
    for row in git('ls-tree', '-rz', '--long', pin, '--', *paths).split(b'\0'):
        if not row:
            continue
        meta, name = row.split(b'\t', 1)
        mode, kind, oid, size = meta.split()
        assert kind == b'blob'
        result[name.decode()] = {'mode': mode.decode(), 'gitBlob': oid.decode(), 'bytes': int(size)}
    return result

assert git('rev-parse', 'HEAD').decode().strip() == old
assert not git('status', '--porcelain=v1', '--untracked-files=no')
parent = git('rev-parse', new + '^').decode().strip()
assert parent == 'efeb9a8e1363e3360774699ba3facc82ccf3f836'
changed = git('diff', '--name-only', parent, new).decode().splitlines()
proofs = ['scripts/verify_assembled_coop.mjs', 'scripts/verify_assembled_online.mjs']
assert changed == proofs
parser = []
for path in proofs:
    before, after = blob(parent, path), blob(new, path)
    needle = b".locator('.online-lobby-id').textContent()).trim()"
    replacement = b".locator('.online-lobby-id').textContent()).split(' \xc2\xb7 ',1)[0].trim()"
    assert before.count(needle) == 1
    assert after == before.replace(needle, replacement, 1)
    assert before == blob(old, path)
    parser.append({'path': path, 'beforeSha256': sha(before), 'afterSha256': sha(after),
                   'assertionsOtherwiseByteIdentical': True})

sealed = repo / 'work/ai-save401-final-453c221-r1'
manifest_path = sealed / 'final-manifest.json'
assert sha(manifest_path.read_bytes()) == 'bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681'
source_path = sealed / 'envelopes/build-web/source-before.json'
source = json.loads(source_path.read_text())
categories = ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles', 'canonicalFiles']
recorded = {path: item for category in categories for path, item in source[category].items()}
old_tree, new_tree = tree(old, list(recorded)), tree(new, list(recorded))
assert set(old_tree) == set(new_tree) == set(recorded)
for path, item in recorded.items():
    assert old_tree[path]['gitBlob'] == item['gitBlob'] and old_tree[path]['bytes'] == item['bytes']
differences = [path for path in sorted(recorded) if old_tree[path] != new_tree[path]]
assert differences == proofs
groups = {category: {'count': len(source[category]),
                     'unchangedCount': sum(old_tree[path] == new_tree[path] for path in source[category])}
          for category in categories}
runtime_paths = ['src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json',
                 'vitest.config.ts', 'index.html', 'editor.html', 'scripts/build-server.mjs']
runtime_old, runtime_new = tree(old, runtime_paths), tree(new, runtime_paths)
assert runtime_old == runtime_new
wrapper = repo / 'work/final-ai-prep/proof-envelope.mjs'
assert sha(wrapper.read_bytes()) == 'bb8c80fc33ca6a25e044a5df60350030bb2177461d265025b9bfcffcdc3a1cd2'
result = {'kind': 'static-file-and-git-applicability', 'oldProductProofPin': old, 'retryProofPin': new,
          'retryParent': parent, 'currentCheckoutStillAtOldPin': True, 'trackedCheckoutClean': True,
          'runtimeFilesIdentical': len(runtime_old), 'boundInputCount': len(recorded),
          'boundDifferences': differences, 'groups': groups, 'parserChanges': parser,
          'oldSourceRecord': str(source_path), 'oldSourceRecordSha256': sha(source_path.read_bytes()),
          'unchangedWrapperSha256': sha(wrapper.read_bytes()), 'buildIdFromOldAuthenticatedSource': source['buildId'],
          'newBuildEnvelopesRequired': True,
          'reason': 'The unchanged wrapper requires each build envelope sourcePin and complete source record to equal the browser proof pin. Old453 build envelopes cannot bind839 even though runtime source bytes are identical.',
          'priorPassingClaims': 'Natural allied, allied UI and roster UI remain claims at their actual453 pins. No rerun is needed solely for these two proof-parser changes.',
          'limits': 'Static Git/file inspection only. No checkout change, build, compiler, test, simulation, browser, server, install or runtime retry was executed.'}
with (out / 'applicability.json').open('x') as f:
    f.write(json.dumps(result, indent=2) + '\n')
with (out / '839-parent-proof-parser.patch').open('xb') as f:
    f.write(git('diff', parent, new, '--', *proofs))
print(json.dumps({'retryProofPin': new, 'runtimeFilesIdentical': len(runtime_old),
                  'boundInputCount': len(recorded), 'boundDifferences': differences,
                  'buildEnvelopesMustBeFresh839': True, 'runtimeExecuted': False}))
