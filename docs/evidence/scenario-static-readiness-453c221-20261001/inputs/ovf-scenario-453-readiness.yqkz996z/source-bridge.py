"""Static Git/byte preparation only. Never imports application modules."""
import hashlib
import json
import pathlib
import re
import subprocess
import sys

repository = pathlib.Path(sys.argv[1]).resolve()
output = pathlib.Path(sys.argv[2]).resolve()
prior = 'c074cc5e610fc128d7b6ac894a61258d418463d4'
product = '453c2218af9973b9eca8fb78392435bd9d46a740'
root_record = '8b96f5197adf5b4ddfa160c2fe5a550afdf7e9d8'
historical_suite = '4a71cd07bacc12d214acaf5a0f95a7d9b486f52c'

def require(condition, message):
    if not condition:
        raise ValueError(message)

def git(*arguments):
    return subprocess.check_output(['git', '-C', str(repository), *arguments])

def tree(pin):
    result = {}
    for record in git('ls-tree', '-r', '-z', pin).split(b'\0'):
        if not record:
            continue
        metadata, raw_path = record.split(b'\t', 1)
        mode, kind, blob = metadata.decode().split()
        require(kind == 'blob', 'Unsupported Git entry')
        result[raw_path.decode()] = {'mode': mode, 'gitBlob': blob}
    return result

def content(pin, path):
    return git('show', f'{pin}:{path}')

def receipt(data):
    return {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}

def write(name, value):
    with (output / name).open('x') as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write('\n')

trees = {pin: tree(pin) for pin in [prior, product, root_record, historical_suite]}
selected = lambda entries: {path: item for path, item in entries.items() if not path.startswith('docs/')}
product_trees = {pin: selected(entries) for pin, entries in trees.items()}
delta = {path: {'before': product_trees[prior].get(path), 'after': product_trees[product].get(path)}
         for path in sorted(product_trees[prior].keys() | product_trees[product].keys())
         if product_trees[prior].get(path) != product_trees[product].get(path)}
require(list(delta) == ['public/favicon.ico'], 'Unexpected product change after c074')
require(delta['public/favicon.ico']['before'] is None, 'Favicon must be the one added product file')
require(product_trees[product] == product_trees[root_record], 'Root record differs from product freeze')

inventory = {}
for path, metadata in product_trees[product].items():
    inventory[path] = {**metadata, **receipt(content(product, path))}
public = {path: item for path, item in inventory.items() if path.startswith('public/')}
require(public['public/favicon.ico']['sha256'] == '5e0bf0f72488bc693d779cd7a3ebc7fdfca8db9916a6e3e0811fff59113253c2', 'Favicon hash mismatch')
require(public['public/favicon.ico']['bytes'] == 32038, 'Favicon byte count mismatch')
save_source = content(product, 'src/core/saves.ts').decode()
rules_source = content(product, 'src/core/versions.ts').decode()
require(re.search(r'export const SAVE_VERSION\s*=\s*4\b', save_source) is not None, 'SAVE4 required')
require(re.search(r"SIMULATION_REVISION\s*=\s*['\"]([^'\"]+)", rules_source).group(1) == '4.0.1', 'Rules4.0.1 required')
fingerprint = hashlib.sha256()
for path in sorted(path for path in inventory if path.startswith('src/') and path.endswith(('.ts', '.css'))):
    fingerprint.update(path[4:].encode())
    fingerprint.update(content(product, path))

requirements = {}
for pin in [product, root_record]:
    raw = content(pin, 'docs/features/requirements.json')
    document = json.loads(raw)
    requirements[pin] = {'file': 'docs/features/requirements.json', **receipt(raw),
                         'rows': [row for row in document['features'] if row['id'] in [*range(71, 81), 99]]}
require(requirements[product]['rows'] == requirements[root_record]['rows'], 'Owned requirement rows changed')

related_tests = [
    'scenario-recording-compatibility', 'scenario-save4-wrapper-migration',
    'scenario-historical-content', 'profile-rules-migration', 'session-scenario-profile',
    'scenario-core-binding', 'scenario-content', 'scenario-tools-readonly',
    'scenario-campaign-host', 'scenario-demo-compatibility', 'authored-commanders',
    'campaign-persistent-army', 'campaign', 'conquest', 'scenario-campaign-reward',
    'scenarios',
]
coverage_paths = sorted(path for path in trees[product]
                        if (path.startswith('src/') and path != 'src/main.ts')
                        or path.startswith('scripts/scenarios/')
                        or path in [f'tests/{name}.test.ts' for name in related_tests])
coverage_differences = [path for path in coverage_paths
                        if trees[product].get(path) != trees[historical_suite].get(path)]
require(not coverage_differences, 'Historical core/scenario/test applicability differs')
log_path = 'docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0/command-1.log'
log_bytes = content(product, log_path)
require(receipt(log_bytes)['sha256'] == '07d9194e5cb32f01c112c7847b0b345ee1dcfa4887fcefc6ecf0cc3d2592ea54', 'Admitted suite log changed')
require('tests/scenarios.test.ts' in log_bytes.decode().splitlines()[209], 'Retained scenarios test line changed')

write('source-bridge.json', {
    'format': 'ovf-scenario-453-static-source-bridge', 'version': 1, 'executionHeld': True,
    'priorSourceReadPin': prior, 'productFreeze': product, 'rootRecordPin': root_record,
    'saveVersion': 4, 'simulationRevision': '4.0.1', 'sourceFingerprint': fingerprint.hexdigest(),
    'selection': 'Every tracked path outside docs/. Documentation/evidence commits retain their original pins.',
    'productDelta': delta, 'rootProductTreeEqual': True,
    'productInventory': inventory, 'publicInventory': public,
    'publicCount': len(public), 'productFileCount': len(inventory),
    'limits': 'Static Git/byte applicability, not runtime proof. Same src fingerprint does not authenticate public assets or permit relabeling an old build.',
})
write('requirements.json', {'executionHeld': True, 'pins': requirements,
                           'scope': 'Original71–80 and99 only. Supplemental examples are not additional acceptance gates.'})
write('historical-coverage.json', {
    'executionHeld': True, 'historicalSuitePin': historical_suite, 'appliesToProductFreeze': product,
    'pathCount': len(coverage_paths), 'paths': coverage_paths, 'differences': coverage_differences,
    'scope': 'All src except the documented main.ts account guard, all scenario proof scripts, and16 related test files.',
    'admittedLog': {'path': log_path, **receipt(log_bytes), 'scenarioSummaryLine': 210,
                    'scenarioTestsPassed': 15, 'suiteTotalTests': 2920, 'suiteTotalFiles': 157},
    'historicalUiPins': {'standaloneDemo': '3ab7820', 'mainSave3': 'e5cf87e'},
    'limits': 'Retained tests prove their original run. This byte bridge supports their applicability; it does not relabel historical UI or prove current canonical actions.',
})
print(json.dumps({'status': 'static-source-bridge-passed; execution-held', 'output': str(output),
                  'productFiles': len(inventory), 'publicFiles': len(public),
                  'historicalApplicablePaths': len(coverage_paths), 'sourceFingerprint': fingerprint.hexdigest()}))
