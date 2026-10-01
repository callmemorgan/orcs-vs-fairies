import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { BuiltinFactionId, Command, Entity, GameEvent, GameState } from '../src/core/types';

function command(s: GameState, value: Command): void {
  refreshVisibility(s); expect(issueCommand(s, 0, value), JSON.stringify(value)).toBe(true);
}
function advance(s: GameState, seconds: number): GameEvent[] {
  const end = s.time + seconds, events: GameEvent[] = [];
  while (s.time + 1e-8 < end) {
    const before = s.time; stepGame(s, Math.min(.05, end - s.time)); expect(s.time).toBeGreaterThan(before);
    events.push(...s.events.map(e => ({ ...e })));
  }
  return events;
}
function engine(s: GameState, x: number, y: number): Entity {
  const e = spawnDefinition(s, 0, 'unit', FACTIONS[s.players[0].faction].units.siege.id, x, y, 1, 1);
  e.order = { type: 'hold' }; e.cooldown = 100; e.facing = 4; return e;
}

describe('explicit fire on an allied crewless engine', () => {
  it.each(['orcs', 'dwarves'] as BuiltinFactionId[])('%s keeps the neutral-engine target exception with friendly fire disabled', faction => {
    const map = generateWorldMap(4127, 'large', 2, 'temperate');
    for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); } map.sites = [];
    const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3, friendlyFire: false }, players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 10000 } } },
      { id: 1, teamId: 1, factionId: 'fairies', controller: 'external' },
    ] }); s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
    const gun = engine(s, 24.5, 32.5), abandoned = engine(s, 32.5, 32.5), crewedAlly = engine(s, 32.5, 33.7);
    // This is an authored abandoned engine, admitted by the normal target validator.
    abandoned.tactics!.siegeCrew!.hp = 0; abandoned.tactics!.siegeCrew!.uncrewed = true;
    const abandonedHp = abandoned.hp, allyHp = crewedAlly.hp, xp = gun.veteran?.experience ?? 0;
    const fury = s.factionSystems!.fury[0], ore = s.players[0].ore;
    if (faction === 'dwarves') { command(s, { type: 'ability', ids: [gun.id] }); expect(gun.siegeMode!.ammo).toBe(5); }
    gun.cooldown = 0; command(s, { type: 'attack', ids: [gun.id], target: abandoned.id }); advance(s, .05);
    expect(abandoned.hp).toBe(abandonedHp);
    expect((s.projectiles?.length ?? 0) + (s.specialists?.shots?.length ?? 0)).toBe(1);
    if (faction === 'dwarves') { expect(gun.siegeMode!.ammo).toBe(4); expect(s.players[0].ore).toBe(ore - 15); }
    command(s, { type: 'stop', ids: [gun.id] }); gun.cooldown = 100;
    const resumed = loadGame(saveGame(s)), events = advance(s, 1.05); advance(resumed, 1.05);
    expect(abandoned.hp).toBeLessThan(abandonedHp); expect(crewedAlly.hp).toBe(allyHp);
    expect(events.filter(e => e.type === 'attack' && e.target === abandoned.id && e.source === gun.id)).toHaveLength(1);
    expect(events.some(e => e.type === 'attack' && e.target === crewedAlly.id && e.source === gun.id)).toBe(false);
    expect(gun.veteran?.experience ?? 0).toBe(xp); expect(s.factionSystems!.fury[0]).toBe(fury);
    expect(saveGame(resumed)).toEqual(saveGame(s));
  });
});
