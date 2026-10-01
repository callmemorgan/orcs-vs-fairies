import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve()
before = json.loads((root / 'source-before.json').read_text())
after = json.loads((root / 'source-after.json').read_text())
assert before == after
pin = before['sourceCommit']
rules = before['simulationRevision']
artifacts = {}

def remember(path):
    path = pathlib.Path(path).resolve()
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    entry = {'sha256': digest, 'bytes': len(data)}
    if not path.is_relative_to(root):
        retained = root / 'retained-native' / (digest + '-' + path.name)
        retained.parent.mkdir(exist_ok=True)
        if retained.exists():
            assert retained.read_bytes() == data, 'Retained native bytes disagree.'
        else:
            with retained.open('xb') as stream:
                stream.write(data)
        entry['retainedPath'] = str(retained.relative_to(root))
        assert hashlib.sha256(retained.read_bytes()).hexdigest() == digest
    else:
        entry['retainedPath'] = str(path.relative_to(root))
    artifacts[str(path)] = entry
    return json.loads(data)

def journal(path):
    data = remember(path)
    assert data['version'] == 2 and data['checksumVersion'] == 4
    assert data['simulationRevision'] == rules
    assert data['initial']['game']['version'] == 4
    assert data['initial']['simulationRevision'] == rules
    return data

def report(path):
    data = remember(path)
    assert data['sourceCommit'] == pin
    for name, actual in data['sourceFiles'].items():
        assert actual == before['files'][name]['sha256'], name
    return data

all30 = report(root / 'all30.json')
assert all30['missionCount'] == 30 and len(all30['attempts']) == 30
for attempt in all30['attempts']:
    assert attempt['outcome'] == 'won'
    assert all(attempt['assertions'].values()), attempt['id']
    original = journal(attempt['journal']['archivePath'])
    assert artifacts[str(pathlib.Path(attempt['journal']['archivePath']).resolve())]['sha256'] == attempt['journal']['sha256']
    assert original['finalChecksum'] == attempt['journal']['finalChecksum']
route_counts = {}
for route in ['primary', 'alternate']:
    data = report(root / f'{route}.json')
    assert data['route'] == route and len(data['profiles']) == 6
    count = 0
    for profile in data['profiles']:
        assert not profile.get('error') and all(profile['assertions'].values())
        assert len(profile['chapters']) == 4
        persisted = remember(profile['profilePath'])
        assert persisted['simulationRevision'] == rules
        assert len(persisted['history']) == 4 and persisted['active'] is None
        for chapter in profile['chapters']:
            assert chapter['outcome'] == 'won' and all(chapter['assertions'].values())
            recording = journal(chapter['journal']['archivePath'])
            assert recording['finalChecksum'] == chapter['journal']['finalChecksum']
            count += 1
    assert count == 24
    route_counts[route] = count
conquest = report(root / 'conquest.json')
assert conquest['mode'] == 'corrected' and all(conquest['assertions'].values())
assert len(conquest['journals']) == 5
for item in conquest['journals']:
    recording = journal(item['path'])
    assert artifacts[str(pathlib.Path(item['path']).resolve())]['sha256'] == item['sha256']
    assert recording['finalTick'] == item['finalTick']
army = report(root / 'persistent-army/report.json')
assert all(army['assertions'].values())
assert len(army['chapters']) == 3 and len(army['continuations']) == 3
assert army['promotions'] and army['equipment'] and army['reserves'] and army['casualty'] is not None
for path in (root / 'persistent-army').glob('*.json'):
    remember(path)
    if path.name.endswith('recording.json'):
        journal(path)
repeat_reports = []
for path in (root / 'test-temporary').rglob('report.json'):
    data = remember(path)
    if data.get('format') == 'orcs-vs-fairies-persistent-army-proof':
        assert data['sourceCommit'] == pin
        assert data['deterministicSha256'] == army['deterministicSha256']
        repeat_reports.append(str(path.resolve()))
        for retained_raw in path.parent.glob('*.json'):
            remember(retained_raw)
            if retained_raw.name.endswith('recording.json'):
                journal(retained_raw)
assert len(repeat_reports) == 2, 'Retain both deterministic persistent-army regression runs.'
metadata_files = sorted((root / 'bundles').glob('*.meta.json'))
assert len(metadata_files) == 4, 'All four native runner metafiles are required.'
for metadata in metadata_files:
    data = remember(metadata)
    assert 'src/core/commander-rules.ts' in data['inputs'], metadata.name
    assert 'src/core/versions.ts' in data['inputs'], metadata.name
    for name in data['inputs']:
        assert name in before['files'], f'Unpinned bundle input: {name}'
    for name in data['outputs']:
        path = pathlib.Path(name)
        if not path.is_absolute():
            path = pathlib.Path.cwd() / path
        output = path.read_bytes()
        artifacts[str(path.resolve())] = {'sha256': hashlib.sha256(output).hexdigest(), 'bytes': len(output)}
result = {'format': 'orcs-vs-fairies-native-scenario-result-admission', 'version': 1,
          'sourceCommit': pin, 'simulationRevision': rules, 'saveVersion': 4,
          'counts': {'missions': 30, 'routes': route_counts, 'conquestJournals': 5,
                     'persistentArmyChapters': 3, 'persistentArmyAssertions': len(army['assertions']),
                     'persistentArmyRegressionRepeats': len(repeat_reports)},
          'status': 'passed', 'artifacts': artifacts,
          'retention': 'Every referenced external journal/profile is retained byte-for-byte with original-path mapping.',
          'limits': ['Runtime equality is asserted by the pinned native proof engines and regression tests.',
                     'Canonical browser, visual cosmetics, reward HTTP and independent admission remain separate.']}
with (root / 'native-admission.json').open('x') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
print(json.dumps({key: value for key, value in result.items() if key != 'artifacts'}))
