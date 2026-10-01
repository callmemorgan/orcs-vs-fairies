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
OUT = OWN.parent / 'faction-native-827-20261001-r2'
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

# Required historical inputs are source-preserved test data, not new acceptance assertions.
historical_expected = {'docs/evidence/rules-3.1-replay-20261001/replay.json': {'mode': '100644', 'type': 'blob', 'gitBlob': '0b11a947a8c2fdcb9536471e57192bae0291fe81', 'bytes': 91710, 'sha256': 'c13bbe05dea85d4e2a3d3f6c7f40ca470490eb4e10f704ed2de3e05a018e62d0'}, 'docs/evidence/controls-final-af44da4-20261001/gamepad/gamepad-native-session.json': {'mode': '100644', 'type': 'blob', 'gitBlob': 'dded6c47a261ba7a2b056aee91b8daa2001d8e49', 'bytes': 142075, 'sha256': '91ae02c1fc5b43c37257a31f8594ca98b291d10a58158b06038615bd7d7241ca'}}
historical_inputs = {}
for path, expected in historical_expected.items():
    require(pinned[path] == {key: expected[key] for key in ('mode', 'type', 'gitBlob')}, path + ' historical Git identity')
    historical_inputs[path] = inspect_file(path, pinned[path])
    require(historical_inputs[path] == expected, path + ' required historical bytes and mode')
historical_live = sorted(path.relative_to(OWN).as_posix() for path in (OWN / 'docs/evidence').rglob('*') if path.is_file() or path.is_symlink())
require(historical_live == sorted(historical_expected), 'Only required historical test inputs are materialized')
selected_test_paths = ['tests/faction-systems.test.ts', 'tests/faction-tools.test.ts', 'tests/faction-save-semantics.test.ts', 'tests/faction-economy-interruption.test.ts', 'tests/captured-illusion-definition.test.ts', 'tests/captured-gravecaller-definition.test.ts', 'tests/captured-gravecaller-grove.test.ts', 'tests/captured-summon-rules.test.ts', 'tests/joint-combat-integration.test.ts', 'tests/joint-trophy-ownership.test.ts', 'tests/joint-world-ignition.test.ts', 'tests/joint-special-surrender-fire.test.ts', 'tests/economy-cargo-integration.test.ts', 'tests/economy-cancellation.test.ts', 'tests/terrain-economy.test.ts', 'tests/world-interruptions.test.ts', 'tests/team-observation.test.ts', 'tests/online-render-state.test.ts', 'tests/saves.test.ts', 'tests/replays.test.ts', 'tests/save4-rule-revision.test.ts']
selected_tests = {path: inspect_file(path, pinned[path]) for path in selected_test_paths}
local_test_dependency_paths = ['scripts/factions/fixture-state.ts', 'scripts/tactics/fixture-state.ts', 'src/cli/session.ts', 'src/content-art/lantern/banner.svg', 'src/content-art/lantern/duelist.svg', 'src/content-art/lantern/sentinel.svg', 'src/core/ai-policy.ts', 'src/core/ally-directives.ts', 'src/core/campaign.ts', 'src/core/combat-targets.ts', 'src/core/commander-rules.ts', 'src/core/commands.ts', 'src/core/conquest-types.ts', 'src/core/conquest.ts', 'src/core/content-registry.ts', 'src/core/content.ts', 'src/core/economy-cargo.ts', 'src/core/economy-common.ts', 'src/core/economy-definitions.ts', 'src/core/economy-types.ts', 'src/core/economy-validation.ts', 'src/core/economy.ts', 'src/core/environment.ts', 'src/core/example-mod.ts', 'src/core/faction-systems-content.ts', 'src/core/faction-systems.ts', 'src/core/geometry.ts', 'src/core/history-hooks.ts', 'src/core/legacy-content-v3.ts', 'src/core/maps.ts', 'src/core/match-rules.ts', 'src/core/navigation.ts', 'src/core/neutral-world.ts', 'src/core/objectives.ts', 'src/core/observation.ts', 'src/core/planning.ts', 'src/core/presentation-observation.ts', 'src/core/progression.ts', 'src/core/replays.ts', 'src/core/saves.ts', 'src/core/scenario-geometry.ts', 'src/core/scenario-recordings.ts', 'src/core/scenario-types.ts', 'src/core/scenario-validation.ts', 'src/core/scenarios.ts', 'src/core/session-storage.ts', 'src/core/simulation.ts', 'src/core/specialist-content.ts', 'src/core/specialist-systems.ts', 'src/core/specialist-types.ts', 'src/core/specialist-validation.ts', 'src/core/tactics.ts', 'src/core/team-ai.ts', 'src/core/types.ts', 'src/core/unit-progression.ts', 'src/core/versions.ts', 'src/core/world-actions.ts', 'src/core/world-map.ts', 'src/core/world-types.ts', 'src/core/world-validation.ts', 'src/game/Controls.ts', 'src/online/competitions.ts', 'src/online/cosmetics.ts', 'src/online/protocol.ts', 'src/online/render-state.ts', 'src/scenarios/campaigns.ts', 'src/scenarios/conquest-world.ts', 'src/server/competitions.ts', 'src/server/cosmetics.ts', 'src/server/store.ts', 'src/server/team-view.ts', 'src/server/views.ts', 'src/ui/FactionTools.ts', 'src/ui/faction-tools.css', 'tests/captured-gravecaller-definition.test.ts', 'tests/captured-gravecaller-grove.test.ts', 'tests/captured-illusion-definition.test.ts', 'tests/captured-summon-rules.test.ts', 'tests/economy-cancellation.test.ts', 'tests/economy-cargo-integration.test.ts', 'tests/faction-economy-interruption.test.ts', 'tests/faction-save-semantics.test.ts', 'tests/faction-systems.test.ts', 'tests/faction-tools.test.ts', 'tests/joint-combat-integration.test.ts', 'tests/joint-special-surrender-fire.test.ts', 'tests/joint-trophy-ownership.test.ts', 'tests/joint-world-ignition.test.ts', 'tests/online-render-state.test.ts', 'tests/replays.test.ts', 'tests/save4-rule-revision.test.ts', 'tests/saves.test.ts', 'tests/team-observation.test.ts', 'tests/terrain-economy.test.ts', 'tests/world-interruptions.test.ts']
local_test_dependencies = {path: inspect_file(path, pinned[path]) for path in local_test_dependency_paths}

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
result['requiredHistoricalTestInputs'] = historical_inputs
result['selectedFocusedTestFiles'] = selected_tests
result['reachableLocalTestDependencies'] = local_test_dependencies
result['historicalInputRepairChangesNoProductTestOrAssertion'] = True
result['retainedFirstAttempt'] = '/home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r1'
require(git('rev-parse', 'HEAD').decode().strip() == PIN and (not git('status', '--porcelain')), 'Static readiness condition failed')
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=PREP / 'readiness-r2.json')
path = parser.parse_args().output
if path != PREP / 'installed-readiness-baseline.json':
    baseline = json.loads((PREP / 'installed-readiness-baseline.json').read_text())
    for key in ('installedDependencies', 'compiler', 'node', 'npm', 'playwright', 'chromium', 'supervisor'):
        require(result[key] == baseline[key], key + ' installed identities remain prepared')
with path.open('x') as file:
    file.write(json.dumps(result, indent=2) + '\n')
print(json.dumps({'readiness': str(path), 'sha256': digest(path.read_bytes()), 'executionPin': PIN, 'productInputs': len(product_inputs), 'proofModules': len(proof), 'publicAssets': result['publicAssetCount'], 'rootRecordPin': root_record_pin, 'runtimeHeld': True}, indent=2))
