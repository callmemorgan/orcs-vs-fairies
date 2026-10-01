import datetime, hashlib, io, json, pathlib, re, stat, subprocess, sys

# Reads existing frozen evidence only. It does not build, simulate, serve, or edit.
cwd = pathlib.Path(sys.argv[1]).resolve()
root = pathlib.Path(sys.argv[2]).resolve()
pin = sys.argv[3]
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: json.loads(p.read_text())
git = lambda args: subprocess.check_output(['git', *args], cwd=cwd)
def regular(p):
    assert stat.S_ISREG(p.lstat().st_mode), str(p)
    for parent in p.parents:
        assert not parent.is_symlink(), str(parent)
def checked_file(p, item):
    regular(p)
    b = p.read_bytes()
    assert len(b) == item['bytes'] and sha(b) == item['sha256'], str(p)
def inventory(p):
    return {str(f.relative_to(p)): {'bytes': f.stat().st_size, 'sha256': sha(f.read_bytes())} for f in sorted(p.rglob('*')) if f.is_file()}

run = read(root/'run.json')
assert run['sourcePin'] == pin and run['result'] == 'passed'
assert run['saveVersion'] == 4 and run['simulationRevision'] == '4.0.1'
assert git(['rev-parse', 'HEAD']).decode().strip() == pin
assert not git(['diff', '--name-only', pin]).decode().strip()
source = read(root/'source-before.json')
assert source == read(root/'logs/source-before.log') == read(root/'logs/source-after.log')
assert source['sourcePin'] == pin and source['sourceDigest'] == run['sourceDigest'] and source['buildId'] == run['buildId']
inputs = {}
for category in ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles', 'worldScriptFiles']:
    for path, item in source[category].items():
        assert path not in inputs or inputs[path] == item
        inputs[path] = item
queries = ''.join(f'{pin}:{path}\n' for path in sorted(inputs)).encode()
proc = subprocess.run(['git', 'cat-file', '--batch'], cwd=cwd, input=queries, stdout=subprocess.PIPE, check=True)
stream = io.BytesIO(proc.stdout)
for path in sorted(inputs):
    item = inputs[path]
    blob, kind, length = stream.readline().decode().strip().split()
    b = stream.read(int(length)); assert stream.read(1) == b'\n'
    assert kind == 'blob' and blob == item['gitBlob'] and len(b) == item['bytes'] and sha(b) == item['sha256'], path
    checked_file(cwd/path, item)
assert sha(''.join(f'{p}\0{inputs[p]["sha256"]}\n' for p in sorted(inputs)).encode()) == source['sourceDigest']
build_hash = hashlib.sha256()
for path in sorted(source['sourceFiles']):
    if re.search(r'\.(ts|css)$', path):
        build_hash.update(path[4:].encode()); build_hash.update((cwd/path).read_bytes())
assert build_hash.hexdigest() == source['buildId']
for name in ['dist', 'dist-cli', 'dist-server', 'dist-tournament']:
    manifest = read(root/'builds'/(name+'-manifest.json'))
    assert manifest['sourcePin'] == pin and manifest['sourceDigest'] == source['sourceDigest'] and manifest['buildId'] == source['buildId']
    assert inventory(root/'builds'/name) == manifest['compiledFiles'] == inventory(cwd/name)
    for path, item in manifest['compiledFiles'].items(): checked_file(root/'builds'/name/path, item)

prep = read(root/'preparation-output.json')
modules = pathlib.Path(prep['modulesDir'])
assert modules == root/'modules'
assert sha((modules/'prepare.json').read_bytes()) == prep['preparationSha256']
receipt = read(modules/'prepare.json'); manifest = read(modules/'manifest.json')
manifest_sha = sha((modules/'manifest.json').read_bytes())
assert receipt['manifestSha256'] == manifest_sha and receipt['sourcePin'] == pin and receipt['sourceDigest'] == source['sourceDigest']
assert manifest['provenance'] == source and set(manifest['modules']) == {'generate', 'native', 'cli', 'mod-fixture'}
expected_module_paths = {'prepare.json', 'manifest.json'}
for name, item in manifest['modules'].items():
    expected_module_paths.update([item['path'], item['metafile']['path']])
    checked_file(modules/item['path'], item)
    assert sha((modules/item['metafile']['path']).read_bytes()) == item['metafile']['sha256']
    for path, metadata in item['inputs'].items(): assert inputs[path] == metadata
assert set(p.name for p in modules.iterdir()) == expected_module_paths

launcher_receipts = {}
for step in run['steps']:
    assert step['result'] == 'passed' and step['exitCode'] == 0, step['name']
    log = root/step['log']; assert sha(log.read_bytes()) == step['logSha256']
    records = []
    for line in log.read_text().splitlines():
        try: records.append(json.loads(line))
        except (ValueError, TypeError): pass
    launches = [r for r in records if isinstance(r, dict) and r.get('launcherResult') == 'passed']
    if step['name'] in ['generate', 'mod-fixture', 'cli'] or step['name'].startswith('native-'):
        assert len(launches) == 1, step['name']
        info = launches[0]; path = pathlib.Path(info['launcherReceipt'])
        assert path.is_relative_to(root/'launches') and sha(path.read_bytes()) == info['launcherReceiptSha256']
        binding = read(path); module = manifest['modules'][binding['module']]
        assert binding['result'] == 'passed' and binding['exitCode'] == 0 and binding['sourcePin'] == pin
        assert binding['sourceDigest'] == source['sourceDigest'] and binding['manifestSha256'] == manifest_sha and binding['preparationSha256'] == prep['preparationSha256']
        assert binding['preparedBundle']['sha256'] == binding['executedBundle']['sha256'] == module['sha256'] == info['freshRebuildSha256']
        assert binding['freshInputFiles'] == module['inputs'] and binding['compiler'] == manifest['compiler']
        assert binding['launcher']['sha256'] == inputs['scripts/world/run-native.mjs']['sha256']
        assert not pathlib.Path(binding['executedBundle']['path']).parent.exists()
        launcher_receipts[binding['executedBundle']['path']] = {'path': str(path.relative_to(root)), 'sha256': sha(path.read_bytes()), 'module': binding['module']}
assert len(launcher_receipts) == len(run['nativeChecks']) + 3
assert set(root.glob('launches/*/binding.json')) == {root/v['path'] for v in launcher_receipts.values()}

native = []
for item in run['nativeChecks']:
    assert item['result'] == 'passed'
    file = root/item['input']; report = read(root/item['report']); session = read(file)
    assert sha(file.read_bytes()) == report['inputSha256'] == item['inputSha256'] and pathlib.Path(report['input']) == file
    assert report['provenance'] == source and report['saveVersion'] == 4 and report['simulationRevision'] == '4.0.1'
    assert session['game']['version'] == 4 and session['replay']['simulationRevision'] == '4.0.1' and session['replay']['checksumVersion'] == 4
    for flag in ['nativeDecoderPassed', 'completeEnvelopeRoundtripPassed', 'completeReplayEnvelopePassed', 'continuedReplayEnvelopePassed']: assert report[flag] is True
    assert report['identicalContinuationSteps'] == report['identicalContinuedTicks'] == 20
    assert report['continuedTick'] == report['finalTick'] + 20 == session['game']['state']['tick'] + 20
    bundle = report['bundle']; assert bundle['path'] in launcher_receipts and launcher_receipts[bundle['path']]['module'] == 'native'
    assert bundle['sha256'] == bundle['launcherExpectedSha256'] == manifest['modules']['native']['sha256']
    assert bundle['preparationSha256'] == prep['preparationSha256'] and bundle['manifestSha256'] == manifest_sha
    assert report['checker']['sha256'] == inputs[report['checker']['path']]['sha256']
    native.append({'input':item['input'], 'inputSha256':item['inputSha256'], 'report':item['report'], 'finalTick':report['finalTick'], 'continuedTick':report['continuedTick']})
assert len(native) == 35 and len({n['input'] for n in native}) == 35
assert set(root.glob('native-reports/*.json')) == {root/n['report'] for n in native}
required_inputs = {'fixtures/neutral.json', 'fixtures/surface.json', 'fixtures/dusk.json', 'fixtures/thaw.json', 'cli/cli-world-session.json', 'browser/desert-world-save.json', 'browser/marsh-world-save.json', 'browser/snow-world-save.json', 'browser/forest-world-save.json', 'actions/native-neutral-imported.json', 'actions/native-surface-imported.json', 'actions/native-dusk-imported.json', 'actions/native-thaw-imported.json', 'actions/world-browser-save.json', 'actions/surface-world-save.json', 'actions/thaw-world-save.json', 'mods/browser-save.json', 'mods/browser-replay-final.save.json', 'map/edited-map-in-play.save.json', 'flat/convoy-playing.save.json', 'layered/cave-scenario-playing.save.json', 'community-mod/community-mod-trained.save.json', 'community-map/browser-played-complete.save.json'}
required_inputs.update(str(p.relative_to(root)) for p in (root/'community-map').glob('browser-replay-*.save.json'))
required_inputs.update('bug-report-sessions/'+name+'.json' for name in ['world', 'actions', 'mods', 'map', 'flat', 'layered', 'community-map', 'community-mod'])
assert {n['input'] for n in native} == required_inputs

stages = {'browser':'browser-world.json', 'actions':'browser-world-actions.json', 'mods':'browser-proof.json', 'map':'result.json', 'flat':'result.json', 'layered':'result.json', 'community-map':'result.json', 'community-mod':'result.json'}
stage_counts = {}
for stage, file in stages.items():
    result = read(root/stage/file)
    assert result.get('errors', []) == [] and result.get('failure') is None, stage
    assert result.get('source', result.get('provenance')) == source, stage
    if 'checks' in result: count = len(result['checks'])
    elif 'results' in result: count = len(result['results'])
    else: count = len(result['evidence'])
    stage_counts[stage] = count
assert stage_counts['browser'] == 12 and stage_counts['actions'] == 17
bug_paths = {'world':'browser/world-native-build-report.json', 'actions':'actions/world-actions-native-build-report.json', 'mods':'mods/browser-build-report.json', 'map':'map/edited-map-build-report.json', 'flat':'flat/convoy-build-report.json', 'layered':'layered/cave-scenario-build-report.json', 'community-map':'community-map/community-map-build-report.json', 'community-mod':'community-mod/community-mod-build-report.json'}
for name, path in bug_paths.items():
    bug = read(root/path)
    assert bug['versions']['buildId'] == source['buildId'] and bug['versions']['save'] == 4 and bug['versions']['simulationRevision'] == '4.0.1'
    assert bug['session'] == read(root/'bug-report-sessions'/(name+'.json'))
assert read(root/'mod-fixtures/lantern.json')['engineVersion'] == 3
artifacts = read(root/'artifact-hashes.json')
for path, item in artifacts.items(): checked_file(root/path, item)
assert run['previewClosed'] is True and len(run['listenersAfter'].splitlines()) == 1 and run['port4173Touched'] is False
ports = [5183, *[int(read(root/stage/'result.json')['base'].rsplit(':', 1)[1].rstrip('/')) for stage in ['community-map', 'community-mod']]]
listener_outputs = {str(port): subprocess.check_output(['ss','-ltnp',f'( sport = :{port} )'], text=True).strip() for port in ports}
assert all(len(value.splitlines()) == 1 for value in listener_outputs.values())
helpers = list((cwd/'dist-server').glob('community-map-proof-*')) + list((cwd/'dist-server').glob('community-mod-proof-*'))
assert helpers == []
node_tmpdir = pathlib.Path(subprocess.check_output(['node', '-e', 'console.log(require("node:os").tmpdir())'], cwd=cwd, text=True).strip())
backend_directories_after = {prefix: [str(p) for p in node_tmpdir.glob(prefix)] for prefix in ['ovf-community-browser-*', 'ovf-community-mod-*']}
assert all(paths == [] for paths in backend_directories_after.values())
result = {'kind':'read-only-current-world-artifact-audit', 'result':'passed', 'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourcePin':pin, 'saveVersion':4, 'simulationRevision':'4.0.1', 'contentEngineVersion':3, 'sourceDigest':source['sourceDigest'], 'buildId':source['buildId'], 'sourceInputCount':len(inputs), 'stepCount':len(run['steps']), 'nativeReportCount':len(native), 'launcherReceiptCount':len(launcher_receipts), 'preparationSha256':prep['preparationSha256'], 'artifactHashesChecked':len(artifacts), 'stageChecks':stage_counts, 'nativeReports':native, 'launcherReceipts':list(launcher_receipts.values()), 'bugReportPaths':bug_paths, 'cleanup':{'ownedPorts':ports, 'listenersAfter':listener_outputs, 'helpersAfter':[], 'privateRebuildsAbsent':True, 'backendDataDirectoryLimit':'Unique data-directory names are not retained; pinned finally cleanup was awaited. Individual absence is not independently established.'}, 'screenshots':[{ 'path':str(p.relative_to(root)), 'sha256':sha(p.read_bytes())} for stage in stages for p in sorted((root/stage).glob('*.png'))], 'visualInspection':'Pending; hashes are not a visual inspection.'}
result['cleanup']['nodeTmpdir'] = str(node_tmpdir)
result['cleanup']['backendDirectoriesAfter'] = backend_directories_after
result['cleanup']['backendDataDirectoryLimit'] = 'Unique map/backend directory names were not retained by the drivers. Final direct enumeration found no directories matching either pinned driver prefix in the confirmed Node temporary directory.'
print(json.dumps(result, indent=2))
