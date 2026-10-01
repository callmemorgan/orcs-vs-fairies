import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createGame, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { BuildingRole, Command, Entity, GameState, Order, Side } from '../src/core/types';

type QueuedEntity = Entity & { orderQueue?: Order[] };
type QueuedCommand = Command & { queued?: boolean };

function fixture() {
  const s = createGame('orcs', 4127, 'fairies', { controllers: ['external', 'external'] });
  const worker = s.entities.find(e => e.side === 0 && e.role === 'worker')! as QueuedEntity;
  s.terrain.fill('grass');
  s.resources = [];
  s.entities = s.entities.filter(e => e.kind === 'building' || e === worker);
  worker.x = worker.y = 20.5;
  refreshVisibility(s);
  stepGame(s, .05);
  return { s, worker };
}

function building(s: GameState, role: BuildingRole, x: number, y: number) {
  const template = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
  const def = FACTIONS.orcs.buildings[role];
  const e: Entity = { ...structuredClone(template), id: s.nextId++, role, x, y, hp: def.hp, maxHp: def.hp };
  s.entities.push(e);
  return e;
}

function opponent(s: GameState, x: number, y: number) {
  const template = s.entities.find(e => e.role === 'worker')!;
  const def = FACTIONS.fairies.units.worker;
  const e: Entity = { ...structuredClone(template), id: s.nextId++, side: 1, x, y, hp: def.hp, maxHp: def.hp, order: { type: 'hold' } };
  s.entities.push(e);
  return e;
}

function command(s: GameState, c: QueuedCommand, side: Side = 0) {
  return issueCommand(s, side, c);
}

function advance(s: GameState, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / .05); i++) stepGame(s, .05);
}

function waiting(e: QueuedEntity) { return e.orderQueue ?? []; }
function distance(e: Entity, x: number, y: number) { return Math.hypot(e.x - x, e.y - y); }

describe('queued unit orders', () => {
  it.each(['idle', 'hold'] as const)('starts a queued command immediately from %s', initial => {
    const { s, worker } = fixture();
    if (initial === 'hold') expect(issueCommand(s, 0, { type: 'hold', ids: [worker.id] })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 24.5, y: 20.5, queued: true })).toBe(true);
    expect(worker.order).toEqual({ type: 'move', x: 24.5, y: 20.5 });
    expect(waiting(worker)).toEqual([]);
    advance(s, 4);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(distance(worker, 24.5, 20.5)).toBeLessThan(.6);
  });

  it('finishes mixed movement, repair and gathering orders in the requested sequence', () => {
    const { s, worker } = fixture();
    const depot = building(s, 'depot', 23.5, 24.5);
    depot.hp -= 18;
    const node = { id: s.nextId++, kind: 'wood' as const, x: 21.5, y: 24.5, amount: 1, maxAmount: 1 };
    s.resources.push(node);
    refreshVisibility(s);
    expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 20.5 })).toBe(true);
    const orders: QueuedCommand[] = [
      { type: 'attackMove', ids: [worker.id], x: 22.5, y: 22.5, queued: true },
      { type: 'repair', ids: [worker.id], target: depot.id, queued: true },
      { type: 'gather', ids: [worker.id], target: node.id, queued: true },
      { type: 'move', ids: [worker.id], x: 18.5, y: 24.5, queued: true },
    ];
    for (const order of orders) expect(command(s, order)).toBe(true);
    expect(worker.order).toEqual({ type: 'move', x: 22.5, y: 20.5 });
    expect(waiting(worker)).toHaveLength(4);
    const visited: string[] = [worker.order.type];
    let deposited = 0;
    for (let i = 0; i < 400; i++) {
      stepGame(s, .05);
      if (visited.at(-1) !== worker.order.type) visited.push(worker.order.type);
      for (const event of s.events) if (event.type === 'gather' && event.source === worker.id) deposited += event.amount ?? 0;
    }
    expect(visited).toEqual(['move', 'attackMove', 'build', 'gather', 'move', 'idle']);
    expect(depot.hp).toBe(depot.maxHp);
    expect(node.amount).toBe(0);
    expect(deposited).toBeCloseTo(1);
    expect(worker.carried).toBe(0);
    expect(waiting(worker)).toEqual([]);
    expect(distance(worker, 18.5, 24.5)).toBeLessThan(.6);
  });

  it.each(['move', 'attackMove', 'attack', 'gather', 'repair', 'stop', 'hold'] as const)(
    'clears waiting orders when replaced by an ordinary %s command', type => {
      const { s, worker } = fixture();
      const depot = building(s, 'depot', 23.5, 24.5);
      depot.hp -= 18;
      const foe = opponent(s, 24.5, 20.5);
      const node = { id: s.nextId++, kind: 'wood' as const, x: 21.5, y: 24.5, amount: 20, maxAmount: 20 };
      s.resources.push(node);
      refreshVisibility(s);
      expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 20.5 })).toBe(true);
      expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 22.5, queued: true })).toBe(true);
      let replacement: Command;
      if (type === 'move' || type === 'attackMove') replacement = { type, ids: [worker.id], x: 18.5, y: 20.5 };
      else if (type === 'stop' || type === 'hold') replacement = { type, ids: [worker.id] };
      else replacement = { type, ids: [worker.id], target: type === 'attack' ? foe.id : type === 'repair' ? depot.id : node.id };
      expect(issueCommand(s, 0, replacement)).toBe(true);
      expect(waiting(worker)).toEqual([]);
      expect(worker.order.type).toBe(type === 'repair' ? 'build' : type === 'stop' ? 'idle' : type);
    },
  );

  it('rejects invalid queued commands without changing current or waiting orders', () => {
    const { s, worker } = fixture();
    const depot = building(s, 'depot', 23.5, 24.5);
    const foe = opponent(s, 24.5, 20.5);
    const exhausted = { id: s.nextId++, kind: 'wood' as const, x: 21.5, y: 24.5, amount: 0, maxAmount: 20 };
    s.resources.push(exhausted);
    refreshVisibility(s);
    expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 20.5 })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 22.5, queued: true })).toBe(true);
    stepGame(s, .05);
    const before = structuredClone(worker);
    const hiddenHQ = s.entities.find(e => e.side === 1 && e.role === 'hq')!;
    const invalid: QueuedCommand[] = [
      { type: 'move', ids: [worker.id], x: NaN, y: 20.5, queued: true },
      { type: 'attackMove', ids: [worker.id], x: 20.5, y: Infinity, queued: true },
      { type: 'attack', ids: [worker.id], target: worker.id, queued: true },
      { type: 'attack', ids: [worker.id], target: hiddenHQ.id, queued: true },
      { type: 'attack', ids: [worker.id], target: -1, queued: true },
      { type: 'gather', ids: [worker.id], target: exhausted.id, queued: true },
      { type: 'gather', ids: [worker.id], target: depot.id, queued: true },
      { type: 'repair', ids: [worker.id], target: depot.id, queued: true },
      { type: 'repair', ids: [worker.id], target: worker.id, queued: true },
      { type: 'repair', ids: [worker.id], target: foe.id, queued: true },
    ];
    for (const c of invalid) {
      expect(command(s, c)).toBe(false);
      expect(worker).toEqual(before);
    }
    expect(command(s, { type: 'move', ids: [worker.id], x: 18.5, y: 20.5, queued: true }, 1)).toBe(false);
    expect(worker).toEqual(before);
  });

  it('keeps at most 32 waiting orders and preserves the full queue when refusing another', () => {
    const { s, worker } = fixture();
    expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 20.5 })).toBe(true);
    for (let i = 0; i < 32; i++) {
      expect(command(s, { type: 'move', ids: [worker.id], x: 23.5, y: 20.5, queued: true })).toBe(true);
    }
    expect(waiting(worker)).toHaveLength(32);
    const before = structuredClone(worker);
    expect(command(s, { type: 'move', ids: [worker.id], x: 25.5, y: 20.5, queued: true })).toBe(false);
    expect(worker).toEqual(before);
    advance(s, 5);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(waiting(worker)).toEqual([]);
    expect(distance(worker, 23.5, 20.5)).toBeLessThan(.6);
  });

  it('continues its next order after killing the current attack target', () => {
    const { s, worker } = fixture();
    const foe = opponent(s, 21.5, 20.5);
    foe.hp = 1;
    refreshVisibility(s);
    expect(command(s, { type: 'attack', ids: [worker.id], target: foe.id })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 18.5, y: 20.5, queued: true })).toBe(true);
    stepGame(s, .05);
    expect(foe.hp).toBe(0);
    expect(s.events.some(e => e.type === 'death' && e.source === foe.id)).toBe(true);
    advance(s, 4);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(waiting(worker)).toEqual([]);
    expect(distance(worker, 18.5, 20.5)).toBeLessThan(.6);
  });

  it('finishes an attack-move waypoint after combat before starting the queued move', () => {
    const { s, worker } = fixture();
    const foe = opponent(s, 21.5, 20.5);
    foe.hp = 1;
    refreshVisibility(s);
    expect(command(s, { type: 'attackMove', ids: [worker.id], x: 24.5, y: 20.5 })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 24.5, y: 24.5, queued: true })).toBe(true);
    stepGame(s, .05);
    expect(foe.hp).toBe(0);
    expect(worker.order.type).toBe('attackMove');
    let reachedWaypoint = false;
    for (let i = 0; i < 200; i++) {
      stepGame(s, .05);
      if (worker.order.type === 'move') {
        expect(distance(worker, 24.5, 20.5)).toBeLessThan(.75);
        reachedWaypoint = true;
        break;
      }
    }
    expect(reachedWaypoint).toBe(true);
    advance(s, 5);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(distance(worker, 24.5, 24.5)).toBeLessThan(.6);
  });

  it.each(['dead', 'hidden'] as const)('continues after its active attack target becomes %s', loss => {
    const { s, worker } = fixture();
    const foe = opponent(s, 24.5, 20.5);
    refreshVisibility(s);
    expect(command(s, { type: 'attack', ids: [worker.id], target: foe.id })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 20.5, y: 24.5, queued: true })).toBe(true);
    if (loss === 'dead') foe.hp = 0;
    else foe.x = foe.y = 40.5;
    refreshVisibility(s);
    advance(s, 5);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(waiting(worker)).toEqual([]);
    expect(distance(worker, 20.5, 24.5)).toBeLessThan(.6);
  });

  it.each(['attack', 'gather', 'repair'] as const)('skips a queued %s whose target is no longer eligible at activation', type => {
    const { s, worker } = fixture();
    const foe = opponent(s, 24.5, 20.5);
    const depot = building(s, 'depot', 23.5, 24.5);
    depot.hp -= 18;
    const node = { id: s.nextId++, kind: 'wood' as const, x: 21.5, y: 24.5, amount: 2, maxAmount: 2 };
    s.resources.push(node);
    refreshVisibility(s);
    expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 20.5 })).toBe(true);
    const target = type === 'attack' ? foe.id : type === 'gather' ? node.id : depot.id;
    expect(command(s, { type, ids: [worker.id], target, queued: true })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 18.5, y: 20.5, queued: true })).toBe(true);
    if (type === 'attack') foe.hp = 0;
    if (type === 'gather') node.amount = 0;
    if (type === 'repair') depot.hp = depot.maxHp;
    advance(s, 7);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(waiting(worker)).toEqual([]);
    expect(distance(worker, 18.5, 20.5)).toBeLessThan(.6);
  });

  it('skips a queued attack that is hidden when the preceding move finishes', () => {
    const { s, worker } = fixture();
    const foe = opponent(s, 24.5, 20.5);
    refreshVisibility(s);
    expect(command(s, { type: 'move', ids: [worker.id], x: 22.5, y: 20.5 })).toBe(true);
    expect(command(s, { type: 'attack', ids: [worker.id], target: foe.id, queued: true })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 18.5, y: 20.5, queued: true })).toBe(true);
    foe.x = foe.y = 40.5;
    refreshVisibility(s);
    advance(s, 7);
    expect(foe.hp).toBe(foe.maxHp);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(waiting(worker)).toEqual([]);
    expect(distance(worker, 18.5, 20.5)).toBeLessThan(.6);
  });

  it('waits for full construction and repair before executing the next move', () => {
    const { s, worker } = fixture();
    const depot = building(s, 'depot', 23.5, 20.5);
    depot.progress = .9;
    depot.hp -= 80;
    refreshVisibility(s);
    expect(command(s, { type: 'repair', ids: [worker.id], target: depot.id })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 20.5, y: 24.5, queued: true })).toBe(true);
    let advanced = false;
    for (let i = 0; i < 200; i++) {
      stepGame(s, .05);
      if (worker.order.type !== 'build') {
        expect(depot.progress).toBe(1);
        expect(depot.hp).toBe(depot.maxHp);
        advanced = true;
        break;
      }
      expect(waiting(worker)).toHaveLength(1);
    }
    expect(advanced).toBe(true);
    advance(s, 5);
    expect(distance(worker, 20.5, 24.5)).toBeLessThan(.6);
  });

  it('deposits the depleted node before leaving and does not harvest another node', () => {
    const { s, worker } = fixture();
    building(s, 'depot', 20.5, 24.5);
    const node = { id: s.nextId++, kind: 'wood' as const, x: 21.5, y: 20.5, amount: 2, maxAmount: 2 };
    const other = { id: s.nextId++, kind: 'wood' as const, x: 24.5, y: 23.5, amount: 100, maxAmount: 100 };
    s.resources.push(node, other);
    refreshVisibility(s);
    const wood = s.players[0].wood;
    expect(command(s, { type: 'gather', ids: [worker.id], target: node.id })).toBe(true);
    expect(command(s, { type: 'move', ids: [worker.id], x: 25.5, y: 20.5, queued: true })).toBe(true);
    advance(s, 1);
    expect(node.amount).toBe(0);
    expect(worker.carried).toBeCloseTo(2);
    expect(worker.order).toEqual({ type: 'gather', target: node.id });
    expect(s.players[0].wood).toBe(wood);
    advance(s, 9);
    expect(worker.carried).toBe(0);
    expect(s.players[0].wood).toBeCloseTo(wood + 2);
    expect(other.amount).toBe(100);
    expect(worker.order).toEqual({ type: 'idle' });
    expect(distance(worker, 25.5, 20.5)).toBeLessThan(.6);
  });

  it('retains automatic gather retargeting when no following order was queued', () => {
    const { s, worker } = fixture();
    building(s, 'depot', 20.5, 24.5);
    const node = { id: s.nextId++, kind: 'wood' as const, x: 21.5, y: 20.5, amount: 2, maxAmount: 2 };
    const other = { id: s.nextId++, kind: 'wood' as const, x: 24.5, y: 23.5, amount: 100, maxAmount: 100 };
    s.resources.push(node, other);
    refreshVisibility(s);
    expect(command(s, { type: 'gather', ids: [worker.id], target: node.id })).toBe(true);
    advance(s, 8);
    expect(node.amount).toBe(0);
    expect(other.amount).toBeLessThan(100);
    expect(worker.order).toEqual({ type: 'gather', target: other.id });
    expect(waiting(worker)).toEqual([]);
  });
});
