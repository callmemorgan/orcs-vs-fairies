#!/usr/bin/env python3
"""Static exact-commit review for the requirement 53 admission."""

import csv
import hashlib
import io
import json
import os
import pathlib
import stat
import subprocess
import sys
from collections import Counter

REPO = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
COMMIT = 'd61b708fc570063a09147b51c7bf2cea6fac4270'
PARENT = '37bf0e794e7f62cf33347d2e92c739d593bf1cc4'
PRODUCT_PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
BASE = 'docs/evidence/ai-original-coverage-20261001/id53-opening-probe-453c221'
REQ_PATH = 'docs/features/requirements.json'
DECISIONS_PATH = 'docs/features/decisions.tsv'

checks = []

def add(name, passed, **details):
    checks.append({'name': name, 'passed': bool(passed), 'details': details})

def git(*args, binary=False, check=True):
    result = subprocess.run(['git', '-C', str(REPO), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=check)
    return result if not check else (result.stdout if binary else result.stdout.decode().strip())

def blob(ref, path):
    return git('show', f'{ref}:{path}', binary=True)

def load_blob(ref, path):
    return json.loads(blob(ref, path))

def sha(data):
    return hashlib.sha256(data).hexdigest()

def identity(data):
    return {'bytes': len(data), 'sha256': sha(data)}

def disk_identity(path):
    data = pathlib.Path(path).read_bytes()
    return identity(data)

def tree_entry(ref, path):
    line = git('ls-tree', ref, '--', path)
    if not line:
        return None
    metadata, actual_path = line.split('\t', 1)
    mode, kind, object_id = metadata.split()
    return {'mode': mode, 'kind': kind, 'object': object_id, 'path': actual_path}

def expected_git_mode(mode):
    return '100755' if mode == '0o755' else '100644'

resolved = git('rev-parse', 'd61b708^{commit}')
parent = git('rev-parse', f'{COMMIT}^')
add('commit identity', resolved == COMMIT and parent == PARENT, resolved=resolved, parent=parent)

retention_path = f'{BASE}/retention.json'
retention = load_blob(COMMIT, retention_path)
raw_entries = retention['files']

# Authenticate every raw manifest target against immutable commit blobs and retained source bytes.
raw_failures = []
raw_paths = []
raw_total = 0
source_present = 0
for entry in raw_entries:
    target = entry['retained']
    raw_paths.append(target)
    try:
        target_bytes = blob(COMMIT, target)
    except subprocess.CalledProcessError:
        raw_failures.append({'target': target, 'reason': 'missing-commit-blob'})
        continue
    raw_total += len(target_bytes)
    expected = {'bytes': entry['bytes'], 'sha256': entry['sha256']}
    if identity(target_bytes) != expected:
        raw_failures.append({'target': target, 'reason': 'commit-identity', 'expected': expected, 'actual': identity(target_bytes)})
    tree = tree_entry(COMMIT, target)
    if not tree or tree['kind'] != 'blob' or tree['mode'] != expected_git_mode(entry['mode']):
        raw_failures.append({'target': target, 'reason': 'commit-mode', 'expected': expected_git_mode(entry['mode']), 'actual': tree})
    source = pathlib.Path(entry['source'])
    if not source.is_file() or source.is_symlink():
        raw_failures.append({'source': str(source), 'reason': 'missing-source-or-symlink'})
    else:
        source_present += 1
        actual_mode = oct(stat.S_IMODE(source.stat().st_mode))
        if disk_identity(source) != expected or actual_mode != entry['mode'] or source.read_bytes() != target_bytes:
            raw_failures.append({'source': str(source), 'target': target, 'reason': 'source-target-identity-or-mode', 'sourceIdentity': disk_identity(source), 'sourceMode': actual_mode})
add('54 raw retention blobs, sources, and modes',
    len(raw_entries) == retention['rawFileCount'] == 54 and len(set(raw_paths)) == 54
    and raw_total == retention['rawBytes'] == 14269125 and source_present == 54 and not raw_failures,
    entries=len(raw_entries), uniqueTargets=len(set(raw_paths)), bytes=raw_total, sourceFilesPresent=source_present,
    modeCounts=dict(Counter(entry['mode'] for entry in raw_entries)), failures=raw_failures)

# The exact commit has 54 raw files and six authored admission records in this evidence directory.
commit_evidence_paths = set(git('ls-tree', '-r', '--name-only', COMMIT, '--', BASE).splitlines())
authored_paths = {
    f'{BASE}/README.md', f'{BASE}/retention.json', f'{BASE}/root-copy-readback.json',
    f'{BASE}/raw-whitespace-check.stdout.txt', f'{BASE}/raw-whitespace-check.stderr.txt',
    f'{BASE}/raw-whitespace-observation.json',
}
add('evidence directory closure', commit_evidence_paths == set(raw_paths) | authored_paths and len(commit_evidence_paths) == 60,
    committedFiles=len(commit_evidence_paths), rawFiles=len(raw_paths), authoredFiles=len(authored_paths),
    missing=sorted((set(raw_paths) | authored_paths) - commit_evidence_paths), extra=sorted(commit_evidence_paths - (set(raw_paths) | authored_paths)))

# Authenticate the 46 planned imports independently of the root readback receipt.
import_map_path = f'{BASE}/import-plan/import-map.json'
import_map = load_blob(COMMIT, import_map_path)
imports = import_map['entries']
retention_by_source = {entry['source']: entry for entry in raw_entries}
import_failures = []
for entry in imports:
    source = entry['sourcePath']
    target = entry['proposedDocsRelativeTarget']
    retained = retention_by_source.get(source)
    expected = {'bytes': entry['bytes'], 'sha256': entry['sha256']}
    if not retained or retained['retained'] != target or {'bytes': retained['bytes'], 'sha256': retained['sha256']} != expected or retained['mode'] != entry['mode']:
        import_failures.append({'source': source, 'target': target, 'reason': 'import-retention-map'})
        continue
    source_path = pathlib.Path(source)
    target_bytes = blob(COMMIT, target)
    tree = tree_entry(COMMIT, target)
    if not source_path.is_file() or source_path.is_symlink() or disk_identity(source_path) != expected or source_path.read_bytes() != target_bytes:
        import_failures.append({'source': source, 'target': target, 'reason': 'source-target-bytes'})
    if oct(stat.S_IMODE(source_path.stat().st_mode)) != entry['mode'] or tree['mode'] != expected_git_mode(entry['mode']):
        import_failures.append({'source': source, 'target': target, 'reason': 'source-target-mode'})
import_total = sum(entry['bytes'] for entry in imports)
add('46 source-to-target imports and modes',
    len(imports) == import_map['importFileCount'] == 46 and import_total == import_map['importBytes'] == 13945798
    and len({entry['sourcePath'] for entry in imports}) == len({entry['proposedDocsRelativeTarget'] for entry in imports}) == 46
    and not import_failures,
    entries=len(imports), bytes=import_total, modeCounts=dict(Counter(entry['mode'] for entry in imports)), failures=import_failures)

# The planned 46 are the original inventory, its self-excluded inventory file, and the historical outline.
artifact_inventory = load_blob(COMMIT, f'{BASE}/artifact-inventory.json')
artifact_sources = {entry['path'] for entry in artifact_inventory['files']}
outline_source = load_blob(COMMIT, f'{BASE}/run/executed-recipe.json')['originalOutline']
expected_import_sources = artifact_sources | {artifact_inventory['inventoryExcludes'][0], outline_source}
add('import-map coverage of original corpus and outline',
    artifact_inventory['fileCount'] == 44 and len(artifact_sources) == 44
    and {entry['sourcePath'] for entry in imports} == expected_import_sources
    and import_map['all44InventoryFilesIncludedAndRehashed'] is True
    and len(import_map['additionalPostInventorySourceBuildRunFiles']) == 1
    and import_map['allCriticalNativeBuildReferencesIncluded'] is True and import_map['criticalNativeBuildReferenceCount'] == 11,
    originalInventoryFiles=len(artifact_sources), expectedImportSources=len(expected_import_sources),
    missing=sorted(expected_import_sources - {entry['sourcePath'] for entry in imports}),
    extra=sorted({entry['sourcePath'] for entry in imports} - expected_import_sources))

# Authenticate the saved 92-item source/target readback receipt against current sources and exact commit blobs.
readback = load_blob(COMMIT, f'{BASE}/root-copy-readback.json')
readback_failures = []
for check in readback['checks']:
    if check.get('passed') is not True:
        readback_failures.append({'path': check.get('path'), 'reason': 'recorded-failure'})
        continue
    expected = {'bytes': check['bytes'], 'sha256': check['sha256']}
    if check['role'] == 'source':
        p = pathlib.Path(check['path'])
        actual = disk_identity(p) if p.is_file() else None
    else:
        absolute = pathlib.Path(check['path'])
        try:
            relative = absolute.relative_to(REPO).as_posix()
            actual = identity(blob(COMMIT, relative))
        except (ValueError, subprocess.CalledProcessError):
            actual = None
    if actual != expected:
        readback_failures.append({'path': check['path'], 'role': check['role'], 'expected': expected, 'actual': actual})
add('recorded source and root-copy readback',
    readback['status'] == 'passed' and readback['errors'] == [] and len(readback['checks']) == 92
    and Counter(check['role'] for check in readback['checks']) == Counter({'source':46, 'retained':46}) and not readback_failures,
    checks=len(readback['checks']), roles=dict(Counter(check['role'] for check in readback['checks'])), failures=readback_failures)

# Build manifest: two bundles and two metafiles, all input hashes, and frozen product identity.
build_manifest = load_blob(COMMIT, f'{BASE}/build/build-manifest.json')
source_to_target = {entry['sourcePath']: entry['proposedDocsRelativeTarget'] for entry in imports}
build_failures = []
for kind in ('driver', 'validator'):
    bundle = build_manifest['bundles'][kind]
    for label, record in ((f'{kind}-bundle', bundle), (f'{kind}-metafile', bundle['metafile'])):
        target = source_to_target.get(record['path'])
        if not target or identity(blob(COMMIT, target)) != {'bytes':record['bytes'], 'sha256':record['sha256']}:
            build_failures.append({'item': label, 'reason': 'retained-build-reference'})
    for input_entry in bundle['inputs']:
        p = pathlib.Path(input_entry['path'])
        if not p.is_file() or disk_identity(p) != {'bytes':input_entry['bytes'], 'sha256':input_entry['sha256']}:
            build_failures.append({'item': kind, 'input': input_entry['path'], 'reason': 'input-identity'})
product_failures = []
product_paths = set()
for entry in build_manifest['product']['files']:
    product_paths.add(entry['path'])
    for ref in (PRODUCT_PIN, PARENT, COMMIT):
        try:
            data = blob(ref, entry['path'])
            object_id = git('rev-parse', f"{ref}:{entry['path']}")
        except subprocess.CalledProcessError:
            product_failures.append({'path':entry['path'], 'ref':ref, 'reason':'missing'})
            continue
        if identity(data) != {'bytes':entry['bytes'], 'sha256':entry['sha256']} or object_id != entry['gitBlob'] or entry.get('bytesMatchGit') is not True:
            product_failures.append({'path':entry['path'], 'ref':ref, 'reason':'identity'})
product_digest = sha(''.join(f"{entry['path']}\0{entry['sha256']}\n" for entry in build_manifest['product']['files']).encode())
add('retained native builds and frozen product inputs',
    build_manifest['status'] == 'built-not-executed' and build_manifest['product']['sourcePin'] == PRODUCT_PIN
    and len(product_paths) == 170 and product_digest == build_manifest['product']['digest']
    and len(build_manifest['bundles']['driver']['inputs']) == 51 and len(build_manifest['bundles']['validator']['inputs']) == 50
    and not build_failures and not product_failures,
    bundles=2, metafiles=2, productFiles=len(product_paths), driverInputs=len(build_manifest['bundles']['driver']['inputs']),
    validatorInputs=len(build_manifest['bundles']['validator']['inputs']), buildFailures=build_failures, productFailures=product_failures)

# Four native session files must be the files referenced by the two passed endpoint verifiers.
session_failures = []
session_summary = []
session_sources = set()
for arm in ('infantry-control', 'depot-first-pressure'):
    verification = load_blob(COMMIT, f'{BASE}/run/{arm}/endpoint-verification.json')
    if verification['status'] != 'passed' or verification['continuation'] != 'not-run; no survival gate' or len(verification['verified']) != 2:
        session_failures.append({'arm':arm, 'reason':'verification-envelope'})
    for record in verification['verified']:
        session_sources.add(record['path'])
        target = source_to_target.get(record['path'])
        if not target:
            session_failures.append({'arm':arm, 'source':record['path'], 'reason':'missing-import-map'})
            continue
        data = blob(COMMIT, target)
        if identity(data) != {'bytes':record['bytes'], 'sha256':record['sha256']}:
            session_failures.append({'arm':arm, 'target':target, 'reason':'session-identity'})
            continue
        session = json.loads(data)
        flags = ('completeDecoderSessionEqual','completeResaveEnvelopeEqual','completeReplayEnvelopeEqual','analysisEqual','technologyTimingsEqual')
        ok = (session.get('format') == 'orcs-vs-fairies/session' and session.get('version') == 1
              and session['game']['state']['tick'] == session['replay']['finalTick'] == record['tick'] == record['replayedTicks']
              and all(record.get(flag) is True for flag in flags))
        if not ok:
            session_failures.append({'arm':arm, 'target':target, 'reason':'session-content-or-native-flags'})
        session_summary.append({'arm':arm, 'file':target, 'tick':record['tick'], 'sha256':record['sha256']})
add('four native session files and verifier results', len(session_sources) == 4 and len(session_summary) == 4 and not session_failures,
    sessions=session_summary, failures=session_failures)

# Preserve the original failed whitespace observation instead of normalizing raw CRLF TSV files.
observation = load_blob(COMMIT, f'{BASE}/raw-whitespace-observation.json')
stdout_bytes = blob(COMMIT, f'{BASE}/raw-whitespace-check.stdout.txt')
stderr_bytes = blob(COMMIT, f'{BASE}/raw-whitespace-check.stderr.txt')
tsv_paths = [f'{BASE}/import-plan/import-map.tsv', f'{BASE}/import-plan/excluded-files.tsv']
crlf = {}
for path in tsv_paths:
    data = blob(COMMIT, path)
    crlf[path] = {'bytes':len(data), 'lf':data.count(b'\n'), 'crlf':data.count(b'\r\n'), 'bareCr':data.count(b'\r')-data.count(b'\r\n')}
reported_lines = stdout_bytes.count(b'trailing whitespace.\n')
whitespace = observation['rawWhitespaceCheck']
add('original CRLF whitespace failure preserved',
    whitespace['exitCode'] == 2 and whitespace['reportedLines'] == reported_lines == 229
    and set(whitespace['reportedFiles']) == set(tsv_paths)
    and whitespace['stdoutSha256'] == sha(stdout_bytes) == '4b328bf5843bfc87a25f2ebb4f063b35869504e4ee902ba6d4d40be4984a8f17'
    and whitespace['stderrSha256'] == sha(stderr_bytes) == sha(b'')
    and crlf[tsv_paths[0]]['lf'] == crlf[tsv_paths[0]]['crlf'] == 47
    and crlf[tsv_paths[1]]['lf'] == crlf[tsv_paths[1]]['crlf'] == 182
    and all(item['bareCr'] == 0 for item in crlf.values()),
    exitCode=whitespace['exitCode'], reportedLines=reported_lines, tsvLineEndings=crlf,
    stdoutSha256=sha(stdout_bytes), stderrSha256=sha(stderr_bytes))

# Verify the authored metadata check recorded in the observation against the immutable diff.
authored = observation['authoredMetadataCheck']
diff_check = git('diff', '--check', PARENT, COMMIT, '--', *authored['paths'], check=False)
add('authored metadata whitespace check', authored['exitCode'] == 0 and diff_check.returncode == 0 and diff_check.stdout == b'' and diff_check.stderr == b'',
    recordedExit=authored['exitCode'], independentExit=diff_check.returncode, paths=authored['paths'], stdout=diff_check.stdout.decode(), stderr=diff_check.stderr.decode())

# The independent review artifacts are raw-retained and report a bounded pass.
admission_audit = load_blob(COMMIT, f'{BASE}/independent-admission/audit.json')
admission_review = blob(COMMIT, f'{BASE}/independent-admission/review.md')
admission_checker = blob(COMMIT, f'{BASE}/independent-admission/checker.py')
add('independent admission artifacts retained',
    admission_audit['verdict'] == 'pass' and admission_audit['summary'] == {'checks':29,'passed':29,'failed':0}
    and not [c for c in admission_audit['checks'] if not c['passed']]
    and identity(admission_review) == {'bytes':7681,'sha256':'25da6b1d307d91ea2f7729118b6f06a74f8e2513a0f9f74ca4c25335aebb4aff'}
    and identity(blob(COMMIT, f'{BASE}/independent-admission/audit.json')) == {'bytes':15290,'sha256':'729dfd56c97dfe7aa99ef5da54f4cfd42aab0eeadb22dd9eb2b6183ccf451fc5'}
    and identity(admission_checker) == {'bytes':34301,'sha256':'ee03ffd9da0dcf172f2714c169e6c476bc4c011737ae7de56fd3c001687efff1'},
    auditSummary=admission_audit['summary'])

# Only feature 53 changes, producing 67 verified and 33 in progress.
before_req = load_blob(PARENT, REQ_PATH)
after_req = load_blob(COMMIT, REQ_PATH)
before_by_id = {x['id']:x for x in before_req['features']}
after_by_id = {x['id']:x for x in after_req['features']}
changed_features = [feature_id for feature_id in sorted(before_by_id) if before_by_id[feature_id] != after_by_id.get(feature_id)]
feature53_before = before_by_id[53]
feature53_after = after_by_id[53]
evidence_exists = all(tree_entry(COMMIT, path) is not None for path in feature53_after['evidence'])
status_counts = Counter(x['status'] for x in after_req['features'])
add('only requirement 53 promoted',
    changed_features == [53] and feature53_before['status'] == 'in-progress' and feature53_before['evidence'] == []
    and feature53_after['status'] == 'verified' and len(feature53_after['evidence']) == 10 and evidence_exists
    and status_counts == Counter({'verified':67, 'in-progress':33}),
    changedFeatures=changed_features, before=feature53_before, after=feature53_after, statusCounts=dict(status_counts), evidencePathsExist=evidence_exists)

# Decisions TSV is the old byte prefix plus one well-formed admission row.
before_decisions = blob(PARENT, DECISIONS_PATH)
after_decisions = blob(COMMIT, DECISIONS_PATH)
append = after_decisions[len(before_decisions):] if after_decisions.startswith(before_decisions) else b''
append_rows = list(csv.reader(io.StringIO(append.decode()), delimiter='\t')) if append else []
decision_ok = (len(append_rows) == 1 and len(append_rows[0]) == 6
               and append_rows[0][1] == 'ai-opening-current-original53-admission'
               and append_rows[0][2] == 'Mark original53 verified from recognizable native builds and paid observed-worker exploitation'
               and '67 verified33 in progress' in append_rows[0][5]
               and append.endswith(b'\n'))
add('single decision append', after_decisions.startswith(before_decisions) and decision_ok,
    prefixBytes=len(before_decisions), appendedBytes=len(append), appendedRows=append_rows)

# Scope the exact commit: 60 evidence files and two ledger files, no product or active gate changes.
changed_paths = git('diff-tree', '--no-commit-id', '--name-only', '-r', COMMIT).splitlines()
outside_evidence = sorted(path for path in changed_paths if not path.startswith(BASE + '/'))
product_scopes = ('src/','tests/','scripts/','package.json','package-lock.json','vite.config.ts','tsconfig.json','vitest.config.ts','index.html','editor.html')
product_changes = [path for path in changed_paths if path.startswith(('src/','tests/','scripts/')) or path in product_scopes]
add('commit scope leaves product and acceptance gates untouched',
    len(changed_paths) == 62 and outside_evidence == [DECISIONS_PATH, REQ_PATH] and not product_changes
    and retention['runtimeExecutedByRoot'] is False and observation['runtimeExecuted'] is False,
    changedFiles=len(changed_paths), evidenceFiles=len(changed_paths)-len(outside_evidence), outsideEvidence=outside_evidence,
    productOrGateChanges=product_changes, runtimeExecutedByRoot=retention['runtimeExecutedByRoot'])

# All new file modes are ordinary blobs except the preserved executable run.sh.
mode_failures = []
for path in changed_paths:
    entry = tree_entry(COMMIT, path)
    expected = '100755' if path == f'{BASE}/source/run.sh' else '100644'
    if not entry or entry['kind'] != 'blob' or entry['mode'] != expected:
        mode_failures.append({'path':path,'expected':expected,'actual':entry})
add('commit file modes', not mode_failures, executablePaths=[f'{BASE}/source/run.sh'], failures=mode_failures)

# Behavioral interrogation for this archival-only commit.
add('behavioral risk checklist', True,
    ordering='none; no product/runtime code changed',
    failurePaths='none; no active promises, branches, or early returns changed',
    observability='one decisions.tsv row added; no runtime logging changed',
    staleWrites='none; commit adds immutable evidence and updates the ledger',
    testDelta='no new acceptance gate; prior native and independent results are retained byte-for-byte')

failed = [item for item in checks if not item['passed']]
result = {
    'schemaVersion': 1,
    'review': 'original53-exact-commit-retention-and-promotion',
    'verdict': 'pass' if not failed else 'fail',
    'commit': COMMIT,
    'parent': PARENT,
    'model': 'GPT-6 Sol',
    'method': 'Static Git-object, filesystem-source, JSON, TSV, and byte inspection. No project runtime or acceptance gate executed.',
    'summary': {'checks':len(checks), 'passed':len(checks)-len(failed), 'failed':len(failed)},
    'checks': checks,
}
json.dump(result, sys.stdout, indent=2)
sys.stdout.write('\n')
sys.exit(0 if not failed else 1)
