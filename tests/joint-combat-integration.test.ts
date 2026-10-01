import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { contentHash, createContentBundle, unitFor } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { terrainAt } from '../src/core/maps';
import { NEUTRAL_RULES } from '../src/core/neutral-world';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { ArtilleryModification } from '../src/core/faction-systems';
import type { BuiltinFactionId, Command, Entity, GameEvent, GameState, Side, UnitRole } from '../src/core/types';
import type { NeutralCreature, WorldBridge, WorldMapData } from '../src/core/world-types';

const funds = { wood: 10000, ore: 10000, crystal: 10000 };
type TargetKind = 'unit' | 'building' | 'bridge' | 'creature';
type Target = Entity | WorldBridge | NeutralCreature;

function authoredMap(options: { bridge?: boolean; site?: 'village' | 'monster'; mirror?: boolean } = {}): WorldMapData {
  const map = generateWorldMap(4127, 'large', 2, 'temperate');
  for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  map.sites = [];
  for (const level of options.mirror ? [0, 1] : [1]) {
    if (options.bridge) for (let x = 28; x <= 36; x++) map.levels[level].terrain[32 * map.width + x] = 'bridge';
    if (options.mirror && options.site && !options.bridge) map.levels[level].terrain[33 * map.width + 33] = 'bridge';
    if (options.site) map.sites.push({ id: map.sites.length + 1, kind: options.site, x: 32.5, y: 32.5, level });
  }
  return map;
}

function match(faction: BuiltinFactionId = 'dwarves', options: Parameters<typeof authoredMap>[0] = {}, opponent: BuiltinFactionId = 'orcs'): GameState {
  const map = authoredMap(options);
  const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3, friendlyFire: true }, players: [
    { id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: funds } },
    { id: 1, teamId: 1, factionId: opponent, controller: 'external', handicap: { startingResources: funds } },
  ] });
  // Starting armies are outside this authored encounter; retain both real HQs.
  s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = []; refreshVisibility(s); return s;
}

function actor(s: GameState, side: Side, role: UnitRole, x: number, y: number, level = 1, definitionId = FACTIONS[s.players[side].faction].units[role].id): Entity {
  const e = spawnDefinition(s, side, 'unit', definitionId, x, y, 1, level);
  e.order = { type: 'hold' }; e.cooldown = 100; e.facing = 4; return e;
}

function command(s: GameState, side: Side, c: Command): void {
  refreshVisibility(s); expect(issueCommand(s, side, c), JSON.stringify(c)).toBe(true);
}

function advance(s: GameState, seconds: number): GameEvent[] {
  const end = s.time + seconds, events: GameEvent[] = [];
  while (s.time + 1e-8 < end) {
    const before = s.time; stepGame(s, Math.min(.05, end - s.time));
    expect(s.time, 'Both HQs must remain alive throughout the encounter').toBeGreaterThan(before);
    events.push(...s.events.map(e => ({ ...e })));
  }
  return events;
}

function until(s: GameState, condition: () => boolean, seconds: number): void {
  const end = s.time + seconds;
  while (!condition() && s.time < end) advance(s, .05);
  expect(condition(), `Condition not reached by ${end}s`).toBe(true);
}

function targetIn(s: GameState, id: number): Target {
  const value = [...s.entities, ...s.world!.bridges, ...s.world!.creatures].find(e => e.id === id);
  expect(value).toBeDefined(); return value!;
}

function pendingCount(s: GameState): number { return (s.projectiles?.length ?? 0) + (s.specialists?.shots?.length ?? 0); }

function attack(s: GameState, gun: Entity, target: Target): void {
  command(s, gun.side, { type: 'side' in target ? 'attack' : 'worldAttack', ids: [gun.id], target: target.id });
}

function loadCannon(s: GameState, gun: Entity): void {
  const before = { ...s.players[gun.side] };
  command(s, gun.side, { type: 'ability', ids: [gun.id] });
  expect(gun.siegeMode).toMatchObject({ ammo: 5, deployed: true });
  expect(s.players[gun.side].ore).toBe(before.ore - 15);
  expect(s.players[gun.side].wood).toBe(before.wood);
  expect(s.players[gun.side].crystal).toBe(before.crystal);
}

function fitting(s: GameState, gun: Entity, modification: ArtilleryModification): void {
  const before = { ...s.players[gun.side] };
  command(s, gun.side, { type: 'modifyArtillery', ids: [gun.id], modification });
  expect(s.players[gun.side].wood).toBe(before.wood - 25);
  expect(s.players[gun.side].ore).toBe(before.ore - 20);
  expect(gun.factionState?.artillery).toBe(modification);
}

function fixture(kind: TargetKind, options: { mirror?: boolean; faction?: BuiltinFactionId } = {}) {
  const s = match(options.faction ?? 'dwarves', { bridge: kind === 'bridge', site: kind === 'creature' ? 'village' : undefined, mirror: options.mirror });
  let target: Target;
  if (kind === 'bridge') target = s.world!.bridges.find(e => e.level === 1)!;
  else if (kind === 'creature') target = s.world!.creatures.find(e => e.level === 1)!;
  else if (kind === 'building') target = spawnDefinition(s, 1, 'building', FACTIONS.orcs.buildings.wall.id, 32.5, 32.5, 1, 1);
  else target = actor(s, 1, 'special', 32.5, 32.5, 1, 'core:orcs-engineer');
  // Aim from above at a long bridge's central tile; other targets face their western attacker.
  const gun = actor(s, 0, 'siege', kind === 'bridge' ? target.x : target.x - 8, kind === 'bridge' ? target.y - 8 : target.y);
  gun.cooldown = 0;
  if (kind === 'creature') {
    const bait = actor(s, 1, 'special', target.x + 1.25, target.y, 1, 'core:orcs-engineer');
    // An unowned village defender engages a nearby raider instead of patrolling away from the shell.
    command(s, 1, { type: 'worldAttack', ids: [bait.id], target: target.id });
  }
  refreshVisibility(s); return { s, gun, target };
}

function singleShot(s: GameState, gun: Entity, target: Target): void {
  gun.cooldown = 0; attack(s, gun, target); advance(s, .05);
  expect(pendingCount(s)).toBe(1);
  command(s, gun.side, { type: 'stop', ids: [gun.id] });
  gun.cooldown = 100; // Hold this encounter to its one paid launch.
}

describe('mixed authoritative weapon paths', () => {
  it.each(['unit', 'bridge', 'creature'] as const)('blocks empty ammunition and delays one paid cannon round against a %s', kind => {
    const { s, gun, target } = fixture(kind), hp = target.hp, before = { ...s.players[0] };
    attack(s, gun, target); advance(s, .05);
    expect(target.hp).toBe(hp); expect(pendingCount(s)).toBe(0); expect(gun.siegeMode?.ammo ?? 0).toBe(0);
    expect(s.players[0].ore).toBe(before.ore); expect(s.players[0].wood).toBe(before.wood);
    loadCannon(s, gun); singleShot(s, gun, target);
    expect(target.hp).toBe(hp); expect(gun.siegeMode!.ammo).toBe(4);
    const resumed = loadGame(saveGame(s));
    advance(s, .3); advance(resumed, .3); expect(target.hp).toBe(hp); expect(targetIn(resumed, target.id).hp).toBe(hp);
    advance(s, .75); advance(resumed, .75);
    expect(target.hp).toBeLessThan(hp); expect(pendingCount(s)).toBe(0);
    expect(s.players[0].ore).toBe(before.ore - 15); expect(s.players[0].wood).toBe(before.wood);
    expect(gun.siegeMode!.ammo).toBe(4); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it.each((['stone', 'grapeshot'] as const).flatMap(modification => (['unit', 'building', 'bridge', 'creature'] as const).map(kind => ({ modification, kind }))))('$modification applies the target multiplier once to a $kind', ({ modification, kind }) => {
    const { s, gun, target } = fixture(kind); loadCannon(s, gun); fitting(s, gun, modification);
    const hp = target.hp, structure = kind === 'building' || kind === 'bridge';
    const armor = 'side' in target ? target.kind === 'unit' ? unitFor(s, target).armor : 3 : 0;
    const raw = unitFor(s, gun).damage * 1.5 * (structure ? unitFor(s, gun).buildingDamageMultiplier! : 1);
    const expected = raw * (modification === 'stone' && structure ? 1.25 : modification === 'grapeshot' && !structure ? 1.5 : 1) - armor;
    expect(expected, 'The authored bridge must have enough HP to distinguish the modifiers').toBeLessThan(hp);
    singleShot(s, gun, target); expect(s.specialists!.shots![0].modification).toBe(modification);
    const resumed = loadGame(saveGame(s)); advance(s, 1.05); advance(resumed, 1.05);
    expect(hp - target.hp).toBeCloseTo(expected, 6); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it.each(['unit', 'bridge', 'creature'] as const)('blocks an empty beam and spends one paid armor-piercing beam against a %s', kind => {
    const { s, gun, target } = fixture(kind, { faction: 'automata' }), hp = target.hp, before = { ...s.players[0] };
    attack(s, gun, target); advance(s, .05); expect(target.hp).toBe(hp); expect(pendingCount(s)).toBe(0);
    command(s, 0, { type: 'ability', ids: [gun.id] });
    expect(gun.siegeMode!.ammo).toBe(4); expect(s.players[0].crystal).toBe(before.crystal - 8); expect(s.players[0].ore).toBe(before.ore);
    singleShot(s, gun, target); expect(gun.siegeMode!.ammo).toBe(3); expect(target.hp).toBe(hp);
    const resumed = loadGame(saveGame(s)); advance(s, 1.05); advance(resumed, 1.05);
    expect(hp - target.hp).toBeCloseTo(unitFor(s, gun).damage * (kind === 'bridge' ? 4 : 1), 6);
    expect(gun.siegeMode!.ammo).toBe(3); expect(s.players[0].crystal).toBe(before.crystal - 8); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it.each(['unit', 'bridge', 'creature'] as const)('a fitted special Siege Cannon retains its stone shell against a %s through save/load', kind => {
    const { s, gun: idleEngine, target } = fixture(kind); idleEngine.cooldown = 100;
    const gun = actor(s, 0, 'special', kind === 'bridge' ? target.x : target.x - 5, kind === 'bridge' ? target.y - 5 : target.y);
    fitting(s, gun, 'stone'); const hp = target.hp, armor = 'side' in target ? unitFor(s, target).armor : 0;
    const expected = unitFor(s, gun).damage * (kind === 'bridge' ? 1.8 * 1.25 : 1) - armor;
    singleShot(s, gun, target); expect(s.projectiles).toHaveLength(1); expect(s.specialists?.shots ?? []).toHaveLength(0);
    expect(s.projectiles![0]).toMatchObject({ modification: 'stone', side: 0, source: gun.id, level: 1, from: { level: 1 } });
    const resumed = loadGame(saveGame(s)); advance(s, .8); advance(resumed, .8);
    expect(hp - target.hp).toBeCloseTo(expected, 6); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('grapeshot uses each splash victim class when the primary target is a building', () => {
    const map = authoredMap({ site: 'village' });
    map.sites[0].y = 33.5; map.levels[1].terrain[33 * map.width + 33] = 'bridge';
    const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 }, players: [
      { id: 0, teamId: 0, factionId: 'dwarves', controller: 'external', handicap: { startingResources: funds } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external', handicap: { startingResources: funds } },
    ] }); s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
    const wall = spawnDefinition(s, 1, 'building', FACTIONS.orcs.buildings.wall.id, 32.5, 32.5, 1, 1);
    const troop = actor(s, 1, 'special', 31.5, 31.5, 1, 'core:orcs-engineer'), creature = s.world!.creatures[0], bridge = s.world!.bridges[0];
    const bait = actor(s, 1, 'special', creature.x + 1.25, creature.y, 1, 'core:orcs-engineer');
    command(s, 1, { type: 'worldAttack', ids: [bait.id], target: creature.id });
    const gun = actor(s, 0, 'siege', 24.5, 32.5); loadCannon(s, gun); fitting(s, gun, 'grapeshot');
    const victims = [wall, troop, creature, bridge].map(value => ({ value, hp: value.hp, distance: Math.hypot(value.x - wall.x, value.y - wall.y) }));
    singleShot(s, gun, wall); const events = advance(s, 1.05);
    for (const { value, hp, distance } of victims) {
      const structure = value === wall || value === bridge, armor = 'side' in value ? value.kind === 'unit' ? unitFor(s, value).armor : 3 : 0;
      const expected = 28 * 1.5 * (structure ? 4 : 1.5) * (1 - .4 * distance / 2.5) - armor;
      expect(hp - value.hp, `Victim ${value.id}`).toBeCloseTo(expected, 6);
      expect(events.filter(e => e.type === 'attack' && e.source === gun.id && e.target === value.id)).toHaveLength(1);
    }
  });

  it.each((['unit', 'bridge', 'creature'] as const).flatMap(kind => [{ kind, wood: 14, ore: 20 }, { kind, wood: 20, ore: 4 }]))('insufficient incendiary funds preserve cannon ammo against a $kind ($wood wood, $ore ore)', ({ kind, wood, ore }) => {
    const { s, gun, target } = fixture(kind); loadCannon(s, gun); fitting(s, gun, 'incendiary');
    s.players[0].wood = wood; s.players[0].ore = ore; const hp = target.hp;
    attack(s, gun, target); advance(s, .05);
    expect(pendingCount(s)).toBe(0); expect(gun.siegeMode!.ammo).toBe(5); expect(target.hp).toBe(hp);
    expect(s.players[0].wood).toBe(wood); expect(s.players[0].ore).toBe(ore);
    const resumed = loadGame(saveGame(s)); s.players[0].wood = resumed.players[0].wood = 15; s.players[0].ore = resumed.players[0].ore = 5;
    gun.cooldown = 0; resumed.entities.find(e => e.id === gun.id)!.cooldown = 0;
    advance(s, .05); advance(resumed, .05);
    expect(pendingCount(s)).toBe(1); expect(gun.siegeMode!.ammo).toBe(4);
    expect(s.players[0].wood).toBe(0); expect(s.players[0].ore).toBe(0); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('a cavern grapeshot impact leaves actors, permanent bridges and creatures at the same surface coordinates untouched', () => {
    const { s, gun, target } = fixture('creature', { mirror: true }); loadCannon(s, gun); fitting(s, gun, 'grapeshot');
    const upperCreature = s.world!.creatures.find(e => e.level === 0)!;
    const lowerTroop = actor(s, 1, 'special', target.x - 1, target.y - 1, 1, 'core:orcs-engineer');
    const upperTroop = actor(s, 1, 'special', lowerTroop.x, lowerTroop.y, 0, 'core:orcs-engineer');
    const lowerWall = spawnDefinition(s, 1, 'building', FACTIONS.orcs.buildings.wall.id, target.x, target.y + 1.5, 1, 1);
    const upperWall = spawnDefinition(s, 1, 'building', FACTIONS.orcs.buildings.wall.id, lowerWall.x, lowerWall.y, 1, 0);
    const lowerBridge = s.world!.bridges.find(e => e.level === 1)!, upperBridge = s.world!.bridges.find(e => e.level === 0)!;
    expect(lowerBridge).toBeDefined(); expect(upperBridge).toBeDefined();
    const sameLevelVictims = [target, lowerTroop, lowerWall, lowerBridge], oppositeLevelVictims = [upperCreature, upperTroop, upperWall, upperBridge];
    const before = new Map([...sameLevelVictims, ...oppositeLevelVictims].map(e => [e.id, e.hp]));
    singleShot(s, gun, target); const resumed = loadGame(saveGame(s)); advance(s, 1.05); advance(resumed, 1.05);
    for (const e of sameLevelVictims) expect(e.hp, `Cavern victim ${e.id}`).toBeLessThan(before.get(e.id)!);
    for (const e of oppositeLevelVictims) expect(e.hp, `Surface victim ${e.id}`).toBe(before.get(e.id));
    expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('a saved shot uses its launch origin and elevation after its living shooter moves off the hill', () => {
    const { s, gun, target } = fixture('unit'), origin = { x: gun.x, y: gun.y, level: 1 };
    const gx = Math.floor(gun.x), gy = Math.floor(gun.y), heights = s.world!.levels[1].elevation;
    for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) heights[y * s.width + x] = 1;
    heights[gy * s.width + gx] = 2; loadCannon(s, gun); singleShot(s, gun, target);
    expect(s.specialists!.shots![0].source).toMatchObject({ ...origin, elevation: 2, side: 0, id: gun.id });
    command(s, 0, { type: 'move', ids: [gun.id], x: origin.x - 2, y: origin.y, level: 1 }); advance(s, .7);
    expect(gun.x).toBeLessThan(gx); expect(pendingCount(s)).toBe(1);
    const hp = target.hp, resumed = loadGame(saveGame(s)), events = advance(s, .4); advance(resumed, .4);
    const expected = unitFor(s, gun).damage * 1.5 * 1.24 - unitFor(s, target as Entity).armor;
    expect(hp - target.hp).toBeCloseTo(expected, 6);
    const hit = events.find(e => e.type === 'attack' && e.source === gun.id && e.target === target.id)!;
    expect(hit).toMatchObject({ ...origin, side: 0 }); expect(gun.x).not.toBe(origin.x); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('an admitted long-range shell survives source death, removal and a pending-impact checkpoint', () => {
    const mod = structuredClone(exampleMod()), definition = { ...FACTIONS.orcs.units.siege, id: 'lantern:long-gun', range: 30 };
    mod.factions[0].units.push(definition); mod.art[definition.id] = { ...mod.art['lantern:sentinel'], path: '/mods/lantern/long-gun.svg' };
    const { hash: _oldHash, ...body } = mod; const content = createContentBundle([{ ...body, hash: contentHash(body) }]), map = authoredMap();
    const s = createMatch({ content, map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 }, players: [
      { id: 0, teamId: 0, factionId: 'lantern:keepers', controller: 'external', handicap: { startingResources: funds } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
    ] }); s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
    const gun = actor(s, 0, 'siege', 16.5, 32.5, 1, definition.id), target = actor(s, 1, 'special', 44.5, 32.5, 1, 'core:orcs-engineer');
    actor(s, 0, 'melee', 44.5, 38.5, 1, 'lantern:sentinel'); gun.expires = s.time + .15;
    command(s, 0, { type: 'ability', ids: [gun.id] }); const hp = target.hp; singleShot(s, gun, target); advance(s, 1.4);
    expect(s.entities.some(e => e.id === gun.id)).toBe(false); expect(pendingCount(s)).toBe(1); expect(target.hp).toBe(hp);
    const remaining = s.specialists!.shots![0].impactAt - s.time + .06;
    const resumed = loadGame(saveGame(s)), events = advance(s, remaining); advance(resumed, remaining);
    expect(target.hp).toBeLessThan(hp); expect(pendingCount(s)).toBe(0);
    expect(events.filter(e => e.type === 'attack' && e.target === target.id && e.source === gun.id)).toHaveLength(1);
    expect(events.find(e => e.type === 'attack' && e.target === target.id && e.source === gun.id)).toMatchObject({ side: 0, x: 16.5, y: 32.5, level: 1 });
    expect(target.burning?.[0]).toMatchObject({ side: 0, source: gun.id, origin: { x: 16.5, y: 32.5, level: 1 } });
    expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('real crew defeat and capture cannot transfer an earlier incendiary hit to the new owner', () => {
    const s = match('orcs'), gun = actor(s, 0, 'siege', 24.5, 32.5), target = actor(s, 1, 'special', 32.5, 32.5, 1, 'core:orcs-engineer');
    command(s, 0, { type: 'ability', ids: [gun.id] }); singleShot(s, gun, target);
    const raiders = [-.6, -.2, .2, .6].map(dy => actor(s, 1, 'melee', gun.x - 1.1, gun.y + dy));
    for (const raider of raiders) raider.cooldown = 0;
    command(s, 1, { type: 'attack', ids: raiders.map(e => e.id), target: gun.id }); advance(s, .05);
    expect(gun.tactics!.siegeCrew!.uncrewed).toBe(true);
    command(s, 1, { type: 'stop', ids: raiders.map(e => e.id) });
    command(s, 1, { type: 'captureSiege', ids: [raiders[1].id], target: gun.id }); until(s, () => gun.side === 1, 5);
    expect(gun.definitionFaction).toBe('orcs'); expect(target.burning?.[0].side).toBe(0);
    const fury = [...s.factionSystems!.fury], xp = gun.veteran?.experience ?? 0, hp = target.hp, resumed = loadGame(saveGame(s));
    const events = advance(s, 1.1); advance(resumed, 1.1);
    expect(target.hp).toBeLessThan(hp); expect(gun.veteran?.experience ?? 0).toBe(xp);
    expect(s.factionSystems!.fury[0] - fury[0]).toBeCloseTo((hp - target.hp) * .12, 6);
    expect(s.factionSystems!.fury[1]).toBeCloseTo(fury[1], 6);
    const historic = events.filter(e => e.type === 'attack' && e.source === gun.id && e.target === target.id);
    expect(historic.length).toBeGreaterThan(0); expect(historic.every(e => e.side === 0)).toBe(true); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('simultaneous cannon impacts collapse one permanent bridge and evacuate its occupant once', () => {
    const { s, gun, target } = fixture('bridge'), bridge = target as WorldBridge;
    const second = actor(s, 0, 'siege', gun.x + .8, gun.y), passenger = actor(s, 1, 'worker', bridge.x + 3, bridge.y);
    loadCannon(s, gun); loadCannon(s, second); gun.cooldown = second.cooldown = 0;
    command(s, 0, { type: 'worldAttack', ids: [gun.id, second.id], target: bridge.id }); advance(s, .05);
    expect(pendingCount(s)).toBe(2); command(s, 0, { type: 'stop', ids: [gun.id, second.id] }); gun.cooldown = second.cooldown = 100;
    const hp = bridge.hp, events = advance(s, 1.05);
    expect(bridge.hp).toBe(0); expect(events.filter(e => e.target === bridge.id && e.text === 'Bridge destroyed. Rebuild with workers to restore the crossing.')).toHaveLength(1);
    expect(events.filter(e => e.source === passenger.id && e.text === 'Bridge destroyed: survivors reached the bank with injuries.')).toHaveLength(1);
    expect(passenger.hp).toBeCloseTo(passenger.maxHp * .75); expect(terrainAt(s, passenger.x, passenger.y, 1)).toBe('grass');
    expect(events.filter(e => e.type === 'attack' && e.target === bridge.id).reduce((sum, e) => sum + (e.amount ?? 0), 0)).toBeCloseTo(hp);
    for (const tile of bridge.tiles) expect(s.world!.levels[1].terrain[tile]).toBe('water');
    const resumed = loadGame(saveGame(s)); advance(s, 1); advance(resumed, 1); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('simultaneous grapeshot kills claim the den reward once and preserve both respawn deadlines', () => {
    const s = match('dwarves', { site: 'monster' }), site = s.world!.sites[0], creatures = s.world!.creatures;
    const bait = actor(s, 1, 'special', site.x, site.y + 1.8, 1, 'core:orcs-commander');
    // Both wounded creatures can attack this target without leaving their starting points.
    for (const creature of creatures) creature.hp = 1;
    const gun = actor(s, 0, 'siege', creatures[0].x - 8, creatures[0].y), second = actor(s, 0, 'siege', gun.x, gun.y - .8);
    loadCannon(s, gun); loadCannon(s, second); fitting(s, gun, 'grapeshot'); fitting(s, second, 'grapeshot');
    const before = { ...s.players[0] }, reward = { ...site.reward }; gun.cooldown = second.cooldown = 0;
    command(s, 0, { type: 'worldAttack', ids: [gun.id, second.id], target: creatures[0].id }); advance(s, .05);
    expect(pendingCount(s)).toBe(2); const expectedDeathAt = Math.ceil((Math.min(...s.specialists!.shots!.map(shot => shot.impactAt)) - 1e-8) / .05) * .05;
    command(s, 0, { type: 'stop', ids: [gun.id, second.id] }); gun.cooldown = second.cooldown = 100;
    const events = advance(s, 1.05); expect(bait.hp).toBeGreaterThan(0);
    expect(creatures.every(e => e.hp === 0)).toBe(true); expect(site.rewarded).toEqual([0]); expect(site.reward).toEqual({ wood: 0, ore: 0, crystal: 0 });
    for (const resource of ['wood', 'ore', 'crystal'] as const) expect(s.players[0][resource]).toBe(before[resource] + reward[resource]);
    expect(events.filter(e => e.text?.startsWith('Monster den cleared:'))).toHaveLength(1);
    expect(events.filter(e => e.type === 'attack' && creatures.some(c => c.id === e.target)).reduce((sum, e) => sum + (e.amount ?? 0), 0)).toBeCloseTo(2);
    for (const creature of creatures) expect(creature.respawnAt).toBeCloseTo(expectedDeathAt + NEUTRAL_RULES.monsterRespawnSeconds, 6);
    const deadlines = creatures.map(e => e.respawnAt), resumed = loadGame(saveGame(s)); advance(s, 2); advance(resumed, 2);
    expect(s.world!.creatures.map(e => e.respawnAt)).toEqual(deadlines); expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it.each([true, false])('mutual lethal hits award completed XP, Fury and one corpse per unit with Orc-first ID order %s', orcFirst => {
    const s = match('orcs', {}, 'fairies'); let orc: Entity, fairy: Entity;
    if (orcFirst) { orc = actor(s, 0, 'melee', 24.5, 32.5); fairy = actor(s, 1, 'melee', 25.5, 32.5); }
    else { fairy = actor(s, 1, 'melee', 25.5, 32.5); orc = actor(s, 0, 'melee', 24.5, 32.5); }
    orc.hp = fairy.hp = 1; orc.cooldown = fairy.cooldown = 0; orc.facing = 0; fairy.facing = 4;
    attack(s, orc, fairy); attack(s, fairy, orc); const events = advance(s, .05);
    expect(orc.hp).toBe(0); expect(fairy.hp).toBe(0); expect(orc.veteran?.experience).toBeCloseTo(18.3); expect(fairy.veteran?.experience).toBeCloseTo(18.3);
    expect(s.factionSystems!.fury[0]).toBeCloseTo(.12); expect(orc.factionState?.trophyKills).toBe(1);
    for (const e of [orc, fairy]) { expect(s.corpses.filter(c => c.id === e.id)).toHaveLength(1); expect(events.filter(event => event.type === 'death' && event.source === e.id)).toHaveLength(1); }
    expect(events.filter(e => e.type === 'attack').reduce((sum, e) => sum + (e.amount ?? 0), 0)).toBeCloseTo(2);
    expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
  });
});
