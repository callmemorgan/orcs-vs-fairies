import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTIONS } from '../../src/core/content';
import { environmentPhase } from '../../src/core/environment';
import { initializeFactionSystems } from '../../src/core/faction-systems';
import { MatchRecorder } from '../../src/core/replays';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { createMatch, refreshVisibility, spawnDefinition } from '../../src/core/simulation';
import { initializeTactics } from '../../src/core/tactics';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { FormationKind } from '../../src/core/tactics';
import type { BuiltinFactionId, BuildingRole, Entity, GameState, Side, UnitRole } from '../../src/core/types';

// Intended committed location: scripts/acceptance/direction-defense-fixtures.ts.
// Generation authors starting conditions only. No engine ticks or combat results
// are produced here. The native app records all later player commands.
export function buildDirectionDefenseFixtures(output: string, sourceCommit: string) {
const out = resolve(output);
assert(output, 'Supply a new output directory.');
assert(/^[a-f0-9]{40}$/.test(sourceCommit ?? ''), 'Supply the full frozen source commit.');
assert(!existsSync(out), 'Fixture output directory must be new.');
mkdirSync(out, { recursive: true });
const scenarios: Record<string, unknown> = {};
const commonAuthored = {
  map: 'Seed 0, small forest world with two layers; flat grass, no resources or neutral actors.',
  calendar: 'Day, season and weather lengths are 1,000,000 seconds. Seed 0 starts in clear daylight.',
  roster: 'Human side zero, external opponent; normal headquarters and distant workers retained. Default combat troops removed; encounter troops use native built-in definitions.',
  undergroundWorker: 'One owned worker starts on level one; every import must preserve it.',
  economy: 'Starting age three and starting banks of 2,000 wood, 2,000 ore and 500 crystal.',
  cooldowns: 'Non-firing targets, guards, workers and formation troops start with cooldown 1,000. First-hit shooters start with cooldown 3. No cooldown is changed after recording.',
  health: 'Normal definition health except the explicitly listed wounded cover or casualty actor.',
};

function reset(e: Entity, x: number, y: number, level = 0, cooldown = 1000) {
  Object.assign(e, { x, y, level, order: { type: 'hold' }, path: [], cooldown, facing: 4, animation: 'idle', animTime: 0, momentum: 0 });
  delete e.orderQueue;
}
function base(faction: BuiltinFactionId, opponent: BuiltinFactionId = 'orcs', friendlyFire = false) {
  const state = createMatch({
    map: { seed: 0, size: 'small', biome: 'forest' },
    rules: { startingAge: 3, friendlyFire },
    players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'human', handicap: { startingResources: { wood: 2000, ore: 2000, crystal: 500 } } },
      { id: 1, teamId: 1, factionId: opponent, controller: 'external' },
    ],
  });
  assert.equal(state.world!.levels.length, 2);
  for (const layer of state.world!.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  Object.assign(state.world!, { transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 1_000_000, seasonLength: 1_000_000, weatherLength: 1_000_000 });
  state.world!.levels[0].terrain = state.terrain;
  state.terrain.fill('grass'); state.resources = [];
  state.entities = state.entities.filter(e => e.kind === 'building' && e.role === 'hq' || e.kind === 'unit' && e.role === 'worker');
  for (const side of [0, 1] as Side[]) {
    const hq = state.entities.find(e => e.side === side && e.role === 'hq')!;
    reset(hq, side ? 31.5 : 5.5, side ? 31.5 : 5.5);
    state.starts[side] = { x: hq.x, y: hq.y, level: 0 };
    state.entities.filter(e => e.side === side && e.role === 'worker').forEach((e, i) => reset(e, side ? 30.5 + i * .7 : 4.5 + i * .7, side ? 28.5 : 8.5));
  }
  const undergroundWorker = state.entities.filter(e => e.side === 0 && e.role === 'worker').at(-1)!;
  reset(undergroundWorker, 8.5, 8.5, 1);
  initializeFactionSystems(state);
  assert.equal(environmentPhase(state).weather, 'clear');
  assert.equal(environmentPhase(state).day, 'day');
  return { state, undergroundWorker: undergroundWorker.id };
}
function unit(state: GameState, side: Side, role: UnitRole, x: number, y: number, cooldown = 1000) {
  const e = spawnDefinition(state, side, 'unit', FACTIONS[state.players[side].faction].units[role].id, x, y);
  reset(e, x, y, 0, cooldown); initializeTactics(state, e); return e;
}
function building(state: GameState, side: Side, role: BuildingRole, x: number, y: number) {
  const e = spawnDefinition(state, side, 'building', FACTIONS[state.players[side].faction].buildings[role].id, x, y);
  reset(e, x, y); return e;
}
function write(name: string, state: GameState, ids: Record<string, unknown>, authored: Record<string, unknown>) {
  refreshVisibility(state);
  // The recorder starts only after all authored setup. A zero-tick native history
  // pins the current rules revision and cannot contain a fabricated result.
  const recorder = new MatchRecorder(state);
  const file = createSessionFile(state, recorder.export()); recorder.dispose();
  const decoded = decodeSessionFile(file);
  assert.deepEqual(saveGame(decoded.state), file.game, `${name} native fixture must round-trip in full`);
  assert.equal(file.game.version, SAVE_VERSION);
  assert.equal(file.replay!.simulationRevision, SIMULATION_REVISION);
  assert.equal(file.replay!.actions.length, 0);
  const bytes = Buffer.from(JSON.stringify(file, null, 2));
  writeFileSync(resolve(out, `${name}.json`), bytes);
  scenarios[name] = { file: `${name}.json`, ids, authored: { ...commonAuthored, ...authored }, initialTick: state.tick, initialTime: state.time, faction: state.players[0].faction, sha256: createHash('sha256').update(bytes).digest('hex') };
}

for (const [direction, x, y, damage] of [['front', 20.5, 24.5, 12], ['side', 24.5, 20.5, 15], ['rear', 28.5, 24.5, 18]] as const) {
  const { state, undergroundWorker } = base('orcs');
  const target = unit(state, 1, 'melee', 24.5, 24.5);
  const source = unit(state, 0, 'ranged', x, y, 3);
  write(`flank-${direction}`, state, { source: source.id, target: target.id, undergroundWorker, expectedDamage: damage }, { targetFacing: 4, shooterMomentum: 0, description: `First native Boltspitter attack approaches a held Ironjaw from ${direction}. Independent fixtures prevent previous shots changing momentum or morale.` });
}

for (const [kind, sourceX, guardFacing, targetFacing] of [['front', 20.5, 4, 4], ['turned', 20.5, 0, 4], ['rear', 29.5, 4, 0], ['depletion', 20.5, 4, 4]] as const) {
  const { state, undergroundWorker } = base('dwarves', 'fairies');
  const target = unit(state, 0, 'ranged', 25.5, 24.5);
  const guard = unit(state, 0, 'melee', 23.5, 24.5);
  const source = unit(state, 1, 'ranged', sourceX, 24.5, 3);
  // Authored opposition action. Own guard and target facing are then commanded
  // from the native Tactics panel before the first shot.
  source.order = { type: 'attack', target: target.id };
  target.facing = targetFacing; guard.facing = guardFacing;
  write(`shield-${kind}`, state, { source: source.id, target: target.id, guard: guard.id, undergroundWorker, guardFacing, targetFacing, expectedFirstDamage: kind === 'front' || kind === 'depletion' ? 6.8 : 17 }, { enemyOrder: `Mothbow starts with an attack order on Thunderlock #${target.id}.`, guardEnergy: 40, description: kind === 'depletion' ? 'A normal 40-point directional guard absorbs repeated frontal shots until empty. The following shot must deal the full 17 health damage.' : 'Public facing commands set the owned shield and ally. The first enemy Mothbow shot measures interception or bypass.' });
}

for (const cover of ['none', 'rock', 'building'] as const) {
  const { state, undergroundWorker } = base('fairies');
  const source = unit(state, 0, 'ranged', 20.5, 24.5, 3);
  const target = unit(state, 1, 'melee', 25.5, 24.5);
  let coverId: number | undefined, siegeId: number | undefined;
  if (cover === 'rock') state.terrain[24 * state.width + 23] = 'rock';
  if (cover === 'building') {
    const depot = building(state, 1, 'depot', 22.5, 24.5); depot.hp = 100; coverId = depot.id;
    const siege = unit(state, 0, 'siege', 10.5, 20.5, 3); siegeId = siege.id;
  }
  write(`cover-${cover}`, state, { source: source.id, target: target.id, cover: coverId, siege: siegeId, undergroundWorker, expectedDamage: cover === 'none' ? 15 : 8.7, withdrawal: { x: 18.5, y: 18.5 }, returnPoint: { x: 20.5, y: 24.5 } }, { targetFacing: 4, coverHealth: cover === 'building' ? 100 : undefined, description: cover === 'building' ? 'An authored wounded enemy Timber Yard covers the target. A public siege attack must destroy its remaining 100 HP. The Mothbow withdraws during demolition and then returns for an uncovered shot.' : `An independent native Mothbow first attack measures ${cover} cover.`, siegePreparation: 'Thorn Trebuchet is unprepared; its normal area shell needs no purchased payload. The enemy target is three tiles from the building center, outside shell splash.' });
}

for (const friendlyFire of [false, true]) {
  const { state, undergroundWorker } = base('fairies', 'orcs', friendlyFire);
  const source = unit(state, 0, 'siege', 18.5, 24.5, 3);
  const target = unit(state, 1, 'melee', 25.5, 24.5);
  const friend = unit(state, 0, 'melee', 25.5, 25.5);
  write(`friendly-fire-${friendlyFire ? 'on' : 'off'}`, state, { source: source.id, target: target.id, friend: friend.id, undergroundWorker, friendlyFire }, { friendlyFire, description: 'A public native attack launches an ordinary Thorn Trebuchet shell at the enemy. An allied Thornblade starts one tile from impact. Export occurs while the real projectile is pending; continuation checks enemy and allied health.' });
}

for (const motion of ['stationary', 'charge', 'stop', 'turn', 'pike-front', 'pike-rear'] as const) {
  const { state, undergroundWorker } = base('fairies');
  const source = unit(state, 0, 'cavalry', motion === 'stationary' ? 24.7 : 18.5, 24.5, motion === 'stationary' ? 3 : 0);
  const target = unit(state, 1, motion.startsWith('pike') ? 'spear' : 'melee', 26, 24.5);
  source.facing = 0; target.facing = motion === 'pike-rear' ? 0 : 4;
  write(`charge-${motion}`, state, { source: source.id, target: target.id, undergroundWorker, motion, stopPoint: { x: 23.6, y: 24.5 }, turnPoint: { x: 23.6, y: 22.5 } }, { targetFacing: target.facing, targetOrder: 'hold', targetCooldown: 1000, description: 'Native Stag Rider commands measure movement charge, hold interruption, sharp-turn interruption, or held Pikejaw counter. No specialist ability is activated. Pike rear differs only in held facing.' });
}

for (const formation of ['line', 'wedge', 'square', 'loose'] as FormationKind[]) {
  const { state, undergroundWorker } = base('orcs', 'fairies');
  const roles: UnitRole[] = ['melee', 'ranged', 'spear', 'cavalry', 'melee', 'ranged'];
  const army = roles.map((role, i) => unit(state, 0, role, 18.5 + i * .7, 20.5));
  const obstacle = building(state, 0, 'depot', 24.5, 20.5);
  const victim = army[2]; victim.hp = 1; initializeTactics(state, victim).morale = 100;
  const enemy = unit(state, 1, 'ranged', 26.5, 16.5, 18);
  enemy.order = { type: 'attack', target: victim.id };
  enemy.orderQueue = [{ type: 'move', x: 10.5, y: 10.5, level: 0 }];
  write(`formation-${formation}`, state, { army: army.map(e => e.id), roles, obstacle: obstacle.id, victim: victim.id, enemy: enemy.id, undergroundWorker, formation, spacing: .8, facing: 0, destination: { x: 30.5, y: 20.5 } }, { victimHealth: 1, victimMorale: 100, enemyOrder: `Mothbow begins with an attack on wounded Pikejaw #${victim.id}, cooldown 18 seconds, followed by a queued withdrawal.`, description: 'The complete own combat army contains melee, ranged, spear and cavalry roles. Native formation and movement controls route it around a native depot. A real enemy weapon hit kills the authored wounded member; queued opposition withdrawal lets survivors regroup at unchanged anchor.' });
}

const manifest = { schema: 1, sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, setup: 'Authored native session inputs. All setup precedes the recorder; generation advances zero ticks. All subsequent owned actions use production UI.', scenarios };
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Authored ${Object.keys(scenarios).length} native direction/defense fixtures at ${sourceCommit}; SAVE${SAVE_VERSION}, rules ${SIMULATION_REVISION}; zero simulation ticks.`);
return manifest;
}
