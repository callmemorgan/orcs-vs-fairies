import { describe, expect, it } from 'vitest';
import { buildingFor, unitFor } from '../src/core/content-registry';
import { economicState, ECONOMY_RULES } from '../src/core/economy';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame, SAVE_VERSION } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { BuildingRole, Cost, Entity, GameState, MatchRulesInput, Side } from '../src/core/types';

const DT = 0.05;
const resourceKinds = ['wood', 'ore', 'crystal'] as const;

function wallet(state: GameState, side: Side = 0): Cost {
  const player = state.players[side];
  return { wood: player.wood, ore: player.ore, crystal: player.crystal };
}

function expectPayment(state: GameState, before: Cost, cost: Cost): void {
  for (const kind of resourceKinds) expect(state.players[0][kind]).toBe(before[kind] - cost[kind]);
}

function tick(state: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i++) stepGame(state, DT);
}

function until(state: GameState, done: () => boolean, limit = 2000): void {
  for (let i = 0; i < limit && !done(); i++) stepGame(state, DT);
  expect(done(), `condition did not finish within ${limit} public simulation steps`).toBe(true);
}

function fixture(rules: MatchRulesInput = {}): GameState {
  const state = createMatch({
    map: { seed: 4127, size: 'medium' },
    players: [
      { id: 0, teamId: 0, factionId: 'orcs', controller: 'external', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 500 } } },
      { id: 1, teamId: 1, factionId: 'fairies', controller: 'external', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 500 } } },
    ],
    rules: { startingAge: 3, ...rules },
  });
  // Terrain and resources are fixture inputs; entities and production use the public runtime.
  state.terrain.fill('grass');
  state.resources = [];
  refreshVisibility(state);
  return state;
}

function startingHq(state: GameState): Entity {
  return state.entities.find(entity => entity.side === 0 && entity.kind === 'building' && entity.role === 'hq')!;
}

function build(state: GameState, role: Extract<BuildingRole, 'hq' | 'barracks'>, x: number, y: number): Entity {
  const worker = state.entities.find(entity => entity.side === 0 && entity.kind === 'unit' && entity.role === 'worker')!;
  const definition = buildingFor(state, 0, role);
  expect(issueCommand(state, 0, { type: 'move', ids: [worker.id], x: x - 3, y })).toBe(true);
  until(state, () => worker.order.type === 'idle');
  const before = wallet(state);
  const previousIds = new Set(state.entities.map(entity => entity.id));
  expect(issueCommand(state, 0, { type: 'build', ids: [worker.id], role, definitionId: definition.id, x, y })).toBe(true);
  expectPayment(state, before, definition.cost);
  const created = state.entities.filter(entity => !previousIds.has(entity.id));
  expect(created).toHaveLength(1);
  const producer = created[0];
  expect(producer.definitionId).toBe(definition.id);
  expect(buildingFor(state, producer)).toEqual(definition);
  expect(economicState(state)!.paidCosts.find(record => record.entityId === producer.id)?.stock).toEqual(definition.cost);
  until(state, () => producer.progress === 1);
  expect(issueCommand(state, 0, { type: 'hold', ids: [worker.id] })).toBe(true);
  return producer;
}

function producers(state: GameState): { expansion: Entity; military: Entity; ordinary: Entity } {
  const start = startingHq(state);
  const expansion = build(state, 'hq', start.x + 20, start.y);
  const military = build(state, 'barracks', expansion.x, expansion.y + 6);
  const ordinary = build(state, 'barracks', start.x, start.y + 9);
  expect(Math.hypot(expansion.x - start.x, expansion.y - start.y)).toBeGreaterThan(8);
  expect(Math.hypot(military.x - expansion.x, military.y - expansion.y)).toBeLessThan(ECONOMY_RULES.specialization.radius);
  expect(Math.hypot(military.x - start.x, military.y - start.y)).toBeGreaterThan(ECONOMY_RULES.specialization.radius);
  expect(Math.hypot(ordinary.x - expansion.x, ordinary.y - expansion.y)).toBeGreaterThan(ECONOMY_RULES.specialization.radius);
  expect(Math.hypot(ordinary.x - start.x, ordinary.y - start.y)).toBeLessThan(ECONOMY_RULES.specialization.radius);
  expect(military.side).toBe(ordinary.side);
  expect(buildingFor(state, military).id).toBe(buildingFor(state, ordinary).id);
  return { expansion, military, ordinary };
}

function specialize(state: GameState, expansion: Entity): void {
  const before = wallet(state);
  expect(ECONOMY_RULES.specialization.cost).toEqual({ wood: 120, ore: 80, crystal: 30 });
  expect(issueCommand(state, 0, { type: 'specializeSettlement', id: expansion.id, kind: 'military' })).toBe(true);
  expectPayment(state, before, ECONOMY_RULES.specialization.cost);
  expect(economicState(state)!.specializations).toEqual([{ entityId: expansion.id, kind: 'military' }]);
}

describe('military settlement production through the public runtime', () => {
  it('finishes the same paid unit earlier at a local producer and preserves the full save and command replay', () => {
    const state = fixture({ disabledDefinitionIds: ['orc-siege'] });
    const initialWallet = wallet(state);
    const recorder = new MatchRecorder(state);
    let replay: ReplayPlayer | undefined;
    try {
      const { expansion, military, ordinary } = producers(state);
      const beforeSpecialization = saveGame(state);
      expect(issueCommand(state, 1, { type: 'specializeSettlement', id: expansion.id, kind: 'military' })).toBe(false);
      expect(issueCommand(state, 1, { type: 'train', id: military.id, role: 'melee', definitionId: 'orc-melee' })).toBe(false);
      expect(saveGame(state)).toEqual(beforeSpecialization);
      specialize(state, expansion);
      const specialized = saveGame(state);
      expect(issueCommand(state, 0, { type: 'specializeSettlement', id: expansion.id, kind: 'research' })).toBe(false);
      expect(saveGame(state)).toEqual(specialized);
      for (const producer of [military, ordinary]) {
        expect(issueCommand(state, 0, { type: 'train', id: producer.id, role: 'siege', definitionId: 'orc-siege' })).toBe(false);
        expect(saveGame(state)).toEqual(specialized);
      }

      const definition = unitFor(state, 0, 'melee', 'orc-melee');
      expect(definition.cost).toEqual({ wood: 70, ore: 25, crystal: 0 });
      const initialUnitIds = new Set(state.entities.filter(entity => entity.kind === 'unit').map(entity => entity.id));
      for (const producer of [military, ordinary]) {
        const before = wallet(state);
        expect(issueCommand(state, 0, { type: 'train', id: producer.id, role: definition.role, definitionId: definition.id })).toBe(true);
        expectPayment(state, before, definition.cost);
        expect(producer.queueDefinitionIds).toEqual([definition.id]);
        expect(producer.queuePaidCosts).toEqual([definition.cost]);
      }
      const paidWallet = wallet(state);
      const constructionCosts = [buildingFor(state, expansion).cost, buildingFor(state, military).cost, buildingFor(state, ordinary).cost];
      for (const kind of resourceKinds) {
        expect(paidWallet[kind]).toBe(initialWallet[kind] - constructionCosts.reduce((total, cost) => total + cost[kind], 0) - ECONOMY_RULES.specialization.cost[kind] - 2 * definition.cost[kind]);
      }
      const queuedAt = state.tick;
      tick(state, 100);
      expect(military.trainProgress).toBeCloseTo(5 * ECONOMY_RULES.specialization.military / definition.trainTime, 12);
      expect(ordinary.trainProgress).toBeCloseTo(5 / definition.trainTime, 12);
      expect(military.trainProgress / ordinary.trainProgress).toBeCloseTo(1.3, 12);
      expect(military.queue).toHaveLength(1);
      expect(ordinary.queue).toHaveLength(1);

      const checkpoint = saveGame(state);
      expect(checkpoint.version).toBe(SAVE_VERSION);
      const restored = loadGame(checkpoint);
      expect(saveGame(restored)).toEqual(checkpoint);
      let militaryCompletion = 0;
      let ordinaryCompletion = 0;
      for (let i = 0; i < 1000 && ordinary.queue.length; i++) {
        stepGame(state, DT);
        stepGame(restored, DT);
        if (!military.queue.length && !militaryCompletion) {
          militaryCompletion = state.tick - queuedAt;
          expect(ordinary.queue).toEqual([definition.role]);
          expect(ordinary.trainProgress).toBeLessThan(1);
          const units = state.entities.filter(entity => entity.kind === 'unit' && !initialUnitIds.has(entity.id));
          expect(units).toHaveLength(1);
          expect(units[0].side).toBe(0);
          expect(unitFor(state, units[0]).id).toBe(definition.id);
          expect(Math.hypot(units[0].x - military.x, units[0].y - military.y)).toBeLessThan(4);
          expect(saveGame(restored)).toEqual(saveGame(state));
        }
        if (!ordinary.queue.length) ordinaryCompletion = state.tick - queuedAt;
      }
      const expectedMilitaryTicks = Math.ceil(definition.trainTime / (DT * ECONOMY_RULES.specialization.military));
      const expectedOrdinaryTicks = Math.ceil(definition.trainTime / DT);
      expect(militaryCompletion).toBeGreaterThanOrEqual(expectedMilitaryTicks);
      expect(militaryCompletion).toBeLessThanOrEqual(expectedMilitaryTicks + 1);
      expect(ordinaryCompletion).toBeGreaterThanOrEqual(expectedOrdinaryTicks);
      expect(ordinaryCompletion).toBeLessThanOrEqual(expectedOrdinaryTicks + 1);
      expect(militaryCompletion).toBeLessThan(ordinaryCompletion);
      expect(saveGame(restored)).toEqual(saveGame(state));

      tick(state, 400);
      tick(restored, 400);
      const trained = state.entities.filter(entity => entity.kind === 'unit' && !initialUnitIds.has(entity.id));
      expect(trained).toHaveLength(2);
      expect(trained.map(entity => [entity.side, unitFor(state, entity).id])).toEqual([[0, definition.id], [0, definition.id]]);
      for (const entity of trained) expect(economicState(state)!.paidCosts.find(record => record.entityId === entity.id)?.stock).toEqual(definition.cost);
      expect(military.queue).toEqual([]);
      expect(ordinary.queue).toEqual([]);
      expect(wallet(state)).toEqual(paidWallet);
      expect(wallet(state, 1)).toEqual({ wood: 5000, ore: 5000, crystal: 500 });
      expect(saveGame(restored)).toEqual(saveGame(state));

      const archive = recorder.export();
      const commands = archive.actions.filter(action => action.type === 'command');
      expect(commands.filter(action => action.command.type === 'build')).toHaveLength(3);
      expect(commands.filter(action => action.command.type === 'specializeSettlement').map(action => action.command)).toEqual([{ type: 'specializeSettlement', id: expansion.id, kind: 'military' }]);
      expect(commands.filter(action => action.command.type === 'train').map(action => action.command)).toEqual([military, ordinary].map(producer => ({ type: 'train', id: producer.id, role: definition.role, definitionId: definition.id })));
      replay = new ReplayPlayer(archive);
      while (!replay.finished) replay.advance(200);
      expect(saveGame(replay.state)).toEqual(saveGame(state));
    } finally {
      replay?.dispose();
      recorder.dispose();
    }
  });

  it('keeps unpicked and foreign recruits rejected after public draft completion and military specialization', () => {
    const state = fixture({ draft: { enabled: true, banRounds: 0, pickRounds: 1 } });
    const initial = saveGame(state);
    expect(issueCommand(state, 0, { type: 'train', id: startingHq(state).id, role: 'worker', definitionId: 'orc-worker' })).toBe(false);
    expect(saveGame(state)).toEqual(initial);
    expect(state.draft.pool).toContain('orc-melee');
    expect(issueCommand(state, 0, { type: 'draftChoice', definitionId: 'orc-ranged' })).toBe(true);
    expect(issueCommand(state, 1, { type: 'draftChoice', definitionId: 'fairy-ranged' })).toBe(true);
    expect(state.draft.status).toBe('complete');
    expect(state.draft.picks).toEqual([['orc-ranged'], ['fairy-ranged']]);

    const { expansion, military, ordinary } = producers(state);
    specialize(state, expansion);
    for (const producer of [military, ordinary]) {
      for (const [role, definitionId] of [['melee', 'orc-melee'], ['spear', 'orc-spear']] as const) {
        const before = saveGame(state);
        expect(issueCommand(state, 0, { type: 'train', id: producer.id, role, definitionId })).toBe(false);
        expect(saveGame(state)).toEqual(before);
      }
      const beforeForeign = saveGame(state);
      expect(issueCommand(state, 1, { type: 'train', id: producer.id, role: 'ranged', definitionId: 'fairy-ranged' })).toBe(false);
      expect(saveGame(state)).toEqual(beforeForeign);
    }
    const definition = unitFor(state, 0, 'ranged', 'orc-ranged');
    const beforeIds = new Set(state.entities.map(entity => entity.id));
    for (const producer of [military, ordinary]) {
      const before = wallet(state);
      expect(issueCommand(state, 0, { type: 'train', id: producer.id, role: definition.role, definitionId: definition.id })).toBe(true);
      expectPayment(state, before, definition.cost);
    }
    const paidWallet = wallet(state);
    tick(state, 100);
    expect(military.trainProgress).toBeCloseTo(5 * ECONOMY_RULES.specialization.military / definition.trainTime, 12);
    expect(ordinary.trainProgress).toBeCloseTo(5 / definition.trainTime, 12);
    until(state, () => military.queue.length === 0);
    expect(ordinary.queue).toEqual([definition.role]);
    expect(state.entities.filter(entity => !beforeIds.has(entity.id))).toHaveLength(1);
    until(state, () => ordinary.queue.length === 0);
    tick(state, 100);
    const trained = state.entities.filter(entity => !beforeIds.has(entity.id));
    expect(trained).toHaveLength(2);
    expect(trained.map(entity => unitFor(state, entity).id)).toEqual([definition.id, definition.id]);
    expect(wallet(state)).toEqual(paidWallet);
    expect(saveGame(loadGame(saveGame(state)))).toEqual(saveGame(state));
  });
});
