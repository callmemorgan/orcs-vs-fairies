import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { contentHash, createContentBundle, unitFor } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { validateCommand } from '../src/core/commands';
import { terrainAt } from '../src/core/maps';
import { route, walkable } from '../src/core/navigation';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { canPlace, createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { createArtifact, observedArtifacts } from '../src/core/unit-progression';
import type { BuiltinFactionId, Command, Entity, GameState, Side, UnitDef, UnitRole } from '../src/core/types';
import type { PromotionId } from '../src/core/specialist-types';

const factions: BuiltinFactionId[] = ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata'];
const funds = { wood: 10000, ore: 10000, crystal: 10000 };
function match(faction: BuiltinFactionId = 'orcs', teams: Side[] = [0, 1], sharedVision = true): GameState {
  const s = createMatch({ map: { seed: 4127, size: 'small' }, rules: { startingAge: 3, sharedVision }, players: teams.map((teamId, id) => ({ id: id as Side, teamId, factionId: id === 0 ? faction : 'orcs', controller: 'external', handicap: { startingResources: funds } })) });
  s.terrain.fill('grass'); s.resources = [];
  for (const e of s.entities) {
    const hq = e.role === 'hq';
    e.x = e.side === 0 ? 6.5 + (hq ? 0 : (e.id % 5) - 2) : s.width - 6.5 + (hq ? 0 : (e.id % 5) - 2);
    e.y = e.side === 0 ? 6.5 + (hq ? 0 : 4) : s.height - 6.5 + (hq ? 0 : -4);
    e.order = { type: 'hold' };
  }
  refreshVisibility(s); return s;
}
function command(s: GameState, side: Side, c: Command): boolean {
  expect(validateCommand(c)).toBe(true); return issueCommand(s, side, c);
}
function advance(s: GameState, seconds: number, dt = .25): void {
  const until = s.time + seconds;
  while (s.time + 1e-8 < until) { const before = s.time; stepGame(s, Math.min(dt, until - s.time)); if (s.time === before) throw new Error('Match stopped before the expected time'); }
}
function until(s: GameState, predicate: () => boolean, seconds = 120): void {
  const deadline = s.time + seconds;
  while (!predicate() && s.time < deadline) stepGame(s, .25);
  expect(predicate(), `Condition was not reached by ${deadline}s`).toBe(true);
}
function actor(s: GameState, side: Side, role: UnitRole, x: number, y: number, definitionId = FACTIONS[s.players[side].faction].units[role].id): Entity {
  const e = spawnDefinition(s, side, 'unit', definitionId, x, y); e.order = { type: 'hold' }; return e;
}
function arena(s: GameState) { return { x: Math.floor(s.width / 2) + .5, y: Math.floor(s.height / 2) + .5 }; }
function building(s: GameState, side: Side, definitionId: string, x: number, y: number): Entity {
  return spawnDefinition(s, side, 'building', definitionId, x, y);
}
function barracks(s: GameState): Entity {
  const worker = s.entities.find(e => e.side === 0 && e.role === 'worker')!;
  const hq = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
  for (let y = 3.5; y < 16; y++) for (let x = 3.5; x < 16; x++) if (canPlace(s, 0, 'barracks', x, y)) {
    expect(command(s, 0, { type: 'build', ids: [worker.id], role: 'barracks', x, y })).toBe(true);
    const hall = s.entities.find(e => e.side === 0 && e.role === 'barracks')!;
    until(s, () => hall.progress === 1, 75); expect(Math.hypot(hall.x - hq.x, hall.y - hq.y)).toBeLessThan(14); return hall;
  }
  throw new Error('No barracks site');
}
function recruit(s: GameState, hall: Entity, role: UnitRole, definitionId: string): Entity {
  const before = new Set(s.entities.map(e => e.id));
  expect(command(s, 0, { type: 'train', id: hall.id, role, definitionId })).toBe(true);
  until(s, () => s.entities.some(e => !before.has(e.id) && e.definitionId === definitionId), 90);
  return s.entities.find(e => !before.has(e.id) && e.definitionId === definitionId)!;
}
function siegeFixture(faction: BuiltinFactionId) {
  const s = match(faction), p = arena(s), gun = actor(s, 0, 'siege', p.x - 8, p.y), target = actor(s, 1, 'special', p.x, p.y, 'core:orcs-engineer');
  refreshVisibility(s); return { s, gun, target, p };
}
function customMatch(definitions: UnitDef[]): GameState {
  const original = JSON.parse(JSON.stringify(exampleMod()));
  for (const definition of definitions) {
    original.factions[0].units.push(definition); original.art[definition.id] = { ...original.art['lantern:sentinel'], path: `/mods/lantern/${definition.id.slice(8)}.svg` };
  }
  const { hash: _hash, ...body } = original; original.hash = contentHash(body);
  const s = createMatch({ content: createContentBundle([original]), map: { seed: 4127, size: 'small' }, rules: { startingAge: 3 }, players: [{ id: 0, teamId: 0, factionId: 'lantern:keepers', controller: 'external', handicap: { startingResources: funds } }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }] });
  s.terrain.fill('grass'); s.resources = []; refreshVisibility(s); return s;
}
function launch(s: GameState, gun: Entity, target: Entity): void {
  expect(command(s, 0, { type: 'attack', ids: [gun.id], target: target.id })).toBe(true);
  stepGame(s, .05); expect(s.specialists?.shots).toHaveLength(1);
}

describe('specialist recruitment and cavalry', () => {
  it.each(factions)('%s recruits its named commander, engineer, cavalry and siege through constructed barracks', faction => {
    const s = match(faction), hall = barracks(s), before = { ...s.players[0] };
    const ids = [`core:${faction}-commander`, `core:${faction}-engineer`, FACTIONS[faction].units.cavalry.id, FACTIONS[faction].units.siege.id];
    const recruited = ids.map((id, i) => recruit(s, hall, i < 2 ? 'special' : i === 2 ? 'cavalry' : 'siege', id));
    expect(new Set(recruited.map(e => unitFor(s, e).id)).size).toBe(4);
    for (const resource of ['wood', 'ore', 'crystal'] as const) expect(s.players[0][resource]).toBe(before[resource] - recruited.reduce((sum, e) => sum + unitFor(s, e).cost[resource], 0));
    expect(unitFor(s, recruited[0]).tags).toContain('hero'); expect(unitFor(s, recruited[1]).tags).toContain('engineer');
  });
  it.each(factions)('%s keeps paid definition records aligned when explicit and default queues drain and refill', faction => {
    const s = match(faction), hall = barracks(s), heroId = `core:${faction}-commander`, engineerId = `core:${faction}-engineer`, ranged = FACTIONS[faction].units.ranged;
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: heroId })).toBe(true);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'ranged' })).toBe(true);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: engineerId })).toBe(true);
    expect(hall.queueDefinitionIds).toEqual([heroId, ranged.id, engineerId]); expect(hall.queuePaidCosts).toEqual(hall.queueDefinitionIds!.map((id, i) => ({ ...unitFor(s, 0, i === 1 ? 'ranged' : 'special', id).cost })));
    const resumed = loadGame(saveGame(s)); until(s, () => hall.queue.length === 0); advance(resumed, s.time - resumed.time); expect(saveGame(resumed)).toEqual(saveGame(s));
    expect(hall.queueDefinitionIds).toEqual([]); expect(hall.queuePaidCosts).toEqual([]);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'ranged' })).toBe(true); expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: engineerId })).toBe(true);
    expect(hall.queueDefinitionIds).toEqual([ranged.id, engineerId]); const before = { ...s.players[0] }; expect(command(s, 0, { type: 'cancelTrain', id: hall.id, index: 0 })).toBe(true);
    for (const resource of ['wood', 'ore', 'crystal'] as const) expect(s.players[0][resource]).toBe(before[resource] + ranged.cost[resource]); expect(hall.queueDefinitionIds).toEqual([engineerId]);
    until(s, () => hall.queue.length === 0); expect(s.entities.filter(e => e.definitionId === engineerId)).toHaveLength(2);
  });

  it.each(factions)('%s cavalry uses its distinct ability and rejects an immediate repeat', faction => {
    const s = match(faction), p = arena(s), rider = actor(s, 0, 'cavalry', p.x, p.y), foe = actor(s, 1, 'melee', p.x + 2.5, p.y);
    if (faction === 'tideborn') s.terrain[Math.floor(p.y) * s.width + Math.floor(p.x)] = 'mud';
    refreshVisibility(s);
    const c: Command = ['fairies', 'automata'].includes(faction) ? { type: 'ability', ids: [rider.id], x: p.x, y: p.y + 3 } : { type: 'ability', ids: [rider.id] };
    const shield = rider.shield; expect(command(s, 0, c)).toBe(true); expect(rider.abilityReadyAt).toBeGreaterThan(s.time); expect(command(s, 0, c)).toBe(false);
    if (faction === 'orcs') { expect(rider.momentum).toBe(1); expect(rider.specialistBuffs?.[0].damageFactor).toBeGreaterThan(1); }
    if (faction === 'fairies') expect(rider.y).toBe(p.y + 3);
    if (faction === 'dwarves') { expect(rider.specialistBuffs?.[0].armor).toBe(5); expect(rider.specialistBuffs?.[0].speedFactor).toBeLessThan(1); }
    if (faction === 'undead') { const before = foe.x; advance(s, .5); expect(foe.x).toBeGreaterThan(before); }
    if (faction === 'tideborn') expect(rider.specialistBuffs?.[0]).toMatchObject({ speedFactor: 1.6, damageFactor: 1.2 });
    if (faction === 'automata') { expect(rider.y).toBe(p.y + 3); expect(rider.shield).toBe(shield! - 15); }
  });

  it('rejects leaps to hidden, blocked, distant and foreign targets without spending cooldown or shield', () => {
    const s = match('automata'), p = arena(s), rider = actor(s, 0, 'cavalry', p.x, p.y); refreshVisibility(s);
    for (const c of [{ x: p.x + 5, y: p.y }, { x: .5, y: .5 }, { x: p.x + 2, y: p.y, level: 1 }]) expect(command(s, 0, { type: 'ability', ids: [rider.id], ...c })).toBe(false);
    s.terrain[Math.floor(p.y + 2) * s.width + Math.floor(p.x)] = 'water';
    expect(command(s, 0, { type: 'ability', ids: [rider.id], x: p.x, y: p.y + 2 })).toBe(false);
    expect(command(s, 1, { type: 'ability', ids: [rider.id], x: p.x, y: p.y + 1 })).toBe(false);
    rider.shield = 14; expect(command(s, 0, { type: 'ability', ids: [rider.id], x: p.x, y: p.y + 1 })).toBe(false);
    expect(rider.abilityReadyAt).toBeUndefined(); expect(rider.shield).toBe(14);
  });
  it('requires wet ground for Wet Surge and a nearby hostile troop for Terror', () => {
    for (const faction of ['tideborn', 'undead'] as const) { const s = match(faction), p = arena(s), e = actor(s, 0, 'cavalry', p.x, p.y); refreshVisibility(s); expect(command(s, 0, { type: 'ability', ids: [e.id] })).toBe(false); expect(e.abilityReadyAt).toBeUndefined(); }
  });
  it.each(factions)('%s commander applies its targeted effect through the accepted ability command', faction => {
    const s = match(faction), p = arena(s), hero = actor(s, 0, 'special', p.x, p.y, `core:${faction}-commander`), ally = actor(s, 0, 'special', p.x + 3, p.y), foe = actor(s, 1, 'special', p.x + 4, p.y, 'core:orcs-engineer');
    hero.hp -= 60; ally.hp -= 90; if (ally.maxShield) ally.shield = 0; refreshVisibility(s); const allyHp = ally.hp, foeHp = foe.hp, heroHp = hero.hp;
    let c: Command = { type: 'ability', ids: [hero.id], x: ally.x, y: ally.y };
    if (['dwarves', 'automata'].includes(faction)) c = { type: 'ability', ids: [hero.id], target: ally.id };
    if (faction === 'undead') c = { type: 'ability', ids: [hero.id], target: foe.id };
    expect(command(s, 0, c)).toBe(true); expect(command(s, 0, c)).toBe(false);
    if (faction === 'orcs') expect(ally.specialistBuffs?.some(b => b.damageFactor === 1.25)).toBe(true);
    if (faction === 'fairies') { expect(hero.x).toBe(ally.x); expect(ally.hp).toBe(allyHp + 35); expect(hero.hp).toBe(heroHp + 35); }
    if (faction === 'dwarves') { expect(ally.hp).toBe(allyHp + 80); expect(ally.specialistBuffs?.[0].armor).toBe(4); }
    if (faction === 'undead') { expect(foe.hp).toBe(foeHp - 59); expect(hero.hp).toBe(heroHp + 45); }
    if (faction === 'tideborn') { expect(ally.hp).toBe(allyHp + 50); expect(foe.hp).toBe(foeHp - 34); }
    if (faction === 'automata') { expect(ally.shield).toBe(ally.maxShield); expect(ally.specialistBuffs?.[0].armor).toBe(4); }
  });
  it.each(['dwarves', 'undead', 'automata'] as const)('%s commander rejects the wrong team and invalid targets without consuming its ability', faction => {
    const s = match(faction), p = arena(s), hero = actor(s, 0, 'special', p.x, p.y, `core:${faction}-commander`), ally = actor(s, 0, 'special', p.x + 2, p.y), foe = actor(s, 1, 'melee', p.x + 3, p.y); refreshVisibility(s);
    expect(command(s, 0, { type: 'ability', ids: [hero.id], target: faction === 'undead' ? ally.id : foe.id })).toBe(false);
    expect(command(s, 0, { type: 'ability', ids: [hero.id], target: 999999 })).toBe(false); expect(hero.abilityReadyAt).toBeUndefined();
  });
});

describe('specialist siege impacts', () => {
  it.each(factions)('%s pays preparation costs and delays health damage until projectile impact', faction => {
    const { s, gun, target } = siegeFixture(faction), before = { ...s.players[0] };
    if (faction === 'undead') s.corpses.push({ id: s.nextId++, x: gun.x + 1, y: gun.y, expires: s.time + 45 });
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true);
    expect(s.players[0].wood).toBe(before.wood - (faction === 'orcs' ? 8 : 0));
    expect(s.players[0].ore).toBe(before.ore - (faction === 'dwarves' ? 15 : 0));
    expect(s.players[0].crystal).toBe(before.crystal - (faction === 'automata' ? 8 : ['fairies', 'tideborn'].includes(faction) ? 6 : 0));
    if (faction === 'undead') expect(s.corpses).toHaveLength(0);
    const hp = target.hp; launch(s, gun, target); expect(target.hp).toBe(hp);
    advance(s, .5, .05); expect(target.hp).toBe(hp); advance(s, .5, .05); expect(target.hp).toBeLessThan(hp); expect(s.specialists?.shots).toHaveLength(0);
    expect(gun.siegeMode?.prepared).toBeUndefined();
    if (faction === 'dwarves') expect(gun.siegeMode?.ammo).toBe(4);
    if (faction === 'automata') { expect(gun.siegeMode?.ammo).toBe(3); expect(hp - target.hp).toBeCloseTo(unitFor(s, gun).damage*1.2); }
    if (faction === 'fairies') expect(target.specialistBuffs?.some(b => b.rooted)).toBe(true);
    if (faction === 'tideborn') expect(target.specialistBuffs?.some(b => b.speedFactor === .5)).toBe(true);
    if (faction === 'orcs') expect(target.burning).toHaveLength(1);
  });
  it.each(['orcs', 'fairies', 'dwarves', 'tideborn', 'automata'] as const)('%s rejects preparation without its resource', faction => {
    const { s, gun } = siegeFixture(faction); Object.assign(s.players[0], { wood: 0, ore: 0, crystal: 0 });
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(false); expect(gun.siegeMode).toBeUndefined(); expect(gun.abilityReadyAt).toBeUndefined();
  });
  it('rejects corpse shells without a nearby visible corpse and prevents duplicate paid shell preparation', () => {
    const { s, gun } = siegeFixture('undead'); expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(false);
    s.corpses.push({ id: s.nextId++, x: gun.x + 7, y: gun.y, expires: 45 }); expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(false);
    const prepared = siegeFixture('orcs'); prepared.target.x = prepared.gun.x + 20; refreshVisibility(prepared.s); expect(command(prepared.s, 0, { type: 'ability', ids: [prepared.gun.id] })).toBe(true); const wood = prepared.s.players[0].wood;
    advance(prepared.s, 13); expect(command(prepared.s, 0, { type: 'ability', ids: [prepared.gun.id] })).toBe(false); expect(prepared.s.players[0].wood).toBe(wood);
  });
  it('keeps cannon deployment on an explicit in-range attack, and movement packs it', () => {
    const { s, gun, target } = siegeFixture('dwarves'); expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true);
    launch(s, gun, target); expect(gun.siegeMode?.deployed).toBe(true); expect(gun.siegeMode?.ammo).toBe(4);
    expect(command(s, 0, { type: 'move', ids: [gun.id], x: gun.x - 2, y: gun.y })).toBe(true); expect(gun.siegeMode?.deployed).toBe(false);
  });
  it('redeploys a moved cannon with ten paid rounds without discarding ammunition', () => {
    const { s, gun, target } = siegeFixture('dwarves'); target.x = gun.x + 20; refreshVisibility(s);
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); advance(s, 6);
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); expect(gun.siegeMode?.ammo).toBe(10);
    expect(command(s, 0, { type: 'move', ids: [gun.id], x: gun.x - 1, y: gun.y })).toBe(true); advance(s, 6); const ore = s.players[0].ore;
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); expect(gun.siegeMode).toMatchObject({ ammo: 10, deployed: true }); expect(s.players[0].ore).toBe(ore);
  });
  it.each(['dwarves', 'automata'] as const)('%s expends a finite paid magazine and cannot fire when empty', faction => {
    const s = match(faction), p = arena(s), gun = actor(s, 0, 'siege', p.x - 8, p.y), wall = building(s, 1, FACTIONS.orcs.buildings.wall.id, p.x, p.y); refreshVisibility(s);
    expect(command(s, 0, { type: 'attack', ids: [gun.id], target: wall.id })).toBe(true); advance(s, 1); expect(wall.hp).toBe(wall.maxHp);
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); expect(command(s, 0, { type: 'attack', ids: [gun.id], target: wall.id })).toBe(true);
    until(s, () => gun.siegeMode?.ammo === 0, 25); advance(s, 1.1); expect(wall.hp).toBeLessThan(wall.maxHp); const hp = wall.hp; advance(s, 5); expect(wall.hp).toBe(hp);
    const resource = faction === 'dwarves' ? 'ore' : 'crystal', before = s.players[0][resource]; expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); expect(s.players[0][resource]).toBe(before - (faction === 'dwarves' ? 15 : 8));
  });
  it('damages allies in the impact area without awarding XP for allied damage', () => {
    const { s, gun, target, p } = siegeFixture('orcs'), ally = actor(s, 0, 'special', p.x + .8, p.y, 'core:orcs-engineer'); refreshVisibility(s);
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target); const hp = ally.hp, targetHp = target.hp;
    advance(s, 1.05, .05); expect(ally.hp).toBeLessThan(hp); expect(gun.veteran?.experience).toBeCloseTo((targetHp - target.hp) * .3);
  });
  it('does not turn allied splash damage into survival experience', () => {
    const { s, gun, target, p } = siegeFixture('orcs'), ally = actor(s, 0, 'special', p.x + 1.9, p.y, 'core:orcs-engineer'); refreshVisibility(s);
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target);
    expect(command(s, 0, { type: 'move', ids: [gun.id], x: gun.x - 4, y: gun.y })).toBe(true); const hp = ally.hp; advance(s, 1.1, .05); expect(ally.hp).toBeLessThan(hp);
    advance(s, 16, .05); expect(ally.veteran?.experience ?? 0).toBe(0);
  });
  it('continues incendiary damage after the source dies and is removed', () => {
    const { s, gun, target } = siegeFixture('orcs'); gun.expires = .15;
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target); advance(s, 1.5, .05);
    expect(s.entities.some(e => e.id === gun.id)).toBe(false); expect(target.burning).toHaveLength(1); const hp = target.hp;
    advance(s, 2.1, .05); expect(target.hp).toBeLessThanOrEqual(hp - 10); expect(target.burning?.[0].source).toBe(gun.id);
  });
  it.each(['fairies', 'tideborn'] as const)('%s shell changes commanded movement until its effect expires', faction => {
    const { s, gun, target } = siegeFixture(faction); expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target); advance(s, 1.05, .05);
    expect(command(s, 0, { type: 'stop', ids: [gun.id] })).toBe(true); expect(command(s, 1, { type: 'move', ids: [target.id], x: target.x + 10, y: target.y })).toBe(true);
    const x = target.x; advance(s, 1, .05); const moved = target.x - x;
    if (faction === 'fairies') expect(moved).toBeCloseTo(0); else expect(moved).toBeGreaterThan(.8);
    expect(moved).toBeLessThan(unitFor(s, target).speed * .8);
    advance(s, faction === 'fairies' ? 3.5 : 5.5, .05); const later = target.x; advance(s, .5, .05); expect(target.x - later).toBeGreaterThan(unitFor(s, target).speed * .45);
  });
});

function veteranFixture(role: UnitRole) {
  const s = match('orcs'), p = arena(s), fighter = actor(s, 0, role, p.x - 3, p.y), wall = building(s, 1, FACTIONS.orcs.buildings.wall.id, p.x, p.y);
  refreshVisibility(s); expect(command(s, 0, { type: 'attack', ids: [fighter.id], target: wall.id })).toBe(true);
  until(s, () => (fighter.veteran?.rank ?? 0) >= 1); expect(command(s, 0, { type: 'stop', ids: [fighter.id] })).toBe(true);
  return { s, fighter, wall, p };
}
describe('combat veterans, promotions and recovery', () => {
  it('awards survival XP for a recent hostile hit, then stops awarding it after disengagement', () => {
    const s = match(), p = arena(s), defender = actor(s, 0, 'special', p.x, p.y, 'core:orcs-engineer'), attacker = actor(s, 1, 'ranged', p.x + 4, p.y); refreshVisibility(s);
    expect(command(s, 1, { type: 'attack', ids: [attacker.id], target: defender.id })).toBe(true); stepGame(s, .05); expect(defender.hp).toBeLessThan(defender.maxHp); expect(defender.veteran?.experience).toBe(0);
    expect(command(s, 1, { type: 'move', ids: [attacker.id], x: attacker.x + 8, y: attacker.y })).toBe(true); advance(s, 15.1, .05); expect(defender.veteran?.experience).toBe(5); advance(s, 60); expect(defender.veteran?.experience).toBe(5);
  });
  it.each(['illusion', 'raised'] as const)('does not award survival XP for being hit only by a disposable %s', flag => {
    const s = match(), p = arena(s), defender = actor(s, 0, 'special', p.x, p.y, 'core:orcs-engineer'), attacker = actor(s, 1, 'ranged', p.x + 4, p.y); attacker[flag] = true; attacker.expires = .15; refreshVisibility(s);
    advance(s, .05, .05); expect(defender.hp).toBeLessThan(defender.maxHp); advance(s, 16, .05); expect(defender.veteran?.experience ?? 0).toBe(0);
  });
  it('earns all three ranks from hostile damage and grants survival XP only while combat exposure is recent', () => {
    const { s, fighter, wall } = veteranFixture('ranged'); expect(fighter.veteran?.experience).toBeGreaterThanOrEqual(40); expect(fighter.veteran?.pendingPromotion).toBe(1);
    expect(command(s, 0, { type: 'attack', ids: [fighter.id], target: wall.id })).toBe(true); until(s, () => (fighter.veteran?.rank ?? 0) === 3);
    expect(command(s, 0, { type: 'move', ids: [fighter.id], x: fighter.x - 12, y: fighter.y })).toBe(true); advance(s, 25); const xp = fighter.veteran!.experience; advance(s, 65); expect(fighter.veteran!.experience).toBe(xp);
  });
  it.each([['melee', 'vanguard'], ['special', 'bulwark'], ['ranged', 'sharpshooter'], ['cavalry', 'pathfinder']] as [UnitRole, PromotionId][])('%s promotion %s changes the real combat or movement result', (role, promotion) => {
    const { s, fighter, wall } = veteranFixture(role), enemy = actor(s, 1, 'special', fighter.x + unitFor(s, fighter).range + .6, fighter.y, 'core:orcs-engineer');
    wall.x = s.width - 3; wall.y = 3; fighter.cooldown = 0; refreshVisibility(s); const checkpoint = saveGame(s), base = loadGame(checkpoint), promoted = loadGame(checkpoint);
    expect(command(promoted, 0, { type: 'promote', id: fighter.id, promotion })).toBe(true); expect(command(promoted, 1, { type: 'promote', id: fighter.id, promotion })).toBe(false);
    expect(command(promoted, 0, { type: 'promote', id: fighter.id, promotion })).toBe(false);
    const baseline = base.entities.find(e => e.id === fighter.id)!, upgraded = promoted.entities.find(e => e.id === fighter.id)!;
    if (promotion === 'pathfinder') {
      for (const state of [base, promoted]) expect(command(state, 0, { type: 'move', ids: [fighter.id], x: fighter.x - 8, y: fighter.y })).toBe(true);
      advance(base, .5, .05); advance(promoted, .5, .05); expect(fighter.x - upgraded.x).toBeGreaterThan((fighter.x - baseline.x) * 1.19);
    } else if (promotion === 'sharpshooter') {
      for (const state of [base, promoted]) expect(command(state, 0, { type: 'attack', ids: [fighter.id], target: enemy.id })).toBe(true);
      advance(base, .05, .05); advance(promoted, .05, .05); expect(promoted.entities.find(e => e.id === enemy.id)!.hp).toBeLessThan(base.entities.find(e => e.id === enemy.id)!.hp); expect(upgraded.x).toBeCloseTo(fighter.x); expect(baseline.x).toBeGreaterThan(fighter.x);
    } else if (promotion === 'vanguard') {
      for (const state of [base, promoted]) { const target = state.entities.find(e => e.id === enemy.id)!; target.x = fighter.x + 1; expect(command(state, 0, { type: 'attack', ids: [fighter.id], target: enemy.id })).toBe(true); }
      advance(base, 2, .05); advance(promoted, 2, .05); expect(promoted.entities.find(e => e.id === enemy.id)!.hp).toBeLessThan(base.entities.find(e => e.id === enemy.id)!.hp);
    } else {
      for (const state of [base, promoted]) { const target = state.entities.find(e => e.id === enemy.id)!; target.x = fighter.x + 1; expect(command(state, 1, { type: 'attack', ids: [enemy.id], target: fighter.id })).toBe(true); }
      advance(base, 1.5, .05); advance(promoted, 1.5, .05); expect(upgraded.hp).toBeGreaterThan(baseline.hp);
    }
  });
  it.each(['illusion', 'raised'] as const)('does not award combat XP for damaging %s troops or attacks by them', flag => {
    for (const flaggedAttacker of [false, true]) {
      const s = match(), p = arena(s), attacker = actor(s, 0, 'ranged', p.x, p.y), target = actor(s, 1, 'worker', p.x + 3, p.y);
      (flaggedAttacker ? attacker : target)[flag] = true; if (flag === 'illusion') (flaggedAttacker ? attacker : target).expires = 20;
      refreshVisibility(s); const hp = target.hp; advance(s, 4, .05); expect(target.hp).toBeLessThan(hp); expect(attacker.veteran?.experience ?? 0).toBe(0);
    }
  });
  it('rejects allied attack commands and ineligible promotion choices', () => {
    const { s, fighter } = veteranFixture('ranged'), friend = s.entities.find(e => e.side === 0 && e.role === 'worker')!;
    expect(command(s, 0, { type: 'attack', ids: [fighter.id], target: friend.id })).toBe(false); expect(command(s, 0, { type: 'promote', id: fighter.id, promotion: 'vanguard' })).toBe(false);
  });
  it('limits commanders while queued and alive, then requires the full death recovery and recruitment price', () => {
    const s = match(), hall = barracks(s), id = 'core:orcs-commander', other = building(s, 0, FACTIONS.orcs.buildings.barracks.id, 16.5, 6.5), p = arena(s);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: id })).toBe(true);
    expect(command(s, 0, { type: 'train', id: other.id, role: 'special', definitionId: id })).toBe(false);
    until(s, () => s.entities.some(e => e.definitionId === id)); const hero = s.entities.find(e => e.definitionId === id)!;
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: id })).toBe(false);
    hero.x = p.x; hero.y = p.y; hero.hp = 10; const killer = actor(s, 1, 'ranged', p.x + 3, p.y); refreshVisibility(s);
    expect(command(s, 1, { type: 'attack', ids: [killer.id], target: hero.id })).toBe(true); until(s, () => hero.hp === 0, 5);
    const diedAt = s.time, recovery = s.players[0].heroRecovery![0]; expect(recovery.availableAt).toBeCloseTo(diedAt + 30);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: id })).toBe(false); advance(s, 29.75);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: id })).toBe(false); advance(s, .25);
    const before = { ...s.players[0] }; expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: id })).toBe(true);
    for (const resource of ['wood', 'ore', 'crystal'] as const) expect(s.players[0][resource]).toBe(before[resource] - unitFor(s, hero).cost[resource]);
    expect(s.entities.some(e => e.id !== hero.id && e.definitionId === id)).toBe(false); advance(s, 25); expect(s.entities.filter(e => e.hp > 0 && e.definitionId === id)).toHaveLength(1);
  });
});

describe('finite artifacts', () => {
  it('uses imported hero tags independently of role for queue limits, recovery and role-compatible equipment', () => {
    const def: UnitDef = { ...FACTIONS.fairies.units.ranged, id: 'lantern:scout-captain', tags: ['hero'], age: 2, ability: 'queen-step' }, s = customMatch([def]), hall = barracks(s);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'ranged', definitionId: def.id })).toBe(true);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'special', definitionId: 'core:fairies-commander' })).toBe(false);
    until(s, () => s.entities.some(e => e.definitionId === def.id)); const hero = s.entities.find(e => e.definitionId === def.id)!, charm = createArtifact(s, 'core:wind-charm', hero), blade = createArtifact(s, 'core:ember-blade', hero); refreshVisibility(s);
    expect(command(s, 0, { type: 'train', id: hall.id, role: 'ranged', definitionId: def.id })).toBe(false);
    for (const item of [charm, blade]) expect(command(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true);
    expect(command(s, 0, { type: 'equipArtifact', id: hero.id, artifact: charm.id })).toBe(true); expect(command(s, 0, { type: 'equipArtifact', id: hero.id, artifact: blade.id })).toBe(false); expect(hero.equipment).toEqual({ trinket: charm.id });
    expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
  });
  it('enforces owner, distance, visibility and specialist eligibility, and equips only a held item', () => {
    const s = match(), p = arena(s), hero = actor(s, 0, 'special', p.x, p.y, 'core:orcs-commander'), worker = actor(s, 0, 'worker', p.x, p.y + 1), enemy = actor(s, 1, 'special', p.x + 1, p.y, 'core:orcs-engineer'), item = createArtifact(s, 'core:ember-blade', { x: p.x, y: p.y + 1 }); refreshVisibility(s);
    expect(command(s, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(false); expect(command(s, 0, { type: 'recoverArtifact', id: worker.id, artifact: item.id })).toBe(false);
    item.position!.x += 5; expect(command(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(false); item.position!.x -= 5;
    s.visible[0].clear(); expect(command(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(false); refreshVisibility(s);
    expect(command(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(command(s, 1, { type: 'equipArtifact', id: enemy.id, artifact: item.id })).toBe(false);
    expect(command(s, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(hero.equipment).toEqual({ weapon: item.id }); expect(item).toMatchObject({ holder: hero.id, owner: 0 }); expect(item.position).toBeUndefined();
    expect(command(s, 0, { type: 'unequipArtifact', id: hero.id, slot: 'armor' })).toBe(false); expect(command(s, 0, { type: 'unequipArtifact', id: hero.id, slot: 'weapon' })).toBe(true); expect(item.holder).toBe(hero.id);
    expect(command(s, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(command(s, 0, { type: 'dropArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(item.position).toEqual({ x: hero.x, y: hero.y }); expect(item.holder).toBeUndefined(); expect(hero.equipment?.weapon).toBeUndefined();
  });
  it('changes damage, armor and movement through equipped artifacts, and removal restores the baseline', () => {
    const s = match(), p = arena(s), hero = actor(s, 0, 'special', p.x, p.y, 'core:orcs-engineer'), enemy = actor(s, 1, 'ranged', p.x + 4, p.y), target = actor(s, 1, 'special', p.x + 1, p.y, 'core:orcs-engineer');
    const blade = createArtifact(s, 'core:ember-blade', hero), aegis = createArtifact(s, 'core:iron-aegis', hero), charm = createArtifact(s, 'core:wind-charm', hero); refreshVisibility(s);
    for (const item of [blade, aegis, charm]) expect(command(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true);
    const baseline = loadGame(saveGame(s)), equipped = loadGame(saveGame(s));
    for (const item of [blade, aegis, charm]) expect(command(equipped, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true);
    for (const state of [baseline, equipped]) { expect(command(state, 0, { type: 'attack', ids: [hero.id], target: target.id })).toBe(true); expect(command(state, 1, { type: 'attack', ids: [enemy.id], target: hero.id })).toBe(true); }
    advance(baseline, 1.5, .05); advance(equipped, 1.5, .05);
    expect(equipped.entities.find(e => e.id === target.id)!.hp).toBeLessThan(baseline.entities.find(e => e.id === target.id)!.hp); expect(equipped.entities.find(e => e.id === hero.id)!.hp).toBeGreaterThan(baseline.entities.find(e => e.id === hero.id)!.hp);
    const fresh = loadGame(saveGame(s)); expect(command(fresh, 0, { type: 'equipArtifact', id: hero.id, artifact: charm.id })).toBe(true);
    for (const state of [s, fresh]) expect(command(state, 0, { type: 'move', ids: [hero.id], x: hero.x - 8, y: hero.y })).toBe(true);
    advance(s, .5, .05); advance(fresh, .5, .05); expect(p.x - fresh.entities.find(e => e.id === hero.id)!.x).toBeGreaterThan((p.x - hero.x) * 1.24);
    expect(command(fresh, 0, { type: 'unequipArtifact', id: hero.id, slot: 'trinket' })).toBe(true);
  });
  it('drops held items once on a commander death and makes only visible ground artifacts observable', () => {
    const s = match(), p = arena(s), hero = actor(s, 0, 'special', p.x, p.y, 'core:orcs-commander'), killer = actor(s, 1, 'ranged', p.x + 3, p.y), item = createArtifact(s, 'core:iron-aegis', hero); hero.hp = 5; refreshVisibility(s);
    expect(command(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(command(s, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true);
    expect(command(s, 1, { type: 'attack', ids: [killer.id], target: hero.id })).toBe(true); until(s, () => hero.hp === 0, 5);
    expect(s.specialists?.artifacts).toHaveLength(2); expect(item.position).toEqual({ x: hero.x, y: hero.y }); expect(item.owner).toBeUndefined(); expect(hero.equipment).toBeUndefined();
    advance(s, 3); expect(s.specialists?.artifacts).toHaveLength(2); s.visible[0].clear(); expect(observedArtifacts(s, 0)).toEqual([]); expect(observedArtifacts(s, 1)).toHaveLength(2);
  });
  it.each(['illusion', 'raised'] as const)('does not create a commander artifact when a disposable %s dies', flag => {
    const s = match(), p = arena(s), decoy = actor(s, 1, 'special', p.x, p.y, 'core:orcs-commander'), killer = actor(s, 0, 'ranged', p.x - 3, p.y); decoy[flag] = true; decoy.expires = 20; decoy.hp = 1; refreshVisibility(s);
    expect(command(s, 0, { type: 'attack', ids: [killer.id], target: decoy.id })).toBe(true); until(s, () => decoy.hp === 0, 5); expect(s.specialists?.artifacts ?? []).toEqual([]); expect(s.players[1].heroRecovery).toBeUndefined();
  });
});

describe('beacon outposts and engineer field work', () => {
  it.each([true, false])('connects a beacon chain with global shared vision=%s, grants team sight, alerts once and never attacks', shared => {
    const s = match('orcs', [0, 0, 1], shared), hq = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
    const first = building(s, 0, 'core:orcs-beacon', hq.x + 11, hq.y), second = building(s, 0, 'core:orcs-beacon', hq.x + 22, hq.y), key = Math.floor(second.y) * s.width + Math.floor(second.x + 10), intruder = actor(s, 2, 'worker', second.x + 4, second.y);
    refreshVisibility(s); expect(first.beacon?.connected).toBe(true); expect(second.beacon?.connected).toBe(true); expect(s.visible[0].has(key)).toBe(true); expect(s.visible[1].has(key)).toBe(true);
    const hp = intruder.hp; stepGame(s, .25); expect(s.events.filter(e => e.text === 'Beacon invasion alert.' && e.source === second.id)).toHaveLength(1); advance(s, 2); expect(intruder.hp).toBe(hp); expect(s.events.some(e => e.type === 'attack' && [first.id, second.id].includes(e.source!))).toBe(false);
    first.hp = 1; const destroyer = actor(s, 2, 'ranged', first.x + 3, first.y); refreshVisibility(s); expect(command(s, 2, { type: 'attack', ids: [destroyer.id], target: first.id })).toBe(true); until(s, () => first.hp === 0, 5); refreshVisibility(s);
    expect(second.beacon?.connected).toBe(false); expect(s.visible[0].has(key)).toBe(false); expect(s.explored[0].has(key)).toBe(true);
  });
  it('constructs a beacon through normal worker building commands', () => {
    const s = match(), worker = s.entities.find(e => e.side === 0 && e.role === 'worker')!;
    expect(command(s, 0, { type: 'build', ids: [worker.id], role: 'tower', definitionId: 'core:orcs-beacon', x: 13.5, y: 6.5 })).toBe(true);
    const beacon = s.entities.find(e => e.definitionId === 'core:orcs-beacon')!; until(s, () => beacon.progress === 1, 40); refreshVisibility(s); expect(beacon.beacon?.connected).toBe(true);
  });
  it('builds a three-tile bridge, lets a unit cross, then restores water after 60 seconds', () => {
    const s = match(), p = arena(s), engineer = actor(s, 0, 'special', p.x - 3, p.y, 'core:orcs-engineer'), crossing = actor(s, 0, 'worker', p.x - 3, p.y + 1);
    for (let y = 0; y < s.height; y++) for (let dx = -1; dx <= 1; dx++) s.terrain[y * s.width + Math.floor(p.x) + dx] = 'water'; refreshVisibility(s);
    expect(route(s, crossing, { x: p.x + 3, y: p.y }, .5)).toEqual([]); const wood = s.players[0].wood;
    expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: p.x, y: p.y })).toBe(true); expect(s.players[0].wood).toBe(wood - 60); expect(s.specialists?.structures[0].tiles).toHaveLength(3);
    for (let dx = -1; dx <= 1; dx++) expect(terrainAt(s, p.x + dx, p.y)).toBe('bridge'); expect(command(s, 0, { type: 'move', ids: [crossing.id], x: p.x + 3, y: p.y })).toBe(true); advance(s, 8); expect(crossing.x).toBeGreaterThan(p.x + 1.5);
    advance(s, 51.75); expect(terrainAt(s, p.x, p.y)).toBe('bridge'); advance(s, .25); for (let dx = -1; dx <= 1; dx++) expect(terrainAt(s, p.x + dx, p.y)).toBe('water'); expect(s.specialists?.structures).toEqual([]);
  });
  it('preserves a bridge tile changed later, blocks duplicate builds, and expires a barricade collision', () => {
    const s = match(), p = arena(s), engineer = actor(s, 0, 'special', p.x - 3, p.y, 'core:orcs-engineer'); s.terrain[Math.floor(p.y) * s.width + Math.floor(p.x)] = 'water'; refreshVisibility(s);
    expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: p.x, y: p.y })).toBe(true); const wood = s.players[0].wood;
    expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: p.x, y: p.y })).toBe(false); expect(s.players[0].wood).toBe(wood);
    s.terrain[Math.floor(p.y) * s.width + Math.floor(p.x)] = 'road';
    expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'barricade', x: engineer.x, y: engineer.y + 2 })).toBe(true); const barricade = s.entities.find(e => e.definitionId === 'core:field-barricade')!;
    expect(walkable(s, barricade.x, barricade.y)).toBe(false); expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'barricade', x: barricade.x, y: barricade.y })).toBe(false);
    advance(s, 60); expect(terrainAt(s, p.x, p.y)).toBe('road'); expect(terrainAt(s, p.x - 1, p.y)).toBe('grass'); expect(barricade.hp).toBe(0); expect(walkable(s, barricade.x, barricade.y)).toBe(true);
  });
  it('returns an actor occupying an expired bridge to walkable shore', () => {
    const s = match(), p = arena(s), engineer = actor(s, 0, 'special', p.x - 3, p.y, 'core:orcs-engineer'), traveler = actor(s, 0, 'worker', p.x - 3, p.y + 1);
    for (let y = 0; y < s.height; y++) for (let dx = -1; dx <= 1; dx++) s.terrain[y * s.width + Math.floor(p.x) + dx] = 'water'; refreshVisibility(s);
    expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: p.x, y: p.y })).toBe(true);
    expect(command(s, 0, { type: 'move', ids: [traveler.id], x: p.x, y: p.y })).toBe(true); advance(s, 5); expect(terrainAt(s, traveler.x, traveler.y)).toBe('bridge');
    advance(s, 55); expect(terrainAt(s, traveler.x, traveler.y)).not.toBe('water'); expect(walkable(s, traveler.x, traveler.y)).toBe(true); expect(traveler.order.type).toBe('idle');
  });
  it('charges proportional ore for field repair and rejects full, distant, hostile and unsupported targets', () => {
    const s = match(), p = arena(s), engineer = actor(s, 0, 'special', p.x, p.y, 'core:orcs-engineer'), siege = actor(s, 0, 'siege', p.x + 2, p.y), friend = actor(s, 0, 'melee', p.x, p.y + 2), enemy = actor(s, 1, 'siege', p.x + 3, p.y), depot = building(s, 0, FACTIONS.orcs.buildings.depot.id, p.x - 3, p.y); siege.hp -= 100; friend.hp -= 50; enemy.hp -= 50; depot.hp -= 17; refreshVisibility(s); const ore = s.players[0].ore;
    expect(command(s, 0, { type: 'fieldRepair', id: engineer.id, target: siege.id })).toBe(true); expect(siege.hp).toBe(siege.maxHp - 40); expect(s.players[0].ore).toBe(ore - 6);
    expect(command(s, 0, { type: 'fieldRepair', id: engineer.id, target: depot.id })).toBe(true); expect(depot.hp).toBe(depot.maxHp); expect(s.players[0].ore).toBe(ore - 8);
    for (const target of [friend, enemy, depot]) expect(command(s, 0, { type: 'fieldRepair', id: engineer.id, target: target.id })).toBe(false);
    siege.x += 5; expect(command(s, 0, { type: 'fieldRepair', id: engineer.id, target: siege.id })).toBe(false); siege.x -= 5; s.players[0].ore = 0; expect(command(s, 0, { type: 'fieldRepair', id: engineer.id, target: siege.id })).toBe(false);
  });
  it('rejects field work by ordinary troops, beyond sight or distance, and without payment', () => {
    const s = match(), p = arena(s), engineer = actor(s, 0, 'special', p.x, p.y, 'core:orcs-engineer'), worker = actor(s, 0, 'worker', p.x + 1, p.y); refreshVisibility(s);
    for (const c of [{ ids: [worker.id], x: p.x + 2, y: p.y }, { ids: [engineer.id], x: p.x + 5, y: p.y }, { ids: [engineer.id], x: .5, y: .5 }, { ids: [engineer.id], x: p.x + 2, y: p.y, level: 1 }]) expect(command(s, 0, { type: 'engineerBuild', kind: 'barricade', ...c })).toBe(false);
    s.players[0].wood = 34; expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'barricade', x: p.x + 2, y: p.y })).toBe(false); expect(s.specialists?.structures ?? []).toEqual([]);
  });
});

describe('specialist saves and recorded accepted commands', () => {
  it.each([false, true])('does not credit a captured siege engine for its former owner\'s delayed damage, lethal=%s', lethal => {
    const s = match('orcs', [0, 1, 2]), p = arena(s), gun = actor(s, 0, 'siege', p.x - 8, p.y), target = actor(s, 2, 'special', p.x, p.y, 'core:orcs-engineer'); if (lethal) target.hp = 1; refreshVisibility(s);
    expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target);
    // This authored capture snapshot contains a shell launched by the previous owner.
    // Recording begins after the ownership transfer because this checkout lacks the capture command.
    gun.side = 1; gun.definitionFaction = 'orcs'; refreshVisibility(s); const recorder = new MatchRecorder(s);
    expect(command(s, 1, { type: 'move', ids: [gun.id], x: gun.x - 4, y: gun.y })).toBe(true); const resumed = loadGame(saveGame(s));
    advance(s, 2.05, .05); advance(resumed, 2.05, .05); expect(target.hp).toBeLessThan(target.maxHp); expect(gun.veteran?.experience ?? 0).toBe(0); expect(saveGame(resumed)).toEqual(saveGame(s));
    const replay = new ReplayPlayer(recorder.export()); replay.seek(s.tick); expect(saveGame(replay.state)).toEqual(saveGame(s)); recorder.dispose(); replay.dispose();
  });
  it.each(factions)('%s saves and replays its ammunition, pending impact and active field effect', faction => {
    const { s, gun, target } = siegeFixture(faction); if (faction === 'undead') s.corpses.push({ id: s.nextId++, x: gun.x + 1, y: gun.y, expires: 45 });
    const recorder = new MatchRecorder(s); expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target);
    const pending = loadGame(saveGame(s)); advance(s, 1.05, .05); advance(pending, 1.05, .05); expect(saveGame(pending)).toEqual(saveGame(s));
    const effect = loadGame(saveGame(s)); advance(s, 1, .05); advance(effect, 1, .05); expect(saveGame(effect)).toEqual(saveGame(s));
    const replay = new ReplayPlayer(recorder.export()); replay.seek(s.tick); expect(saveGame(replay.state)).toEqual(saveGame(s)); recorder.dispose(); replay.dispose();
  });
  it('resolves a real long-range shell after its source has died, been removed and been saved', () => {
    const definition = { ...FACTIONS.orcs.units.siege, id: 'lantern:long-range-artillery', range: 20 };
    const s = customMatch([definition]); s.entities = s.entities.filter(e => e.role === 'hq');
    const gun = spawnDefinition(s, 0, 'unit', definition.id, 4.5, 18.5), target = actor(s, 1, 'special', 22.5, 18.5, 'core:orcs-engineer'); gun.expires = .15; gun.order = { type: 'hold' }; refreshVisibility(s);
    // The target is visible from an authored allied scout, independently of the firing range.
    const scout = spawnDefinition(s, 0, 'unit', 'lantern:sentinel', 22.5, 25.5); scout.order = { type: 'hold' }; refreshVisibility(s);
    const recorder = new MatchRecorder(s); expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target); advance(s, 1.45, .05);
    expect(s.entities.some(e => e.id === gun.id)).toBe(false); expect(s.specialists?.shots).toHaveLength(1); const checkpoint = saveGame(s), resumed = loadGame(checkpoint), hp = target.hp;
    advance(s, .5, .05); advance(resumed, .5, .05); expect(target.hp).toBeLessThan(hp); expect(saveGame(resumed)).toEqual(saveGame(s));
    advance(s, 2, .05); advance(resumed, 2, .05); expect(saveGame(resumed)).toEqual(saveGame(s)); expect(target.burning?.[0].source).toBe(gun.id);
    const replay = new ReplayPlayer(recorder.export()); replay.seek(s.tick); expect(saveGame(replay.state)).toEqual(saveGame(s)); recorder.dispose(); replay.dispose();
  });
  it('resumes and replays active shells, fire, equipment, bridges and hero recovery deterministically', () => {
    const s = match('orcs'), p = arena(s), gun = actor(s, 0, 'siege', p.x - 8, p.y), target = actor(s, 1, 'special', p.x, p.y, 'core:orcs-engineer'), engineer = actor(s, 0, 'special', p.x - 4, p.y + 3, 'core:orcs-engineer'), hero = actor(s, 0, 'special', p.x - 3, p.y + 7, 'core:orcs-commander'), killer = actor(s, 1, 'ranged', p.x + 1, p.y + 7), item = createArtifact(s, 'core:iron-aegis', hero);
    hero.hp = 1; s.terrain[Math.floor(p.y + 3) * s.width + Math.floor(p.x - 2)] = 'water'; refreshVisibility(s);
    const recorder = new MatchRecorder(s);
    expect(command(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(command(s, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true);
    expect(command(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: p.x - 2, y: p.y + 3 })).toBe(true);
    expect(command(s, 1, { type: 'attack', ids: [killer.id], target: hero.id })).toBe(true); expect(command(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); launch(s, gun, target);
    const pending = loadGame(saveGame(s)); advance(s, 2, .05); advance(pending, 2, .05); expect(replayChecksum(pending)).toBe(replayChecksum(s)); expect(s.players[0].heroRecovery).toHaveLength(1); expect(target.burning?.length).toBeGreaterThan(0);
    const burning = loadGame(saveGame(s)); advance(s, 4, .05); advance(burning, 4, .05); expect(replayChecksum(burning)).toBe(replayChecksum(s));
    const replay = new ReplayPlayer(recorder.export()); replay.seek(s.tick); expect(saveGame(replay.state)).toEqual(saveGame(s)); replay.seek(1); replay.seek(s.tick); expect(replayChecksum(replay.state)).toBe(replayChecksum(s)); recorder.dispose(); replay.dispose();
  });
});
