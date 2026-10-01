#!/usr/bin/env python3
import csv, datetime, hashlib, json, pathlib, subprocess

base = pathlib.Path('work/ai-save401-final-453c221-r1')
pin = '453c2218af9973b9eca8fb78392435bd9d46a740'
sha = lambda b: hashlib.sha256(b).hexdigest()
assert subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip() == pin
assert not subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=no'])
phases = {}
for phase, result in [('natural-allied', 'passed'), ('build-web', 'passed'), ('build-server', 'passed'),
                      ('allied-ui', 'passed'), ('roster-ui', 'passed'), ('coop-ui', 'failed')]:
    env = base / 'envelopes' / phase
    manifest = json.loads((env / 'manifest.json').read_text())
    run = json.loads((env / 'run.json').read_text())
    assert manifest['sourcePin'] == run['sourcePin'] == pin
    assert manifest['result'] == run['result'] == result
    assert run['exit']['code'] == (0 if result == 'passed' else 1)
    assert (env / 'source-before.json').read_bytes() == (env / 'source-after.json').read_bytes()
    assert (env / 'source-before.json').read_bytes() == (base / 'envelopes/natural-allied/source-before.json').read_bytes()
    assert (env / 'build-before.json').read_bytes() == (env / 'build-after.json').read_bytes()
    for rel, item in manifest['artifacts'].items():
        data = (env / rel).read_bytes()
        assert len(data) == item['bytes'] and sha(data) == item['sha256']
    exe = base / 'executables' / phase
    assert (exe / 'before.json').read_bytes() == (exe / 'after.json').read_bytes()
    entry = {'result': result, 'exit': run['exit'], 'command': run['command'],
             'manifest': str(env / 'manifest.json'), 'manifestSha256': sha((env / 'manifest.json').read_bytes()),
             'artifacts': {d: len(files) for d, files in json.loads((env / 'artifacts.json').read_text()).items()},
             'executablePackageRecordSha256': sha((exe / 'after.json').read_bytes())}
    if phase.endswith('-ui'):
        browser = base / 'browser-runtime' / phase
        assert (browser / 'before.json').read_bytes() == (browser / 'after.json').read_bytes()
        report = json.loads((base / phase / 'results.json').read_text())
        assert report.get('complete', report.get('completed')) == (result == 'passed')
        entry.update({'checksReached': len(report['checks']), 'checkNames': [c['name'] for c in report['checks']],
                      'browserIdentitySha256': sha((browser / 'after.json').read_bytes()),
                      'launchTrace': str(browser / 'actual-launch-trace.json')})
        if result == 'failed':
            entry['failure'] = report['failure']
    phases[phase] = entry
serve = base / 'executables/serve'
assert (serve / 'before.json').read_bytes() == (serve / 'after.json').read_bytes()
assert not (base / 'online-ui').exists() and not (base / 'envelopes/online-ui').exists()
cleanup = json.loads((base / 'cleanup/after.json').read_text())
assert cleanup['passed'] and not cleanup['protectedPort4173Touched']
before = json.loads((base / 'preparation/history-before.json').read_text())
after = json.loads((base / 'preparation/history-after-cleanup.json').read_text())
assert before['files'] == after['files'] and before['roots'] == after['roots'] and after['trackedClean']
trail = list(csv.DictReader((base / 'decisions.tsv').open(), delimiter='\t'))
for row in trail:
    for ref in row['evidence'].split(';'):
        assert pathlib.Path(ref.strip()).exists(), ref
review = base / 'audits/independent-final-review.md'
attribution = base / 'audits/coop-lobby-attribution.json'
assert review.is_file() and attribution.is_file()
native = []
names = [*sorted((base / 'natural-allied').glob('*-save.json')),
         *(base / 'allied-ui' / name for name in ['local-active-save.json', 'local-completed-save.json', 'local-replay.json', 'local-production-report.json']),
         *(base / 'roster-ui' / name for name in ['2v2-replay.json', '3v3-replay.json', '4v4-replay.json', 'migrated-historical-save.json'])]
for file in names:
    data = file.read_bytes()
    value = json.loads(data)
    session = value.get('session', value)
    game = session.get('game', value if value.get('format') == 'orcs-vs-fairies-save' else {})
    replay = value if value.get('format') == 'orcs-vs-fairies/replay' else session.get('replay', {})
    native.append({'path': str(file), 'bytes': len(data), 'sha256': sha(data), 'format': value.get('format'),
                   'version': value.get('version'), 'gameFormat': game.get('format'), 'gameVersion': game.get('version'),
                   'replayRules': replay.get('simulationRevision'), 'replayFinalTick': replay.get('finalTick')})
status = {'sourcePin': pin, 'productFreezeAccepted': False,
          'reason': 'First failed browser phase preserved; co-op acceptance failed and subsequent online acceptance was not run.',
          'phases': phases, 'serve': 'Stopped after first failure; before/after executable packages equal',
          'online-ui': 'Not run', 'cleanup': str(base / 'cleanup/after.json'),
          'historicalEntriesUnchanged': len(after['files']), 'historicalBytesUnchanged': sum(x.get('bytes', 0) for x in after['files'].values()),
          'trackedCheckoutClean': True, 'nativeArtifacts': native, 'independentReview': str(review),
          'correctedAttribution': str(attribution), 'decisionRows': len(trail),
          'limits': ['Natural match artifacts are raw SAVE4 envelopes without replay history or an explicit rules revision.',
                     'Named executable and complete selected installed package inventories are authenticated; full host/shared-library/transitive provenance is not established.',
                     'The frozen verifiers do not expose browser.version(); the pinned executable CLI identifies Chrome 153.0.8010.12.',
                     'Allied actual launch uses authenticated DEBUG trace; its original auxiliary live observer did not retain raw fields. Roster and co-op retain successful independent live process observations.',
                     'No co-op gameplay, later online phase, acceptance correction/rerun, ID53 probe, public hosting or deployment was performed.']}
with (base / 'final-status.json').open('x') as f:
    f.write(json.dumps(status, indent=2) + '\n')
files = {}
for file in sorted(base.rglob('*')):
    if file.is_file():
        data = file.read_bytes()
        files[str(file.relative_to(base))] = {'bytes': len(data), 'sha256': sha(data)}
seal = {'sourcePin': pin, 'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'Complete final fresh-run file inventory excluding this manifest itself. Preserves failed acceptance and observer/reviewer corrections without relabeling them.',
        'files': files}
manifest = base / 'final-manifest.json'
with manifest.open('x') as f:
    f.write(json.dumps(seal, indent=2) + '\n')
print(json.dumps({'sourcePin': pin, 'productFreezeAccepted': False, 'files': len(files),
                  'fileBytes': sum(x['bytes'] for x in files.values()), 'manifest': str(manifest),
                  'manifestSha256': sha(manifest.read_bytes()), 'statusSha256': sha((base / 'final-status.json').read_bytes()),
                  'decisionRows': len(trail)}))
