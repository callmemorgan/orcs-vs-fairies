def require(condition, message):
    if not condition:
        raise RuntimeError(message)
import hashlib
import argparse
import json
import os
import shutil
import stat
import subprocess
from datetime import datetime, timezone
from pathlib import Path
OWN = Path('/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies')
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
PREP = Path(__file__).parent
OUT = OWN.parent / 'faction-native-827-20261001-r1'
PIN = '827496b06bb660b6639257e5113ac2f199be29ba'
RECIPE = '0bd7d51476cd855505b91ce76b232795afae867f'
SOURCE = '906e0bd25577a9d99473c88cc50e71700235754a'
GUARD = '881dff253f0392c0e539efe21af744ed2a57b214'
PRODUCT = '453c2218af9973b9eca8fb78392435bd9d46a740'
OLD_TARGET = '8b96f5197adf5b4ddfa160c2fe5a550afdf7e9d8'
PACKET = Path('/tmp/ovf-faction-seven-file-import-453-8b96-20261001')

def git(*args, cwd=OWN):
    return subprocess.check_output(['git', '--no-replace-objects', *args], cwd=cwd)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def fingerprint(path):
    path = Path(path).resolve(strict=True)
    h = hashlib.sha256()
    with path.open('rb') as file:
        while (data := file.read(1024 * 1024)):
            h.update(data)
    return {'path': str(path), 'bytes': path.stat().st_size, 'sha256': h.hexdigest()}

def tree(pin):
    result = {}
    for row in git('ls-tree', '-r', '-z', pin).split(b'\x00'):
        if row:
            meta, path = row.split(b'\t', 1)
            mode, kind, blob = meta.decode().split()
            result[path.decode()] = {'mode': mode, 'type': kind, 'gitBlob': blob}
    return result

def inspect_file(path, expected):
    file = OWN / path
    metadata = file.lstat()
    require(stat.S_ISREG(metadata.st_mode) and (not file.is_symlink()), path)
    require(('100755' if metadata.st_mode & 73 else '100644') == expected['mode'], path)
    data = file.read_bytes()
    require(data == git('cat-file', 'blob', expected['gitBlob']), path)
    return {**expected, 'bytes': len(data), 'sha256': digest(data)}
require(git('rev-parse', 'HEAD').decode().strip() == PIN, 'Static readiness condition failed')
require(not git('status', '--porcelain'), 'Static readiness condition failed')
require(git('rev-parse', 'HEAD^{tree}').decode().strip() == '0ba9d13ae4c7de9819cec4150e5085e0daf6752d', 'Static readiness condition failed')
require(OUT.is_dir() and (not list(OUT.iterdir())), 'Reserved evidence parent is still empty')
original_bytes = (PACKET / 'import-manifest.json').read_bytes()
require(digest(original_bytes) == 'b746476407100be6e6728647081ab471ed5997528939768c5d9459417510b95a', 'Static readiness condition failed')
original = json.loads(original_bytes)
pinned, recipe, source, guard, product, retained_base = map(tree, [PIN, RECIPE, SOURCE, GUARD, PRODUCT, OLD_TARGET])
seven = {}
for path in original['sourceFiles']:
    require(pinned[path] == guard[path], 'Static readiness condition failed')
    require(source[path] == recipe[path], 'Static readiness condition failed')
    if path != 'scripts/acceptance/faction-powers.mjs':
        require(pinned[path] == recipe[path], 'Static readiness condition failed')
    seven[path] = inspect_file(path, pinned[path])
before = git('show', SOURCE + ':scripts/acceptance/faction-powers.mjs')
after = (OWN / 'scripts/acceptance/faction-powers.mjs').read_bytes()
old = b"window.rts.mode==='replay'"
new = b"window.rts?.mode==='replay'"
require(before.count(old) == 1 and after == before.replace(old, new), 'Static readiness condition failed')
product_inputs = {}
for path in original['productInputs']:
    require(pinned[path] == product[path], 'Static readiness condition failed')
    product_inputs[path] = inspect_file(path, pinned[path])
require(len(product_inputs) == 568, 'Static readiness condition failed')
for directory in ('src', 'public', 'scripts/acceptance'):
    actual = sorted((path.relative_to(OWN).as_posix() for path in (OWN / directory).rglob('*') if path.is_file() or path.is_symlink()))
    expected = sorted((path for path in pinned if path.startswith(directory + '/')))
    require(actual == expected, directory + ' complete live inventory')
proof = {path: inspect_file(path, pinned[path]) for path in pinned if path.startswith('scripts/acceptance/')}
retained = {}
for path in original['retainedApprovedProofFiles']:
    require(pinned[path] == retained_base[path], 'Static readiness condition failed')
    retained[path] = inspect_file(path, pinned[path])
require('window.rts?.mode' in (OWN / 'scripts/acceptance/native-context.mjs').read_text(), 'Static readiness condition failed')
require('nativePointerInputs' in (OWN / 'scripts/acceptance/native-context.mjs').read_text(), 'Static readiness condition failed')
require('source.y = target.y = 23.9' in (OWN / 'scripts/acceptance/direction-defense-fixtures.ts').read_text(), 'Static readiness condition failed')
lock = json.loads((OWN / 'package-lock.json').read_text())
packages = {}
for name in ('typescript', 'vite', 'esbuild', 'vitest', 'phaser', 'ws', '@esbuild/linux-x64'):
    path = ROOT / 'node_modules' / name / 'package.json'
    metadata = json.loads(path.read_text())
    require(metadata['version'] == lock['packages']['node_modules/' + name]['version'], name + ' locked version')
    packages[name] = {**fingerprint(path), 'version': metadata['version']}
compiler = {'module': fingerprint(ROOT / 'node_modules/esbuild/lib/main.js'), 'nativeBinary': fingerprint(ROOT / 'node_modules/@esbuild/linux-x64/bin/esbuild')}
require(not os.environ.get('ESBUILD_BINARY_PATH'), 'Static readiness condition failed')
bundled = Path('/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
playwright = {}
for name in ('playwright', 'playwright-core'):
    directory = bundled / name
    package = json.loads((directory / 'package.json').read_text())
    inventory = {path.relative_to(directory).as_posix(): fingerprint(path) for path in sorted(directory.rglob('*')) if path.is_file()}
    playwright[name] = {'version': package['version'], 'directory': str(directory), 'files': inventory}
browser_metadata = json.loads((bundled / 'playwright-core/browsers.json').read_text())
chromium_default = next((item for item in browser_metadata['browsers'] if item['name'] == 'chromium'))
chromium = fingerprint('/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome')
node = fingerprint(shutil.which('node'))
npm = fingerprint(shutil.which('npm'))
supervisor = fingerprint('/usr/bin/systemd-run')
manager_state = subprocess.run(['systemctl', '--user', 'is-system-running'], text=True, capture_output=True)
require(manager_state.returncode == 0 and manager_state.stdout.strip() == 'running', 'Static readiness condition failed')
port = subprocess.check_output(['ss', '-ltn', '( sport = :5298 )'], text=True)
require(not port.splitlines()[1:], 'Static readiness condition failed')
root_record_pin = git('rev-parse', 'HEAD', cwd=ROOT).decode().strip()
root_tree = tree(root_record_pin)
require(all((root_tree[path] == pinned[path] for path in product_inputs)), 'Static readiness condition failed')
root_proof_differences = {path: {'execution': pinned[path], 'rootRecord': root_tree.get(path)} for path in proof if root_tree.get(path) != pinned[path]}
sparse_path = Path(git('rev-parse', '--git-path', 'info/sparse-checkout').decode().strip())
require(sparse_path.read_text() == '/*\n!/docs/evidence/\n', 'Static readiness condition failed')
result = {'kind': 'light-faction-execution-readiness', 'preparedAt': datetime.now(timezone.utc).isoformat(), 'status': 'static-ready; dependency-links-and-all-runtime-held', 'executionPin': PIN, 'integratedTree': '0ba9d13ae4c7de9819cec4150e5085e0daf6752d', 'ownedCheckout': str(OWN), 'immutableRecipePin': RECIPE, 'isolatedSourcePin': SOURCE, 'separateGuardPin': GUARD, 'immutableProductPin': PRODUCT, 'observedRootRecordPin': root_record_pin, 'rootLiveHeadIsNotExecutionCheckout': True, 'sevenFiles': seven, 'sixFilesMatchRecipeAndDriverHasOnlyReviewedQuestionMark': True, 'productInputs': product_inputs, 'productInputCount': 568, 'publicAssetCount': sum((path.startswith('public/') for path in product_inputs)), 'acceptanceInventory': proof, 'retainedApprovedHelpers': retained, 'completeRuntimeSourceAndProofInventoriesMatchPinnedGitTree': True, 'currentRootProductBlobsMatchExecutionPin': True, 'currentRootAcceptanceBlobsMatchExecutionPin': not root_proof_differences, 'currentRootAcceptanceDifferences': root_proof_differences, 'sparseCheckout': {'patternPath': str(sparse_path), 'patterns': sparse_path.read_text(), 'sharedGitConfigurationChanged': False, 'historicalEvidenceRemainsInGitAndRoot': True}, 'installedDependencies': packages, 'compiler': compiler, 'node': node, 'npm': npm, 'playwright': playwright, 'chromium': chromium, 'bundledDefaultChromium': chromium_default, 'browserSelection': {'module': str(bundled / 'playwright/index.mjs'), 'executable': chromium['path'], 'explicitOverrideRequired': True, 'launchAndActualVersionRemainUnobserved': True}, 'supervisor': {**supervisor, 'version': 'systemd 262 (262-1-arch)', 'userManagerState': manager_state.stdout.strip(), 'browserRuntimeMaxSeconds': 3600, 'stopGraceSeconds': 10, 'killMode': 'control-group', 'servicesStarted': False}, 'evidenceParent': str(OUT), 'evidenceParentExistsAndIsEmpty': True, 'ownedPreviewPort': 5298, 'portReadOnlyCheck': port, 'dependencyPlan': {'held': True, 'projectNodeModulesPresent': (OWN / 'node_modules').exists(), 'installedSource': str(ROOT / 'node_modules'), 'method': 'Private owned node_modules directory with per-package links to installed packages; package files must remain unchanged and writable .vite/.vite-temp caches remain owned. No install or package mutation.'}, 'timing': {'originalPlanningEstimateMinutes': [16, 26], 'nativeBrowserEstimateMinutes': [10, 20], 'firstBrowserOuterCapMinutes': 60, 'estimatesAreNotObservedTimings': True}, 'scope': 'Original IDs21-30 native proof, complete save/runtime/replay equality and all original continuations. No new acceptance gate.', 'performed': ['Git object and complete live byte/mode/inventory inspection', 'Installed package/binary file fingerprinting', 'Read-only systemd user manager and port availability inspection', 'Owned sparse checkout pinning; fresh empty evidence parent allocation'], 'notPerformed': ['Dependency population', 'Build', 'Browser', 'Simulation', 'Tests', 'Fixture generation', 'Application-module imports', 'Server or transient service startup', 'Root worktree/index/ledger/trail mutation'], 'attribution': {'harness': 'Codex', 'model': 'GPT-6', 'variantExposed': False}, 'allStaticChecksPassed': True}
require(git('rev-parse', 'HEAD').decode().strip() == PIN and (not git('status', '--porcelain')), 'Static readiness condition failed')
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=PREP / 'readiness.json')
path = parser.parse_args().output
if path != PREP / 'readiness.json':
    baseline = json.loads((PREP / 'readiness.json').read_text())
    for key in ('installedDependencies', 'compiler', 'node', 'npm', 'playwright', 'chromium', 'supervisor'):
        require(result[key] == baseline[key], key + ' installed identities remain prepared')
with path.open('x') as file:
    file.write(json.dumps(result, indent=2) + '\n')
print(json.dumps({'readiness': str(path), 'sha256': digest(path.read_bytes()), 'executionPin': PIN, 'productInputs': len(product_inputs), 'proofModules': len(proof), 'publicAssets': result['publicAssetCount'], 'rootRecordPin': root_record_pin, 'runtimeHeld': True}, indent=2))
