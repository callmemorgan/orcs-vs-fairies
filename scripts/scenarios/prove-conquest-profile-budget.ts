import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createConquestProfile, proposeConquest, prepareConquestBattle, completeConquestBattle, decodeConquestProfile } from '../../src/core/conquest';
import { issueScenarioCommand, stepScenario } from '../../src/core/scenarios';
import { decodeScenarioRecording } from '../../src/core/scenario-recordings';

// node proof.mjs <summary.json> <private-archives-dir> [hold-count=30000] [battles=6]
const output = resolve(process.argv[2] ?? 'work/conquest-profile-budget.json');
const privateDirectory = resolve(process.argv[3] ?? 'work/conquest-profile-budget-archives');
const commandCount = Number(process.argv[4] ?? 30000), battleCount = Number(process.argv[5] ?? 6);
assert(Number.isSafeInteger(commandCount) && commandCount >= 0 && commandCount < 100000);
assert(Number.isSafeInteger(battleCount) && battleCount > 0 && battleCount <= 254);
assert(!existsSync(output) && !existsSync(privateDirectory), 'Proof outputs are append-only; choose new paths.');
mkdirSync(privateDirectory, { recursive: true });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const nodes = (value: unknown): number => value !== null && typeof value === 'object' ? 1 + Object.values(value).reduce((sum: number, child) => sum + nodes(child), 0) : 1;
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceFiles = ['src/core/conquest.ts', 'src/core/conquest-types.ts', 'src/core/scenario-recordings.ts', 'src/core/scenarios.ts', 'src/core/scenario-validation.ts', 'src/core/content.ts', 'src/core/geometry.ts', 'src/core/simulation.ts', 'src/core/saves.ts', 'src/core/campaign.ts', 'scripts/scenarios/prove-conquest-profile-budget.ts'];
const rows: Array<Record<string, unknown>> = [];
let profile = createConquestProfile('undead', 'aggregate-budget-proof');
profile = proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 250 });
profile = proposeConquest(profile, { type: 'alliance', faction: 'fairies' });
let failedProfile: { path: string; sha256: string } | null = null;
for (let battle = 1; battle <= battleCount; battle++) {
  const run = prepareConquestBattle(profile, 'grove', 'passage');
  const ids = run.session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0).map(e => e.id);
  for (let command = 0; command < commandCount; command++) assert(issueScenarioCommand(run.session, 0, { type: 'hold', ids }));
  assert(issueScenarioCommand(run.session, 0, { type: 'move', ids: [run.session.runtime.labels.commander], x: 29, y: 16 }));
  while (run.session.runtime.outcome === 'playing') stepScenario(run.session);
  assert.equal(run.session.runtime.outcome, 'won');
  const recording = run.recorder.archive(); run.recorder.destroy();
  assert.equal(decodeScenarioRecording(recording).commands.length, commandCount + 1);
  profile = completeConquestBattle(run.profile, run.session, recording);
  assert.equal(profile.history.length, battle + 2);
  const profileText = JSON.stringify(profile), recordingText = JSON.stringify(recording) + '\n';
  const profileNodes = nodes(JSON.parse(profileText)), recordingNodes = nodes(JSON.parse(recordingText));
  const recordingPath = resolve(privateDirectory, `battle-${battle}-recording.json`);
  writeFileSync(recordingPath, recordingText);
  let reload = 'passed';
  // Large histories are checked near the limit; every stress history is checked.
  if (commandCount > 0 || battle % 10 === 0 || profileNodes > 1490000 || battle === battleCount) {
    try { decodeConquestProfile(profileText); } catch (error) { reload = (error as Error).message; }
  } else reload = 'not-checked';
  rows.push({ battle, commands: recording.commands.length, unitsCommanded: ids.length, recordingBytes: Buffer.byteLength(recordingText), recordingNodes, profileBytes: Buffer.byteLength(profileText), profileNodes, history: profile.history.length, outcome: run.session.runtime.outcome, reload, recording: { path: recordingPath, sha256: hash(recordingText) } });
  console.log(JSON.stringify(rows.at(-1)));
  if (reload !== 'passed' && reload !== 'not-checked') {
    const profilePath = resolve(privateDirectory, 'unreloadable-profile.json');
    writeFileSync(profilePath, profileText); failedProfile = { path: profilePath, sha256: hash(profileText) }; break;
  }
}
const evidence = { format: 'orcs-vs-fairies-conquest-profile-budget-proof', version: 1, sourceCommit, geometryDependencyCommit: 'd1171b9', commandCount, battleCount, commandPath: 'issueScenarioCommand', stepPath: 'stepScenario', sourceFiles: Object.fromEntries(sourceFiles.map(path => [path, hash(readFileSync(resolve(path), 'utf8'))])), rows, failedProfile };
mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ output, battles: rows.length, failedProfile }));
