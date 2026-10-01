import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { CORPSE_WAGON, FACTION_STRUCTURE_INFO } from '../src/core/faction-systems-content';
import { loadGame, saveGame } from '../src/core/saves';
import type { SaveEnvelope } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { updateSiegeCapture, updateTactics } from '../src/core/tactics';
import { generateWorldMap } from '../src/core/world-map';
import type { BuildingRole, BuiltinFactionId, Command, Entity, GameState, Side, UnitRole } from '../src/core/types';

// Copy this artifact into tests/ before running it. All legal cases use the
// authoritative simulation; edits below only author the encounter or corrupt a save.
function fixture(factions: BuiltinFactionId[]): GameState {
  const map = generateWorldMap(4127, 'large', factions.length, 'temperate');
  for (const layer of map.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  map.sites = [];
  // Keep generated starting resources through match admission, then clear the arena.
  const s = createMatch({
    map: { seed: map.seed, size: map.size, world: map }, rules: { startingAge: 3 },
    players: factions.map((factionId, id) => ({
      id: id as Side, teamId: id as Side, factionId, controller: 'external' as const,
      handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 10000 } },
    })),
  });
  s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
  return s;
}
function unit(s: GameState, side: Side, role: UnitRole, x = 24.5, y = 32.5): Entity {
  const e = spawnDefinition(s, side, 'unit', FACTIONS[s.players[side].faction].units[role].id, x, y, 1, 1);
  e.order = { type: 'hold' }; e.cooldown = 100; e.facing = 4;
  return e;
}
function building(s: GameState, side: Side, role: BuildingRole, x: number, y: number): Entity {
  const e = spawnDefinition(s, side, 'building', FACTIONS[s.players[side].faction].buildings[role].id, x, y, 1, 1);
  e.order = { type: 'hold' }; e.cooldown = 100;
  return e;
}
function command(s: GameState, side: Side, value: Command): void {
  refreshVisibility(s);
  expect(issueCommand(s, side, value), JSON.stringify(value)).toBe(true);
}
function advance(s: GameState, seconds: number): void {
  const end = s.time + seconds;
  while (s.time + 1e-8 < end) {
    const before = s.time; stepGame(s, Math.min(.05, end - s.time));
    expect(s.time).toBeGreaterThan(before);
  }
}
function savedEntity(saved: SaveEnvelope, e: Entity): Entity {
  return saved.state.entities.find(candidate => candidate.id === e.id)!;
}
function roundTripAndContinue(s: GameState, seconds = .5): GameState {
  const before = saveGame(s), resumed = loadGame(JSON.stringify(before));
  expect(saveGame(resumed)).toEqual(before);
  advance(s, seconds); advance(resumed, seconds);
  expect(saveGame(resumed)).toEqual(saveGame(s));
  return resumed;
}
function surrender(s: GameState, victim: Entity, captorSide: Side): Entity[] {
  // Author an exhausted, wounded troop; actual updateTactics performs transfer.
  victim.hp = victim.maxHp * .5; victim.tactics!.morale = 0;
  const captors = [[-1.2, 0], [1.2, 0], [0, 1.2]].map(([dx, dy]) =>
    unit(s, captorSide, 'melee', victim.x + dx, victim.y + dy));
  refreshVisibility(s); advance(s, .05);
  expect(victim.side).toBe(captorSide);
  expect(victim.tactics!.surrenderedTo).toBe(captorSide);
  expect(s.events.some(e => e.source === victim.id && e.text === 'A surrounded unit surrendered')).toBe(true);
  return captors;
}
function capture(s: GameState, engine: Entity, captorSide: Side): Entity[] {
  const raiders = [-.6, -.4, -.2, .2, .4, .6].map(dy =>
    unit(s, captorSide, 'melee', engine.x - 1.1, engine.y + dy));
  for (const raider of raiders) raider.cooldown = 0;
  command(s, captorSide, { type: 'attack', ids: raiders.map(e => e.id), target: engine.id });
  // Reinforced armor can require another volley for lower-damage faction rosters.
  const deadline = s.time + 5;
  while (!engine.tactics!.siegeCrew!.uncrewed && s.time < deadline) advance(s, .05);
  expect(engine.tactics!.siegeCrew!.uncrewed).toBe(true);
  expect(engine.hp).toBeGreaterThan(0);
  command(s, captorSide, { type: 'stop', ids: raiders.map(e => e.id) });
  command(s, captorSide, { type: 'captureSiege', ids: [raiders[2].id], target: engine.id });
  advance(s, 4.1);
  expect(engine.side).toBe(captorSide);
  expect(engine.tactics!.siegeCrew).toEqual({ hp: 42, maxHp: 42, uncrewed: false });
  return raiders;
}
function powerFixture(): { s: GameState; hq: Entity; relay: Entity; tower: Entity; secondHq: Entity } {
  const s = fixture(['automata', 'orcs']);
  const hq = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
  hq.x = 10.5; hq.y = 20.5; hq.level = 1; hq.cooldown = 100;
  const relay = spawnDefinition(s, 0, 'building', FACTION_STRUCTURE_INFO['power-relay'].definition.id, 18.5, 20.5, 1, 1);
  const tower = building(s, 0, 'tower', 26.5, 20.5);
  const secondHq = building(s, 0, 'hq', 45.5, 40.5);
  advance(s, .05);
  expect(relay.factionState!.power).toEqual({ connected: true, root: hq.id });
  expect(tower.factionState!.power).toEqual({ connected: true, root: hq.id });
  expect(secondHq.factionState!.power).toEqual({ connected: true, root: secondHq.id });
  return { s, hq, relay, tower, secondHq };
}

describe('semantic faction and tactics save admission', () => {
  it('rejects a directional guard forged onto Orc ranged troops', () => {
    const s = fixture(['orcs', 'fairies']), ranged = unit(s, 0, 'ranged');
    const saved = saveGame(s);
    savedEntity(saved, ranged).tactics!.guard = { value: 40, max: 40, lastDamagedAt: 0 };
    expect(() => loadGame(saved)).toThrow(/guard/);
  });

  it('rejects an unpinned original faction forged to grant builtin Orc melee a guard', () => {
    const s = fixture(['orcs', 'fairies']), melee = unit(s, 0, 'melee');
    // Builtin opening troops can lack an explicit ID; verify that baseline first.
    delete melee.definitionId; expect(() => loadGame(saveGame(s))).not.toThrow();
    const saved = saveGame(s), forged = savedEntity(saved, melee);
    forged.definitionFaction = 'dwarves';
    forged.tactics!.guard = { value: 40, max: 40, lastDamagedAt: 0 };
    expect(() => loadGame(saved)).toThrow(/definitionFaction|definitionId|guard/);
  });

  it('rejects a forged guard capacity while admitting the actual shield bearer', () => {
    const s = fixture(['dwarves', 'fairies']), melee = unit(s, 0, 'melee');
    roundTripAndContinue(s);
    const saved = saveGame(s); savedEntity(saved, melee).tactics!.guard!.max = 41;
    expect(() => loadGame(saved)).toThrow(/guard/);
  });

  it('keeps a surrendered Dwarf melee guard when its new owner is Fairy', () => {
    const s = fixture(['dwarves', 'fairies']), melee = unit(s, 0, 'melee');
    expect(melee.tactics!.guard!.max).toBe(40);
    surrender(s, melee, 1);
    expect(melee.definitionFaction).toBe('dwarves');
    expect(melee.tactics!.guard).toEqual({ value: 40, max: 40, lastDamagedAt: 0 });
    const resumed = roundTripAndContinue(s);
    expect(resumed.entities.find(e => e.id === melee.id)!.tactics!.guard!.max).toBe(40);
  });

  it('keeps the original definition when a builtin Dwarf troop without an ID surrenders', () => {
    const s = fixture(['dwarves', 'fairies']), melee = unit(s, 0, 'melee');
    delete melee.definitionId; expect(() => loadGame(saveGame(s))).not.toThrow();
    surrender(s, melee, 1);
    expect(melee.definitionFaction).toBe('dwarves');
    expect(melee.tactics!.guard!.max).toBe(40);
    roundTripAndContinue(s);
  });

  it('rejects a reinforced artillery fitting forged onto Orc ranged troops', () => {
    const s = fixture(['orcs', 'fairies']), ranged = unit(s, 0, 'ranged');
    const saved = saveGame(s); savedEntity(saved, ranged).factionState = { artillery: 'reinforced' };
    expect(() => loadGame(saved)).toThrow(/artillery/);
  });

  it('keeps a real Dwarf workshop fitting after an Orc captures the siege engine', () => {
    const s = fixture(['dwarves', 'orcs']), engine = unit(s, 0, 'siege');
    command(s, 0, { type: 'modifyArtillery', ids: [engine.id], modification: 'reinforced' });
    capture(s, engine, 1);
    expect(engine.definitionFaction).toBe('dwarves');
    expect(engine.factionState!.artillery).toBe('reinforced');
    roundTripAndContinue(s);
  });

  it('allows Dwarves to fit a captured originally Orc siege engine', () => {
    const s = fixture(['orcs', 'dwarves']), engine = unit(s, 0, 'siege');
    capture(s, engine, 1);
    expect(engine.definitionFaction).toBe('orcs');
    command(s, 1, { type: 'modifyArtillery', ids: [engine.id], modification: 'reinforced' });
    expect(engine.factionState!.artillery).toBe('reinforced');
    roundTripAndContinue(s);
  });

  it('rejects an assault chant forged onto a non-Orc owned troop', () => {
    const s = fixture(['fairies', 'orcs']), melee = unit(s, 0, 'melee');
    const saved = saveGame(s); savedEntity(saved, melee).factionState = { chant: { kind: 'assault', until: s.time + 12 } };
    expect(() => loadGame(saved)).toThrow(/chant/);
  });

  it.each(['worker', 'siege'] as UnitRole[])('rejects a chant forged onto an Orc %s', role => {
    const s = fixture(['orcs', 'fairies']), actor = unit(s, 0, role);
    const saved = saveGame(s); savedEntity(saved, actor).factionState = { chant: { kind: 'bulwark', until: s.time + 12 } };
    expect(() => loadGame(saved)).toThrow(/chant/);
  });

  it('accepts an Orc-issued chant on a surrendered foreign original troop', () => {
    const s = fixture(['dwarves', 'orcs']), melee = unit(s, 0, 'melee');
    surrender(s, melee, 1);
    // Fury is authored setup; issueCommand performs the real ownership/cost check.
    s.factionSystems!.fury[1] = 25;
    command(s, 1, { type: 'warChant', ids: [melee.id], chant: 'assault' });
    expect(s.factionSystems!.fury[1]).toBe(0);
    expect(melee.definitionFaction).toBe('dwarves');
    expect(melee.factionState!.chant).toEqual({ kind: 'assault', until: s.time + 12 });
    roundTripAndContinue(s);
  });

  it('clears an active Orc chant during actual surrender to Fairy ownership', () => {
    const s = fixture(['orcs', 'fairies']), melee = unit(s, 0, 'melee');
    s.factionSystems!.fury[0] = 25;
    command(s, 0, { type: 'warChant', ids: [melee.id], chant: 'bulwark' });
    expect(melee.factionState!.chant!.kind).toBe('bulwark');
    surrender(s, melee, 1);
    expect(melee.factionState!.chant).toBeUndefined();
    roundTripAndContinue(s);
  });

  it('rejects Automata power and positive shield capacity forged onto an Orc headquarters', () => {
    const s = fixture(['orcs', 'fairies']), hq = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
    const saved = saveGame(s), forged = savedEntity(saved, hq);
    forged.factionState = { power: { connected: true, root: hq.id } }; forged.shield = 80; forged.maxShield = 80;
    expect(() => loadGame(saved)).toThrow(/power|shield/i);
  });

  it('rejects a positive shield capacity alone on an Orc headquarters', () => {
    const s = fixture(['orcs', 'fairies']), hq = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
    const saved = saveGame(s), forged = savedEntity(saved, hq); forged.shield = 80; forged.maxShield = 80;
    expect(() => loadGame(saved)).toThrow(/maxShield/);
  });

  it('preserves the real Automata power graph, shield capacities and continuation', () => {
    const { s, hq, relay, tower } = powerFixture();
    for (const node of [hq, relay, tower]) { expect(node.maxShield).toBe(80); expect(node.shield).toBe(80); }
    roundTripAndContinue(s);
  });

  it('rejects an Automata network shield whose power record is missing', () => {
    const { s, tower } = powerFixture(), saved = saveGame(s), forged = savedEntity(saved, tower);
    delete forged.factionState!.power;
    expect(() => loadGame(saved)).toThrow(/power|shield/i);
  });

  it('rejects a connected Automata power node without its shield fields', () => {
    const { s, tower } = powerFixture(), saved = saveGame(s), forged = savedEntity(saved, tower);
    delete forged.shield; delete forged.maxShield;
    expect(() => loadGame(saved)).toThrow(/power|shield/i);
  });

  it('rejects a forged connection to a remote owned headquarters without connectors', () => {
    const { s, tower, secondHq } = powerFixture(), saved = saveGame(s);
    savedEntity(saved, tower).factionState!.power!.root = secondHq.id;
    expect(() => loadGame(saved)).toThrow(/power.*root|connect/i);
  });

  it.each(['hq', 'relay'] as const)('admits a saved network after real same-tick %s destruction', victimKind => {
    const { s, hq, relay, tower } = powerFixture(), victim = victimKind === 'hq' ? hq : relay;
    for (const node of [hq, relay, tower]) { node.shield = 0; node.lastDamagedAt = s.time; }
    victim.hp = 1;
    const attacker = unit(s, 1, 'ranged', victim.x + 4, victim.y); attacker.cooldown = 0;
    command(s, 1, { type: 'attack', ids: [attacker.id], target: victim.id }); advance(s, .05);
    expect(victim.hp).toBe(0); expect(victim.animation).toBe('death');
    expect(tower.factionState!.power).toEqual({ connected: true, root: hq.id });
    command(s, 1, { type: 'stop', ids: [attacker.id] }); attacker.cooldown = 100;
    const resumed = roundTripAndContinue(s);
    expect(resumed.entities.find(e => e.id === tower.id)!.factionState!.power).toEqual({ connected: false, root: null });
  });

  it.each(['missing', 'foreign', 'non-HQ', 'wrong-level', 'unfinished'] as const)(
    'rejects an Automata connected node whose root is %s', corruption => {
      const { s, hq, relay, tower } = powerFixture(), saved = saveGame(s), target = savedEntity(saved, tower);
      if (corruption === 'missing') {
        const missing = saved.state.nextId++; target.factionState!.power!.root = missing;
      } else if (corruption === 'foreign') {
        target.factionState!.power!.root = saved.state.entities.find(e => e.side === 1 && e.role === 'hq')!.id;
      } else if (corruption === 'non-HQ') target.factionState!.power!.root = relay.id;
      else if (corruption === 'wrong-level') savedEntity(saved, hq).level = 0;
      else savedEntity(saved, hq).progress = .5;
      expect(() => loadGame(saved)).toThrow(/power/);
    },
  );

  it('admits ordinary Automata building roles as power connectors', () => {
    const s = fixture(['automata', 'orcs']), hq = s.entities.find(e => e.side === 0 && e.role === 'hq')!;
    hq.x = 10.5; hq.y = 20.5; hq.level = 1;
    const barracks = building(s, 0, 'barracks', 18.5, 20.5), tower = building(s, 0, 'tower', 26.5, 20.5);
    advance(s, .05);
    expect(barracks.factionState!.power).toEqual({ connected: true, root: hq.id });
    expect(tower.factionState!.power).toEqual({ connected: true, root: hq.id });
    roundTripAndContinue(s);
  });

  it('admits shield zero without an energy capacity on an unshielded troop', () => {
    const s = fixture(['orcs', 'fairies']), victim = unit(s, 0, 'ranged'), attacker = unit(s, 1, 'ranged', 28.5, 32.5);
    attacker.cooldown = 0;
    command(s, 1, { type: 'attack', ids: [attacker.id], target: victim.id }); advance(s, .05);
    expect(victim.hp).toBeLessThan(victim.maxHp); expect(victim.shield).toBe(0); expect(victim.maxShield).toBeUndefined();
    command(s, 1, { type: 'stop', ids: [attacker.id] }); attacker.cooldown = 100;
    roundTripAndContinue(s);
  });
});

// Additional reviewer regressions; parent can copy this block after the first suite.
describe('retained faction definitions, cooldowns and pending-order cleanup', () => {
  function wagon(s: GameState): Entity {
    const e = spawnDefinition(s, 0, 'unit', CORPSE_WAGON.id, 24.5, 32.5, 1, 1);
    e.order = { type: 'hold' }; e.cooldown = 100; return e;
  }
  function loadedWagon(): { s: GameState; carrier: Entity; body: GameState['corpses'][number] } {
    const s = fixture(['undead', 'orcs']), carrier = wagon(s);
    const body = { id: s.nextId++, x: carrier.x, y: carrier.y + .2, level: 1, expires: 45 };
    s.corpses.push(body);
    command(s, 0, { type: 'collectCorpses', ids: [carrier.id], target: body.id }); advance(s, 1.05);
    expect(carrier.factionState!.corpseCargo).toEqual([body]);
    return { s, carrier, body };
  }
  function surroundForCallback(s: GameState, victim: Entity, captorSide: Side): void {
    victim.hp = victim.maxHp * .5; victim.tactics!.morale = 0;
    for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, 1.2]])
      unit(s, captorSide, 'melee', victim.x + dx, victim.y + dy);
    refreshVisibility(s);
  }

  it('rejects an absent original faction even with a forged current-side surrender marker', () => {
    const s = fixture(['orcs', 'fairies']), melee = unit(s, 0, 'melee'), saved = saveGame(s), forged = savedEntity(saved, melee);
    delete forged.definitionId; forged.definitionFaction = 'dwarves'; forged.tactics!.surrenderedTo = 0;
    forged.maxHp = FACTIONS.dwarves.units.melee.hp; forged.hp = forged.maxHp;
    forged.tactics!.guard = { value: 40, max: 40, lastDamagedAt: 0 };
    expect(() => loadGame(saved)).toThrow(/definitionFaction/);
  });

  it.each([true, false])('rejects altered captured health capacity with pinned definition %s', pinned => {
    const s = fixture(['dwarves', 'fairies']), melee = unit(s, 0, 'melee'); surrender(s, melee, 1);
    const saved = saveGame(s), forged = savedEntity(saved, melee); if (!pinned) delete forged.definitionId;
    expect(() => loadGame(saved)).not.toThrow(); forged.maxHp += 1;
    expect(() => loadGame(saved)).toThrow(/maxHp/);
  });

  it.each(['worker', 'siege', 'building', 'illusion'] as const)('rejects a swap cooldown on %s', kind => {
    const s = fixture(['fairies', 'orcs']);
    const actor = kind === 'building' ? s.entities.find(e => e.side === 0 && e.role === 'hq')! : unit(s, 0, kind === 'illusion' ? 'melee' : kind);
    if (kind === 'illusion') actor.illusion = true;
    const saved = saveGame(s); savedEntity(saved, actor).factionState = { swapReadyAt: s.time + 10 };
    expect(() => loadGame(saved)).toThrow(/swapReadyAt/);
  });

  it('rejects a water-shaping cooldown on a specialist without the surge ability', () => {
    const s = fixture(['orcs', 'tideborn']), actor = unit(s, 0, 'special'), saved = saveGame(s);
    savedEntity(saved, actor).factionState = { waterReadyAt: s.time + 20 };
    expect(() => loadGame(saved)).toThrow(/waterReadyAt/);
  });

  it('keeps an issued water-shaping cooldown after a real Tidecaller surrender to Orcs', () => {
    const s = fixture(['tideborn', 'orcs']), actor = unit(s, 0, 'special');
    command(s, 0, { type: 'shapeWater', ids: [actor.id], x: actor.x + 4, y: actor.y, level: 1, terrain: 'mud' });
    const readyAt = actor.factionState!.waterReadyAt; expect(readyAt).toBe(20);
    surrender(s, actor, 1); expect(actor.definitionFaction).toBe('tideborn'); expect(actor.factionState!.waterReadyAt).toBe(readyAt);
    roundTripAndContinue(s);
  });

  it('rejects a grove decoy cooldown on an ordinary Fairy depot', () => {
    const s = fixture(['fairies', 'orcs']), depot = building(s, 0, 'depot', 24.5, 32.5), saved = saveGame(s);
    savedEntity(saved, depot).factionState = { nextDecoyAt: s.time + 20 };
    expect(() => loadGame(saved)).toThrow(/nextDecoyAt/);
  });

  it('rejects corpse wagon cargo on a Gravecaller', () => {
    const s = fixture(['undead', 'orcs']), caster = unit(s, 0, 'special'), saved = saveGame(s);
    savedEntity(saved, caster).factionState = { corpseCargo: [] };
    expect(() => loadGame(saved)).toThrow(/corpseCargo/);
  });

  it('rejects delivered raising stock on a corpse wagon without the raise ability', () => {
    const s = fixture(['undead', 'orcs']), carrier = wagon(s), saved = saveGame(s);
    savedEntity(saved, carrier).factionState = { deliveredCorpses: [] };
    expect(() => loadGame(saved)).toThrow(/deliveredCorpses/);
  });

  it('rejects an active corpse order on an ordinary troop', () => {
    const s = fixture(['orcs', 'undead']), actor = unit(s, 0, 'melee'), saved = saveGame(s);
    savedEntity(saved, actor).factionState = { corpseOrder: { type: 'collect', target: s.entities[0].id, progress: 0 } };
    expect(() => loadGame(saved)).toThrow(/corpseOrder/);
  });

  it('preserves physically collected corpse cargo through full-step wagon surrender', () => {
    const { s, carrier, body } = loadedWagon(); surrender(s, carrier, 1);
    expect(carrier.definitionFaction).toBe('undead'); expect(carrier.factionState!.corpseCargo).toEqual([body]);
    expect(carrier.factionState!.corpseOrder).toBeUndefined(); roundTripAndContinue(s);
    const saved = saveGame(s); savedEntity(saved, carrier).factionState!.corpseOrder = { type: 'collect', target: body.id, progress: 0 };
    expect(() => loadGame(saved)).toThrow(/corpseOrder/);
  });

  it('surrender callback clears a command-issued corpse delivery and preserves its cargo', () => {
    const { s, carrier, body } = loadedWagon(), caster = unit(s, 0, 'special', 31.5, 32.5);
    command(s, 0, { type: 'deliverCorpses', ids: [carrier.id], target: caster.id });
    expect(carrier.factionState!.corpseOrder).toEqual({ type: 'deliver', target: caster.id, progress: 0 });
    surroundForCallback(s, carrier, 1);
    // A valid corpse channel skips tactics in stepGame; isolate the transfer callback.
    expect(updateTactics(s, carrier, .05)).toEqual({ skipCombat: true });
    expect(carrier.side).toBe(1); expect(carrier.factionState!.corpseOrder).toBeUndefined();
    expect(carrier.factionState!.corpseCargo).toEqual([body]); roundTripAndContinue(s);
  });

  it('surrender callback clears command-issued tunnel travel and keeps the original guard', () => {
    const s = fixture(['dwarves', 'fairies']), melee = unit(s, 0, 'melee');
    spawnDefinition(s, 0, 'building', FACTION_STRUCTURE_INFO.tunnel.definition.id, melee.x - 3, melee.y, 1, 1);
    const exit = spawnDefinition(s, 0, 'building', FACTION_STRUCTURE_INFO.tunnel.definition.id, 40.5, 32.5, 1, 1);
    command(s, 0, { type: 'tunnelTravel', ids: [melee.id], target: exit.id }); expect(melee.factionState!.tunnel).toEqual({ target: exit.id, progress: 0 });
    surroundForCallback(s, melee, 1);
    // Active travel precedes tactics in stepGame; exercise ownership cleanup directly.
    expect(updateTactics(s, melee, .05)).toEqual({ skipCombat: true });
    expect(melee.side).toBe(1); expect(melee.definitionFaction).toBe('dwarves');
    expect(melee.factionState!.tunnel).toBeUndefined(); expect(melee.tactics!.guard!.max).toBe(40);
    roundTripAndContinue(s);
  });

  it('capture callback clears a real pending tunnel while preserving a fitted engine', () => {
    const s = fixture(['dwarves', 'orcs']), engine = unit(s, 0, 'siege');
    spawnDefinition(s, 0, 'building', FACTION_STRUCTURE_INFO.tunnel.definition.id, engine.x - 3, engine.y, 1, 1);
    const exit = spawnDefinition(s, 0, 'building', FACTION_STRUCTURE_INFO.tunnel.definition.id, 40.5, 32.5, 1, 1);
    command(s, 0, { type: 'modifyArtillery', ids: [engine.id], modification: 'reinforced' });
    command(s, 0, { type: 'tunnelTravel', ids: [engine.id], target: exit.id });
    const raiders = [-.6, -.4, -.2, .2, .4, .6].map(dy => unit(s, 1, 'melee', engine.x - 1.1, engine.y + dy));
    for (const raider of raiders) raider.cooldown = 0;
    command(s, 1, { type: 'attack', ids: raiders.map(e => e.id), target: engine.id }); advance(s, .05);
    expect(engine.tactics!.siegeCrew!.uncrewed).toBe(true); expect(engine.factionState!.tunnel!.target).toBe(exit.id);
    command(s, 1, { type: 'stop', ids: raiders.map(e => e.id) });
    command(s, 1, { type: 'captureSiege', ids: [raiders[2].id], target: engine.id });
    // The next full step cancels damaged travel first; isolate the capture callback.
    for (let i = 0; i < 16; i++) updateSiegeCapture(s, raiders[2], .25);
    expect(engine.side).toBe(1); expect(engine.definitionFaction).toBe('dwarves');
    expect(engine.factionState!.tunnel).toBeUndefined(); expect(engine.factionState!.artillery).toBe('reinforced');
    roundTripAndContinue(s);
  });
});


describe('strict tactical capacities and stored power connectivity', () => {
  it.each([43, 1000000])('rejects a forged siege crew capacity of %s', capacity => {
    const s = fixture(['orcs', 'fairies']), engine = unit(s, 0, 'siege'), saved = saveGame(s);
    savedEntity(saved, engine).tactics!.siegeCrew!.maxHp = capacity;
    expect(() => loadGame(saved)).toThrow(/siegeCrew/);
  });

  it.each(['worker', 'siege', 'illusion'] as const)('rejects a formation on %s', kind => {
    const s = fixture(['orcs', 'fairies']), military = unit(s, 0, 'melee');
    command(s, 0, { type: 'formation', ids: [military.id], formation: 'line', spacing: 1, facing: 6 });
    const actor = unit(s, 0, kind === 'illusion' ? 'melee' : kind);
    if (kind === 'illusion') actor.illusion = true;
    const saved = saveGame(s);
    savedEntity(saved, actor).tactics!.formation = structuredClone(military.tactics!.formation);
    expect(() => loadGame(saved)).toThrow(/formation/);
  });

  it('rejects a surrendered-owner marker that contradicts an actual transferred troop', () => {
    const s = fixture(['dwarves', 'fairies']), melee = unit(s, 0, 'melee'); surrender(s, melee, 1);
    const saved = saveGame(s); savedEntity(saved, melee).tactics!.surrenderedTo = 0;
    expect(() => loadGame(saved)).toThrow(/surrenderedTo|definitionFaction/);
  });

  it.each(['unrefreshed', 'disconnected'] as const)('rejects a network referencing an %s HQ', state => {
    const { s, hq } = powerFixture(), saved = saveGame(s), root = savedEntity(saved, hq);
    if (state === 'unrefreshed') { delete root.factionState!.power; delete root.maxShield; delete root.shield; }
    else root.factionState!.power = { connected: false, root: null };
    expect(() => loadGame(saved)).toThrow(/power/);
  });

  it.each(['unrefreshed', 'disconnected'] as const)('rejects a connection through an %s relay', state => {
    const { s, relay } = powerFixture(), saved = saveGame(s), connector = savedEntity(saved, relay);
    if (state === 'unrefreshed') { delete connector.factionState!.power; delete connector.maxShield; delete connector.shield; }
    else connector.factionState!.power = { connected: false, root: null };
    expect(() => loadGame(saved)).toThrow(/power/);
  });
});
