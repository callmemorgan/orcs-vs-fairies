import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTIONS } from '../../src/core/content';
import { environmentPhase } from '../../src/core/environment';
import { createMatch, refreshVisibility, spawnDefinition } from '../../src/core/simulation';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { SAVE_VERSION } from '../../src/core/saves';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { createArtifact } from '../../src/core/unit-progression';
import type { BuiltinFactionId, Entity, GameState } from '../../src/core/types';

// Integration destination: scripts/acceptance/specialist-lifecycle-fixtures.ts.
// These are authored starting conditions. This producer never steps the game or
// issues a recorded command. Production imports start the browser's recorder.
export function buildSpecialistLifecycleFixtures(output: string, sourceCommit: string) {
  assert.match(sourceCommit, /^[0-9a-f]{40}$/);
  const out = resolve(output); mkdirSync(out, { recursive: true });
  const fixtures: Record<string, unknown> = {};
  const factions: BuiltinFactionId[] = ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata'];
  function reset(e: Entity, x: number, y: number, level = 0, cooldown = 300) {
    Object.assign(e, { x, y, level, order: { type: 'hold' }, path: [], cooldown, animation: 'idle', animTime: 0 });
    delete e.orderQueue;
    return e;
  }
  function base(faction: BuiltinFactionId = 'orcs', hqPoint = { x: 6.5, y: 16.5 }) {
    const state = createMatch({ map: { seed: 4127, size: 'small', biome: 'forest' }, rules: { startingAge: 3, friendlyFire: false, sharedVision: false }, players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'human', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 1000 } } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
    ] });
    assert(state.world && state.world.levels.length === 2);
    state.entities = state.entities.filter(e => e.role === 'hq'); state.resources = [];
    for (const layer of state.world.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
    state.world.levels[0].terrain = state.terrain;
    Object.assign(state.world, { biome: 'temperate', revision: 0, transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 10000, seasonLength: 10000, weatherLength: 10000 });
    for (let seed = 1; seed < 1000; seed++) { state.seed = seed; if (environmentPhase(state).weather === 'clear') break; }
    assert.equal(environmentPhase(state).weather, 'clear');
    const hq = reset(state.entities.find(e => e.side === 0)!, hqPoint.x, hqPoint.y);
    reset(state.entities.find(e => e.side === 1)!, 32.5, 32.5);
    state.starts = [{ ...hqPoint, level: 0 }, { x: 32.5, y: 32.5, level: 0 }];
    const underground = spawnDefinition(state, 0, 'unit', FACTIONS[faction].units.worker.id, 5.5, 5.5, 1, 1);
    reset(underground, 5.5, 5.5, 1);
    return { state, hq, underground };
  }
  function unit(state: GameState, side: 0 | 1, definition: string, x: number, y: number, cooldown = 300) {
    return reset(spawnDefinition(state, side, 'unit', definition, x, y, 1, 0), x, y, 0, cooldown);
  }
  function building(state: GameState, definition: string, x: number, y: number) {
    return reset(spawnDefinition(state, 0, 'building', definition, x, y, 1, 0), x, y);
  }
  function write(name: string, state: GameState, ids: Record<string, unknown>, authored: Record<string, unknown>) {
    refreshVisibility(state);
    const session = createSessionFile(state), decoded = decodeSessionFile(session);
    assert.equal(session.game.version, SAVE_VERSION); assert.equal(decoded.state.tick, 0);
    assert.equal(decoded.state.world!.levels.length, 2);
    assert(decoded.state.entities.some(e => e.side === 0 && e.level === 1));
    writeFileSync(resolve(out, `${name}.json`), JSON.stringify(session, null, 2));
    fixtures[name] = { file: `${name}.json`, ids, authored: { ...authored, initialResources: { wood: 5000, ore: 5000, crystal: 1000 }, weather: 'Clear, day; calendar intervals 10000 seconds', secondLayer: 'One owned worker', setupOnly: true }, faction: state.players[0].faction, initialTick: 0, initialTime: 0 };
  }
  for (const faction of factions) {
    const { state, underground } = base(faction);
    const hero = unit(state, 0, `core:${faction}-commander`, 13.5, 21.5); hero.hp = 180;
    const engineer = unit(state, 0, `core:${faction}-engineer`, 14.5, 17.5); engineer.hp = 70;
    const cavalry = unit(state, 0, FACTIONS[faction].units.cavalry.id, 12.5, 22.5); cavalry.hp = 100;
    if (cavalry.maxShield) cavalry.shield = 30;
    const battle = unit(state, 1, 'core:orcs-engineer', 16.5, 22.5); battle.hp = 100;
    const siege = unit(state, 0, FACTIONS[faction].units.siege.id, 14.5, 9.5, 6);
    const shellTarget = unit(state, 1, FACTIONS.orcs.units.cavalry.id, 22.5, 9.5); shellTarget.facing = 6;
    if (faction === 'undead') state.corpses.push({ id: state.nextId++, x: 15.5, y: 9.5, level: 0, expires: 45 });
    if (faction === 'tideborn') state.terrain[22 * state.width + 12] = 'mud';
    const points = { command: { x: 13.5, y: 21.5 }, queen: { x: 17.5, y: 19.5 }, leap: { x: 12.5, y: 25.5 } };
    write(`specialists-${faction}`, state, { faction, hero: hero.id, engineer: engineer.id, cavalry: cavalry.id, battle: battle.id, siege: siege.id, shellTarget: shellTarget.id, undergroundWorker: underground.id, points }, {
      description: 'Distinct native commander, cavalry and paid siege ability. A living cavalry target survives the first payload; save and replay capture pending and active effects separately.',
      woundedHeroHealth: 180, woundedEngineerHealth: 70, woundedCavalryHealth: 100,
      ownAndEnemyCombatCooldown: 300, siegeCooldown: 6, undeadCorpse: faction === 'undead' ? 'One visible authored corpse, expires at 45 seconds' : null,
      wetGround: faction === 'tideborn' ? 'Mud under cavalry' : null,
    });
  }
  {
    const { state, underground } = base();
    const hero = unit(state, 0, 'core:orcs-commander', 8.5, 22.5, 0);
    const victim = unit(state, 1, 'core:orcs-engineer', 14.5, 22.5); victim.hp = 80; victim.facing = 6;
    write('specialists-veteran', state, { hero: hero.id, victim: victim.id, undergroundWorker: underground.id }, { description: 'An unranked commander must approach and defeat an authored 80-health hostile engineer. No XP or promotion is assigned. Enemy retaliation cooldown is 300 seconds.' });
  }
  {
    const { state, underground } = base();
    const hall = building(state, FACTIONS.orcs.buildings.barracks.id, 9.5, 12.5);
    const hero = unit(state, 0, 'core:orcs-commander', 10.5, 18.5); hero.hp = 1;
    const killer = unit(state, 1, FACTIONS.orcs.units.ranged.id, 16.5, 18.5, 8);
    const item = createArtifact(state, 'core:iron-aegis', hero);
    write('specialists-recovery', state, { hero: hero.id, killer: killer.id, hall: hall.id, artifact: item.id, march: { x: 13.5, y: 18.5 }, undergroundWorker: underground.id }, { description: 'A wounded living commander holds a recoverable ground artifact. The player recovers/equips it and moves into the authored enemy marksman’s range. Defeat, item drop, 30-second recovery and full-price 25-second rerecruitment occur in gameplay.', woundedHeroHealth: 1, killerCooldown: 8, ownCombatCooldown: 300 });
  }
  {
    const { state, underground } = base();
    const engineer = unit(state, 0, 'core:orcs-engineer', 10.5, 21.5, 8);
    const target = unit(state, 1, 'core:orcs-engineer', 11.5, 21.5); target.facing = 6;
    const blade = createArtifact(state, 'core:ember-blade', engineer);
    write('specialists-artifact-damage', state, { engineer: engineer.id, target: target.id, artifact: blade.id, undergroundWorker: underground.id }, { description: 'The same fixture is loaded for a recovered but unequipped baseline and an equipped Ember Blade run. Read actual first attack damage and preserve both complete native endpoints.', firstAttackCooldown: 8, enemyRetaliationCooldown: 300, initialXP: 0, targetFacing: 'West toward attacker, front hit' });
  }
  {
    const { state, underground } = base();
    const engineer = unit(state, 0, 'core:orcs-engineer', 15.5, 18.5);
    const traveler = unit(state, 0, FACTIONS.orcs.units.worker.id, 14.5, 19.5);
    const occupant = unit(state, 0, FACTIONS.orcs.units.worker.id, 14.5, 17.5);
    for (let y = 0; y < state.height; y++) for (const x of [17, 18, 19]) state.terrain[y * state.width + x] = 'water';
    write('specialists-bridge-crossing', state, { engineer: engineer.id, traveler: traveler.id, occupant: occupant.id, bridge: { x: 18.5, y: 18.5 }, destination: { x: 22.5, y: 18.5 }, undergroundWorker: underground.id }, { description: 'A three-tile water channel blocks every route. A native move order remains blocked before a paid bridge; the same traveler crosses afterward. Another worker is ordered onto the bridge. After 60 simulated seconds the three tiles restore water and the bridge occupant relocates to shore through central expiry handling.' });
  }
  {
    const { state, underground } = base();
    const engineer = unit(state, 0, 'core:orcs-engineer', 12.5, 16.5);
    const traveler = unit(state, 0, FACTIONS.orcs.units.worker.id, 11.5, 18.5);
    for (let y = 0; y < state.height; y++) for (let x = 14; x <= 20; x++) if (y !== 18) state.terrain[y * state.width + x] = 'water';
    write('specialists-barricade-obstruction', state, { engineer: engineer.id, traveler: traveler.id, barricade: { x: 14.5, y: 18.5 }, destination: { x: 22.5, y: 18.5 }, undergroundWorker: underground.id }, { description: 'A one-tile land corridor is the only passage through a seven-tile water barrier. A paid native field barricade blocks it. The native move remains blocked until the barricade expires after 60 simulated seconds, then the traveler crosses.' });
  }
  {
    const { state, underground } = base('orcs', { x: 2.5, y: 10.5 });
    const first = building(state, 'core:orcs-beacon', 13.5, 10.5); first.hp = 60;
    const second = building(state, 'core:orcs-beacon', 24.5, 10.5);
    const intruder = unit(state, 1, FACTIONS.orcs.units.worker.id, 28.5, 10.5);
    const destroyer = unit(state, 1, FACTIONS.orcs.units.ranged.id, 16.5, 10.5, 10);
    const observer = unit(state, 0, 'core:orcs-engineer', 9.5, 14.5);
    const farTile = { x: 34.5, y: 10.5, level: 0 };
    write('specialists-beacon-link', state, { first: first.id, second: second.id, intruder: intruder.id, destroyer: destroyer.id, observer: observer.id, farTile, undergroundWorker: underground.id }, { description: 'Two beacons are each 11 tiles from their preceding link. A distant intruder causes a real native alert. An authored enemy marksman destroys the wounded first link after its 10-second cooldown. The surviving remote beacon disconnects and loses current sight while exploration remains.', firstLinkHealth: 60, destroyerInitialCooldown: 10, otherCombatCooldowns: 300, farSightPoint: farTile });
  }
  writeFileSync(resolve(out, 'specialist-lifecycle-manifest.json'), JSON.stringify({ schema: 1, sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, setup: 'Authored setup only, no simulation or commands executed by generator. Native save imports begin recording; all proof actions use production HUD controls.', scenarios: fixtures }, null, 2));
  return fixtures;
}
