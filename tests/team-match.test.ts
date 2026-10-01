import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { walkable } from '../src/core/navigation';
import { playerAge } from '../src/core/progression';
import { createMatch, isAllied, isGameOver, isHostile, isVisible, issueCommand, refreshVisibility, runAI, stepGame } from '../src/core/simulation';
import type { BuildingRole, Entity, FactionId, GameState, MapSize, Side, UnitRole } from '../src/core/types';

type MatchConfig = Parameters<typeof createMatch>[0];
const factions = Object.keys(FACTIONS) as FactionId[];
const sides = (s: GameState) => s.players.map((_, side) => side as Side);

// Alternating membership catches code that confuses player IDs with team IDs.
function config(count = 4, overrides: Partial<MatchConfig> = {}): MatchConfig {
  return {
    map: { seed: 4127, size: 'large' },
    players: Array.from({ length: count }, (_, id) => ({
      id: id as Side,
      teamId: id % 2 === 0 ? 3 : 7,
      factionId: factions[id % factions.length],
      controller: 'external' as const,
    })),
    ...overrides,
  };
}
function hall(s: GameState, side: Side) {
  return s.entities.find(e => e.side === side && e.role === 'hq' && e.hp > 0)!;
}
function unit(s: GameState, side: Side, role: UnitRole = 'melee') {
  return s.entities.find(e => e.side === side && e.kind === 'unit' && e.role === role && e.hp > 0)!;
}
function advance(s: GameState, seconds: number, inspect?: () => void) {
  for (let i = 0; i < Math.ceil(seconds / .25); i++) {
    stepGame(s, .25);
    inspect?.();
  }
}
function arena(count = 4): GameState {
  const s = createMatch(config(count));
  s.terrain.fill('grass');
  s.resources = [];
  for (const e of s.entities) if (e.kind === 'unit') e.order = { type: 'hold' };
  refreshVisibility(s);
  return s;
}
function add(s: GameState, side: Side, kind: Entity['kind'], role: UnitRole | BuildingRole, x: number, y: number): Entity {
  const faction = FACTIONS[s.players[side].faction];
  const def = kind === 'unit' ? faction.units[role as UnitRole] : faction.buildings[role as BuildingRole];
  const e: Entity = {
    id: s.nextId++, side, kind, role, x, y, hp: def.hp, maxHp: def.hp,
    order: { type: 'hold' }, cooldown: 0, progress: 1, queue: [], trainProgress: 0,
    researchProgress: 0, facing: 0, animation: 'idle', animTime: 0, momentum: 0,
    illusion: false, expires: 0, carried: 0, carriedKind: 'wood', path: [],
  };
  if (kind === 'unit' && 'shield' in def && def.shield) e.shield = e.maxShield = def.shield;
  s.entities.push(e);
  refreshVisibility(s);
  return e;
}

describe('playable team rosters', () => {
  it.each([4, 6, 8])('runs hostile combat for every player in a %s-player match', count => {
    const s = arena(count);
    const fighters = sides(s).map(side => unit(s, side));
    for (let pair = 0; pair < count / 2; pair++) {
      Object.assign(fighters[pair * 2], { x: 20, y: 14 + pair * 5 });
      Object.assign(fighters[pair * 2 + 1], { x: 21.2, y: 14 + pair * 5 });
    }
    refreshVisibility(s);
    const before = fighters.map(e => e.hp + (e.shield ?? 0));
    const attacks = Array(count).fill(0);
    for (const side of sides(s)) {
      const ally = fighters[(side + 2) % count];
      const hostile = fighters[side % 2 === 0 ? side + 1 : side - 1];
      expect(isAllied(s, side, ally.side)).toBe(true);
      expect(isHostile(s, side, hostile.side)).toBe(true);
      expect(issueCommand(s, side, { type: 'attack', ids: [fighters[side].id], target: ally.id })).toBe(false);
      expect(issueCommand(s, side, { type: 'attack', ids: [fighters[side].id], target: hostile.id })).toBe(true);
    }
    advance(s, 4, () => {
      for (const event of s.events.filter(e => e.type === 'attack')) {
        const target = s.entities.find(e => e.id === event.target)!;
        expect(isHostile(s, event.side, target.side)).toBe(true);
        attacks[event.side]++;
      }
    });
    for (const side of sides(s)) {
      expect(attacks[side], `player ${side} never attacked`).toBeGreaterThan(0);
      expect(fighters[side].hp + (fighters[side].shield ?? 0)).toBeLessThan(before[side]);
    }
    expect(s.winningTeam).toBeNull();
    expect(isGameOver(s)).toBe(false);
  });

  it.each([4, 6, 8])('gives every player legal, distinct starting units in a %s-player match', count => {
    for (const size of ['small', 'medium', 'large', 'huge'] as MapSize[]) {
      for (const seed of [0, 17, 4127]) {
        const s = createMatch(config(count, { map: { seed, size } }));
        expect(s.players).toHaveLength(count);
        expect(s.starts).toHaveLength(count);
        expect(new Set(s.starts.map(p => `${p.x},${p.y}`)).size).toBe(count);
        const positions = new Set<string>();
        for (const side of sides(s)) {
          const owned = s.entities.filter(e => e.side === side);
          expect(owned.filter(e => e.role === 'hq')).toHaveLength(1);
          expect(owned.filter(e => e.role === 'worker')).toHaveLength(5);
          expect(owned.filter(e => e.role === 'melee')).toHaveLength(1);
          for (const e of owned.filter(e => e.kind === 'unit')) {
            expect(walkable(s, e.x, e.y), `${count}/${size}/${seed}/player ${side}`).toBe(true);
            const key = `${e.x},${e.y}`;
            expect(positions.has(key)).toBe(false);
            positions.add(key);
          }
          expect(s.players[side].population).toBe(6);
          expect(s.visible[side].size).toBeGreaterThan(0);
          expect(s.eliminated[side]).toBe(false);
        }
      }
    }
  });

  it('honors an explicit permutation of starting slots', () => {
    const original = createMatch(config());
    const c = config();
    c.players = c.players.map((p, index) => ({ ...p, startingSlot: [2, 0, 3, 1][index] }));
    const swapped = createMatch(c);
    expect(swapped.starts).toEqual([original.starts[2], original.starts[0], original.starts[3], original.starts[1]]);
    for (const side of sides(swapped)) expect(hall(swapped, side)).toMatchObject(swapped.starts[side]);
  });
});

describe('team ownership and combat', () => {
  it('keeps command ownership separate from alliance and shared vision', () => {
    const s = arena();
    const ally = unit(s, 2), allyHall = hall(s, 2), before = structuredClone(s.players);
    expect(isAllied(s, 0, 2)).toBe(true);
    expect(issueCommand(s, 0, { type: 'move', ids: [ally.id], x: ally.x + 3, y: ally.y })).toBe(false);
    expect(issueCommand(s, 0, { type: 'stop', ids: [ally.id] })).toBe(false);
    expect(issueCommand(s, 0, { type: 'ability', ids: [ally.id] })).toBe(false);
    expect(issueCommand(s, 0, { type: 'train', id: allyHall.id, role: 'worker' })).toBe(false);
    expect(issueCommand(s, 0, { type: 'research', id: allyHall.id, upgrade: 'worker-harvest' })).toBe(false);
    expect(issueCommand(s, 0, { type: 'setRally', ids: [allyHall.id], x: ally.x, y: ally.y })).toBe(false);
    expect(ally.order).toEqual({ type: 'hold' });
    expect(s.players).toEqual(before);
  });

  it.each(['idle', 'hold', 'attackMove'] as const)('ignores a closer teammate while %s attacks a hostile', orderType => {
    const s = arena(), fighter = unit(s, 0), ally = unit(s, 2, 'worker'), hostile = unit(s, 1, 'worker');
    Object.assign(fighter, { x: 20, y: 20, order: orderType === 'attackMove' ? { type: orderType, x: 25, y: 20 } : { type: orderType } });
    Object.assign(ally, { x: 20.5, y: 20 });
    Object.assign(hostile, { x: 21.2, y: 20, cooldown: 100 });
    refreshVisibility(s);
    const allyHp = ally.hp;
    stepGame(s, .05);
    const hits = s.events.filter(e => e.type === 'attack' && e.source === fighter.id);
    expect(hits).toHaveLength(1);
    expect(hits[0].target).toBe(hostile.id);
    expect(hostile.hp).toBeLessThan(hostile.maxHp);
    expect(ally.hp).toBe(allyHp);
  });

  it('towers fire at hostile troops and leave nearby teammates unharmed', () => {
    const s = arena(), tower = add(s, 0, 'building', 'tower', 20, 20);
    const ally = unit(s, 2, 'worker'), hostile = unit(s, 1, 'worker');
    Object.assign(ally, { x: 22, y: 20 });
    Object.assign(hostile, { x: 24, y: 20 });
    refreshVisibility(s);
    stepGame(s, .05);
    expect(s.events.find(e => e.type === 'attack' && e.source === tower.id)?.target).toBe(hostile.id);
    expect(hostile.hp).toBeLessThan(hostile.maxHp);
    expect(ally.hp).toBe(ally.maxHp);
  });

  it('rejects queued attacks on teammates and discards a stale friendly attack order', () => {
    const s = arena(), fighter = unit(s, 0), ally = unit(s, 2, 'worker');
    Object.assign(fighter, { x: 20, y: 20 });
    Object.assign(ally, { x: 21, y: 20 });
    refreshVisibility(s);
    expect(issueCommand(s, 0, { type: 'attack', ids: [fighter.id], target: ally.id, queued: true })).toBe(false);
    fighter.order = { type: 'attack', target: ally.id };
    stepGame(s, .05);
    expect(fighter.order.type).toBe('idle');
    expect(ally.hp).toBe(ally.maxHp);
    expect(s.events.some(e => e.type === 'attack' && e.source === fighter.id)).toBe(false);
  });

  it('repairs an allied building with the commanding worker owner paying', () => {
    const s = arena(), worker = unit(s, 0, 'worker'), allyHall = hall(s, 2);
    Object.assign(worker, { x: allyHall.x + 2.6, y: allyHall.y });
    allyHall.hp -= 100;
    const wood = s.players.map(p => p.wood);
    refreshVisibility(s);
    expect(issueCommand(s, 0, { type: 'repair', ids: [worker.id], target: allyHall.id })).toBe(true);
    expect(issueCommand(s, 2, { type: 'repair', ids: [worker.id], target: allyHall.id })).toBe(false);
    advance(s, 2);
    expect(allyHall.hp).toBeCloseTo(allyHall.maxHp - 64, 6);
    expect(s.players[0].wood).toBeCloseTo(wood[0] - 3.6, 6);
    expect(s.players[2].wood).toBe(wood[2]);
  });

  it('completes a queued allied foundation before continuing to the next waypoint', () => {
    const s = arena(), worker = unit(s, 0, 'worker');
    const depot = add(s, 2, 'building', 'depot', 24, 20);
    depot.progress = .5;
    depot.hp = depot.maxHp * .5;
    Object.assign(worker, { x: 21.8, y: 20 });
    const ownerWood = s.players[0].wood;
    expect(issueCommand(s, 0, { type: 'move', ids: [worker.id], x: 22, y: 20 })).toBe(true);
    expect(issueCommand(s, 0, { type: 'repair', ids: [worker.id], target: depot.id, queued: true })).toBe(true);
    expect(issueCommand(s, 0, { type: 'move', ids: [worker.id], x: 19, y: 20, queued: true })).toBe(true);
    advance(s, 35);
    expect(depot.progress).toBe(1);
    expect(s.players[2].cap).toBe(22);
    expect(s.players[0].cap).toBe(12);
    expect(s.players[0].wood).toBeLessThanOrEqual(ownerWood);
    expect(Math.hypot(worker.x - 19, worker.y - 20)).toBeLessThan(.6);
    expect(worker.orderQueue).toBeUndefined();
  });

  it('charges an allied repair only for the work the worker owner can afford', () => {
    const s = arena(), worker = unit(s, 0, 'worker'), allyHall = hall(s, 2);
    Object.assign(worker, { x: allyHall.x + 2.6, y: allyHall.y });
    allyHall.hp -= .5;
    s.players[0].wood = .03;
    s.players[2].wood = 1000;
    refreshVisibility(s);
    expect(issueCommand(s, 0, { type: 'repair', ids: [worker.id], target: allyHall.id })).toBe(true);
    stepGame(s, .25);
    expect(allyHall.hp).toBeCloseTo(allyHall.maxHp - .2, 6);
    expect(s.players[0].wood).toBe(0);
    expect(s.players[2].wood).toBe(1000);
    stepGame(s, .25);
    expect(allyHall.hp).toBeCloseTo(allyHall.maxHp - .2, 6);
  });

  it('shares Fairy grove healing with allies while excluding enemies and illusions', () => {
    const c = config();
    c.players[0].factionId = 'fairies';
    const s = createMatch(c);
    s.terrain.fill('grass');
    s.resources = [];
    const grove = add(s, 0, 'building', 'depot', 20, 20);
    const ally = add(s, 2, 'unit', 'worker', 23, 20);
    const enemy = add(s, 1, 'unit', 'worker', 20, 23);
    const illusion = add(s, 2, 'unit', 'worker', 17, 20);
    const distant = add(s, 2, 'unit', 'worker', 30, 20);
    illusion.illusion = true;
    for (const e of [ally, enemy, illusion, distant]) { e.hp -= 20; e.cooldown = 100; }
    advance(s, 2);
    expect(ally.hp).toBeCloseTo(ally.maxHp - 15, 6);
    expect(enemy.hp).toBe(enemy.maxHp - 20);
    expect(illusion.hp).toBe(illusion.maxHp - 20);
    expect(distant.hp).toBe(distant.maxHp - 20);
    grove.progress = .5;
    advance(s, 2);
    expect(ally.hp).toBeCloseTo(ally.maxHp - 15, 6);
  });

  it('lets Tideborn surge heal and accelerate another faction teammate', () => {
    const c = config();
    c.players[0].factionId = 'tideborn';
    const s = createMatch(c);
    s.terrain.fill('grass');
    s.resources = [];
    const caster = add(s, 0, 'unit', 'special', 20, 20);
    const ally = add(s, 2, 'unit', 'melee', 23, 20);
    const enemy = add(s, 1, 'unit', 'worker', 20, 23);
    ally.hp -= 50;
    enemy.hp -= 50;
    expect(issueCommand(s, 0, { type: 'ability', ids: [caster.id] })).toBe(true);
    expect(ally.hp).toBe(ally.maxHp - 15);
    expect(ally.surgeUntil).toBe(6);
    expect(enemy.hp).toBe(enemy.maxHp - 50);
    expect(enemy.surgeUntil).toBeUndefined();
    expect(issueCommand(s, 2, { type: 'ability', ids: [caster.id] })).toBe(false);
  });

  it('lets Automata ward restore allied shields without restoring enemies', () => {
    const c = config();
    c.players[0].factionId = c.players[2].factionId = c.players[1].factionId = 'automata';
    const s = createMatch(c);
    s.terrain.fill('grass');
    s.resources = [];
    const caster = add(s, 0, 'unit', 'special', 20, 20);
    const ally = add(s, 2, 'unit', 'melee', 23, 20);
    const enemy = add(s, 1, 'unit', 'melee', 20, 23);
    const unshielded = add(s, 3, 'unit', 'worker', 17, 20);
    ally.shield = enemy.shield = 0;
    expect(issueCommand(s, 0, { type: 'ability', ids: [caster.id] })).toBe(true);
    expect(ally.shield).toBe(24);
    expect(enemy.shield).toBe(0);
    expect(unshielded.shield).toBeUndefined();
    expect(issueCommand(s, 0, { type: 'ability', ids: [caster.id] })).toBe(false);
  });

  it('packs up a teammate emplacement when allied construction displaces it', () => {
    const s = arena(), worker = unit(s, 0, 'worker');
    const emplacement = add(s, 2, 'unit', 'ranged', 24, 20);
    Object.assign(worker, { x: 21.5, y: 20 });
    expect(issueCommand(s, 2, { type: 'ability', ids: [emplacement.id] })).toBe(true);
    advance(s, 4);
    expect(emplacement.entrenchedAt).toBe(0);
    refreshVisibility(s);
    expect(issueCommand(s, 0, { type: 'build', ids: [worker.id], role: 'depot', x: 24, y: 20 })).toBe(true);
    expect(Math.hypot(emplacement.x - 24, emplacement.y - 20)).toBeGreaterThan(1);
    expect(walkable(s, emplacement.x, emplacement.y)).toBe(true);
    expect(emplacement.entrenchedAt).toBeUndefined();
    expect(emplacement.order).toEqual({ type: 'hold' });
  });
});

describe('shared team vision', () => {
  it.each([true, false])('uses sharedVision=%s for an enemy seen only at a teammate base', sharedVision => {
    const s = createMatch(config(4, { rules: { sharedVision } }));
    const allyHall = hall(s, 2), enemy = unit(s, 1), fighter = unit(s, 0);
    Object.assign(enemy, { x: allyHall.x + 5, y: allyHall.y, order: { type: 'hold' } });
    refreshVisibility(s);
    expect(Math.hypot(hall(s, 0).x - enemy.x, hall(s, 0).y - enemy.y)).toBeGreaterThan(15);
    expect(isVisible(s, 2, enemy.x, enemy.y)).toBe(true);
    expect(isVisible(s, 0, enemy.x, enemy.y)).toBe(sharedVision);
    expect(issueCommand(s, 0, { type: 'attack', ids: [fighter.id], target: enemy.id })).toBe(sharedVision);
    expect(isVisible(s, 3, hall(s, 0).x, hall(s, 0).y)).toBe(false);
  });

  it('removes present sight when the last allied observer dies and retains exploration', () => {
    const s = arena(), observer = unit(s, 2, 'worker');
    Object.assign(observer, { x: 30.5, y: 30.5 });
    refreshVisibility(s);
    const cell = Math.floor(observer.y) * s.width + Math.floor(observer.x);
    expect(s.visible[0].has(cell)).toBe(true);
    expect(s.explored[0].has(cell)).toBe(true);
    observer.hp = 0;
    refreshVisibility(s);
    expect(s.visible[0].has(cell)).toBe(false);
    expect(s.explored[0].has(cell)).toBe(true);
    expect(s.visible[2].has(cell)).toBe(false);
  });
});

describe('team elimination and outcomes', () => {
  it('continues after one teammate loses its HQ and ends after the last hostile teammate is eliminated', () => {
    const s = arena();
    hall(s, 1).hp = 0;
    stepGame(s, .05);
    expect(s.eliminated).toEqual([false, true, false, false]);
    expect(s.winner).toBeNull();
    expect(s.winningTeam).toBeNull();
    expect(isGameOver(s)).toBe(false);
    const survivor = unit(s, 1);
    expect(issueCommand(s, 1, { type: 'move', ids: [survivor.id], x: survivor.x + 3, y: survivor.y })).toBe(false);
    expect(issueCommand(s, 3, { type: 'train', id: hall(s, 3).id, role: 'worker' })).toBe(true);
    hall(s, 3).hp = 0;
    stepGame(s, .05);
    expect(s.eliminated).toEqual([false, true, false, true]);
    expect(s.winningTeam).toBe(3);
    expect(s.winner).toBe(0);
    expect(s.draw).toBe(false);
    expect(isGameOver(s)).toBe(true);
  });

  it('uses the winning team ID when its representative player was eliminated earlier', () => {
    const s = arena();
    hall(s, 0).hp = 0;
    stepGame(s, .05);
    expect(isGameOver(s)).toBe(false);
    hall(s, 1).hp = 0;
    hall(s, 3).hp = 0;
    stepGame(s, .05);
    expect(s.winningTeam).toBe(3);
    expect(s.winner).toBe(0);
    expect(s.eliminated[0]).toBe(true);
    expect(s.eliminated[2]).toBe(false);
  });

  it('requires every completed HQ to be destroyed and does not count an unfinished replacement', () => {
    const s = arena(), original = hall(s, 1);
    const extra = add(s, 1, 'building', 'hq', 22, 22);
    original.hp = 0;
    stepGame(s, .05);
    expect(s.eliminated[1]).toBe(false);
    const unfinished = add(s, 1, 'building', 'hq', 28, 22);
    unfinished.progress = .5;
    extra.hp = 0;
    stepGame(s, .05);
    expect(s.eliminated[1]).toBe(true);
    expect(isGameOver(s)).toBe(false);
  });

  it.each([false, true])('draws simultaneous loss of all HQs with reversed entity order=%s', reverse => {
    const s = arena(8);
    for (const e of s.entities.filter(e => e.role === 'hq')) e.hp = 0;
    if (reverse) s.entities.reverse();
    stepGame(s, .05);
    expect(s.eliminated).toEqual(Array(8).fill(true));
    expect(s.draw).toBe(true);
    expect(s.winner).toBeNull();
    expect(s.winningTeam).toBeNull();
    expect(isGameOver(s)).toBe(true);
  });

  it('resolves simultaneous final HQ destruction through real attacks as a draw', () => {
    const s = arena();
    for (const side of sides(s)) {
      const target = hall(s, side);
      target.hp = 1;
      const attackerSide = (side % 2 === 0 ? side + 1 : side - 1) as Side;
      const attacker = add(s, attackerSide, 'unit', 'ranged', target.x - 4, target.y);
      expect(issueCommand(s, attackerSide, { type: 'attack', ids: [attacker.id], target: target.id })).toBe(true);
    }
    stepGame(s, .05);
    expect(s.events.filter(e => e.type === 'death' && s.entities.find(entity => entity.id === e.source)?.role === 'hq')).toHaveLength(4);
    expect(s.draw).toBe(true);
    expect(s.winningTeam).toBeNull();
    expect(s.winner).toBeNull();
  });

  it('keeps a three-team match running until only one team survives', () => {
    const c = config(6);
    c.players = c.players.map(p => ({ ...p, teamId: (p.id % 3) as Side }));
    const s = createMatch(c);
    hall(s, 1).hp = hall(s, 4).hp = 0;
    stepGame(s, .05);
    expect(s.eliminated).toEqual([false, true, false, false, true, false]);
    expect(isGameOver(s)).toBe(false);
    hall(s, 2).hp = hall(s, 5).hp = 0;
    stepGame(s, .05);
    expect(s.winningTeam).toBe(0);
    expect(s.winner).toBe(0);
    expect(s.draw).toBe(false);
  });

  it('keeps a one-player practice match running while its HQ survives', () => {
    const s = createMatch(config(1));
    advance(s, 100);
    expect(isGameOver(s)).toBe(false);
    expect(s.winner).toBeNull();
    expect(s.winningTeam).toBeNull();
    expect(s.draw).toBe(false);
    expect(s.time).toBe(100);
  });
});

describe('team AI and active economy', () => {
  it.each([4, 6, 8])('runs real gathering, construction and training for all %s players over 400 ticks', count => {
    const c = config(count);
    c.players = c.players.map(p => ({ ...p, controller: 'ai' }));
    const s = createMatch(c), deposited = Array(count).fill(0), trained = Array(count).fill(0), built = Array(count).fill(0);
    for (let tick = 0; tick < 400; tick++) {
      stepGame(s, .25);
      for (const event of s.events) {
        if (event.type === 'gather') deposited[event.side] += event.amount ?? 0;
        if (event.type === 'train') trained[event.side]++;
        if (event.type === 'build' && event.text === 'Construction complete') built[event.side]++;
        if (event.type === 'attack') {
          const target = s.entities.find(e => e.id === event.target);
          if (target) expect(isHostile(s, event.side, target.side)).toBe(true);
        }
      }
    }
    expect(s.tick).toBe(400);
    for (const side of sides(s)) {
      expect(deposited[side], `player ${side} did not deposit resources`).toBeGreaterThan(0);
      expect(trained[side], `player ${side} did not train units`).toBeGreaterThan(0);
      expect(built[side], `player ${side} did not complete construction`).toBeGreaterThan(0);
      expect(s.entities.some(e => e.side === side && e.role === 'barracks' && e.progress === 1)).toBe(true);
      expect(s.players[side].wood).toBeGreaterThanOrEqual(0);
      expect(s.players[side].ore).toBeGreaterThanOrEqual(0);
      expect(s.players[side].population).toBeLessThanOrEqual(s.players[side].cap);
    }
  }, 30_000);

  it.each(factions)('makes %s AI defend against a hostile instead of a nearer teammate', factionId => {
    const c = config();
    c.players[0].factionId = factionId;
    const s = createMatch(c);
    s.terrain.fill('grass');
    for (const e of s.entities) if (e.kind === 'unit') e.order = { type: 'hold' };
    const home = hall(s, 0), fighter = unit(s, 0), ally = unit(s, 2), hostile = unit(s, 1, 'worker');
    Object.assign(ally, { x: home.x + 4, y: home.y, cooldown: 100 });
    Object.assign(hostile, { x: home.x + 7, y: home.y, cooldown: 100 });
    refreshVisibility(s);
    runAI(s, 0);
    expect(fighter.order).toEqual({ type: 'attackMove', x: hostile.x, y: hostile.y });
    advance(s, 8, () => {
      for (const event of s.events.filter(e => e.type === 'attack' && e.side === 0)) {
        const target = s.entities.find(e => e.id === event.target);
        if (target) expect(isHostile(s, 0, target.side)).toBe(true);
      }
    });
    expect(hostile.hp).toBeLessThan(hostile.maxHp);
    expect(ally.hp).toBe(ally.maxHp);
  });

  it.each([8, 17])('stops buying housing once AI reaches its configured population limit of %s', populationCap => {
    const c = config(2);
    c.players[0] = { ...c.players[0], controller: 'ai', handicap: { populationCap } };
    const s = createMatch(c);
    let deposits = 0, recruits = 0;
    for (let tick = 0; tick < 1200; tick++) {
      stepGame(s, .25);
      for (const event of s.events.filter(e => e.side === 0)) {
        if (event.type === 'gather') deposits += event.amount ?? 0;
        if (event.type === 'train') recruits++;
      }
    }
    expect(s.tick).toBe(1200);
    expect(deposits).toBeGreaterThan(0);
    expect(recruits).toBeGreaterThan(0);
    expect(s.players[0].cap).toBe(populationCap);
    expect(s.players[0].population).toBeLessThanOrEqual(populationCap);
    expect(s.entities.filter(e => e.side === 0 && e.role === 'depot')).toHaveLength(populationCap <= 12 ? 0 : 1);
  }, 30_000);

  it('continues normal AI housing expansion with the default population limit', () => {
    const c = config(2);
    c.players[0].controller = 'ai';
    const s = createMatch(c);
    advance(s, 300);
    expect(s.tick).toBe(1200);
    expect(s.populationLimits[0]).toBe(100);
    expect(s.players[0].cap).toBeGreaterThan(22);
    expect(s.entities.filter(e => e.side === 0 && e.role === 'depot' && e.progress === 1).length).toBeGreaterThan(1);
  }, 30_000);

  it('applies starting resources and population limits to real paid training', () => {
    const c = config();
    c.players[0].handicap = { startingResources: { wood: 1234, ore: 765, crystal: 99 }, populationCap: 8 };
    const s = createMatch(c), hq = hall(s, 0);
    expect(s.players[0]).toMatchObject({ wood: 1234, ore: 765, crystal: 99, population: 6, cap: 8 });
    expect(s.populationLimits[0]).toBe(8);
    expect(issueCommand(s, 0, { type: 'train', id: hq.id, role: 'worker' })).toBe(true);
    expect(issueCommand(s, 0, { type: 'train', id: hq.id, role: 'worker' })).toBe(true);
    expect(issueCommand(s, 0, { type: 'train', id: hq.id, role: 'worker' })).toBe(false);
    advance(s, 30);
    expect(s.players[0].population).toBe(8);
    expect(s.players[0].cap).toBe(8);
    expect(s.players[0].wood).toBe(1134);
    expect(s.players[2].wood).toBe(420);
  });

  it('allows configured capacity above 100 and keeps teammate capacity independent', () => {
    const c = config();
    c.players[0].handicap = { populationCap: 17 };
    c.players[2].handicap = { populationCap: 500 };
    const s = createMatch(c);
    add(s, 0, 'building', 'depot', 20, 20);
    for (let i = 0; i < 11; i++) add(s, 2, 'building', 'depot', 20 + i * 3, 35);
    stepGame(s, .05);
    expect(s.players[0].cap).toBe(17);
    expect(s.players[2].cap).toBe(122);
    expect(s.players[1].cap).toBe(12);
  });

  it('preserves the starting roster under a low population limit and blocks further recruitment', () => {
    const c = config();
    c.players[0].handicap = { populationCap: 1 };
    const s = createMatch(c);
    expect(s.players[0].population).toBe(6);
    expect(s.players[0].cap).toBe(1);
    expect(issueCommand(s, 0, { type: 'train', id: hall(s, 0).id, role: 'worker' })).toBe(false);
    expect(issueCommand(s, 2, { type: 'train', id: hall(s, 2).id, role: 'worker' })).toBe(true);
  });

  it('multiplies delivered harvest income without changing worker extraction', () => {
    function harvest(incomeFactor: number) {
      const c = config();
      c.players[0].handicap = { incomeFactor };
      const s = createMatch(c), worker = unit(s, 0, 'worker');
      const node = s.resources.filter(r => r.kind === 'wood' && isVisible(s, 0, r.x, r.y))
        .sort((a, b) => Math.hypot(a.x - worker.x, a.y - worker.y) - Math.hypot(b.x - worker.x, b.y - worker.y))[0];
      expect(node).toBeDefined();
      const initial = { wood: s.players[0].wood, amount: node.amount };
      expect(issueCommand(s, 0, { type: 'gather', ids: [worker.id], target: node.id })).toBe(true);
      advance(s, 100);
      return { income: s.players[0].wood - initial.wood, extracted: initial.amount - node.amount, carried: worker.carried };
    }
    const ordinary = harvest(1), doubled = harvest(2), disabled = harvest(0);
    expect(ordinary.income).toBeGreaterThan(0);
    expect(doubled.income).toBeCloseTo(ordinary.income * 2, 6);
    expect(disabled.income).toBe(0);
    expect(doubled.extracted).toBeCloseTo(ordinary.extracted, 6);
    expect(disabled.extracted).toBeCloseTo(ordinary.extracted, 6);
    expect(doubled.carried).toBeCloseTo(ordinary.carried, 6);
  });

  it.each([1, 2, 3] as const)('starts every player at configured age %s with its unlocks active', startingAge => {
    const c = config(8, { rules: { startingAge } });
    c.players = c.players.map(p => ({ ...p, handicap: { startingResources: { wood: 1000, ore: 1000, crystal: 1000 } } }));
    const s = createMatch(c);
    for (const side of sides(s)) {
      expect(playerAge(s.players[side])).toBe(startingAge);
      expect(s.players[side].upgrades.includes('town-age')).toBe(startingAge >= 2);
      expect(s.players[side].upgrades.includes('citadel-age')).toBe(startingAge === 3);
      const barracks = add(s, side, 'building', 'barracks', 20 + side * 4, 30);
      expect(issueCommand(s, side, { type: 'train', id: barracks.id, role: 'cavalry' })).toBe(startingAge >= 2);
      expect(issueCommand(s, side, { type: 'train', id: barracks.id, role: 'siege' })).toBe(startingAge === 3);
    }
  });
});

describe('strict match configuration validation', () => {
  const invalid: [string, (c: MatchConfig) => void][] = [
    ['no players', c => { c.players = []; }],
    ['more than eight players', c => { c.players = Array.from({ length: 9 }, (_, id) => ({ ...c.players[0], id: id as Side })); }],
    ['duplicate player IDs', c => { c.players[1].id = c.players[0].id; }],
    ['out-of-range player ID', c => { c.players[0].id = 8 as Side; }],
    ['negative team ID', c => { c.players[0].teamId = -1 as Side; }],
    ['out-of-range team ID', c => { c.players[0].teamId = 8 as Side; }],
    ['unknown faction', c => { c.players[0].factionId = 'goblins' as FactionId; }],
    ['unknown controller', c => { (c.players[0] as unknown as Record<string, unknown>).controller = 'bot'; }],
    ['duplicate starting slots', c => { c.players[0].startingSlot = c.players[1].startingSlot = 0; }],
    ['out-of-range starting slot', c => { c.players[0].startingSlot = 4; }],
    ['negative resources', c => { c.players[0].handicap = { startingResources: { wood: -1, ore: 0, crystal: 0 } }; }],
    ['non-finite resources', c => { c.players[0].handicap = { startingResources: { wood: Infinity, ore: 0, crystal: 0 } }; }],
    ['incomplete resource cost', c => { c.players[0].handicap = { startingResources: { wood: 100 } as never }; }],
    ['negative income factor', c => { c.players[0].handicap = { incomeFactor: -1 }; }],
    ['non-finite income factor', c => { c.players[0].handicap = { incomeFactor: NaN }; }],
    ['excessive income factor', c => { c.players[0].handicap = { incomeFactor: 11 }; }],
    ['zero population limit', c => { c.players[0].handicap = { populationCap: 0 }; }],
    ['fractional population limit', c => { c.players[0].handicap = { populationCap: 8.5 }; }],
    ['excessive population limit', c => { c.players[0].handicap = { populationCap: 501 }; }],
    ['invalid starting age', c => { c.rules = { startingAge: 4 as never }; }],
    ['invalid shared vision flag', c => { c.rules = { sharedVision: 'yes' as never }; }],
    ['unknown map size', c => { c.map.size = 'endless' as MapSize; }],
    ['non-finite map seed', c => { c.map.seed = NaN; }],
    ['unknown root option', c => { (c as unknown as Record<string, unknown>).cheats = true; }],
    ['unsupported schema version', c => { c.schemaVersion = 2 as never; }],
    ['out-of-order player IDs', c => { [c.players[0], c.players[1]] = [c.players[1], c.players[0]]; }],
    ['fractional map seed', c => { c.map.seed = 1.5; }],
    ['unknown map option', c => { (c.map as unknown as Record<string, unknown>).cheats = true; }],
    ['unknown player option', c => { (c.players[0] as unknown as Record<string, unknown>).cheats = true; }],
    ['unknown rules option', c => { c.rules = { cheats: true } as never; }],
    ['unknown handicap option', c => { c.players[0].handicap = { cheats: true } as never; }],
    ['null schema version', c => { c.schemaVersion = null as never; }],
    ['null map size', c => { c.map.size = null as never; }],
    ['null starting slot', c => { c.players[0].startingSlot = null as never; }],
    ['null income factor', c => { c.players[0].handicap = { incomeFactor: null as never }; }],
    ['null population limit', c => { c.players[0].handicap = { populationCap: null as never }; }],
    ['null starting resources', c => { c.players[0].handicap = { startingResources: null as never }; }],
    ['null handicap', c => { c.players[0].handicap = null as never; }],
    ['null rules', c => { c.rules = null as never; }],
    ['null starting age', c => { c.rules = { startingAge: null as never }; }],
    ['null shared vision', c => { c.rules = { sharedVision: null as never }; }],
  ];
  it.each(invalid)('rejects %s', (_, mutate) => {
    const c = config();
    mutate(c);
    expect(() => createMatch(c)).toThrow();
  });
});
