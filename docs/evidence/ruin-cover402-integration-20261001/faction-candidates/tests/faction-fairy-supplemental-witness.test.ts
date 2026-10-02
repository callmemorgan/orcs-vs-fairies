import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { entityDefinition } from '../src/core/content-registry';
import { FACTION_STRUCTURE_INFO } from '../src/core/faction-systems-content';
import { PlayerView } from '../src/core/observation';
import { createMatch, isVisible, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { canObserveTacticalEntity } from '../src/core/tactics';
import { generateWorldMap } from '../src/core/world-map';
import type { Entity, GameEvent, GameState, UnitRole, Vec } from '../src/core/types';

// Supplemental witnesses; these add no origin-exclusivity or scout-AI gate.
function fixture(): GameState {
  const map = generateWorldMap(4127, 'large', 2, 'temperate');
  for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  map.sites = [];
  const state = createMatch({
    map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 },
    players: (['fairies', 'orcs'] as const).map((factionId, id) => ({
      id: id as 0 | 1, teamId: id as 0 | 1, factionId, controller: 'external' as const,
      handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 10000 } },
    })),
  });
  state.entities = state.entities.filter(entity => entity.role === 'hq'); state.resources = [];
  return state;
}
function actor(state: GameState, side: 0 | 1, role: UnitRole, x: number, y: number): Entity {
  const unit = spawnDefinition(state, side, 'unit', FACTIONS[state.players[side].faction].units[role].id, x, y, 1, 1);
  unit.order = { type: 'hold' }; unit.cooldown = 100;
  return unit;
}
function until(state: GameState, ready: () => boolean, seconds: number): void {
  for (let tick = 0; tick < Math.ceil(seconds / .05) && !ready(); tick++) stepGame(state, .05);
  expect(ready()).toBe(true);
}
function point(entity: Entity): Vec { return { x: entity.x, y: entity.y, level: entity.level }; }

describe('supplemental Fairy original-clause witnesses', () => {
  it('ID23 exchanges the sole Veilweaver creator with its own ability-created double', () => {
    const state = fixture(), creator = actor(state, 0, 'special', 24.5, 32.5);
    expect(state.entities.filter(entity => entity.illusion)).toHaveLength(0);
    expect(state.entities.filter(entity => entity.kind === 'unit')).toEqual([creator]);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'ability', ids: [creator.id] })).toBe(true);
    const doubles = state.entities.filter(entity => entity.illusion);
    expect(doubles).toHaveLength(2);
    const double = doubles[0], from = point(creator), to = point(double);
    expect(from).not.toEqual(to);
    expect(entityDefinition(state, double)).toEqual(entityDefinition(state, creator));
    expect(double.side).toBe(creator.side); expect(double.illusion).toBe(true); expect(creator.illusion).toBe(false);
    expect(issueCommand(state, 0, { type: 'illusionSwap', ids: [creator.id], target: double.id })).toBe(true);
    expect(point(creator)).toEqual(to); expect(point(double)).toEqual(from);
  });

  it('ID24 presents a built Grove decoy as a real troop and lets a hostile scout choose it in combat', () => {
    const state = fixture(), worker = actor(state, 0, 'worker', 18.5, 20.5);
    const ally = actor(state, 0, 'melee', 22.5, 22.5), scout = actor(state, 1, 'cavalry', 26.5, 20.5);
    // The ready scout holds outside melee range during construction; its later
    // attackMove command chooses a target through production enemy selection.
    scout.cooldown = 0;
    const definition = FACTION_STRUCTURE_INFO['enchanted-grove'].definition;
    const previous = new Set(state.entities.map(entity => entity.id));
    const wallet = { wood: state.players[0].wood, ore: state.players[0].ore, crystal: state.players[0].crystal };
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'buildFactionStructure', ids: [worker.id], structure: 'enchanted-grove', x: 20.5, y: 20.5, level: 1 })).toBe(true);
    const grove = state.entities.find(entity => !previous.has(entity.id) && entity.definitionId === definition.id)!;
    expect(grove).toMatchObject({ progress: 0, level: 1 });
    expect(worker.order).toEqual({ type: 'build', target: grove.id });
    for (const kind of ['wood', 'ore', 'crystal'] as const) expect(state.players[0][kind]).toBe(wallet[kind] - definition.cost[kind]);
    until(state, () => grove.progress === 1, 30);
    refreshVisibility(state);
    until(state, () => state.entities.some(entity => entity.illusion), 1);
    const decoy = state.entities.find(entity => entity.illusion)!;
    expect(entityDefinition(state, decoy)).toEqual(entityDefinition(state, ally));
    const observed = new PlayerView(1).observe(state), falseTroop = observed.entities.find(entity => entity.id === decoy.id)!;
    expect(falseTroop).toBeDefined(); expect(falseTroop).not.toHaveProperty('illusion');
    expect(falseTroop.maxHp).toBe(FACTIONS.fairies.units.melee.hp);
    expect(isVisible(state, 1, ally.x, ally.y, ally.level ?? 0)).toBe(true);
    expect(canObserveTacticalEntity(state, 1, ally)).toBe(false);
    expect(observed.entities.some(entity => entity.id === ally.id)).toBe(false);
    const decoyHp = decoy.hp, allyHp = ally.hp;
    expect(issueCommand(state, 1, { type: 'attackMove', ids: [scout.id], x: grove.x, y: grove.y, level: 1 })).toBe(true);
    let chosenHit: GameEvent | undefined;
    for (let tick = 0; tick < 200 && !chosenHit; tick++) {
      stepGame(state, .05);
      chosenHit = state.events.find(event => event.type === 'attack' && event.source === scout.id && (event.amount ?? 0) > 0);
    }
    expect(chosenHit).toBeDefined(); expect(chosenHit!.target).toBe(decoy.id);
    expect(decoy.hp).toBeLessThan(decoyHp);
    expect(ally.hp).toBe(allyHp);
    expect(isVisible(state, 1, ally.x, ally.y, ally.level ?? 0)).toBe(true);
    expect(canObserveTacticalEntity(state, 1, ally)).toBe(false);
    expect(new PlayerView(1).observe(state).entities.some(entity => entity.id === ally.id)).toBe(false);
  });
});
