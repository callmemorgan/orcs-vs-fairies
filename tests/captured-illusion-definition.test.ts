import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { entityDefinition } from '../src/core/content-registry';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';

// Copy into tests/ to run. This uses actual surrender and the public ability
// command; it does not call private ability code or manually change ownership.
export function probeCapturedIllusions(pinned: boolean) {
  const map = generateWorldMap(4127, 'large', 2, 'temperate');
  for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  map.sites = [];
  const s = createMatch({ map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 }, players: [
    { id: 0, teamId: 0, factionId: 'fairies', controller: 'external' },
    { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
  ] });
  s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
  const caster = spawnDefinition(s, 0, 'unit', FACTIONS.fairies.units.special.id, 24.5, 32.5, 1, 1);
  caster.order = { type: 'hold' }; caster.cooldown = 100;
  if (!pinned) delete caster.definitionId;
  caster.hp = caster.maxHp * .5; caster.tactics!.morale = 0;
  for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, 1.2]]) {
    const captor = spawnDefinition(s, 1, 'unit', FACTIONS.orcs.units.melee.id, caster.x + dx, caster.y + dy, 1, 1);
    captor.order = { type: 'hold' }; captor.cooldown = 100;
  }
  refreshVisibility(s); const recorder = new MatchRecorder(s); stepGame(s, .05);
  expect(caster.side).toBe(1); expect(caster.definitionFaction).toBe('fairies');
  expect(caster.tactics!.surrenderedTo).toBe(1);
  expect(s.events.some(e => e.source === caster.id && e.text === 'A surrounded unit surrendered')).toBe(true);
  expect(entityDefinition(s, caster)).toEqual(FACTIONS.fairies.units.special);
  expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));

  const nextIdBefore = s.nextId;
  let accepted: boolean | undefined, error: string | undefined;
  try { accepted = issueCommand(s, 1, { type: 'ability', ids: [caster.id] }); }
  catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
  const clones = s.entities.filter(e => e.illusion);
  const result = {
    pinned, caster: { side: caster.side, definitionId: caster.definitionId, definitionFaction: caster.definitionFaction, ability: FACTIONS.fairies.units.special.ability },
    accepted, error, nextIdBefore, nextIdAfter: s.nextId,
    clones: clones.map(e => ({ id: e.id, side: e.side, definitionId: e.definitionId, definitionFaction: e.definitionFaction, maxHp: e.maxHp, resolvedDefinition: entityDefinition(s, e).id })),
  };
  return { s, caster, clones, result, recorder };
}

describe('captured Fairy caster uses its original illusion definition', () => {
  it.each([true, false])('preserves original clone identity after actual surrender (pinned %s)', pinned => {
    const { s, clones, result, recorder } = probeCapturedIllusions(pinned);
    try {
    expect(result.error).toBeUndefined(); expect(result.accepted).toBe(true); expect(clones).toHaveLength(2);
    for (const clone of clones) {
      expect(clone.side).toBe(1); expect(clone.definitionFaction).toBe('fairies');
      expect(entityDefinition(s, clone).id).toBe(FACTIONS.fairies.units.special.id);
      expect(clone.maxHp).toBe(FACTIONS.fairies.units.special.hp * .4);
    }
    const resumed = loadGame(saveGame(s)); expect(saveGame(resumed)).toEqual(saveGame(s));
    for (let i = 0; i < 10; i++) { stepGame(s, .05); stepGame(resumed, .05); }
    expect(saveGame(resumed)).toEqual(saveGame(s));
    const replay = new ReplayPlayer(recorder.export());
    try { replay.seek(s.tick); expect(saveGame(replay.state)).toEqual(saveGame(s)); } finally { replay.dispose(); }
    } finally { recorder.dispose(); }
  });
});
