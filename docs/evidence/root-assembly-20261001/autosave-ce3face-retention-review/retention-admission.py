"""Read the exact committed retention blobs; write new review outputs only."""
import datetime
import hashlib
import json
import pathlib
import subprocess

OUT = pathlib.Path(__file__).resolve().parent
ROOT = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
PROOF = pathlib.Path('/home/morgana/Projects/orcs-vs-fairies-autosave-proof')
EVIDENCE = 'docs/evidence/autosave-c074-first-failure-20261001'
P = 'c074cc5e610fc128d7b6ac894a61258d418463d4'
Q = '9e5fd2340b9a0823d1ab9f566c52b947a094278e'
checks = []

def git(*args, root=ROOT):
    return subprocess.check_output(['git', *args], cwd=root)

def fingerprint(raw):
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

def check(label, condition, detail=None):
    row = {'check': label, 'passed': bool(condition)}
    if detail is not None:
        row['detail'] = detail
    checks.append(row)

preserved = json.loads((OUT / 'review-output-inventory.json').read_bytes())['files']
preserved_before = {name: fingerprint((OUT / name).read_bytes()) for name in preserved}
check('all six existing review artifacts match preserved review inventory', preserved_before == preserved)
C = git('rev-parse', 'ce3face^{commit}').decode().strip()
B = git('rev-parse', 'e905f33^{commit}').decode().strip()
parents = git('rev-list', '--parents', '-n', '1', C).decode().strip().split()[1:]
check('exact retention commit has only the specified parent', parents == [B], parents)

tree_records = git('ls-tree', '-r', '-z', C, '--', EVIDENCE).split(b'\0')
tree = {path.decode(): header.decode().split() for row in tree_records if row
        for header, path in [row.split(b'\t', 1)]}
check('all retention files are regular Git blobs', all(mode == '100644' and kind == 'blob' for mode, kind, sha in tree.values()))
paths = sorted(tree)
batch = subprocess.check_output(
    ['git', 'cat-file', '--batch'], cwd=ROOT,
    input=''.join(C + ':' + path + '\n' for path in paths).encode())
blobs = {}
offset = 0
for path in paths:
    end = batch.index(b'\n', offset)
    header = batch[offset:end].decode().split()
    assert header[1] == 'blob', (path, header)
    size = int(header[2]); start = end + 1
    blobs[path] = batch[start:start + size]
    assert batch[start + size:start + size + 1] == b'\n'
    offset = start + size + 1
assert offset == len(batch)
retention = json.loads(blobs[EVIDENCE + '/retention.json'])
inventory_raw = (OUT / 'raw-file-inventory.json').read_bytes()
inventory = json.loads(inventory_raw)
expected_raw = inventory['files']
expected_paths = {EVIDENCE + '/raw/' + path for path in expected_raw}
expected_paths.update(EVIDENCE + '/proof-source/' + path for path in retention['proofFiles'])
expected_paths.update(EVIDENCE + '/reviews/' + path for path in retention['reviews'])
expected_paths.update([EVIDENCE + '/README.md', EVIDENCE + '/retention.json'])
check('exact retention tree has no extra or missing files', set(paths) == expected_paths,
      {'missing': sorted(expected_paths - set(paths)), 'extra': sorted(set(paths) - expected_paths), 'fileCount': len(paths)})
check('retention raw inventory equals preserved independent inventory', retention['rawFiles'] == expected_raw)
check('retention records exact 50 raw files and 4706727 bytes', retention['copiedRawFiles'] == 50
      and retention['copiedRawBytes'] == sum(item['bytes'] for item in expected_raw.values()) == 4706727)
check('retention preserves exact product and proof pins', retention['productPin'] == P and retention['proofPin'] == Q)
source_root = pathlib.Path(inventory['sourceRoot'])
committed_raw = {}
for path, expected in expected_raw.items():
    raw = blobs[EVIDENCE + '/raw/' + path]
    committed_raw[path] = fingerprint(raw)
    live = (source_root / path).read_bytes()
    check('committed raw matches independent fingerprint: ' + path, committed_raw[path] == expected)
    check('committed raw equals unchanged original bytes: ' + path, raw == live and fingerprint(live) == expected)
browser = json.loads(blobs[EVIDENCE + '/raw/autosave-browser-r1/browser-proof.json'])
check('exactly two executed proof copies are retained', set(retention['proofFiles']) == set(browser['proofSources']) and len(retention['proofFiles']) == 2)
for path, expected in retention['proofFiles'].items():
    raw = blobs[EVIDENCE + '/proof-source/' + path]
    pinned = git('show', Q + ':' + path, root=PROOF)
    check('proof copy equals actual executed source fingerprint: ' + path,
          fingerprint(raw) == expected == browser['proofSources'][path])
    check('proof copy equals exact proof-pin Git bytes and live original: ' + path,
          raw == pinned == (PROOF / path).read_bytes())
check('exactly six named prior review copies are retained', len(retention['reviews']) == 6)
for name, expected in retention['reviews'].items():
    raw = blobs[EVIDENCE + '/reviews/' + name]
    source = pathlib.Path(expected['source'])
    check('prior review fingerprint: ' + name, fingerprint(raw) == {key: expected[key] for key in ['bytes', 'sha256']})
    check('prior review equals original source bytes: ' + name, raw == source.read_bytes())

changes = git('diff', '--name-status', '-z', B, C).split(b'\0')
changes = [(changes[i].decode(), changes[i + 1].decode()) for i in range(0, len(changes) - 1, 2)]
expected_changes = {(status, path) for status, path in [('A', path) for path in expected_paths]}
expected_changes.add(('M', 'docs/features/decisions.tsv'))
check('commit changes only new retention files and decision trail', set(changes) == expected_changes,
      {'changeCount': len(changes), 'unexpected': sorted(set(changes) - expected_changes), 'missing': sorted(expected_changes - set(changes))})
old_trail = git('show', B + ':docs/features/decisions.tsv')
new_trail = git('show', C + ':docs/features/decisions.tsv')
append = new_trail[len(old_trail):] if new_trail.startswith(old_trail) else b''
rows = append.decode().splitlines()
check('decision trail preserves every parent byte and appends three complete rows',
      new_trail.startswith(old_trail) and len(rows) == 3 and append.endswith(b'\n')
      and all(len(row.split('\t')) == 6 for row in rows), rows)
old_requirements = git('show', B + ':docs/features/requirements.json')
new_requirements = git('show', C + ':docs/features/requirements.json')
check('requirements and feature statuses are byte-identical to parent', old_requirements == new_requirements)

def find_feature90(value):
    found = []
    if isinstance(value, dict):
        if value.get('id') in [90, '90']:
            found.append(value)
        for child in value.values():
            found.extend(find_feature90(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(find_feature90(child))
    return found

feature90 = find_feature90(json.loads(new_requirements))
check('feature 90 remains in progress', len(feature90) == 1 and feature90[0]['status'] == 'in-progress', feature90)
check('product code, assets and build/config changes are absent', all(path.startswith(EVIDENCE + '/') or path == 'docs/features/decisions.tsv' for status, path in changes))
body = git('show', '-s', '--format=%B', C).decode()
footer = '\U0001f916 Generated with [Codex](https://openai.com/codex/)\n\nCo-Authored-By: GPT-6 <noreply@openai.com>'
check('actual commit ends with required Codex/GPT-6 footer', body.rstrip().endswith('\n\n' + footer), body)
check('retention keeps browser failure and native passes separate', retention['browserResult'] == browser['result'] == 'failed'
      and retention['completedGameplayChecks'] == len(browser['checks']) == 6
      and retention['offlineValidatorResult'] == 'passed' and retention['offlineValidatorCount'] == 3
      and retention['feature90Status'] == 'in-progress')
preserved_after = {name: fingerprint((OUT / name).read_bytes()) for name in preserved}
check('all existing review/inventory artifacts remain byte-identical', preserved_before == preserved_after)
failed = [row for row in checks if not row['passed']]
review = {'reviewedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'method': 'Exact committed Git-blob, preserved independent inventory, live raw-byte, source-pin and append-only trail comparisons. No product execution or root writes.',
    'result': 'passed' if not failed else 'failed', 'commit': C, 'parent': B,
    'productPin': P, 'proofPin': Q, 'rawFiles': len(expected_raw), 'rawBytes': sum(item['bytes'] for item in expected_raw.values()),
    'retentionTreeFiles': len(paths), 'proofCopies': len(retention['proofFiles']), 'priorReviewCopies': len(retention['reviews']),
    'comparisonCount': len(checks), 'failedComparisonCount': len(failed),
    'preservedIndependentInventory': {'path': str(OUT / 'raw-file-inventory.json'), **fingerprint(inventory_raw)},
    'committedRawInventory': committed_raw, 'addedDecisionRows': rows,
    'actualCommitFooter': footer, 'browserResult': 'failed', 'nativeValidatorResult': 'passed', 'feature90Status': 'in-progress',
    'limits': ['This is artifact retention admission, not another browser or native validation run.',
               'The separate diagnostic attributes one favicon error in its own run; neither original r1 console string is individually attributed.',
               'The 411 prepared files are outside this 60-file retention tree; the earlier independent inventory authenticated their separate retained inventory.'],
    'checks': checks, 'failedChecks': failed}
(OUT / 'retention-review.json').write_text(json.dumps(review, indent=2) + '\n')
(OUT / 'retention-report.md').write_text(
    f'Retention admission {review["result"]} for {C}, whose sole parent is {B}. '
    f'All 50 committed raw files (4,706,727 bytes) match the preserved independent inventory and live originals. '
    'Both executed proof copies match their actual proof-pin bytes; all six prior review copies match the named originals. '
    'The retention tree contains exactly those 58 files plus README and retention.json.\n\n'
    'The commit changes only those 60 new retention files and docs/features/decisions.tsv. '
    'It preserves every parent trail byte and appends three rows. Requirements remain byte-identical, feature 90 remains in progress, '
    'and product code/assets/configs are unchanged. The actual commit ends with the required Codex/GPT-6 footer.\n\n'
    f'{len(checks)} comparisons passed with {len(failed)} failures. Browser finalization remains failed; three native validators separately passed. '
    'No existing inventory or audit artifact was changed, and no root writes or product execution occurred.\n')
print(json.dumps({key: review[key] for key in ['result', 'commit', 'parent', 'rawFiles', 'rawBytes',
    'retentionTreeFiles', 'proofCopies', 'priorReviewCopies', 'comparisonCount', 'failedComparisonCount']}, indent=2))
print(json.dumps({'reviewPath': str(OUT / 'retention-review.json'), 'reportPath': str(OUT / 'retention-report.md'), 'failedChecks': failed}, indent=2))
