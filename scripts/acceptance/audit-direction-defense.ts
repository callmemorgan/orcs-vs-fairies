import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { decodeSessionFile } from '../../src/core/session-storage';
import { loadGame, saveGame, SAVE_VERSION } from '../../src/core/saves';
import { issueCommand, stepGame } from '../../src/core/simulation';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { GameState } from '../../src/core/types';

// Intended location: scripts/acceptance/audit-direction-defense.ts.
// Run only after dispatch on the same frozen source as the native browser proof.
// This audits the browser's original native human histories; no controller
// projection or planning-wrapper parity is included here.
export function verifyDirectionDefenseNativeArtifacts({ evidenceDir, fixturesDir, manifest, browserReceipt, outputPath, sourceCommit }: { evidenceDir: string; fixturesDir: string; manifest: any; browserReceipt: any; outputPath: string; sourceCommit: string }) {
assert(evidenceDir && fixturesDir && manifest && browserReceipt && outputPath && /^[a-f0-9]{40}$/.test(sourceCommit ?? ''), 'Supply evidence/fixture directories, manifest, browser receipt, new report path and full frozen source commit.');
assert(!existsSync(outputPath), 'Audit report path must be new.');
const receipt = browserReceipt;
const caseNames = [
  ...['front', 'side', 'rear'].map(kind => `flank-${kind}`),
  ...['front', 'turned', 'rear', 'depletion'].map(kind => `shield-${kind}`),
  ...['none', 'rock', 'building'].map(kind => `cover-${kind}`),
  ...['off', 'on'].map(kind => `friendly-fire-${kind}`),
  ...['stationary', 'charge', 'stop', 'turn', 'pike-front', 'pike-rear'].map(kind => `charge-${kind}`),
  ...['line', 'wedge', 'square', 'loose'].map(kind => `formation-${kind}`),
];
assert(caseNames.every(name => manifest.scenarios[name] && Object.hasOwn(receipt.results, name)), 'All 22 direction/defense cases must exist in the shared manifest and actual browser receipt.');
assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(receipt.sourceCommit, sourceCommit);
assert.equal(manifest.saveVersion, SAVE_VERSION); assert.equal(receipt.saveVersion, SAVE_VERSION);
assert.equal(manifest.simulationRevision, SIMULATION_REVISION); assert.equal(receipt.simulationRevision, SIMULATION_REVISION);
const sha = (value: unknown) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const near = (actual: number, expected: number, name: string) => assert(Math.abs(actual - expected) <= 1e-6, `${name}: expected ${expected}, got ${actual}`);
const hp = (state: GameState, id: number) => state.entities.find(e => e.id === id)?.hp ?? 0;
const entity = (state: GameState, id: number) => { const e = state.entities.find(e => e.id === id); assert(e, `Entity ${id}`); return e; };
const checkCommands = (archive: any, predicate: (command: any) => boolean, name: string) => assert(archive.actions.some((action: any) => action.type === 'command' && predicate(action.command)), name);
const report: any = { sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, cases: [], continuations: [], scope: 'Full original native game envelopes and runtime; tick-by-tick behavior; native human commands. Planning wrappers and projected CLI controllers are outside this audit.' };
const nativeFiles = new Map<string, ReturnType<typeof decodeSessionFile>['file']>();
for (const item of receipt.exports) {
  const path = resolve(evidenceDir, item.file), bytes = readFileSync(path), file = decodeSessionFile(bytes.toString()).file;
  assert(file.replay, `${item.file}: recorded native history`);
  assert.equal(file.game.version, SAVE_VERSION); assert.equal(file.replay.simulationRevision, SIMULATION_REVISION);
  assert.equal(file.game.state.tick, item.tick); nativeFiles.set(item.file, file);
}
const checkpoints = receipt.continuations.map((item: any) => {
  const checkpoint = nativeFiles.get(item.checkpoint), final = nativeFiles.get(item.final);
  assert(checkpoint && final, `${item.name}: retained native files`);
  assert.equal(checkpoint.game.state.tick, item.checkpointTick); assert.equal(final.game.state.tick, item.finalTick);
  assert(final.game.state.tick > checkpoint.game.state.tick);
  return { ...item, checkpointFile: item.checkpoint, finalFile: item.final, checkpoint, final, found: false, foundFinal: false };
});

function currentFormationOffset(kind: string, slot: number, count: number, spacing: number) {
  if (kind === 'line') return { x: 0, y: (slot - (count - 1) / 2) * spacing };
  if (kind === 'wedge') { const row = Math.ceil(slot / 2); return slot ? { x: -row * spacing, y: (slot % 2 ? -1 : 1) * row * spacing * .75 } : { x: 0, y: 0 }; }
  const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns), row = Math.floor(slot / columns), inRow = Math.min(columns, count - row * columns), scale = kind === 'loose' ? 1.8 : 1;
  return { x: (row - (rows - 1) / 2) * spacing * scale, y: (slot % columns - (inRow - 1) / 2) * spacing * scale };
}
for (const name of caseNames) {
  const fixture = manifest.scenarios[name];
  const exported = receipt.exports.filter((item: any) => item.name === name || item.name.startsWith(`${name}-`)).at(-1);
  assert(exported, `${name}: actual native browser output`);
  const file = nativeFiles.get(exported.file)!, archive = file.replay!;
  const authored = decodeSessionFile(readFileSync(resolve(fixturesDir, fixture.file), 'utf8')).file;
  assert.deepEqual(archive.initial, authored.game, `${name}: native history starts at authored input, with no post-recording fixture injection`);
  const state = loadGame(archive.initial), ids = fixture.ids;
  const commands: any[] = [], impacts: any[] = [], samples: any[] = [];
  const relevant = checkpoints.filter((item: any) => item.finalFile === `${name}-save.json` || item.finalFile.startsWith(`${name}-`));
  function inspectCheckpoint() {
    for (const item of relevant) if ((!item.found && state.tick === item.checkpointTick) || (!item.foundFinal && state.tick === item.finalTick)) {
      const game = saveGame(state);
      // A native checkpoint can precede a later command at this same tick.
      // Inspect before and after every command, and at each individual tick.
      if (state.tick === item.checkpointTick && isDeepStrictEqual(game, item.checkpoint.game)) item.found = true;
      if (state.tick === item.finalTick && isDeepStrictEqual(game, item.final.game)) item.foundFinal = true;
    }
  }
  inspectCheckpoint();
  for (const action of archive.actions) {
    if (action.type === 'command') {
      assert.equal(action.side, 0, `${name}: commands come from the human-controlled native UI`);
      commands.push({ tick: state.tick, command: action.command, chargeBefore: ids.source ? entity(state, ids.source).tactics?.charge?.distance ?? 0 : undefined });
      assert(issueCommand(state, action.side, action.command), `${name}: real recorded command must be accepted`);
      inspectCheckpoint(); continue;
    }
    assert.equal(action.dt, .05, `${name}: native fixed tick`);
    for (let i = 0; i < action.ticks; i++) {
      const before = new Map(state.entities.map(e => [e.id, { hp: e.hp, x: e.x, y: e.y, facing: e.facing, charge: e.tactics?.charge?.distance ?? 0, guard: e.tactics?.guard?.value }]));
      const oldTick = state.tick; stepGame(state, action.dt); assert.equal(state.tick, oldTick + 1);
      for (const event of state.events) if (event.type === 'attack' && (event.amount ?? 0) > 0) {
        impacts.push({ tick: state.tick, event: structuredClone(event), sourceBefore: event.source ? before.get(event.source) : undefined, targetBefore: event.target ? before.get(event.target) : undefined });
      }
      samples.push({ tick: state.tick, entities: state.entities.filter(e => [ids.source, ids.target, ids.friend, ids.guard, ids.cover, ids.victim, ...(ids.army ?? [])].includes(e.id)).map(e => ({ id: e.id, hp: e.hp, x: e.x, y: e.y, facing: e.facing, order: e.order.type, charge: e.tactics?.charge?.distance ?? 0, heading: e.tactics?.charge?.heading, guard: e.tactics?.guard?.value, formation: e.tactics?.formation ? structuredClone(e.tactics.formation) : undefined })), pending: (state.projectiles ?? []).filter(p => p.source === ids.source).map(p => ({ impactAt: p.impactAt, x: p.x, y: p.y })) });
      if (name.startsWith('formation-')) {
        const obstacle = entity(state, ids.obstacle);
        for (const id of ids.army) {
          const troop = state.entities.find(e => e.id === id); if (!troop || troop.hp <= 0) continue;
          assert(Math.abs(troop.x - obstacle.x) >= 1.27 - 1e-8 || Math.abs(troop.y - obstacle.y) >= 1.27 - 1e-8, `${name}: live unit ${id} must route outside depot footprint at tick ${state.tick}`);
          const f = troop.tactics?.formation;
          if (f) {
            const survivors = ids.army.filter((candidate: number) => hp(state, candidate) > 0).sort((a: number, b: number) => a - b);
            assert.equal(f.slot, survivors.indexOf(id)); assert.equal(f.count, survivors.length);
          }
        }
      }
      inspectCheckpoint();
    }
  }
  assert.deepEqual(saveGame(state), file.game, `${name}: full uninterrupted native core replay equals browser's saved game and runtime`);
  for (const item of relevant) {
    assert(item.found && item.foundFinal, `${item.name}: complete checkpoint and endpoint must occur in the real final native history`);
    report.continuations.push({ name: item.name, checkpoint: item.checkpointTick, final: item.finalTick, checkpointGameSha256: sha(item.checkpoint.game), finalGameSha256: sha(item.final.game), completeCheckpointAndEndpointEquality: true });
  }
  const hits = (source: number, target: number) => impacts.filter(hit => hit.event.source === source && hit.event.target === target && hit.event.text !== 'Shield intercepted shot');
  const ownHits = ids.source && ids.target ? hits(ids.source, ids.target) : [];
  const caseReport: any = { name, file: exported.file, ticks: state.tick - archive.initial.state.tick, nativeGameSha256: sha(file.game), commands, impacts, authored: fixture.authored };
  if (ownHits.length && !name.startsWith('shield-')) {
    const publicAttack = commands.find(record => record.command.type === 'attack' && record.command.ids.includes(ids.source) && record.command.target === ids.target);
    assert(publicAttack && ownHits[0].tick > publicAttack.tick, `${name}: the measured first impact must follow its real native public attack command`);
  }
  if (name.startsWith('flank-')) {
    checkCommands(archive, c => c.type === 'attack' && c.ids.includes(ids.source) && c.target === ids.target, `${name}: public attack command`);
    assert.equal(ownHits.length, 1); near(ownHits[0].event.amount, ids.expectedDamage, `${name}: first weapon damage`);
    assert.equal(ownHits[0].targetBefore.facing, 4);
  } else if (name.startsWith('shield-')) {
    checkCommands(archive, c => c.type === 'face' && c.ids.includes(ids.guard) && c.facing === ids.guardFacing, `${name}: public directional guard command`);
    checkCommands(archive, c => c.type === 'face' && c.ids.includes(ids.target) && c.facing === ids.targetFacing, `${name}: public target facing command`);
    assert(ownHits.length); near(ownHits[0].event.amount, ids.expectedFirstDamage, `${name}: first shield trial hit`);
    const interceptions = impacts.filter(hit => hit.event.source === ids.source && hit.event.target === ids.guard && hit.event.text === 'Shield intercepted shot');
    if (name === 'shield-front' || name === 'shield-depletion') near(interceptions[0]?.event.amount, 10.2, `${name}: first real interception`);
    else assert.equal(interceptions.length, 0, `${name}: rear or turned cone bypasses guard`);
    if (name === 'shield-depletion') {
      near(interceptions.reduce((total, hit) => total + hit.event.amount, 0), 40, 'Natural guard spends its full starting energy');
      assert(ownHits.length >= 5); near(ownHits[4].event.amount, 17, 'First subsequent unprotected shot');
      assert(samples.some(sample => sample.entities.find((e: any) => e.id === ids.guard)?.guard === 0));
    }
  } else if (name.startsWith('cover-')) {
    assert(ownHits.length); near(ownHits[0].event.amount, ids.expectedDamage, `${name}: covered or control shot`);
    if (name === 'cover-building') {
      checkCommands(archive, c => c.type === 'attack' && c.ids.includes(ids.siege) && c.target === ids.cover, 'Public siege demolition command');
      const demolition = hits(ids.siege, ids.cover); assert(demolition.length && hp(state, ids.cover) === 0);
      const uncovered = ownHits.find(hit => hit.tick > demolition[0].tick); assert(uncovered); near(uncovered.event.amount, 15, 'Ranged damage after native cover destruction');
      assert.equal(hits(ids.siege, ids.target).length, 0, 'Demolition must not splash the ranged test target');
    }
  } else if (name.startsWith('friendly-fire-')) {
    assert(samples.some(sample => sample.pending.length > 0), `${name}: original native replay contains pending projectile`);
    const collateral = hits(ids.source, ids.friend);
    assert(ownHits.length === 1); near(ownHits[0].event.amount, 25, `${name}: matching enemy shell impact`);
    if (ids.friendlyFire) { assert(collateral.length === 1); near(collateral[0].event.amount, 19.6, 'Enabled friendly collateral'); }
    else { assert.equal(collateral.length, 0); assert.equal(hp(state, ids.friend), authored.game.state.entities.find(e => e.id === ids.friend)!.hp); }
  } else if (name.startsWith('charge-')) {
    assert(ownHits.length === 1, `${name}: one measured cavalry impact`);
    checkCommands(archive, c => c.type === 'attack' && c.ids.includes(ids.source) && c.target === ids.target, `${name}: public attack`);
    caseReport.targetLoss = ownHits[0].event.amount;
    caseReport.riderLoss = hits(ids.target, ids.source).reduce((total, hit) => total + hit.event.amount, 0);
    caseReport.maxCharge = Math.max(0, ...samples.map(sample => sample.entities.find((e: any) => e.id === ids.source)?.charge ?? 0));
    if (name === 'charge-stationary') near(caseReport.targetLoss, 15, 'Stationary cavalry control');
    if (name === 'charge-stop') {
      assert(commands.some(record => record.command.type === 'hold' && record.command.ids.includes(ids.source) && record.chargeBefore >= 4), 'Native hold interrupts previously accumulated charge');
      const attackCommand = commands.find(record => record.command.type === 'attack' && record.command.ids.includes(ids.source)); assert.equal(attackCommand.chargeBefore, 0);
    }
    if (name === 'charge-turn') {
      assert(samples.some(sample => sample.entities.find((e: any) => e.id === ids.source)?.facing === 6 && sample.entities.find((e: any) => e.id === ids.source)?.charge < 1.5), 'Recorded sharp turn resets earlier eastbound charge');
    }
    if (name === 'charge-pike-front') { near(caseReport.targetLoss, 17, 'Frontal held pike cancels charge bonus'); assert(caseReport.riderLoss > 10); }
    if (name === 'charge-pike-rear') assert.equal(caseReport.riderLoss, 0);
  } else if (name.startsWith('formation-')) {
    checkCommands(archive, c => c.type === 'formation' && c.formation === ids.formation && c.ids.length === 6, 'Public six-role formation command');
    checkCommands(archive, c => c.type === 'move' && c.ids.length === 6, 'Public group movement command');
    assert(impacts.some(hit => hit.event.source === ids.enemy && hit.event.target === ids.victim && hit.event.amount === 1), 'Casualty comes from the native enemy weapon');
    assert.equal(hp(state, ids.victim), 0);
    const survivors = ids.army.filter((id: number) => hp(state, id) > 0).sort((a: number, b: number) => a - b); assert.equal(survivors.length, 5);
    survivors.forEach((id: number, slot: number) => {
      const troop = entity(state, id), formation = troop.tactics!.formation!, expected = currentFormationOffset(ids.formation, slot, 5, ids.spacing);
      assert.equal(formation.slot, slot); assert.equal(formation.count, 5); assert.equal(formation.phase, 'formed'); assert.equal(troop.order.type, 'hold'); assert.equal(troop.facing, 0);
      assert(Math.hypot(troop.x - ids.destination.x - expected.x, troop.y - ids.destination.y - expected.y) < .7);
    });
    caseReport.routeCheckedTicks = samples.length; caseReport.survivors = survivors;
  }
  report.cases.push(caseReport);
}
assert(checkpoints.every((item: any) => item.found && item.foundFinal), 'Every retained moving/pending/casualty checkpoint and endpoint must equal an uninterrupted original native history position.');
const result = (name: string) => { const found = report.cases.find((item: any) => item.name === name); assert(found); return found; };
assert(result('charge-charge').targetLoss > result('charge-stationary').targetLoss * 1.5);
assert(result('charge-stop').targetLoss < result('charge-charge').targetLoss);
assert(result('charge-turn').targetLoss < result('charge-charge').targetLoss);
assert(result('charge-pike-rear').targetLoss > result('charge-pike-front').targetLoss * 1.5);
report.status = 'passed'; report.fixtureCount = caseNames.length;
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`Audited ${report.cases.length} native encounters and ${report.continuations.length} complete checkpoint continuations at ${sourceCommit}; SAVE${SAVE_VERSION}, rules ${SIMULATION_REVISION}.`);
return report;
}
