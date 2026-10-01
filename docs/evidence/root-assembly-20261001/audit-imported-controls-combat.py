"""Authenticate admitted evidence and the production bridge without replaying it."""
import csv
import hashlib
import json
import subprocess
from pathlib import Path


def git(*args):
    return subprocess.check_output(['git', *args])


def digest(data):
    return hashlib.sha256(data).hexdigest()


root = Path(__file__).resolve().parents[3]
assert Path.cwd().resolve() == root
pin = git('rev-parse', 'HEAD').decode().strip()
expected_pin = 'db36593f816a57e29220d760de14455cec969f0b'
assert pin == expected_pin
controls = root / 'docs/evidence/controls-final-af44da4-20261001'
combat = root / 'docs/evidence/frozen-native-combat-af44da4-20261001'
counts = {}
with (controls / 'archive-hashes.tsv').open() as handle:
    rows = list(csv.DictReader(handle, delimiter='\t'))
for row in rows:
    path = controls / row['path']
    assert path.resolve().is_relative_to(controls)
    data = path.read_bytes()
    assert len(data) == int(row['bytes']), row['path']
    assert digest(data) == row['sha256'], row['path']
counts['controlsArchiveHashes'] = len(rows)
rows = (combat / 'artifact-hashes.sha256').read_text().splitlines()
for row in rows:
    checksum, name = row.split('  ', 1)
    path = combat / name
    assert path.resolve().is_relative_to(combat)
    assert digest(path.read_bytes()) == checksum, name
counts['combatArchiveHashes'] = len(rows)

bridge = json.loads((root / 'docs/evidence/root-assembly-20261001/final-proof-dispatch-production-bridge.json').read_text())
for name, record in bridge['productionInputFiles'].items():
    committed = git('show', f'{pin}:{name}')
    assert committed == (root / name).read_bytes(), name
    assert len(committed) == record['bytes'], name
    assert digest(committed) == record['sha256'], name
    assert git('rev-parse', f'{pin}:{name}').decode().strip() == record['gitBlob'], name
counts['unchangedProductionInputs'] = len(bridge['productionInputFiles'])

families = {}
for name, count in [('minimap', 12), ('display', 16), ('gamepad', 13), ('saves', 13)]:
    record = json.loads((controls / name / 'browser-proof.json').read_text())
    assert record['result'] == 'passed'
    assert len(record['checks']) == count
    assert record['sourcePin'] == 'af44da406acf7ab44436e978cb1f571b93e28d23'
    assert record['browserClosed'] is True
    for field in ['pageErrors', 'consoleErrors', 'failedRequests', 'httpErrors', 'cleanupErrors']:
        assert not record.get(field, []), (name, field)
    families[name] = {'checks': count, 'result': record['result'], 'sourcePin': record['sourcePin']}

report = {
    'result': 'passed',
    'assembledPin': pin,
    'controlsOriginalCommit': 'd6add1d2fd9c9878b2dbda5b497ff6153c752f88',
    'controlsImportedCommit': git('rev-parse', 'd68fdf9').decode().strip(),
    'combatOriginalCommit': '12c2943f39f176e234f848af7ee4a96fa726e18a',
    'combatImportedCommit': git('rev-parse', '2766a0a').decode().strip(),
    'counts': counts,
    'controlsFamilies': families,
    'limits': 'This rehashes retained evidence and authenticates unchanged production inputs; it does not rerun browsers or simulation. Saves remain in progress due to the separately reproduced commander failure. Combat gaps remain open.'
}
target = Path(__file__).with_name('imported-controls-combat-db36593-audit.json')
with target.open('x') as handle:
    json.dump(report, handle, indent=2)
    handle.write('\n')
print(json.dumps(report, indent=2))
