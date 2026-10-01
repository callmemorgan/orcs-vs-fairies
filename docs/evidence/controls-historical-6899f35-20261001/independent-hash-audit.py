#!/usr/bin/env python3
"""Read historical bytes and Git blobs; never import or advance game code."""
import datetime
import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile

ARCHIVE = pathlib.Path('/tmp/ovf-controls-6899f35.oZddGk')
EVIDENCE = ARCHIVE / 'control-evidence'
REPO = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
PIN = '6899f35ae1e8d8b08781005bf766b9bcce2755b6'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read_json(path):
    return json.loads(path.read_bytes())

def git(*args):
    return subprocess.check_output(['git', '-C', str(REPO), *args])

def snapshot(root):
    return {p.relative_to(root).as_posix(): sha(p.read_bytes())
            for p in sorted(root.rglob('*')) if p.is_file()}

evidence_before = snapshot(EVIDENCE)
resolved_pin = git('rev-parse', PIN).decode().strip()
tree = {}
for entry in git('ls-tree', '-r', '-z', PIN).split(b'\0'):
    if not entry:
        continue
    metadata, path = entry.split(b'\t', 1)
    mode, kind, oid = metadata.decode().split(' ')
    tree[path.decode()] = {'mode': mode, 'kind': kind, 'blob': oid}

git_blobs = {}
def blob(path):
    if path not in git_blobs:
        git_blobs[path] = git('cat-file', 'blob', tree[path]['blob'])
    return git_blobs[path]

def verify_manifest(paths, base, compare_git=False):
    files = []
    for path, expected in sorted(paths.items()):
        expected_bytes = expected.get('bytes') if isinstance(expected, dict) else None
        expected_hash = expected['sha256'] if isinstance(expected, dict) else expected
        local = base / path
        present = local.is_file()
        data = local.read_bytes() if present else b''
        item = {'path': path, 'present': present,
                'bytes': len(data) if present else None,
                'expectedSha256': expected_hash,
                'expectedBytes': expected_bytes,
                'actualSha256': sha(data) if present else None,
                'hashMatches': present and sha(data) == expected_hash,
                'bytesMatchExpected': expected_bytes is None or present and len(data) == expected_bytes}
        if compare_git:
            item['gitBlob'] = tree.get(path, {}).get('blob')
            item['gitSha256'] = sha(blob(path)) if path in tree else None
            item['bytesMatchGit'] = present and path in tree and data == blob(path)
            item['fileTypeMatchesGit'] = path in tree and tree[path]['mode'] == '100644' and not local.is_symlink()
        files.append(item)
    return {'count': len(files), 'passed': all(x['hashMatches'] and x['bytesMatchExpected'] and
            (not compare_git or x['bytesMatchGit'] and x['fileTypeMatchesGit'])
            for x in files), 'failures': [x for x in files if not x['hashMatches'] or not x['bytesMatchExpected'] or
            compare_git and not (x['bytesMatchGit'] and x['fileTypeMatchesGit'])],
            'files': files}

def aggregate_manifest(files):
    return sha(''.join(f"{x['path']}\0{x['sha256']}\n" for x in sorted(files, key=lambda x:x['path'])).encode())

source = read_json(EVIDENCE / 'source-manifest.json')
saves = read_json(EVIDENCE / 'saves/manifest.json')
display_manifest = read_json(EVIDENCE / 'saves/display/evidence-manifest.json')
integrity = read_json(EVIDENCE / 'saves/display/source-integrity.json')
pin_check = read_json(EVIDENCE / 'saves/archive-pin-check.json')
old_audit = read_json(EVIDENCE / 'audit.json')

source_check = verify_manifest(source['sourceFileHashes'], ARCHIVE, True)
saves_source_check = verify_manifest(saves['sourceFiles'], ARCHIVE, True)
saves_compiled_check = verify_manifest(saves['compiled'], ARCHIVE / 'dist')
saves_artifacts_check = verify_manifest(saves['artifacts'], EVIDENCE / 'saves')
ledger_check = verify_manifest({'docs/features/requirements.json': saves['ledgerHash']}, ARCHIVE, True)
pin_archive_check = verify_manifest({p:v['sha256'] for p,v in pin_check['files'].items()}, ARCHIVE, True)
for item in pin_archive_check['files']:
    item['recordedBlobMatchesGit'] = item['gitBlob'] == pin_check['files'][item['path']]['gitBlob']
pin_archive_check['passed'] = pin_archive_check['passed'] and all(x['recordedBlobMatchesGit'] for x in pin_archive_check['files'])

display_evidence_check = verify_manifest(display_manifest['files'], EVIDENCE / 'saves/display')
display_source_check = verify_manifest({x['path']:x['sha256'] for x in integrity['source']['files']}, ARCHIVE, True)
display_build_input_check = verify_manifest({x['path']:x['sha256'] for x in integrity['buildInputs']}, ARCHIVE, True)
display_dist_check = verify_manifest({x['path']:x['sha256'] for x in integrity['dist']['files']}, ARCHIVE)
actual_src = {p.relative_to(ARCHIVE).as_posix() for p in (ARCHIVE / 'src').rglob('*') if p.is_file()}
git_src = {p for p in tree if p.startswith('src/') and tree[p]['kind'] == 'blob'}
actual_dist = {p.relative_to(ARCHIVE).as_posix() for p in (ARCHIVE / 'dist').rglob('*') if p.is_file()}
recorded_src = {x['path'] for x in integrity['source']['files']}
recorded_dist = {x['path'] for x in integrity['dist']['files']}
display_sets = {'archiveSourceCount': len(actual_src), 'gitSourceCount': len(git_src),
                'recordedSourceCount': len(recorded_src),
                'missingSource': sorted(git_src - actual_src),
                'extraSource': sorted(actual_src - git_src),
                'sourceManifestMatchesActualSet': recorded_src == actual_src,
                'actualDistCount': len(actual_dist), 'recordedDistCount': len(recorded_dist),
                'distManifestMatchesActualSet': actual_dist == recorded_dist}
display_aggregates = {}
for name, entries in [('source', integrity['source']['files']), ('dist', integrity['dist']['files'])]:
    actual_entries = [{'path':x['path'], 'sha256':sha((ARCHIVE/x['path']).read_bytes())} for x in entries]
    value = aggregate_manifest(actual_entries)
    display_aggregates[name] = {'actualSha256': value, 'expectedSha256':integrity[name]['manifestSha256'],
                                'matches':value == integrity[name]['manifestSha256'],
                                'actualBytes':sum((ARCHIVE/x['path']).stat().st_size for x in entries),
                                'recordedBytes':integrity[name]['totalBytes']}

build_hash = hashlib.sha256()
git_build_hash = hashlib.sha256()
for path in sorted(saves['sourceFiles']):
    relative = path.removeprefix('src/')
    build_hash.update(relative.encode()); build_hash.update((ARCHIVE / path).read_bytes())
    git_build_hash.update(relative.encode()); git_build_hash.update(blob(path))
build = {'sourceInputCount':len(saves['sourceFiles']), 'actual':build_hash.hexdigest(),
         'git':git_build_hash.hexdigest(), 'recorded':saves['buildId'],
         'allMatch':build_hash.hexdigest() == git_build_hash.hexdigest() == saves['buildId'] == integrity['sourceBuildID']['value']}
build['compiledOccurrences'] = [{'path':x['path'], 'actualOccurrences':(ARCHIVE/x['path']).read_bytes().count(build['actual'].encode()),
                                'recordedOccurrences':x['occurrences']} for x in integrity['sourceBuildID']['compiledOccurrences']]

served = []
for response in integrity['served']['responses']:
    actual = sha((ARCHIVE / response['localPath']).read_bytes())
    served.append({'path':response['path'], 'localPath':response['localPath'],
                   'actualLocalSha256':actual, 'recordedResponseSha256':response['sha256'],
                   'recordedLocalSha256':response['localSha256'],
                   'localMatchesRecordedResponse':actual == response['sha256'] == response['localSha256'],
                   'note':'Historical response digest only; no HTTP request was performed by this audit.'})

node_code = r'''
const fs = require('fs'); const crypto = require('crypto');
const root = process.argv[1]; const read = p => JSON.parse(fs.readFileSync(`${root}/${p}`,'utf8'));
const sha = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const checksum = saved => { const text=JSON.stringify(saved); let hash=2166136261; for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0'); };
const summary = (path, file) => ({path,format:file.format,sessionVersion:file.version,gameFormat:file.game.format,saveVersion:file.game.version,tick:file.game.state.tick,time:file.game.state.time,gameSha256:sha(file.game),savedEnvelopeChecksum:checksum(file.game),replayFinalTick:file.replay?.finalTick,replayFinalChecksum:file.replay?.finalChecksum,checksumMatches:file.replay?.finalChecksum===checksum(file.game),checksumVersion:file.replay?.checksumVersion,simulationRevision:file.replay?.simulationRevision});
const manualPath='saves/native-manual.json', manual=read(manualPath);
const manualSummary=summary(manualPath,manual);
const comparisons=['saves/native-loaded.json','saves/native-after-rejected-import.json','saves/native-imported-fresh-browser.json'].map(path=>{const file=read(path);return {...summary(path,file),gameEnvelopeEqualsManual:JSON.stringify(file.game)===JSON.stringify(manual.game),entireSessionEqualsManual:JSON.stringify(file)===JSON.stringify(manual)};});
const pagehidePath='saves/native-pagehide-autosave.json', pagehide=read(pagehidePath), recoveredPath='saves/native-recovered-autosave.json', recovered=read(recoveredPath);
const recovery={checkpoint:summary(pagehidePath,pagehide),recovered:summary(recoveredPath,recovered),gameEnvelopeEqual:JSON.stringify(pagehide.game)===JSON.stringify(recovered.game),entireSessionEqual:JSON.stringify(pagehide)===JSON.stringify(recovered)};
const buildReport=read('saves/native-build-report.json');
const generations=[1,2,3].map(generation=>{const file=read(`saves/native-store-generation-${generation}.json`);const slots=file.slots;return {generation,storeVersion:file.version,slots:slots.map(slot=>({id:slot.id,autosave:slot.autosave,tick:slot.file.game.state.tick,time:slot.file.game.state.time,gameSha256:sha(slot.file.game),manualEqualsNamed:!slot.autosave?JSON.stringify(slot.file.game)===JSON.stringify(manual.game):null,saveVersion:slot.file.game.version}))};});
const gpPath='gamepad/gamepad-native-session.json', gp=read(gpPath), proof=read('gamepad/gamepad-primary-proof.json'), verification=read('gamepad/native-verification.json');
const commands=gp.replay.actions.filter(x=>x.type==='command').map(x=>x.command);
const gamepad={...summary(gpPath,gp),commands,commandCount:commands.length,commandsEqualProof:JSON.stringify(commands)===JSON.stringify(proof.commands),commandsEqualNativeVerification:JSON.stringify(commands)===JSON.stringify(verification.acceptedCommands),recordedVerification:verification,primaryEvidenceCount:Object.keys(proof.evidence).length,primaryActionCount:proof.actions.length,primaryFinalTick:proof.final.tick,inputMethod:proof.source.input,advanceTickSum:gp.replay.actions.filter(x=>x.type==='advance').reduce((n,x)=>n+x.ticks,0),initialTick:gp.replay.initial.state.tick,exactReplayClaim:'Retained historical verifier result, not independently replayed in this audit.'};
process.stdout.write(JSON.stringify({manual:manualSummary,manualComparisons:comparisons,recovery,generations,bugReport:{versions:buildReport.versions,sessionEqualsManual:JSON.stringify(buildReport.session)===JSON.stringify(manual),gameEqualsManual:JSON.stringify(buildReport.session.game)===JSON.stringify(manual.game)},gamepad}));
'''
native = json.loads(subprocess.check_output(['node', '-e', node_code, str(EVIDENCE)]))

evidence_after = snapshot(EVIDENCE)
checks = [source_check,saves_source_check,saves_compiled_check,saves_artifacts_check,ledger_check,
          pin_archive_check,display_evidence_check,display_source_check,display_build_input_check,display_dist_check]
native_pass = native['manual']['tick'] == 10 and native['manual']['saveVersion'] == 3 and all(
    x['gameEnvelopeEqualsManual'] and x['tick'] == 10 and x['saveVersion'] == 3 and x['checksumMatches']
    for x in native['manualComparisons']) and native['recovery']['gameEnvelopeEqual'] and all(
    native['recovery'][x]['tick'] == 1828 and native['recovery'][x]['saveVersion'] == 3 and native['recovery'][x]['checksumMatches']
    for x in ['checkpoint','recovered']) and native['gamepad']['tick'] == 100 and native['gamepad']['savedEnvelopeChecksum'] == 'a617077e' and native['gamepad']['checksumMatches'] and native['gamepad']['commandCount'] == 6 and native['gamepad']['commandsEqualProof'] and native['gamepad']['commandsEqualNativeVerification']
recorded_pins = {'resolvedGit':resolved_pin,'sourceManifest':source['sourceCommit'],'savesManifest':saves['pin'],
                 'displayManifest':display_manifest['sourcePin'],'displayIntegrity':integrity['resolvedPin'],
                 'archivePinCheck':pin_check['pin'],'archiveAudit':old_audit['sourcePin']}
pins_pass = all(value == PIN for value in recorded_pins.values())
passed = all(x['passed'] for x in checks) and pins_pass and build['allMatch'] and all(x['matches'] for x in display_aggregates.values()) and native_pass and evidence_before == evidence_after and actual_src == git_src == recorded_src and actual_dist == recorded_dist and all(x['localMatchesRecordedResponse'] for x in served)

out = pathlib.Path(tempfile.mkdtemp(prefix='ovf-controls-6899f35-historical-audit-'))
shutil.copyfile(__file__, out / 'audit.py')
report = {
    'schemaVersion':1,'auditedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'archive':str(ARCHIVE),'evidence':str(EVIDENCE),'repository':str(REPO),
    'sourcePin':PIN,'resolvedPin':resolved_pin,'scope':'Historical source 6899f35 / SAVE3 / simulation 3.2.0; byte audit only.',
    'passed':passed,'recordedPins':recorded_pins,
    'counts':{'sourceManifest':len(source['sourceFileHashes']),'sourceManifestBreakdown':{'src':sum(p.startswith('src/') for p in source['sourceFileHashes']),'config':2,'ledger':1},
              'savesManifest':len(saves['sourceFiles'])+len(saves['compiled'])+len(saves['artifacts'])+1,
              'savesManifestBreakdown':{'source':len(saves['sourceFiles']),'compiled':len(saves['compiled']),'artifacts':len(saves['artifacts']),'ledger':1},
              'archivePinCheck':len(pin_check['files']),
              'displayEvidenceManifest':len(display_manifest['files']),
              'displaySourceIntegrity':{'source':len(integrity['source']['files']),'buildInputs':len(integrity['buildInputs']),'dist':len(integrity['dist']['files']),'historicalResponseDigests':len(served)},
              'evidenceFiles':len(evidence_before),
              'historicallyRecordedCoverage':old_audit['counts']},
    'sourceOnlyComparedWithSaves':sorted(set(source['sourceFileHashes'])-set(saves['sourceFiles'])),
    'sourceManifest':source_check,
    'savesManifest':{'source':saves_source_check,'compiled':saves_compiled_check,'artifacts':saves_artifacts_check,'ledger':ledger_check},
    'archivePinCheck':pin_archive_check,
    'display':{'evidenceManifest':display_evidence_check,'sourceIntegrity':display_source_check,
               'buildInputs':display_build_input_check,'dist':display_dist_check,'sets':display_sets,
               'aggregateManifests':display_aggregates,'historicalServedDigests':served},
    'buildId':build,'nativeEnvelopes':native,
    'evidenceImmutability':{'unchangedDuringAudit':evidence_before==evidence_after,'before':evidence_before,'after':evidence_after},
    'historicalFeatureFindings':old_audit['features'],
    'limits':[
      'No browser, server, build, decoder, ReplayPlayer or simulation was run. Native game-envelope equality and checksum were compared directly from recorded JSON.',
      'The saved-envelope checksum uses the historical FNV-1a JSON.stringify algorithm. Exact replay is a retained historical result, not a new independent replay proof.',
      'The controller evidence injects a virtual standard controller at navigator.getGamepads; physical hardware and other mappings remain untested.',
      'SAVE3 historical evidence does not certify later SAVE4 schemas, source, compiled output or browser behavior.',
      'The 147 baseline tests in seven files were recorded at 45e4c63; they are not a new test run at 6899f35 or current source.',
      'Display source integrity confirms archived source/config bytes, dist hashes and recorded response hashes; no reproducible build or new HTTP response was checked.',
      'The historical feature-81 off-layer alert defect remains part of this pin. Later minimap fixes are outside this evidence.',
      'No repository, archive or ledger bytes were written; no feature status was promoted.'
    ]
}
(out/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'directory':str(out),'passed':passed,'counts':report['counts'],
                  'manifestFailures':sum(len(x['failures']) for x in checks),
                  'nativeChecksPass':native_pass,'evidenceUnchanged':evidence_before==evidence_after},indent=2))
