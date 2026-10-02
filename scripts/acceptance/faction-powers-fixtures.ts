import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTIONS } from '../../src/core/content';
import { environmentPhase } from '../../src/core/environment';
import { initializeFactionSystems, refreshPowerNetworks } from '../../src/core/faction-systems';
import { CORPSE_WAGON, FACTION_STRUCTURE_INFO, TROPHY_STANDARD } from '../../src/core/faction-systems-content';
import { MatchRecorder } from '../../src/core/replays';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition } from '../../src/core/simulation';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { BuiltinFactionId, BuildingRole, Entity, GameState, ResourceNode, Side, UnitRole, Vec } from '../../src/core/types';

export interface FactionPowerScenario {
  file: string;
  group: 'factions';
  ids: Record<string, unknown>;
  authored: Record<string, unknown>;
  initialTick: number;
  initialTime: number;
  faction: BuiltinFactionId;
  sha256: string;
}
export interface FactionPowerManifest {
  schema: 1;
  group: 'factions';
  sourceCommit: string;
  saveVersion: typeof SAVE_VERSION;
  simulationRevision: string;
  setup: string;
  scenarios: Record<string, FactionPowerScenario>;
}

// This generator authors starting conditions only. Public setup abilities below
// create canonical negative doubles or the initial raised ally before recording.
// No fixture generation advances the engine; the native app owns later actions.
export function buildFactionPowerFixtures(output: string, sourceCommit: string): FactionPowerManifest {
  assert(output, 'Supply a new output directory.');
  assert.match(sourceCommit, /^[a-f0-9]{40}$/, 'Supply the full frozen source commit.');
  assert.equal(SAVE_VERSION, 4, 'Faction acceptance requires SAVE4.');
  assert.equal(SIMULATION_REVISION, '4.0.2', 'Faction acceptance requires the admitted rules revision.');
  const out = resolve(output);
  assert(!existsSync(out), 'Fixture output directory must be new.');
  mkdirSync(out, { recursive: true });
  const scenarios: Record<string, FactionPowerScenario> = {};
  const banks = { wood: 2000, ore: 2000, crystal: 500 };
  const commonAuthored = {
    map: 'Seed 0, small forest world, two flat grass layers. Generated resources, transitions, bridges, neutral sites, creatures, fire and ice are removed; any encounter resource or rock is declared separately.',
    calendar: 'Clear daylight at seed 0; day, season and weather lengths are 1,000,000 seconds. No starting environmental hazard.',
    roster: 'Side zero is human; side one is external. Both native headquarters and distant native workers remain. Default combat troops are removed; encounter actors use spawnDefinition.',
    undergroundWorker: 'One retained owned worker starts underground in every fixture.',
    economy: { startingAge: 3, startingBanksForBothPlayers: banks },
    structureCosts: Object.fromEntries(Object.values(FACTION_STRUCTURE_INFO).map(info => [info.definition.id, { ...info.definition.cost }])),
    orders: 'Unless listed separately, actors hold, have no queued order or path, face west (4), and have zero momentum.',
    cooldowns: 'Unless listed separately, all actors begin with weapon cooldown 1,000 seconds. No weapon cooldown is authored after recording; native stepping and weapon fire update it.',
    health: 'Definition health and shield capacities are retained except declared wounded health or depleted shield reserves.',
    history: 'All authoring and any canonical setup ability precede a zero-tick, zero-action MatchRecorder.',
  };

  function reset(e: Entity, x: number, y: number, level = 0, cooldown = 1000): Entity {
    Object.assign(e, { x, y, level, order: { type: 'hold' }, path: [], cooldown, facing: 4, animation: 'idle', animTime: 0, momentum: 0 });
    delete e.orderQueue;
    return e;
  }
  function base(faction: BuiltinFactionId, opponent: BuiltinFactionId = 'orcs') {
    const state = createMatch({
      map: { seed: 0, size: 'small', biome: 'forest' },
      rules: { startingAge: 3, friendlyFire: false, sharedVision: false },
      players: [
        { id: 0, teamId: 0, factionId: faction, controller: 'human', handicap: { startingResources: banks } },
        { id: 1, teamId: 1, factionId: opponent, controller: 'external', handicap: { startingResources: banks } },
      ],
    });
    assert(state.world && state.world.levels.length === 2, 'Faction encounters need both map levels.');
    const relicTemplate = state.world.sites.find(site => site.kind === 'relic');
    assert(relicTemplate, 'The native generated world supplies a complete relic site record.');
    for (const layer of state.world.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
    Object.assign(state.world, { transitions: [], bridges: [], sites: [], creatures: [], fires: [], iceTiles: [], dayLength: 1_000_000, seasonLength: 1_000_000, weatherLength: 1_000_000 });
    state.world.levels[0].terrain = state.terrain;
    state.terrain.fill('grass'); state.resources = [];
    state.entities = state.entities.filter(e => e.kind === 'building' && e.role === 'hq' || e.kind === 'unit' && e.role === 'worker');
    for (const side of [0, 1] as Side[]) {
      const hq = state.entities.find(e => e.side === side && e.role === 'hq')!;
      reset(hq, side ? 31.5 : 5.5, side ? 31.5 : 5.5);
      state.starts[side] = { x: hq.x, y: hq.y, level: 0 };
      state.entities.filter(e => e.side === side && e.role === 'worker').forEach((e, i) => reset(e, side ? 30.5 + i * .7 : 4.5 + i * .7, side ? 28.5 : 8.5));
    }
    const workers = state.entities.filter(e => e.side === 0 && e.role === 'worker');
    const undergroundWorker = workers.at(-1)!;
    reset(undergroundWorker, 8.5, 8.5, 1);
    initializeFactionSystems(state);
    assert.equal(environmentPhase(state).weather, 'clear');
    assert.equal(environmentPhase(state).day, 'day');
    return { state, worker: workers[0], undergroundWorker, hq: state.entities.find(e => e.side === 0 && e.role === 'hq')!, relicTemplate };
  }
  function unit(state: GameState, side: Side, role: UnitRole, x: number, y: number, cooldown = 1000, level = 0): Entity {
    return reset(spawnDefinition(state, side, 'unit', FACTIONS[state.players[side].faction].units[role].id, x, y, 1, level), x, y, level, cooldown);
  }
  function namedUnit(state: GameState, side: Side, definitionId: string, x: number, y: number, cooldown = 1000, level = 0): Entity {
    return reset(spawnDefinition(state, side, 'unit', definitionId, x, y, 1, level), x, y, level, cooldown);
  }
  function building(state: GameState, side: Side, role: BuildingRole, x: number, y: number, level = 0): Entity {
    return reset(spawnDefinition(state, side, 'building', FACTIONS[state.players[side].faction].buildings[role].id, x, y, 1, level), x, y, level);
  }
  function structure(state: GameState, definitionId: string, point: Vec): Entity {
    return reset(spawnDefinition(state, 0, 'building', definitionId, point.x, point.y, 1, point.level ?? 0), point.x, point.y, point.level ?? 0);
  }
  function timber(state: GameState, point: Vec): ResourceNode {
    const node: ResourceNode = { id: state.nextId++, kind: 'wood', ...point, level: point.level ?? 0, amount: 1, maxAmount: 1 };
    state.resources.push(node); return node;
  }
  function write(name: string, state: GameState, ids: Record<string, unknown>, authored: Record<string, unknown>) {
    assert(!Object.hasOwn(scenarios, name), `Unique faction fixture ${name}.`);
    assert.equal(state.tick, 0); assert.equal(state.time, 0);
    if (state.players[0].faction === 'automata') refreshPowerNetworks(state, 0);
    refreshVisibility(state);
    const recorder = new MatchRecorder(state);
    const file = createSessionFile(state, recorder.export()); recorder.dispose();
    const decoded = decodeSessionFile(file);
    assert.deepEqual(saveGame(decoded.state), file.game, `${name} complete native fixture round trip`);
    assert.equal(file.game.version, SAVE_VERSION);
    assert.equal(file.replay!.simulationRevision, SIMULATION_REVISION);
    assert.equal(file.replay!.actions.length, 0);
    assert.equal(file.replay!.finalTick, 0);
    assert.equal(decoded.state.world!.levels.length, 2);
    assert(decoded.state.entities.some(e => e.side === 0 && e.kind === 'unit' && e.level === 1));
    const bytes = Buffer.from(`${JSON.stringify(file, null, 2)}\n`);
    writeFileSync(resolve(out, `${name}.json`), bytes, { flag: 'wx' });
    scenarios[name] = {
      file: `${name}.json`, group: 'factions', ids,
      authored: { ...commonAuthored, ...authored, startingActors: structuredClone(state.entities), startingSites: structuredClone(state.world!.sites), startingResources: structuredClone(state.resources) },
      initialTick: state.tick, initialTime: state.time, faction: state.players[0].faction as BuiltinFactionId,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }

  {
    const { state, worker, undergroundWorker } = base('orcs');
    reset(worker, 29.5, 23.5);
    const earners = [13.5, 14.5, 15.5].map(y => unit(state, 0, 'ranged', 16.5, y, 3));
    const bankTarget = building(state, 1, 'depot', 24.5, 14.5);
    const startingPoint = { x: 16.5, y: 20.5, level: 0 };
    const soldier = unit(state, 0, 'ranged', startingPoint.x, startingPoint.y, 3);
    const target = unit(state, 1, 'melee', 24.5, 23.5);
    const victims = [[31.5, 19.5], [31.5, 27.5]].map(([x, y]) => {
      const victim = unit(state, 1, 'melee', x, y); victim.hp = 1; victim.tactics!.morale = 100; return victim;
    });
    const victimSupport = [unit(state, 1, 'melee', 30.5, 18.5), unit(state, 1, 'melee', 30.5, 28.5)];
    const defender = unit(state, 0, 'melee', 10.5, 30.5); defender.facing = 0;
    const defenderCover = building(state, 0, 'depot', 13.5, 30.5);
    const enemy = unit(state, 1, 'ranged', 16.5, 30.5, 25); enemy.order = { type: 'attack', target: defender.id };
    initializeFactionSystems(state).fury[0] = 0;
    for (const actor of [...earners, soldier, defender]) actor.factionState = { trophyKills: 0 };
    write('factions-orcs-earned', state, { earners: earners.map(e => e.id), earnerPoints: earners.map(e => ({ x: e.x, y: e.y, level: e.level })), bankTarget: bankTarget.id, soldier: soldier.id, startingPoint, target: target.id, victims: victims.map(e => e.id), victimSupport: victimSupport.map(e => e.id), defender: defender.id, defenderCover: defenderCover.id, enemy: enemy.id, worker: worker.id, undergroundWorker: undergroundWorker.id }, {
      description: 'Three native Boltspitters begin outside weapon range and earn Fury by commanded attacks on a normal 600-health enemy depot. A separate fresh Boltspitter begins outside target range, then measures ordinary and Assault damage and earns two real trophies from wounded mortal enemies. A delayed enemy marksman measures Bulwark against a separate front-facing defender behind a normal native cover depot.',
      initialFury: 0, initialTrophies: 0, victimHealth: 1, victimMorale: 100,
      ownShooterCooldown: 3, enemyOrder: { actor: enemy.id, target: defender.id, initialCooldown: 25 },
      defenderFacing: 0, defenderCover: 'A normal completed owned Timber Yard stands between the marksman and defender, keeping the defender alive through the later native chant checks. No cover construction or payment is claimed.',
      troopSeparation: 'The comparison shooter starts beyond hostile acquisition range, with a native return point for the wait after Assault. Trophy victims are beyond seven tiles of the comparison firing position and eight tiles apart. The held worker supplies sight to their later native attacks.',
      victimSupport: 'Two normal held hostile Ironjaws at cooldown 1,000 provide each wounded victim with native morale support until commanded trophy kills.',
    });
  }
  {
    const { state, worker, undergroundWorker } = base('orcs');
    const standard = structure(state, TROPHY_STANDARD.id, { x: 22.5, y: 20.5, level: 0 }); standard.expires = 180;
    const soldier = unit(state, 0, 'ranged', 19.5, 20.5); soldier.tactics!.morale = 50;
    const enemy = unit(state, 1, 'siege', 29.5, 20.5, 3); enemy.order = { type: 'attack', target: standard.id };
    write('factions-standard-destruction', state, { standard: standard.id, soldier: soldier.id, enemy: enemy.id, worker: worker.id, undergroundWorker: undergroundWorker.id }, {
      description: 'A completed authored standard at its normal 160 health initially supports a held allied troop. Real hostile siege attacks destroy it; no trophy earning or standard construction is claimed for this input.',
      authoredStandard: { hp: 160, expires: 180, paidCost: 'None: this is an authored completed starting structure.' }, soldierMorale: 50,
      enemyOrder: { actor: enemy.id, target: standard.id, initialCooldown: 3 },
    });
  }
  {
    const { state, worker, undergroundWorker } = base('fairies');
    reset(worker, 16.5, 18.5);
    const caster = unit(state, 0, 'special', 24.5, 20.5);
    const companion = unit(state, 0, 'melee', 20.5, 20.5);
    write('factions-fairies-swap', state, { caster: caster.id, soldier: caster.id, companion: companion.id, worker: worker.id, undergroundWorker: undergroundWorker.id }, {
      description: 'There are no initial illusions. Native Conjure illusions creates canonical Veilweaver doubles; that same selected real Veilweaver then pays for a swap with its own double through the owned illusion picker. The normal held Thornblade is a companion only.',
      initialIllusions: 0,
    });
  }
  {
    const { state, worker, undergroundWorker } = base('fairies');
    reset(worker, 18.5, 20.5);
    const soldier = unit(state, 0, 'melee', 23.5, 20.5);
    const scout = unit(state, 1, 'cavalry', 27.5, 23.5);
    const grovePoint = { x: 20.5, y: 20.5, level: 0 };
    write('factions-fairies-grove', state, { worker: worker.id, soldier: soldier.id, scout: scout.id, grovePoint, undergroundWorker: undergroundWorker.id }, {
      description: 'Native construction plants the only enchanted grove. The true troop is three tiles from its center. A held hostile cavalry scout is more than three tiles from the true troop and less than eight from the grove, allowing concealment and an observed-scout harmless decoy.',
      initialGroves: 0, scoutWeaponCooldown: 1000,
    });
  }
  for (const negative of ['blocked', 'expired', 'hostile'] as const) {
    const { state, worker, undergroundWorker } = base('fairies', 'fairies');
    reset(worker, 18.5, 17.5);
    const soldier = unit(state, 0, 'melee', 20.5, 20.5);
    const side: Side = negative === 'hostile' ? 1 : 0;
    const caster = unit(state, side, 'special', 26.5, 20.5);
    refreshVisibility(state);
    assert(issueCommand(state, side, { type: 'ability', ids: [caster.id] }), 'Initial native ability must create canonical doubles.');
    const doubles = state.entities.filter(e => e.side === side && e.illusion);
    assert.equal(doubles.length, 2);
    const illusion = reset(doubles[0], 26.5, 20.5);
    state.entities = state.entities.filter(e => e.id !== doubles[1].id);
    reset(caster, 28.5, 17.5);
    if (negative === 'blocked') state.terrain[20 * state.width + 26] = 'rock';
    if (negative === 'expired') illusion.expires = .05;
    write(`factions-fairies-${negative}`, state, { soldier: soldier.id, illusion: illusion.id, worker: worker.id, negative, caster: caster.id, undergroundWorker: undergroundWorker.id }, {
      description: 'A public initial Fairy ability authors a legitimate definition-derived illusion before the recorder. The native swap must reject its declared blocked destination, expired lifetime or hostile owner without spending or moving the real troop.',
      setupAbility: { side, caster: caster.id, type: 'ability', retainedDoubles: 1, removedSecondDouble: doubles[1].id },
      illusion: { definitionId: illusion.definitionId, hp: illusion.hp, maxHp: illusion.maxHp, expires: illusion.expires, side },
      blockedRock: negative === 'blocked' ? { x: 26, y: 20, level: 0 } : null,
      expiryException: negative === 'expired' ? 'The canonical double lifetime is shortened to 0.05 seconds before recording; native stepping expires it.' : null,
    });
  }
  {
    const { state, worker, undergroundWorker } = base('dwarves');
    reset(worker, 18.5, 20.5);
    reset(undergroundWorker, 22.5, 20.5, 1);
    const soldiers = [unit(state, 0, 'melee', 18.5, 21.5), unit(state, 0, 'ranged', 18.5, 22.5)];
    const entrancePoint = { x: 20.5, y: 20.5, level: 0 }, exitPoint = { x: 24.5, y: 20.5, level: 1 };
    write('factions-dwarves-tunnels', state, { workers: [worker.id, undergroundWorker.id], soldiers: soldiers.map(e => e.id), entrancePoint, exitPoint, worker: worker.id, undergroundWorker: undergroundWorker.id }, {
      description: 'No tunnel exists initially. Native selected workers construct one surface entrance and one underground exit. Both held soldiers begin within three tiles of the planned origin, and public tunnel travel must change their map level.',
      initialTunnels: 0, sourceAssemblyPoint: { x: 18.5, y: 21.5, level: 0 },
    });
  }
  {
    const { state, worker, undergroundWorker } = base('dwarves');
    const entrance = structure(state, FACTION_STRUCTURE_INFO.tunnel.definition.id, { x: 20.5, y: 20.5, level: 0 });
    const exit = structure(state, FACTION_STRUCTURE_INFO.tunnel.definition.id, { x: 24.5, y: 20.5, level: 1 }); exit.hp = 10;
    const soldiers = [unit(state, 0, 'melee', 18.5, 20.5), unit(state, 0, 'ranged', 18.5, 21.5)];
    const enemy = unit(state, 1, 'siege', 31.5, 20.5, 1, 1); enemy.order = { type: 'attack', target: exit.id };
    reset(undergroundWorker, 21.5, 24.5, 1);
    write('factions-dwarves-exit-destruction', state, { entrance: entrance.id, exit: exit.id, soldiers: soldiers.map(e => e.id), enemy: enemy.id, worker: worker.id, undergroundWorker: undergroundWorker.id }, {
      description: 'Two authored completed native entrances link the levels. A real enemy shell destroys the wounded underground exit while public travel channels, so the squad must remain at the surface origin with its channel cancelled.',
      authoredTunnels: 'Completed starting structures; no construction or payment claimed.', exitHealth: 10,
      enemyOrder: { actor: enemy.id, target: exit.id, level: 1, initialCooldown: 1 },
    });
  }
  for (const modification of ['baseline', 'stone', 'grapeshot', 'incendiary', 'reinforced'] as const) {
    const { state, worker, undergroundWorker } = base('dwarves');
    reset(worker, 15.5, 17.5);
    const siege = unit(state, 0, 'siege', 18.5, 20.5, 12);
    const cannon = unit(state, 0, 'special', 18.5, 24.5);
    const targetBuilding = building(state, 1, 'wall', modification === 'grapeshot' ? 29.5 : 25.5, 20.5);
    const targetPoints = modification === 'grapeshot' ? [[24.5, 22.5], [26.5, 22.5], [27.5, 20.5]] : [[28.5, 22.5], [29.5, 22.5], [29.5, 20.5]];
    const targets = targetPoints.map(([x, y]) => unit(state, 1, 'melee', x, y));
    const enemy = unit(state, 1, 'ranged', 30.5, 15.5);
    const impactTimber = timber(state, { x: targetBuilding.x, y: targetBuilding.y, level: 0 });
    write(`factions-dwarves-${modification}`, state, { siege: siege.id, cannon: cannon.id, building: targetBuilding.id, targets: targets.map(e => e.id), worker: worker.id, timber: impactTimber.id, enemy: enemy.id, modification, undergroundWorker: undergroundWorker.id }, {
      description: 'Independent native artillery encounters compare the unfitted baseline with a fitting chosen in the production panel. A normal armored wall and infantry outside its footprint measure direct and splash effects. The siege starts without ammunition; native Deploy Ammunition must purchase it. The special Siege Cannon starts unentrenched.',
      initialFitting: null, initialAmmunition: 'None; siegeMode is absent.', ownArtilleryCooldown: { siege: 12, cannon: 1000 },
      cooldownReason: 'The 12-second initial siege cooldown permits native import, paid fitting and ammunition checkpoint controls before the recorded attack. Weapon cooldown then follows the native definition.',
      enemyOrder: { actor: enemy.id, order: 'hold', initialCooldown: 1000 },
      timberException: 'One unit of timber shares the wall impact tile. Ignition is tile-based; this authored resource lets a real paid incendiary impact create fire without manufacturing a fire or a pending shell.',
      targetIsolation: modification === 'grapeshot' ? 'The infantry group is the only initial enemy in native artillery range; the unused normal wall and idle marksman are farther away.' : 'The normal wall is the only initial enemy in native artillery range. The held infantry group and idle marksman are farther away, so any native held fire following deployment reaches the same wall as the explicit attack.',
      intendedModification: modification,
    });
  }
  {
    const { state, worker, undergroundWorker } = base('undead');
    reset(worker, 17.5, 17.5);
    const barracks = building(state, 0, 'barracks', 10.5, 15.5);
    const wagons = [namedUnit(state, 0, CORPSE_WAGON.id, 18.5, 20.5), namedUnit(state, 0, CORPSE_WAGON.id, 18.5, 22.5)];
    const victim = unit(state, 1, 'melee', 20.5, 20.5); victim.hp = 1; victim.tactics!.morale = 100;
    const victimSupport = unit(state, 1, 'melee', 22.5, 22.5);
    const killer = unit(state, 0, 'ranged', 12.5, 20.5, 3);
    const caster = unit(state, 0, 'special', 30.5, 20.5);
    write('factions-undead-wagons', state, { barracks: barracks.id, wagons: wagons.map(e => e.id), victim: victim.id, victimSupport: victimSupport.id, killer: killer.id, caster: caster.id, worker: worker.id, undergroundWorker: undergroundWorker.id }, {
      description: 'A normal native barracks permits recruitment cancellation and completion. Two authored empty native wagons compete for the one body produced by a real commanded kill after recruitment. The held shooter starts outside victim range, and the Gravecaller starts more than six tiles from the casualty; wagon delivery enables ordinary automatic raising.',
      authoredWagons: 'Two normal completed starting units, with no corpse cargo or corpse order.', initialCorpses: 0,
      victimHealth: 1, victimMorale: 100, killerCooldown: 3,
      victimSupport: 'A normal held hostile Ironjaw at cooldown 1,000 provides native morale support while the wounded victim waits through recruitment.',
    });
  }
  {
    const { state, worker, undergroundWorker, relicTemplate } = base('undead');
    reset(worker, 21.5, 17.5);
    const caster = unit(state, 0, 'special', 28.5, 20.5);
    const killer = unit(state, 0, 'ranged', 18.5, 25.5, 3);
    const victim = unit(state, 1, 'melee', 26.5, 23.5); victim.hp = 1; victim.tactics!.morale = 100;
    const victimSupport = unit(state, 1, 'melee', 27.5, 25.5);
    const capturer = unit(state, 0, 'melee', 23.5, 16.5);
    const site = Object.assign(relicTemplate, { x: 24.5, y: 16.5, level: 0, owner: 1 as Side });
    state.world!.sites.push(site);
    const necropolisPoint = { x: 24.5, y: 20.5, level: 0 }, outsidePoint = { x: 33.5, y: 20.5, level: 0 };
    write('factions-undead-necropolis', state, { worker: worker.id, caster: caster.id, killer: killer.id, victim: victim.id, victimSupport: victimSupport.id, capturer: capturer.id, site: site.id, necropolisPoint, outsidePoint, undergroundWorker: undergroundWorker.id }, {
      description: 'A native troop captures the initially hostile relic before native worker construction completes the forward necropolis nearby. A later native kill supplies an ordinary Gravecaller raise. The casualty is in caster range and within the future six-tile sustain radius. Native movement later takes the raised ally outside that radius.',
      initialNecropolises: 0, initialCorpses: 0, initialRaised: 0, victimHealth: 1, victimMorale: 100,
      killerCooldown: 3, dormancy: 'The held shooter begins outside the victim weapon range and approaches only after the native attack command following construction.',
      relic: { id: site.id, x: site.x, y: site.y, level: site.level, owner: site.owner, source: 'The complete relic runtime record comes from native createMatch world initialization. Only its position, layer and initial hostile owner are authored before recording.' },
      capturer: 'A normal held Boneguard is one tile from the relic, outside every enemy weapon range. Relic capture, ownership change and the later foundation occur through native controls.',
      victimSupport: 'A normal held hostile Ironjaw at cooldown 1,000 provides native morale support throughout relic capture and foundation construction.',
    });
  }
  {
    const { state, worker, undergroundWorker } = base('undead');
    const necropolis = structure(state, FACTION_STRUCTURE_INFO.necropolis.definition.id, { x: 24.5, y: 20.5, level: 0 });
    const caster = unit(state, 0, 'special', 20.5, 20.5);
    const body = { id: state.nextId++, x: 22.5, y: 20.5, level: 0, expires: 45 }; state.corpses.push(body);
    refreshVisibility(state);
    assert(issueCommand(state, 0, { type: 'ability', ids: [caster.id] }), 'Initial native raise must produce the canonical summoned ally.');
    const raised = state.entities.find(e => e.raised && !e.illusion)!; assert(raised);
    raised.hp = 20; reset(raised, 21.5, 22.5);
    const enemy = unit(state, 1, 'siege', 31.5, 20.5, 3); enemy.order = { type: 'attack', target: necropolis.id };
    enemy.orderQueue = [{ type: 'move', x: 33.5, y: 30.5, level: 0 }];
    write('factions-undead-necropolis-destruction', state, { necropolis: necropolis.id, raised: raised.id, enemy: enemy.id, worker: worker.id, caster: caster.id, undergroundWorker: undergroundWorker.id }, {
      description: 'A public initial raise ability produces a canonical Boneguard before recording. Its authored wounded health is sustained by a normal completed starting necropolis. Real siege attacks destroy that normal-health building; the raised ally must then resume lifetime loss.',
      setupAbility: { side: 0, caster: caster.id, type: 'ability', consumedBody: body.id }, raisedHealth: 20,
      raisedPoint: { x: raised.x, y: raised.y, level: raised.level }, raisedPosition: 'Within six tiles of the source and beyond the 2.05-tile shell splash reach, so actual source destruction does not kill the same ally.',
      authoredNecropolis: 'Normal definition health and completed progress; no construction or payment claimed.',
      enemyOrder: { actor: enemy.id, target: necropolis.id, initialCooldown: 3, queuedWithdrawal: { x: 33.5, y: 30.5, level: 0 } },
    });
  }
  for (const terrain of ['baseline', 'mud', 'shallows', 'water'] as const) {
    const { state, worker, undergroundWorker } = base('tideborn');
    for (let y = 0; y < state.height; y++) if (y < 20 || y > 24) state.terrain[y * state.width + 20] = 'rock';
    state.terrain[21 * state.width + 19] = 'rock';
    const protectedResource = timber(state, { x: 21.5, y: 23.5, level: 0 });
    const caster = unit(state, 0, 'special', 17.5, 26.5);
    const soldier = unit(state, 0, 'melee', 16.5, 22.5);
    const enemies = [21.5, 22.5, 23.5].map(y => {
      const enemy = unit(state, 1, 'melee', 28.5, y); enemy.order = { type: 'move', x: 14.5, y: 22.5, level: 0 }; return enemy;
    });
    const shapePoint = { x: 20.5, y: 22.5, level: 0 }, crossPoint = { x: 24.5, y: 22.5, level: 0 };
    const protectedTiles = [{ x: 19.5, y: 21.5, level: 0, before: 'rock', kind: 'rock' }, { x: 21.5, y: 23.5, level: 0, before: 'grass', kind: 'resource', resource: protectedResource.id }];
    write(`factions-tideborn-${terrain}`, state, { caster: caster.id, soldier: soldier.id, enemies: enemies.map(e => e.id), shapePoint, crossPoint, protectedTiles, worker: worker.id, undergroundWorker: undergroundWorker.id, terrain }, {
      description: 'Independent encounters share a rock wall with the only grass opening at rows 20 through 24. Native shaping changes that opening while both initial armies are outside the cast radius. Mud and shallows permit Tideborn movement while delaying ordinary enemy troops; the baseline supplies their unshaped travel. Deep water blocks every faction until native restoration.',
      rockWall: { x: 20, openingRows: [20, 21, 22, 23, 24], level: 0 },
      protectedRock: protectedTiles[0], protectedResource: protectedTiles[1],
      enemyOrders: enemies.map(e => ({ actor: e.id, order: e.order, initialCooldown: 1000 })),
      waterConstraint: 'Tideborn terrain traits apply to mud and shallows only. The current native navigation predicate also rejects deep water for Tideborn; no water crossing is claimed.',
      intendedTerrain: terrain,
    });
  }
  for (const mode of ['connect', 'break'] as const) {
    const { state, worker, undergroundWorker, hq } = base('automata');
    reset(hq, 6.5, 20.5); state.starts[0] = { x: hq.x, y: hq.y, level: 0 };
    reset(worker, 11.5, mode === 'connect' ? 17.5 : 24.5);
    const tower = building(state, 0, 'tower', 20.5, 20.5); tower.cooldown = mode === 'connect' ? 0 : 3;
    const relayPoint = { x: 13.5, y: 20.5, level: 0 };
    const enemies = [[26.5, 20.5], [26.5, 22.5]].map(([x, y], i) => {
      const enemy = unit(state, 1, 'ranged', x, y, 3 + i); enemy.order = { type: 'attack', target: tower.id }; return enemy;
    });
    let relay: Entity | undefined, demolisher: Entity | undefined;
    if (mode === 'break') {
      relay = structure(state, FACTION_STRUCTURE_INFO['power-relay'].definition.id, relayPoint); relay.hp = 10;
      demolisher = unit(state, 1, 'siege', 6.5, 16.5, 12); demolisher.order = { type: 'attack', target: relay.id };
      refreshPowerNetworks(state, 0); tower.shield = 0;
    }
    write(`factions-automata-${mode}`, state, { hq: hq.id, tower: tower.id, worker: worker.id, relayPoint, enemies: enemies.map(e => e.id), ...(relay ? { relay: relay.id } : {}), ...(demolisher ? { demolisher: demolisher.id } : {}), undergroundWorker: undergroundWorker.id }, {
      description: mode === 'connect' ? 'The tower begins fourteen tiles from its HQ, disconnected. A native worker builds the seven-tile midpoint relay. Real enemy attacks and powered tower fire then measure the connected graph and shared shield reserves.' : 'A canonical authored HQ-relay-tower component begins with the tower local shield depleted. Enemy marksmen draw actual shield reserves from its component. A delayed enemy siege attack destroys the wounded relay, disconnecting the tower; the safe owned worker can rebuild a native paid relay.',
      towerWeaponCooldown: tower.cooldown, enemyOrders: enemies.map(e => ({ actor: e.id, target: tower.id, initialCooldown: e.cooldown })),
      authoredRelay: relay ? { hp: 10, progress: 1, paidCost: 'None: completed starting structure.' } : null,
      initialTowerShield: mode === 'break' ? 0 : 'Native graph default of 80 on the disconnected completed tower.',
      demolisherOrder: demolisher ? { actor: demolisher.id, target: relay!.id, initialCooldown: 12, reason: 'The shooter is outside tower range and delays relay destruction until shared damage can be observed.' } : null,
      graphSetup: 'refreshPowerNetworks(state, 0) authors the native graph and capacities without advancing the engine. No hand-written connection or shield capacity is used.',
    });
  }

  const manifest: FactionPowerManifest = { schema: 1, group: 'factions', sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, setup: 'Authored native faction starting conditions only. All declared setup precedes recording; generation advances zero ticks. Native production UI supplies subsequent player commands and simulation.', scenarios };
  writeFileSync(resolve(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(`Authored ${Object.keys(scenarios).length} native faction fixtures at ${sourceCommit}; SAVE${SAVE_VERSION}, rules ${SIMULATION_REVISION}; zero simulation ticks.`);
  return manifest;
}
