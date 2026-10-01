"""Read-only integrity audit; this does not replay or simulate the game."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / 'archive-manifest.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()

def original(name):
    entry = MANIFEST['files'][name]
    stored = (ROOT / name).read_bytes()
    assert len(stored) == entry['bytes'] and sha(stored) == entry['sha256'], name
    data = gzip.decompress(stored) if entry['gzip'] else stored
    if 'originalSha256' in entry:
        assert len(data) == entry['originalBytes'] and sha(data) == entry['originalSha256'], name
    return data

for name in MANIFEST['files']:
    original(name)
extras = {'README.md', 'audit.py', 'audit.json', 'archive-manifest.json'}
assert {str(path.relative_to(ROOT)) for path in ROOT.rglob('*') if path.is_file()} <= set(MANIFEST['files']) | extras

results = []
for label, phase, revision in [('corrected-red', 'fighting', '4.0.0'), ('green', 'recovery', '4.0.1')]:
    report = json.loads(original(f'{label}/reproduction.json'))
    session = json.loads(original(f'{label}/final.session.json'))
    source = json.loads(original(f'{label}/input.session.json'))
    assert report['inputSha256'] == sha(original(f'{label}/input.session.json'))
    assert report['inputSha256'] == '1f524adce9f09dcc028bbe5f7d4bee709f8c739977dc4075ddce100a322f4484'
    assert source['game']['state']['tick'] == 6951 and source['replay']['simulationRevision'] == '4.0.0'
    for path, expected in report['pinned'].items():
        raw = subprocess.check_output(['git', 'show', report['sourcePin'] + ':' + path])
        blob = subprocess.check_output(['git', 'rev-parse', report['sourcePin'] + ':' + path], text=True).strip()
        assert sha(raw) == expected['sha256'] and len(raw) == expected['bytes'] and blob == expected['gitBlob'], path
    digest = sha(''.join(f"{path}\0{entry['sha256']}\n" for path, entry in sorted(report['pinned'].items())).encode())
    assert digest == report['sourceDigest']
    bundle = original(f'{label}/public-api.mjs.gz')
    assert sha(bundle) == report['executedBundleSha256']
    assert report['sourcePin'].encode() in bundle and digest.encode() in bundle
    assert sha(original(f'{label}/runner.mjs')) == report['toolSha256']
    assert report['bundleInputs'] and all(report['pinned'][path] == entry for path, entry in report['bundleInputs'].items())
    assert report['saveVersion'] == 4 and report['simulationRevision'] == revision
    assert report['startTick'] == 6951 and report['finalTick'] == 7448 and report['comparedTicks'] == 497
    assert report['publicStepSeconds'] == .05 and report['extraTicks'] == 100
    assert report['endpointSeekFromTick'] == 6951
    assert all(report[key] for key in ['completeEnvelopesMatchEveryTick', 'recorderHistoriesEqual', 'fullReplayEndpointEqual',
                                     'replayAnalysisEqual', 'technologyTimingsEqual', 'endpointSeekEqual'])
    spawn = report['transitions'][0]
    engine = next(actor for actor in spawn['attackers'] if actor['id'] == 93)
    assert spawn['tick'] == 7251 and engine['crew'] == {'hp': 42, 'maxHp': 42, 'uncrewed': False} and not engine['crewless']
    for point, tick in [(report['neutralized'], 7348), (report['afterExtraTicks'], 7448)]:
        assert point['tick'] == tick and point['wave'] == 3 and point['phase'] == phase
        assert len(point['attackers']) == 1
        engine = point['attackers'][0]
        assert engine['id'] == 93 and engine['hp'] == 132.27615561427828
        assert engine['crew'] == {'hp': 0, 'maxHp': 42, 'uncrewed': True} and engine['crewless']
        assert point['defenderHq'] == [{'id': 1, 'hp': 1750}, {'id': 60, 'hp': 1750}]
    assert session['game']['version'] == 4 and session['game']['state']['tick'] == 7448
    assert session['game']['state']['objectives']['survival']['phase'] == phase
    assert session['replay']['simulationRevision'] == revision and session['replay']['finalTick'] == 7448
    assert session['replay']['initial']['state']['tick'] == 6951
    assert next(e for e in session['game']['state']['entities'] if e['id'] == 93)['hp'] == 132.27615561427828
    results.append({'record': label, 'sourcePin': report['sourcePin'], 'rules': revision, 'phase': phase, 'sourceDigest': digest})

binding = json.loads(original('checks/binding.json'))
assert sha(original('checks/regression.test.ts')) == binding['testSha256']
assert original('checks/regression.test.ts') == subprocess.check_output(['git', 'show', binding['testSourcePin'] + ':' + binding['testSourcePath']])
assert binding['redExitCode'] == 1 and binding['redFailures'] == 2 and binding['greenExitCode'] == 0 and binding['greenTestsPassed'] == 37
assert binding['typecheckExitCode'] == 0 and not binding['wholeFiveCaseRerun'] and not binding['browserRun']
assert json.loads(original('original-failed-run/run.json'))['result'] == 'failed'
assert json.loads(original('original-failed-run/runtime/run.json'))['result'] == 'failed'
print(json.dumps({'archiveIntegrityPassed': True, 'simulationExecuted': False, 'filesChecked': len(MANIFEST['files']), 'records': results}, indent=2))
