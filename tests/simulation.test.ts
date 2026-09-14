import { afterEach, describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { canPlace, createGame, isVisible, issueCommand, refreshVisibility, runAI, stepGame } from '../src/core/simulation';
import type { BuildingRole, Entity, FactionId, GameState, Side, UnitRole } from '../src/core/types';

// Rule fixtures retain both real strongholds. The other player has no workers or
// money, so automatic AI cannot alter isolated production/economy experiments.
function fixture(faction: FactionId = 'orcs'): GameState {
  const s = createGame(faction); s.terrain.fill('grass');
  s.entities = s.entities.filter(e => e.kind === 'building');
  s.resources = [];
  s.players[1].wood = s.players[1].ore = 0;
  stepGame(s, .05);
  return s;
}
function add(s: GameState, side: Side, kind: Entity['kind'], role: UnitRole | BuildingRole, x: number, y: number): Entity {
  const faction = FACTIONS[s.players[side].faction];
  const def = kind === 'unit' ? faction.units[role as UnitRole] : faction.buildings[role as BuildingRole];
  const e: Entity = { id: s.nextId++, side, kind, role, x, y, hp: def.hp, maxHp: def.hp, order: { type: 'idle' }, cooldown: 0, progress: 1, queue: [], trainProgress: 0, researchProgress: 0, facing: 0, animation: 'idle', animTime: 0, momentum: 0, illusion: false, expires: 0, carried: 0, carriedKind: 'wood', path: [] };
  s.entities.push(e);
  refreshVisibility(s);
  return e;
}
function advance(s: GameState, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / .05); i++) stepGame(s, .05);
}
function hq(s: GameState, side: Side = 0) { return s.entities.find(e => e.side === side && e.role === 'hq')!; }
const compass = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2], [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]] as const;
function displacementFacing(dx: number, dy: number) {
  const scores = compass.map(([x, y]) => dx * x + dy * y);
  return scores.indexOf(Math.max(...scores));
}
const originalContent = structuredClone(FACTIONS);
afterEach(() => { Object.assign(FACTIONS, structuredClone(originalContent)); });

describe('ownership and command validation', () => {
  it('cannot move another player\'s units or spend from their buildings', () => {
    const s = createGame('orcs');
    const enemy = s.entities.find(e => e.side === 1 && e.kind === 'unit')!;
    const before = structuredClone(s.players);
    expect(issueCommand(s, 0, { type: 'move', ids: [enemy.id], x: 20, y: 20 })).toBe(false);
    expect(enemy.order).toEqual({ type: 'idle' });
    expect(issueCommand(s, 0, { type: 'train', id: hq(s, 1).id, role: 'worker' })).toBe(false);
    expect(s.players).toEqual(before);
  });
  it('rejects hidden targets, friendly attacks, and non-finite movement', () => {
    const s = createGame('orcs');
    const worker = s.entities.find(e => e.side === 0 && e.role === 'worker')!;
    expect(isVisible(s, 0, hq(s, 1).x, hq(s, 1).y)).toBe(false);
    expect(issueCommand(s, 0, { type: 'attack', ids: [worker.id], target: hq(s, 1).id })).toBe(false);
    expect(issueCommand(s, 0, { type: 'attack', ids: [worker.id], target: hq(s).id })).toBe(false);
    expect(issueCommand(s, 0, { type: 'move', ids: [worker.id], x: NaN, y: 3 })).toBe(false);
    expect(issueCommand(s, 0, { type: 'move', ids: [worker.id], x: 3, y: Infinity })).toBe(false);
  });
  it('reserves resources once and rejects unaffordable repeated recruitment', () => {
    const s = fixture(); s.players[0].wood = 50; s.players[0].ore = 0;
    expect(issueCommand(s, 0, { type: 'train', id: hq(s).id, role: 'worker' })).toBe(true);
    for (let i = 0; i < 20; i++) expect(issueCommand(s, 0, { type: 'train', id: hq(s).id, role: 'worker' })).toBe(false);
    expect(s.players[0].wood).toBe(0);
    expect(hq(s).queue).toEqual(['worker']);
  });
  it('reserves queued population across buildings and enforces production roles', () => {
    const s = fixture(); const barracks = add(s, 0, 'building', 'barracks', 14, 10);
    for (let i = 0; i < 11; i++) add(s, 0, 'unit', 'worker', 3 + i * .7, 15);
    stepGame(s, .05); s.players[0].wood = s.players[0].ore = 2000;
    expect(issueCommand(s, 0, { type: 'train', id: hq(s).id, role: 'melee' })).toBe(false);
    expect(issueCommand(s, 0, { type: 'train', id: barracks.id, role: 'worker' })).toBe(false);
    expect(issueCommand(s, 0, { type: 'train', id: hq(s).id, role: 'worker' })).toBe(true);
    expect(issueCommand(s, 0, { type: 'train', id: barracks.id, role: 'melee' })).toBe(false);
  });
});

describe('economy and settlement', () => {
  it.each(['wood', 'ore'] as const)('harvests finite %s, then deposits it only after returning', kind => {
    const s = fixture(); const worker = add(s, 0, 'unit', 'worker', 13, 10);
    const node = { id: s.nextId++, x: 14, y: 10, kind, amount: 8, maxAmount: 8 }; s.resources.push(node);
    refreshVisibility(s); const before = s.players[0][kind];
    expect(issueCommand(s, 0, { type: 'gather', ids: [worker.id], target: node.id })).toBe(true);
    advance(s, 1);
    expect(worker.carried).toBeGreaterThan(0); expect(s.players[0][kind]).toBe(before);
    advance(s, 25);
    expect(node.amount).toBe(0); expect(worker.carried).toBe(0);
    expect(s.players[0][kind]).toBeCloseTo(before + 8, 6);
    advance(s, 10); expect(s.players[0][kind]).toBeCloseTo(before + 8, 6);
  });
  it('charges construction once, needs a nearby worker, and adds capacity on completion', () => {
    const s = fixture(); const worker = add(s, 0, 'unit', 'worker', 10, 12);
    const before = s.players[0].wood;
    expect(canPlace(s, 0, 'depot', 12, 12)).toBe(true);
    expect(issueCommand(s, 0, { type: 'build', ids: [worker.id], role: 'depot', x: 12, y: 12 })).toBe(true);
    const depot = s.entities.find(e => e.side === 0 && e.role === 'depot')!;
    expect(depot.progress).toBe(0); expect(s.players[0].wood).toBe(before - 100);
    issueCommand(s, 0, { type: 'stop', ids: [worker.id] }); advance(s, 5);
    expect(depot.progress).toBe(0); expect(s.players[0].cap).toBe(12);
    expect(issueCommand(s, 0, { type: 'repair', ids: [worker.id], target: depot.id })).toBe(true);
    advance(s, 30);
    expect(depot.progress).toBe(1); expect(s.players[0].cap).toBe(22);
    expect(s.players[0].wood).toBeCloseTo(before - 100, 6);
  });
  it('does not allow overlapping, hidden, out-of-bounds or resource-covered buildings', () => {
    const s = fixture();
    expect(canPlace(s, 0, 'depot', 8, 8)).toBe(false);
    expect(canPlace(s, 0, 'depot', 30, 30)).toBe(false);
    expect(canPlace(s, 0, 'depot', 0, 0)).toBe(false);
    s.resources.push({ id: s.nextId++, x: 12, y: 12, kind: 'wood', amount: 30, maxAmount: 30 });
    expect(canPlace(s, 0, 'depot', 12, 12)).toBe(false);
  });
  it('recruits after the full training time without charging a second time', () => {
    const s = fixture(); const before = s.players[0].wood;
    expect(issueCommand(s, 0, { type: 'train', id: hq(s).id, role: 'worker' })).toBe(true);
    advance(s, 6); expect(s.entities.filter(e => e.side === 0 && e.kind === 'unit')).toHaveLength(0);
    advance(s, 7); const recruited = s.entities.filter(e => e.side === 0 && e.kind === 'unit');
    expect(recruited).toHaveLength(1); expect(recruited[0].role).toBe('worker');
    expect(s.players[0].wood).toBe(before - 50); expect(hq(s).queue).toHaveLength(0);
  });
  it('pauses a paid recruitment queue after capacity loss and resumes when capacity returns', () => {
    const s = fixture(); const depot = add(s, 0, 'building', 'depot', 14, 8);
    for (let i = 0; i < 12; i++) add(s, 0, 'unit', 'worker', 3 + i * .7, 15);
    stepGame(s, .05); const before = s.players[0].wood;
    expect(issueCommand(s, 0, { type: 'train', id: hq(s).id, role: 'worker' })).toBe(true);
    depot.hp = 0; stepGame(s, .05); advance(s, 20);
    expect(s.players[0].population).toBe(12); expect(s.players[0].cap).toBe(12);
    expect(hq(s).queue).toEqual(['worker']); expect(s.players[0].wood).toBe(before - 50);
    add(s, 0, 'building', 'depot', 14, 8); advance(s, 13);
    expect(s.players[0].population).toBe(13); expect(hq(s).queue).toHaveLength(0);
    expect(s.players[0].wood).toBe(before - 50);
  });
  it('repairs damage while paying for available work and never overspends', () => {
    const s = fixture(); const worker = add(s, 0, 'unit', 'worker', 10, 8); const hall = hq(s);
    hall.hp -= 100; s.players[0].wood = 2;
    expect(issueCommand(s, 0, { type: 'repair', ids: [worker.id], target: hall.id })).toBe(true);
    advance(s, 5); expect(hall.hp).toBeCloseTo(hall.maxHp - 80, 5); expect(s.players[0].wood).toBeCloseTo(0, 7);
    expect(s.players[0].wood).toBeGreaterThanOrEqual(0);
  });
});

describe('vision, movement and combat', () => {
  it.each(compass.map(([dx, dy], facing) => ({ dx, dy, facing })))('faces actual direct-approach displacement in octant $facing', ({ dx, dy, facing }) => {
    const s = fixture(); const walker = add(s, 0, 'unit', 'worker', 20.5, 20.5);
    walker.facing = (facing + 4) % 8;
    expect(issueCommand(s, 0, { type: 'move', ids: [walker.id], x: walker.x + dx, y: walker.y + dy })).toBe(true);
    const before = { x: walker.x, y: walker.y }; stepGame(s, .05);
    const movedX = walker.x - before.x, movedY = walker.y - before.y;
    expect(Math.hypot(movedX, movedY)).toBeGreaterThan(0);
    expect(walker.facing).toBe(displacementFacing(movedX, movedY));
    expect(walker.facing).toBe(facing);
  });
  it.each(compass.map(([dx, dy], facing) => ({ dx, dy, facing })))('keeps facing actual displacement while traversing a route in octant $facing', ({ dx, dy, facing }) => {
    const s = fixture(); const walker = add(s, 0, 'unit', 'worker', 20.5, 20.5);
    walker.facing = (facing + 4) % 8;
    const destination = { x: 20.5 + dx * 7, y: 20.5 + dy * 7 };
    expect(issueCommand(s, 0, { type: 'move', ids: [walker.id], ...destination })).toBe(true);
    let routedSteps = 0;
    for (let i = 0; i < 60; i++) {
      const before = { x: walker.x, y: walker.y }; const waypoint = walker.path[0] && { ...walker.path[0] };
      stepGame(s, .25);
      const movedX = walker.x - before.x, movedY = walker.y - before.y;
      if (Math.hypot(movedX, movedY) > 1e-8) {
        expect(walker.facing).toBe(displacementFacing(movedX, movedY));
        if (waypoint) routedSteps++;
      }
    }
    expect(routedSteps).toBeGreaterThan(0);
    expect(Math.hypot(walker.x - destination.x, walker.y - destination.y)).toBeLessThan(.6);
  });
  it.each([
    { label: 'horizontal', obstacleX: .725, obstacleY: .305, facing: 0 },
    { label: 'vertical', obstacleX: .68, obstacleY: .3, facing: 2 },
  ])('faces the actual $label slide when a cached diagonal route becomes obstructed', ({ obstacleX, obstacleY, facing }) => {
    const s = fixture(); const walker = add(s, 0, 'unit', 'worker', 20.5, 20.5);
    issueCommand(s, 0, { type: 'move', ids: [walker.id], x: 25.5, y: 25.5 }); stepGame(s, .05);
    // Introduce a collision fixture after the route is cached. The diagonal
    // endpoint is blocked, but one axis remains free; no route is injected.
    s.resources.push({ id: s.nextId++, kind: 'ore', x: walker.x + obstacleX, y: walker.y + obstacleY, amount: 100, maxAmount: 100 });
    const before = { x: walker.x, y: walker.y }; stepGame(s, .05);
    const movedX = walker.x - before.x, movedY = walker.y - before.y;
    expect(Math.hypot(movedX, movedY)).toBeGreaterThan(0);
    expect(facing === 0 ? movedY : movedX).toBe(0);
    expect(walker.facing).toBe(displacementFacing(movedX, movedY));
    expect(walker.facing).toBe(facing);
  });
  it.each([
    ['east', 4, 0, 0], ['southeast', 4, 4, 1], ['south', 0, 4, 2], ['southwest', -4, 4, 3],
    ['west', -4, 0, 4], ['northwest', -4, -4, 5], ['north', 0, -4, 6], ['northeast', 4, -4, 7],
  ] as const)('faces a stationary target to the %s when attacking without moving', (_name, dx, dy, facing) => {
    const s = fixture(); const attacker = add(s, 0, 'unit', 'ranged', 20, 20);
    const target = add(s, 1, 'building', 'depot', 20 + dx, 20 + dy);
    attacker.facing = (facing + 4) % 8;
    expect(issueCommand(s, 0, { type: 'attack', ids: [attacker.id], target: target.id })).toBe(true);
    stepGame(s, .05);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(attacker.x).toBe(20); expect(attacker.y).toBe(20);
    expect(attacker.facing).toBe(facing);
  });
  it('retains explored terrain while removing current sight after a scout leaves', () => {
    const s = fixture(); const scout = add(s, 0, 'unit', 'melee', 22, 22);
    expect(isVisible(s, 0, 23, 23)).toBe(true);
    const key = 23 * s.width + 23; expect(s.explored[0].has(key)).toBe(true);
    scout.x = 8; scout.y = 12; refreshVisibility(s);
    expect(isVisible(s, 0, 23, 23)).toBe(false); expect(s.explored[0].has(key)).toBe(true);
  });
  it('walks around a building without crossing its footprint', () => {
    const s = fixture(); const walker = add(s, 0, 'unit', 'worker', 17.5, 20.5);
    const building = add(s, 0, 'building', 'barracks', 21.5, 20.5);
    expect(issueCommand(s, 0, { type: 'move', ids: [walker.id], x: 25.5, y: 20.5 })).toBe(true);
    for (let i = 0; i < 400; i++) {
      stepGame(s, .05);
      expect(Math.abs(walker.x - building.x) >= 1.5 || Math.abs(walker.y - building.y) >= 1.5).toBe(true);
    }
    expect(Math.hypot(walker.x - 25.5, walker.y - 20.5)).toBeLessThan(.8);
  });
  it('routes around ore when clear grid endpoints have an obstructed connecting edge', () => {
    const s = fixture(); const walker = add(s, 0, 'unit', 'worker', 27.5, 22.5);
    const ore = { id: s.nextId++, x: 27, y: 22, kind: 'ore' as const, amount: 100, maxAmount: 100 };
    s.resources.push(ore);
    expect(issueCommand(s, 0, { type: 'move', ids: [walker.id], x: 27.5, y: 18.5 })).toBe(true);
    // The direct vertical edge passes within .5 of the ore, although both
    // half-cell endpoints are outside its .7 collision radius. Check every
    // traveled segment, so arriving by cutting through the ore cannot pass.
    for (let i = 0; i < 300; i++) {
      const previous = { x: walker.x, y: walker.y };
      stepGame(s, .05);
      const dx = walker.x - previous.x, dy = walker.y - previous.y;
      const squaredLength = dx * dx + dy * dy;
      const t = squaredLength === 0 ? 0 : Math.max(0, Math.min(1, ((ore.x - previous.x) * dx + (ore.y - previous.y) * dy) / squaredLength));
      const separation = Math.hypot(previous.x + t * dx - ore.x, previous.y + t * dy - ore.y);
      expect(separation).toBeGreaterThanOrEqual(.7 - 1e-6);
    }
    expect(Math.hypot(walker.x - 27.5, walker.y - 18.5)).toBeLessThan(.8);
  });
  it('escapes an off-center position whose direct grid-center connector clips a resource', () => {
    const s = fixture(); const walker = add(s, 0, 'unit', 'melee', 30.63155634063932, 29.404596376336357);
    for (const [x, y] of [[31, 30], [30, 29]]) s.resources.push({ id: s.nextId++, x, y, kind: 'wood', amount: 100, maxAmount: 100 });
    expect(issueCommand(s, 0, { type: 'move', ids: [walker.id], x: 36, y: 34 })).toBe(true);
    let arrived = false;
    for (let i = 0; i < 300; i++) {
      const before = { x: walker.x, y: walker.y }; stepGame(s, .05);
      const dx = walker.x - before.x, dy = walker.y - before.y, squaredLength = dx * dx + dy * dy;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(FACTIONS.orcs.units.melee.speed * .05 + 1e-8);
      for (const node of s.resources) {
        const t = squaredLength === 0 ? 0 : Math.max(0, Math.min(1, ((node.x - before.x) * dx + (node.y - before.y) * dy) / squaredLength));
        expect(Math.hypot(before.x + dx * t - node.x, before.y + dy * t - node.y)).toBeGreaterThanOrEqual(.7 - 1e-8);
      }
      if (Math.hypot(walker.x - 36, walker.y - 34) < .6) { arrived = true; break; }
    }
    expect(arrived).toBe(true);
  });
  it('closes the remaining distance before attacking a stationary unit just outside weapon range', () => {
    // Keep the target stationary so its own approach cannot mask the attacker stall.
    FACTIONS.orcs.units.melee.speed = 0;
    const s = fixture('fairies'); const attacker = add(s, 0, 'unit', 'ranged', 20, 20);
    const target = add(s, 1, 'unit', 'melee', 27.18, 20);
    expect(issueCommand(s, 0, { type: 'attack', ids: [attacker.id], target: target.id })).toBe(true);
    advance(s, 1);
    expect(target.x).toBe(27.18); expect(target.y).toBe(20);
    expect(attacker.x).toBeGreaterThan(20); expect(target.hp).toBeLessThan(target.maxHp);
  });
  it('damages enemies, removes dead combatants, and awards a win only on HQ destruction', () => {
    const s = fixture(); const attacker = add(s, 0, 'unit', 'special', 21, 20);
    const defender = add(s, 1, 'unit', 'worker', 22, 20); defender.hp = 1;
    expect(issueCommand(s, 0, { type: 'attack', ids: [attacker.id], target: defender.id })).toBe(true);
    stepGame(s, .05); expect(defender.hp).toBe(0); expect(s.winner).toBeNull();
    advance(s, 2); expect(s.entities.some(e => e.id === defender.id)).toBe(false);
    const enemyHQ = hq(s, 1); enemyHQ.x = 23; enemyHQ.y = 20; enemyHQ.hp = 1; refreshVisibility(s);
    expect(issueCommand(s, 0, { type: 'attack', ids: [attacker.id], target: enemyHQ.id })).toBe(true);
    advance(s, 5); expect(s.winner).toBe(0); expect(enemyHQ.hp).toBe(0);
    expect(issueCommand(s, 0, { type: 'move', ids: [attacker.id], x: 2, y: 2 })).toBe(false);
  });
  it('accumulates momentum through fighting and loses it outside combat', () => {
    const s = fixture(); const fighter = add(s, 0, 'unit', 'melee', 20, 20);
    add(s, 1, 'building', 'depot', 22, 20);
    advance(s, 4); expect(fighter.momentum).toBeGreaterThan(.2);
    const fury = fighter.momentum;
    issueCommand(s, 0, { type: 'move', ids: [fighter.id], x: 10, y: 15 }); advance(s, 8);
    expect(fighter.momentum).toBeLessThan(fury);
  });
  it('turns a War Cry momentum boost into greater actual attack damage and enforces its cooldown', () => {
    const attackOnce = (warCry: boolean) => {
      const s = fixture(); const fighter = add(s, 0, 'unit', 'melee', 20, 20);
      const target = add(s, 1, 'building', 'depot', 22, 20);
      if (warCry) {
        expect(issueCommand(s, 0, { type: 'ability', ids: [fighter.id] })).toBe(true);
        expect(issueCommand(s, 0, { type: 'ability', ids: [fighter.id] })).toBe(false);
      }
      expect(issueCommand(s, 0, { type: 'attack', ids: [fighter.id], target: target.id })).toBe(true);
      stepGame(s, .05); return target.maxHp - target.hp;
    };
    const ordinaryDamage = attackOnce(false), boostedDamage = attackOnce(true);
    expect(ordinaryDamage).toBeGreaterThan(0); expect(boostedDamage).toBeGreaterThan(ordinaryDamage);
  });
  it('conjures temporary doubles with a cooldown and without consuming population', () => {
    const s = fixture('fairies'); const caster = add(s, 0, 'unit', 'special', 12, 12);
    stepGame(s, .05); const population = s.players[0].population;
    expect(issueCommand(s, 0, { type: 'ability', ids: [caster.id] })).toBe(true);
    expect(s.entities.filter(e => e.illusion)).toHaveLength(2);
    expect(issueCommand(s, 0, { type: 'ability', ids: [caster.id] })).toBe(false);
    stepGame(s, .05); expect(s.players[0].population).toBe(population);
    advance(s, 20); expect(s.entities.filter(e => e.illusion && e.hp > 0)).toHaveLength(0);
    advance(s, 16); expect(issueCommand(s, 0, { type: 'ability', ids: [caster.id] })).toBe(true);
  });
  it('heals only nearby allies at a completed healing grove', () => {
    const s = fixture('fairies'); add(s, 0, 'building', 'depot', 15, 15);
    const ally = add(s, 0, 'unit', 'worker', 17, 15); ally.hp -= 30;
    const distant = add(s, 0, 'unit', 'worker', 26, 15); distant.hp -= 30;
    advance(s, 4); expect(ally.hp).toBeGreaterThan(ally.maxHp - 30); expect(distant.hp).toBe(distant.maxHp - 30);
    advance(s, 20); expect(ally.hp).toBe(ally.maxHp);
  });
  it('does not heal from unfinished groves or restore an enemy unit', () => {
    const s = fixture('fairies'); const grove = add(s, 0, 'building', 'depot', 15, 15); grove.progress = .5;
    const ally = add(s, 0, 'unit', 'worker', 17, 15); ally.hp -= 30;
    const enemy = add(s, 1, 'unit', 'worker', 15, 17); enemy.hp -= 30;
    advance(s, 4); expect(ally.hp).toBe(ally.maxHp - 30); expect(enemy.hp).toBe(enemy.maxHp - 30);
    grove.progress = 1; advance(s, 4);
    expect(ally.hp).toBeCloseTo(ally.maxHp - 20, 6); expect(enemy.hp).toBe(enemy.maxHp - 30);
  });
});

describe('AI fairness and editable content', () => {
  it.each([0, 1] as const)('keeps side %s replacement recruits together after its initial scout dies, while allowing defense and army waves', side => {
    const s = fixture(); s.players[0].wood = s.players[0].ore = 0;
    advance(s, 66);
    const home = hq(s, side), direction = side === 0 ? 1 : -1;
    const scout = add(s, side, 'unit', 'melee', home.x + direction * 3, home.y + direction * 3);
    const barracks = add(s, side, 'building', 'barracks', home.x + direction * 5, home.y);
    runAI(s, side); expect(scout.order.type).toBe('attackMove');
    // Isolate the scout casualty, then replace it through paid recruitment.
    scout.hp = 0;
    const faction = FACTIONS[s.players[side].faction], def = faction.units.melee;
    s.players[side].wood = def.cost.wood; s.players[side].ore = def.cost.ore;
    expect(issueCommand(s, side, { type: 'train', id: barracks.id, role: 'melee' })).toBe(true);
    advance(s, def.trainTime + 1); runAI(s, side);
    const replacement = s.entities.find(e => e.side === side && e.kind === 'unit' && e.hp > 0)!;
    expect(replacement).toBeDefined(); expect(replacement.id).not.toBe(scout.id);
    expect(replacement.order).toEqual({ type: 'idle' });
    expect(s.players[side].wood).toBe(0); expect(s.players[side].ore).toBe(0);
    // An immediate visible threat may still pull this small force into defense.
    const intruder = add(s, side === 0 ? 1 : 0, 'unit', 'worker', home.x, home.y + direction * 5);
    runAI(s, side); expect(replacement.order.type).toBe('attackMove');
    s.entities = s.entities.filter(e => e.id !== intruder.id);
    issueCommand(s, side, { type: 'stop', ids: [replacement.id] }); runAI(s, side);
    expect(replacement.order).toEqual({ type: 'idle' });
    // Once the configured force is assembled, ordinary attack waves still run.
    for (let i = 1; i < faction.ai.armySize; i++) add(s, side, 'unit', 'melee', home.x + direction * 3, home.y + direction * (2 + i * .7));
    runAI(s, side);
    const army = s.entities.filter(e => e.side === side && e.kind === 'unit' && e.hp > 0);
    expect(army).toHaveLength(faction.ai.armySize);
    expect(army.every(e => e.order.type === 'attackMove')).toBe(true);
  });
  it.each(['orcs', 'fairies'] as const)('resumes AI construction after builder loss when the player chooses %s', faction => {
    const s = createGame(faction); s.terrain.fill('grass');
    runAI(s, 1);
    const barracks = s.entities.find(e => e.side === 1 && e.role === 'barracks')!;
    expect(barracks).toBeDefined(); expect(barracks.progress).toBeLessThan(1);
    const builder = s.entities.find(e => e.side === 1 && e.order.type === 'build' && e.order.target === barracks.id)!;
    expect(builder).toBeDefined();
    // The fixture removes the lost builder; the AI must choose a survivor and
    // finish the already-paid foundation through normal construction rules.
    s.entities = s.entities.filter(e => e.id !== builder.id);
    runAI(s, 1);
    expect(s.entities.some(e => e.side === 1 && e.hp > 0 && e.order.type === 'build' && e.order.target === barracks.id)).toBe(true);
    advance(s, 80);
    expect(barracks.progress).toBe(1); expect(barracks.hp).toBeGreaterThan(0);
    expect(s.entities.filter(e => e.side === 1 && e.role === 'barracks')).toHaveLength(1);
  });
  it('cannot conjure resources or construction when its economy is empty', () => {
    const s = createGame('orcs'); s.resources = []; s.players[1].wood = s.players[1].ore = 0;
    const before = s.entities.filter(e => e.side === 1).length;
    advance(s, 120);
    expect(s.players[1].wood).toBe(0); expect(s.players[1].ore).toBe(0);
    expect(s.entities.filter(e => e.side === 1)).toHaveLength(before);
    expect(s.entities.filter(e => e.side === 1).every(e => e.queue.length === 0)).toBe(true);
  });
  it('ignores unseen enemy positions when choosing orders', () => {
    const a = createGame('orcs'), b = createGame('orcs');
    for (const e of b.entities.filter(e => e.side === 0)) { e.x = 2; e.y = 3; }
    refreshVisibility(b); runAI(a, 1); runAI(b, 1);
    expect(a.entities.filter(e => e.side === 1).map(e => e.order)).toEqual(b.entities.filter(e => e.side === 1).map(e => e.order));
    expect(a.players[1]).toEqual(b.players[1]);
  });
  it('does not send AI workers to resource nodes outside their current vision', () => {
    const s = createGame('orcs');
    s.resources = s.resources.filter(r => !isVisible(s, 1, r.x, r.y));
    expect(s.resources.length).toBeGreaterThan(0);
    runAI(s, 1);
    expect(s.entities.filter(e => e.side === 1 && e.role === 'worker').some(e => e.order.type === 'gather')).toBe(false);
  });
  it('applies roster stats and reassigned abilities from content without core changes', () => {
    FACTIONS.orcs.units.worker.hp = 133; FACTIONS.orcs.units.worker.cost.wood = 7;
    FACTIONS.orcs.units.worker.trainTime = .5; FACTIONS.orcs.units.worker.ability = 'illusion';
    const s = fixture(); const before = s.players[0].wood;
    expect(issueCommand(s, 0, { type: 'train', id: hq(s).id, role: 'worker' })).toBe(true);
    advance(s, 1); const worker = s.entities.find(e => e.side === 0 && e.role === 'worker')!;
    expect(worker.hp).toBe(133); expect(s.players[0].wood).toBe(before - 7);
    expect(issueCommand(s, 0, { type: 'ability', ids: [worker.id] })).toBe(true);
    expect(s.entities.filter(e => e.illusion && e.role === 'worker')).toHaveLength(2);
  });
});


describe('hold position', () => {
  it('does not pursue a visible enemy, attacks within range, and releases on a move order', () => {
    const s = fixture('fairies');
    const guard = add(s, 0, 'unit', 'melee', 20, 20);
    const target = add(s, 1, 'unit', 'worker', 24, 20);
    issueCommand(s, 1, {type: 'hold', ids: [target.id]});
    expect(issueCommand(s, 0, {type: 'hold', ids: [guard.id]})).toBe(true);
    advance(s, 2);
    expect(guard.x).toBe(20); expect(guard.y).toBe(20);
    expect(target.hp).toBe(target.maxHp);
    target.x = 21.4; refreshVisibility(s);
    advance(s, .1);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(guard.x).toBe(20); expect(guard.y).toBe(20);
    issueCommand(s, 0, {type: 'move', ids: [guard.id], x: 17, y: 20});
    advance(s, 1);
    expect(guard.x).toBeLessThan(19);
  });
  it('lets ranged units fire while melee holds and keeps automatic doubles defensive', () => {
    const s = fixture('fairies');
    const guard = add(s, 0, 'unit', 'melee', 20, 20);
    const archer = add(s, 0, 'unit', 'ranged', 19, 22);
    const caster = add(s, 0, 'unit', 'special', 19, 19);
    const target = add(s, 1, 'unit', 'melee', 23, 20);
    issueCommand(s, 1, {type: 'hold', ids: [target.id]});
    issueCommand(s, 0, {type: 'hold', ids: [guard.id, archer.id, caster.id]});
    advance(s, .1);
    expect(guard.x).toBe(20); expect(guard.y).toBe(20);
    expect(target.hp).toBeLessThan(target.maxHp);
    const doubles = s.entities.filter(e => e.illusion);
    expect(doubles).toHaveLength(2);
    expect(doubles.every(e => e.order.type === 'hold')).toBe(true);
    expect(archer.x).toBe(19); expect(caster.x).toBe(19);
    issueCommand(s, 0, {type: 'stop', ids: [guard.id]});
    advance(s, .5);
    expect(guard.x).toBeGreaterThan(20);
  });
});


it('a holding unit ignores an out-of-range preferred unit and fires at a reachable building', () => {
  const s = fixture('fairies');
  const caster = add(s, 0, 'unit', 'special', 20, 20);
  const building = add(s, 1, 'building', 'depot', 26, 20);
  const decoy = add(s, 1, 'unit', 'worker', 20, 25.1);
  issueCommand(s, 1, {type: 'hold', ids: [decoy.id]});
  issueCommand(s, 0, {type: 'hold', ids: [caster.id]});
  stepGame(s, .05);
  expect(building.hp).toBeLessThan(building.maxHp);
  expect(decoy.hp).toBe(decoy.maxHp);
  expect(caster.x).toBe(20); expect(caster.y).toBe(20);
});
