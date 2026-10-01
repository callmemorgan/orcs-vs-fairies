"""Read Git objects and retained files only; never imports product modules."""
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO = Path('/home/morgana/Projects/orcs-vs-Fairies')
OLD = 'c86e273c70738f144a00fe75f5ecf39e7fa324d8'
NEW = 'c074cc5e610fc128d7b6ac894a61258d418463d4'
PLAN_ROOT = Path('/tmp/ovf-modes-c074-full-retry-plan.24wi_u6x')
BASE_PLAN = Path('/tmp/ovf-modes-final-acceptance-plan.c0rsxvtx')
PROOF = Path('/tmp/ovf-modes-final-proof.pk292s0o')
SUPPLEMENT = Path('/tmp/ovf-modes-product-path-audit.oy6krlwi/audit.json')
OUT = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
git = lambda *args: subprocess.check_output(['git', '-C', str(REPO), *args])
read_json = lambda path: json.loads(Path(path).read_text())

plan = read_json(PLAN_ROOT / 'plan.json')
old_preflight = read_json(BASE_PLAN / 'preflight.json')
old_plan_hashes = read_json(BASE_PLAN / 'plan-hashes.json')
prepared = read_json(PROOF / 'prepare.json')
provenance = prepared['provenance']
supplement = read_json(SUPPLEMENT)

checks = []
def check(name, condition, details=None):
    item = {'name': name, 'passed': bool(condition)}
    if details is not None:
        item['details'] = details
    checks.append(item)

def tree(pin):
    result = {}
    for row in git('ls-tree', '-r', '-z', pin).split(b'\0'):
        if not row:
            continue
        meta, path = row.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        result[path.decode()] = {'mode': mode, 'kind': kind, 'oid': oid}
    return result

old_tree, new_tree = tree(OLD), tree(NEW)
keys = ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles', 'modeScriptFiles']
product_keys = keys[:3]
product = {path: entry for key in product_keys for path, entry in provenance[key].items()}
all_inputs = {path: entry for key in keys for path, entry in provenance[key].items()}
config_paths = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'vitest.config.ts', 'index.html', 'editor.html']
proof_roots = ['scripts/controls-proof', 'scripts/minimap-alerts', 'scripts/modes']
proof_files = ['scripts/verify_minimap_levels.mjs', 'scripts/verify_assembled_modes.mjs', 'scripts/build-server.mjs', 'scripts/tournaments/smoke.json']
canonical_tests = sorted(provenance['testFiles'])
def in_product(path):
    return path.startswith(('src/', 'public/')) or path in config_paths
def in_proof(path):
    return any(path.startswith(root + '/') for root in proof_roots) or path in proof_files or path in canonical_tests
old_product_paths = {path for path in old_tree if in_product(path)}
new_product_paths = {path for path in new_tree if in_product(path)}
old_input_paths = {path for path in old_tree if in_product(path) or in_proof(path)}
new_input_paths = {path for path in new_tree if in_product(path) or in_proof(path)}

check('candidate pin', plan['candidateProductPin'] == NEW)
check('old pin remains separate', plan['oldActualEvidencePin'] == OLD and provenance['sourcePin'] == OLD)
check('product inventory includes added and deleted paths', old_product_paths == new_product_paths == set(product), {'old': len(old_product_paths), 'new': len(new_product_paths), 'added': sorted(new_product_paths - old_product_paths), 'deleted': sorted(old_product_paths - new_product_paths)})
check('complete admitted input inventory includes added and deleted paths', old_input_paths == new_input_paths == set(all_inputs), {'old': len(old_input_paths), 'new': len(new_input_paths), 'added': sorted(new_input_paths - old_input_paths), 'deleted': sorted(old_input_paths - new_input_paths)})
check('reported product input count', plan['productInputComparison']['inputsCompared'] == len(product) == 563)

changed_inputs = [path for path in sorted(all_inputs) if old_tree[path] != new_tree[path]]
check('only main differs among all admitted inputs', changed_inputs == ['src/main.ts'], changed_inputs)
check('admitted file modes and types preserved', all(old_tree[path]['mode'] == new_tree[path]['mode'] and old_tree[path]['kind'] == new_tree[path]['kind'] == 'blob' for path in all_inputs))

# Read all old input blobs in one Git process, then confirm their retained hashes.
oids = [old_tree[path]['oid'] for path in sorted(all_inputs)]
batch = subprocess.check_output(['git', '-C', str(REPO), 'cat-file', '--batch'], input=('\n'.join(oids) + '\n').encode())
offset = 0
old_bytes = {}
for path, oid in zip(sorted(all_inputs), oids):
    end = batch.index(b'\n', offset)
    header_oid, kind, size = batch[offset:end].decode().split()
    size = int(size)
    start = end + 1
    data = batch[start:start + size]
    assert header_oid == oid and kind == 'blob' and batch[start + size:start + size + 1] == b'\n'
    old_bytes[path] = data
    offset = start + size + 1
assert offset == len(batch)
old_hash_mismatches = [path for path, data in old_bytes.items() if len(data) != all_inputs[path]['bytes'] or sha(data) != all_inputs[path]['sha256'] or old_tree[path]['oid'] != all_inputs[path]['gitBlob']]
check('all 595 old frozen input hashes match Git', not old_hash_mismatches, {'inputs': len(all_inputs), 'mismatches': old_hash_mismatches})

before = b'cosmetics.reset();void cosmetics.refresh();'
after = b'cosmetics.reset();if(id)void cosmetics.refresh();'
main = git('show', NEW + ':src/main.ts')
check('main is single guard replacement', old_bytes['src/main.ts'].count(before) == 1 and main == old_bytes['src/main.ts'].replace(before, after, 1))
check('main SHA matches plan', sha(main) == plan['productInputComparison']['mainSha256'])
guard_diff = git('diff', '--no-ext-diff', '--no-renames', OLD, NEW, '--', 'src/main.ts')
check('saved guard diff matches Git', guard_diff == (PLAN_ROOT / 'guard-root.diff').read_bytes())

admitted_reads = {}
for path, expected in plan['admittedInputsAtCandidate'].items():
    data = git('show', NEW + ':' + path)
    actual = {'bytes': len(data), 'sha256': sha(data), 'gitBlob': new_tree[path]['oid']}
    admitted_reads[path] = actual
    check('admitted candidate hash: ' + path, expected == actual == old_preflight['inputs'][path])
check('all eleven admitted hashes represented', set(plan['admittedInputsAtCandidate']) == set(old_preflight['inputs']) and len(admitted_reads) == 11)

file_hashes = {}
for group in ['unchangedWrappers', 'references', 'files']:
    for label, expected in plan[group].items():
        data = Path(expected['path']).read_bytes()
        actual = {'bytes': len(data), 'sha256': sha(data)}
        file_hashes[expected['path']] = actual
        check(group + ': ' + label, actual['bytes'] == expected['bytes'] and actual['sha256'] == expected['sha256'])
        if group == 'unchangedWrappers':
            check('original admitted wrapper: ' + label, actual == old_plan_hashes['files'][label])

check('supplement external hash', sha(SUPPLEMENT.read_bytes()) == 'ce03daf798e07c7ba1f6aaf2b6484bd2e3198677d87578285358c7aa2346e644')
check('supplement matches independent path comparison', supplement['oldPin'] == OLD and supplement['candidatePin'] == NEW and supplement['pathInventoryEqualityPassed'] and supplement['productInputs'] == len(product) and not supplement['addedProductPaths'] and not supplement['deletedProductPaths'] and supplement['changedProductPaths'] == ['M\tsrc/main.ts'])
check('plan keeps required release and pin gates', plan['rootFinalPinRequiredBeforeExecution'] and plan['heavyCpuReleaseRequired'] and plan['currentHeavyOwnerSession'] == '23309')
check('plan uses full recipe', plan['scope'] == 'unchanged full four-stage acceptance' and not plan['derivativeLauncherCreated'])
check('plan records failed earlier run', plan['oldWholeRunResult'] == 'failed' and plan['oldBrowserResult'] == 'failed at finalization' and plan['oldNaturalStageResult'] == 'passed five cases' and not plan['oldNativeExportValidatorsRun'])

all_repo_changed = sorted(path for path in set(old_tree) | set(new_tree) if old_tree.get(path) != new_tree.get(path))
outside = sorted(set(all_repo_changed) - set(all_inputs))
outside_nondocs = [path for path in outside if not path.startswith('docs/')]
repo_stats = {'oldTrackedPaths': len(old_tree), 'candidateTrackedPaths': len(new_tree), 'changedPaths': len(all_repo_changed), 'outsideModeInputs': len(outside), 'outsideModesNonDocumentation': outside_nondocs, 'outsideModesDocumentation': len(outside) - len(outside_nondocs), 'added': len(set(new_tree) - set(old_tree)), 'deleted': len(set(old_tree) - set(new_tree))}
report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'oldPin': OLD, 'candidatePin': NEW, 'result': 'passed static hash/path review' if all(item['passed'] for item in checks) else 'failed static hash/path review', 'checks': checks, 'productInputCount': len(product), 'completeAdmittedInputCount': len(all_inputs), 'inputCategoryCounts': {key: len(provenance[key]) for key in keys}, 'mainSha256': sha(main), 'admittedReads': admitted_reads, 'fileHashes': file_hashes, 'supplementSha256': sha(SUPPLEMENT.read_bytes()), 'repositoryChanges': repo_stats, 'originalPlanJsonSha256': sha((PLAN_ROOT / 'plan.json').read_bytes()), 'runtimeExecuted': False, 'buildsExecuted': False, 'testsExecuted': False, 'productModulesImported': False, 'browserExecuted': False, 'serverStarted': False, 'dependenciesInstalled': False, 'reviewScript': str(Path(__file__).resolve())}
(OUT / 'facts.json').write_text(json.dumps(report, indent=2) + '\n')
(OUT / 'outside-mode-input-paths.json').write_text(json.dumps(outside, indent=2) + '\n')
print(json.dumps({'result': report['result'], 'checks': len(checks), 'failed': [item for item in checks if not item['passed']], 'facts': str(OUT / 'facts.json'), 'factsSha256': sha((OUT / 'facts.json').read_bytes()), 'repositoryChanges': repo_stats}, indent=2))
