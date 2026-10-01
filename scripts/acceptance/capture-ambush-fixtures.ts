import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTIONS } from '../../src/core/content';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { SAVE_VERSION } from '../../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition } from '../../src/core/simulation';
import { canAmbush, initializeTactics, TACTICS } from '../../src/core/tactics';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { BuiltinFactionId, Entity, GameState, Side, UnitRole } from '../../src/core/types';

export interface CaptureAmbushFixture {
  file: string;
  ids: Record<string, number | number[] | { x: number; y: number; level: number }>;
  authored: Record<string, unknown>;
  initialTick: number;
  initialTime: number;
  faction: BuiltinFactionId;
}

/** All mutations below author the initial encounter, before the native app records it. */
function place(entity: Entity, x: number, y: number, level = 0, cooldown = 1000) {
  entity.x = x; entity.y = y; entity.level = level;
  entity.order = { type: 'hold' }; entity.path = []; entity.cooldown = cooldown;
  entity.animation = 'idle'; entity.animTime = 0; entity.facing = 4;
  delete entity.orderQueue;
  return entity;
}

function base(faction: BuiltinFactionId, opponent: BuiltinFactionId = 'orcs') {
  const state = createMatch({
    map: { seed: 4127, size: 'medium', biome: 'forest' },
    rules: { startingAge: 3, friendlyFire: false },
    players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'human', handicap: { startingResources: { wood: 2000, ore: 2000, crystal: 500 } } },
      { id: 1, teamId: 1, factionId: opponent, controller: 'external' },
    ],
  });
  assert.equal(state.world?.levels.length, 2);
  for (const layer of state.world!.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  state.world!.levels[0].terrain = state.terrain;
  state.world!.transitions = []; state.world!.bridges = []; state.world!.sites = [];
  state.world!.creatures = []; state.world!.fires = []; state.world!.iceTiles = [];
  state.resources = [];
  for (const entity of state.entities) {
    if (entity.side === 0) place(entity, entity.role === 'hq' ? 6.5 : 5.5 + (entity.id % 5), entity.role === 'hq' ? 17.5 : 13.5);
    else place(entity, entity.role === 'hq' ? 42.5 : 39.5 + (entity.id % 5) * .8, entity.role === 'hq' ? 42.5 : 39.5);
  }
  state.starts[0] = { x: 6.5, y: 17.5, level: 0 };
  state.starts[1] = { x: 42.5, y: 42.5, level: 0 };
  const workers = state.entities.filter(e => e.side === 0 && e.role === 'worker');
  const underground = workers.at(-1)!;
  place(underground, 10.5, 10.5, 1);
  const soldier = state.entities.find(e => e.side === 0 && e.role === 'melee')!;
  return { state, workers, underground, soldier };
}

function unit(state: GameState, side: Side, role: UnitRole, x: number, y: number, cooldown = 1000) {
  const faction = state.players[side].faction as BuiltinFactionId;
  return place(spawnDefinition(state, side, 'unit', FACTIONS[faction].units[role].id, x, y), x, y, 0, cooldown);
}

function wood(state: GameState, x: number, y: number) {
  const node = { id: state.nextId++, kind: 'wood' as const, x, y, level: 0, amount: 100, maxAmount: 100 };
  state.resources.push(node);
  return node;
}

export function buildCaptureAmbushMoraleFixtures(outDirectory: string, sourceCommit: string) {
  assert.match(sourceCommit, /^[0-9a-f]{40}$/, 'Provide the dispatched full source commit');
  const out = resolve(outDirectory);
  mkdirSync(out, { recursive: true });
  const scenarios: Record<string, CaptureAmbushFixture> = {};
  function write(name: string, state: GameState, ids: CaptureAmbushFixture['ids'], authored: Record<string, unknown>) {
    refreshVisibility(state);
    const file = createSessionFile(state), decoded = decodeSessionFile(file);
    assert.equal(file.game.version, SAVE_VERSION);
    assert.equal(decoded.state.world?.levels.length, 2);
    assert(decoded.state.entities.some(e => e.side === 0 && e.level === 1));
    assert.equal(file.replay, undefined, 'No history can precede authored setup');
    writeFileSync(resolve(out, `${name}.json`), `${JSON.stringify(file, null, 2)}\n`, { flag: 'wx' });
    scenarios[name] = { file: `${name}.json`, ids, authored, initialTick: state.tick, initialTime: state.time, faction: state.players[0].faction as BuiltinFactionId };
  }

  {
    const { state, workers, underground } = base('fairies');
    const captor = unit(state, 0, 'melee', 18.4, 20.5, 0);
    const engine = unit(state, 1, 'siege', 20.5, 20.5);
    assert.equal(initializeTactics(state, engine).siegeCrew!.hp, TACTICS.crewHp);
    assert.equal(initializeTactics(state, engine).siegeCrew!.uncrewed, false);
    const target = place(spawnDefinition(state, 1, 'building', FACTIONS.orcs.buildings.depot.id, 37.5, 20.5), 37.5, 20.5);
    // The worker observes the distant target without attacking it. It is outside capture contest range.
    place(workers[0], 35.5, 23.5);
    write('siege-full-crew-capture', state, {
      captor: captor.id, engine: engine.id, target: target.id, observer: workers[0].id,
      undergroundWorker: underground.id, moveDestination: { x: 26.5, y: 20.5, level: 0 },
    }, {
      description: 'A Thornblade starts outside melee range of a full-crew Orc engine. The engine has 42 crew health and full hull health. The player attacks its crew, channels capture, moves the captured engine and orders it to fire at an Orc depot.',
      engineCrewHealth: TACTICS.crewHp, engineHullHealth: engine.hp, engineDefinitionId: engine.definitionId,
      engineCooldown: engine.cooldown, targetHealth: target.hp, captorCooldown: captor.cooldown,
      combatSuppression: 'The hostile engine begins with a 1000-second cooldown so it does not kill the captor during the acceptance encounter. Crew health is unchanged from the production default.',
    });
  }

  {
    const { state, underground } = base('fairies', 'dwarves');
    const broken = unit(state, 1, 'ranged', 22.5, 24.5);
    broken.hp = 30; initializeTactics(state, broken).morale = 1;
    const captors = [
      unit(state, 0, 'melee', 20.9, 24.5), unit(state, 0, 'melee', 24.1, 24.5), unit(state, 0, 'melee', 22.5, 26.1),
    ];
    write('surrounded-surrender', state, {
      broken: broken.id, captors: captors.map(e => e.id), undergroundWorker: underground.id,
      moveDestination: { x: 28.5, y: 24.5, level: 0 },
    }, {
      description: 'A wounded Deepforge ranged troop begins at 1 morale, surrounded by three Wild Court melee troops in opposing sectors. Native engine ticks decide surrender. The player then moves the surrendered troop.',
      brokenHealth: 30, brokenMaxHealth: broken.maxHp, brokenMorale: 1, originalFaction: 'dwarves', originalDefinitionId: broken.definitionId,
      captorPositions: captors.map(({ id, x, y }) => ({ id, x, y })), captorCooldown: 1000,
      combatSuppression: 'The surrounding troops begin with a long cooldown so the surrender check retains the authored 30 health rather than killing the troop first.',
    });
  }

  {
    const { state, underground, soldier } = base('orcs');
    place(soldier, 11.5, 17.5);
    const retreater = unit(state, 0, 'melee', 22.5, 17.5);
    retreater.hp = Math.floor(retreater.maxHp * .45);
    initializeTactics(state, retreater).morale = 28;
    const enemy = unit(state, 1, 'melee', 26.5, 17.5);
    write('active-retreat-save', state, {
      retreater: retreater.id, enemy: enemy.id, support: soldier.id, undergroundWorker: underground.id,
    }, {
      description: 'A wounded isolated Ironjaw begins at 28 morale beside a visible hostile troop. Morale loss starts a real retreat toward its distant headquarters. A friendly warrior waits along its route.',
      retreaterHealth: retreater.hp, retreaterMaxHealth: retreater.maxHp, retreaterMorale: 28, enemyCooldown: 1000,
      supportPosition: { x: soldier.x, y: soldier.y }, headquarters: { x: state.starts[0].x, y: state.starts[0].y },
    });
  }

  {
    const { state, underground, soldier } = base('fairies');
    const ambusher = unit(state, 0, 'ranged', 20.5, 20.5, 6);
    const timber = wood(state, 20.5, 21.5);
    const wrongTarget = unit(state, 1, 'worker', 22, 20.5);
    const trigger = unit(state, 1, 'melee', 40.5, 40.5);
    // This marching order is part of the authored initial state, before any recorder exists.
    refreshVisibility(state);
    assert(issueCommand(state, 1, { type: 'move', ids: [trigger.id], x: 21.8, y: 20.5, level: 0 }));
    assert(canAmbush(state, ambusher)); assert(!canAmbush(state, soldier));
    write('ambush-selected-trigger', state, {
      ambusher: ambusher.id, dryTroop: soldier.id, wrongTarget: wrongTarget.id, trigger: trigger.id,
      timber: timber.id, undergroundWorker: underground.id,
    }, {
      description: 'A Mothbow beside standing timber can ambush. A dry-ground warrior cannot. A worker already inside the chosen radius is the wrong target role. A full-health hostile melee troop begins a long march into the radius.',
      timberAmount: 100, ambusherCooldown: 6, radius: 2, target: 'melee',
      wrongTargetHealth: wrongTarget.hp, triggerHealth: trigger.hp,
      marchingOrder: { type: 'move', x: 21.8, y: 20.5, level: 0 },
      initialOrders: 'The hostile march is authored before native recording. No hostile order is injected later.',
    });
  }

  {
    const { state, workers, underground } = base('fairies');
    const ambusher = unit(state, 0, 'ranged', 20.5, 20.5, 0);
    const timber = wood(state, 20.5, 21.5);
    const scout = unit(state, 1, 'cavalry', 22.8, 20.5);
    place(workers[0], 19.5, 21.5, 0, 0);
    write('ambush-scout-release-firebreak', state, {
      ambusher: ambusher.id, scout: scout.id, worker: workers[0].id, timber: timber.id,
      undergroundWorker: underground.id, forestWork: { x: 20.5, y: 21.5, level: 0 },
    }, {
      description: 'A hostile scout is 2.3 tiles from a woodland archer. The player chooses buildings within radius 1 so the scout cannot trigger fire. The scout can observe the concealed archer without learning its trigger. The player releases, rearms, then clears the last timber through native Forest work.',
      radius: 1, target: 'building', timberAmount: 100, scoutDistance: 2.3,
      workerCooldown: 0, firebreakCost: { wood: 5, ore: 0 },
    });
  }

  const manifest = {
    schema: 1, sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION,
    setup: 'Authored SAVE4 layered encounters. Every fixture is serialized and strictly decoded before native import. No recorder exists during setup; native app commands and engine ticks produce all later changes.',
    scenarios,
  };
  writeFileSync(resolve(out, 'capture-ambush-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return manifest;
}
