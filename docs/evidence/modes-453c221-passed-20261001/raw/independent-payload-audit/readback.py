#!/usr/bin/env python3
"""Read retained proof bytes only; never imports or executes product code."""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

PROOF = pathlib.Path('/tmp/ovf-modes-final-proof.uezs4d3d')
CHECKOUT = pathlib.Path('/tmp/ovf-modes-final-checkout.3i_ez0cq')
OUT = pathlib.Path(__file__).parent
PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
EXTERNAL = {
    'originalPostflight': pathlib.Path('/tmp/ovf-modes-postflight-453c221.x9kv45_h/postflight.json'),
    'firstCleanupObserverFailure': pathlib.Path('/tmp/ovf-modes-dispatch-453c221.09ofch__/first-cleanup-observer-failure.json'),
    'laterCleanupObservation': pathlib.Path('/tmp/ovf-modes-dispatch-453c221.09ofch__/final-direct-cleanup-observation.json'),
}
checks = []
read_files = {}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read(path):
    path = pathlib.Path(path)
    data = path.read_bytes()
    read_files[str(path)] = {'bytes': len(data), 'sha256': sha(data)}
    return data

def load(relative):
    return json.loads(read(PROOF / relative))

def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})

def minify_json_bytes(data):
    # Preserve the JavaScript-produced numeric tokens and key order. Re-encoding
    # parsed floats in Python would not reproduce JSON.stringify's number text.
    chars = []
    quoted = escaped = False
    for char in data.decode('utf-8'):
        if quoted:
            chars.append(char)
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
            chars.append(char)
        elif char not in ' \n\r\t':
            chars.append(char)
    return ''.join(chars).encode('utf-8')

def raw_game_hash(path):
    text = read(path).decode('utf-8')
    match = re.search(r'"game"\s*:\s*', text)
    value, end = json.JSONDecoder().raw_decode(text, match.end())
    return sha(minify_json_bytes(text[match.end():end].encode('utf-8')))

prepared = load('prepare.json')
module_manifest = load('modules/manifest.json')
build_manifest = load('build-manifest.json')
browser_manifest = load('browser/manifest.json')
browser_provenance = load('browser/provenance.json')
final_manifest = load('final-manifest.json')
runtime_provenance = load('runtime/provenance.json')
runtime_run = load('runtime/run.json')
launcher = load('run.json')
browser = load('browser/browser-proof.json')
runtime_results = load('runtime/runtime-results.json')
schema = {
    'saveVersion': 4, 'simulationRevision': '4.0.1',
    'saveFormat': 'orcs-vs-fairies-save', 'sessionVersion': 1,
    'sessionFormat': 'orcs-vs-fairies/session', 'replayVersion': 1,
    'replayFormat': 'orcs-vs-fairies/replay', 'replayChecksumVersion': 4,
    'replayInitialSaveVersion': 4,
}
records = {'prepare': prepared, 'modules': module_manifest, 'build': build_manifest,
           'browserManifest': browser_manifest, 'browserProvenance': browser_provenance,
           'finalManifest': final_manifest, 'runtimeProvenance': runtime_provenance,
           'runtimeRun': runtime_run, 'launcher': launcher, 'browser': browser}
for name, record in records.items():
    check(name + ' source pin', record.get('sourcePin') == PIN)
    if 'schema' in record:
        check(name + ' complete schema', record['schema'] == schema)
check('runtime source commit', runtime_provenance['sourceCommit'] == PIN)
check('browser source commit', browser['sourceCommit'] == PIN)
head = subprocess.check_output(['git', '-C', str(CHECKOUT), 'rev-parse', 'HEAD'], text=True).strip()
check('retained checkout HEAD', head == PIN)
tree_bytes = subprocess.check_output(['git', '-C', str(CHECKOUT), 'ls-tree', '-r', '-z', PIN])
tree = {}
for item in tree_bytes.decode().split('\0'):
    if item:
        metadata, name = item.split('\t', 1)
        mode, kind, blob = metadata.split(' ')
        tree[name] = (mode, kind, blob)
categories = ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles', 'modeScriptFiles']
inputs = {}
for category in categories:
    inputs.update(prepared['provenance'][category])
check('596 unique admitted inputs including favicon', len(inputs) == 596 and 'public/favicon.ico' in inputs)
for name, entry in inputs.items():
    path = CHECKOUT / name
    data = read(path)
    git_blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    pinned = tree.get(name)
    check('pinned input ' + name,
          path.is_file() and not path.is_symlink() and
          len(data) == entry['bytes'] and sha(data) == entry['sha256'] and
          pinned is not None and pinned[1] == 'blob' and
          pinned[2] == entry['gitBlob'] == git_blob)
for record_name in ['modules', 'build', 'browserManifest', 'browserProvenance', 'finalManifest', 'runtimeProvenance']:
    record = records[record_name]
    for category in categories:
        if category in record:
            check(record_name + ' retained ' + category,
                  record[category] == prepared['provenance'][category])
check('runtime source SHA record', load('runtime/source-sha256.json') == prepared['provenance']['sourceFiles'])
source_config = {**prepared['provenance']['sourceFiles'], **prepared['provenance']['configFiles']}
digest = sha(''.join(name + '\0' + entry['sha256'] + '\n' for name, entry in sorted(source_config.items())).encode())
build_hash = hashlib.sha256()
for name in sorted(prepared['provenance']['sourceFiles']):
    if name.endswith(('.ts', '.css')):
        build_hash.update(name[len('src/'):].encode())
        build_hash.update(read(CHECKOUT / name))
build_id = build_hash.hexdigest()
for name, record in records.items():
    if 'sourceDigest' in record:
        check(name + ' source digest', record['sourceDigest'] == digest)
    if 'buildId' in record:
        check(name + ' source build ID', record['buildId'] == build_id)
check('prepared source build ID', prepared['provenance']['buildId'] == build_id)
check('runtime executed bundle hash', runtime_provenance['executedBundleSha256'] == sha(read(PROOF / 'modules/verify-runtime.mjs')))
check('runtime source binding report', runtime_provenance['bundleSourceBindingPassed'] is True)
module_facts = {}
for name, entry in prepared['moduleFiles'].items():
    data = read(PROOF / 'modules' / name)
    check('prepared module bytes ' + name, len(data) == entry['bytes'] and sha(data) == entry['sha256'])
for name, entry in module_manifest['modules'].items():
    data = read(PROOF / 'modules' / name)
    check('module manifest bytes ' + name, len(data) == entry['bytes'] and sha(data) == entry['sha256'])
for name, bundle_inputs in module_manifest['bundleInputs'].items():
    meta = load('modules/' + name + '.meta.json')
    output = next(iter(meta['outputs'].values()))
    check('bundle metadata inputs ' + name, set(meta['inputs']) == set(bundle_inputs) == set(output['inputs']))
    check('bundle metadata entry ' + name, output['entryPoint'] == module_manifest['entries'][name])
    check('bundle inputs pinned ' + name,
          all(entry == inputs.get(path) for path, entry in bundle_inputs.items()))
    module_facts[name] = {'entry': module_manifest['entries'][name], 'inputCount': len(bundle_inputs),
                          'sha256': sha(read(PROOF / 'modules' / name))}
native_text = read(PROOF / 'modules/verify-native.mjs').decode()
runtime_text = read(PROOF / 'modules/verify-runtime.mjs').decode()
check('native embedded pin and digest',
      f'var embeddedPin = false ? void 0 : "{PIN}";' in native_text and
      f'var embeddedDigest = false ? void 0 : "{digest}";' in native_text)
check('runtime embedded pin and digest',
      f'assert3.equal("{PIN}", sourcePin, "Executed runtime bundle belongs to another source pin")' in runtime_text and
      f'assert3.equal("{digest}", sourceDigest(provenance), "Executed runtime bundle belongs to other source bytes")' in runtime_text)
runtime_checker_text = read(CHECKOUT / 'scripts/modes/verify-runtime.ts').decode()
check('unchanged original fixture limits and seeds in pinned checker',
      runtime_checker_text.count('limit:20000') == 4 and runtime_checker_text.count('limit:40000') == 1 and
      runtime_checker_text.count("map:{seed:4127,size:'small'}") == 5)
check('browser schema module hash', browser_provenance['schemaModule']['sha256'] == sha(read(PROOF / 'modules/schema.mjs')))
check('browser module manifest hash', browser_provenance['moduleManifestSha256'] == sha(read(PROOF / 'modules/manifest.json')))
check('browser build manifest hash', browser_provenance['buildManifestSha256'] == sha(read(PROOF / 'build-manifest.json')))

expected_names = ['hill-duel', 'relic-duel', 'relic-contested', 'hill-2v2', 'survival-five-waves']
check('all five original natural cases', [result['name'] for result in runtime_results] == expected_names)
check('natural run reports completed', runtime_run == {'result': 'passed', 'sourcePin': PIN, 'saveVersion': 4,
      'simulationRevision': '4.0.1', 'cases': 5, 'completeEnvelopeContinuationPassed': True})
runtime_facts = []
runtime_flags = ['completeEnvelopeRoundtripPassed', 'completeReplayEnvelopePassed',
                 'continuedRecorderHistoryPassed', 'replaySeekEnvelopePassed']
for result in runtime_results:
    name = result['name']
    session_path = 'runtime/' + name + '.session.json'
    save_path = 'runtime/' + name + '.save.json'
    replay_path = 'runtime/' + name + '.replay.json'
    initial_path = 'runtime/' + name + '-initial.save.json'
    session, save, replay, initial = map(load, [session_path, save_path, replay_path, initial_path])
    state = save['state']
    check(name + ' raw complete game envelope', session['game'] == save)
    check(name + ' raw complete replay envelope', session['replay'] == replay)
    check(name + ' replay initial save', replay['initial'] == initial)
    check(name + ' raw formats and schemas',
          session['format'] == schema['sessionFormat'] and session['version'] == 1 and
          save['format'] == schema['saveFormat'] and save['version'] == 4 and
          replay['format'] == schema['replayFormat'] and replay['version'] == 1 and
          replay['checksumVersion'] == 4 and replay['simulationRevision'] == '4.0.1' and
          replay['initial']['version'] == 4)
    check(name + ' endpoint tick and checksum',
          state['tick'] == replay['finalTick'] == result['tick'] == result['fullReplayAdvancedTicks'] and
          replay['finalChecksum'] == result['checksum'])
    check(name + ' actual complete-save SHA', sha(read(PROOF / save_path)) == result['authoritativeSha256'])
    check(name + ' raw winner and objectives',
          state['winner'] == result['winner'] and state['winningTeam'] == result['winningTeam'] and
          state['objectives'] == result['objectives'])
    check(name + ' natural .05 ticks without manual replay commands',
          replay['actions'] == [{'type': 'advance', 'dt': 0.05, 'ticks': state['tick']}])
    check(name + ' unmodified small seed', result['config']['map'] == {'seed': 4127, 'size': 'small'} and state['seed'] == 4127)
    check(name + ' passed continuation/history/seek reports',
          all(result[flag] is True for flag in runtime_flags) and result['firstDifference'] is None)
    segments = result['continuationSegments']
    check(name + ' advancing continuation segment arithmetic',
          [segment['startTick'] for segment in segments] == result['resumeTicks'] and
          all(segment['endTick'] - segment['startTick'] == segment['comparedTicks'] > 0 for segment in segments) and
          all(left['endTick'] == right['startTick'] for left, right in zip(segments, segments[1:])) and
          segments[-1]['endTick'] == state['tick'] and
          sum(segment['comparedTicks'] for segment in segments) == result['comparedTicks'] == state['tick'] - 300)
    checkpoints = []
    for checkpoint_path in sorted((PROOF / 'runtime').glob(name + '-*.session.json')):
        checkpoint = json.loads(read(checkpoint_path))
        checkpoint_save = json.loads(read(checkpoint_path.with_name(checkpoint_path.name.replace('.session.json', '.save.json'))))
        game, archive = checkpoint['game'], checkpoint['replay']
        tick = game['state']['tick']
        check(checkpoint_path.name + ' full saved envelope and replay metadata',
              game == checkpoint_save and game['version'] == archive['initial']['version'] == 4 and
              archive['checksumVersion'] == 4 and archive['simulationRevision'] == '4.0.1' and
              archive['initial'] == initial and archive['finalTick'] == tick and
              archive['actions'] == [{'type': 'advance', 'dt': 0.05, 'ticks': tick}])
        # Exports at non-sample ticks append the current analysis sample. The
        # permanent samples before it must be retained in the final history.
        check(checkpoint_path.name + ' retained permanent history samples',
              archive['analysis'][:-1] == replay['analysis'][:len(archive['analysis']) - 1] and
              archive['analysis'][-1]['tick'] == tick and
              archive['technologies'] == replay['technologies'][:len(archive['technologies'])])
        checkpoints.append({'path': str(checkpoint_path), 'tick': tick,
                            'wave': game['state']['objectives']['survival']['wave'],
                            'phase': game['state']['objectives']['survival']['phase'],
                            'analysisSamples': len(archive['analysis']),
                            'technologyTimings': len(archive['technologies'])})
    check(name + ' raw checkpoint resume ticks', sorted(checkpoint['tick'] for checkpoint in checkpoints) == result['resumeTicks'])
    if name != 'survival-five-waves':
        check(name + ' objective victory before enemy HQ defeat',
              any(entity.get('role') == 'hq' and entity['hp'] > 0 and
                  state['teams'][entity['side']] != state['winningTeam'] for entity in state['entities']))
    else:
        check('survival natural five-wave endpoint',
              state['tick'] == 8190 and state['winner'] == state['winningTeam'] == 0 and
              state['objectives']['survival']['wave'] == 5 and state['objectives']['survival']['phase'] == 'complete')
        check('survival recovery checkpoints all four waves',
              sorted((checkpoint['wave'], checkpoint['tick']) for checkpoint in checkpoints if checkpoint['phase'] == 'recovery') ==
              [(1, 6554), (2, 6951), (3, 7348), (4, 7793)])
        check('survival reported natural spawns',
              [wave['wave'] for wave in result['waves']] == [1, 2, 3, 4, 5] and
              [wave['attackers'] for wave in result['waves']] == [1, 2, 3, 4, 5] and
              [wave['tick'] for wave in result['waves']] == [2400, 6854, 7251, 7648, 8093])
    runtime_facts.append({'name': name, 'sessionPath': str(PROOF / session_path),
                          'savePath': str(PROOF / save_path), 'replayPath': str(PROOF / replay_path),
                          'tick': state['tick'], 'winner': state['winner'], 'winningTeam': state['winningTeam'],
                          'checksum': replay['finalChecksum'], 'gameSaveSha256': result['authoritativeSha256'],
                          'saveVersion': save['version'], 'actualReplaySimulationRevision': replay['simulationRevision'],
                          'comparedTicks': result['comparedTicks'], 'resumeTicks': result['resumeTicks'],
                          'continuationSegments': segments, 'firstDifference': result['firstDifference'],
                          'reportedChecks': {flag: result[flag] for flag in runtime_flags},
                          'fullReplayAdvancedTicks': result['fullReplayAdvancedTicks'],
                          'analysisSamples': len(replay['analysis']), 'technologyTimings': len(replay['technologies']),
                          'manualReplayCommands': 0, 'checkpoints': checkpoints,
                          'survival': state['objectives']['survival'] if name.startswith('survival') else None})

native_facts = []
native_sessions = []
checker_path = 'scripts/controls-proof/verify-native.ts'
checker_hash = sha(read(CHECKOUT / checker_path))
native_flag_names = ['nativeDecoderPassed', 'completeEnvelopeRoundtripPassed', 'completeReplayEnvelopePassed',
                     'recomputedAnalysisPassed', 'technologyTimingsPassed', 'sourceUnchangedDuringVerification',
                     'bundleSourceBindingPassed']
continuation_flag_names = ['completeEnvelopeEqualityPassed', 'recorderEqualityPassed',
                          'allAcceptedContinuationCommandsRecorded', 'extendedReplayEqualityPassed']
for name in ['local-custom-hill', 'local-build-report']:
    session_relative = 'browser/' + name + '.session.json'
    verification_relative = 'native/' + name + '.session.verification.json'
    session = load(session_relative)
    verification = load(verification_relative)
    native_sessions.append(session)
    game, replay, continuation = session['game'], session['replay'], verification['continuation']
    check(name + ' native input actual schema',
          game['version'] == replay['initial']['version'] == replay['checksumVersion'] == 4 and
          replay['simulationRevision'] == '4.0.1' and session['version'] == replay['version'] == 1)
    input_hash = sha(read(PROOF / session_relative))
    check(name + ' native input hash and path',
          verification['inputPath'] == str(PROOF / session_relative) and verification['inputSha256'] == input_hash)
    check(name + ' input hash in browser and final manifests',
          browser_manifest['artifacts'][name + '.session.json']['sha256'] == input_hash and
          final_manifest['artifacts'][session_relative]['sha256'] == input_hash)
    check(name + ' actual game envelope hash', raw_game_hash(PROOF / session_relative) == verification['gameEnvelopeSha256'])
    check(name + ' native verification pin and schema',
          verification['result'] == 'passed' and verification['sourcePin'] == PIN and
          verification['saveVersion'] == 4 and verification['simulationRevision'] == '4.0.1')
    check(name + ' checker and executed bundle hashes',
          verification['checkerScriptPath'] == checker_path and verification['checkerScriptSha256'] == checker_hash and
          verification['executedBundlePath'] == str(PROOF / 'modules/verify-native.mjs') and
          verification['executedBundleSha256'] == module_facts['verify-native.mjs']['sha256'])
    source = verification['sourceProvenance']
    check(name + ' native source provenance pin/digest/build',
          source['sourcePin'] == PIN and source['digest'] == digest and source['buildId'] == build_id and
          source['sourceFileCount'] == 163 and source['configFileCount'] == 7 and len(source['files']) == 170)
    check(name + ' native source provenance raw file hashes',
          all(entry['bytesMatchGit'] is True and all(entry[key] == source_config[entry['path']][key]
              for key in ['bytes', 'sha256', 'gitBlob']) for entry in source['files']))
    check(name + ' native whole-envelope/history reports', all(verification[flag] is True for flag in native_flag_names))
    check(name + ' replay and game endpoints', game['state']['tick'] == replay['finalTick'] == verification['finalTick'] == 40 and
          verification['initialTick'] == 0 and verification['advanced'] == 40 and
          verification['checksum'] == replay['finalChecksum'] == '2ffb6370')
    command_entries = [{'replayActionIndex': index, **action} for index, action in enumerate(replay['actions']) if action['type'] == 'command']
    check(name + ' raw accepted browser history commands',
          verification['acceptedCommandEntries'] == command_entries and
          verification['acceptedCommands'] == [entry['command'] for entry in command_entries] and
          [entry['command']['type'] for entry in command_entries] == ['draftChoice', 'move'])
    commands = continuation['commands']
    check(name + ' six native continuation commands and queued fourth',
          [command['type'] for command in commands] == ['hold', 'stop', 'move', 'move', 'hold', 'stop'] and
          commands[2]['queued'] is False and commands[3]['queued'] is True and
          all(command['ids'] == [continuation['actorId']] for command in commands))
    check(name + ' 100 normal .05 advancing native ticks',
          continuation['startTick'] == 40 and continuation['finalTick'] == 140 and
          continuation['advancedTicks'] == 100 and continuation['timestep'] == 0.05 and
          continuation['movementPhaseTicks'] == 60 and continuation['maxActorDisplacement'] > 0.01)
    check(name + ' whole envelope and recorder continuation reports',
          all(continuation[flag] is True for flag in continuation_flag_names))
    expected_phases = ['command-1-hold', 'held', 'command-2-stop', 'stopped', 'command-3-move',
                       'command-4-move', 'moving', 'command-5-hold', 'held-again', 'command-6-stop', 'stopped-again']
    check(name + ' retained command and advancing checkpoint hashes',
          [item['phase'] for item in continuation['checkpointHashes']] == expected_phases and
          [item['tick'] for item in continuation['checkpointHashes']] == [40, 45, 45, 50, 50, 50, 110, 110, 115, 115, 140] and
          all(re.fullmatch('[a-f0-9]{64}', item['gameSha256']) for item in continuation['checkpointHashes']) and
          continuation['checkpointHashes'][4]['gameSha256'] != continuation['checkpointHashes'][5]['gameSha256'])
    native_facts.append({'inputPath': str(PROOF / session_relative), 'verificationPath': str(PROOF / verification_relative),
                         'inputSha256': input_hash, 'actualGameVersion': game['version'],
                         'actualReplaySimulationRevision': replay['simulationRevision'], 'finalTick': verification['finalTick'],
                         'rawBrowserCommandCount': len(command_entries), 'continuationCommandCount': len(commands),
                         'continuationCommandTypes': [command['type'] for command in commands],
                         'fourthContinuationCommandQueued': commands[3]['queued'],
                         'continuationStartTick': continuation['startTick'], 'continuationFinalTick': continuation['finalTick'],
                         'normalTicks': continuation['advancedTicks'], 'timestep': continuation['timestep'],
                         'movementTicks': continuation['movementPhaseTicks'], 'displacement': continuation['maxActorDisplacement'],
                         'checkerScriptSha256': checker_hash, 'executedBundleSha256': verification['executedBundleSha256'],
                         'reportedEnvelopeHistoryChecks': {flag: continuation[flag] for flag in continuation_flag_names}})
check('both raw browser native sessions equal', native_sessions[0] == native_sessions[1])
bug_report = load('browser/local-build-report.json')
check('bug report raw native session export', bug_report['session'] == native_sessions[1])
strict_arrays = ['pageErrors', 'consoleErrors', 'failedRequests', 'httpErrors', 'errors']
check('all strict browser error arrays empty', all(browser[array] == [] for array in strict_arrays))
browser_common_text = read(CHECKOUT / 'scripts/controls-proof/browser-common.mjs').decode()
check('pinned browser observer collects every HTTP status at least 400',
      "if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});" in browser_common_text)
check('pinned browser finalization requires all four observer arrays empty',
      "for(const key of ['pageErrors','consoleErrors','failedRequests','httpErrors'])assert.deepEqual(report[key]??[],[],`${key} must be empty`);" in browser_common_text)
check('browser reported closed and passed', browser['result'] == 'passed' and browser['browserClosed'] is True)
check('three real browser profiles', [build['profile'] for build in browser['builds']] == ['local-custom-hill', 'host', 'guest'])
check('served compiled chunks unchanged', browser['chunksBefore'] == browser['chunksAfter'])
check('four original launcher steps all passed',
      [step['name'] for step in launcher['steps']] == ['natural-matches', 'main-browser',
      'native-local-custom-hill.session', 'native-local-build-report.session'] and
      all(step['result'] == 'passed' and step['finishedAt'] >= step['startedAt'] for step in launcher['steps']))
check('original natural step arguments', launcher['steps'][0]['args'] == [str(PROOF / 'modules/verify-runtime.mjs')])
check('original browser step arguments', launcher['steps'][1]['args'] ==
      ['scripts/verify_assembled_modes.mjs', 'http://127.0.0.1:9241/', PIN, str(PROOF / 'browser')])
check('original launcher final pass and closure', launcher['result'] == final_manifest['result'] == 'passed' and
      launcher['serverClosed'] is True and final_manifest['serverClosed'] is True and
      launcher['server']['exitCode'] == 0 and launcher['server']['signal'] is None)
for index, fact in enumerate(native_facts, 2):
    check('original native step arguments ' + str(index), launcher['steps'][index]['args'] ==
          [str(PROOF / 'modules/verify-native.mjs'), fact['inputPath'], fact['verificationPath'], PIN])

external = {name: json.loads(read(path)) for name, path in EXTERNAL.items()}
postflight = external['originalPostflight']
check('original external structural/hash postflight passed',
      postflight['result'] == 'passed structural/hash audit' and postflight['sourcePin'] == PIN and
      postflight['simulationsExecuted'] is False and postflight['nativeContinuations'] == 2 and
      postflight['browserProfiles'] == 3 and postflight['artifactCount'] == 478)
check('original postflight terminal inventory hashes',
      postflight['finalManifestSha256'] == sha(read(PROOF / 'final-manifest.json')) and
      postflight['finalHashesTsvSha256'] == sha(read(PROOF / 'final-hashes.tsv')))
failure = external['firstCleanupObserverFailure']
later = external['laterCleanupObservation']
check('first failed bind observation retained separately',
      failure['cleanupObserverResult'] == 'failed direct temporary bind' and failure['errno'] == 98 and
      failure['acceptanceToolExitCode'] == 0 and failure['launcherResult'] == 'passed' and
      failure['originalExternalPostflightToolExitCode'] == 0 and failure['acceptanceRerun'] is False and
      failure['sourceChanged'] is False)
check('later closure observation retains failed-bind path',
      later['earlierBindFailurePreserved'] == str(EXTERNAL['firstCleanupObserverFailure']) and
      later['earlierBindFailureCause'] == 'not observed; no attribution asserted' and
      later['acceptanceRerun'] is False and later['sourceChange'] is False and
      later['result'] == 'passed direct current cleanup' and later['pidDirectlyAbsent'] is True and
      later['connectEx'] == 111 and later['directBindWithoutReusePassed'] is True)

crosscheck_path = pathlib.Path('/tmp/ovf-browser-native-audit.mhyy7e05/audit.json')
crosscheck_bytes = read(crosscheck_path)
crosscheck = json.loads(crosscheck_bytes)
crosscheck_sha = sha(crosscheck_bytes)
check('independent browser native readback output',
      crosscheck_sha == 'd4a8ae54d90e2a9c1e511c46399d4be72bf50705083be9e14ad5075bc4d3142d' and
      crosscheck['result'] == 'passed' and crosscheck['sourcePin'] == PIN and
      crosscheck['rawExportsParsedEqualityPassed'] is True and crosscheck['retainedFilesUnchangedDuringAudit'] is True)
for path, fact in list(read_files.items()):
    relative = None
    try:
        relative = str(pathlib.Path(path).relative_to(PROOF))
    except ValueError:
        pass
    if relative in final_manifest['artifacts']:
        expected = final_manifest['artifacts'][relative]
        check('read payload retained in final inventory ' + relative,
              fact['bytes'] == expected['bytes'] and fact['sha256'] == expected['sha256'])
check('all read evidence/source files unchanged throughout readback',
      all(sha(pathlib.Path(path).read_bytes()) == fact['sha256'] for path, fact in read_files.items()))

failed = [item for item in checks if not item['passed']]
audit = {
    'result': 'passed retained payload/hash readback' if not failed else 'failed retained payload/hash readback',
    'recordedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourcePin': PIN, 'proofRoot': str(PROOF), 'retainedCheckout': str(CHECKOUT),
    'productExecutionPerformed': False, 'proofFilesChanged': False,
    'sourceDigest': digest, 'buildId': build_id,
    'inputCounts': {category: len(prepared['provenance'][category]) for category in categories},
    'uniqueInputCount': len(inputs), 'modules': module_facts,
    'runtimePayloads': runtime_facts, 'nativeBrowserPayloads': native_facts,
    'browser': {'profiles': [build['profile'] for build in browser['builds']],
                'strictErrorArrays': {array: browser[array] for array in strict_arrays},
                'checkCount': len(browser['checks']), 'closed': browser['browserClosed']},
    'originalLauncherSteps': launcher['steps'],
    'originalPostflight': {'path': str(EXTERNAL['originalPostflight']), **postflight},
    'separateCleanupObservations': {name: {'path': str(EXTERNAL[name]), 'record': external[name]}
                                  for name in ['firstCleanupObserverFailure', 'laterCleanupObservation']},
    'checksPassed': len(checks) - len(failed), 'checksTotal': len(checks), 'failedChecks': failed,
    'independentBrowserNativeCrosscheck': {'path': str(crosscheck_path), 'sha256': crosscheck_sha, 'result': crosscheck['result']},
    'checks': checks,
    'limits': [
        'This audit parses, compares and hashes retained bytes. It does not independently rerun simulation, replay, browser, server, HTTP, tests or builds.',
        'Continuation/history/seek behavioral equality is established by the retained passing original reports and the pinned checker assertions. This audit verifies their raw inputs, reported metrics and hash bindings.',
        'Native continuation reports contain the six continuation commands; each raw browser replay contains two prior browser commands.',
        'Off-sample survival checkpoint exports contain a current endpoint analysis sample. Permanent prior samples and technologies agree with final history; no assertion treats the transient endpoint sample as a final-history prefix.',
        'The first failed temporary bind is a separate preserved observer failure. Its cause was not observed. It does not change the passed launcher or original structural/hash postflight.',
        'Screenshot visual review and complete sealed-packet inventory are handled by the parent audit.',
    ],
}
(OUT / 'audit.json').write_text(json.dumps(audit, indent=2) + '\n')
(OUT / 'read-files.json').write_text(json.dumps(read_files, indent=2) + '\n')
print(json.dumps({'audit': str(OUT / 'audit.json'), 'result': audit['result'],
                  'checksPassed': audit['checksPassed'], 'checksTotal': len(checks),
                  'failedChecks': failed, 'filesRead': len(read_files)}, indent=2))
