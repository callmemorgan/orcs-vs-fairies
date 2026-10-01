import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTIONS } from '../../src/core/content';
import { completeConquestBattle, createConquestProfile, decodeConquestProfile, prepareConquestBattle, proposeConquest, waitConquestTurn } from '../../src/core/conquest';
import { issueScenarioCommand, stepScenario } from '../../src/core/scenarios';
import { scenarioStateEquals, verifyScenarioRecording } from '../../src/core/scenario-recordings';
import { isHostile } from '../../src/core/simulation';
import { solveConquest } from './conquest-strategy';
import type { ConquestMission, ConquestProfile } from '../../src/core/conquest-types';

// Build this script with esbuild, then run from the source checkout:
// node proof.mjs <baseline|corrected> <summary.json> <private-archives-dir> [source-commit]
const mode = process.argv[2];
if (mode !== 'baseline' && mode !== 'corrected') throw new Error('Choose baseline or corrected proof expectations.');
const output = resolve(process.argv[3] ?? `work/conquest-review-${mode}.json`);
const archiveDirectory = resolve(process.argv[4] ?? `work/conquest-review-${mode}-archives`);
if (existsSync(output) || existsSync(archiveDirectory)) throw new Error('Proof outputs are append-only; choose new output paths.');
mkdirSync(archiveDirectory, { recursive: true });
const sourceCommit = process.argv[5] ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const sourceFiles = ['src/core/conquest.ts', 'src/core/conquest-types.ts', 'src/core/campaign.ts', 'src/core/scenario-recordings.ts', 'src/core/scenarios.ts', 'src/core/scenario-types.ts', 'src/core/scenario-validation.ts', 'src/core/content.ts', 'src/core/geometry.ts', 'src/core/simulation.ts', 'src/core/saves.ts', 'src/core/navigation.ts', 'src/core/types.ts', 'src/scenarios/conquest-world.ts', 'scripts/scenarios/conquest-strategy.ts', 'scripts/scenarios/prove-conquest-review.ts'];
const assertions: Record<string, boolean> = {};
const journals: Array<{ id: string; path: string; sha256: string; finalTick: number; commands: number; outcome: string }> = [];
const attempts: Array<Record<string, unknown>> = [];
const errorOf = (operation: () => unknown): string | null => { try { operation(); return null; } catch (error) { return String(error); } };
const assert = (value: boolean, label: string) => { if (!value) throw new Error(label); };

function finish(run: ConquestMission, label: string): ConquestProfile {
  const recording = run.recorder.archive(); run.recorder.destroy();
  const archivePath = resolve(archiveDirectory, `${label}.json`), text = JSON.stringify(recording) + '\n';
  writeFileSync(archivePath, text);
  const replayed = verifyScenarioRecording(recording);
  assert(scenarioStateEquals(replayed, run.session), `${label}: replay disagrees with the live result`);
  let result = completeConquestBattle(run.profile, run.session, recording);
  assert(completeConquestBattle(result, run.session, recording) === result, `${label}: duplicate completion changed the profile`);
  result = decodeConquestProfile(JSON.stringify(result));
  journals.push({ id: label, path: archivePath, sha256: hash(text), finalTick: recording.finalTick, commands: recording.commands.length, outcome: replayed.runtime.outcome });
  return result;
}

let history = createConquestProfile('orcs', 'review-history');
for (let i = 0; i < 256; i++) history = waitConquestTurn(history);
assert(decodeConquestProfile(JSON.stringify(history)).turn === 256, '256 decisions did not reconstruct');
let overflow: ConquestProfile | null = null;
const waitError = errorOf(() => { overflow = waitConquestTurn(history); });
const tributeError = errorOf(() => proposeConquest(history, { type: 'tribute', faction: 'fairies', amount: 25 }));
const battleError = errorOf(() => { const run = prepareConquestBattle(history, 'quarry'); run.recorder.destroy(); });
const overflowDecodeError = overflow ? errorOf(() => decodeConquestProfile(JSON.stringify(overflow))) : null;
assertions.historyAcceptsOnlyReloadableDecisions = !!waitError && !!tributeError && !!battleError;
attempts.push({ id: 'history-bound', acceptedHistory: history.history.length, waitError, tributeError, battleError, overflowAccepted: !!overflow, overflowDecodeError });

let treaty = createConquestProfile('orcs', 'review-expired-passage');
treaty = proposeConquest(treaty, { type: 'tribute', faction: 'fairies', amount: 100 });
treaty = proposeConquest(treaty, { type: 'truce', faction: 'fairies', turns: 1 });
const expired = prepareConquestBattle(treaty, 'grove', 'passage');
for (let tick = 0; tick < 320; tick++) stepScenario(expired.session);
assert(isHostile(expired.session.state, 0, 1), 'truce did not expire');
solveConquest(expired.session);
assertions.expiredPassageCannotWin = expired.session.runtime.outcome !== 'won';
const expiredResult = finish(expired, 'expired-passage');
attempts.push({ id: 'expired-passage', outcome: expired.session.runtime.outcome, time: expired.session.state.time, hostile: isHostile(expired.session.state, 0, 1), expiry: expired.session.runtime.triggers['truce-expiry'], protectionVariable: expired.session.runtime.variables['diplomacy.protected'] ?? null, acceptedTurn: expiredResult.turn });

let allied = createConquestProfile('undead', 'review-fresh-aid');
allied = proposeConquest(allied, { type: 'tribute', faction: 'fairies', amount: 250 });
allied = proposeConquest(allied, { type: 'alliance', faction: 'fairies' });
const cost = FACTIONS.undead.units.ranged.cost;
for (let battle = 1; battle <= 3; battle++) {
  const beforeArmy = allied.army.map(s => s.entity.id), treasury = structuredClone(allied.treasury), allyTreasury = structuredClone(allied.relations.fairies.treasury);
  const run = prepareConquestBattle(allied, 'grove', 'passage'), aidId = run.session.runtime.labels['aid-fairies'] ?? null;
  const funded = (['wood', 'ore', 'crystal'] as const).every(key => allyTreasury[key] >= cost[key]);
  assertions[`aid-${battle}-funding`] = (aidId !== null) === funded;
  if (aidId !== null) assertions[`aid-${battle}-fresh-unit`] = !beforeArmy.includes(aidId);
  assertions[`aid-${battle}-no-unfunded-treasury`] = JSON.stringify(run.session.definition.rules.resources) === JSON.stringify(treasury);
  assert(issueScenarioCommand(run.session, 0, { type: 'move', ids: [run.session.runtime.labels.commander], x: 29, y: 16 }), 'allied passage move rejected');
  while (run.session.runtime.outcome === 'playing' && run.session.state.tick < 3610) stepScenario(run.session);
  assert(run.session.runtime.outcome === 'won', 'alliance did not permit protected passage');
  allied = finish(run, `allied-passage-${battle}`);
  assertions[`aid-${battle}-full-cost`] = (['wood', 'ore', 'crystal'] as const).every(key => allied.relations.fairies.treasury[key] === allyTreasury[key] - (aidId === null ? 0 : cost[key]));
  attempts.push({ id: `allied-passage-${battle}`, aidId, aidExistedInRoster: aidId !== null && beforeArmy.includes(aidId), funded, armyBefore: beforeArmy, armyAfter: allied.army.map(s => s.entity.id), allyBefore: allyTreasury, allyAfter: allied.relations.fairies.treasury, unitCost: cost });
}

let multiple = createConquestProfile('dwarves', 'review-multiple-allies');
for (const [index, faction] of (['fairies', 'undead', 'tideborn'] as const).entries()) {
  for (let turn = 0; turn < (index === 0 ? 0 : index === 1 ? 4 : 7); turn++) multiple = waitConquestTurn(multiple);
  multiple = proposeConquest(multiple, { type: 'tribute', faction, amount: 250 });
  multiple = proposeConquest(multiple, { type: 'alliance', faction });
}
const multipleBefore = structuredClone(multiple.relations), multipleRun = prepareConquestBattle(multiple, 'crossroads');
const aid = Object.fromEntries(Object.entries(multipleRun.session.runtime.labels).filter(([label]) => label.startsWith('aid-')));
assertions.multipleAidNoUnfundedTreasury = JSON.stringify(multipleRun.session.definition.rules.resources) === JSON.stringify(multiple.treasury);
solveConquest(multipleRun.session);
assert(multipleRun.session.runtime.outcome === 'won', 'multiple-allies battle did not win');
multiple = finish(multipleRun, 'multiple-allies');
const multipleCost = FACTIONS.dwarves.units.ranged.cost;
assertions.multipleAidChargesOnlyContributors = Object.entries(multiple.relations).every(([faction, relation]) => (['wood', 'ore', 'crystal'] as const).every(key => relation.treasury[key] === multipleBefore[faction].treasury[key] - (Object.hasOwn(aid, `aid-${faction}`) ? multipleCost[key] : 0)));
assertions.multipleAidLimit = Object.keys(aid).length === 2;
attempts.push({ id: 'multiple-allies', aid, unitCost: multipleCost, alliesBefore: Object.fromEntries(Object.entries(multipleBefore).filter(([, r]) => r.alliance).map(([f, r]) => [f, r.treasury])), alliesAfter: Object.fromEntries(Object.entries(multiple.relations).filter(([, r]) => r.alliance).map(([f, r]) => [f, r.treasury])) });

const evidence = { format: 'orcs-vs-fairies-conquest-review-proof', version: 1, generatedAt: new Date().toISOString(), sourceCommit, dependencyCommit: 'd1171b9', mode, sourceFiles: Object.fromEntries(sourceFiles.map(path => [path, hash(readFileSync(resolve(path), 'utf8'))])), commandPath: 'issueScenarioCommand', stepPath: 'stepScenario', assertions, attempts, journals };
mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ output, mode, assertions, journalCount: journals.length }));
if (mode === 'corrected' && Object.values(assertions).some(passed => !passed)) process.exitCode = 1;
if (mode === 'baseline' && (assertions.expiredPassageCannotWin || assertions.historyAcceptsOnlyReloadableDecisions)) process.exitCode = 1;
