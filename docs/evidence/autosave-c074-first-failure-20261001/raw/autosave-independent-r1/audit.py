"""Audit retained autosave evidence without running product code or browser actions.

Run: python3 audit.py [fresh-audit-filename.json]
Only this audit directory receives output. Existing receipts are never replaced.
"""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys

OWN = pathlib.Path(__file__).resolve().parent
BASE = OWN.parent
PRODUCT = pathlib.Path('/home/morgana/.codex/worktrees/assembled-rules401/orcs-vs-Fairies')
PROOF = pathlib.Path('/home/morgana/Projects/orcs-vs-fairies-autosave-proof')
P = 'c074cc5e610fc128d7b6ac894a61258d418463d4'
Q = '9e5fd2340b9a0823d1ab9f566c52b947a094278e'
BROWSER = BASE / 'autosave-browser-r1'
RUNTIME = BASE / 'autosave-runtime-r1'
OFFLINE = BASE / 'autosave-offline-r1'
INSPECTION = BASE / 'autosave-inspection-r1'
PREPARED = BASE / 'prepared'
BASELINE_SHA = '03df2eb70bef60d872562b8574cf3c698b9059d0e91395a16ee436017c376580'
name = sys.argv[1] if len(sys.argv) > 1 else 'audit.json'
assert re.fullmatch(r'[a-z0-9][a-z0-9.-]*\.json', name), 'Choose an audit JSON basename.'
OUTPUT = OWN / name
MANIFEST = OWN / ('full-manifest.json' if name == 'audit.json' else name + '.manifest.json')
assert not OUTPUT.exists() and not MANIFEST.exists(), 'Use fresh audit receipt filenames.'
checks = []
details = {}
counts = {}

def read(path):
    return json.loads(path.read_text())

def check(name, condition, detail=None):
    checks.append({'check': name, 'passed': bool(condition), **({'detail': detail} if detail is not None else {})})
    if not condition:
        raise AssertionError(name)

def fp(path):
    check('regular file: ' + str(path), path.is_file() and not path.is_symlink())
    body = path.read_bytes()
    return {'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}

def inventory(root):
    return {str(p.relative_to(root)): fp(p) for p in sorted(root.rglob('*')) if p.is_file()}

def inventory_matches(root, expected, label, excluded=()):
    actual = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()} - set(excluded)
    check(label + ' exact file paths', actual == set(expected))
    for path, record in expected.items():
        check(label + ' fingerprint: ' + path, fp(root / path) == record)
    return len(expected)

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()

def audit():
    baseline_path = OWN / 'first-failure-baseline.json'
    check('pre-offline independent baseline digest', fp(baseline_path)['sha256'] == BASELINE_SHA)
    baseline = read(baseline_path)
    original_runtime = dict(baseline['runtime'])
    original_runtime['full-manifest.json'] = baseline['fullManifest']
    expected_original = {'browser': baseline['browser'], 'runtime': original_runtime}
    counts['originalBrowserFiles'] = inventory_matches(BROWSER, baseline['browser'], 'original browser')
    counts['originalRuntimeFilesIncludingManifest'] = inventory_matches(RUNTIME, original_runtime, 'original runtime')
    browser = read(BROWSER / 'browser-proof.json')
    runtime = read(RUNTIME / 'run.json')
    manifest = read(BROWSER / 'manifest.json')
    full = read(RUNTIME / 'full-manifest.json')
    browser_inventory = read(RUNTIME / 'browser-output-manifest.json')
    check('runtime browser inventory equals independent original baseline', browser_inventory == baseline['browser'])
    check('runtime full browser inventory equals independent original baseline', full['browser'] == baseline['browser'])
    check('runtime full runtime inventory equals independent original baseline', full['runtime'] == baseline['runtime'])
    artifact_inventory = {p: value for p, value in baseline['browser'].items() if p != 'manifest.json' and not p.endswith('.log')}
    check('browser manifest exact artifacts', manifest['artifacts'] == artifact_inventory)
    check('browser and runtime failure remain retained', browser['result'] == runtime['result'] == 'failed')
    check('browser exit failure retained without retry', len(runtime['steps']) == 1 and runtime['steps'][0]['name'] == 'browser' and runtime['steps'][0]['exitCode'] == 1)
    expected_console = 'Failed to load resource: the server responded with a status of 404 (Not Found)'
    check('both unclassified console messages retained', browser['consoleErrors'] == [expected_console, expected_console])
    check('strict finalization failure retained', 'consoleErrors must be empty' in browser['finalizationFailure']['message'])
    for field in ['pageErrors', 'failedRequests', 'httpErrors']:
        check('recorded ' + field + ' empty', browser[field] == [])
    check('six distinct recorded behavior checks', len(browser['checks']) == len({c['id'] for c in browser['checks']}) == 6)
    check('browser pins', browser['productPin'] == browser['sourcePin'] == manifest['sourcePin'] == P and browser['proofPin'] == Q)
    check('runtime pins', runtime['productPin'] == P and runtime['proofPin'] == Q)
    details['browserFailure'] = {'result': browser['result'], 'consoleErrors': browser['consoleErrors'], 'finalizationFailure': browser['finalizationFailure'], 'resourceCause': 'Unidentified: retained strings do not contain request URLs.'}
    details['behaviorChecks'] = browser['checks']
    for root, pin, label in [(PRODUCT, P, 'product'), (PROOF, Q, 'proof')]:
        check(label + ' HEAD', git(root, 'rev-parse', 'HEAD') == pin)
        check(label + ' clean status', git(root, 'status', '--porcelain') == '')
    before = read(RUNTIME / 'inputs-before.json')
    after = read(RUNTIME / 'inputs-after.json')
    check('frozen input before/after seals equal', before == after)
    preparation = read(PREPARED / 'prepare.json')
    check('preparation pin', preparation['sourcePin'] == P)
    for group in ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles']:
        check('browser manifest ' + group + ' equals preparation', manifest[group] == preparation[group])
    tree = subprocess.check_output(['git', '-C', str(PRODUCT), 'ls-tree', '-r', P], text=True).splitlines()
    git_blobs = {row.split('\t')[1]: row.split()[2] for row in tree}
    for path, expected in before['inputs'].items():
        actual = fp(PRODUCT / path)
        check('frozen product fingerprint: ' + path, actual == expected)
        body = (PRODUCT / path).read_bytes()
        git_hash = hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()
        check('frozen product Git blob: ' + path, git_hash == git_blobs[path])
    counts['productInputs'] = len(before['inputs'])
    counts['preparedFiles'] = inventory_matches(PREPARED, before['preparedFiles'], 'prepared')
    for path, expected in before['proofFiles'].items():
        check('proof file seal: ' + path, fp(PROOF / path) == expected)
    for path, expected in browser['proofSources'].items():
        actual = (PROOF / path).read_bytes()
        committed = subprocess.check_output(['git', '-C', str(PROOF), 'show', Q + ':' + path])
        check('executed proof Git bytes: ' + path, actual == committed and fp(PROOF / path) == expected)
    build_hash = hashlib.sha256()
    for path in sorted(p for p in preparation['sourceFiles'] if p.endswith(('.ts', '.css'))):
        build_hash.update(path[4:].encode())
        build_hash.update((PRODUCT / path).read_bytes())
    check('independent product build digest', build_hash.hexdigest() == browser['buildId'] == manifest['buildId'])
    check('served before/after unchanged', browser['servedBefore'] == browser['servedAfter'])
    for path, served in browser['servedBefore'].items():
        compiled = manifest['compiledFiles'][path]
        check('served entry fingerprint: ' + path, served['sha256'] == compiled['sha256'] and served['bytes'] == compiled['bytes'])
    for url, served in browser['servedAssets'].items():
        compiled = manifest['compiledFiles'][served['path']]
        check('served response fingerprint: ' + url, served['sha256'] == compiled['sha256'] and served['bytes'] == compiled['bytes'])
    details['build'] = {'buildId': browser['buildId'], 'schema': browser['schema'], 'servedBefore': browser['servedBefore'], 'servedAfter': browser['servedAfter'], 'servedAssets': browser['servedAssets']}
    for filename, record in browser['downloads'].items():
        check('original browser download fingerprint: ' + filename, fp(BROWSER / filename) == {k: record[k] for k in ['bytes', 'sha256']})
    for record in browser['screenshots']:
        check('original screenshot fingerprint: ' + record['file'], fp(BROWSER / record['file']) == {k: record[k] for k in ['bytes', 'sha256']})
    counts['nativeDownloads'] = len(browser['downloads'])
    counts['screenshots'] = len(browser['screenshots'])
    details['nativeFingerprints'] = browser['downloads']
    details['screenshotFingerprints'] = browser['screenshots']
    original = read(BROWSER / 'native-before-reload.json')
    recovered = read(BROWSER / 'native-recovered.json')
    imported = read(BROWSER / 'native-imported.json')
    continued = read(BROWSER / 'native-continued.json')
    manual = read(BROWSER / 'native-manual.json')
    build_report = read(BROWSER / 'native-build-report.json')
    check('original/recovered/imported complete raw bytes equal', (BROWSER / 'native-before-reload.json').read_bytes() == (BROWSER / 'native-recovered.json').read_bytes() == (BROWSER / 'native-imported.json').read_bytes())
    check('native report game equals continued game', build_report['session']['game'] == continued['game'])
    check('native report pins current build/schema/rules', build_report['versions']['buildId'] == browser['buildId'] and build_report['versions']['save'] == 4 and build_report['versions']['simulationRevision'] == '4.0.1')
    slots = {slot['id']: slot for slot in read(BROWSER / 'native-pagehide-store.json')['slots']}
    check('forced autosave game equals recovered game', slots['autosave']['file']['game'] == recovered['game'])
    check('manual save retained through interruption', slots['slot-1']['file']['game'] == manual['game'])
    for file in [original, recovered, imported, continued, manual]:
        check('native game/schema/history tick consistency', file['game']['version'] == 4 and file['replay']['simulationRevision'] == '4.0.1' and file['replay']['finalTick'] == file['game']['state']['tick'])
    offline_run = read(OFFLINE / 'run.json')
    check('offline result and pins', offline_run['result'] == 'passed' and offline_run['productPin'] == P and offline_run['proofPin'] == Q and offline_run['browserResult'] == 'failed')
    check('offline original inventories before/after identical', read(OFFLINE / 'original-manifests-before.json') == read(OFFLINE / 'original-manifests-after.json') == expected_original)
    counts['offlineFilesIncludingManifest'] = inventory_matches(OFFLINE, {**read(OFFLINE / 'full-manifest.json'), 'full-manifest.json': fp(OFFLINE / 'full-manifest.json')}, 'offline')
    expected_steps = [prefix + name for name in ['recovered', 'continued', 'imported'] for prefix in ['authenticate-', 'validate-']]
    check('offline exact six steps with zero exits', [s['name'] for s in offline_run['steps']] == expected_steps and all(s['exitCode'] == 0 for s in offline_run['steps']))
    records = []
    module_manifest = read(PREPARED / 'modules/manifest.json')
    for name in ['recovered', 'continued', 'imported']:
        filename = 'native-' + name + '.json'
        value = read(OFFLINE / (name + '-verification.json'))
        native = read(BROWSER / filename)
        check(name + ' verifier result/pin/input', value['result'] == 'passed' and value['sourcePin'] == P and value['inputSha256'] == browser['downloads'][filename]['sha256'])
        check(name + ' verifier source and executable bindings', value['checkerScriptSha256'] == fp(PRODUCT / value['checkerScriptPath'])['sha256'] and value['executedBundleSha256'] == fp(PREPARED / 'modules/verify-native.mjs')['sha256'] == module_manifest['modules']['verify-native.mjs']['sha256'])
        check(name + ' verifier exact native input and prepared executable paths', pathlib.Path(value['inputPath']).resolve() == (BROWSER / filename).resolve() and pathlib.Path(value['executedBundlePath']).resolve() == (PREPARED / 'modules/verify-native.mjs').resolve())
        check(name + ' verifier schema and rules', value['saveVersion'] == value['replayChecksumVersion'] == 4 and value['simulationRevision'] == '4.0.1' and value['sessionVersion'] == value['replayVersion'] == 1)
        for field in ['sourceUnchangedDuringVerification', 'bundleSourceBindingPassed', 'nativeDecoderPassed', 'completeEnvelopeRoundtripPassed', 'completeReplayEnvelopePassed', 'recomputedAnalysisPassed', 'technologyTimingsPassed']:
            check(name + ' recorded verification flag: ' + field, value[field] is True)
        provenance = value['sourceProvenance']
        check(name + ' verifier source provenance pin/build/digest', provenance['sourcePin'] == P and provenance['buildId'] == browser['buildId'] and provenance['digest'] == module_manifest['sourceDigest'])
        for record in provenance['files']:
            check(name + ' verifier source fingerprint: ' + record['path'], fp(PRODUCT / record['path']) == {k: record[k] for k in ['bytes', 'sha256']} and record['gitBlob'] == git_blobs[record['path']] and record['bytesMatchGit'] is True)
        entries = [dict(replayActionIndex=i, **action) for i, action in enumerate(native['replay']['actions']) if action['type'] == 'command']
        check(name + ' accepted native command records', value['acceptedCommandEntries'] == entries and value['acceptedCommands'] == [entry['command'] for entry in entries])
        check(name + ' endpoint tick and checksum', value['finalTick'] == native['game']['state']['tick'] and value['checksum'] == native['replay']['finalChecksum'] and value['advanced'] == value['finalTick'] - value['initialTick'])
        continuation = value['continuation']
        for field in ['completeEnvelopeEqualityPassed', 'recorderEqualityPassed', 'allAcceptedContinuationCommandsRecorded', 'extendedReplayEqualityPassed']:
            check(name + ' recorded continuation flag: ' + field, continuation[field] is True)
        check(name + ' recorded continuation counts and movement', continuation['startTick'] == value['finalTick'] and continuation['finalTick'] - continuation['startTick'] == continuation['advancedTicks'] == 100 and continuation['timestep'] == .05 and continuation['movementPhaseTicks'] == 60 and continuation['maxActorDisplacement'] > .01)
        check(name + ' recorded continuation commands', [c['type'] for c in continuation['commands']] == ['hold', 'stop', 'move', 'move', 'hold', 'stop'] and continuation['commands'][2]['queued'] is False and continuation['commands'][3]['queued'] is True)
        authentication = read(OFFLINE / ('authenticate-' + name + '.log'))
        validation_log = read(OFFLINE / ('validate-' + name + '.log'))
        check(name + ' authentication log matches browser fingerprint', authentication['file'] == filename and authentication['authenticated'] is True and {k: authentication[k] for k in ['bytes', 'sha256']} == {k: browser['downloads'][filename][k] for k in ['bytes', 'sha256']})
        check(name + ' validation log matches receipt', validation_log['result'] == 'passed' and validation_log['sourcePin'] == P and validation_log['finalTick'] == value['finalTick'] and validation_log['continuedTicks'] == 100 and pathlib.Path(validation_log['outputPath']).resolve() == (OFFLINE / (name + '-verification.json')).resolve())
        records.append({'file': name + '-verification.json', **fp(OFFLINE / (name + '-verification.json')), 'inputSha256': value['inputSha256'], 'result': value['result'], 'tick': value['finalTick'], 'continuedToTick': continuation['finalTick'], 'executedBundleSha256': value['executedBundleSha256']})
    counts['offlineValidators'] = len(records)
    details['offlineNativeRecords'] = records
    inspection = read(INSPECTION / 'inspection.json')
    inspection_manifest = read(INSPECTION / 'full-manifest.json')
    check('inspection preserves failed browser result and current pins', inspection['overallBrowserResult'] == 'failed' and inspection['productPin'] == P and inspection['proofPin'] == Q and inspection['buildId'] == browser['buildId'])
    check('inspection lists same native record fingerprints', inspection['nativeValidators'] == [{k: row[k] for k in ['file', 'bytes', 'sha256', 'result', 'inputSha256', 'tick', 'continuedToTick']} for row in records])
    check('inspection screenshot fingerprints match retained originals', inspection['screenshots'] == [dict(record, openedAndInspected=True) for record in browser['screenshots']])
    for directory, expected in inspection_manifest['directories'].items():
        excluded = ['full-manifest.json'] if directory == INSPECTION.name else []
        inventory_matches(BASE / directory, expected, 'inspection snapshot ' + directory, excluded)
    counts['inspectionFilesIncludingManifest'] = len(list(INSPECTION.iterdir()))
    check('offline and inspection outputs remain outside browser inventory', all(not path.endswith('.log') and not path.endswith('-verification.json') for path in baseline['browser']) and OFFLINE.parent == INSPECTION.parent == BROWSER.parent and OFFLINE != BROWSER and INSPECTION != BROWSER)
    for step in offline_run['steps']:
        check('offline process absent: ' + step['name'], not pathlib.Path('/proc/' + str(step['pid'])).exists())
    check('browser driver process absent', not pathlib.Path('/proc/' + str(runtime['steps'][0]['pid'])).exists())
    preview = runtime['preview']
    check('owned preview process absent', not pathlib.Path('/proc/' + str(preview['pid'])).exists())
    listeners = subprocess.check_output(['ss', '-ltnp', '( sport = :5299 )'], text=True)
    check('actual owned port 5299 has no listener', len(listeners.strip().splitlines()) == 1)
    check('recorded cleanup complete', browser['browserClosed'] and runtime['portClosed'] and preview['closed'] and preview['pidAbsent'] and runtime['frozenBytesUnchanged'])
    details['cleanup'] = {'ownedPreviewPid': preview['pid'], 'ownedPreviewPidAbsentNow': True, 'browserDriverPid': runtime['steps'][0]['pid'], 'browserDriverPidAbsentNow': True, 'listeners5299Now': listeners, 'browserClosedRecorded': browser['browserClosed'], 'individualChromiumChildPidsRetained': False, 'protected4173AccessByThisAudit': False}
    check('all original first-failure files unchanged after audit reads', inventory(BROWSER) == expected_original['browser'] and inventory(RUNTIME) == expected_original['runtime'])
    details['outputSeparation'] = {'browser': str(BROWSER), 'runtime': str(RUNTIME), 'offline': str(OFFLINE), 'inspection': str(INSPECTION), 'independentAudit': str(OWN), 'originalBrowserFilesChanged': False, 'browserContainsOfflineReceiptsOrLogs': False}
    return {'auditResult': 'passed', 'browserResult': 'failed', 'offlineValidationResult': 'passed', 'featureAcceptance': 'incomplete', 'conclusion': 'Retained artifact integrity passed. The original browser run remains failed because its strict console-error gate rejected two unclassified 404 strings. Offline native validation does not change that browser outcome.'}

receipt = {'productPin': P, 'proofPin': Q, 'method': 'Read-only file, Git-blob, hash, receipt and process/listener comparisons. No product modules, browser actions, simulation, builds or validators were executed.', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'comparator': {'file': __file__, **fp(pathlib.Path(__file__))}, 'limits': ['Offline replay/continuation correctness is the result recorded by the frozen executed verifier; this audit authenticates its source, bundle, logs, input files and receipt without rerunning simulation.', 'Screenshot inspection claims are authenticated from the separate owner inspection receipt; this audit checks their retained bytes and did not reopen images.', 'Individual Chromium child PIDs were not retained; browser closure is recorded by the driver, while preview and driver PIDs and owned port are checked directly.', 'No resource URL was recorded for the two console 404 strings, so their cause is not established.']}
try:
    receipt.update(audit())
except Exception as error:
    receipt.update(auditResult='failed', failure={'type': type(error).__name__, 'message': str(error)})
receipt.update(finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), counts=counts, passedCheckCount=sum(row['passed'] for row in checks), failedCheckCount=sum(not row['passed'] for row in checks), checks=checks, details=details)
with OUTPUT.open('x') as handle:
    json.dump(receipt, handle, indent=2)
    handle.write('\n')
owned_inventory = inventory(OWN)
owned_inventory.pop(MANIFEST.name, None)
with MANIFEST.open('x') as handle:
    json.dump({'productPin': P, 'proofPin': Q, 'auditResult': receipt['auditResult'], 'files': owned_inventory}, handle, indent=2)
    handle.write('\n')
print(json.dumps({key: receipt.get(key) for key in ['auditResult', 'browserResult', 'offlineValidationResult', 'featureAcceptance', 'passedCheckCount', 'failedCheckCount', 'counts', 'failure']}))
raise SystemExit(0 if receipt['auditResult'] == 'passed' else 1)
