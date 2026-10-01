import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { subscribeSimulation } from '../src/core/history-hooks';
import { route } from '../src/core/navigation';
import {
  addBlueprint, applyWorkerTargets, assignBlueprintWorkers, blueprintReason,
  cancelBlueprint, createConstructionPlan, createPlanningRuntime, decodeConstructionPlan,
  decodePlanningRuntime, executeBlueprints, syncConstructionPlan, validateWorkerTargets, workerAllocation,
} from '../src/core/planning';
import { canPlace, captureRuntime, createGame, isVisible, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { BuildingRole, Command, Entity, GameState, ResourceKind, Side } from '../src/core/types';

const targets = (wood = 0, ore = 0, crystal = 0) => ({ wood, ore, crystal });

function fixture(count = 5) {
  const state = createGame('orcs', 4127, 'fairies', { controllers: ['external', 'external'] });
  state.terrain.fill('grass');
  state.resources = [];
  const template = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
  state.entities = state.entities.filter(entity => entity.kind === 'building');
  const headquarters = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  headquarters.x = 15.5;
  headquarters.y = 20.5;
  const workers: Entity[] = Array.from({ length: count }, (_, index) => ({
    ...structuredClone(template), id: state.nextId++,
    x: 20.5 + index % 3 * .8, y: 20.5 + Math.floor(index / 3) * .8,
    order: { type: 'idle' },
  }));
  state.entities.push(...workers);
  refreshVisibility(state);
  return { state, workers, headquarters };
}

function node(state: GameState, kind: ResourceKind, x = 23.5, y = 20.5, amount = 100) {
  const resource = { id: state.nextId++, kind, x, y, amount, maxAmount: amount };
  state.resources.push(resource);
  return resource;
}

function building(state: GameState, role: BuildingRole, x: number, y: number) {
  const template = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  const definition = FACTIONS.orcs.buildings[role];
  const entity: Entity = {
    ...structuredClone(template), id: state.nextId++, role, x, y,
    hp: definition.hp, maxHp: definition.hp, queue: [], path: [],
  };
  state.entities.push(entity);
  return entity;
}

function commands(state: GameState) {
  const recorded: { side: Side; command: Command }[] = [];
  subscribeSimulation(state, { command: (side, command) => recorded.push({ side, command }) });
  return recorded;
}

function advance(state: GameState, seconds: number) {
  for (let index = 0; index < Math.ceil(seconds / .05); index++) stepGame(state, .05);
}

function funded(state: GameState) {
  Object.assign(state.players[0], { wood: 5000, ore: 5000, crystal: 5000 });
}

function expectCargoProtected(state: GameState, worker: Entity, desired = targets()) {
  const plan = createConstructionPlan(0);
  const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
  expect(assignBlueprintWorkers(state, 0, plan, item.id, [worker.id])).toBe(true);
  const reason = blueprintReason(state, 0, item);
  expect(reason).not.toBe('');
  const before = structuredClone(state);
  const runtime = captureRuntime(state);
  const recorded = commands(state);
  const target = worker.order.type === 'gather' ? worker.order.target : undefined;
  const current = state.resources.find(resource => resource.id === target);
  expect(current).toBeDefined();
  const assigned = targets();
  assigned[current!.kind] = 1;
  const unmet = targets(Math.max(0, desired.wood - assigned.wood), Math.max(0, desired.ore - assigned.ore), Math.max(0, desired.crystal - assigned.crystal));
  expect(workerAllocation(state, 0)).toMatchObject({ assigned, idle: 0, busy: 0, total: 1 });
  const result = applyWorkerTargets(state, 0, desired);
  expect(result).toMatchObject({ assigned, unmet, issued: [], idle: 0, busy: 0, total: 1 });
  expect(result.messages.join(' ')).toContain('deferred');
  expect(executeBlueprints(state, 0, plan)).toEqual({ started: [], pending: [{ id: item.id, reason }] });
  expect(state).toEqual(before);
  expect(captureRuntime(state)).toEqual(runtime);
  expect(recorded).toEqual([]);
}

describe('worker allocation', () => {
  it('counts owned living real workers and separates queued work from adjustable gathering', () => {
    const { state, workers } = fixture(4);
    const wood = node(state, 'wood');
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [workers[0].id], target: wood.id })).toBe(true);
    expect(issueCommand(state, 0, { type: 'gather', ids: [workers[1].id], target: wood.id })).toBe(true);
    expect(issueCommand(state, 0, { type: 'move', ids: [workers[1].id], x: 24.5, y: 23.5, queued: true })).toBe(true);
    expect(issueCommand(state, 0, { type: 'hold', ids: [workers[2].id] })).toBe(true);
    workers[3].order = { type: 'gather', target: -1 };
    state.entities.push(
      { ...structuredClone(workers[0]), id: state.nextId++, side: 1 },
      { ...structuredClone(workers[0]), id: state.nextId++, hp: 0 },
      { ...structuredClone(workers[0]), id: state.nextId++, illusion: true },
      { ...structuredClone(workers[0]), id: state.nextId++, role: 'melee' },
    );
    expect(workerAllocation(state, 0)).toMatchObject({ assigned: targets(1), idle: 2, busy: 1, total: 4 });
  });

  it('reassigns idle, held and unqueued gatherers without replacing protected orders', () => {
    const { state, workers } = fixture(8);
    const wood = node(state, 'wood', 24.5, 20.5);
    node(state, 'ore', 22.5, 24.5);
    node(state, 'crystal', 18.5, 24.5);
    const foundation = building(state, 'depot', 24.5, 17.5);
    foundation.progress = .5;
    foundation.hp /= 2;
    const foe: Entity = { ...structuredClone(workers[0]), id: state.nextId++, side: 1, x: 26.5, order: { type: 'hold' } };
    state.entities.push(foe);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [workers[0].id, workers[1].id], target: wood.id })).toBe(true);
    expect(issueCommand(state, 0, { type: 'move', ids: [workers[1].id], x: 22.5, y: 23.5, queued: true })).toBe(true);
    expect(issueCommand(state, 0, { type: 'repair', ids: [workers[2].id], target: foundation.id })).toBe(true);
    expect(issueCommand(state, 0, { type: 'move', ids: [workers[3].id], x: 22.5, y: 23.5 })).toBe(true);
    expect(issueCommand(state, 0, { type: 'attack', ids: [workers[4].id], target: foe.id })).toBe(true);
    expect(issueCommand(state, 0, { type: 'hold', ids: [workers[6].id] })).toBe(true);
    expect(issueCommand(state, 0, { type: 'attackMove', ids: [workers[7].id], x: 25.5, y: 23.5 })).toBe(true);
    const protectedWorkers = [workers[1], workers[2], workers[3], workers[4], workers[7]];
    const before = protectedWorkers.map(worker => structuredClone(worker));
    const bank = { ...state.players[0] };
    const recorded = commands(state);
    const result = applyWorkerTargets(state, 0, targets(0, 2, 1));
    expect(result).toMatchObject({ assigned: targets(0, 2, 1), unmet: targets(), idle: 0, busy: 5, total: 8 });
    expect(result.issued).toHaveLength(3);
    expect(new Set(result.issued.map(order => order.worker)).size).toBe(3);
    expect(protectedWorkers).toEqual(before);
    expect(state.players[0]).toEqual(bank);
    expect(recorded.filter(entry => entry.command.type === 'gather')).toHaveLength(3);
    expect(workerAllocation(state, 0).targets).toEqual(targets(0, 2, 1));
  });

  it('stops surplus gatherers after a target reduction and does not resend stable orders', () => {
    const { state, workers } = fixture(3);
    const wood = node(state, 'wood');
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: workers.map(worker => worker.id), target: wood.id })).toBe(true);
    const recorded = commands(state);
    const result = applyWorkerTargets(state, 0, targets(1));
    expect(result).toMatchObject({ assigned: targets(1), unmet: targets(), idle: 2, busy: 0, total: 3 });
    expect(workers.filter(worker => worker.order.type === 'gather')).toHaveLength(1);
    expect(workers.filter(worker => worker.order.type === 'idle')).toHaveLength(2);
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.every(entry => entry.command.type === 'stop')).toBe(true);
    recorded.length = 0;
    expect(applyWorkerTargets(state, 0, targets(1)).issued).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it('preserves a finite queued gather even when it has no waiting order', () => {
    const { state, workers: [worker] } = fixture(1);
    const wood = node(state, 'wood');
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id, queued: true })).toBe(true);
    expect(worker.orderQueue?.length ?? 0).toBe(0);
    expect(captureRuntime(state).queuedGather).toContain(worker.id);
    const before = structuredClone(worker);
    const recorded = commands(state);
    expect(applyWorkerTargets(state, 0, targets())).toMatchObject({ assigned: targets(), busy: 1, total: 1 });
    expect(worker).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('preserves a worker returning partial cargo when targets shrink or construction is requested', () => {
    const { state, workers: [worker] } = fixture(1);
    const wood = node(state, 'wood', 21.5, 20.5, 4);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id })).toBe(true);
    for (let index = 0; index < 100 && !captureRuntime(state).returning.includes(worker.id); index++) stepGame(state, .05);
    expect(captureRuntime(state).returning).toContain(worker.id);
    expect(worker.carried).toBeCloseTo(4);
    expect(worker.carried).toBeLessThan(18);
    const woodBalance = state.players[0].wood;
    expectCargoProtected(state, worker);
    advance(state, 10);
    expect(worker.carried).toBe(0);
    expect(state.players[0].wood).toBeCloseTo(woodBalance + 4);
    expect(captureRuntime(state).returning).not.toContain(worker.id);
  });

  it('preserves cargo from a depleted visible node before the next step starts returning it', () => {
    const { state, workers: [worker] } = fixture(1);
    const wood = node(state, 'wood', 21.5, 20.5, 4);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id })).toBe(true);
    for (let index = 0; index < 100 && wood.amount > 0; index++) stepGame(state, .05);
    expect(wood.amount).toBe(0);
    expect(worker.carried).toBeCloseTo(4);
    expect(captureRuntime(state).returning).not.toContain(worker.id);
    expectCargoProtected(state, worker);
  });

  it.each([
    { carried: 18, targetKind: 'wood' as const },
    { carried: 4, targetKind: 'ore' as const },
  ])('preserves cargo before the return phase has started: %o', ({ carried, targetKind }) => {
    const { state, workers: [worker] } = fixture(1);
    const resource = node(state, targetKind, 21.5, 20.5);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: resource.id })).toBe(true);
    worker.carried = carried;
    worker.carriedKind = 'wood';
    expect(captureRuntime(state).returning).not.toContain(worker.id);
    expectCargoProtected(state, worker);
    expect(captureRuntime(state).returning).not.toContain(worker.id);
  });

  it('preserves partial cargo when its current delivery route is blocked even if a different resource is deliverable', () => {
    const { state, workers: [worker] } = fixture(1);
    for (let y = 0; y < state.height; y++) {
      const tile = y * state.width + 18;
      state.terrain[tile] = 'water';
      state.explored[0].add(tile);
    }
    const wood = node(state, 'wood', 21.5, 20.5);
    const ore = node(state, 'ore', 25.5, 20.5, 4);
    building(state, 'depot', 26.5, 24.5);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id })).toBe(true);
    advance(state, 1);
    expect(worker.carried).toBeGreaterThan(0);
    expect(worker.carried).toBeLessThan(18);
    expect(captureRuntime(state).returning).not.toContain(worker.id);
    const unloaded = structuredClone(state);
    unloaded.entities.find(entity => entity.id === worker.id)!.carried = 0;
    expect(applyWorkerTargets(unloaded, 0, targets(0, 1)).issued).toEqual([{ worker: worker.id, resource: ore.id, kind: 'ore' }]);
    expectCargoProtected(state, worker, targets(0, 1));
    expect(worker.order).toEqual({ type: 'gather', target: wood.id });
  });

  it('can retask partial cargo with a known current delivery route and deposits both resource kinds', () => {
    const { state, workers: [worker] } = fixture(1);
    const wood = node(state, 'wood', 21.5, 20.5);
    const ore = node(state, 'ore', 23.5, 22.5, 4);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id })).toBe(true);
    advance(state, 1);
    const cargo = worker.carried;
    const balances = { ...state.players[0] };
    expect(cargo).toBeGreaterThan(0);
    expect(cargo).toBeLessThan(18);
    expect(captureRuntime(state).returning).not.toContain(worker.id);
    expect(workerAllocation(state, 0)).toMatchObject({ assigned: targets(1), busy: 0, total: 1 });
    const recorded = commands(state);
    expect(applyWorkerTargets(state, 0, targets(0, 1)).issued).toEqual([{ worker: worker.id, resource: ore.id, kind: 'ore' }]);
    expect(worker.order).toEqual({ type: 'gather', target: ore.id });
    advance(state, 20);
    expect(worker.carried).toBe(0);
    expect(ore.amount).toBe(0);
    expect(state.players[0].wood).toBeCloseTo(balances.wood + cargo);
    expect(state.players[0].ore).toBeCloseTo(balances.ore + 4);
    expect(wood.amount).toBeCloseTo(100 - cargo);
    expect(recorded.filter(entry => entry.command.type === 'gather' && entry.command.target === ore.id)).toHaveLength(1);
  });

  it('counts regular delivery loops toward periodic targets and stops a lowered target after its cargo is deposited', () => {
    const { state, workers } = fixture(2);
    workers[1].x = 20.5;
    workers[1].y = 23.5;
    node(state, 'wood', 21.5, 20.5, 200);
    refreshVisibility(state);
    const recorded = commands(state);
    expect(applyWorkerTargets(state, 0, targets(1)).issued).toHaveLength(1);
    let observedReturn = false;
    for (let index = 0; index < 500; index++) {
      stepGame(state, .05);
      observedReturn ||= captureRuntime(state).returning.includes(workers[0].id);
      const result = applyWorkerTargets(state, 0, targets(1));
      expect(result).toMatchObject({ assigned: targets(1), idle: 1, busy: 0, total: 2, issued: [] });
      expect(result.assigned.wood + result.assigned.ore + result.assigned.crystal + result.idle + result.busy).toBe(result.total);
      expect(workers.filter(worker => worker.order.type === 'gather')).toHaveLength(1);
      expect(workers[1].order).toEqual({ type: 'idle' });
    }
    expect(observedReturn).toBe(true);
    expect(recorded).toHaveLength(1);
    for (let index = 0; index < 400 && !captureRuntime(state).returning.includes(workers[0].id); index++) {
      stepGame(state, .05);
      applyWorkerTargets(state, 0, targets(1));
    }
    expect(captureRuntime(state).returning).toContain(workers[0].id);
    const bank = state.players[0].wood;
    const cargo = workers[0].carried;
    const before = structuredClone(workers[0]);
    const runtime = captureRuntime(state);
    const deferred = applyWorkerTargets(state, 0, targets());
    expect(deferred).toMatchObject({ assigned: targets(1), idle: 1, busy: 0, issued: [] });
    expect(deferred.messages.join(' ')).toContain('deferred');
    expect(workers[0]).toEqual(before);
    expect(captureRuntime(state)).toEqual(runtime);
    for (let index = 0; index < 200 && workers[0].carried > 0; index++) {
      stepGame(state, .05);
      applyWorkerTargets(state, 0, targets());
      expect(workers[1].order).toEqual({ type: 'idle' });
    }
    expect(workers[0].carried).toBe(0);
    expect(state.players[0].wood).toBeCloseTo(bank + cargo);
    expect(workers[0].order).toEqual({ type: 'idle' });
    expect(workerAllocation(state, 0)).toMatchObject({ assigned: targets(), idle: 2, busy: 0, total: 2 });
    expect(recorded.filter(entry => entry.command.type === 'gather')).toHaveLength(1);
    expect(recorded.filter(entry => entry.command.type === 'stop')).toHaveLength(1);
  });

  it('defers reducing two locked delivery loops to one and never fills an idle worker during their return', () => {
    const { state, workers } = fixture(3);
    workers[1].x = 21.5;
    workers[1].y = 19.5;
    workers[2].x = 20.5;
    workers[2].y = 23.5;
    node(state, 'wood', 21.5, 20.5, 200);
    refreshVisibility(state);
    const bank = state.players[0].wood;
    const recorded = commands(state);
    expect(applyWorkerTargets(state, 0, targets(2)).issued).toHaveLength(2);
    for (let index = 0; index < 300 && !workers.slice(0, 2).every(worker => captureRuntime(state).returning.includes(worker.id)); index++) {
      stepGame(state, .05);
      applyWorkerTargets(state, 0, targets(2));
    }
    expect(workers.slice(0, 2).every(worker => captureRuntime(state).returning.includes(worker.id))).toBe(true);
    const before = workers.slice(0, 2).map(worker => structuredClone(worker));
    const deferred = applyWorkerTargets(state, 0, targets(1));
    expect(deferred).toMatchObject({ assigned: targets(2), idle: 1, busy: 0, issued: [] });
    expect(deferred.messages.join(' ')).toContain('deferred');
    expect(workers.slice(0, 2)).toEqual(before);
    for (let index = 0; index < 200 && workers.slice(0, 2).some(worker => worker.carried > 0); index++) {
      stepGame(state, .05);
      const result = applyWorkerTargets(state, 0, targets(1));
      expect(result.issued).toEqual([]);
      expect(result.assigned.wood).toBeGreaterThanOrEqual(1);
      expect(result.assigned.wood + result.idle + result.busy).toBe(result.total);
      expect(workers[2].order).toEqual({ type: 'idle' });
    }
    expect(workers.slice(0, 2).every(worker => worker.carried === 0)).toBe(true);
    expect(state.players[0].wood).toBeCloseTo(bank + 36);
    expect(workerAllocation(state, 0)).toMatchObject({ assigned: targets(1), idle: 2, busy: 0, total: 3 });
    expect(recorded.filter(entry => entry.command.type === 'gather')).toHaveLength(2);
    expect(recorded.filter(entry => entry.command.type === 'stop')).toHaveLength(1);
    expect(recorded.some(entry => 'ids' in entry.command && entry.command.ids.includes(workers[2].id))).toBe(false);
  });

  it('moves an existing gatherer to ore so an isolated idle worker can fill the wood target', () => {
    const { state, workers } = fixture(2);
    workers[1].x = 24.5;
    workers[1].y = 20.5;
    for (let y = 0; y < state.height; y++) {
      const tile = y * state.width + 22;
      state.terrain[tile] = 'water';
      state.explored[0].add(tile);
    }
    const firstWood = node(state, 'wood', 21.5, 20.5, 4);
    const isolatedWood = node(state, 'wood', 25.5, 20.5, 4);
    const ore = node(state, 'ore', 19.5, 23.5, 4);
    building(state, 'depot', 26.5, 24.5);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'gather', ids: [workers[0].id], target: firstWood.id })).toBe(true);
    const balances = { ...state.players[0] };
    const recorded = commands(state);
    const result = applyWorkerTargets(state, 0, targets(1, 1));
    expect(result).toMatchObject({ assigned: targets(1, 1), unmet: targets(), idle: 0, total: 2 });
    expect(result.issued).toHaveLength(2);
    expect(result.issued).toContainEqual({ worker: workers[0].id, resource: ore.id, kind: 'ore' });
    expect(result.issued).toContainEqual({ worker: workers[1].id, resource: isolatedWood.id, kind: 'wood' });
    expect(workers[0].order).toEqual({ type: 'gather', target: ore.id });
    expect(workers[1].order).toEqual({ type: 'gather', target: isolatedWood.id });
    expect(recorded).toHaveLength(2);
    expect(new Set(recorded.map(entry => 'ids' in entry.command ? entry.command.ids[0] : undefined)).size).toBe(2);
    advance(state, 15);
    expect(firstWood.amount).toBe(4);
    expect(isolatedWood.amount).toBe(0);
    expect(ore.amount).toBe(0);
    expect(workers.every(worker => worker.carried === 0)).toBe(true);
    expect(state.players[0].wood).toBeCloseTo(balances.wood + 4);
    expect(state.players[0].ore).toBeCloseTo(balances.ore + 4);
  });

  it.each(['hidden', 'exhausted', 'unreachable'] as const)('does not allocate workers to a %s resource', condition => {
    const { state, workers: [worker] } = fixture(1);
    const resource = node(state, 'wood', condition === 'hidden' ? 40.5 : 24.5, 20.5, condition === 'exhausted' ? 0 : 100);
    if (condition === 'unreachable') for (let y = 0; y < state.height; y++) {
      const tile = y * state.width + 22;
      state.terrain[tile] = 'water';
      state.explored[0].add(tile);
    }
    refreshVisibility(state);
    const before = structuredClone(state);
    const recorded = commands(state);
    expect(applyWorkerTargets(state, 0, targets(1))).toMatchObject({ assigned: targets(), unmet: targets(1), issued: [], idle: 1 });
    expect(worker.order).toEqual({ type: 'idle' });
    expect(resource.amount).toBe(condition === 'exhausted' ? 0 : 100);
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('requires a known route to a visible resource before sending an available worker', () => {
    const { state, workers } = fixture(2);
    workers[1].x = 40.5;
    workers[1].y = 20.5;
    const ore = node(state, 'ore', 39.5, 20.5);
    building(state, 'depot', 38.5, 25.5);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'move', ids: [workers[1].id], x: 40.5, y: 23.5 })).toBe(true);
    const recorded = commands(state);
    const denied = applyWorkerTargets(state, 0, targets(0, 1));
    expect(denied).toMatchObject({ assigned: targets(), unmet: targets(0, 1), idle: 1, busy: 1, issued: [] });
    expect(denied.messages.join(' ')).toContain('known route');
    expect(recorded).toEqual([]);
    for (let y = 20; y <= 21; y++) for (let x = 26; x <= 34; x++) state.explored[0].add(y * state.width + x);
    expect(applyWorkerTargets(state, 0, targets(0, 1))).toMatchObject({ assigned: targets(0, 1), unmet: targets() });
    expect(workers[0].order).toEqual({ type: 'gather', target: ore.id });
    expect(recorded).toHaveLength(1);
  });

  it('returns identical allocations when unseen enemy buildings, resources and terrain change', () => {
    const results = [false, true].map(hiddenObstacles => {
      const { state, workers } = fixture(2);
      workers[1].x = 40.5;
      workers[1].y = 20.5;
      node(state, 'ore', 39.5, 20.5);
      building(state, 'depot', 38.5, 25.5);
      if (hiddenObstacles) {
        const enemy = state.entities.find(entity => entity.side === 1 && entity.kind === 'building')!;
        state.entities.push({ ...structuredClone(enemy), id: state.nextId++, x: 30.5, y: 20.5, role: 'depot' });
        node(state, 'ore', 30.5, 18.5, 500);
        for (let y = 0; y < state.height; y++) state.terrain[y * state.width + 30] = 'water';
      }
      refreshVisibility(state);
      expect(issueCommand(state, 0, { type: 'move', ids: [workers[1].id], x: 40.5, y: 23.5 })).toBe(true);
      return applyWorkerTargets(state, 0, targets(0, 1));
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ assigned: targets(), unmet: targets(0, 1), issued: [] });
  });

  it('does not assign a harvestable resource when workers cannot deliver it across known terrain', () => {
    const { state, workers: [worker] } = fixture(1);
    const wood = node(state, 'wood', 21.5, 20.5);
    for (let y = 0; y < state.height; y++) {
      const tile = y * state.width + 18;
      state.terrain[tile] = 'water';
      state.explored[0].add(tile);
    }
    refreshVisibility(state);
    expect(isVisible(state, 0, wood.x, wood.y)).toBe(true);
    expect(Math.hypot(worker.x - wood.x, worker.y - wood.y)).toBeLessThan(1.2);
    const before = structuredClone(state);
    const recorded = commands(state);
    const result = applyWorkerTargets(state, 0, targets(1));
    expect(result).toMatchObject({ assigned: targets(), unmet: targets(1), idle: 1, issued: [] });
    expect(result.messages.join(' ')).toMatch(/route|deliver/i);
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it.each(['none', 'incomplete'] as const)('does not assign gathering when completed drop-offs are %s', available => {
    const { state, workers: [worker], headquarters } = fixture(1);
    node(state, 'wood', 21.5, 20.5);
    if (available === 'none') state.entities = state.entities.filter(entity => entity !== headquarters);
    else {
      headquarters.progress = .5;
      building(state, 'depot', 23.5, 24.5).progress = .5;
    }
    refreshVisibility(state);
    const before = structuredClone(state);
    const recorded = commands(state);
    const result = applyWorkerTargets(state, 0, targets(1));
    expect(result).toMatchObject({ assigned: targets(), unmet: targets(1), idle: 1, issued: [] });
    expect(result.messages.join(' ')).toMatch(/route|deliver|drop.off/i);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('does not substitute a farther reachable drop-off when the simulation would choose a blocked nearest one', () => {
    const { state, workers: [worker], headquarters } = fixture(1);
    node(state, 'wood', 21.5, 20.5);
    const farther = building(state, 'depot', 26.5, 24.5);
    for (let y = 0; y < state.height; y++) {
      const tile = y * state.width + 18;
      state.terrain[tile] = 'water';
      state.explored[0].add(tile);
    }
    refreshVisibility(state);
    expect(Math.hypot(worker.x - headquarters.x, worker.y - headquarters.y)).toBeLessThan(Math.hypot(worker.x - farther.x, worker.y - farther.y));
    expect(route(state, worker, headquarters, 2.5, 0)).toEqual([]);
    expect(route(state, worker, farther, 2.1, 0).length).toBeGreaterThan(0);
    const before = structuredClone(state);
    const recorded = commands(state);
    expect(applyWorkerTargets(state, 0, targets(1))).toMatchObject({ assigned: targets(), unmet: targets(1), issued: [] });
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it.each([-1, .5, NaN, Infinity, 10001])('rejects target %s before issuing any order', invalid => {
    const { state } = fixture(2);
    node(state, 'wood');
    refreshVisibility(state);
    const before = structuredClone(state);
    const recorded = commands(state);
    expect(() => applyWorkerTargets(state, 0, targets(1, invalid, 0))).toThrow(RangeError);
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('accepts the maximum target, reports unmet workers, and copies remembered targets', () => {
    const { state } = fixture(1);
    node(state, 'wood');
    refreshVisibility(state);
    const desired = targets(10000);
    expect(validateWorkerTargets(desired)).toBe(true);
    expect(applyWorkerTargets(state, 0, desired)).toMatchObject({ assigned: targets(1), unmet: targets(9999), total: 1 });
    desired.wood = 0;
    const snapshot = workerAllocation(state, 0);
    expect(snapshot.targets).toEqual(targets(10000));
    snapshot.targets!.wood = 0;
    expect(workerAllocation(state, 0).targets).toEqual(targets(10000));
  });

  it.each([null, [], {}, { wood: 1, ore: 0 }, { wood: '1', ore: 0, crystal: 0 }, { wood: 1, ore: 0, crystal: 0, gold: 1 }])('rejects malformed targets before changing orders: %o', invalid => {
    const { state } = fixture(1);
    node(state, 'wood');
    refreshVisibility(state);
    const before = structuredClone(state);
    const recorded = commands(state);
    expect(validateWorkerTargets(invalid)).toBe(false);
    expect(() => applyWorkerTargets(state, 0, invalid as Parameters<typeof applyWorkerTargets>[2])).toThrow(RangeError);
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it.each(['wood', 'ore', 'crystal'] as const)('deposits allocated %s through the simulation and leaves other balances alone', kind => {
    const { state, workers: [worker] } = fixture(1);
    const resource = node(state, kind, 21.5, 20.5, 4);
    refreshVisibility(state);
    const initial = { wood: state.players[0].wood, ore: state.players[0].ore, crystal: state.players[0].crystal };
    const desired = targets();
    desired[kind] = 1;
    expect(applyWorkerTargets(state, 0, desired).issued).toEqual([{ worker: worker.id, resource: resource.id, kind }]);
    let deposited = 0;
    for (let index = 0; index < 400; index++) {
      stepGame(state, .05);
      for (const event of state.events) if (event.type === 'gather' && event.source === worker.id && event.resource === kind) deposited += event.amount ?? 0;
    }
    expect(resource.amount).toBe(0);
    expect(worker.carried).toBe(0);
    expect(deposited).toBeCloseTo(4);
    for (const balance of ['wood', 'ore', 'crystal'] as const) expect(state.players[0][balance]).toBeCloseTo(initial[balance] + (balance === kind ? 4 : 0));
  });
});

describe('construction plans', () => {
  it('adds and assigns blueprint metadata without issuing a command or spending resources', () => {
    const { state, workers: [worker], headquarters } = fixture(1);
    const before = structuredClone(state);
    const recorded = commands(state);
    const plan = createConstructionPlan(0);
    expect(plan).toEqual({ version: 1, side: 0, nextId: 1, blueprints: [] });
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: headquarters.x, y: headquarters.y });
    expect(item).toMatchObject({ id: 'blueprint-1', role: 'depot', x: headquarters.x, y: headquarters.y, workerIds: [], status: 'planned' });
    expect(plan.nextId).toBe(2);
    expect(assignBlueprintWorkers(state, 0, plan, item.id, [worker.id])).toBe(true);
    expect(item.workerIds).toEqual([worker.id]);
    expect(blueprintReason(state, 0, item)).not.toBe('');
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
    expect(cancelBlueprint(plan, item.id)).toBe(true);
    expect(plan.blueprints).toEqual([]);
    expect(cancelBlueprint(plan, item.id)).toBe(false);
  });

  it.each([
    { role: 'worker', x: 23.5, y: 18.5 },
    { role: 'depot', x: NaN, y: 18.5 },
    { role: 'depot', x: 23.5, y: Infinity },
    { role: 'depot', x: -1, y: 18.5 },
    { role: 'depot', x: 10000, y: 18.5 },
  ])('rejects malformed blueprint coordinates or roles: %o', invalid => {
    const { state } = fixture();
    const plan = createConstructionPlan(0);
    expect(() => addBlueprint(state, 0, plan, invalid as Parameters<typeof addBlueprint>[3])).toThrow();
    expect(plan).toEqual(createConstructionPlan(0));
  });

  it('rejects mismatched sides and bounds the number of blueprints', () => {
    const { state } = fixture();
    const plan = createConstructionPlan(0);
    expect(() => addBlueprint(state, 1, plan, { role: 'depot', x: 23.5, y: 18.5 })).toThrow();
    expect(() => createConstructionPlan(-1 as Side)).toThrow();
    for (let index = 0; index < 100; index++) addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    expect(() => addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 })).toThrow();
    expect(plan.blueprints).toHaveLength(100);
    expect(new Set(plan.blueprints.map(item => item.id)).size).toBe(100);
  });

  it('bounds standalone plan sides to the supported player range', () => {
    const last = createConstructionPlan(7 as Side);
    expect(last.side).toBe(7);
    expect(decodeConstructionPlan(last)).toEqual(last);
    for (const side of [8, 31]) {
      expect(() => createConstructionPlan(side as Side)).toThrow(RangeError);
      expect(decodeConstructionPlan({ ...last, side })).toBeUndefined();
    }
  });

  it('rejects foreign, dead, illusion, non-worker and missing assignments without replacing valid metadata', () => {
    const { state, workers: [worker], headquarters } = fixture(1);
    const foreign = { ...structuredClone(worker), id: state.nextId++, side: 1 as const };
    const dead = { ...structuredClone(worker), id: state.nextId++, hp: 0 };
    const illusion = { ...structuredClone(worker), id: state.nextId++, illusion: true };
    const soldier = { ...structuredClone(worker), id: state.nextId++, role: 'melee' as const };
    state.entities.push(foreign, dead, illusion, soldier);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    expect(assignBlueprintWorkers(state, 0, plan, item.id, [worker.id])).toBe(true);
    const before = structuredClone(state);
    const recorded = commands(state);
    for (const invalid of [foreign.id, dead.id, illusion.id, soldier.id, headquarters.id, -1, 1.5, NaN]) {
      expect(assignBlueprintWorkers(state, 0, plan, item.id, [worker.id, invalid])).toBe(false);
      expect(item.workerIds).toEqual([worker.id]);
    }
    expect(() => assignBlueprintWorkers(state, 1, plan, item.id, [foreign.id])).toThrow();
    expect(assignBlueprintWorkers(state, 0, plan, item.id, [worker.id, worker.id])).toBe(false);
    expect(item.workerIds).toEqual([worker.id]);
    expect(assignBlueprintWorkers(state, 0, plan, 'missing', [worker.id])).toBe(false);
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it.each(['funds', 'age', 'hidden', 'terrain', 'occupied', 'busy'] as const)('keeps a blueprint pending for %s without charging or ordering its worker', failure => {
    const { state, workers: [worker], headquarters } = fixture(1);
    funded(state);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, {
      role: failure === 'age' ? 'hq' : 'depot',
      x: failure === 'hidden' ? 40.5 : failure === 'occupied' ? headquarters.x : 23.5,
      y: failure === 'hidden' ? 10.5 : failure === 'occupied' ? headquarters.y : 18.5,
    });
    expect(assignBlueprintWorkers(state, 0, plan, item.id, [worker.id])).toBe(true);
    if (failure === 'funds') state.players[0].wood = 0;
    if (failure === 'terrain') state.terrain[18 * state.width + 23] = 'water';
    if (failure === 'busy') expect(issueCommand(state, 0, { type: 'move', ids: [worker.id], x: 21.5, y: 23.5 })).toBe(true);
    refreshVisibility(state);
    const reason = blueprintReason(state, 0, item);
    expect(reason).not.toBe('');
    const before = structuredClone(state);
    const recorded = commands(state);
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [], pending: [{ id: item.id, reason }] });
    expect(item.status).toBe('planned');
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('requires visibility across the entire footprint even when the site center is visible', () => {
    const { state, workers: [worker] } = fixture(1);
    funded(state);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    expect(blueprintReason(state, 0, item)).toBe('');
    state.visible[0].delete(17 * state.width + 24);
    expect(state.visible[0].has(18 * state.width + 23)).toBe(true);
    const reason = blueprintReason(state, 0, item);
    expect(reason).toContain('visible');
    const recorded = commands(state);
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [], pending: [{ id: item.id, reason }] });
    expect(recorded).toEqual([]);
  });

  it('keeps blueprint preflight unchanged by an adjacent hidden enemy building and reports execution rejection without revealing it', () => {
    const { state, workers: [worker] } = fixture(1);
    funded(state);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 25.5, y: 20.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    expect(blueprintReason(state, 0, item)).toBe('');
    const enemy = state.entities.find(entity => entity.side === 1 && entity.role === 'hq')!;
    const hidden = { ...structuredClone(enemy), id: state.nextId++, x: 28.2, y: 20.5 };
    state.entities.push(hidden);
    refreshVisibility(state);
    expect(isVisible(state, 0, hidden.x, hidden.y)).toBe(false);
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) expect(isVisible(state, 0, item.x + dx, item.y + dy)).toBe(true);
    expect(canPlace(state, 0, item.role, item.x, item.y)).toBe(false);
    expect(blueprintReason(state, 0, item)).toBe('');
    const before = structuredClone(state);
    const recorded = commands(state);
    const result = executeBlueprints(state, 0, plan);
    expect(result).toEqual({ started: [], pending: [{ id: item.id, reason: 'Construction could not start; check the site and assigned workers.' }] });
    expect(item.status).toBe('planned');
    expect(item.buildingId).toBeUndefined();
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('executes affordable blueprints once, preserves a pending site, and completes through worker construction', () => {
    const { state, workers } = fixture(2);
    const cost = FACTIONS.orcs.buildings.depot.cost;
    Object.assign(state.players[0], cost);
    const plan = createConstructionPlan(0);
    const first = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    const second = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 22.5 });
    expect(assignBlueprintWorkers(state, 0, plan, first.id, [workers[0].id])).toBe(true);
    expect(assignBlueprintWorkers(state, 0, plan, second.id, [workers[1].id])).toBe(true);
    expect(blueprintReason(state, 0, first)).toBe('');
    const recorded = commands(state);
    const result = executeBlueprints(state, 0, plan);
    expect(result.started).toEqual([first.id]);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]).toMatchObject({ id: second.id });
    expect(result.pending[0].reason).not.toBe('');
    expect(state.players[0].wood).toBe(0);
    expect(first.status).toBe('building');
    expect(workers[0].order).toEqual({ type: 'build', target: first.buildingId });
    expect(workers[1].order).toEqual({ type: 'idle' });
    expect(cancelBlueprint(plan, first.id)).toBe(false);
    expect(recorded).toHaveLength(1);
    state.players[0].wood = cost.wood;
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [second.id], pending: [] });
    expect(state.players[0].wood).toBe(0);
    expect(recorded).toHaveLength(2);
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [], pending: [] });
    expect(recorded).toHaveLength(2);
    advance(state, 35);
    syncConstructionPlan(state, plan);
    expect(plan.blueprints.map(item => item.status)).toEqual(['complete', 'complete']);
    expect(cancelBlueprint(plan, first.id)).toBe(false);
    for (const item of plan.blueprints) {
      const completed = state.entities.find(entity => entity.id === item.buildingId)!;
      expect(completed.progress).toBe(1);
      expect(completed.role).toBe('depot');
      expect(completed.side).toBe(0);
    }
  });

  it('reserves each worker for the first started site and uses another assigned worker for the next', () => {
    const { state, workers } = fixture(2);
    funded(state);
    const plan = createConstructionPlan(0);
    const first = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    const second = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 22.5 });
    assignBlueprintWorkers(state, 0, plan, first.id, [workers[0].id]);
    assignBlueprintWorkers(state, 0, plan, second.id, workers.map(worker => worker.id));
    const recorded = commands(state);
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [first.id, second.id], pending: [] });
    expect(recorded.map(entry => entry.command)).toEqual([
      { type: 'build', ids: [workers[0].id], role: 'depot', x: first.x, y: first.y },
      { type: 'build', ids: [workers[1].id], role: 'depot', x: second.x, y: second.y },
    ]);
    expect(workers[0].order).toEqual({ type: 'build', target: first.buildingId });
    expect(workers[1].order).toEqual({ type: 'build', target: second.buildingId });
  });

  it('starts one paid building with idle, held and adjustable gathering workers', () => {
    const { state, workers } = fixture(3);
    funded(state);
    const wood = node(state, 'wood', 20.5, 24.5);
    refreshVisibility(state);
    expect(issueCommand(state, 0, { type: 'hold', ids: [workers[1].id] })).toBe(true);
    expect(issueCommand(state, 0, { type: 'gather', ids: [workers[2].id], target: wood.id })).toBe(true);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, workers.map(worker => worker.id));
    const before = { ...state.players[0] };
    const recorded = commands(state);
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [item.id], pending: [] });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].command).toEqual({ type: 'build', ids: workers.map(worker => worker.id), role: 'depot', x: item.x, y: item.y });
    expect(workers.map(worker => worker.order)).toEqual(workers.map(() => ({ type: 'build', target: item.buildingId })));
    for (const kind of ['wood', 'ore', 'crystal'] as const) expect(state.players[0][kind]).toBe(before[kind] - FACTIONS.orcs.buildings.depot.cost[kind]);
  });

  it.each(['queued', 'finite-gather', 'repair', 'attack'] as const)('does not redirect an assigned worker with protected %s work', protectedWork => {
    const { state, workers: [worker] } = fixture(1);
    funded(state);
    const wood = node(state, 'wood', 20.5, 24.5);
    const repair = building(state, 'depot', 23.5, 22.5);
    repair.hp -= 20;
    const foe: Entity = { ...structuredClone(worker), id: state.nextId++, side: 1, x: 24.5, order: { type: 'hold' } };
    state.entities.push(foe);
    refreshVisibility(state);
    if (protectedWork === 'queued' || protectedWork === 'finite-gather') {
      expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id, queued: protectedWork === 'finite-gather' })).toBe(true);
      if (protectedWork === 'queued') expect(issueCommand(state, 0, { type: 'move', ids: [worker.id], x: 22.5, y: 23.5, queued: true })).toBe(true);
    } else expect(issueCommand(state, 0, { type: protectedWork, ids: [worker.id], target: protectedWork === 'repair' ? repair.id : foe.id })).toBe(true);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    const before = structuredClone(state);
    const recorded = commands(state);
    const result = executeBlueprints(state, 0, plan);
    expect(result.started).toEqual([]);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].reason).not.toBe('');
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('keeps an otherwise valid visible site pending when assigned workers cannot reach it', () => {
    const { state, workers: [worker] } = fixture(1);
    funded(state);
    for (let y = 0; y < state.height; y++) {
      const tile = y * state.width + 22;
      state.terrain[tile] = 'water';
      state.explored[0].add(tile);
    }
    refreshVisibility(state);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 24.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    const reason = blueprintReason(state, 0, item);
    expect(reason).toContain('reach');
    const before = structuredClone(state);
    const recorded = commands(state);
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [], pending: [{ id: item.id, reason }] });
    expect(state).toEqual(before);
    expect(recorded).toEqual([]);
  });

  it('leaves a second site pending when all of its workers are already reserved', () => {
    const { state, workers: [worker] } = fixture(1);
    funded(state);
    const plan = createConstructionPlan(0);
    const first = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    const second = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 22.5 });
    for (const item of [first, second]) assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    const before = state.players[0].wood;
    const recorded = commands(state);
    const result = executeBlueprints(state, 0, plan);
    expect(result.started).toEqual([first.id]);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].id).toBe(second.id);
    expect(result.pending[0].reason).not.toBe('');
    expect(state.players[0].wood).toBe(before - FACTIONS.orcs.buildings.depot.cost.wood);
    expect(worker.order).toEqual({ type: 'build', target: first.buildingId });
    expect(recorded).toHaveLength(1);
  });

  it('derives completion from the linked building and returns lost buildings to planned status', () => {
    const { state, workers: [worker] } = fixture(1);
    funded(state);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    executeBlueprints(state, 0, plan);
    const site = state.entities.find(entity => entity.id === item.buildingId)!;
    syncConstructionPlan(state, plan);
    expect(item.status).toBe('building');
    advance(state, 35);
    syncConstructionPlan(state, plan);
    expect(site.progress).toBe(1);
    expect(item.status).toBe('complete');
    site.hp = 0;
    syncConstructionPlan(state, plan);
    expect(item.status).toBe('planned');
    expect(item.buildingId).toBeUndefined();
    expect(item.reason).not.toBe('');
    expect(cancelBlueprint(plan, item.id)).toBe(true);
  });

  it('removes lost worker assignments while preserving the building that is still under construction', () => {
    const { state, workers: [worker] } = fixture(1);
    funded(state);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    executeBlueprints(state, 0, plan);
    const buildingId = item.buildingId;
    worker.hp = 0;
    syncConstructionPlan(state, plan);
    expect(item.workerIds).toEqual([]);
    expect(item.status).toBe('building');
    expect(item.buildingId).toBe(buildingId);
    expect(blueprintReason(state, 0, item)).not.toBe('');
  });
});

describe('construction plan decoding', () => {
  function savedPlan() {
    const { state, workers: [worker] } = fixture(1);
    const plan = createConstructionPlan(0);
    const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, plan, item.id, [worker.id]);
    return { state, worker, plan, item };
  }

  it('round trips detached metadata and validates it against the current side and entities', () => {
    const { state, plan } = savedPlan();
    const input: unknown = JSON.parse(JSON.stringify(plan));
    const decoded = decodeConstructionPlan(input, state, 0);
    expect(decoded).toEqual(plan);
    expect(decoded).not.toBe(input);
    expect(decoded!.blueprints).not.toBe(plan.blueprints);
    expect(decodeConstructionPlan(input, state, 1)).toBeUndefined();
    expect(decodeConstructionPlan(input)).toEqual(plan);
  });

  it.each([null, [], 'plan', {}, { version: 2, side: 0, nextId: 1, blueprints: [] }, { version: 1, side: -1, nextId: 1, blueprints: [] }])('rejects an invalid plan envelope: %o', input => {
    expect(decodeConstructionPlan(input)).toBeUndefined();
  });

  it('rejects malformed blueprint fields, duplicate IDs, and oversized plans', () => {
    const { state, plan, item } = savedPlan();
    const invalid = [
      { ...item, id: '' },
      { ...item, role: 'worker' },
      { ...item, role: new String('depot') },
      { ...item, status: 'destroyed' },
      { ...item, x: NaN },
      { ...item, y: Infinity },
      { ...item, x: -1 },
      { ...item, x: state.width },
      { ...item, workerIds: 'workers' },
      { ...item, workerIds: [-1] },
      { ...item, workerIds: [1.5] },
      { ...item, workerIds: Array(101).fill(item.workerIds[0]) },
      { ...item, workerIds: [item.workerIds[0], item.workerIds[0]] },
      { ...item, status: 'building' },
      { ...item, status: 'complete' },
      { ...item, buildingId: -1, status: 'building' },
      { ...item, buildingId: state.entities[0].id },
      { ...item, reason: 1 },
      { ...item, reason: 'x'.repeat(501) },
      { ...item, unknown: true },
    ];
    for (const blueprint of invalid) expect(decodeConstructionPlan({ ...plan, blueprints: [blueprint] }, state, 0)).toBeUndefined();
    expect(decodeConstructionPlan({ ...plan, blueprints: [item, structuredClone(item)] }, state, 0)).toBeUndefined();
    expect(decodeConstructionPlan({ ...plan, blueprints: Array.from({ length: 101 }, (_, index) => ({ ...item, id: `blueprint-${index + 1}` })), nextId: 102 }, state, 0)).toBeUndefined();
    for (const nextId of [0, -1, .5, Infinity]) expect(decodeConstructionPlan({ ...plan, nextId }, state, 0)).toBeUndefined();
    expect(decodeConstructionPlan({ ...plan, nextId: 1 }, state, 0)).toBeUndefined();
    expect(decodeConstructionPlan({ ...plan, unknown: true }, state, 0)).toBeUndefined();
  });

  it('rejects worker and building IDs belonging to enemies or the wrong entity kind', () => {
    const { state, worker, plan, item } = savedPlan();
    const foreign = { ...structuredClone(worker), id: state.nextId++, side: 1 as const };
    const illusion = { ...structuredClone(worker), id: state.nextId++, illusion: true };
    const dead = { ...structuredClone(worker), id: state.nextId++, hp: 0 };
    state.entities.push(foreign, illusion, dead);
    const ownHQ = state.entities.find(entity => entity.side === 0 && entity.kind === 'building')!;
    const enemyHQ = state.entities.find(entity => entity.side === 1 && entity.kind === 'building')!;
    for (const id of [foreign.id, illusion.id, dead.id, ownHQ.id, state.nextId + 100]) {
      expect(decodeConstructionPlan({ ...plan, blueprints: [{ ...item, workerIds: [id] }] }, state, 0)).toBeUndefined();
    }
    for (const id of [enemyHQ.id, worker.id, state.nextId + 100]) {
      expect(decodeConstructionPlan({ ...plan, blueprints: [{ ...item, status: 'building', buildingId: id }] }, state, 0)).toBeUndefined();
    }
  });

  it('restores active construction only with a matching building and rejects duplicate links', () => {
    const { state, plan, item } = savedPlan();
    funded(state);
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [item.id], pending: [] });
    expect(decodeConstructionPlan(JSON.parse(JSON.stringify(plan)), state, 0)).toEqual(plan);
    for (const malformed of [{ ...item, x: item.x + 1 }, { ...item, role: 'barracks' }]) {
      expect(decodeConstructionPlan({ ...plan, blueprints: [malformed] }, state, 0)).toBeUndefined();
    }
    const duplicate = { ...structuredClone(item), id: 'blueprint-2' };
    expect(decodeConstructionPlan({ ...plan, nextId: 3, blueprints: [item, duplicate] }, state, 0)).toBeUndefined();
  });
});

describe('planning runtime decoding', () => {
  it('copies targets and construction metadata so restored data cannot mutate its input', () => {
    const { state, workers: [worker] } = fixture(1);
    const runtime = createPlanningRuntime(0);
    expect(runtime).toEqual({ version: 1, targets: targets(), construction: createConstructionPlan(0) });
    runtime.targets = targets(2, 1, 1);
    const item = addBlueprint(state, 0, runtime.construction, { role: 'depot', x: 23.5, y: 18.5 });
    assignBlueprintWorkers(state, 0, runtime.construction, item.id, [worker.id]);
    const decoded = decodePlanningRuntime(runtime, state, 0)!;
    expect(decoded).toEqual(runtime);
    decoded.targets.wood = 99;
    decoded.construction.blueprints[0].workerIds.length = 0;
    decoded.construction.blueprints[0].x = 1;
    expect(runtime.targets).toEqual(targets(2, 1, 1));
    expect(runtime.construction.blueprints[0]).toMatchObject({ x: 23.5, workerIds: [worker.id] });
    expect(decodePlanningRuntime(runtime, state, 1)).toBeUndefined();
  });

  it.each([
    null, [], {},
    { version: 2, targets: targets(), construction: createConstructionPlan(0) },
    { version: 1, targets: targets(-1), construction: createConstructionPlan(0) },
    { version: 1, targets: targets(1.5), construction: createConstructionPlan(0) },
    { version: 1, targets: targets(), construction: { ...createConstructionPlan(0), version: 2 } },
    { version: 1, targets: targets(), construction: createConstructionPlan(0), unknown: true },
  ])('rejects malformed planning runtime data: %o', input => {
    expect(decodePlanningRuntime(input)).toBeUndefined();
  });
});

it('dispatches accepted planning commands through an adapter once and preserves stable work', () => {
  const { state, workers } = fixture(2);
  funded(state);
  node(state, 'wood');
  refreshVisibility(state);
  const dispatched: { side: Side; command: Command }[] = [];
  const dispatch = (side: Side, command: Command) => {
    dispatched.push({ side, command: structuredClone(command) });
    return issueCommand(state, side, command);
  };
  const recorded = commands(state);
  expect(applyWorkerTargets(state, 0, targets(2), dispatch)).toMatchObject({ assigned: targets(2), unmet: targets() });
  expect(dispatched).toHaveLength(2);
  expect(recorded).toEqual(dispatched);
  expect(applyWorkerTargets(state, 0, targets(2), dispatch).issued).toEqual([]);
  expect(dispatched).toHaveLength(2);
  const plan = createConstructionPlan(0);
  const item = addBlueprint(state, 0, plan, { role: 'depot', x: 23.5, y: 18.5 });
  assignBlueprintWorkers(state, 0, plan, item.id, [workers[0].id]);
  expect(executeBlueprints(state, 0, plan, dispatch)).toEqual({ started: [item.id], pending: [] });
  expect(dispatched).toHaveLength(3);
  expect(recorded).toEqual(dispatched);
  expect(workers[0].order).toEqual({ type: 'build', target: item.buildingId });
  expect(executeBlueprints(state, 0, plan, dispatch)).toEqual({ started: [], pending: [] });
  expect(dispatched).toHaveLength(3);
  expect(recorded).toHaveLength(3);
});
