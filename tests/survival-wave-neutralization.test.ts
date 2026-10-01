import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { availableUnits } from '../src/core/content-registry';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { createMatch, isVisible, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { isCrewless } from '../src/core/tactics';
import type { Command, Entity, GameState, Side } from '../src/core/types';
import type { WorldMapData } from '../src/core/world-types';

function fixture(unitsPerWave: number, waveCount: number) {
 const world: WorldMapData = {
  width: 36, height: 36, size: 'small', seed: 4127,
  levels: [{ id: 0, title: 'Field', terrain: Array(36 * 36).fill('grass'), elevation: Array(36 * 36).fill(0) }],
  starts: [{ slot: 0, x: 7.5, y: 7.5, level: 0 }, { slot: 1, x: 25.5, y: 25.5, level: 0 }],
  resources: [], sites: [], transitions: []
 };
 const state = createMatch({
  map: { seed: world.seed, size: world.size, world },
  players: [{ id: 0, teamId: 0, factionId: 'fairies', controller: 'external' }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }],
  rules: {
   mode: 'survival', disabledDefinitionIds: availableUnits({ players: [{ faction: 'orcs' }] }, 0).filter(unit => unit.role !== 'worker' && unit.id !== FACTIONS.orcs.units.siege.id).map(unit => unit.id),
   survival: { intervalTicks: 20, recoveryTicks: 1000, unitsPerWave, waveCount, rewardPerWave: { wood: 13, ore: 7, crystal: 3 } }
  }
 }, { scenario: true });
 spawnDefinition(state, 0, 'building', FACTIONS.fairies.buildings.hq.id, 7.5, 7.5);
 const captor = spawnDefinition(state, 0, 'unit', FACTIONS.fairies.units.melee.id, 22.3, 25.5);
 refreshVisibility(state);
 return { state, captor };
}

/** Both branches use accepted commands and ordinary ticks after the native checkpoint. */
function continuation(state: GameState, recorder: MatchRecorder) {
 const restored = decodeSessionFile(createSessionFile(state, recorder.export()));
 const resumed = restored.state, resumedRecorder = new MatchRecorder(resumed, restored.file.replay);
 expect(saveGame(resumed)).toEqual(saveGame(state));
 expect(resumedRecorder.export()).toEqual(recorder.export());
 let comparedTicks = 0;
 return {
  resumed,
  command(side: Side, command: Command) {
   expect(issueCommand(state, side, command)).toBe(true);
   expect(issueCommand(resumed, side, command)).toBe(true);
   expect(saveGame(resumed)).toEqual(saveGame(state));
  },
  step() {
   stepGame(state, .05); stepGame(resumed, .05); comparedTicks++;
   expect(saveGame(resumed)).toEqual(saveGame(state));
  },
  finish() {
   expect(comparedTicks).toBeGreaterThan(0);
   expect(resumedRecorder.export()).toEqual(recorder.export());
   const replay = new ReplayPlayer(recorder.export());
   replay.seek(state.tick);
   expect(saveGame(replay.state)).toEqual(saveGame(state));
   replay.dispose(); resumedRecorder.dispose(); recorder.dispose();
  }
 };
}

function until(state: GameState, predicate: () => boolean, step: () => void, limit = 600) {
 for (let i = 0; i < limit && !predicate(); i++) step();
 expect(predicate(), JSON.stringify({ tick: state.tick, survival: state.objectives.survival, entities: state.entities.map(e => ({ id: e.id, hp: e.hp, side: e.side, order: e.order, crew: e.tactics?.siegeCrew })) })).toBe(true);
}
function engine(state: GameState, id: number): Entity { return state.entities.find(e => e.id === id)!; }

describe('survival wave neutralization through combat and capture', () => {
 it('rewards a wave once when real melee attacks defeat the full siege crew, and resumes the complete save', () => {
  const { state, captor } = fixture(1, 2), recorder = new MatchRecorder(state);
  until(state, () => state.objectives.survival.wave === 1, () => stepGame(state, .05), 20);
  const attacker = engine(state, state.objectives.survival.spawnedIds[0]);
  expect(attacker.definitionId).toBe(FACTIONS.orcs.units.siege.id);
  expect(attacker.tactics!.siegeCrew).toMatchObject({ hp: 42, maxHp: 42, uncrewed: false });
  expect(issueCommand(state, 1, { type: 'hold', ids: [attacker.id] })).toBe(true);
  expect(issueCommand(state, 0, { type: 'attack', ids: [captor.id], target: attacker.id })).toBe(true);
  until(state, () => attacker.tactics!.siegeCrew!.hp < 42, () => stepGame(state, .05));
  expect(attacker.tactics!.siegeCrew!.hp).toBeGreaterThan(0);
  const stock = { wood: state.players[0].wood, ore: state.players[0].ore, crystal: state.players[0].crystal }, branch = continuation(state, recorder);
  until(state, () => isCrewless(attacker), branch.step);
  expect(attacker.hp).toBeGreaterThan(0);
  expect(state.objectives.survival.phase).toBe('recovery');
  expect(state.players[0]).toMatchObject({ wood: stock.wood + 13, ore: stock.ore + 7, crystal: stock.crystal + 3 });
  branch.command(0, { type: 'hold', ids: [captor.id] });
  for (let i = 0; i < 10; i++) branch.step();
  expect(attacker.hp).toBeGreaterThan(0);
  expect(state.objectives.survival.wave).toBe(1);
  expect(state.players[0]).toMatchObject({ wood: stock.wood + 13, ore: stock.ore + 7, crystal: stock.crystal + 3 });
  expect(loadGame(saveGame(state)).objectives).toEqual(state.objectives);
  branch.finish();
 });

 it('keeps a hostile crewed engine active but excludes a captured defender engine from orders and final-wave completion', () => {
  const { state, captor } = fixture(2, 1), recorder = new MatchRecorder(state);
  until(state, () => state.objectives.survival.wave === 1, () => stepGame(state, .05), 20);
  const [first, remaining] = state.objectives.survival.spawnedIds.map(id => engine(state, id));
  const stock = { wood: state.players[0].wood, ore: state.players[0].ore, crystal: state.players[0].crystal };
  expect([first, remaining].every(e => e.tactics!.siegeCrew!.hp === 42 && !isCrewless(e))).toBe(true);
  expect(issueCommand(state, 1, { type: 'hold', ids: [first.id] })).toBe(true);
  expect(issueCommand(state, 1, { type: 'move', ids: [remaining.id], x: 31.5, y: 25.5 })).toBe(true);
  expect(issueCommand(state, 0, { type: 'attack', ids: [captor.id], target: first.id })).toBe(true);
  until(state, () => isCrewless(first), () => stepGame(state, .05));
  expect(first.hp).toBeGreaterThan(0);
  expect(state.objectives.survival.phase).toBe('fighting');
  expect(state.players[0]).toMatchObject(stock);
  expect(issueCommand(state, 0, { type: 'captureSiege', ids: [captor.id], target: first.id })).toBe(true);
  until(state, () => (captor.tactics?.capture?.progress ?? 0) >= .5, () => stepGame(state, .05));
  expect(first.side).toBe(1);
  expect(isCrewless(first)).toBe(true);
  const branch = continuation(state, recorder);
  until(state, () => first.side === 0, branch.step);
  expect(first.definitionFaction).toBe('orcs');
  expect(isCrewless(first)).toBe(false);
  expect(state.objectives.survival.phase).toBe('fighting');
  expect(state.players[0]).toMatchObject(stock);
  branch.command(0, { type: 'stop', ids: [first.id] });
  branch.step();
  expect(first.order.type).toBe('idle');
  expect(first.x).toBeGreaterThan(20);
  branch.command(1, { type: 'hold', ids: [remaining.id] });
  branch.command(0, { type: 'move', ids: [first.id], x: 20.5, y: 30.5 });
  branch.command(0, { type: 'move', ids: [captor.id], x: remaining.x - 1.2, y: remaining.y });
  until(state, () => isVisible(state, 0, remaining.x, remaining.y), branch.step);
  branch.command(0, { type: 'attack', ids: [captor.id], target: remaining.id });
  until(state, () => isCrewless(remaining), branch.step);
  expect(first.hp).toBeGreaterThan(0);
  expect(remaining.hp).toBeGreaterThan(0);
  expect(state.objectives.survival.phase).toBe('complete');
  expect(state.winningTeam).toBe(0);
  expect(state.winner).toBe(0);
  expect(state.players[0]).toMatchObject({ wood: stock.wood + 13, ore: stock.ore + 7, crystal: stock.crystal + 3 });
  expect(state.entities.find(e => e.role === 'hq')!.hp).toBeGreaterThan(0);
  branch.finish();
 });
});
