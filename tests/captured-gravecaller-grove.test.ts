import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { entityDefinition } from '../src/core/content-registry';
import { FACTION_STRUCTURE_INFO } from '../src/core/faction-systems-content';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { GameState } from '../src/core/types';

// Copy into tests/. All encounter authoring precedes MatchRecorder; ownership,
// raising, Grove selection and movement then use the ordinary simulation.
function encounter(pinned = true) {
  const map = generateWorldMap(4127, 'large', 3, 'temperate');
  for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  map.sites = [];
  const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 }, players: [
    { id: 0, teamId: 0, factionId: 'undead', controller: 'external' },
    { id: 1, teamId: 1, factionId: 'fairies', controller: 'external' },
    { id: 2, teamId: 2, factionId: 'orcs', controller: 'external' },
  ] });
  s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
  const caster = spawnDefinition(s, 0, 'unit', FACTIONS.undead.units.special.id, 24.5, 32.5, 1, 1);
  caster.order = { type: 'hold' }; caster.cooldown = 100; caster.hp = caster.maxHp * .5; caster.tactics!.morale = 0;
  if (!pinned) delete caster.definitionId;
  for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, 1.2]]) {
    const captor = spawnDefinition(s, 1, 'unit', FACTIONS.fairies.units.melee.id, caster.x + dx, caster.y + dy, 1, 1);
    captor.order = { type: 'hold' }; captor.cooldown = 100;
  }
  // The corpse is within the caster's range and within four tiles of the Grove.
  // The caster and its captors are outside that Grove, so the raised troop is
  // its first eligible template. The observed cavalry triggers a real decoy.
  const corpse = { id: s.nextId++, x: 28.5, y: 32.5, level: 1, expires: 45 };
  s.corpses.push(corpse);
  const grove = spawnDefinition(s, 1, 'building', FACTION_STRUCTURE_INFO['enchanted-grove'].definition.id, 32.5, 32.5, 1, 1);
  const scout = spawnDefinition(s, 2, 'unit', FACTIONS.orcs.units.cavalry.id, 38.5, 32.5, 1, 1);
  scout.order = { type: 'hold' }; scout.cooldown = 100;
  refreshVisibility(s);
  return { s, caster, corpse, grove, scout };
}
function createRaisedDecoy(pinned = true) {
  const context = encounter(pinned), { s, caster, corpse } = context;
  const recorder = new MatchRecorder(s);
  stepGame(s, .05);
  expect(caster.side).toBe(1); expect(caster.definitionFaction).toBe('undead');
  expect(caster.tactics!.surrenderedTo).toBe(1);
  expect(s.events.some(e => e.source === caster.id && e.text === 'A surrounded unit surrendered')).toBe(true);
  expect(s.entities.filter(e => e.raised)).toHaveLength(0);
  expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(true);
  const raised = s.entities.find(e => e.raised && !e.illusion)!;
  expect(raised).toBeDefined(); expect(raised.side).toBe(1); expect(raised.definitionFaction).toBe('undead');
  expect(raised.tactics!.surrenderedTo).toBeUndefined();
  expect(entityDefinition(s, raised).id).toBe(FACTIONS.undead.units.melee.id);
  expect(raised.maxHp).toBe(FACTIONS.undead.units.melee.hp); expect(raised.hp).toBe(raised.maxHp * .5);
  expect(raised.expires).toBe(s.time + 35);
  expect(s.corpses.some(body => body.id === corpse.id)).toBe(false);
  stepGame(s, .05);
  const clone = s.entities.find(e => e.raised && e.illusion)!;
  expect(clone).toBeDefined(); expect(clone.side).toBe(1); expect(clone.definitionFaction).toBe('undead');
  expect(clone.tactics!.surrenderedTo).toBeUndefined();
  expect(entityDefinition(s, clone).id).toBe(FACTIONS.undead.units.melee.id);
  expect(clone.maxHp).toBe(FACTIONS.undead.units.melee.hp * .4); expect(clone.expires).toBe(s.time + 15);
  expect(s.events.some(e => e.source === context.grove.id && e.text === 'Grove sent a decoy toward an observed scout')).toBe(true);
  return { ...context, raised, clone, recorder };
}
function compareContinuation(s: GameState, seconds: number): void {
  const restored = loadGame(saveGame(s)); expect(saveGame(restored)).toEqual(saveGame(s));
  const end = s.time + seconds;
  while (s.time + 1e-8 < end) { const dt = Math.min(.05, end - s.time); stepGame(s, dt); stepGame(restored, dt); }
  expect(saveGame(restored)).toEqual(saveGame(s));
}

describe('captured Gravecaller summons and raised Grove decoys', () => {
  it.each([true, false])('preserves original summon and decoy definitions through native/save/replay (pinned %s)', pinned => {
    const { s, raised, clone, recorder } = createRaisedDecoy(pinned);
    try {
      expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
      compareContinuation(s, .5);
      expect(s.entities.find(e => e.id === raised.id)!.hp).toBeGreaterThan(0);
      expect(s.entities.find(e => e.id === clone.id)!.hp).toBeGreaterThan(0);
      const archive = recorder.export(), replay = new ReplayPlayer(archive);
      try { replay.seek(s.tick); expect(saveGame(replay.state)).toEqual(saveGame(s)); expect(replayChecksum(replay.state)).toBe(archive.finalChecksum); }
      finally { replay.dispose(); }
    } finally { recorder.dispose(); }
  });

  it.each(['immortal', 'long-lived', 'wrong-capacity', 'ordinary-marker'] as const)('rejects a forged raised troop: %s', mutation => {
    const { s, raised, recorder } = createRaisedDecoy(); recorder.dispose();
    const saved = saveGame(s), forged = saved.state.entities.find(e => e.id === raised.id)!;
    if (mutation === 'immortal') forged.expires = 0;
    else if (mutation === 'long-lived') forged.expires = s.time + 36;
    else if (mutation === 'wrong-capacity') forged.maxHp += 1;
    else delete forged.raised;
    expect(() => loadGame(saved)).toThrow(/raised|maxHp|definitionFaction/);
  });

  it.each(['long-lived', 'wrong-capacity', 'surrender-marker'] as const)('rejects a forged raised Grove decoy: %s', mutation => {
    const { s, clone, recorder } = createRaisedDecoy(); recorder.dispose();
    const saved = saveGame(s), forged = saved.state.entities.find(e => e.id === clone.id)!;
    if (mutation === 'long-lived') forged.expires = s.time + 16;
    else if (mutation === 'wrong-capacity') forged.maxHp += 1;
    else forged.tactics!.surrenderedTo = forged.side;
    expect(() => loadGame(saved)).toThrow(/raised|maxHp|surrenderedTo/);
  });
});
