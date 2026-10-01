import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { unitFor } from '../src/core/content-registry';
import { environmentPhase, projectileEnvironment } from '../src/core/environment';
import { terrainAt } from '../src/core/maps';
import { route, walkable } from '../src/core/navigation';
import { PlayerView } from '../src/core/observation';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { createArtifact } from '../src/core/unit-progression';
import { facingDamageFactor } from '../src/core/tactics';
import { highGroundDamageFactor, setWorldTerrain } from '../src/core/world-map';
import { observationToRenderState } from '../src/online/render-state';
import type { PlayerObservation } from '../src/online/protocol';
import type { BuiltinFactionId, Entity, GameState, Side } from '../src/core/types';
import type { WorldState } from '../src/core/world-types';

type LayeredState = GameState & { world: WorldState };
function fixture(faction: BuiltinFactionId = 'orcs'): LayeredState {
  const s = createMatch({ map: { seed: 4127, size: 'small', biome: 'forest' }, rules: { startingAge: 3, sharedVision: false }, players: [{ id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 10000 } } }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }] }) as LayeredState;
  s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
  for (const e of s.entities) { e.x = e.side === 0 ? 2.5 : s.width - 2.5; e.y = e.side === 0 ? 2.5 : s.height - 2.5; }
  for (const level of s.world.levels) { level.terrain.fill('grass'); level.elevation.fill(0); }
  Object.assign(s.world, { biome: 'temperate', revision: 0, transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 10000, seasonLength: 10000, weatherLength: 10000 });
  selectWeather(s, 'clear'); refreshVisibility(s); return s;
}
function selectWeather(s: LayeredState, weather: 'clear' | 'rain'): void {
  for (let seed = 1; seed < 1000; seed++) { s.seed = seed; if (environmentPhase(s).weather === weather) return; }
  throw new Error(`No ${weather} seed`);
}
function actor(s: LayeredState, side: Side, definitionId: string, x: number, y: number, level = 1): Entity {
  const e = spawnDefinition(s, side, 'unit', definitionId, x, y, 1, level); e.order = { type: 'hold' }; return e;
}
function advance(s: GameState, seconds: number, dt = .25): void {
  const deadline = s.time + seconds;
  while (s.time + 1e-8 < deadline) { const before = s.time; stepGame(s, Math.min(dt, deadline - s.time)); if (s.time === before) throw new Error('Unexpected match completion'); }
}
function ready(s: LayeredState): void { refreshVisibility(s); expect(() => saveGame(s)).not.toThrow(); }
function equip(s: LayeredState, hero: Entity) {
  const item = createArtifact(s, 'core:iron-aegis', hero); refreshVisibility(s);
  expect(issueCommand(s, hero.side, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true);
  expect(issueCommand(s, hero.side, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true); return item;
}
function online(s: LayeredState, side: Side) {
  const observer = new PlayerView(side), view = observer.observe(s);
  return observationToRenderState({ ...view, events: observer.events(s), map: { ...view.map, starts: s.starts.map((p, i) => i === side ? p : null) }, entities: view.entities.map(e => ({ ...e, facing: 0, animation: 'idle', animTime: 0 })) } as unknown as PlayerObservation);
}

describe('specialists in a layered world', () => {
  it.each([0, 1])('builds and expires a level-%s bridge through the world terrain API, and replays a real crossing', level => {
    const s = fixture(), x = 18.5, y = 18.5, engineer = actor(s, 0, 'core:orcs-engineer', x - 3, y, level), traveler = actor(s, 0, FACTIONS.orcs.units.worker.id, x - 3, y + 1, level), other = actor(s, 0, FACTIONS.orcs.units.worker.id, x - 3, y + 8, 1 - level);
    for (let row = 0; row < s.height; row++) for (let dx = -1; dx <= 1; dx++) s.world.levels[level].terrain[row * s.width + Math.floor(x) + dx] = 'water';
    engineer.path = [{ x: engineer.x + 1, y, level }]; other.path = [{ x: other.x + 1, y: other.y, level: 1 - level }]; ready(s);
    expect(route(s, traveler, { x: x + 3, y, level }, .5)).toEqual([]); const untouched = [...s.world.levels[1 - level].terrain], recorder = new MatchRecorder(s);
    expect(issueCommand(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x, y, level })).toBe(true);
    expect(s.world.revision).toBe(3); expect(engineer.path).toEqual([]); expect(other.path).toHaveLength(1); expect(s.world.levels[1 - level].terrain).toEqual(untouched);
    expect(s.events.at(-1)).toMatchObject({ type: 'build', level }); expect(s.specialists!.structures[0].tiles?.every(tile => tile.level === level)).toBe(true);
    const checkpoint = loadGame(saveGame(s)); expect(issueCommand(s, 0, { type: 'move', ids: [traveler.id], x: x + 3, y, level })).toBe(true); expect(issueCommand(checkpoint, 0, { type: 'move', ids: [traveler.id], x: x + 3, y, level })).toBe(true);
    advance(s, 8); advance(checkpoint, 8); expect(traveler.x).toBeGreaterThan(x + 1.5); expect(replayChecksum(checkpoint)).toBe(replayChecksum(s));
    advance(s, 52); advance(checkpoint, 52); expect(s.specialists!.structures).toEqual([]); expect(s.world.revision).toBe(6); expect(replayChecksum(checkpoint)).toBe(replayChecksum(s));
    for (let dx = -1; dx <= 1; dx++) expect(terrainAt(s, x + dx, y, level)).toBe('water'); expect(s.world.levels[1 - level].terrain).toEqual(untouched);
    const player = new ReplayPlayer(recorder.export()); player.seek(s.tick); expect(saveGame(player.state)).toEqual(saveGame(s)); recorder.dispose(); player.dispose();
  });
  it('rejects temporary bridge placement over permanent bridge tiles without charging resources', () => {
    const s = fixture(), engineer = actor(s, 0, 'core:orcs-engineer', 15.5, 18.5), tiles = [17, 18, 19].map(x => 18 * s.width + x);
    for (const tile of tiles) s.world.levels[1].terrain[tile] = 'water'; s.world.bridges.push({ id: s.nextId++, x: 18.5, y: 18.5, level: 1, tiles, hp: 0, maxHp: 160, rebuilding: 0, repairSide: null }); ready(s);
    const wood = s.players[0].wood; expect(issueCommand(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: 18.5, y: 18.5, level: 1 })).toBe(false); expect(s.players[0].wood).toBe(wood); expect(s.specialists?.structures ?? []).toEqual([]);
  });
  it('restores untouched temporary tiles despite unrelated edits and preserves changed terrain on either level', () => {
    const s = fixture(), engineer = actor(s, 0, 'core:orcs-engineer', 15.5, 18.5); s.world.levels[1].terrain[18 * s.width + 18] = 'water'; ready(s);
    expect(issueCommand(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: 18.5, y: 18.5, level: 1 })).toBe(true);
    expect(setWorldTerrain(s, { x: 18.5, y: 18.5, level: 1 }, 'road')).toBe(true); expect(setWorldTerrain(s, { x: 25.5, y: 25.5, level: 0 }, 'mud')).toBe(true);
    const resumed = loadGame(saveGame(s)); advance(s, 60); advance(resumed, 60); expect(saveGame(resumed)).toEqual(saveGame(s)); expect(terrainAt(s, 18.5, 18.5, 1)).toBe('road'); expect(terrainAt(s, 17.5, 18.5, 1)).toBe('grass'); expect(terrainAt(s, 19.5, 18.5, 1)).toBe('grass'); expect(terrainAt(s, 25.5, 25.5, 0)).toBe('mud');
  });
  it.each([0, 1])('evacuates a level-%s unit whose footprint overlaps an expired bridge from adjacent bank', level => {
    const s = fixture(), engineer = actor(s, 0, 'core:orcs-engineer', 24.5, 20.5, level), traveler = actor(s, 0, FACTIONS.orcs.units.worker.id, 28.1, 20.5, level); s.world.levels[level].terrain[20 * s.width + 27] = 'water'; ready(s);
    expect(issueCommand(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'bridge', x: 26.5, y: 20.5, level })).toBe(true); expect(walkable(s, traveler.x, traveler.y, level)).toBe(true);
    advance(s, 60); expect(walkable(s, traveler.x, traveler.y, level)).toBe(true); expect(traveler.level).toBe(level); expect(traveler.order.type).toBe('idle'); expect(s.events.some(e => e.source === traveler.id && e.level === level && e.text?.includes('bridge expired'))).toBe(true);
  });
  it.each([0, 1])('evacuates a level-%s unit whose footprint overlaps a destroyed permanent bridge from adjacent bank', level => {
    const s = fixture(), gun = actor(s, 1, FACTIONS.orcs.units.siege.id, 24.5, 20.5, level), traveler = actor(s, 0, FACTIONS.orcs.units.worker.id, 28.1, 20.5, level), tile = 20 * s.width + 27;
    s.world.levels[level].terrain[tile] = 'bridge'; const bridge = { id: s.nextId++, x: 27.5, y: 20.5, level, tiles: [tile], hp: 1, maxHp: 160, rebuilding: 0, repairSide: null }; s.world.bridges.push(bridge); ready(s);
    expect(walkable(s, traveler.x, traveler.y, level)).toBe(true); expect(issueCommand(s, 1, { type: 'worldAttack', ids: [gun.id], target: bridge.id })).toBe(true); stepGame(s, .05);
    expect(bridge.hp).toBe(1); expect(s.projectiles).toHaveLength(1);
    for (let i = 0; bridge.hp > 0 && i < 30; i++) stepGame(s, .05);
    expect(bridge.hp).toBe(0); expect(walkable(s, traveler.x, traveler.y, level)).toBe(true); expect(traveler.level).toBe(level); expect(traveler.order.type).toBe('idle'); expect(s.events.some(e => e.source === traveler.id && e.level === level && e.text?.includes('Bridge destroyed'))).toBe(true);
  });
  it('uses underground terrain for teleportation and keeps its event hidden from a surface observer', () => {
    const s = fixture('fairies'), hero = actor(s, 0, 'core:fairies-commander', 18.5, 18.5), surfaceObserver = actor(s, 1, FACTIONS.orcs.units.worker.id, 21.5, 18.5, 0); s.terrain[18 * s.width + 21] = 'water'; ready(s);
    expect(issueCommand(s, 0, { type: 'ability', ids: [hero.id], x: 21.5, y: 18.5, level: 0 })).toBe(false);
    expect(issueCommand(s, 0, { type: 'ability', ids: [hero.id], x: 21.5, y: 18.5, level: 1 })).toBe(true); expect(hero).toMatchObject({ x: 21.5, y: 18.5, level: 1 }); expect(s.events.at(-1)).toMatchObject({ type: 'ability', level: 1, source: hero.id });
    expect(new PlayerView(1).events(s)).toEqual([]); expect(surfaceObserver.level).toBe(0); expect(new PlayerView(0).events(s)).toHaveLength(1);
    const display = online(s, 0); expect(display.state.entities.find(e => e.id === hero.id)?.level).toBe(1); expect(display.state.events.at(-1)?.level).toBe(1);
  });
  it('moves terrified underground units while leaving identical surface coordinates unaffected', () => {
    const s = fixture('undead'), rider = actor(s, 0, FACTIONS.undead.units.cavalry.id, 18.5, 18.5), foe = actor(s, 1, FACTIONS.orcs.units.melee.id, 21.5, 18.5), surface = actor(s, 1, FACTIONS.orcs.units.melee.id, 21.5, 18.5, 0); ready(s); const before = foe.x;
    const recorder = new MatchRecorder(s); expect(issueCommand(s, 0, { type: 'ability', ids: [rider.id] })).toBe(true); advance(s, .5, .05); expect(foe.x).toBeGreaterThan(before); expect(foe.level).toBe(1); expect(surface.x).toBe(before); expect(surface.specialistBuffs).toBeUndefined();
    const player = new ReplayPlayer(recorder.export()); player.seek(s.tick); expect(saveGame(player.state)).toEqual(saveGame(s)); recorder.dispose(); player.dispose();
  });
  it('observes and equips underground artifacts without disclosing hidden surface artifacts or retaining shared records', () => {
    const s = fixture(), hero = actor(s, 0, 'core:orcs-commander', 18.5, 18.5), item = createArtifact(s, 'core:iron-aegis', hero), surface = createArtifact(s, 'core:wind-charm', { x: hero.x, y: hero.y, level: 0 }); ready(s);
    expect(new PlayerView(0).observe(s).artifacts.map(e => e.id)).toEqual([item.id]); expect(issueCommand(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: surface.id })).toBe(false);
    expect(issueCommand(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(issueCommand(s, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true); const display = online(s, 0);
    expect(display.state.entities.find(e => e.id === hero.id)?.equipment).toEqual({ armor: item.id }); expect(display.state.specialists!.artifacts.map(e => e.id)).toEqual([item.id]); expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
    display.state.specialists!.artifacts[0].holder = 999; expect(item.holder).toBe(hero.id);
  });
  it.each([0, 1])('records field repair and barricade commands on level-%s', level => {
    const s = fixture(), engineer = actor(s, 0, 'core:orcs-engineer', 18.5, 18.5, level), gun = actor(s, 0, FACTIONS.orcs.units.siege.id, 20.5, 18.5, level); gun.hp -= 70; ready(s);
    const recorder = new MatchRecorder(s); expect(issueCommand(s, 0, { type: 'fieldRepair', id: engineer.id, target: gun.id })).toBe(true); expect(s.events.at(-1)).toMatchObject({ level, source: engineer.id, target: gun.id }); expect(gun.hp).toBe(gun.maxHp - 10);
    expect(issueCommand(s, 0, { type: 'engineerBuild', ids: [engineer.id], kind: 'barricade', x: 18.5, y: 20.5, level })).toBe(true); const wall = s.entities.find(e => e.definitionId === 'core:field-barricade')!; expect(wall.level).toBe(level); expect(walkable(s, wall.x, wall.y, level)).toBe(false); expect(walkable(s, wall.x, wall.y, 1 - level)).toBe(true);
    advance(s, 60); expect(wall.hp).toBe(0); expect(walkable(s, wall.x, wall.y, level)).toBe(true); const player = new ReplayPlayer(recorder.export()); player.seek(s.tick); expect(saveGame(player.state)).toEqual(saveGame(s)); recorder.dispose(); player.dispose();
  });
});

describe('specialist deaths and projectile environment', () => {
  it.each([0, 1])('uses veteran damage, promotion armor and equipment in normal level-%s neutral combat and replay', level => {
    const s = fixture(), hero = actor(s, 0, 'core:orcs-commander', 18.5, 18.5, level), blade = createArtifact(s, 'core:ember-blade', hero), aegis = createArtifact(s, 'core:iron-aegis', hero);
    hero.veteran = { experience: 40, rank: 1, pendingPromotion: 1, nextSurvivalAt: 15, lastCombatAt: 0, promotions: [] };
    const site = { id: s.nextId++, x: 19.5, y: 18.5, level, kind: 'monster' as const, owner: null, loyalty: [0, 0], progress: 0, capturing: null, reward: { wood: 0, ore: 0, crystal: 0 }, rewarded: [], request: { wood: 0, ore: 0, crystal: 0 }, supplied: false, creatureIds: [] as number[], respawnAt: 0 };
    const creature = { id: s.nextId++, site: site.id, x: 19.5, y: 18.5, level, hp: 110, maxHp: 110, cooldown: 0, target: null, path: [], patrol: 0, respawnAt: 0 }; site.creatureIds.push(creature.id); s.world.sites.push(site); s.world.creatures.push(creature); ready(s);
    const recorder = new MatchRecorder(s); expect(issueCommand(s, 0, { type: 'promote', id: hero.id, promotion: 'bulwark' })).toBe(true);
    for (const item of [blade, aegis]) { expect(issueCommand(s, 0, { type: 'recoverArtifact', id: hero.id, artifact: item.id })).toBe(true); expect(issueCommand(s, 0, { type: 'equipArtifact', id: hero.id, artifact: item.id })).toBe(true); }
    expect(issueCommand(s, 0, { type: 'worldAttack', ids: [hero.id], target: creature.id })).toBe(true); const resumed = loadGame(saveGame(s)), hp = hero.hp, damage = unitFor(s, hero).damage * 1.05 * 1.25, armor = unitFor(s, hero).armor + 1 + 3 + 4;
    stepGame(s, .05); stepGame(resumed, .05); expect(110 - creature.hp).toBeCloseTo(damage); expect(hp - hero.hp).toBe(Math.max(1, 10 - armor)); expect(hp - hero.hp).toBeLessThan(Math.max(1, 10 - unitFor(s, hero).armor));
    expect(s.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'attack', source: hero.id, target: creature.id, level }), expect.objectContaining({ type: 'attack', source: creature.id, target: hero.id, level })])); expect(saveGame(resumed)).toEqual(saveGame(s));
    const player = new ReplayPlayer(recorder.export()); player.seek(s.tick); expect(saveGame(player.state)).toEqual(saveGame(s)); recorder.dispose(); player.dispose();
  });
  it.each([0, 1])('runs commander recovery and finite artifact cleanup when a level-%s forest fire kills a hero', level => {
    const s = fixture(), hero = actor(s, 0, 'core:orcs-commander', 18.5, 18.5, level), worker = actor(s, 0, FACTIONS.orcs.units.worker.id, 19.5, 18.5, level); hero.hp = 1; s.world.levels[level].terrain[18 * s.width + 18] = 'forest'; const item = equip(s, hero); ready(s);
    const recorder = new MatchRecorder(s); expect(issueCommand(s, 0, { type: 'ignite', ids: [worker.id], x: hero.x, y: hero.y, level })).toBe(true); const checkpoint = loadGame(saveGame(s)); advance(s, .25); advance(checkpoint, .25); expect(hero.hp).toBe(0);
    expect(s.players[0].heroRecovery).toEqual([{ definitionId: 'core:orcs-commander', availableAt: s.time + 30 }]); expect(s.specialists!.artifacts).toHaveLength(2); expect(item).toMatchObject({ position: { x: hero.x, y: hero.y, level } }); expect(item.holder).toBeUndefined(); expect(hero.equipment).toBeUndefined(); expect(s.corpses.filter(e => e.id === hero.id)).toHaveLength(1);
    expect(s.events.filter(e => e.type === 'death' && e.source === hero.id)).toHaveLength(1); expect(s.events.find(e => e.type === 'death' && e.source === hero.id)?.level).toBe(level); expect(saveGame(checkpoint)).toEqual(saveGame(s));
    advance(s, 2); advance(checkpoint, 2); expect(saveGame(checkpoint)).toEqual(saveGame(s)); expect(s.specialists!.artifacts).toHaveLength(2); const player = new ReplayPlayer(recorder.export()); player.seek(s.tick); expect(saveGame(player.state)).toEqual(saveGame(s)); recorder.dispose(); player.dispose();
  });
  it('runs commander recovery and one loot drop when thaw drowns a hero trapped far from shore', () => {
    const s = fixture(), hero = actor(s, 0, 'core:orcs-commander', 18.5, 18.5, 0); s.time = 399.9; s.world.seasonLength = 100; s.terrain.fill('water'); s.terrain[18 * s.width + 18] = 'ice'; s.world.iceTiles = [{ level: 0, tile: 18 * s.width + 18 }]; const item = equip(s, hero); ready(s);
    const recorder = new MatchRecorder(s), checkpoint = loadGame(saveGame(s)); advance(s, .1, .1); advance(checkpoint, .1, .1); expect(hero.hp).toBe(0); expect(s.world.iceTiles).toEqual([]); expect(item.holder).toBeUndefined(); expect(s.specialists!.artifacts).toHaveLength(2); expect(s.players[0].heroRecovery![0].availableAt).toBeCloseTo(430); expect(s.corpses.filter(e => e.id === hero.id)).toHaveLength(1); expect(saveGame(checkpoint)).toEqual(saveGame(s));
    const player = new ReplayPlayer(recorder.export()); player.seek(s.tick); expect(saveGame(player.state)).toEqual(saveGame(s)); recorder.dispose(); player.dispose();
  });
  it.each([0, 1])('runs commander cleanup when a level-%s permanent bridge collapses with no reachable shore', level => {
    const s = fixture(), hero = actor(s, 0, 'core:orcs-commander', 18.5, 18.5, level), attacker = actor(s, 1, FACTIONS.orcs.units.melee.id, 17.5, 18.5, level), tile = 18 * s.width + 18;
    s.world.levels[level].terrain.fill('water'); s.world.levels[level].terrain[tile] = 'bridge'; const bridge = { id: s.nextId++, x: 18.5, y: 18.5, level, tiles: [tile], hp: 1, maxHp: 160, rebuilding: 0, repairSide: null }; s.world.bridges.push(bridge); const item = equip(s, hero); ready(s);
    const recorder = new MatchRecorder(s); expect(issueCommand(s, 1, { type: 'worldAttack', ids: [attacker.id], target: bridge.id })).toBe(true); const resumed = loadGame(saveGame(s)); advance(s, .05, .05); advance(resumed, .05, .05);
    expect(bridge.hp).toBe(0); expect(hero.hp).toBe(0); expect(item.holder).toBeUndefined(); expect(item.position?.level).toBe(level); expect(s.specialists!.artifacts).toHaveLength(2); expect(s.players[0].heroRecovery![0].availableAt).toBeCloseTo(s.time + 30); expect(s.corpses.filter(e => e.id === hero.id)).toHaveLength(1); expect(saveGame(resumed)).toEqual(saveGame(s));
    const player = new ReplayPlayer(recorder.export()); player.seek(s.tick); expect(saveGame(player.state)).toEqual(saveGame(s)); recorder.dispose(); player.dispose();
  });
  it.each([['clear', 0], ['rain', 0], ['rain', 1]] as const)('applies projectile weather=%s and high ground once on level-%s', (weather, level) => {
    const s = fixture(), gun = actor(s, 0, FACTIONS.orcs.units.siege.id, 18.5, 18.5, level), target = actor(s, 1, 'core:orcs-engineer', 25.5, 18.5, level); selectWeather(s, weather); s.world.levels[level].elevation[18 * s.width + 18] = 2; ready(s);
    const expected = unitFor(s, gun).damage * projectileEnvironment(s, gun, target).damageFactor * highGroundDamageFactor(s, gun, target) * facingDamageFactor(gun, target) - unitFor(s, target).armor, hp = target.hp;
    expect(issueCommand(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); expect(issueCommand(s, 0, { type: 'attack', ids: [gun.id], target: target.id })).toBe(true); stepGame(s, .05); expect(s.specialists!.shots![0].rawDamage).toBe(unitFor(s, gun).damage);
    advance(s, 1, .05); expect(hp - target.hp).toBeCloseTo(expected, 8); expect(target.burning?.[0].origin?.level).toBe(level);
  });
  it.each(['artifact', 'bridge', 'shot', 'fire-origin'] as const)('rejects a specialist %s position on a nonexistent third level', kind => {
    const s = fixture(), hero = actor(s, 0, 'core:orcs-commander', 18.5, 18.5), item = createArtifact(s, 'core:iron-aegis', hero), gun = actor(s, 0, FACTIONS.orcs.units.siege.id, 10.5, 18.5), target = actor(s, 1, 'core:orcs-engineer', 18.5, 19.5); ready(s);
    if (kind === 'artifact') item.position!.level = 2;
    if (kind === 'bridge') { s.specialists!.structures.push({ id: s.specialists!.nextStructureId++, kind: 'bridge', owner: 0, expires: 60, tiles: [16.5, 17.5, 18.5].map(x => ({ x, y: 22.5, level: 2, previous: 'water', placed: 'bridge' })) }); }
    if (kind === 'shot') { expect(issueCommand(s, 0, { type: 'ability', ids: [gun.id] })).toBe(true); expect(issueCommand(s, 0, { type: 'attack', ids: [gun.id], target: target.id })).toBe(true); stepGame(s, .05); s.specialists!.shots![0].source.level = 2; s.specialists!.shots![0].target.level = 2; }
    if (kind === 'fire-origin') target.burning = [{ source: gun.id, side: 0, until: 6, nextAt: 1, damage: 5, origin: { x: gun.x, y: gun.y, level: 2 } }];
    expect(() => saveGame(s)).toThrow(/level/);
  });
});
