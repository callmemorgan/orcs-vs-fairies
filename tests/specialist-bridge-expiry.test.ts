import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { entityDefinition } from '../src/core/content-registry';
import { environmentPhase } from '../src/core/environment';
import { FACTION_STRUCTURE_INFO } from '../src/core/faction-systems-content';
import { terrainAt } from '../src/core/maps';
import { walkable } from '../src/core/navigation';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { createArtifact } from '../src/core/unit-progression';
import type { Entity, GameState } from '../src/core/types';
import type { WorldState } from '../src/core/world-types';

type LayeredState = GameState & { world: WorldState };
const crossing = { x: 18.5, y: 18.5 };
const drowningText = 'A unit drowned when the temporary bridge expired.';

function fixture(level: number, faction: 'orcs' | 'undead' = 'orcs') {
  const state = createMatch({
    map: { seed: 4127, size: 'small', biome: 'forest' }, rules: { startingAge: 3, sharedVision: false },
    players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 10000 } } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
    ],
  }) as LayeredState;
  state.entities = state.entities.filter(e => e.role === 'hq'); state.resources = [];
  for (const e of state.entities) { e.x = e.side === 0 ? 2.5 : state.width - 2.5; e.y = e.side === 0 ? 2.5 : state.height - 2.5; }
  for (const layer of state.world.levels) { layer.terrain.fill(layer.id === level ? 'water' : 'grass'); layer.elevation.fill(0); }
  Object.assign(state.world, { biome: 'temperate', revision: 0, transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 10000, seasonLength: 10000, weatherLength: 10000 });
  for (let seed = 1; seed < 1000; seed++) { state.seed = seed; if (environmentPhase(state).weather === 'clear') break; }
  const engineer = actor(state, `core:${faction}-engineer`, crossing.x - 3, crossing.y, level);
  return { state, engineer };
}

function actor(state: LayeredState, definitionId: string, x: number, y: number, level: number): Entity {
  const unit = spawnDefinition(state, 0, 'unit', definitionId, x, y, 1, level); unit.order = { type: 'hold' }; return unit;
}
function ready(state: LayeredState): void { refreshVisibility(state); expect(() => saveGame(state)).not.toThrow(); }
function build(state: LayeredState, engineer: Entity, level: number): void {
  const wood = state.players[0].wood;
  expect(issueCommand(state, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', ...crossing, level })).toBe(true);
  expect(state.players[0].wood).toBe(wood - 60);
  expect(state.specialists!.structures).toHaveLength(1);
  expect(state.specialists!.structures[0]).toMatchObject({ kind: 'bridge', expires: 60 });
  for (const dx of [-1, 0, 1]) expect(terrainAt(state, crossing.x + dx, crossing.y, level)).toBe('bridge');
}
function advance(state: GameState, seconds: number): void {
  const deadline = state.time + seconds;
  while (state.time + 1e-8 < deadline) {
    const before = state.tick; stepGame(state, Math.min(.25, deadline - state.time)); expect(state.tick).toBe(before + 1);
  }
}
function losses(recorder: MatchRecorder | ReplayPlayer, count: number, value: number): void {
  expect(recorder.analysis.at(-1)!.players[0]).toMatchObject({ losses: count, buildingLosses: 0, lostValue: value });
}
function value(state: GameState, unit: Entity): number {
  const cost = entityDefinition(state, unit).cost; return cost.wood + cost.ore + cost.crystal + unit.carried;
}
function expectDead(state: GameState, unit: Entity, level: number): void {
  expect(unit).toMatchObject({ hp: 0, animation: 'death', order: { type: 'idle' }, path: [] });
  expect(unit.orderQueue).toBeUndefined();
  expect(state.corpses.filter(c => c.id === unit.id)).toEqual([{ id: unit.id, x: unit.x, y: unit.y, level, expires: state.time + 45 }]);
  expect(state.events.filter(e => e.type === 'death' && e.source === unit.id)).toEqual([expect.objectContaining({ level, side: 0, text: drowningText })]);
}
function equip(state: LayeredState, hero: Entity, artifact: number): void {
  expect(issueCommand(state, 0, { type: 'recoverArtifact', id: hero.id, artifact })).toBe(true);
  expect(issueCommand(state, 0, { type: 'equipArtifact', id: hero.id, artifact })).toBe(true);
}

describe('temporary crossing expiry without reachable shore', () => {
  it.each([0, 1])('kills a normal level-%s troop once and leaves the same coordinates on the other level alive', level => {
    const { state, engineer } = fixture(level);
    const troop = actor(state, FACTIONS.orcs.units.melee.id, crossing.x, crossing.y, level);
    const other = actor(state, FACTIONS.orcs.units.melee.id, crossing.x, crossing.y, 1 - level);
    troop.orderQueue = [{ type: 'move', x: crossing.x + 2, y: crossing.y, level }]; ready(state);
    const recorder = new MatchRecorder(state), cost = value(state, troop); build(state, engineer, level);
    expect(walkable(state, troop.x, troop.y, level)).toBe(true); advance(state, 59.75);
    expect(troop.hp).toBe(troop.maxHp); losses(recorder, 0, 0); stepGame(state, .25);
    expectDead(state, troop, level); expect(state.specialists!.structures).toEqual([]);
    expect(state.players[0].heroRecovery).toBeUndefined(); expect(state.specialists!.artifacts).toEqual([]);
    expect(other.hp).toBe(other.maxHp); expect(engineer.hp).toBe(engineer.maxHp); losses(recorder, 1, cost);
    advance(state, 2); expect(state.corpses.filter(c => c.id === troop.id)).toHaveLength(1);
    expect(state.events.some(e => e.type === 'death')).toBe(false); expect(other.hp).toBe(other.maxHp); losses(recorder, 1, cost); recorder.dispose();
  });

  it.each([0, 1])('uses central cleanup for an equipped level-%s commander, with one recovery entry and one extra loot item', level => {
    const { state, engineer } = fixture(level), hero = actor(state, 'core:orcs-commander', crossing.x, crossing.y, level);
    const item = createArtifact(state, 'core:iron-aegis', hero); ready(state);
    const recorder = new MatchRecorder(state), cost = value(state, hero); equip(state, hero, item.id); build(state, engineer, level);
    expect(hero.equipment).toEqual({ armor: item.id }); advance(state, 59.75); expect(item.holder).toBe(hero.id); stepGame(state, .25);
    expectDead(state, hero, level); expect(hero.equipment).toBeUndefined();
    expect(state.players[0].heroRecovery).toEqual([{ definitionId: 'core:orcs-commander', availableAt: 90 }]);
    expect(state.specialists!.artifacts).toHaveLength(2);
    expect(state.specialists!.artifacts.filter(a => a.id === item.id)).toHaveLength(1);
    expect(item).toEqual({ id: item.id, definitionId: 'core:iron-aegis', position: { ...crossing, level } });
    expect(state.specialists!.artifacts.every(a => a.owner === undefined && a.holder === undefined && a.position?.level === level)).toBe(true);
    losses(recorder, 1, cost); advance(state, 2);
    expect(state.specialists!.artifacts).toHaveLength(2); expect(state.corpses.filter(c => c.id === hero.id)).toHaveLength(1);
    expect(state.players[0].heroRecovery).toEqual([{ definitionId: 'core:orcs-commander', availableAt: 90 }]); losses(recorder, 1, cost); recorder.dispose();
  });

  it.each([0, 1])('kills a level-%s illusion commander without permanent rewards or ordinary losses', level => {
    const { state, engineer } = fixture(level), hero = actor(state, 'core:orcs-commander', crossing.x, crossing.y, level);
    hero.illusion = true;
    ready(state);
    const recorder = new MatchRecorder(state); build(state, engineer, level); advance(state, 60);
    expect(hero).toMatchObject({ hp: 0, animation: 'death', order: { type: 'idle' }, path: [] }); expect(hero.orderQueue).toBeUndefined();
    expect(state.events.filter(e => e.type === 'death' && e.source === hero.id)).toEqual([expect.objectContaining({ level, text: drowningText })]);
    expect(state.corpses.some(c => c.id === hero.id)).toBe(false); expect(state.players[0].heroRecovery).toBeUndefined();
    expect(state.specialists!.artifacts).toEqual([]); losses(recorder, 0, 0); advance(state, 2);
    expect(state.corpses).toEqual([]); expect(state.specialists!.artifacts).toEqual([]); expect(state.players[0].heroRecovery).toBeUndefined(); losses(recorder, 0, 0);
    const replay = new ReplayPlayer(recorder.export()); replay.seek(state.tick); expect(saveGame(replay.state)).toEqual(saveGame(state)); losses(replay, 0, 0);
    recorder.dispose(); replay.dispose();
  });

  it.each([0, 1])('kills a real level-%s raised troop at bridge expiry while a Necropolis sustains its lifetime', level => {
    const { state, engineer } = fixture(level, 'undead');
    const caster = actor(state, FACTIONS.undead.units.special.id, crossing.x - 3, crossing.y + 1, level);
    spawnDefinition(state, 0, 'building', FACTION_STRUCTURE_INFO.necropolis.definition.id, crossing.x - 3, crossing.y - 1, 1, level);
    state.corpses.push({ id: state.nextId++, ...crossing, level, expires: 45 }); ready(state);
    const recorder = new MatchRecorder(state); build(state, engineer, level);
    refreshVisibility(state); expect(issueCommand(state, 0, { type: 'ability', ids: [caster.id] })).toBe(true);
    const troop = state.entities.find(e => e.raised)!;
    expect(entityDefinition(state, troop)).toEqual(FACTIONS.undead.units.melee);
    expect(troop.expires).toBe(35); expect(state.corpses).toEqual([]);
    expect(issueCommand(state, 0, { type: 'hold', ids: [troop.id] })).toBe(true);
    expect(issueCommand(state, 0, { type: 'move', ids: [troop.id], x: crossing.x + 2, y: crossing.y, level, queued: true })).toBe(true);
    advance(state, 59.75); expect(troop.hp).toBeGreaterThan(0); expect(troop.expires - state.time).toBeCloseTo(35);
    const resumed = loadGame(saveGame(state)); stepGame(state, .25); stepGame(resumed, .25);
    expect(saveGame(resumed)).toEqual(saveGame(state));
    expect(troop).toMatchObject({ hp: 0, animation: 'death', order: { type: 'idle' }, path: [] }); expect(troop.orderQueue).toBeUndefined();
    expect(state.events.filter(e => e.type === 'death' && e.source === troop.id)).toEqual([expect.objectContaining({ level, text: drowningText })]);
    expect(state.corpses.some(c => c.id === troop.id)).toBe(false); expect(state.players[0].heroRecovery).toBeUndefined();
    expect(state.specialists!.artifacts).toEqual([]); losses(recorder, 0, 0); advance(state, 2);
    expect(state.corpses).toEqual([]); expect(state.specialists!.artifacts).toEqual([]); losses(recorder, 0, 0);
    const replay = new ReplayPlayer(recorder.export());
    try { replay.seek(state.tick); expect(saveGame(replay.state)).toEqual(saveGame(state)); losses(replay, 0, 0); }
    finally { recorder.dispose(); replay.dispose(); }
  });

  it.each([0, 1])('reproduces level-%s cleanup and loss counts from a native save and replay seeks across expiry', level => {
    const { state, engineer } = fixture(level), hero = actor(state, 'core:orcs-commander', crossing.x, crossing.y, level);
    const troop = actor(state, FACTIONS.orcs.units.melee.id, crossing.x + 1, crossing.y, level), item = createArtifact(state, 'core:iron-aegis', hero); ready(state);
    const recorder = new MatchRecorder(state), cost = value(state, hero) + value(state, troop); equip(state, hero, item.id); build(state, engineer, level);
    for (let tick = 0; tick < 599; tick++) stepGame(state, .1);
    expect(hero.hp).toBe(hero.maxHp); expect(troop.hp).toBe(troop.maxHp); losses(recorder, 0, 0);
    const checkpoint = saveGame(state), history = recorder.export(); recorder.dispose();
    const restored = loadGame(JSON.stringify(checkpoint)), resumed = new MatchRecorder(restored, JSON.parse(JSON.stringify(history)));
    stepGame(state, .1); stepGame(restored, .1); expect(state.tick).toBe(600);
    expectDead(state, hero, level); expectDead(state, troop, level); losses(resumed, 2, cost);
    expect(saveGame(restored)).toEqual(saveGame(state));
    const atExpiry = saveGame(state);
    for (let tick = 0; tick < 20; tick++) { stepGame(state, .1); stepGame(restored, .1); }
    expect(saveGame(restored)).toEqual(saveGame(state)); losses(resumed, 2, cost);
    expect(restored.specialists!.artifacts).toHaveLength(2); expect(restored.corpses.filter(c => [hero.id, troop.id].includes(c.id))).toHaveLength(2);
    const replay = new ReplayPlayer(JSON.stringify(resumed.export())); replay.seek(620);
    expect(saveGame(replay.state)).toEqual(saveGame(restored)); losses(replay, 2, cost);
    replay.seek(599); expect(replay.state.entities.find(e => e.id === hero.id)!.hp).toBeGreaterThan(0); losses(replay, 0, 0);
    replay.seek(600); expect(saveGame(replay.state)).toEqual(atExpiry); losses(replay, 2, cost);
    const fork = replay.forkForSeek(600); expect(saveGame(fork.state)).toEqual(atExpiry); losses(fork, 2, cost);
    fork.advance(20); replay.seek(620); expect(saveGame(fork.state)).toEqual(saveGame(restored)); losses(fork, 2, cost); losses(replay, 2, cost);
    resumed.dispose(); replay.dispose(); fork.dispose();
  });

  it.each([0, 1])('rescues a level-%s footprint overlapping the bridge when its center is already on an isolated bank', level => {
    const { state, engineer } = fixture(level), troop = actor(state, FACTIONS.orcs.units.melee.id, 20.1, crossing.y, level);
    state.world.levels[level].terrain[18 * state.width + 20] = 'grass'; ready(state);
    const recorder = new MatchRecorder(state); build(state, engineer, level);
    expect(terrainAt(state, troop.x, troop.y, level)).toBe('grass'); expect(walkable(state, troop.x, troop.y, level)).toBe(true);
    advance(state, 60); expect(troop.hp).toBe(troop.maxHp); expect(troop.x).not.toBe(20.1);
    expect(walkable(state, troop.x, troop.y, level)).toBe(true); expect(state.corpses.some(c => c.id === troop.id)).toBe(false);
    expect(state.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'message', source: troop.id, level, text: 'Temporary bridge expired; moved to nearby shore.' })]));
    losses(recorder, 0, 0); recorder.dispose();
  });
});
