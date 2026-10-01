import { describe, expect, it, vi } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createEconomyState, economicState } from '../src/core/economy-common';
import { recordEconomyPaid } from '../src/core/economy';
import { environmentPhase } from '../src/core/environment';
import { walkable } from '../src/core/navigation';
import { loadGame, saveGame } from '../src/core/saves';
import { applyScenarioDamage, captureRuntime, createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { engineerBuild, fieldRepair, specialistAbility, stepSpecialists, type SpecialistHooks } from '../src/core/specialist-systems';
import { setWorldTerrain } from '../src/core/world-map';
import type { BuiltinFactionId, Cost, Entity, GameState } from '../src/core/types';
import type { WorldState } from '../src/core/world-types';

function fixture(faction: BuiltinFactionId = 'orcs', layered = false): GameState {
  const state = createMatch({
    map: { seed: 4127, size: 'small', ...(layered ? { biome: 'forest' as const } : {}) }, rules: { startingAge: 3 },
    players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 1000 } } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
    ],
  });
  state.entities = state.entities.filter(e => e.role === 'hq'); state.resources = []; state.terrain.fill('grass');
  state.economy = createEconomyState(2);
  for (const e of state.entities) { e.x = e.side === 0 ? 2.5 : state.width - 2.5; e.y = e.side === 0 ? 2.5 : state.height - 2.5; }
  if (state.world) {
    for (const layer of state.world.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
    Object.assign(state.world, { biome: 'temperate', transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 10000, seasonLength: 10000, weatherLength: 10000 });
    for (let seed = 1; seed < 1000; seed++) { state.seed = seed; if (environmentPhase(state).weather === 'clear') break; }
  }
  refreshVisibility(state); return state;
}

function hooks(state: GameState): SpecialistHooks {
  return {
    spawn: (...args) => spawnDefinition(state, ...args),
    damage: (source, target, amount, options) => { expect(applyScenarioDamage(state, source as Entity, target, amount, options)).toBe(true); },
    die: (actor, text) => { expect(applyScenarioDamage(state, state.entities.find(e => e.side === 1 && e.role === 'hq')!, actor, 1e6, { armorPiercing: true, text })).toBe(true); },
    // Stop uses the same authoritative assignment cleanup as the integration's interrupt hook.
    interrupt: vi.fn(actor => { expect(issueCommand(state, actor.side, { type: 'stop', ids: [actor.id] })).toBe(true); }),
    recordPaid: vi.fn((actor, cost) => recordEconomyPaid(state, actor, cost)),
    setTerrain: (point, kind) => setWorldTerrain(state, point, kind),
  };
}

function cargo(state: GameState, actor: Entity) { return economicState(state)!.cargo.find(c => c.entityId === actor.id)!; }
function run(state: GameState, seconds: number): void { for (let i = 0; i < Math.round(seconds * 20); i++) stepGame(state, .05); }
function expectRoundTrip(state: GameState): void {
  const restored = loadGame(saveGame(state)); expect(saveGame(restored)).toEqual(saveGame(state));
  run(state, .2); run(restored, .2); expect(saveGame(restored)).toEqual(saveGame(state));
}

function loadRaidedCargo(state: GameState, actor: Entity): void {
  const home = state.entities.find(e => e.side === 1 && e.role === 'hq')!;
  const destination = spawnDefinition(state, 1, 'building', FACTIONS.orcs.buildings.hq.id, 28.5, 20.5);
  expect(issueCommand(state, 1, { type: 'trainCaravan', id: home.id })).toBe(true); run(state, 18.1);
  const target = state.entities.find(e => e.id === economicState(state)!.caravans[0])!; target.x = home.x - 2; target.y = home.y;
  refreshVisibility(state); expect(issueCommand(state, 1, { type: 'tradeRoute', id: target.id, source: home.id, target: destination.id, kind: 'wood', amount: 50, repeat: false })).toBe(true);
  run(state, .05); expect(cargo(state, target).stock.wood).toBe(50);
  expect(issueCommand(state, 1, { type: 'stop', ids: [target.id] })).toBe(true); target.x = actor.x + 6; target.y = actor.y;
  refreshVisibility(state); expect(issueCommand(state, 0, { type: 'raidSupply', ids: [actor.id], target: target.id })).toBe(true);
  for (let i = 0; i < 200 && !cargo(state, actor)?.stock.wood; i++) stepGame(state, .05);
  run(state, .05); expect(cargo(state, actor).stock).toEqual({ wood: 24, ore: 0, crystal: 0 });
  expect(cargo(state, target).stock.wood).toBe(26);
  expect(economicState(state)!.tasks.find(task => task.entityId === actor.id)).toMatchObject({ kind: 'route', phase: 'delivery' });
  expect(captureRuntime(state).routes.some(([id]) => id === actor.id)).toBe(true);
}

describe('specialist relocation with physical cargo', () => {
  it.each([
    ['fairies', 'core:fairies-commander'],
    ['fairies', FACTIONS.fairies.units.cavalry.id],
    ['automata', FACTIONS.automata.units.cavalry.id],
  ] as const)('%s %s cancels a loaded raid delivery only after a valid relocation', (faction, definitionId) => {
    const state = fixture(faction), actor = spawnDefinition(state, 0, 'unit', definitionId, 18.5, 18.5), adapter = hooks(state);
    loadRaidedCargo(state, actor); actor.orderQueue = [{ type: 'move', x: 30.5, y: 20.5 }]; actor.entrenchedAt = state.time;
    const rejected = { type: 'ability' as const, ids: [actor.id], x: actor.x, y: actor.y + 10 }, before = saveGame(state), shield = actor.shield;
    expect(specialistAbility(state, actor, rejected, adapter)).toBe(false);
    expect(saveGame(state)).toEqual(before); expect(adapter.interrupt).not.toHaveBeenCalled();
    const destination = { x: actor.x, y: actor.y + 2 };
    expect(specialistAbility(state, actor, { type: 'ability', ids: [actor.id], ...destination }, adapter)).toBe(true);
    expect(actor).toMatchObject({ ...destination, order: { type: 'idle' }, path: [] });
    expect(actor.orderQueue).toBeUndefined(); expect(actor.entrenchedAt).toBeUndefined();
    expect(adapter.interrupt).toHaveBeenCalledExactlyOnceWith(actor);
    expect(captureRuntime(state).routes.some(([id]) => id === actor.id)).toBe(false);
    expect(economicState(state)!.tasks.some(task => task.entityId === actor.id)).toBe(false);
    expect(cargo(state, actor)).toMatchObject({ stock: { wood: 24, ore: 0, crystal: 0 }, origin: 'delivery', tradeValue: 0 });
    expect(cargo(state, actor).destinationId).toBeUndefined(); expect(cargo(state, actor).contractId).toBeUndefined();
    if (faction === 'automata') expect(actor.shield).toBe(shield! - 15);
    expectRoundTrip(state);
  });
});

describe('temporary bridge expiry with loaded caravans', () => {
  it.each([true, false])('uses shared interruption/death cleanup when reachable shore is %s', shore => {
    const state = fixture('orcs', true) as GameState & { world: WorldState }, level = 1, crossing = { x: 18.5, y: 18.5, level };
    for (const hq of state.entities) hq.level = level;
    refreshVisibility(state);
    const home = state.entities.find(e => e.side === 0)!, destination = spawnDefinition(state, 0, 'building', FACTIONS.orcs.buildings.hq.id, 28.5, 5.5, 1, level);
    expect(issueCommand(state, 0, { type: 'trainCaravan', id: home.id })).toBe(true); run(state, 18.1);
    const caravan = state.entities.find(e => e.id === economicState(state)!.caravans[0])!; caravan.x = home.x + 2; caravan.y = home.y;
    refreshVisibility(state); expect(issueCommand(state, 0, { type: 'tradeRoute', id: caravan.id, source: home.id, target: destination.id, kind: 'wood', amount: 40, repeat: false })).toBe(true);
    run(state, .1); expect(cargo(state, caravan).stock.wood).toBe(40); expect(captureRuntime(state).routes.some(([id]) => id === caravan.id)).toBe(true);
    const engineer = spawnDefinition(state, 0, 'unit', 'core:orcs-engineer', crossing.x - 3, crossing.y, 1, level), adapter = hooks(state);
    state.world.levels[level].terrain.fill('water'); state.world.revision = (state.world.revision ?? 0) + 1;
    if (shore) state.world.levels[level].terrain[18 * state.width + 22] = 'grass';
    refreshVisibility(state); expect(engineerBuild(state, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', ...crossing }, adapter)).toBe(true);
    expect(adapter.recordPaid).not.toHaveBeenCalled();
    caravan.x = crossing.x; caravan.y = crossing.y; caravan.orderQueue = [{ type: 'move', x: 28.5, y: 5.5, level }];
    const other = spawnDefinition(state, 0, 'unit', FACTIONS.orcs.units.worker.id, crossing.x, crossing.y, 1, 0); other.carried = 7;
    state.time = state.specialists!.structures[0].expires;
    stepSpecialists(state, adapter);
    expect(other).toMatchObject({ hp: other.maxHp, ...crossing, level: 0, carried: 7 });
    expect(state.specialists!.structures).toEqual([]);
    if (shore) {
      expect(caravan.hp).toBe(caravan.maxHp); expect(walkable(state, caravan.x, caravan.y, level)).toBe(true);
      expect(adapter.interrupt).toHaveBeenCalledExactlyOnceWith(caravan);
      expect(caravan.order).toEqual({ type: 'idle' }); expect(caravan.path).toEqual([]); expect(caravan.orderQueue).toBeUndefined();
      expect(captureRuntime(state).routes.some(([id]) => id === caravan.id)).toBe(false);
      expect(economicState(state)!.tasks.some(task => task.entityId === caravan.id)).toBe(false);
      expect(cargo(state, caravan)).toMatchObject({ stock: { wood: 40, ore: 0, crystal: 0 }, origin: 'delivery', tradeValue: 0 });
      expect(cargo(state, caravan).destinationId).toBeUndefined();
    } else {
      expect(caravan).toMatchObject({ hp: 0, animation: 'death' }); expect(adapter.interrupt).not.toHaveBeenCalled();
      expect(economicState(state)!.cargo.some(item => item.entityId === caravan.id)).toBe(false);
      expect(economicState(state)!.tasks.some(task => task.entityId === caravan.id)).toBe(false);
      expect(economicState(state)!.salvage).toEqual([expect.objectContaining({ ...crossing, kind: 'cargo', stock: { wood: 40, ore: 0, crystal: 0 } })]);
      expect(state.events.filter(event => event.type === 'death' && event.source === caravan.id)).toHaveLength(1);
      expect(state.corpses.filter(corpse => corpse.id === caravan.id)).toHaveLength(1);
    }
    expectRoundTrip(state);
  });
});

describe('paid engineer barricade salvage', () => {
  it.each(['destroyed', 'expired'] as const)('keeps only the charged investment after repair when %s', death => {
    const state = fixture(), engineer = spawnDefinition(state, 0, 'unit', 'core:orcs-engineer', 18.5, 18.5), adapter = hooks(state), before = { ...state.players[0] };
    const paidBanks: Cost[] = [];
    adapter.recordPaid = vi.fn((actor, cost) => { paidBanks.push({ wood: state.players[0].wood, ore: state.players[0].ore, crystal: state.players[0].crystal }); recordEconomyPaid(state, actor, cost); });
    refreshVisibility(state); expect(engineerBuild(state, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'barricade', x: 20.5, y: 18.5 }, adapter)).toBe(true);
    const barricade = state.entities.find(e => e.definitionId === 'core:field-barricade')!;
    expect(adapter.recordPaid).toHaveBeenCalledExactlyOnceWith(barricade, { wood: 35, ore: 15, crystal: 0 });
    expect(paidBanks).toEqual([{ wood: before.wood - 35, ore: before.ore - 15, crystal: before.crystal }]);
    expect(economicState(state)!.paidCosts).toEqual([{ entityId: barricade.id, stock: { wood: 35, ore: 15, crystal: 0 } }]);
    const freeSiege = spawnDefinition(state, 0, 'unit', FACTIONS.orcs.units.siege.id, 26.5, 18.5);
    expect(economicState(state)!.paidCosts.some(record => record.entityId === freeSiege.id)).toBe(false);
    barricade.hp -= 80; refreshVisibility(state); expect(fieldRepair(state, 0, engineer.id, barricade.id)).toBe(true);
    const checkpoint = loadGame(saveGame(state)); expect(saveGame(checkpoint)).toEqual(saveGame(state));
    if (death === 'destroyed') { adapter.die(barricade, 'Destroyed paid barricade.'); adapter.die(freeSiege, 'Destroyed free siege.'); }
    else { state.specialists!.structures[0].expires = .1; freeSiege.expires = .1; run(state, .15); }
    expect(economicState(state)!.salvage).toEqual([expect.objectContaining({ x: barricade.x, y: barricade.y, kind: 'salvage', stock: { wood: 8.75, ore: 3.75, crystal: 0 } })]);
    expect(economicState(state)!.paidCosts).toEqual([]); expect(state.specialists!.structures).toEqual([]);
    expectRoundTrip(state);
  });

  it('does not record investment for a rejected purchase', () => {
    const state = fixture(), engineer = spawnDefinition(state, 0, 'unit', 'core:orcs-engineer', 18.5, 18.5), adapter = hooks(state);
    refreshVisibility(state); state.players[0].wood = 34; const before = saveGame(state);
    expect(engineerBuild(state, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'barricade', x: 20.5, y: 18.5 }, adapter)).toBe(false);
    expect(saveGame(state)).toEqual(before); expect(adapter.recordPaid).not.toHaveBeenCalled();
  });
});
