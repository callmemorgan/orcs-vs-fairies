import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { unitFor } from '../src/core/content-registry';
import { environmentPhase } from '../src/core/environment';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { saveGame } from '../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import type { Command, Entity, GameEvent, GameState, Side } from '../src/core/types';

function command(state: GameState, side: Side, value: Command) {
  expect(issueCommand(state, side, value), JSON.stringify(value)).toBe(true);
}
function advance(state: GameState, seconds: number): GameEvent[] {
  const end = state.time + seconds, events: GameEvent[] = [];
  while (state.time + 1e-8 < end) {
    const before = state.time; stepGame(state, Math.min(.05, end - state.time)); expect(state.time).toBeGreaterThan(before);
    events.push(...state.events.map(event => ({ ...event })));
  }
  return events;
}

describe('fitted special artillery surrender with an existing world fire', () => {
  it.each([
    { label: 'continues a live cavern fire through native save and replay', lethal: false },
    { label: 'does not award stale attacker trophies when ambient fire kills the earlier victim', lethal: true },
  ])('$label after a fitted Dwarf special cannon really surrenders to Orcs', ({ lethal }) => {
    const state = createMatch({
      map: { seed: 4127, size: 'small', biome: 'forest' }, rules: { startingAge: 3, friendlyFire: false },
      players: [
        { id: 0, teamId: 0, factionId: 'dwarves', controller: 'external', handicap: { startingResources: { wood: 2000, ore: 2000, crystal: 500 } } },
        { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
        { id: 2, teamId: 2, factionId: 'fairies', controller: 'external' },
      ],
    });
    state.entities = state.entities.filter(entity => entity.role === 'hq'); state.resources = [];
    for (const [index, hq] of state.entities.entries()) { hq.x = 3.5 + index * 14; hq.y = 3.5; }
    for (const layer of state.world!.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
    Object.assign(state.world!, { revision: 0, transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 10000, seasonLength: 10000, weatherLength: 10000 });
    for (let seed = 1; seed <= 1000; seed++) { state.seed = seed; if (environmentPhase(state).weather === 'clear') break; }
    const targetPoint = { x: 23.5, y: 18.5, level: 1 };
    const timber = { id: state.nextId++, ...targetPoint, kind: 'wood' as const, amount: 500, maxAmount: 500 };
    state.resources.push(timber); state.world!.levels[1].terrain[18 * state.width + 23] = 'forest';
    function actor(side: Side, definitionId: string, x: number, y: number): Entity {
      const entity = spawnDefinition(state, side, 'unit', definitionId, x, y, 1, 1);
      entity.order = { type: 'hold' }; entity.cooldown = 100; entity.facing = 4; return entity;
    }
    const gun = actor(0, FACTIONS.dwarves.units.special.id, 18.5, 18.5);
    gun.cooldown = 0; gun.tactics!.morale = 23.5;
    const victim = actor(2, 'core:fairies-engineer', targetPoint.x, targetPoint.y);
    if (lethal) victim.hp = 60;
    // Three Orcs start outside surrender reach. Their accepted attack orders
    // approach from separate sectors and reduce morale through real damage.
    const captors = [[15, 18.5], [18.5, 15], [18.5, 22]].map(([x, y]) => actor(1, FACTIONS.orcs.units.melee.id, x, y));
    for (const captor of captors) captor.cooldown = 0;
    refreshVisibility(state); expect(unitFor(state, gun).ability).toBe('entrench');
    const recorder = new MatchRecorder(state);
    try {
      command(state, 0, { type: 'modifyArtillery', ids: [gun.id], modification: 'incendiary' });
      expect(state.players[0].wood).toBe(1975); expect(state.players[0].ore).toBe(1980);
      command(state, 0, { type: 'attack', ids: [gun.id], target: victim.id });
      command(state, 1, { type: 'attack', ids: captors.map(entity => entity.id), target: gun.id });
      advance(state, .05); expect(state.projectiles).toHaveLength(1); expect(state.specialists?.shots ?? []).toHaveLength(0);
      expect(state.projectiles![0].side).toBe(0); expect(state.projectiles![0].modification).toBe('incendiary'); expect(state.projectiles![0].from.level).toBe(1);
      expect(state.players[0].wood).toBe(1960); expect(state.players[0].ore).toBe(1975);
      const impactAt = state.projectiles![0].impactAt;
      const impactEvents = advance(state, impactAt - state.time);
      expect(gun.side).toBe(0); expect(state.world!.fires).toHaveLength(1);
      const ignition = impactEvents.filter(event => event.text === 'Incendiary shell ignited timber.');
      expect(ignition).toHaveLength(1); expect(ignition[0].side).toBe(0); expect(ignition[0].source).toBe(gun.id); expect(ignition[0].level).toBe(1);
      const paidResources = { wood: state.players[0].wood, ore: state.players[0].ore, crystal: state.players[0].crystal };
      const surrenderEvents: GameEvent[] = [], deadline = state.time + 2;
      while (gun.side === 0 && state.time < deadline) surrenderEvents.push(...advance(state, .05));
      expect(gun.side).toBe(1); expect(gun.definitionFaction).toBe('dwarves'); expect(gun.tactics!.surrenderedTo).toBe(1);
      expect(gun.factionState?.artillery).toBe('incendiary'); expect(unitFor(state, gun).id).toBe(FACTIONS.dwarves.units.special.id);
      expect(surrenderEvents.filter(event => event.source === gun.id && event.text === 'A surrounded unit surrendered')).toHaveLength(1);
      expect(state.world!.fires).toHaveLength(1); expect(state.world!.fires[0].level).toBe(1); expect(victim.hp).toBeGreaterThan(0);
      // The WorldFire schema has no owner field. Ownership is asserted on its
      // actual ignition event; the persistent fire is asserted as world state.
      // Move the new owner's entire capturing band away. They cannot supply a
      // fresh Orc attack while the victim remains in the existing world fire.
      command(state, 1, { type: 'move', ids: [gun.id, ...captors.map(entity => entity.id)], x: 12.5, y: 18.5, level: 1 });
      const file = createSessionFile(state, recorder.export()), resumed = decodeSessionFile(JSON.stringify(file)).state;
      expect(saveGame(resumed)).toEqual(saveGame(state));
      const loadedGun = resumed.entities.find(entity => entity.id === gun.id)!;
      expect(loadedGun.side).toBe(1); expect(loadedGun.definitionFaction).toBe('dwarves'); expect(loadedGun.tactics!.surrenderedTo).toBe(1); expect(loadedGun.factionState?.artillery).toBe('incendiary');
      const hp = victim.hp, wood = timber.amount, trophies = gun.factionState?.trophyKills ?? 0, xp = gun.veteran?.experience ?? 0, fury = [...state.factionSystems!.fury];
      const fireEvents: GameEvent[] = [];
      if (lethal) {
        const fireDeadline = state.time + 8;
        while (victim.hp > 0 && state.time < fireDeadline) { fireEvents.push(...advance(state, .05)); advance(resumed, .05); }
      } else { fireEvents.push(...advance(state, .5)); advance(resumed, .5); }
      expect(fireEvents.filter(event => event.text === 'Forest fire damage' && event.source === victim.id).length).toBeGreaterThan(0);
      expect(victim.hp).toBeLessThan(hp); expect(timber.amount).toBeLessThan(wood);
      if (lethal) {
        expect(victim.hp).toBe(0); expect(victim.lastAttacker).toBe(gun.id);
        const deaths = fireEvents.filter(event => event.type === 'death' && event.source === victim.id);
        expect(deaths).toHaveLength(1); expect(deaths[0].text).toBe('Forest fire damage');
        expect(fireEvents.filter(event => event.type === 'attack' && event.target === victim.id)).toHaveLength(0);
        // Environment fire has no current combat attacker. The earlier Dwarf
        // hit's stale entity ID must not become a kill for the new Orc owner.
        expect(gun.factionState?.trophyKills ?? 0).toBe(trophies);
        expect(gun.veteran?.experience ?? 0).toBe(xp); expect(state.factionSystems!.fury).toEqual(fury);
      } else expect(victim.hp).toBeGreaterThan(0);
      expect(state.world!.fires).toHaveLength(1); expect(state.world!.fires[0].x).toBe(targetPoint.x); expect(state.world!.fires[0].y).toBe(targetPoint.y); expect(state.world!.fires[0].level).toBe(1);
      expect(state.players[0].wood).toBe(paidResources.wood); expect(state.players[0].ore).toBe(paidResources.ore); expect(state.players[0].crystal).toBe(paidResources.crystal);
      expect(state.projectiles).toHaveLength(0); expect(saveGame(resumed)).toEqual(saveGame(state));
      const replay = new ReplayPlayer(recorder.export());
      try { replay.seek(state.tick); expect(saveGame(replay.state)).toEqual(saveGame(state)); } finally { replay.dispose(); }
    } finally { recorder.dispose(); }
  });
});
