"""Losslessly retain the admitted failed combat packet in bounded batches."""
import datetime
import hashlib
import json
import pathlib
import stat

ROOT = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
RUN = pathlib.Path('/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5')
PREFIX = pathlib.Path('docs/evidence/native-combat-f18a50d-first-failure-20261001')
PLAN = RUN / 'postflight/retention-packet/full-native-retention-plan.json'
PLAN_SHA = 'b99cddba8cc57724f1508af4559219c9b2b560225f6e4e55748c5907f11cc7e3'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def read(path, size, sha):
    assert stat.S_ISREG(path.lstat().st_mode), str(path)
    data = path.read_bytes()
    assert len(data) == size and digest(data) == sha, str(path)
    return data

def path(relative):
    p = pathlib.PurePosixPath(relative)
    assert not p.is_absolute() and '..' not in p.parts and str(p) == relative
    return p

raw_plan = read(PLAN, 97054, PLAN_SHA)
plan = json.loads(raw_plan)
assert plan['sourceRunPath'] == str(RUN) and plan['suggestedRepositoryPrefix'] == str(PREFIX)
raw_rows = [row for batch in plan['batches'] for row in batch['files']]
assert len(raw_rows) == 303 and sum(row['bytes'] for row in raw_rows) == 94034440
assert all(batch['bytes'] <= 8388608 and sum(row['bytes'] for row in batch['files']) == batch['bytes'] for batch in plan['batches'])
rows = [{**row, 'source': str(RUN / path(row['sourceRelativePath'])), 'destination': str(PREFIX / path(row['targetRelativePath'])), 'kind': 'raw' if row in raw_rows else 'sealed-or-derived'} for row in raw_rows + plan['additionalRetainedFiles']]
assert len(rows) == 323 and sum(row['bytes'] for row in rows) == 99607554
handoff_path = RUN / 'postflight/retention-packet/reviewed-derived-handoff.json'
handoff_bytes = read(handoff_path, 5480, '04814f87cd977061d7d50b95b172ce97c7ba4e04e6523d3013eb849b707dc926')
handoff = json.loads(handoff_bytes)
for row in handoff['files']:
    rows.append({'source': row['sourcePath'], 'destination': str(PREFIX / path(row['suggestedRelativePath'])), 'bytes': row['bytes'], 'sha256': row['sha256'], 'kind': 'external-static-original'})
for source, relative in [(PLAN, 'import-plan/full-native-retention-plan.json'), (handoff_path, 'import-plan/reviewed-derived-handoff.json')]:
    data = source.read_bytes()
    rows.append({'source': str(source), 'destination': str(PREFIX / relative), 'bytes': len(data), 'sha256': digest(data), 'kind': 'original-plan'})
for directory, relative in [('/tmp/ovf-native-combat-retention-admission-gpt56.4tvqZy', 'import-review'), ('/tmp/ovf-original-combat-admission-review-20261001-b0mYjlat', 'clause-peer-review')]:
    base = pathlib.Path(directory)
    for source in sorted(base.iterdir()):
        if source.is_file():
            data = source.read_bytes()
            rows.append({'source': str(source), 'destination': str(PREFIX / relative / source.name), 'bytes': len(data), 'sha256': digest(data), 'kind': 'original-independent-review'})
assert len({row['destination'] for row in rows}) == len(rows)
for row in rows:
    destination = ROOT / path(row['destination'])
    assert destination.resolve().is_relative_to(ROOT / PREFIX) and not destination.exists()

copied = []
for row in rows:
    data = read(pathlib.Path(row['source']), row['bytes'], row['sha256'])
    destination = ROOT / row['destination']
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('xb') as f:
        f.write(data)
    assert read(destination, row['bytes'], row['sha256']) == data
    copied.append({**row, 'sourceFullByteVerified': True, 'destinationFullByteVerified': True})

# Reconcile the preserved original seal and all registered downloads after copy.
seal = json.loads((ROOT / PREFIX / 'seal/first-failure-artifact-manifest.json').read_bytes())
seal_rows = seal['files']
assert isinstance(seal_rows, dict), list(seal)
raw_map = {row['sourceRelativePath']: (row['bytes'], row['sha256']) for row in raw_rows}
seal_map = {name: (row['bytes'], row['sha256']) for name, row in seal_rows.items()}
assert raw_map == seal_map
browser = json.loads((ROOT / PREFIX / 'raw/browser/browser-native-acceptance.json').read_bytes())
assert len(browser['downloads']) == 148 and len(browser['checks']) == 84 and not browser['completed']
for name, row in browser['downloads'].items():
    assert raw_map['browser/' + name] == (row['bytes'], row['sha256'])
screenshots = [name for name in raw_map if name.startswith('browser/') and name.endswith('.png')]
assert len(screenshots) == 39
receipt = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'producer': {'harness': 'Codex', 'model': 'GPT-6', 'agent': '/root'}, 'planSha256': PLAN_SHA, 'rawOriginalFiles': 303, 'rawOriginalBytes': 94034440, 'planAdditionalFiles': 20, 'planAdditionalBytes': 5573114, 'allCopiedOriginalFiles': len(copied), 'allCopiedOriginalBytes': sum(row['bytes'] for row in copied), 'copies': copied, 'originalRawSealReconciled': True, 'status': 'all_copied_original_bytes_verified', 'outcome': 'Stage06failed after84checks;zero completedgroups;39encountersopen;07/08unrun', 'runtime': 'No build, test, browser, simulation, checker, replay playback, codec or database operation performed.', 'observer': 'V1 rejection and corrected V2 preserved separately; V2 remains unexecuted.', 'featureAdmissions': 'Separate root clause admission; retention alone changes no status.'}
with (ROOT / PREFIX / 'root-retention.json').open('x') as f:
    json.dump(receipt, f, indent=2)
    f.write('\n')
print(json.dumps({key: receipt[key] for key in ['rawOriginalFiles', 'rawOriginalBytes', 'allCopiedOriginalFiles', 'allCopiedOriginalBytes', 'status']}))
