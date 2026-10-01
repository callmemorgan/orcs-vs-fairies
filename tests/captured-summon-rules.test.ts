import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { contentHash, createContentBundle, entityDefinition } from '../src/core/content-registry';
import type { ContentBundle } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { FACTION_STRUCTURE_INFO } from '../src/core/faction-systems-content';
import { definitionAllowed } from '../src/core/match-rules';
import { checksumSaveEnvelope, decodeOriginalSaveEnvelope, decodeSaveSource, loadGame, saveGame } from '../src/core/saves';
import type { SaveEnvelope } from '../src/core/saves';
import { captureRuntime, createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { Entity, FactionId, GameState, MatchRulesInput } from '../src/core/types';

type Restriction = 'disabled' | 'banned' | 'unpicked';
const restrictions: Restriction[] = ['disabled', 'banned', 'unpicked'];

function restrictedRules(origin: 'undead' | 'fairies' | 'orcs', target: string, restriction: Restriction, owner: 'orcs' | 'fairies' = 'orcs') {
  if (restriction === 'disabled') return { rules: { disabledDefinitionIds: [target] } as MatchRulesInput, choices: [] };
  const originPick = restriction === 'unpicked' ? target : target === FACTIONS[origin].units.melee.id ? FACTIONS[origin].units.special.id : FACTIONS[origin].units.melee.id;
  return {
    rules: { draft: { enabled: true, banRounds: restriction === 'banned' ? 1 : 0, pickRounds: 1 } } as MatchRulesInput,
    choices: [...(restriction === 'banned' ? [target, FACTIONS[owner].units.ranged.id] : []), originPick, FACTIONS[owner].units.melee.id],
  };
}

interface EncounterOptions {
  origin: FactionId;
  casterId: string;
  owner?: 'undead' | 'orcs' | 'fairies';
  pinned?: boolean;
  rules?: MatchRulesInput;
  choices?: string[];
  content?: ContentBundle;
  corpse?: boolean;
  grove?: boolean;
}

function encounter({ origin, casterId, owner = 'orcs', pinned = true, rules = {}, choices = [], content, corpse = false, grove = false }: EncounterOptions) {
  const map = generateWorldMap(4127, 'large', 2, 'temperate');
  for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  map.sites = [];
  const s = createMatch({ ...(content ? { content } : {}), map: { seed: map.seed, size: map.size, world: map }, rules: { ...rules, startingAge: 3 }, players: [
    { id: 0, teamId: 0, factionId: origin, controller: 'external' },
    { id: 1, teamId: 1, factionId: owner, controller: 'external' },
  ] });
  for (const definitionId of choices) {
    const side = s.draft.order[s.draft.turn].side;
    expect(issueCommand(s, side, { type: 'draftChoice', definitionId })).toBe(true);
  }
  expect(s.draft.status).toBe('complete');
  s.entities = s.entities.filter(e => e.role === 'hq');
  s.resources = [];
  const caster = spawnDefinition(s, 0, 'unit', casterId, grove ? 28.5 : 24.5, 32.5, 1, 1);
  caster.order = { type: 'hold' }; caster.cooldown = 100;
  caster.hp = caster.maxHp * .5; caster.tactics!.morale = 0;
  if (!pinned) delete caster.definitionId;
  const offsets = grove ? [[-1.2, 0], [.05, 1.2], [.05, -1.2]] : [[-1.2, 0], [1.2, 0], [0, 1.2]];
  for (const [dx, dy] of offsets) {
    const captor = spawnDefinition(s, 1, 'unit', FACTIONS[owner].units.spear.id, caster.x + dx, caster.y + dy, 1, 1);
    captor.order = { type: 'hold' }; captor.cooldown = 100;
  }
  if (corpse) s.corpses.push({ id: s.nextId++, x: caster.x + .5, y: caster.y, level: caster.level, expires: 45 });
  let groveEntity: Entity | undefined;
  if (grove) {
    groveEntity = spawnDefinition(s, 1, 'building', FACTION_STRUCTURE_INFO['enchanted-grove'].definition.id, 32.5, 32.5, 1, 1);
    const scout = spawnDefinition(s, 0, 'unit', FACTIONS.orcs.units.cavalry.id, 38.5, 32.5, 1, 1);
    scout.order = { type: 'hold' }; scout.cooldown = 100;
  }
  refreshVisibility(s);
  stepGame(s, .05);
  expect(caster.side).toBe(1);
  expect(caster.definitionFaction).toBe(origin);
  expect(caster.tactics!.surrenderedTo).toBe(1);
  expect(s.events.some(e => e.source === caster.id && e.text === 'A surrounded unit surrendered')).toBe(true);
  expect(entityDefinition(s, caster).id).toBe(casterId);
  expect(s.entities.some(e => e.raised || e.illusion)).toBe(false);
  return { s, caster, grove: groveEntity };
}

function expectRoundTrip(s: GameState) {
  const saved = saveGame(s), restored = loadGame(saved);
  expect(saveGame(restored)).toEqual(saved);
  return restored;
}

function expectHistoricalInspectionOnly(saved: SaveEnvelope) {
  // Synthetic SAVE3 admission case; the genuine old producer is covered by save4-corpus.
  const historical = { ...structuredClone(saved), version: 3 as const }, before = JSON.stringify(historical);
  const original = decodeOriginalSaveEnvelope(historical);
  expect(JSON.stringify(original)).toBe(before);
  expect(checksumSaveEnvelope(original)).toBe(checksumSaveEnvelope(historical));
  expect(() => loadGame(original)).toThrow('Legacy summoned definition is prohibited');
  expect(() => decodeSaveSource(original)).toThrow('available for inspection but cannot resume');
  expect(JSON.stringify(historical)).toBe(before);
}

function expectAbilityBlocked(s: GameState, caster: Entity) {
  const saved = saveGame(s), abilities = captureRuntime(s).abilities;
  expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(false);
  expect(saveGame(s)).toEqual(saved);
  expect(captureRuntime(s).abilities).toEqual(abilities);
  expect(caster.abilityReadyAt).toBeUndefined();
}

function raiseCaptured(pinned = true, rules: MatchRulesInput = {}) {
  const result = encounter({ origin: 'undead', casterId: FACTIONS.undead.units.special.id, pinned, rules, corpse: true });
  expect(issueCommand(result.s, 1, { type: 'ability', ids: [result.caster.id] })).toBe(true);
  const raised = result.s.entities.find(e => e.raised)!;
  expect(raised).toBeDefined();
  return { ...result, raised };
}

describe('captured summons obey the current owner rules for their original definitions', () => {
  it.each(restrictions)('blocks a captured Gravecaller when its original melee is %s', restriction => {
    for (const pinned of [true, false]) {
      const policy = restrictedRules('undead', FACTIONS.undead.units.melee.id, restriction);
      const { s, caster } = encounter({ origin: 'undead', casterId: FACTIONS.undead.units.special.id, pinned, corpse: true, ...policy });
      expect(definitionAllowed(s, 1, FACTIONS.orcs.units.melee.id)).toBe(true);
      expect(definitionAllowed(s, 1, FACTIONS.undead.units.melee.id)).toBe(false);
      if (restriction === 'unpicked') expect(definitionAllowed(s, 0, FACTIONS.undead.units.melee.id)).toBe(true);
      expectAbilityBlocked(s, caster);
      expect(s.corpses).toHaveLength(1);
      expectRoundTrip(s);
    }
  });

  it.each([true, false])('raises the original melee when the new owner melee is excluded (pinned %s)', pinned => {
    const { s, caster, raised } = raiseCaptured(pinned, { disabledDefinitionIds: [FACTIONS.orcs.units.melee.id] });
    expect(definitionAllowed(s, 1, FACTIONS.orcs.units.melee.id)).toBe(false);
    expect(raised).toMatchObject({ side: 1, definitionId: FACTIONS.undead.units.melee.id, definitionFaction: 'undead', level: 1, maxHp: FACTIONS.undead.units.melee.hp, hp: FACTIONS.undead.units.melee.hp * .5, expires: s.time + 35 });
    expect(entityDefinition(s, raised).id).toBe(FACTIONS.undead.units.melee.id);
    expect(s.corpses).toHaveLength(0);
    expect(caster.abilityReadyAt).toBe(s.time + 22);
    expect(issueCommand(s, 1, { type: 'hold', ids: [caster.id, raised.id] })).toBe(true);
    const resumed = expectRoundTrip(s);
    expect(resumed.entities.find(e => e.id === raised.id)!.definitionId).toBe(FACTIONS.undead.units.melee.id);
    for (let i = 0; i < 10; i++) { stepGame(s, .05); stepGame(resumed, .05); }
    expect(saveGame(resumed)).toEqual(saveGame(s));
  });

  it('raises an admitted alternative from the captured caster original faction and preserves its ID', () => {
    const mod = structuredClone(exampleMod());
    mod.factions[0].units.find(unit => unit.id === 'lantern:duelist')!.ability = 'raise';
    const { hash: _hash, ...body } = mod; mod.hash = contentHash(body);
    const { s, caster } = encounter({ origin: 'lantern:keepers', casterId: 'lantern:duelist', content: createContentBundle([mod]), rules: { disabledDefinitionIds: ['lantern:sentinel'] }, corpse: true });
    expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(true);
    const raised = s.entities.find(e => e.raised)!;
    expect(raised).toMatchObject({ definitionId: 'lantern:duelist', definitionFaction: 'lantern:keepers', side: 1, maxHp: 110, hp: 55 });
    expect(entityDefinition(s, raised).id).toBe('lantern:duelist');
    expect(expectRoundTrip(s).entities.find(e => e.id === raised.id)!.definitionId).toBe('lantern:duelist');
  });

  it('permits a captured Gravecaller whose new owner drafted the original melee', () => {
    const { s, caster } = encounter({ origin: 'undead', owner: 'undead', casterId: FACTIONS.undead.units.special.id, corpse: true, rules: { draft: { enabled: true, banRounds: 0, pickRounds: 1 } }, choices: [FACTIONS.undead.units.special.id, FACTIONS.undead.units.melee.id] });
    expect(definitionAllowed(s, 0, FACTIONS.undead.units.melee.id)).toBe(false);
    expect(definitionAllowed(s, 1, FACTIONS.undead.units.melee.id)).toBe(true);
    expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(true);
    const raised = s.entities.find(e => e.raised)!;
    expect(raised).toMatchObject({ side: 1, definitionId: FACTIONS.undead.units.melee.id, definitionFaction: 'undead' });
    expect(expectRoundTrip(s).entities.find(e => e.id === raised.id)!.definitionId).toBe(FACTIONS.undead.units.melee.id);
  });

  it.each(restrictions)('rejects saved captured raises whose original melee becomes %s', restriction => {
    const { s } = raiseCaptured(), saved = saveGame(s);
    const policy = restrictedRules('undead', FACTIONS.undead.units.melee.id, restriction);
    const restricted = encounter({ origin: 'undead', casterId: FACTIONS.undead.units.special.id, corpse: true, ...policy }).s;
    saved.state.rules = structuredClone(restricted.rules); saved.state.draft = structuredClone(restricted.draft);
    expectHistoricalInspectionOnly(saved);
    expect(() => loadGame(saved)).toThrow(/raised|definition|allowed|disabled|draft|banned/i);
    s.rules = structuredClone(restricted.rules); s.draft = structuredClone(restricted.draft);
    expect(() => saveGame(s)).toThrow(/raised|definition|allowed|disabled|draft|banned/i);
  });

  it.each(restrictions)('permits ordinary captured casters whose original caster ID is %s', restriction => {
    for (const origin of ['undead', 'fairies'] as const) {
      const casterId = FACTIONS[origin].units.special.id;
      const { s, caster } = encounter({ origin, casterId, ...restrictedRules(origin, casterId, restriction) });
      expect(definitionAllowed(s, 1, casterId)).toBe(false);
      if (restriction === 'unpicked') expect(definitionAllowed(s, 0, casterId)).toBe(true);
      expect(expectRoundTrip(s).entities.find(e => e.id === caster.id)).toMatchObject({ side: 1, definitionFaction: origin, tactics: { surrenderedTo: 1 } });
    }
  });

  it.each(restrictions)('blocks a captured Fairy clone when its original caster ID is %s', restriction => {
    for (const pinned of [true, false]) {
      const casterId = FACTIONS.fairies.units.special.id;
      const { s, caster } = encounter({ origin: 'fairies', casterId, pinned, ...restrictedRules('fairies', casterId, restriction) });
      expect(definitionAllowed(s, 1, casterId)).toBe(false);
      if (restriction === 'unpicked') expect(definitionAllowed(s, 0, casterId)).toBe(true);
      expectAbilityBlocked(s, caster);
      expect(s.entities.filter(e => e.illusion)).toHaveLength(0);
      expectRoundTrip(s);
    }
  });

  it.each([true, false])('clones the original Fairy caster when the new owner special is excluded (pinned %s)', pinned => {
    const { s, caster } = encounter({ origin: 'fairies', casterId: FACTIONS.fairies.units.special.id, pinned, rules: { disabledDefinitionIds: [FACTIONS.orcs.units.special.id] } });
    expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(true);
    const clones = s.entities.filter(e => e.illusion);
    expect(clones).toHaveLength(2);
    for (const clone of clones) {
      expect(clone).toMatchObject({ side: 1, definitionId: FACTIONS.fairies.units.special.id, definitionFaction: 'fairies', maxHp: FACTIONS.fairies.units.special.hp * .4 });
      expect(entityDefinition(s, clone).id).toBe(FACTIONS.fairies.units.special.id);
    }
    const resumed = expectRoundTrip(s);
    for (const clone of clones) expect(resumed.entities.find(e => e.id === clone.id)!.definitionId).toBe(FACTIONS.fairies.units.special.id);
  });

  it.each([false, true])('uses the current Fairy owner draft to admit captured clones (picked %s)', picked => {
    const casterId = FACTIONS.fairies.units.special.id;
    const { s, caster } = encounter({ origin: 'fairies', owner: 'fairies', casterId, rules: { draft: { enabled: true, banRounds: 0, pickRounds: 1 } }, choices: [casterId, picked ? casterId : FACTIONS.fairies.units.melee.id] });
    expect(definitionAllowed(s, 0, casterId)).toBe(true);
    expect(definitionAllowed(s, 1, casterId)).toBe(picked);
    if (picked) {
      expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(true);
      expect(s.entities.filter(e => e.illusion)).toHaveLength(2);
    } else expectAbilityBlocked(s, caster);
    expectRoundTrip(s);
  });

  it.each(restrictions)('rejects saved captured Fairy clones whose original caster ID becomes %s', restriction => {
    const { s, caster } = encounter({ origin: 'fairies', casterId: FACTIONS.fairies.units.special.id });
    expect(issueCommand(s, 1, { type: 'ability', ids: [caster.id] })).toBe(true);
    const saved = saveGame(s), restricted = encounter({ origin: 'fairies', casterId: FACTIONS.fairies.units.special.id, ...restrictedRules('fairies', FACTIONS.fairies.units.special.id, restriction) }).s;
    saved.state.rules = structuredClone(restricted.rules); saved.state.draft = structuredClone(restricted.draft);
    expectHistoricalInspectionOnly(saved);
    expect(() => loadGame(saved)).toThrow(/illusion|definition|allowed|disabled|draft|banned/i);
    s.rules = structuredClone(restricted.rules); s.draft = structuredClone(restricted.draft);
    expect(() => saveGame(s)).toThrow(/illusion|definition|allowed|disabled|draft|banned/i);
  });

  it.each(restrictions)('keeps a captured ordinary Grove template legal but blocks its %s decoy ID', restriction => {
    const casterId = FACTIONS.orcs.units.melee.id;
    const { s, caster, grove } = encounter({ origin: 'orcs', owner: 'fairies', casterId, grove: true, ...restrictedRules('orcs', casterId, restriction, 'fairies') });
    expect(definitionAllowed(s, 1, casterId)).toBe(false);
    if (restriction === 'unpicked') expect(definitionAllowed(s, 0, casterId)).toBe(true);
    expectRoundTrip(s);
    const nextId = s.nextId, nextDecoyAt = grove!.factionState!.nextDecoyAt;
    stepGame(s, .05);
    expect(caster.side).toBe(1);
    expect(s.entities.filter(e => e.illusion)).toHaveLength(0);
    expect(s.nextId).toBe(nextId);
    expect(grove!.factionState!.nextDecoyAt).toBe(nextDecoyAt);
    expect(s.events.some(e => e.source === grove!.id && e.text === 'Grove sent a decoy toward an observed scout')).toBe(false);
    expectRoundTrip(s);
  });

  it('creates a Grove decoy from a permitted ordinary captured definition', () => {
    const { s, grove } = encounter({ origin: 'orcs', owner: 'fairies', casterId: FACTIONS.orcs.units.melee.id, grove: true });
    stepGame(s, .05);
    const clone = s.entities.find(e => e.illusion)!;
    expect(clone).toBeDefined();
    expect(clone).toMatchObject({ side: 1, definitionId: FACTIONS.orcs.units.melee.id, definitionFaction: 'orcs', maxHp: FACTIONS.orcs.units.melee.hp * .4 });
    expect(s.events.some(e => e.source === grove!.id && e.text === 'Grove sent a decoy toward an observed scout')).toBe(true);
    expectRoundTrip(s);
  });
});
