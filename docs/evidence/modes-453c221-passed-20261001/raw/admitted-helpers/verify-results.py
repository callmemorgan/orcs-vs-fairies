"""Read-only post-run checks; never imports or simulates the game."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

root=Path(sys.argv[1]).resolve()
pin=sys.argv[2]
read=lambda name:json.loads((root/name).read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
report=read('run.json')
assert report['result']=='passed' and report['sourcePin']==pin
assert report['schema']['saveVersion']==4 and report['schema']['simulationRevision']=='4.0.1'
steps=['natural-matches','main-browser','native-local-custom-hill.session','native-local-build-report.session']
assert [step['name'] for step in report['steps']]==steps
assert all(step['result']=='passed' for step in report['steps'])
assert report['serverClosed'] and report['server']['aliveBeforePlannedShutdown'] and report['server']['exitCode']==0
assert not report['listenersAfter'].splitlines()[1:]
assert not subprocess.check_output(['ss','-ltn',f"( sport = :{report['server']['port']} )"],text=True).splitlines()[1:]
assert all(key not in report for key in ['failure','cleanupFailure','interrupted'])

runtime=read('runtime/run.json')
assert runtime['result']=='passed' and runtime['sourcePin']==pin and runtime['cases']==5
assert runtime['saveVersion']==4 and runtime['simulationRevision']=='4.0.1' and runtime['completeEnvelopeContinuationPassed']
cases=read('runtime/runtime-results.json')
names=['hill-duel','relic-duel','relic-contested','hill-2v2','survival-five-waves']
assert [case['name'] for case in cases]==names
for case in cases:
    assert case['firstDifference'] is None and case['resumeTick']==300 and case['comparedTicks']>0
    assert all(case[key] for key in ['completeEnvelopeRoundtripPassed','completeReplayEnvelopePassed','continuedRecorderHistoryPassed','replaySeekEnvelopePassed'])
    assert case['fullReplayAdvancedTicks']>0
    assert case['continuationSegments'] and all(segment['comparedTicks']>0 and segment['endTick']>segment['startTick'] for segment in case['continuationSegments'])
    assert sum(segment['comparedTicks'] for segment in case['continuationSegments'])==case['comparedTicks']
    name=case['name']
    for suffix in ['-initial.save.json','-tick-300.save.json','-tick-300.session.json','.save.json','.session.json','.replay.json']:
        assert (root/'runtime'/f'{name}{suffix}').is_file()
    session=read(f'runtime/{name}.session.json')
    assert session['game']==read(f'runtime/{name}.save.json') and session['replay']==read(f'runtime/{name}.replay.json')
    assert session['game']['version']==4 and session['replay']['simulationRevision']=='4.0.1'
    assert session['game']['state']['tick']==case['tick']==session['replay']['finalTick']
    if name=='survival-five-waves':
        assert case['winningTeam']==0 and case['objectives']['survival']['wave']==5 and case['objectives']['survival']['phase']=='complete'
        assert len(case['waves'])==5 and [wave['wave'] for wave in case['waves']]==[1,2,3,4,5]
        assert len(case['resumeTicks'])==5
        for wave in range(1,5):
            for suffix in ['save.json','session.json']:
                assert (root/'runtime'/f'{name}-wave-{wave}-recovery.{suffix}').is_file()
    else:
        state=session['game']['state']
        assert any(entity['role']=='hq' and entity['hp']>0 and state['teams'][entity['side']]!=case['winningTeam'] for entity in state['entities'])

browser=read('browser/browser-proof.json')
assert browser['result']=='passed' and browser['sourcePin']==pin and browser['browserClosed']
assert browser['schema']['saveVersion']==4 and browser['schema']['simulationRevision']=='4.0.1'
assert all(not browser.get(key) for key in ['pageErrors','consoleErrors','failedRequests','httpErrors','errors','cleanupErrors','finalizationFailure'])
assert browser['chunksBefore']==browser['chunksAfter'] and browser['servedBefore']==browser['servedAfter']
assert len(browser['builds'])==3 and browser['buildId']==read('prepare.json')['provenance']['buildId']
for name in ['local-custom-hill.session.json','local-build-report.json','local-build-report.session.json','local-custom-hill.replay.json']:
    assert (root/'browser'/name).is_file()
screenshots=['local-custom-draft.png','local-hill-marker.png','hosted-relic-lobby.png','hosted-relic-collected.png','hosted-relic-marker.png','guest-relic-objectives.png']
for name in screenshots:assert (root/'browser'/name).is_file()
assert read('browser/manifest.json')['sourcePin']==pin
bug=read('browser/local-build-report.json')
assert bug['versions']['buildId']==browser['buildId'] and bug['versions']['save']==4 and bug['versions']['simulationRevision']=='4.0.1'
assert bug['session']==read('browser/local-build-report.session.json')
for stem in ['local-custom-hill.session','local-build-report.session']:
    native=read(f'native/{stem}.verification.json')
    assert native['result']=='passed' and native['sourcePin']==pin and native['saveVersion']==4 and native['simulationRevision']=='4.0.1'
    assert all(native[key] for key in ['sourceUnchangedDuringVerification','bundleSourceBindingPassed','nativeDecoderPassed','completeEnvelopeRoundtripPassed','completeReplayEnvelopePassed','recomputedAnalysisPassed','technologyTimingsPassed'])
    continuation=native['continuation']
    assert all(continuation[key] for key in ['completeEnvelopeEqualityPassed','recorderEqualityPassed','allAcceptedContinuationCommandsRecorded','extendedReplayEqualityPassed'])
    assert continuation['advancedTicks']==100 and continuation['timestep']==.05
    assert continuation['finalTick']-continuation['startTick']==100 and continuation['maxActorDisplacement']>.01
    assert [command['type'] for command in continuation['commands']]==['hold','stop','move','move','hold','stop']
    assert continuation['commands'][3]['queued']
    assert native['inputSha256']==sha((root/'browser'/f'{stem}.json').read_bytes())

manifest=read('final-manifest.json')
assert manifest['sourcePin']==pin and manifest['result']=='passed' and manifest['serverClosed']
artifacts=manifest['artifacts']
assert 'final-manifest.json' not in artifacts and 'final-hashes.tsv' not in artifacts
for name,entry in artifacts.items():
    path=root/name
    data=os.readlink(path).encode() if path.is_symlink() else path.read_bytes()
    assert len(data)==entry['bytes'] and sha(data)==entry['sha256'],name
    if path.is_symlink():assert os.readlink(path)==entry['symlink']
actual={str(path.relative_to(root)) for path in root.rglob('*') if path.is_file() or path.is_symlink()}
assert actual==set(artifacts)|{'final-manifest.json','final-hashes.tsv'}
rows=(root/'final-hashes.tsv').read_text().splitlines()
assert rows[0]=='sha256\tbytes\tpath'
assert {path:(digest,int(size)) for digest,size,path in (row.split('\t') for row in rows[1:])}=={name:(entry['sha256'],entry['bytes']) for name,entry in artifacts.items()}
print(json.dumps({'result':'passed structural/hash audit','sourcePin':pin,'simulationsExecuted':False,
                  'naturalCases':[{key:case[key] for key in ['name','tick','comparedTicks','resumeTicks']} for case in cases],
                  'nativeContinuations':2,'browserProfiles':3,'screenshotsToInspect':screenshots,
                  'artifactCount':len(artifacts),'serverClosed':True,
                  'finalManifestSha256':sha((root/'final-manifest.json').read_bytes()),
                  'finalHashesTsvSha256':sha((root/'final-hashes.tsv').read_bytes()),
                  'limits':['Inspect all six screenshots separately. This audit checks retained reports and bytes; it does not independently rerun behavior.']},indent=2))
