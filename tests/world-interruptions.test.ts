import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { captureRuntime, createGame, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { loadGame, saveGame } from '../src/core/saves';
import { replayChecksum } from '../src/core/replays';
import { fogKey, levelOf } from '../src/core/world-map';
import { terrainAt } from '../src/core/maps';
import { walkable } from '../src/core/navigation';
import type { Entity, GameState, ResourceNode, Side, UnitRole } from '../src/core/types';
import type { WorldBridge, WorldState } from '../src/core/world-types';

type TestState = GameState & { world: WorldState };
const advance = (s: GameState, seconds: number) => {
 for (let i = 0; i < Math.ceil(seconds / .05); i++) stepGame(s, .05);
};

/** Author a valid starting checkpoint; every interruption below comes from normal commands and ticks. */
function fixture(): TestState {
 const s = createGame('orcs', 4127, 'fairies', { controllers: ['human', 'human'], mapSize: 'small', biome: 'forest' }) as TestState;
 s.entities = s.entities.filter(e => e.kind === 'building' && e.role === 'hq');
 s.resources = [];
 for (const level of s.world.levels) { level.terrain.fill('grass'); level.elevation.fill(0); }
 Object.assign(s.world, { transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 10000, seasonLength: 100, weatherLength: 10000 });
 return s;
}

function unit(s: TestState, side: Side, role: UnitRole, x: number, y: number, level = 0): Entity {
 const def = FACTIONS[s.players[side].faction].units[role];
 const e: Entity = { id: s.nextId++, side, kind: 'unit', role, x, y, level, hp: def.hp, maxHp: def.hp, order: { type: 'idle' }, cooldown: 0, progress: 1, queue: [], trainProgress: 0, researchProgress: 0, facing: 2, animation: 'idle', animTime: 0, momentum: 0, illusion: false, expires: 0, carried: 0, carriedKind: 'wood', path: [] };
 if (def.shield) { e.shield = def.shield; e.maxShield = def.shield; }
 s.entities.push(e);
 return e;
}

function tree(s: TestState, x: number, y: number): ResourceNode {
 const n: ResourceNode = { id: s.nextId++, kind: 'wood', amount: 1000, maxAmount: 1000, x, y, level: 0 };
 s.resources.push(n);
 return n;
}

function bridge(s: TestState, hp: number): WorldBridge {
 const tile = 10 * s.width + 10;
 s.terrain[tile] = hp ? 'bridge' : 'water';
 const b: WorldBridge = { id: s.nextId++, x: 10.5, y: 10.5, level: 0, hp, maxHp: 160, tiles: [tile], rebuilding: 0, repairSide: null };
 s.world.bridges.push(b);
 return b;
}

function ready(s: TestState): void {
 refreshVisibility(s);
 expect(() => saveGame(s)).not.toThrow();
}

function queueGather(s: TestState, worker: Entity, node: ResourceNode): void {
 expect(issueCommand(s, worker.side, { type: 'gather', ids: [worker.id], target: node.id, queued: true })).toBe(true);
 expect(issueCommand(s, worker.side, { type: 'move', ids: [worker.id], x: 7.5, y: 10.5, queued: true })).toBe(true);
 expect(captureRuntime(s).queuedGather).toContain(worker.id);
 expect(() => saveGame(s)).not.toThrow();
}

function validCheckpoint(s: TestState, interruptedWorker?: Entity): void {
 expect(() => saveGame(s)).not.toThrow();
 if (interruptedWorker) expect(captureRuntime(s).queuedGather).not.toContain(interruptedWorker.id);
 const restored = loadGame(saveGame(s));
 expect(replayChecksum(restored)).toBe(replayChecksum(s));
 for (let i = 0; i < 20; i++) {
  stepGame(s, .05); stepGame(restored, .05);
  expect(replayChecksum(restored)).toBe(replayChecksum(s));
 }
}

describe('world orders interrupted through normal play', () => {
 it('finishes an attack and its queued move after a still-visible target traverses to another level', () => {
  const s = fixture(), attacker = unit(s, 0, 'melee', 9.5, 10.5), target = unit(s, 1, 'worker', 10.5, 10.5);
  unit(s, 0, 'worker', 11.5, 10.5, 1);
  s.world.transitions.push({ id: 1, from: { x: 10.5, y: 10.5, level: 0 }, to: { x: 10.5, y: 10.5, level: 1 } });
  ready(s);
  expect(issueCommand(s, 0, { type: 'attack', ids: [attacker.id], target: target.id })).toBe(true);
  expect(issueCommand(s, 0, { type: 'move', ids: [attacker.id], x: 7.5, y: 10.5, queued: true })).toBe(true);
  expect(issueCommand(s, 1, { type: 'traverse', ids: [target.id], transition: 1 })).toBe(true);
  advance(s, 8);
  expect(levelOf(target)).toBe(1);
  expect(target.hp).toBeGreaterThan(0);
  expect(s.visible[0].has(fogKey(s, target))).toBe(true);
  expect(attacker.order.type).toBe('idle');
  expect(attacker.orderQueue).toBeUndefined();
  expect(Math.hypot(attacker.x - 7.5, attacker.y - 10.5)).toBeLessThan(.6);
  validCheckpoint(s);
 });

 it('clears queued gather memory when bridge collapse evacuates a worker', () => {
  const s = fixture(), crossing = bridge(s, 1), worker = unit(s, 0, 'worker', 10.5, 10.5), siege = unit(s, 0, 'siege', 12.5, 10.5), node = tree(s, 10.5, 11.5);
  ready(s); queueGather(s, worker, node);
  expect(issueCommand(s, 0, { type: 'worldAttack', ids: [siege.id], target: crossing.id })).toBe(true);
  stepGame(s, .05);
  expect(s.projectiles).toHaveLength(1);
  for (let i = 0; crossing.hp > 0 && i < 30; i++) stepGame(s, .05);
  expect(crossing.hp).toBe(0);
  expect(worker.hp).toBeGreaterThan(0);
  expect(worker.hp).toBeLessThan(worker.maxHp);
  expect(walkable(s, worker.x, worker.y)).toBe(true);
  expect(worker.order.type).toBe('idle');
  expect(worker.orderQueue).toBeUndefined();
  validCheckpoint(s, worker);
 });

 it('clears queued gather memory when a worker dies in a commanded forest fire', () => {
  const s = fixture(), worker = unit(s, 0, 'worker', 10.5, 10.5), fireStarter = unit(s, 0, 'worker', 9.5, 10.5), node = tree(s, 10.5, 10.5);
  worker.hp = .01;
  ready(s); queueGather(s, worker, node);
  expect(issueCommand(s, 0, { type: 'ignite', ids: [fireStarter.id], x: 10.5, y: 10.5 })).toBe(true);
  stepGame(s, .05);
  expect(worker.hp).toBe(0);
  expect(worker.order.type).toBe('idle');
  expect(worker.orderQueue).toBeUndefined();
  expect(s.corpses.some(c => c.id === worker.id)).toBe(true);
  validCheckpoint(s, worker);
 });

 it('clears queued gather memory when spring thaw evacuates a worker to a bank', () => {
  const s = fixture(), worker = unit(s, 0, 'worker', 10.5, 10.5), node = tree(s, 11.5, 10.5), tile = 10 * s.width + 10;
  s.time = 399.95; s.terrain[tile] = 'ice'; s.world.iceTiles.push({ level: 0, tile });
  ready(s); queueGather(s, worker, node);
  stepGame(s, .1);
  expect(terrainAt(s, 10.5, 10.5)).toBe('water');
  expect(worker.hp).toBeGreaterThan(0);
  expect(worker.hp).toBeLessThan(worker.maxHp);
  expect(walkable(s, worker.x, worker.y)).toBe(true);
  expect(worker.order.type).toBe('idle');
  expect(worker.orderQueue).toBeUndefined();
  validCheckpoint(s, worker);
 });

 it('clears queued gather memory when spring thaw drowns a worker far from banks', () => {
  const s = fixture(), worker = unit(s, 0, 'worker', 15.5, 15.5), node = tree(s, 16.5, 15.5);
  s.time = 399.95;
  for (let y = 8; y <= 22; y++) for (let x = 8; x <= 22; x++) {
   const tile = y * s.width + x; s.terrain[tile] = 'ice'; s.world.iceTiles.push({ level: 0, tile });
  }
  ready(s); queueGather(s, worker, node);
  stepGame(s, .1);
  expect(worker.hp).toBe(0);
  expect(worker.order.type).toBe('idle');
  expect(worker.orderQueue).toBeUndefined();
  expect(s.corpses.some(c => c.id === worker.id)).toBe(true);
  validCheckpoint(s, worker);
 });

 it('releases a paid bridge rebuilding claim after stop so another side can pay to rebuild', () => {
  const s = fixture(), crossing = bridge(s, 0), first = unit(s, 0, 'worker', 9.5, 10.5), next = unit(s, 1, 'worker', 11.5, 11.5), fee = 60 + crossing.tiles.length * 2;
  ready(s);
  const firstWood = s.players[0].wood;
  expect(issueCommand(s, 0, { type: 'repairBridge', ids: [first.id], target: crossing.id })).toBe(true);
  stepGame(s, .05);
  expect(crossing.repairSide).toBe(0);
  expect(crossing.rebuilding).toBeGreaterThan(0);
  expect(s.players[0].wood).toBe(firstWood - fee);
  expect(issueCommand(s, 0, { type: 'stop', ids: [first.id] })).toBe(true);
  stepGame(s, .05);
  expect(crossing.repairSide).toBeNull();
  expect(crossing.rebuilding).toBe(0);
  expect(s.players[0].wood).toBe(firstWood - fee);
  const nextWood = s.players[1].wood, nextOre = s.players[1].ore;
  expect(issueCommand(s, 1, { type: 'repairBridge', ids: [next.id], target: crossing.id })).toBe(true);
  expect(s.players[1].wood).toBe(nextWood - fee);
  expect(s.players[1].ore).toBe(nextOre - 20);
  validCheckpoint(s);
 });

 for (const ore of [0, 220]) it(`charges a rebuilding fee or cancels a live repair after allied siege destruction (${ore} ore)`, () => {
  const s = fixture(), crossing = bridge(s, 1), worker = unit(s, 0, 'worker', 9.5, 10.5), siege = unit(s, 0, 'siege', 11.5, 10.5), fee = 60 + crossing.tiles.length * 2;
  s.players[0].ore = ore;
  ready(s);
  const beforeWood = s.players[0].wood;
  expect(issueCommand(s, 0, { type: 'repairBridge', ids: [worker.id], target: crossing.id })).toBe(true);
  expect(s.players[0].wood).toBe(beforeWood);
  expect(s.players[0].ore).toBe(ore);
  expect(issueCommand(s, 0, { type: 'worldAttack', ids: [siege.id], target: crossing.id })).toBe(true);
  stepGame(s, .05);
  expect(s.projectiles).toHaveLength(1);
  for (let i = 0; crossing.hp > 0 && i < 30; i++) stepGame(s, .05);
  expect(crossing.hp).toBe(0);
  advance(s, 13);
  if (crossing.hp > 0 || crossing.rebuilding > 0 || worker.order.type === 'repairBridge') {
   expect(s.players[0].wood).toBeLessThanOrEqual(beforeWood - fee);
   expect(s.players[0].ore).toBe(ore - 20);
  } else {
   expect(crossing.hp).toBe(0);
   expect(worker.order.type).not.toBe('repairBridge');
  }
  if (ore === 0) expect(crossing.hp).toBe(0);
  validCheckpoint(s);
 });
});
