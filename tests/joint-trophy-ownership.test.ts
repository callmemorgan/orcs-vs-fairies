import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { Command, Entity, GameEvent, GameState, Side, UnitRole } from '../src/core/types';

function command(s: GameState, side: Side, value: Command): void {
  refreshVisibility(s); expect(issueCommand(s, side, value), JSON.stringify(value)).toBe(true);
}
function advance(s: GameState, seconds: number): GameEvent[] {
  const end = s.time + seconds, events: GameEvent[] = [];
  while (s.time + 1e-8 < end) {
    const before = s.time; stepGame(s, Math.min(.05, end - s.time)); expect(s.time).toBeGreaterThan(before);
    events.push(...s.events.map(e => ({ ...e })));
  }
  return events;
}
function actor(s: GameState, side: Side, role: UnitRole, x: number, y: number, definitionId = FACTIONS[s.players[side].faction].units[role].id): Entity {
  const e = spawnDefinition(s, side, 'unit', definitionId, x, y, 1, 1); e.order = { type: 'hold' }; e.cooldown = 100; e.facing = 4; return e;
}

describe('historical lethal-hit ownership', () => {
  it('a real capture cannot give the new Orc owner a trophy or XP for an earlier owner’s lethal burn', () => {
    const map = generateWorldMap(4127, 'large', 3, 'temperate');
    for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); } map.sites = [];
    const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 }, players: [
      { id: 0, teamId: 0, factionId: 'orcs', controller: 'external', handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 10000 } } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
      { id: 2, teamId: 2, factionId: 'fairies', controller: 'external' },
    ] }); s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
    const gun = actor(s, 0, 'siege', 24.5, 32.5), victim = actor(s, 2, 'special', 32.5, 32.5, 'core:fairies-engineer');
    // 27 impact damage and three 5-HP burn ticks leave five HP after the four-second capture.
    victim.hp = 47; command(s, 0, { type: 'ability', ids: [gun.id] }); gun.cooldown = 0;
    command(s, 0, { type: 'attack', ids: [gun.id], target: victim.id }); advance(s, .05);
    expect(s.specialists!.shots).toHaveLength(1); command(s, 0, { type: 'stop', ids: [gun.id] }); gun.cooldown = 100;
    const raiders = [-.6, -.2, .2, .6].map(dy => actor(s, 1, 'melee', gun.x - 1.1, gun.y + dy));
    for (const raider of raiders) raider.cooldown = 0;
    command(s, 1, { type: 'attack', ids: raiders.map(e => e.id), target: gun.id }); advance(s, .05);
    expect(gun.tactics!.siegeCrew!.uncrewed).toBe(true);
    command(s, 1, { type: 'stop', ids: raiders.map(e => e.id) });
    command(s, 1, { type: 'captureSiege', ids: [raiders[1].id], target: gun.id });
    const captureDeadline = s.time + 5;
    while (gun.side === 0 && s.time < captureDeadline) advance(s, .05);
    expect(gun.side).toBe(1); expect(victim.hp).toBe(5); expect(victim.burning?.[0]).toMatchObject({ source: gun.id, side: 0 });
    // Give the captured engine a real movement order so it cannot add a new owner's shell.
    command(s, 1, { type: 'move', ids: [gun.id], x: gun.x - 4, y: gun.y, level: 1 });
    const trophies = gun.factionState?.trophyKills ?? 0, xp = gun.veteran?.experience ?? 0, fury = [...s.factionSystems!.fury];
    const resumed = loadGame(saveGame(s)), events = advance(s, 1.1); advance(resumed, 1.1);
    expect(victim.hp).toBe(0); expect(gun.factionState?.trophyKills ?? 0).toBe(trophies);
    expect(gun.veteran?.experience ?? 0).toBe(xp); expect(s.factionSystems!.fury[1]).toBeCloseTo(fury[1], 6);
    expect(s.factionSystems!.fury[0] - fury[0]).toBeCloseTo(.6, 6);
    expect(events.filter(e => e.type === 'death' && e.source === victim.id)).toHaveLength(1);
    expect(events.find(e => e.type === 'attack' && e.target === victim.id && e.source === gun.id)).toMatchObject({ side: 0, amount: 5 });
    expect(victim.lastAttacker).toBe(gun.id); expect(s.corpses.filter(c => c.id === victim.id)).toHaveLength(1);
    expect(saveGame(resumed)).toEqual(saveGame(s));
  });
});


describe('explicit lethal actor-burning credit', () => {
  it('an original Orc source receives one trophy from its own delayed lethal burn', () => {
    const map = generateWorldMap(4127, 'large', 2, 'temperate');
    for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); } map.sites = [];
    const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 }, players: [
      { id: 0, teamId: 0, factionId: 'orcs', controller: 'external', handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 10000 } } },
      { id: 1, teamId: 1, factionId: 'fairies', controller: 'external' },
    ] }); s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
    const gun = actor(s, 0, 'siege', 24.5, 32.5), victim = actor(s, 1, 'special', 32.5, 32.5, 'core:fairies-engineer');
    victim.hp = 32; command(s, 0, { type: 'ability', ids: [gun.id] }); gun.cooldown = 0;
    command(s, 0, { type: 'attack', ids: [gun.id], target: victim.id }); advance(s, .05);
    command(s, 0, { type: 'stop', ids: [gun.id] }); gun.cooldown = 100;
    advance(s, 1);
    expect(victim.hp).toBe(5); expect(victim.burning?.[0]).toMatchObject({ source: gun.id, side: 0 });
    const resumed = loadGame(saveGame(s)), events = advance(s, 1.1); advance(resumed, 1.1);
    expect(victim.hp).toBe(0); expect(gun.factionState?.trophyKills).toBe(1);
    expect(events.filter(event => event.type === 'death' && event.source === victim.id)).toHaveLength(1);
    expect(events.filter(event => event.type === 'attack' && event.target === victim.id)).toHaveLength(1);
    expect(saveGame(resumed)).toEqual(saveGame(s));
    advance(s, .5); expect(gun.factionState?.trophyKills).toBe(1);
  });
});
