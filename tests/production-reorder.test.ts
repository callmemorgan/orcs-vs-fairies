import {describe, expect, it} from 'vitest';
import {FACTIONS} from '../src/core/content';
import {canPlace, createGame, issueCommand, stepGame} from '../src/core/simulation';
import type {Command, GameState, Side, UnitRole} from '../src/core/types';

const purchasedRoles = ['melee', 'ranged', 'spear', 'cavalry'] as const;
const step = .25;

function reorder(id:number, from:number, to:number):Command {
  return {type:'reorderTrain', id, from, to} as Command;
}

function funds(s:GameState) {
  const {wood, ore, crystal} = s.players[0];
  return {wood, ore, crystal};
}

function setup() {
  const s = createGame('orcs', 4127, 'fairies', {controllers:['external', 'external']});
  s.terrain.fill('grass');
  s.resources = [];
  Object.assign(s.players[0], {wood:4000, ore:4000, crystal:4000});
  s.players[0].upgrades.push('town-age');
  const hq = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
  const worker = s.entities.find(e => e.side === 0 && e.role === 'worker')!;
  const site = [...s.visible[0]]
    .map(i => ({x:i % s.width + .5, y:Math.floor(i / s.width) + .5}))
    .find(p => canPlace(s, 0, 'barracks', p.x, p.y))!;
  expect(site).toBeDefined();
  expect(issueCommand(s, 0, {type:'build', ids:[worker.id], role:'barracks', ...site})).toBe(true);
  const producer = s.entities.find(e => e.side === 0 && e.role === 'barracks')!;
  producer.progress = 1;
  producer.hp = producer.maxHp;
  expect(issueCommand(s, 0, {type:'stop', ids:[worker.id]})).toBe(true);
  const beforePurchase = funds(s);
  for (const role of purchasedRoles) {
    expect(issueCommand(s, 0, {type:'train', id:producer.id, role})).toBe(true);
  }
  for (const resource of ['wood', 'ore', 'crystal'] as const) {
    const paid = purchasedRoles.reduce((sum, role) => sum + FACTIONS.orcs.units[role].cost[resource], 0);
    expect(s.players[0][resource]).toBe(beforePurchase[resource] - paid);
  }
  for (let i = 0; i < 8; i++) stepGame(s, step);
  expect(producer.trainProgress).toBeGreaterThan(0);
  expect(producer.trainProgress).toBeLessThan(1);
  expect(producer.queue).toEqual(purchasedRoles);
  return {s, hq, worker, producer};
}

function expectRejected(s:GameState, side:Side, c:Command) {
  const before = structuredClone(s);
  expect(issueCommand(s, side, c)).toBe(false);
  expect(s).toEqual(before);
}

describe('reordering waiting recruits', () => {
  it.each([
    {from:3, to:1, expected:['melee', 'cavalry', 'ranged', 'spear'] as UnitRole[]},
    {from:1, to:3, expected:['melee', 'spear', 'cavalry', 'ranged'] as UnitRole[]},
  ])('produces the revised order after moving slot $from to $to without charging again', ({from, to, expected}) => {
    const {s, producer} = setup();
    const bank = funds(s);
    const progress = producer.trainProgress;
    const population = s.players[0].population;
    const initialIds = new Set(s.entities.map(e => e.id));
    expect(issueCommand(s, 0, reorder(producer.id, from, to))).toBe(true);
    expect(producer.queue).toEqual(expected);
    expect(producer.trainProgress).toBe(progress);
    expect(funds(s)).toEqual(bank);
    expect(s.players[0].population).toBe(population);

    const spawned:{role:UnitRole; time:number}[] = [];
    const startedAt = s.time;
    const remainingActiveTime = (1 - progress) * FACTIONS.orcs.units.melee.trainTime;
    const allowedTime = remainingActiveTime
      + expected.slice(1).reduce((sum, role) => sum + FACTIONS.orcs.units[role].trainTime, 0) + 2;
    for (let i = 0; i < Math.ceil(allowedTime / step) && spawned.length < expected.length; i++) {
      stepGame(s, step);
      for (const e of s.entities) {
        if (e.side !== 0 || e.kind !== 'unit' || initialIds.has(e.id)) continue;
        initialIds.add(e.id);
        spawned.push({role:e.role as UnitRole, time:s.time - startedAt});
      }
      expect(funds(s)).toEqual(bank);
    }
    expect(spawned.map(e => e.role)).toEqual(expected);
    expect(spawned[0].time).toBeLessThanOrEqual(remainingActiveTime + step);
    expect(producer.queue).toEqual([]);
    expect(producer.trainProgress).toBe(0);
    expect(s.players[0].population).toBe(population + purchasedRoles.length);
    for (let i = 0; i < 8; i++) stepGame(s, step);
    expect(s.players[0].population).toBe(population + purchasedRoles.length);
    expect(funds(s)).toEqual(bank);
  });

  it('keeps the same population reservations across production buildings', () => {
    const {s, hq, producer} = setup();
    for (let i = 0; i < 2; i++) {
      expect(issueCommand(s, 0, {type:'train', id:hq.id, role:'worker'})).toBe(true);
    }
    const bank = funds(s);
    expect(s.players[0].population + producer.queue.length + hq.queue.length).toBe(s.players[0].cap);
    expect(issueCommand(s, 0, reorder(producer.id, 3, 1))).toBe(true);
    expect(hq.queue).toEqual(['worker', 'worker']);
    expectRejected(s, 0, {type:'train', id:producer.id, role:'spear'});
    expect(funds(s)).toEqual(bank);
    expect(issueCommand(s, 0, {type:'cancelTrain', id:producer.id, index:2})).toBe(true);
    expect(issueCommand(s, 0, {type:'train', id:hq.id, role:'worker'})).toBe(true);
    expectRejected(s, 0, {type:'train', id:producer.id, role:'spear'});
  });

  it.each([
    [0, 1], [1, 0], [0, 0],
    [-1, 1], [1, -1], [4, 1], [1, 4],
    [1.5, 2], [1, 2.5], [NaN, 1], [1, NaN],
    [Infinity, 1], [1, Infinity], [1, 1],
  ])('rejects invalid or active slots %s to %s without changing gameplay state', (from, to) => {
    const {s, producer} = setup();
    expectRejected(s, 0, reorder(producer.id, from, to));
  });

  it('rejects an index that became stale after a waiting recruit was canceled', () => {
    const {s, producer} = setup();
    expect(issueCommand(s, 0, {type:'cancelTrain', id:producer.id, index:3})).toBe(true);
    expectRejected(s, 0, reorder(producer.id, 3, 1));
    expectRejected(s, 0, reorder(producer.id, 1, 3));
  });

  it('rejects another player, missing entities and units', () => {
    const {s, producer, worker} = setup();
    expectRejected(s, 1, reorder(producer.id, 3, 1));
    expectRejected(s, 0, reorder(s.nextId + 100, 3, 1));
    expectRejected(s, 0, reorder(worker.id, 3, 1));
    worker.queue = [...purchasedRoles];
    expectRejected(s, 0, reorder(worker.id, 3, 1));
  });

  it.each(['unfinished', 'dead'] as const)('rejects a %s producer with waiting recruits', condition => {
    const {s, producer} = setup();
    if (condition === 'unfinished') producer.progress = .5;
    else producer.hp = 0;
    expectRejected(s, 0, reorder(producer.id, 3, 1));
  });

  it.each(['won', 'drawn'] as const)('rejects changes after a game is %s', result => {
    const {s, producer} = setup();
    if (result === 'won') s.winner = 0;
    else s.draw = true;
    expectRejected(s, 0, reorder(producer.id, 3, 1));
  });
});
