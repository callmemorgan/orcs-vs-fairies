import { describe, expect, it } from 'vitest';
import { coachAdvice, COACH_THRESHOLDS, COACH_TOPIC_TITLES, createCoachMemory, dismissCoachAdvice } from '../src/core/coach';
import type { CoachTopic } from '../src/core/coach';
import { FACTIONS } from '../src/core/content';
import { PlayerView } from '../src/core/observation';
import { canPlace, createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { BuildingRole, Entity, Side } from '../src/core/types';

function fixture(populationCap = 100) {
  const state = createMatch({ map: { seed: 91387, size: 'huge' }, players: [
    { id: 0, teamId: 0, factionId: 'orcs', controller: 'external', handicap: { populationCap } },
    { id: 1, teamId: 1, factionId: 'fairies', controller: 'external' },
    { id: 2, teamId: 0, factionId: 'dwarves', controller: 'external' },
  ], rules: { sharedVision: false } });
  state.terrain.fill('grass'); state.resources = [];
  for (const entity of state.entities) {
    if (entity.side === 0) { entity.x = 15.5 + entity.id % 4 * 1.5; entity.y = 20.5 + (entity.id % 3 - 1) * 1.5; }
    else { entity.x = state.width - (entity.side === 1 ? 12 : 35); entity.y = state.height - 12 + entity.id % 5; }
  }
  const headquarters = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  headquarters.x = 15.5; headquarters.y = 20.5;
  const workers = state.entities.filter(entity => entity.side === 0 && entity.role === 'worker');
  const view = new PlayerView(0), memory = createCoachMemory(0);
  refreshVisibility(state);
  return { state, headquarters, workers, view, memory };
}
type Fixture = ReturnType<typeof fixture>;
const advice = ({ state, view, memory }: Fixture, limit = 6) => coachAdvice(view.observe(state), memory, limit);
const topic = (setup: Fixture, id: CoachTopic) => advice(setup).find(item => item.id === id);
function advance(state: Fixture['state'], seconds: number) { for (let index = 0; index < seconds * 4; index++) stepGame(state, .25); }
function fund(state: Fixture['state']) { Object.assign(state.players[0], { wood: 5000, ore: 5000, crystal: 5000 }); }
function node(setup: Fixture, amount = 500) {
  const resource = { id: setup.state.nextId++, x: 22.5, y: 20.5, kind: 'wood' as const, amount, maxAmount: amount };
  setup.state.resources.push(resource); refreshVisibility(setup.state); return resource;
}
function construction(setup: Fixture, role: BuildingRole, x = 23.5, y = 20.5) {
  fund(setup.state);
  expect(canPlace(setup.state, 0, role, x, y)).toBe(true);
  expect(issueCommand(setup.state, 0, { type: 'build', ids: [setup.workers[0].id], role, x, y })).toBe(true);
  const building = setup.state.entities.find(entity => entity.side === 0 && entity.role === role && entity.x === x && entity.y === y)!;
  for (let count = 0; count < 1600 && building.progress < 1; count++) stepGame(setup.state, .25);
  expect(building.progress).toBe(1);
  return building;
}
function army(setup: Fixture, count = 5) {
  const template = setup.state.entities.find(entity => entity.side === 0 && entity.role === 'melee')!;
  setup.state.entities = setup.state.entities.filter(entity => entity.side !== 0 || entity.role !== 'melee');
  const soldiers: Entity[] = Array.from({ length: count }, (_, index) => ({ ...structuredClone(template), id: setup.state.nextId++, x: 18.5 + index * 4, y: 30.5, order: { type: 'hold' }, cooldown: 0 }));
  setup.state.entities.push(...soldiers);
  setup.state.explored[0] = new Set(Array.from({ length: setup.state.width * setup.state.height }, (_, index) => index));
  refreshVisibility(setup.state);
  return soldiers;
}

describe('observation-only practice advice', () => {
  it('waits 30 simulation seconds before idle and bank advice', () => {
    const setup = fixture(); fund(setup.state);
    advance(setup.state, 29.75);
    expect(advice(setup)).toEqual([]);
    stepGame(setup.state, .25);
    expect(topic(setup, 'idle-workers')?.message).toContain('5 workers');
    expect(topic(setup, 'idle-production')).toBeDefined();
    expect(topic(setup, 'unused-resources')).toBeDefined();
  });

  it('assigning real gathering removes idle advice and produces income', () => {
    const setup = fixture(), resource = node(setup);
    advance(setup.state, 30);
    expect(topic(setup, 'idle-workers')?.entityIds).toEqual(setup.workers.map(worker => worker.id));
    const before = setup.state.players[0].wood;
    expect(issueCommand(setup.state, 0, { type: 'gather', ids: setup.workers.map(worker => worker.id), target: resource.id })).toBe(true);
    expect(topic(setup, 'idle-workers')).toBeUndefined();
    advance(setup.state, 25);
    expect(setup.state.players[0].wood).toBeGreaterThan(before);
    expect(topic(setup, 'idle-workers')).toBeUndefined();
  });

  it('preserves cargo and finite or queued worker work', () => {
    const setup = fixture(); advance(setup.state, 30);
    setup.workers[0].carried = 1;
    setup.workers[1].orderQueue = [{ type: 'move', x: 25.5, y: 20.5 }];
    setup.workers[2].order = { type: 'move', x: 25.5, y: 20.5 };
    setup.workers[3].order = { type: 'build', target: setup.headquarters.id };
    setup.workers[4].order = { type: 'hold' };
    expect(topic(setup, 'idle-workers')?.entityIds).toEqual([setup.workers[4].id]);
    expect(setup.workers[1].orderQueue).toEqual([{ type: 'move', x: 25.5, y: 20.5 }]);
    expect(setup.workers[0].carried).toBe(1);
  });

  it('does not call idle workers who are firing, recently hurt, or near a visible enemy', () => {
    const setup = fixture(); advance(setup.state, 30);
    setup.workers[0].cooldown = .5;
    setup.workers[1].lastDamagedAt = setup.state.time - 1;
    const enemy = setup.state.entities.find(entity => entity.side === 1 && entity.role === 'melee')!;
    enemy.x = setup.workers[2].x + 1; enemy.y = setup.workers[2].y;
    refreshVisibility(setup.state);
    expect(topic(setup, 'idle-workers')).toBeUndefined();
  });

  it('training through the actual command removes idle production and recruits a worker', () => {
    const setup = fixture(); advance(setup.state, 30);
    expect(topic(setup, 'idle-production')?.entityIds).toEqual([setup.headquarters.id]);
    expect(issueCommand(setup.state, 0, { type: 'train', id: setup.headquarters.id, role: 'worker' })).toBe(true);
    expect(topic(setup, 'idle-production')).toBeUndefined();
    const population = setup.state.players[0].population;
    advance(setup.state, FACTIONS.orcs.units.worker.trainTime + 1);
    expect(setup.state.players[0].population).toBe(population + 1);
  });

  it('needs a completed, empty, affordable production queue without research', () => {
    const setup = fixture(); advance(setup.state, 30);
    setup.headquarters.progress = .9;
    expect(topic(setup, 'idle-production')).toBeUndefined();
    setup.headquarters.progress = 1; setup.headquarters.research = 'worker-speed';
    expect(topic(setup, 'idle-production')).toBeUndefined();
    setup.headquarters.research = undefined;
    setup.state.players[0].wood = 49;
    expect(topic(setup, 'idle-production')).toBeUndefined();
    setup.state.players[0].wood = 50;
    expect(topic(setup, 'idle-production')?.message).toContain(`${FACTIONS.orcs.units.worker.name} (50 wood)`);
  });

  it('does not advertise a barracks unit locked by the current age', () => {
    const setup = fixture(), barracks = construction(setup, 'barracks');
    setup.headquarters.queue = ['worker'];
    const observation = setup.view.observe(setup.state);
    observation.content = structuredClone(observation.content);
    for (const definition of Object.values(observation.content.faction.units)) if (definition.role !== 'worker') definition.age = 3;
    expect(coachAdvice(observation, setup.memory, 6).find(item => item.id === 'idle-production')).toBeUndefined();
    observation.player.upgrades = ['town-age', 'citadel-age'];
    expect(coachAdvice(observation, setup.memory, 6).find(item => item.id === 'idle-production')?.entityIds).toEqual([barracks.id]);
  });

  it('counts paid recruitment reservations and a real completed depot cures supply advice', () => {
    const setup = fixture(), barracks = construction(setup, 'barracks');
    for (let index = 0; index < 5; index++) expect(issueCommand(setup.state, 0, { type: 'train', id: setup.headquarters.id, role: 'worker' })).toBe(true);
    expect(issueCommand(setup.state, 0, { type: 'train', id: barracks.id, role: 'melee' })).toBe(true);
    expect(topic(setup, 'supply-blocked')?.message).toContain('6 population and 6 queued recruits use 12/12 capacity');
    expect(topic(setup, 'supply-blocked')?.message).toContain('one free population slot');
    expect(issueCommand(setup.state, 0, { type: 'train', id: barracks.id, role: 'melee' })).toBe(false);
    const depot = construction(setup, 'depot', 22.5, 15.5);
    expect(depot.progress).toBe(1);
    expect(setup.state.players[0].cap).toBe(22);
    expect(topic(setup, 'supply-blocked')).toBeUndefined();
    expect(issueCommand(setup.state, 0, { type: 'train', id: barracks.id, role: 'melee' })).toBe(true);
  });

  it('uses the effective roster capacity without promising that a depot raises it', () => {
    const setup = fixture(6); advance(setup.state, 30);
    expect(topic(setup, 'supply-blocked')?.message).toContain('6/6 capacity');
    expect(topic(setup, 'supply-blocked')?.message).not.toMatch(/depot|build|housing|expand/i);
    construction(setup, 'depot');
    expect(setup.state.players[0].cap).toBe(6);
    expect(topic(setup, 'supply-blocked')).toBeDefined();
  });

  it('warns about supply only for an eligible affordable recruit with queue room', () => {
    const setup = fixture(6); advance(setup.state, 30);
    setup.state.players[0].wood = 49;
    expect(topic(setup, 'supply-blocked')).toBeUndefined();
    setup.state.players[0].wood = 50;
    expect(topic(setup, 'supply-blocked')).toBeDefined();
    setup.headquarters.queue = Array(5).fill('worker');
    expect(topic(setup, 'supply-blocked')).toBeUndefined();
    setup.headquarters.queue = []; setup.headquarters.progress = .5;
    expect(topic(setup, 'supply-blocked')).toBeUndefined();
  });

  it('reports concrete banks only at a threshold and with available spending', () => {
    const setup = fixture(); advance(setup.state, 30);
    Object.assign(setup.state.players[0], { wood: 399, ore: 299, crystal: 99 });
    expect(topic(setup, 'unused-resources')).toBeUndefined();
    setup.state.players[0].wood = 400;
    expect(topic(setup, 'unused-resources')?.message).toContain('400 wood, 299 ore and 99 crystal');
    expect(topic(setup, 'unused-resources')?.message).toContain(`recruit ${FACTIONS.orcs.units.worker.name} (50 wood)`);
    setup.headquarters.queue = Array(5).fill('worker'); setup.headquarters.research = 'town-age';
    expect(topic(setup, 'unused-resources')).toBeUndefined();
  });

  it('can suggest legal research when recruitment is supply blocked', () => {
    const setup = fixture(6); fund(setup.state); advance(setup.state, 30);
    const item = topic(setup, 'unused-resources');
    expect(item?.message).toContain('research Town Age (260 wood, 180 ore)');
    expect(issueCommand(setup.state, 0, { type: 'research', id: setup.headquarters.id, upgrade: 'town-age' })).toBe(true);
    expect(topic(setup, 'unused-resources')).toBeUndefined();
  });

  it('uses observed upgrade prerequisites and excludes research already in progress', () => {
    const setup = fixture(6), barracks = construction(setup, 'barracks');
    setup.headquarters.research = 'town-age';
    expect(topic(setup, 'unused-resources')).toBeUndefined();
    setup.state.players[0].upgrades.push('town-age');
    expect(topic(setup, 'unused-resources')?.message).toContain('research Forged Weapons');
    barracks.research = 'forged-weapons';
    expect(topic(setup, 'unused-resources')).toBeUndefined();
  });

  it('waits 90 seconds before using explored coverage and a known frontier for scouting', () => {
    const setup = fixture(); advance(setup.state, 89.75);
    expect(topic(setup, 'scouting')).toBeUndefined();
    stepGame(setup.state, .25);
    const item = topic(setup, 'scouting')!, observed = setup.view.observe(setup.state);
    expect(item).toBeDefined();
    const index = Math.floor(item.point!.y) * setup.state.width + Math.floor(item.point!.x);
    expect(observed.explored).toContain(index);
    expect(observed.map.terrain[index]).toBe('grass');
    expect(item.message).toContain(`${Math.floor(observed.explored.length / (setup.state.width * setup.state.height) * 100)}%`);
    expect(item.message).toContain('90 seconds');
    setup.state.explored[0] = new Set(Array.from({ length: Math.ceil(setup.state.width * setup.state.height * .35) }, (_, index) => index));
    expect(topic(setup, 'scouting')).toBeUndefined();
  });

  it('respects a real scout move toward fog and never promises a route', () => {
    const setup = fixture(); advance(setup.state, 90);
    expect(topic(setup, 'scouting')).toBeDefined();
    const scout = setup.state.entities.find(entity => entity.side === 0 && entity.role === 'melee')!;
    expect(issueCommand(setup.state, 0, { type: 'move', ids: [scout.id], x: 42.5, y: 20.5 })).toBe(true);
    expect(topic(setup, 'scouting')).toBeUndefined();
    expect(advice(setup).some(item => /reachable|safe route|clear route/i.test(item.message))).toBe(false);
  });

  it('also respects an intentional worker scout and queued scouting', () => {
    const setup = fixture(); advance(setup.state, 90);
    setup.workers[0].orderQueue = [{ type: 'move', x: 42.5, y: 20.5 }];
    expect(topic(setup, 'scouting')).toBeUndefined();
  });

  it('requires five waiting real troops spread more than 12 tiles for cohesion', () => {
    const setup = fixture(), soldiers = army(setup);
    const item = topic(setup, 'army-cohesion')!;
    expect(item.entityIds).toEqual(soldiers.map(soldier => soldier.id));
    expect(item.message).toContain('5 waiting troops span 16.0 tiles');
    soldiers[4].x = soldiers[0].x + 12; soldiers[3].x = soldiers[0].x + 9;
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
    soldiers[4].x += .01;
    expect(topic(setup, 'army-cohesion')).toBeDefined();
    soldiers[4].illusion = true;
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
    soldiers[4].illusion = false; soldiers[4].raised = true;
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
  });

  it('excludes moving scouts, queued troops, recent damage and visible combat from cohesion', () => {
    const setup = fixture(), soldiers = army(setup);
    for (const order of [{ type: 'move', x: 50.5, y: 30.5 }, { type: 'attackMove', x: 50.5, y: 30.5 }] as const) {
      soldiers[4].order = order;
      expect(topic(setup, 'army-cohesion')).toBeUndefined();
    }
    soldiers[4].order = { type: 'hold' }; soldiers[4].orderQueue = [{ type: 'move', x: 40.5, y: 30.5 }];
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
    soldiers[4].orderQueue = []; soldiers[4].cooldown = .1;
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
    soldiers[4].cooldown = 0; soldiers[4].lastDamagedAt = setup.state.time;
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
    advance(setup.state, 6);
    expect(topic(setup, 'army-cohesion')).toBeDefined();
    const enemy = setup.state.entities.find(entity => entity.side === 1 && entity.role === 'hq')!;
    enemy.x = soldiers[4].x + 5; enemy.y = soldiers[4].y;
    refreshVisibility(setup.state);
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
  });

  it('does not mistake a stationary unit watching fog far from base for broken cohesion', () => {
    const setup = fixture(), soldiers = army(setup);
    setup.state.explored[0].clear(); refreshVisibility(setup.state);
    expect(topic(setup, 'army-cohesion')).toBeUndefined();
    expect(soldiers).toHaveLength(5);
  });

  it('anchors regroup advice to an existing troop when the group midpoint is water', () => {
    const setup = fixture(), soldiers = army(setup);
    const positions = [{ x: 30.5, y: 40.5 }, { x: 30.5, y: 41.5 }, { x: 50.5, y: 40.5 }, { x: 50.5, y: 41.5 }, { x: 50.5, y: 42.5 }];
    soldiers.forEach((soldier, index) => Object.assign(soldier, positions[index]));
    for (let y = 0; y < setup.state.height; y++) setup.state.terrain[y * setup.state.width + 42] = 'water';
    refreshVisibility(setup.state);
    const item = topic(setup, 'army-cohesion')!;
    expect(item).toBeDefined();
    expect(positions).toContainEqual(item.point);
    const tile = Math.floor(item.point!.y) * setup.state.width + Math.floor(item.point!.x);
    expect(setup.view.observe(setup.state).map.terrain[tile]).toBe('grass');
  });

  it('uses team relations and includes only positive living owned real entity IDs', () => {
    const setup = fixture(), soldiers = army(setup);
    const ally = setup.state.entities.find(entity => entity.side === 2 && entity.role === 'melee')!;
    ally.x = soldiers[4].x; ally.y = soldiers[4].y;
    refreshVisibility(setup.state);
    expect(topic(setup, 'army-cohesion')).toBeDefined();
    setup.state.entities.push({ ...structuredClone(soldiers[0]), id: setup.state.nextId++, side: 2 }, { ...structuredClone(soldiers[0]), id: -1 }, { ...structuredClone(soldiers[0]), id: setup.state.nextId++, hp: 0 }, { ...structuredClone(soldiers[0]), id: setup.state.nextId++, illusion: true });
    const eligible = new Set(setup.state.entities.filter(entity => entity.side === 0 && entity.hp > 0 && entity.id > 0 && !entity.illusion && !entity.raised).map(entity => entity.id));
    for (const item of advice(setup)) for (const id of item.entityIds) expect(eligible.has(id)).toBe(true);
  });

  it('hidden enemy economy, orders, buildings and deposits cannot change advice or dismissal', () => {
    const setup = fixture(); fund(setup.state); advance(setup.state, 90);
    const firstView = setup.view.observe(setup.state), firstMemory = structuredClone(setup.memory);
    const firstAdvice = coachAdvice(firstView, firstMemory, 6);
    dismissCoachAdvice(firstMemory, 'idle-workers', firstView.time, 60);
    Object.assign(setup.state.players[1], { wood: 999999, ore: 777777, crystal: 123456, upgrades: ['town-age', 'citadel-age'] });
    for (const enemy of setup.state.entities.filter(entity => entity.side === 1)) { enemy.x -= 5; enemy.y -= 3; enemy.queue = ['siege']; enemy.order = { type: 'attack', target: setup.workers[0].id }; }
    setup.state.resources.push({ id: setup.state.nextId++, x: 80.5, y: 80.5, kind: 'ore', amount: 99999, maxAmount: 99999 });
    refreshVisibility(setup.state);
    const secondView = setup.view.observe(setup.state), secondMemory = structuredClone(setup.memory);
    expect(secondView).toEqual(firstView);
    expect(coachAdvice(secondView, secondMemory, 6)).toEqual(firstAdvice);
    dismissCoachAdvice(secondMemory, 'idle-workers', secondView.time, 60);
    expect(secondMemory).toEqual(firstMemory);
    expect(coachAdvice(secondView, secondMemory, 6)).toEqual(coachAdvice(firstView, firstMemory, 6));
  });

  it('dismissal waits for simulation time and expires at the exact cooldown boundary', () => {
    const setup = fixture(); advance(setup.state, 30);
    expect(topic(setup, 'idle-workers')).toBeDefined();
    dismissCoachAdvice(setup.memory, 'idle-workers', setup.state.time);
    for (let repeat = 0; repeat < 10; repeat++) expect(topic(setup, 'idle-workers')).toBeUndefined();
    advance(setup.state, 59.75);
    expect(topic(setup, 'idle-workers')).toBeUndefined();
    stepGame(setup.state, .25);
    expect(topic(setup, 'idle-workers')).toBeDefined();
    expect(setup.memory.dismissedUntil).not.toHaveProperty('idle-workers');
  });

  it('clears dismissals on a side switch and observation time rewind', () => {
    const setup = fixture(); advance(setup.state, 30);
    topic(setup, 'idle-workers'); dismissCoachAdvice(setup.memory, 'idle-workers', setup.state.time);
    setup.state.time = 29.75;
    advice(setup);
    expect(setup.memory.dismissedUntil).toEqual({});
    stepGame(setup.state, .25);
    expect(topic(setup, 'idle-workers')).toBeDefined();
    dismissCoachAdvice(setup.memory, 'idle-workers', setup.state.time);
    const switched = new PlayerView(2).observe(setup.state);
    expect(coachAdvice(switched, setup.memory, 6).find(item => item.id === 'idle-workers')).toBeDefined();
    expect(setup.memory.side).toBe(2);
    expect(setup.memory.dismissedUntil).toEqual({});
  });

  it('is deterministic at repeated ticks, respects limits and does not mutate observations', () => {
    const setup = fixture(); fund(setup.state); advance(setup.state, 90);
    const observation = setup.view.observe(setup.state), before = structuredClone(observation);
    const result = coachAdvice(observation, setup.memory, 6), memory = structuredClone(setup.memory);
    expect(coachAdvice(observation, setup.memory, 6)).toEqual(result);
    expect(setup.memory).toEqual(memory); expect(observation).toEqual(before);
    expect(coachAdvice(observation, setup.memory)).toEqual(result.slice(0, 3));
    expect(coachAdvice(observation, setup.memory, 0)).toEqual([]);
    expect(coachAdvice(observation, setup.memory, -1)).toEqual([]);
    expect(coachAdvice(observation, setup.memory, 1.9)).toEqual(result.slice(0, 1));
    expect(coachAdvice(observation, setup.memory, Infinity)).toEqual(result.slice(0, 3));
    for (const item of result) expect(item.title).toBe(COACH_TOPIC_TITLES[item.id]);
  });

  it('suppresses advice for eliminated players while their allied match continues', () => {
    const setup = fixture(); advance(setup.state, 90);
    setup.state.eliminated[0] = true;
    expect(setup.view.observe(setup.state).result.finished).toBe(false);
    expect(advice(setup)).toEqual([]);
    setup.state.eliminated[0] = false; setup.state.winningTeam = 0; setup.state.winner = 0;
    expect(advice(setup)).toEqual([]);
  });

  it('ignores invalid dismissal values and cannot create an infinite cooldown', () => {
    const memory = createCoachMemory(0), before = structuredClone(memory);
    for (const [time, duration] of [[NaN, 60], [-1, 60], [10, -1], [10, Infinity], [Number.MAX_VALUE, Number.MAX_VALUE]]) dismissCoachAdvice(memory, 'idle-workers', time, duration);
    dismissCoachAdvice(memory, 'unknown' as CoachTopic, 30);
    expect(memory).toEqual(before);
    dismissCoachAdvice(memory, 'idle-workers', 30, 0);
    expect(memory.dismissedUntil['idle-workers']).toBe(30);
    expect(() => createCoachMemory(8 as Side)).toThrow();
  });

  it('publishes the thresholds used by the advice rules', () => {
    expect(COACH_THRESHOLDS).toEqual({ idleGraceSeconds: 30, scoutingGraceSeconds: 90, scoutingExploredFraction: .35, armyMinimum: 5, armySpreadTiles: 12, recentDamageSeconds: 6, bank: { wood: 400, ore: 300, crystal: 100 } });
  });
});
