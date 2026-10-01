import { describe, expect, it } from 'vitest';
import { UPGRADES } from '../src/core/content';
import { contentHash, createContentBundle, decodeContentPackage } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { canCompleteResearch, researchRequirement } from '../src/core/progression';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { canPlace, createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { Age, Entity, GameState, UnitRole, UpgradeId } from '../src/core/types';

const advance = (state: GameState, seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 10); i++) stepGame(state, .1); };
function buildBarracks(state: GameState): Entity {
  const worker = state.entities.find(e => e.side === 0 && e.role === 'worker')!;
  for (let y = 2.5; y < state.height - 2; y++) for (let x = 2.5; x < state.width - 2; x++) {
    if (!canPlace(state, 0, 'barracks', x, y)) continue;
    expect(issueCommand(state, 0, { type: 'build', ids: [worker.id], role: 'barracks', x, y })).toBe(true);
    const building = state.entities.at(-1)!;
    advance(state, 70);
    expect(building.progress).toBe(1);
    return building;
  }
  throw new Error('No legal barracks site.');
}
function setup(age: Age = 3, custom = false) {
  const state = createMatch({ map: { seed: 4127, size: 'small' }, rules: { startingAge: age },
    ...(custom ? { content: createContentBundle([exampleMod()]) } : {}),
    players: [{ id: 0, teamId: 0, factionId: custom ? 'lantern:keepers' : 'fairies', controller: 'external', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 1000 } } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }] });
  return { state, barracks: buildBarracks(state), hq: state.entities.find(e => e.side === 0 && e.role === 'hq')! };
}
function research(state: GameState, building: Entity, id: UpgradeId) {
  expect(issueCommand(state, 0, { type: 'research', id: building.id, upgrade: id })).toBe(true);
  advance(state, UPGRADES[id]?.researchTime ?? 11);
  if (building.research) advance(state, .2);
  expect(state.players[0].upgrades).toContain(id);
}
function train(state: GameState, building: Entity, role: UnitRole, definitionId?: string): Entity {
  const before = new Set(state.entities.map(e => e.id));
  expect(issueCommand(state, 0, { type: 'train', id: building.id, role, ...(definitionId ? { definitionId } : {}) })).toBe(true);
  advance(state, 70);
  const unit = state.entities.find(e => e.kind === 'unit' && e.side === 0 && e.role === role && !before.has(e.id));
  expect(unit).toBeDefined();
  return unit!;
}
function hit(state: GameState, attackerId: number, targetId: number): number {
  const arena = loadGame(saveGame(state)), attacker = arena.entities.find(e => e.id === attackerId)!, target = arena.entities.find(e => e.id === targetId)!;
  arena.terrain.fill('grass'); arena.resources = [];
  Object.assign(attacker, { x: 20.5, y: 20.5, cooldown: 0, momentum: 0, order: { type: 'idle' } });
  Object.assign(target, { x: 21.5, y: 20.5, cooldown: 100, order: { type: 'hold' } });
  refreshVisibility(arena);
  expect(issueCommand(arena, target.side, { type: 'face', ids: [target.id], facing: 4 })).toBe(true);
  const before = target.hp;
  expect(issueCommand(arena, attacker.side, { type: 'attack', ids: [attacker.id], target: target.id })).toBe(true);
  stepGame(arena, .05);
  return before - target.hp;
}
function travel(state: GameState, id: number): number {
  const arena = loadGame(saveGame(state)), unit = arena.entities.find(e => e.id === id)!;
  arena.terrain.fill('grass'); arena.resources = [];
  Object.assign(unit, { x: 20.5, y: 20.5, order: { type: 'idle' }, path: [] });
  refreshVisibility(arena);
  expect(issueCommand(arena, 0, { type: 'move', ids: [unit.id], x: 30.5, y: 20.5 })).toBe(true);
  advance(arena, 1);
  return Math.hypot(unit.x - 20.5, unit.y - 20.5);
}

describe('exclusive research branches', () => {
  it('enforces age, prerequisite, building and paid cost before reserving a branch across barracks', () => {
    const { state, barracks, hq } = setup(2), second = buildBarracks(state);
    expect(researchRequirement(state, 0, 'core:ranged-focus')).toBe('Requires Citadel Age');
    research(state, hq, 'citadel-age');
    expect(researchRequirement(state, 0, 'core:ranged-focus')).toBe('Requires Ranged Arms');
    research(state, barracks, 'core:ranged-arms');
    expect(issueCommand(state, 0, { type: 'research', id: hq.id, upgrade: 'core:ranged-focus' })).toBe(false);
    const funds = { wood: state.players[0].wood, ore: state.players[0].ore, crystal: state.players[0].crystal }, cost = UPGRADES['core:ranged-focus'].cost;
    expect(issueCommand(state, 0, { type: 'research', id: barracks.id, upgrade: 'core:ranged-focus' })).toBe(true);
    for (const resource of ['wood', 'ore', 'crystal'] as const) expect(state.players[0][resource]).toBe(funds[resource] - cost[resource]);
    expect(barracks.researchPaidCost).toEqual(cost);
    expect(canCompleteResearch(state, 0, 'core:ranged-focus', barracks.id)).toBe(true);
    expect(researchRequirement(state, 0, 'core:ranged-mobility')).toBe('Locked while Focused Volleys is researching');
    const paid = state.players[0].wood;
    expect(issueCommand(state, 0, { type: 'research', id: second.id, upgrade: 'core:ranged-mobility' })).toBe(false);
    expect(state.players[0].wood).toBe(paid);
    advance(state, 46);
    expect(barracks.researchPaidCost).toBeUndefined();
    expect(researchRequirement(state, 0, 'core:ranged-mobility')).toBe('Locked by Focused Volleys');
    expect(issueCommand(state, 0, { type: 'research', id: second.id, upgrade: 'core:ranged-mobility' })).toBe(false);
  });

  it('rejects insufficient resources and an unfinished building without charging', () => {
    const { state, barracks } = setup();
    state.players[0].ore = 109;
    const wood = state.players[0].wood;
    expect(issueCommand(state, 0, { type: 'research', id: barracks.id, upgrade: 'core:ranged-arms' })).toBe(false);
    expect(state.players[0].wood).toBe(wood);
    state.players[0].ore = 5000; barracks.progress = .5;
    expect(issueCommand(state, 0, { type: 'research', id: barracks.id, upgrade: 'core:ranged-arms' })).toBe(false);
    expect(state.players[0].wood).toBe(wood);
  });

  it('rechecks completion and refunds the captured charge once after a forced conflicting choice', () => {
    const { state, barracks } = setup();
    research(state, barracks, 'core:ranged-arms');
    const wood = state.players[0].wood, ore = state.players[0].ore, crystal = state.players[0].crystal;
    expect(issueCommand(state, 0, { type: 'research', id: barracks.id, upgrade: 'core:ranged-focus' })).toBe(true);
    state.players[0].upgrades.push('core:ranged-mobility');
    expect(canCompleteResearch(state, 0, 'core:ranged-focus', barracks.id)).toBe(false);
    advance(state, 46);
    expect(state.players[0].upgrades).not.toContain('core:ranged-focus');
    expect(state.players[0]).toMatchObject({ wood, ore, crystal });
    expect(barracks.research).toBeUndefined();
    expect(barracks.researchPaidCost).toBeUndefined();
    advance(state, 1);
    expect(state.players[0]).toMatchObject({ wood, ore, crystal });
  });

  it('preserves pending reservations, original charges and the completed choice across save and replay', () => {
    const { state, barracks } = setup();
    research(state, barracks, 'core:ranged-arms');
    const recorder = new MatchRecorder(state);
    expect(issueCommand(state, 0, { type: 'research', id: barracks.id, upgrade: 'core:ranged-focus' })).toBe(true);
    advance(state, 4);
    const resumed = loadGame(saveGame(state));
    expect(resumed.entities.find(e => e.id === barracks.id)!.researchPaidCost).toEqual(UPGRADES['core:ranged-focus'].cost);
    expect(researchRequirement(resumed, 0, 'core:ranged-mobility')).toContain('Locked while');
    advance(state, 43); advance(resumed, 43);
    expect(saveGame(resumed)).toEqual(saveGame(state));
    const archive = recorder.export(); recorder.dispose();
    const replay = new ReplayPlayer(archive);
    while (!replay.finished) replay.advance(100);
    expect(saveGame(replay.state)).toEqual(saveGame(state));
    expect(researchRequirement(replay.state, 0, 'core:ranged-mobility')).toBe('Locked by Focused Volleys');
    replay.dispose();
  });

  it('rejects corrupt completed, pending and charged-cost conflicts during save loading', () => {
    const { state, barracks } = setup(), second = buildBarracks(state);
    research(state, barracks, 'core:ranged-arms');
    const saved = saveGame(state);
    const completed = structuredClone(saved);
    completed.state.players[0].upgrades.push('core:ranged-focus', 'core:ranged-mobility');
    expect(() => loadGame(completed)).toThrow('exclusive technology choices conflict');
    const pending = structuredClone(saved);
    pending.state.entities.find(e => e.id === barracks.id)!.research = 'core:ranged-focus';
    pending.state.entities.find(e => e.id === barracks.id)!.researchPaidCost = { ...UPGRADES['core:ranged-focus'].cost };
    pending.state.entities.find(e => e.id === second.id)!.research = 'core:ranged-mobility';
    pending.state.entities.find(e => e.id === second.id)!.researchPaidCost = { ...UPGRADES['core:ranged-mobility'].cost };
    expect(() => loadGame(pending)).toThrow('exclusive technology choice is already complete or being researched');
    const owned = structuredClone(saved);
    owned.state.players[0].upgrades.push('core:ranged-focus');
    owned.state.entities.find(e => e.id === barracks.id)!.research = 'core:ranged-mobility';
    owned.state.entities.find(e => e.id === barracks.id)!.researchPaidCost = { ...UPGRADES['core:ranged-mobility'].cost };
    expect(() => loadGame(owned)).toThrow('exclusive technology choice is already complete or being researched');
    const missingCharge = structuredClone(saved);
    missingCharge.state.entities.find(e => e.id === barracks.id)!.research = 'core:ranged-focus';
    expect(() => loadGame(missingCharge)).toThrow('exclusive research requires the original charged cost');
    const charged = structuredClone(saved), producer = charged.state.entities.find(e => e.id === barracks.id)!;
    producer.research = 'core:ranged-focus'; producer.researchPaidCost = { wood: 999, ore: 180, crystal: 25 };
    expect(() => loadGame(charged)).toThrow('charged cost differs from pinned research');
  });
});

describe('role-specific researched stats', () => {
  it('changes ranged combat damage, cavalry damage received and siege movement through ordinary research commands', () => {
    const { state, barracks } = setup();
    const ranged = train(state, barracks, 'ranged'), cavalry = train(state, barracks, 'cavalry'), siege = train(state, barracks, 'siege');
    const enemy = state.entities.find(e => e.side === 1 && e.role === 'melee')!;
    const beforeRanged = hit(state, ranged.id, enemy.id), beforeCavalry = hit(state, enemy.id, cavalry.id), beforeSiege = travel(state, siege.id);
    research(state, barracks, 'core:ranged-arms');
    expect(hit(state, ranged.id, enemy.id) - beforeRanged).toBeCloseTo(18 * .2);
    research(state, barracks, 'core:cavalry-barding');
    expect(beforeCavalry - hit(state, enemy.id, cavalry.id)).toBeCloseTo(2);
    research(state, barracks, 'core:siege-gears');
    expect(travel(state, siege.id) / beforeSiege).toBeCloseTo(1.3);
    research(state, barracks, 'core:ranged-focus');
    expect(hit(state, ranged.id, enemy.id)).toBeCloseTo(18 * 1.2 * 1.25 - 3);
  });

  it('applies the movement branch only to ranged units and keeps its damage branch locked', () => {
    const { state, barracks } = setup(), ranged = train(state, barracks, 'ranged'), cavalry = train(state, barracks, 'cavalry');
    const beforeRanged = travel(state, ranged.id), beforeCavalry = travel(state, cavalry.id);
    research(state, barracks, 'core:ranged-arms'); research(state, barracks, 'core:ranged-mobility');
    expect(travel(state, ranged.id) / beforeRanged).toBeCloseTo(1.25);
    expect(travel(state, cavalry.id)).toBeCloseTo(beforeCavalry);
    expect(researchRequirement(state, 0, 'core:ranged-focus')).toBe('Locked by Skirmish Drills');
  });

  it('admits definition targets and upgrades one custom melee definition without upgrading the other', () => {
    const pkg = JSON.parse(JSON.stringify(exampleMod()));
    pkg.factions[0].research[0].appliesToDefinitions = ['lantern:duelist'];
    pkg.factions[0].research[0].exclusiveGroup = 'lantern:blade-choice';
    const { hash: _, ...body } = pkg; pkg.hash = contentHash(body);
    const state = createMatch({ content: createContentBundle([pkg]), map: { seed: 4127, size: 'small' }, players: [
      { id: 0, teamId: 0, factionId: 'lantern:keepers', controller: 'external', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 1000 } } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }] });
    const barracks = buildBarracks(state), sentinel = train(state, barracks, 'melee', 'lantern:sentinel'), duelist = train(state, barracks, 'melee', 'lantern:duelist');
    const enemy = state.entities.find(e => e.side === 1 && e.role === 'melee')!;
    const sentinelDamage = hit(state, sentinel.id, enemy.id), duelistDamage = hit(state, duelist.id, enemy.id);
    research(state, barracks, 'lantern:bright-blades');
    expect(hit(state, sentinel.id, enemy.id)).toBeCloseTo(sentinelDamage);
    expect(hit(state, duelist.id, enemy.id) - duelistDamage).toBeCloseTo(24 * .4);
  });

  it('rejects invalid external choice groups and empty, duplicate, missing or wrong-role definition targets', () => {
    for (const change of [
      (pkg: any) => { pkg.factions[0].research[0].exclusiveGroup = 'x'.repeat(101); },
      (pkg: any) => { pkg.factions[0].research[0].appliesToDefinitions = []; },
      (pkg: any) => { pkg.factions[0].research[0].appliesToDefinitions = ['lantern:duelist', 'lantern:duelist']; },
      (pkg: any) => { pkg.factions[0].research[0].appliesToDefinitions = ['lantern:missing']; },
      (pkg: any) => { pkg.factions[0].research[0].appliesToDefinitions = ['fairy-ranged']; },
    ]) {
      const pkg = JSON.parse(JSON.stringify(exampleMod())); change(pkg);
      const { hash: _, ...body } = pkg; pkg.hash = contentHash(body);
      expect(() => createContentBundle([pkg])).toThrow();
    }
    const pkg = exampleMod();
    expect(decodeContentPackage(pkg).hash).toBe(pkg.hash);
  });
});
