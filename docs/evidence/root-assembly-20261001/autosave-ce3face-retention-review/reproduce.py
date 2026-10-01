"""Authenticate retained artifacts using file reads and Git tree reads only.

No owner scripts, product modules, validators, builds or browsers are executed.
Outputs go only beside this script in the fresh temporary review directory.
"""
import datetime
import hashlib
import json
import pathlib
import subprocess

OUT = pathlib.Path(__file__).resolve().parent
PRODUCT = pathlib.Path('/home/morgana/.codex/worktrees/assembled-rules401/orcs-vs-Fairies')
PROOF = pathlib.Path('/home/morgana/Projects/orcs-vs-fairies-autosave-proof')
BASE = PRODUCT / 'work/verification/ui-c074cc5-20261001'
P = 'c074cc5e610fc128d7b6ac894a61258d418463d4'
Q = '9e5fd2340b9a0823d1ab9f566c52b947a094278e'
NAMES = ['autosave-browser-r1', 'autosave-runtime-r1', 'autosave-offline-r1',
         'autosave-diagnostic-r1', 'autosave-inspection-r1', 'autosave-independent-r1']
checks = []

def read(path):
    return json.loads(path.read_bytes())

def fp(path):
    assert path.is_file() and not path.is_symlink(), str(path)
    raw = path.read_bytes()
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

def inventory(root):
    paths = sorted(root.rglob('*'))
    assert not any(p.is_symlink() for p in paths), str(root)
    return {str(p.relative_to(root)): fp(p) for p in paths if p.is_file()}

def check(label, condition, detail=None):
    item = {'check': label, 'passed': bool(condition)}
    if detail is not None:
        item['detail'] = detail
    checks.append(item)

def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2) + '\n')

before = {name: inventory(BASE / name) for name in NAMES}
flat = {name + '/' + path: value for name, files in before.items() for path, value in files.items()}
write('raw-file-inventory.json', {'sourceRoot': str(BASE), 'directories': NAMES,
    'fileCount': len(flat), 'files': flat})
(OUT / 'raw-file-inventory.tsv').write_text('path\tbytes\tsha256\n' + ''.join(
    f'{path}\t{value["bytes"]}\t{value["sha256"]}\n' for path, value in flat.items()))

coverage = []
def compare_manifest(label, directory, expected, excluded=()):
    actual = before[directory]
    expected_paths, actual_paths = set(expected), set(actual)
    missing = sorted(expected_paths - actual_paths)
    excluded_present = sorted(set(excluded) & actual_paths)
    unlisted = sorted(actual_paths - expected_paths - set(excluded))
    mismatches = [path for path in sorted(expected_paths & actual_paths)
                  if {k: expected[path][k] for k in ['bytes', 'sha256']} != actual[path]]
    row = {'manifest': label, 'directory': directory, 'listedFiles': len(expected),
        'actualFiles': len(actual), 'explicitSelfExclusion': excluded_present,
        'missingFiles': missing, 'unlistedFiles': unlisted, 'fingerprintMismatches': mismatches}
    coverage.append(row)
    check('manifest ' + label + ' -> ' + directory, not missing and not unlisted and not mismatches, row)

runtime_full = read(BASE / 'autosave-runtime-r1/full-manifest.json')
compare_manifest('autosave-runtime-r1/full-manifest.json:browser', NAMES[0], runtime_full['browser'])
compare_manifest('autosave-runtime-r1/full-manifest.json:runtime', NAMES[1], runtime_full['runtime'], ['full-manifest.json'])
compare_manifest('autosave-runtime-r1/browser-output-manifest.json', NAMES[0],
                 read(BASE / 'autosave-runtime-r1/browser-output-manifest.json'))
browser_manifest = read(BASE / 'autosave-browser-r1/manifest.json')
compare_manifest('autosave-browser-r1/manifest.json:artifacts', NAMES[0], browser_manifest['artifacts'], ['manifest.json'])
for name in [NAMES[2], NAMES[3]]:
    compare_manifest(name + '/full-manifest.json', name, read(BASE / name / 'full-manifest.json'), ['full-manifest.json'])
inspection_full = read(BASE / 'autosave-inspection-r1/full-manifest.json')
for name, files in inspection_full['directories'].items():
    compare_manifest('autosave-inspection-r1/full-manifest.json:' + name, name, files,
                     ['full-manifest.json'] if name == NAMES[4] else [])
independent_full = read(BASE / 'autosave-independent-r1/full-manifest.json')
compare_manifest('autosave-independent-r1/full-manifest.json:files', NAMES[5], independent_full['files'], ['full-manifest.json'])
original_snapshot = {'browser': before[NAMES[0]], 'runtime': before[NAMES[1]]}
for name in ['original-manifests-before.json', 'original-manifests-after.json']:
    check('offline original snapshot matches current complete browser/runtime raw files: ' + name,
          read(BASE / NAMES[2] / name) == original_snapshot)
diagnostic_snapshot = {name: before[name] for name in [NAMES[0], NAMES[1], NAMES[2], NAMES[4]]}
for name in ['first-failure-before.json', 'first-failure-after.json']:
    check('diagnostic original snapshot matches current raw files: ' + name,
          read(BASE / NAMES[3] / name) == diagnostic_snapshot)
baseline = read(BASE / NAMES[5] / 'first-failure-baseline.json')
check('independent baseline seals original browser/runtime and runtime full manifest',
      baseline['browser'] == before[NAMES[0]]
      and baseline['runtime'] == {path: value for path, value in before[NAMES[1]].items() if path != 'full-manifest.json'}
      and baseline['fullManifest'] == before[NAMES[1]]['full-manifest.json'])

inputs_before = read(BASE / 'autosave-runtime-r1/inputs-before.json')
inputs_after = read(BASE / 'autosave-runtime-r1/inputs-after.json')
check('original input manifests are byte-identical', fp(BASE / 'autosave-runtime-r1/inputs-before.json') == fp(BASE / 'autosave-runtime-r1/inputs-after.json'))
check('original input manifests are structurally identical', inputs_before == inputs_after)
provenance = read(BASE / 'autosave-browser-r1/provenance.json')
source_groups = ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles']
combined = {path: {k: value[k] for k in ['bytes', 'sha256']} for group in source_groups
            for path, value in provenance[group].items()}
check('browser source categories cover all 585 recorded product inputs', combined == inputs_before['inputs'])

def git_tree(root, pin):
    raw = subprocess.check_output(['git', 'ls-tree', '-r', '-z', pin], cwd=root)
    return {path.decode(): header.decode().split()[2] for record in raw.split(b'\0') if record
            for header, path in [record.split(b'\t', 1)]}

product_tree, proof_tree = git_tree(PRODUCT, P), git_tree(PROOF, Q)
source_coverage = []
for label, root, pin, expected, tree in [
    ('product', PRODUCT, P, inputs_before['inputs'], product_tree),
    ('proof', PROOF, Q, inputs_before['proofFiles'], proof_tree)]:
    current_head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    check(label + ' checkout current HEAD equals recorded pin', current_head == pin, current_head)
    for path, expected_fp in expected.items():
        raw = (root / path).read_bytes()
        check(label + ' raw fingerprint: ' + path, fp(root / path) == expected_fp)
        blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        check(label + ' pinned Git bytes: ' + path, blob == tree.get(path))

for group, prefix, tree in [('sourceFiles', 'src/', product_tree),
                            ('assetFiles', 'public/', product_tree),
                            ('scriptFiles', 'scripts/controls-proof/', product_tree)]:
    actual_scope = {path for path in tree if path.startswith(prefix)}
    declared = set(provenance[group])
    source_coverage.append({'category': group, 'trackedScope': prefix,
        'missingFromManifest': sorted(actual_scope - declared),
        'outsideScope': sorted(declared - actual_scope)})
source_coverage.append({'category': 'proofFiles', 'trackedScope': 'scripts/session-recovery/',
    'missingFromManifest': sorted({path for path in proof_tree if path.startswith('scripts/session-recovery/')} - set(inputs_before['proofFiles']))})
for row in source_coverage:
    check('declared source scope complete: ' + row['category'], not row['missingFromManifest'], row)
prepared_actual = inventory(BASE / 'prepared')
check('all 411 prepared files match recorded raw inventory', prepared_actual == inputs_before['preparedFiles'])
compiled = {path.removeprefix('dist/'): value for path, value in prepared_actual.items() if path.startswith('dist/')}
check('compiled file manifest matches complete prepared/dist inventory', compiled == browser_manifest['compiledFiles'])

browser = read(BASE / 'autosave-browser-r1/browser-proof.json')
runtime = read(BASE / 'autosave-runtime-r1/run.json')
offline = read(BASE / 'autosave-offline-r1/run.json')
diagnostic = read(BASE / 'autosave-diagnostic-r1/browser-diagnostic.json')
check('browser and runtime retain failed result', browser['result'] == runtime['result'] == 'failed')
check('runtime browser step retains exit code 1', runtime['steps'][0]['exitCode'] == 1)
check('six original gameplay checks retained', len(browser['checks']) == 6)
check('two original console errors remain unattributed', len(browser['consoleErrors']) == 2 and 'consoleErrors must be empty' in browser['finalizationFailure']['message'])
diagnostic_errors = [entry for page in diagnostic['pages'] for entry in page['console'] if entry['type'] == 'error']
check('diagnostic separately attributes one error to favicon.ico', len(diagnostic_errors) == 1
      and diagnostic_errors[0]['location']['url'] == 'http://127.0.0.1:5299/favicon.ico')
for path, expected_fp in browser['downloads'].items():
    check('original browser download raw hash: ' + path,
          fp(BASE / NAMES[0] / path) == {k: expected_fp[k] for k in ['bytes', 'sha256']})
for path, expected_fp in browser['proofSources'].items():
    check('executed browser proof source fingerprint: ' + path, fp(PROOF / path) == expected_fp)

native = {name: read(BASE / NAMES[0] / ('native-' + name + '.json'))
          for name in ['manual', 'before-reload', 'recovered', 'continued', 'imported']}
check('before-reload, recovered and imported complete JSON are identical',
      native['before-reload'] == native['recovered'] == native['imported'])
check('queued recruitment is retained at tick 616', native['recovered']['game']['state']['tick'] == 616
      and next(e for e in native['recovered']['game']['state']['entities'] if e['id'] == 1)['queue'] == ['worker'])
check('continued raw save completes queue at tick 861', native['continued']['game']['state']['tick'] == 861
      and next(e for e in native['continued']['game']['state']['entities'] if e['id'] == 1)['queue'] == []
      and any(e['id'] == 58 and e['role'] == 'worker' for e in native['continued']['game']['state']['entities']))
check('paid bank preserved across recovered continuation',
      native['recovered']['game']['state']['players'][0]['wood'] == native['continued']['game']['state']['players'][0]['wood'] == 370)
timed = read(BASE / NAMES[0] / 'native-timed-store.json')['slots']
pagehide = read(BASE / NAMES[0] / 'native-pagehide-store.json')['slots']
check('manual slot complete data is preserved across timed/pagehide snapshots',
      next(s for s in timed if s['id'] == 'slot-1') == next(s for s in pagehide if s['id'] == 'slot-1'))
report = read(BASE / NAMES[0] / 'native-build-report.json')
check('native bug report binds actual continued envelope and build', report['session']['game'] == native['continued']['game']
      and report['versions']['buildId'] == browser['buildId'])
validators = []
for name in ['recovered', 'continued', 'imported']:
    path = BASE / NAMES[2] / (name + '-verification.json')
    value = read(path)
    check('validator ' + name + ' input authenticates raw native download', value['inputSha256'] == fp(BASE / NAMES[0] / ('native-' + name + '.json'))['sha256'])
    check('validator ' + name + ' binds actual retained executable', value['executedBundleSha256'] == fp(BASE / 'prepared/modules/verify-native.mjs')['sha256'])
    check('validator ' + name + ' binds actual retained checker source', value['checkerScriptSha256'] == fp(PRODUCT / value['checkerScriptPath'])['sha256'])
    check('validator ' + name + ' records complete native and continuation pass', value['result'] == 'passed'
          and all(value[key] for key in ['nativeDecoderPassed', 'completeEnvelopeRoundtripPassed',
              'completeReplayEnvelopePassed', 'bundleSourceBindingPassed', 'sourceUnchangedDuringVerification'])
          and all(value['continuation'][key] for key in ['completeEnvelopeEqualityPassed',
              'recorderEqualityPassed', 'allAcceptedContinuationCommandsRecorded', 'extendedReplayEqualityPassed']))
    validators.append({'file': str(path.relative_to(BASE)), **fp(path), 'recordedResult': value['result'],
        'inputSha256': value['inputSha256'], 'finalTick': value['finalTick'],
        'continuedToTick': value['continuation']['finalTick'], 'continuationTicks': value['continuation']['advancedTicks']})

after = {name: inventory(BASE / name) for name in NAMES}
check('all original raw file inventories unchanged during this review', before == after)
failed = [item for item in checks if not item['passed']]
summary = {'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceRoot': str(BASE), 'productPin': P, 'proofPin': Q, 'buildId': browser['buildId'],
    'saveVersion': browser['schema']['saveVersion'], 'simulationRevision': browser['schema']['simulationRevision'],
    'authenticationResult': 'passed' if not failed else 'failed', 'comparisonCount': len(checks),
    'failedComparisonCount': len(failed), 'rawFileCount': len(flat),
    'directoryFileCounts': {name: len(files) for name, files in before.items()},
    'browserResult': 'failed', 'browserFinalizationFailure': browser['finalizationFailure']['message'],
    'gameplayChecks': browser['checks'], 'validators': validators,
    'sourceCoverage': source_coverage, 'manifestCoverage': coverage,
    'coverageLimits': ['Owner full manifests omit their own recursive self-hash. This independent inventory includes all six raw owner full manifests.',
        'Browser provenance source categories contain 585 product inputs. The separately pinned session-recovery proof has four files in runtime inputs and two executed sources in browser-proof.json.',
        'Inspection full manifest covers browser, runtime, offline and inspection only; diagnostic and independent directories are covered by their own manifests and this 50-file inventory.',
        'No saved owner script, validator, build, browser or product module was executed. Native validator pass status is authenticated from retained outputs, not rerun.',
        'The separate diagnostic attributes one error in its own first context to favicon.ico. It does not attribute either of the two original r1 console errors.',
        'Screenshots are hashed here; this review makes no new visual-inspection claim.']}
write('manifest-authentication.json', {'summary': summary, 'checks': checks, 'failedChecks': failed})
write('compact-index.json', summary)
text = (f'The browser run remains failed at finalization after six recorded gameplay checks. '
        f'The recovered, continued and imported native validators separately record passes. '
        f'Product pin {P}; proof pin {Q}; SAVE4; rules 4.0.1.\n\n'
        f'This review independently hashed all {len(flat)} raw files in the six requested directories, '
        f'authenticated every owner full-manifest entry, checked 585 product inputs against pinned Git bytes, '
        f'four proof files, and the complete 411-file preparation inventory. '
        f'Authentication: {summary["authenticationResult"]}; {len(checks)} comparisons; {len(failed)} failures.\n\n'
        'The diagnostic identifies one favicon 404 in its own run. Both original r1 console errors remain unattributed. '
        'Browser acceptance remains incomplete. No original artifact was changed and no product execution occurred.\n')
(OUT / 'compact-index.md').write_text(text)
write('review-output-inventory.json', {'selfExcluded': 'review-output-inventory.json',
    'files': {p.name: fp(p) for p in sorted(OUT.iterdir()) if p.is_file() and p.name != 'review-output-inventory.json'}})
print(json.dumps({'outputDirectory': str(OUT), 'authenticationResult': summary['authenticationResult'],
    'rawFileCount': len(flat), 'comparisonCount': len(checks), 'failedChecks': failed,
    'directoryFileCounts': summary['directoryFileCounts'], 'sourceCoverage': source_coverage}, indent=2))
