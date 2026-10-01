import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createConquestProfile, proposeConquest, prepareConquestBattle, checkpointConquestBattle, completeConquestBattle, decodeConquestProfile } from '../../src/core/conquest';
import { issueScenarioCommand, stepScenario } from '../../src/core/scenarios';
import type { ConquestProfile } from '../../src/core/conquest-types';

// node proof.mjs <summary.json> <private-archives-dir> <source-commit>
const output = resolve(process.argv[2]), archiveDirectory = resolve(process.argv[3]), sourceCommit = process.argv[4];
assert(sourceCommit && !existsSync(output) && !existsSync(archiveDirectory));
mkdirSync(archiveDirectory, { recursive: true });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const sources = ['src/core/conquest.ts', 'src/core/campaign.ts', 'src/core/scenario-recordings.ts', 'src/core/scenario-validation.ts', 'src/core/scenarios.ts', 'src/core/geometry.ts', 'scripts/scenarios/prove-conquest-profile-budget-fix.ts'];
const setup = (id: string) => proposeConquest(proposeConquest(createConquestProfile('undead', id), { type: 'tribute', faction: 'fairies', amount: 250 }), { type: 'alliance', faction: 'fairies' });
const messageOf = (operation: () => unknown): string | null => { try { operation(); return null; } catch (error) { return (error as Error).message; } };
const isBudgetError = (message: string | null) => !!message && /package is too large|package exceeds its size limit/.test(message);
const rows: Array<Record<string, unknown>> = [];
let profile = setup('budget-fix-proof');
for (let battle = 1; battle <= 4; battle++) {
  const run = prepareConquestBattle(profile, 'grove', 'passage'), acceptedProfile = JSON.stringify(run.profile);
  const ids = run.session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0).map(e => e.id);
  for (let i = 0; i < 30000; i++) assert(issueScenarioCommand(run.session, 0, { type: 'hold', ids }));
  assert(issueScenarioCommand(run.session, 0, { type: 'move', ids: [run.session.runtime.labels.commander], x: 29, y: 16 }));
  while (run.session.runtime.outcome === 'playing') stepScenario(run.session);
  assert.equal(run.session.runtime.outcome, 'won');
  const recording = run.recorder.archive(), text = JSON.stringify(recording) + '\n'; run.recorder.destroy();
  const recordingPath = resolve(archiveDirectory, `battle-${battle}-recording.json`); writeFileSync(recordingPath, text);
  const checkpointError = messageOf(() => checkpointConquestBattle(run.profile, run.session, run.recorder));
  let completed: ConquestProfile | null = null;
  const resultError = messageOf(() => { completed = completeConquestBattle(run.profile, run.session, recording); });
  assert.equal(JSON.stringify(run.profile), acceptedProfile, 'Rejected or accepted transitions mutated the input profile');
  if (battle < 4) {
    assert.equal(checkpointError, null); assert.equal(resultError, null); assert(completed);
    profile = decodeConquestProfile(JSON.stringify(completed));
  } else {
    assert(isBudgetError(checkpointError)); assert(isBudgetError(resultError));
    assert.deepEqual(decodeConquestProfile(JSON.stringify(profile)), profile);
    assert.deepEqual(decodeConquestProfile(acceptedProfile), run.profile);
  }
  rows.push({ battle, commands: recording.commands.length, checkpointError, resultError, acceptedHistory: profile.history.length, acceptedTurn: profile.turn, inputUnchanged: true, acceptedProfileReloads: true, recording: { path: recordingPath, sha256: hash(text) } });
}
const standalone = prepareConquestBattle(setup('budget-journal-proof'), 'grove', 'passage');
const standaloneIds = standalone.session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0).map(e => e.id);
for (let i = 0; i < 80000; i++) assert(issueScenarioCommand(standalone.session, 0, { type: 'hold', ids: standaloneIds }));
const standaloneError = messageOf(() => standalone.recorder.archive()); standalone.recorder.destroy();
assert(isBudgetError(standaloneError));
const evidence = { format: 'orcs-vs-fairies-conquest-profile-budget-correction-proof', version: 1, sourceCommit, geometryDependencyCommit: 'd1171b9', sourceFiles: Object.fromEntries(sources.map(path => [path, hash(readFileSync(resolve(path), 'utf8'))])), commandPath: 'issueScenarioCommand', stepPath: 'stepScenario', rows, standalone: { commands: 80000, unitsCommanded: standaloneIds.length, archiveError: standaloneError }, assertions: { acceptedProfilesReload: true, overBudgetCheckpointRejected: true, overBudgetResultRejected: true, rejectedTransitionsPreserveProfile: true, overBudgetStandaloneJournalRejected: true } };
mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ output, assertions: evidence.assertions }));
