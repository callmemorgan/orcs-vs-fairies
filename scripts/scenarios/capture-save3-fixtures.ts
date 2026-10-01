import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCampaignProfile, prepareCampaignMission, checkpointCampaignMission, completeCampaignMission, decodeCampaignProfile } from '../../src/core/campaign';
import { createConquestProfile, proposeConquest, prepareConquestBattle, checkpointConquestBattle, completeConquestBattle, decodeConquestProfile } from '../../src/core/conquest';
import { captureScenario, issueScenarioCommand, stepScenario } from '../../src/core/scenarios';
import { scenarioChecksum, verifyScenarioRecording } from '../../src/core/scenario-recordings';
import { SAVE_VERSION, saveGame } from '../../src/core/saves';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { solveMission } from './mission-strategy';

assert.equal(SAVE_VERSION, 3); assert.equal(SIMULATION_REVISION, '3.2.0');
const directory = resolve(process.argv[2] ?? 'tests/fixtures/scenario-save3-3.2');
assert(!existsSync(directory), 'Historical fixtures are append-only.'); mkdirSync(directory, { recursive: true });
const artifacts: Record<string, { bytes: number; sha256: string }> = {};
const hash = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
function write(name: string, value: unknown) { const data = `${JSON.stringify(value)}\n`; writeFileSync(resolve(directory, name), data); artifacts[name] = { bytes: Buffer.byteLength(data), sha256: hash(data) }; }

const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'legacy-bound-dwarves'));
for (let tick = 0; tick < 20; tick++) stepScenario(run.session);
const active = checkpointCampaignMission(run.profile, run.session, run.recorder);
write('campaign-active.json', decodeCampaignProfile(active));
solveMission(run.session);
assert.equal(run.session.runtime.outcome, 'won');
const recording = run.recorder.archive(); run.recorder.destroy();
assert.equal(recording.version, 1); assert.equal(scenarioChecksum(verifyScenarioRecording(recording)), recording.finalChecksum);
write('scenario-recording.json', recording); write('scenario-final.json', captureScenario(run.session)); write('generic-bound-final.json', saveGame(run.session.state));
write('campaign-completed.json', decodeCampaignProfile(completeCampaignMission(active, run.session, recording)));

let realm = createConquestProfile('orcs', 'legacy-bound-realm');
realm = proposeConquest(realm, { type: 'tribute', faction: 'fairies', amount: 250 });
realm = proposeConquest(realm, { type: 'alliance', faction: 'fairies' });
for (let passage = 0; passage < 2; passage++) {
  const battle = prepareConquestBattle(realm, 'grove', 'passage');
  assert(issueScenarioCommand(battle.session, 0, { type: 'move', ids: [battle.session.runtime.labels.commander], x: 29, y: 16 }));
  for (let tick = 0; tick < 3000 && battle.session.runtime.outcome === 'playing'; tick++) stepScenario(battle.session);
  assert.equal(battle.session.runtime.outcome, 'won');
  realm = completeConquestBattle(battle.profile, battle.session, battle.recorder.archive()); battle.recorder.destroy();
}
write('conquest-completed.json', decodeConquestProfile(realm));
const battle = prepareConquestBattle(realm, 'grove', 'passage');
for (let tick = 0; tick < 20; tick++) stepScenario(battle.session);
write('conquest-active.json', decodeConquestProfile(checkpointConquestBattle(battle.profile, battle.session, battle.recorder))); battle.recorder.destroy();

const sources = ['src/core/versions.ts', 'src/core/saves.ts', 'src/core/simulation.ts', 'src/core/scenario-recordings.ts', 'src/core/scenarios.ts', 'src/core/scenario-types.ts', 'src/core/scenario-validation.ts', 'src/core/campaign.ts', 'src/core/conquest.ts', 'src/scenarios/campaigns.ts'];
writeFileSync(resolve(directory, 'provenance.json'), `${JSON.stringify({ format: 'orcs-vs-fairies-historical-scenario-fixtures', version: 1, capturedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), rootBindingCheckpoint: '1a1c46d', saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, scenarioRecordingVersion: 1, sources: Object.fromEntries(sources.map(path => [path, hash(readFileSync(path))])), artifacts }, null, 2)}\n`);
console.log(JSON.stringify({ directory, artifacts }));
