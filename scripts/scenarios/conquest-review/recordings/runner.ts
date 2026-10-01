import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createConquestProfile, prepareConquestBattle, completeConquestBattle, checkpointConquestBattle, decodeConquestProfile } from '@proof/src/core/conquest';
import { issueScenarioCommand, captureScenario, stepScenario } from '@proof/src/core/scenarios';
import { scenarioChecksum, scenarioStateEquals, verifyScenarioRecording } from '@proof/src/core/scenario-recordings';
import { steerConquest } from '@proof/scripts/scenarios/conquest-strategy';

const archiveDirectory = process.env.PRIVATE_ARCHIVE_DIR!;
assert(archiveDirectory, 'PRIVATE_ARCHIVE_DIR is required');
const recordingDirectory = join(archiveDirectory, 'recordings');
mkdirSync(recordingDirectory, { recursive: true });
const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceManifest = JSON.parse(readFileSync(join(archiveDirectory, 'source-manifest.json'), 'utf8'));
const battles: Array<Record<string, unknown>> = [];
writeFileSync(join(archiveDirectory, 'battles.jsonl'), '');
for (const faction of ['orcs','fairies','dwarves','undead','tideborn','automata'] as const) {
  let profile = createConquestProfile(faction, `review-${faction}`);
  for (const region of ['quarry','crossroads','coast','keep','crypt','grove']) {
    const run = prepareConquestBattle(profile, region);
    profile = run.profile;
    const initialChecksum = scenarioChecksum(run.session);
    const checkpointComparisons: Array<Record<string, unknown>> = [];
    while (run.session.runtime.outcome === 'playing') {
      steerConquest(run.session);
      stepScenario(run.session);
      if (run.session.state.tick % 200 === 0) {
        const saved = checkpointConquestBattle(profile, run.session, run.recorder);
        const resumed = prepareConquestBattle(decodeConquestProfile(JSON.stringify(saved)), region);
        assert(scenarioStateEquals(resumed.session, run.session), 'resume state differs');
        const archive = run.recorder.archive();
        assert(scenarioStateEquals(verifyScenarioRecording(archive), run.session), 'checkpoint replay state differs');
        const tick = run.session.state.tick;
        const checkpointSha256 = sha256(captureScenario(run.session));
        const ids = run.session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0).map(e => e.id);
        if (run.session.runtime.outcome === 'playing') {
          for (const candidate of [run.session,resumed.session]) assert(issueScenarioCommand(candidate, 0, {type:'hold',ids}), 'hold command rejected');
        }
        for (let i=0; i<5 && run.session.runtime.outcome==='playing'; i++) {
          stepScenario(run.session);
          stepScenario(resumed.session);
        }
        assert(scenarioStateEquals(resumed.session, run.session), 'continued state differs');
        assert(scenarioStateEquals(verifyScenarioRecording(resumed.recorder.archive()), resumed.session), 'continued recording differs');
        resumed.recorder.destroy();
        checkpointComparisons.push({tick,checkpointSha256,continuedTick:run.session.state.tick,continuedCheckpointSha256:sha256(captureScenario(run.session)),assertions:{savedStateEquals:true,recordingReplayEquals:true,continuedStateEquals:true,continuedRecordingEquals:true}});
      }
    }
    const recording = run.recorder.archive();
    run.recorder.destroy();
    assert(scenarioStateEquals(verifyScenarioRecording(recording), run.session), 'final recording state differs');
    const completed = completeConquestBattle(profile, run.session, recording);
    assert.strictEqual(completeConquestBattle(completed, run.session, recording), completed, 'completion is not idempotent');
    profile = decodeConquestProfile(JSON.stringify(completed));
    assert.deepEqual(profile, completed, 'decoded completed profile differs');
    const recordingFile = `${faction}-${region}.json`;
    const recordingText = JSON.stringify(recording) + '\n';
    writeFileSync(join(recordingDirectory, recordingFile), recordingText);
    const battle = {
      faction,region,outcome:run.session.runtime.outcome,tick:run.session.state.tick,commands:recording.commands.length,
      resumedCount:checkpointComparisons.length,history:profile.history.length,initialChecksum,finalChecksum:recording.finalChecksum,
      recording:{privateRelativePath:`recordings/${recordingFile}`,sha256:createHash('sha256').update(recordingText).digest('hex'),bytes:Buffer.byteLength(recordingText)},
      finalCheckpointSha256:sha256(captureScenario(run.session)),profileSha256:sha256(profile),checkpointComparisons,
      assertions:{finalRecordingEquals:true,completionIdempotent:true,completedProfileRoundtrip:true},
    };
    battles.push(battle);
    writeFileSync(join(archiveDirectory, 'battles.jsonl'), JSON.stringify(battle)+'\n', {flag:'a'});
    process.stdout.write(JSON.stringify({faction,region,outcome:battle.outcome,tick:battle.tick,resumedCount:battle.resumedCount})+'\n');
    if (run.session.runtime.outcome !== 'won') break;
  }
}
const summary = {
  schemaVersion:1,proof:'conquest recording resume and reconstruction',sourceRevision:sourceManifest.sourceRevision,
  sourceManifestSha256:createHash('sha256').update(readFileSync(join(archiveDirectory, 'source-manifest.json'))).digest('hex'),
  runnerSha256:sourceManifest.runnerSha256,
  totals:{battles:battles.length,checkpointComparisons:battles.reduce((sum,battle)=>sum+Number(battle.resumedCount),0),factions:6},
  assertions:{recordingsVerified:true,checkpointResumesEqual:true,resumedRecordingsVerified:true,profilesRoundtrip:true,completionIdempotent:true},
  battles,
};
writeFileSync(join(archiveDirectory, 'summary.json'), JSON.stringify(summary,null,2)+'\n');
process.stdout.write(JSON.stringify({summary:join(archiveDirectory,'summary.json'),totals:summary.totals,assertions:summary.assertions})+'\n');
