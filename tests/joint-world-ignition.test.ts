import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { unitFor } from '../src/core/content-registry';
import { environmentPhase } from '../src/core/environment';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { saveGame } from '../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import type { BuiltinFactionId, Command, GameEvent, GameState, Side, UnitRole } from '../src/core/types';
import type { WorldState } from '../src/core/world-types';

type LayeredState = GameState & { world: WorldState };
type Weapon = { label: string; faction: BuiltinFactionId; role: 'siege' | 'special'; prepared: boolean; specialist: boolean };
const weapons: Weapon[] = [
  { label: 'prepared Orc incendiary payload', faction: 'orcs', role: 'siege', prepared: true, specialist: true },
  { label: 'fitted loaded Dwarf siege cannon', faction: 'dwarves', role: 'siege', prepared: false, specialist: true },
  { label: 'fitted Dwarf special entrench artillery', faction: 'dwarves', role: 'special', prepared: false, specialist: false },
];
const point = { x: 24.5, y: 18.5 };
const funds = { wood: 2000, ore: 2000, crystal: 500 };

function fixture(faction: BuiltinFactionId, role: UnitRole, level: number) {
  const state = createMatch({
    map: { seed: 4127, size: 'small', biome: 'forest' },
    rules: { startingAge: 3, friendlyFire: false },
    players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: funds } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
    ],
  }) as LayeredState;
  state.entities = state.entities.filter(e => e.role === 'hq');
  for (const hq of state.entities) { hq.x = hq.side === 0 ? 2.5 : 33.5; hq.y = hq.side === 0 ? 2.5 : 33.5; }
  for (const layer of state.world.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  state.world.levels[0].terrain = state.terrain;
  Object.assign(state.world, { revision: 0, transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 10000, seasonLength: 10000, weatherLength: 10000 });
  // Authored weather keeps fire behavior stable on the surface as well as below.
  for (let seed = 1; seed <= 1000; seed++) { state.seed = seed; if (environmentPhase(state).weather === 'clear') break; }
  expect(environmentPhase(state).weather).toBe('clear');
  state.resources = [0, 1].map(layer => ({ id: state.nextId++, kind: 'wood' as const, ...point, level: layer, amount: 1, maxAmount: 1 }));
  const tile = Math.floor(point.y) * state.width + Math.floor(point.x);
  for (const layer of state.world.levels) layer.terrain[tile] = 'forest';
  function actor(side: Side, definitionId: string, x: number, y: number, atLevel: number) {
    const entity = spawnDefinition(state, side, 'unit', definitionId, x, y, 1, atLevel);
    entity.order = { type: 'hold' }; entity.cooldown = side === 0 ? 0 : 100; entity.facing = 4;
    return entity;
  }
  const gun = actor(0, FACTIONS[faction].units[role].id, point.x - (role === 'special' ? 5 : 6), point.y, level);
  const target = actor(1, 'core:orcs-engineer', point.x, point.y, level);
  const mirror = actor(1, 'core:orcs-engineer', point.x, point.y, 1 - level);
  refreshVisibility(state);
  expect(state.world.biome).toBe('forest'); expect(state.world.levels.length).toBe(2);
  expect(() => createSessionFile(state)).not.toThrow();
  return { state, gun, target, mirror, tile, timber: state.resources.find(n => n.level === level)!, mirrorTimber: state.resources.find(n => n.level !== level)! };
}

function command(state: GameState, side: Side, value: Command) {
  refreshVisibility(state); expect(issueCommand(state, side, value), JSON.stringify(value)).toBe(true);
}
function advance(state: GameState, seconds: number): GameEvent[] {
  const deadline = state.time + seconds, events: GameEvent[] = [];
  while (state.time + 1e-8 < deadline) {
    const before = state.time; stepGame(state, Math.min(.05, deadline - state.time));
    expect(state.time, 'Both headquarters must survive the authored encounter').toBeGreaterThan(before);
    events.push(...state.events.map(event => ({ ...event })));
  }
  return events;
}
function restoredSession(state: GameState, recorder?: MatchRecorder) {
  // Use the native session envelope, not a hand-built clone of world or shots.
  const file = createSessionFile(state, recorder?.export());
  return decodeSessionFile(JSON.stringify(file)).state as LayeredState;
}
function pendingCount(state: GameState) { return (state.specialists?.shots?.length ?? 0) + (state.projectiles?.length ?? 0); }
function bank(state: GameState) { const player = state.players[0]; return { wood: player.wood, ore: player.ore, crystal: player.crystal }; }

describe('incendiary weapon impacts ignite the layered world through public commands', () => {
  it.each(weapons.flatMap(weapon => [0, 1].map(level => ({ ...weapon, level }))))('$label ignites level $level timber once and continues through native saves', weapon => {
    const { state, gun, target, mirror, tile, timber, mirrorTimber } = fixture(weapon.faction, weapon.role, weapon.level);
    const originalTargetHp = target.hp, originalMirrorHp = mirror.hp;
    if (weapon.role === 'special') expect(unitFor(state, gun).ability).toBe('entrench');
    const recorder = new MatchRecorder(state);
    try {
      if (weapon.prepared) {
        command(state, 0, { type: 'ability', ids: [gun.id] });
        expect(gun.siegeMode?.prepared).toBe('incendiary');
        expect(bank(state)).toEqual({ wood: funds.wood - 8, ore: funds.ore, crystal: funds.crystal });
      } else {
        if (weapon.role === 'siege') {
          command(state, 0, { type: 'ability', ids: [gun.id] });
          expect(gun.siegeMode?.ammo).toBe(5); expect(gun.siegeMode?.deployed).toBe(true);
          expect(bank(state)).toEqual({ wood: funds.wood, ore: funds.ore - 15, crystal: funds.crystal });
        }
        const beforeFitting = bank(state);
        command(state, 0, { type: 'modifyArtillery', ids: [gun.id], modification: 'incendiary' });
        expect(gun.factionState?.artillery).toBe('incendiary');
        expect(bank(state)).toEqual({ wood: beforeFitting.wood - 25, ore: beforeFitting.ore - 20, crystal: beforeFitting.crystal });
      }
      const beforeLaunch = bank(state);
      expect(state.world.fires).toHaveLength(0);
      command(state, 0, { type: 'attack', ids: [gun.id], target: target.id });
      advance(state, .05);
      expect(pendingCount(state)).toBe(1); expect(target.hp).toBe(originalTargetHp); expect(state.world.fires).toHaveLength(0);
      if (weapon.specialist) {
        expect(state.projectiles).toHaveLength(0); expect(state.specialists!.shots!).toHaveLength(1);
        expect(state.specialists!.shots![0].source.level).toBe(weapon.level);
        expect(state.specialists!.shots![0].target.level).toBe(weapon.level);
        expect(state.specialists!.shots![0].payload.kind).toBe(weapon.prepared ? 'incendiary' : 'cannon');
        if (weapon.prepared) expect(gun.siegeMode?.prepared).toBeUndefined();
        else { expect(state.specialists!.shots![0].modification).toBe('incendiary'); expect(gun.siegeMode?.ammo).toBe(4); }
      } else {
        expect(state.specialists?.shots ?? []).toHaveLength(0); expect(state.projectiles!).toHaveLength(1);
        expect(state.projectiles![0].modification).toBe('incendiary'); expect(state.projectiles![0].level).toBe(weapon.level);
        expect(state.projectiles![0].from.level).toBe(weapon.level); expect(gun.siegeMode).toBeUndefined();
      }
      expect(bank(state)).toEqual(weapon.prepared ? beforeLaunch : { wood: beforeLaunch.wood - 15, ore: beforeLaunch.ore - 5, crystal: beforeLaunch.crystal });
      const paidBank = bank(state), impactAt = weapon.specialist ? state.specialists!.shots![0].impactAt : state.projectiles![0].impactAt;
      // Stop the public attack order while the paid shell remains in flight. Its
      // weapon cooldown exceeds this proof's duration, so only one shot can fire.
      command(state, 0, { type: 'stop', ids: [gun.id] });
      const resumed = restoredSession(state, recorder);
      expect(saveGame(resumed)).toEqual(saveGame(state));
      advance(state, .2); advance(resumed, .2);
      expect(state.world.fires).toHaveLength(0); expect(resumed.world.fires).toHaveLength(0);
      expect(target.hp).toBe(originalTargetHp); expect(pendingCount(state)).toBe(1);

      const toImpact = impactAt - state.time;
      const impacts = advance(state, toImpact); const resumedImpacts = advance(resumed, toImpact);
      expect(pendingCount(state)).toBe(0); expect(target.hp).toBeLessThan(originalTargetHp);
      expect(state.world.fires).toHaveLength(1);
      expect(state.world.fires[0].x).toBe(point.x); expect(state.world.fires[0].y).toBe(point.y); expect(state.world.fires[0].level).toBe(weapon.level);
      for (const events of [impacts, resumedImpacts]) {
        const ignitions = events.filter(event => event.text === 'Incendiary shell ignited timber.');
        expect(ignitions).toHaveLength(1); expect(ignitions[0].source).toBe(gun.id); expect(ignitions[0].side).toBe(0); expect(ignitions[0].level).toBe(weapon.level);
      }
      expect(mirror.hp).toBe(originalMirrorHp); expect(mirrorTimber.amount).toBe(1); expect(state.world.levels[1 - weapon.level].terrain[tile]).toBe('forest');
      expect(bank(state)).toEqual(paidBank); expect(saveGame(resumed)).toEqual(saveGame(state));

      // A second native checkpoint proves continuation of the world fire itself,
      // independently of the projectile and its unit burning status effect.
      const burningResume = restoredSession(state), hpAfterImpact = target.hp;
      const fireEvents = advance(state, .25); advance(resumed, .25); advance(burningResume, .25);
      expect(fireEvents.filter(event => event.text === 'Forest fire damage' && event.source === target.id).length).toBeGreaterThan(0);
      expect(target.hp).toBeLessThan(hpAfterImpact); expect(timber.amount).toBe(0); expect(state.world.levels[weapon.level].terrain[tile]).toBe('grass');
      expect(state.world.fires).toHaveLength(1); expect(state.world.fires[0].heat).toBeLessThan(1);
      expect(mirror.hp).toBe(originalMirrorHp); expect(mirrorTimber.amount).toBe(1); expect(state.world.levels[1 - weapon.level].terrain[tile]).toBe('forest');
      expect(state.world.fires.filter(fire => fire.level !== weapon.level)).toHaveLength(0); expect(bank(state)).toEqual(paidBank);
      if (weapon.faction === 'dwarves' && weapon.role === 'siege') expect(gun.siegeMode?.ammo).toBe(4);
      expect(saveGame(resumed)).toEqual(saveGame(state)); expect(saveGame(burningResume)).toEqual(saveGame(state));
      const replay = new ReplayPlayer(recorder.export());
      try { replay.seek(state.tick); expect(saveGame(replay.state)).toEqual(saveGame(state)); } finally { replay.dispose(); }
    } finally { recorder.dispose(); }
  });
});
