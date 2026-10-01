import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { entityDefinition } from '../src/core/content-registry';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import type { SaveEnvelope } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { Entity, UnitDef } from '../src/core/types';

function encounter(pinned: boolean) {
  const map = generateWorldMap(4127, 'large', 2, 'temperate');
  for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  map.sites = [];
  const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 }, players: [
    { id: 0, teamId: 0, factionId: 'undead', controller: 'external' },
    { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
  ] });
  s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
  const caster = spawnDefinition(s, 0, 'unit', FACTIONS.undead.units.special.id, 24.5, 32.5, 1, 1);
  caster.order = { type: 'hold' }; caster.cooldown = 100;
  if (!pinned) delete caster.definitionId;
  caster.hp = caster.maxHp * .5; caster.tactics!.morale = 0;
  for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, 1.2]]) {
    const captor = spawnDefinition(s, 1, 'unit', FACTIONS.orcs.units.melee.id, caster.x + dx, caster.y + dy, 1, 1);
    captor.order = { type: 'hold' }; captor.cooldown = 100;
  }
  // Author the corpse before recording; all later changes use public commands.
  s.corpses.push({ id: s.nextId++, x: caster.x + .5, y: caster.y, level: caster.level, expires: s.time + 45 });
  refreshVisibility(s); const recorder = new MatchRecorder(s);
  stepGame(s, .05);
  expect(caster.side).toBe(1); expect(caster.definitionFaction).toBe('undead');
  expect(caster.tactics!.surrenderedTo).toBe(1);
  expect(s.events.some(e => e.source === caster.id && e.text === 'A surrounded unit surrendered')).toBe(true);
  expect(entityDefinition(s, caster)).toEqual(FACTIONS.undead.units.special);
  expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
  expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(true);
  const raised = s.entities.find(e => e.raised)!;
  expect(raised).toBeDefined();
  return { s, caster, raised, recorder };
}

describe('captured Gravecaller preserves its original raised fighter definition', () => {
  it.each([true, false])('surrender, public raise, native continuation and replay (pinned %s)', pinned => {
    const { s, caster, raised, recorder } = encounter(pinned);
    try {
      expect(raised.side).toBe(1); expect(raised.definitionFaction).toBe('undead');
      expect(entityDefinition(s, raised)).toEqual(FACTIONS.undead.units.melee);
      expect((entityDefinition(s, raised) as UnitDef).damage).toBe(FACTIONS.undead.units.melee.damage);
      expect(raised.maxHp).toBe(FACTIONS.undead.units.melee.hp);
      expect(raised.hp).toBe(raised.maxHp * .5); expect(raised.level).toBe(1);
      expect(raised.tactics!.surrenderedTo).toBeUndefined();
      expect(raised.expires).toBe(s.time + 35); expect(s.corpses).toHaveLength(0);
      expect(issueCommand(s, 1, { type: 'hold', ids: [caster.id, raised.id] })).toBe(true);
      const resumed = loadGame(saveGame(s)); expect(saveGame(resumed)).toEqual(saveGame(s));
      // Continue through actual expiry and central death cleanup.
      let sawDeath = false;
      while (s.time < raised.expires + .1) {
        stepGame(s, .05); stepGame(resumed, .05);
        sawDeath ||= s.events.some(e => e.type === 'death' && e.source === raised.id);
      }
      expect(s.entities.find(e => e.id === raised.id)?.hp ?? 0).toBe(0);
      expect(sawDeath).toBe(true);
      expect(s.corpses.some(e => e.id === raised.id)).toBe(false);
      expect(saveGame(resumed)).toEqual(saveGame(s));
      expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
      const replay = new ReplayPlayer(recorder.export());
      try { replay.seek(s.tick); expect(saveGame(replay.state)).toEqual(saveGame(s)); } finally { replay.dispose(); }
    } finally { recorder.dispose(); }
  });

  it.each([
    ['origin without a raising ability', (e: Entity) => { e.definitionFaction = 'orcs'; e.definitionId = FACTIONS.orcs.units.melee.id; e.maxHp = FACTIONS.orcs.units.melee.hp; }],
    ['worker summon', (e: Entity) => { e.role = 'worker'; e.definitionId = FACTIONS.undead.units.worker.id; e.maxHp = FACTIONS.undead.units.worker.hp; e.hp = e.maxHp; }],
    ['inflated capacity', (e: Entity) => { e.maxHp++; }],
    ['extended lifetime', (e: Entity, saved: SaveEnvelope) => { e.expires = saved.state.time + 36; }],
    ['permanent summon', (e: Entity) => { e.expires = 0; }],
    ['illusion marked raised', (e: Entity) => { e.illusion = true; }],
    ['absent original faction', (e: Entity) => { e.definitionFaction = 'fairies'; }],
  ] as const)('rejects forged %s', (_name, corrupt) => {
    const { s, raised, recorder } = encounter(true);
    try {
      const saved = saveGame(s); corrupt(saved.state.entities.find(e => e.id === raised.id)!, saved);
      expect(() => loadGame(saved)).toThrow(/raised|definitionFaction|maxHp|definitionId/);
    } finally { recorder.dispose(); }
  });
});
