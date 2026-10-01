import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTIONS } from '../src/core/content';
import { initializeFactionSystems } from '../src/core/faction-systems';
import { createMatch, refreshVisibility, spawnDefinition } from '../src/core/simulation';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { initializeTactics } from '../src/core/tactics';
import type { BuiltinFactionId, Entity, GameState } from '../src/core/types';

// Copy to scripts/combined_combat_scenarios.ts before bundling. These are authored
// encounters, not claims of resources, trophies or Fury earned in a normal match.
// Every subsequent browser action goes through the production application's UI.
const out = resolve(process.argv[2] ?? 'docs/evidence/assembled-combat-20261001/fixtures');
mkdirSync(out, { recursive: true });
const manifest: Record<string, unknown> = {};

function reset(entity: Entity, x: number, y: number, level = 0) {
  entity.x = x; entity.y = y; entity.level = level;
  entity.order = { type: 'hold' }; entity.path = []; entity.cooldown = 0;
  entity.animation = 'idle'; entity.animTime = 0;
  delete entity.orderQueue;
}
function base(faction: BuiltinFactionId) {
  const state = createMatch({
    map: { seed: 4127, size: 'small', biome: 'forest' },
    rules: { startingAge: 3, friendlyFire: false },
    players: [
      { id: 0, teamId: 0, factionId: faction, controller: 'human', handicap: { startingResources: { wood: 2000, ore: 2000, crystal: 500 } } },
      { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
    ],
  });
  assert.equal(state.world!.levels.length, 2);
  for (const layer of state.world!.levels) { layer.terrain.fill('grass'); layer.elevation.fill(0); }
  state.world!.levels[0].terrain = state.terrain;
  state.world!.transitions = []; state.world!.bridges = []; state.world!.sites = [];
  state.world!.creatures = []; state.world!.fires = []; state.world!.iceTiles = [];
  state.resources = [];
  const own = state.entities.filter(e => e.side === 0), hostile = state.entities.filter(e => e.side === 1);
  const hq = own.find(e => e.role === 'hq')!;
  reset(hq, 6.5, 16.5); state.starts[0] = { x: 6.5, y: 16.5, level: 0 };
  reset(hostile.find(e => e.role === 'hq')!, 30.5, 30.5);
  state.starts[1] = { x: 30.5, y: 30.5, level: 0 };
  const workers = own.filter(e => e.role === 'worker');
  workers.forEach((e, i) => reset(e, 5.5 + i, 23.5));
  // Keep one troop underground so imports must preserve a real second layer.
  reset(workers.at(-1)!, 10.5, 10.5, 1);
  hostile.filter(e => e.kind === 'unit').forEach((e, i) => reset(e, 28.5 + i * .8, 27.5));
  const soldier = own.find(e => e.role === 'melee')!; reset(soldier, 14.5, 17.5);
  initializeFactionSystems(state);
  return { state, hq, workers, soldier };
}
function spawn(state: GameState, faction: BuiltinFactionId, role: 'melee' | 'siege' | 'tower', x: number, y: number) {
  const entity = role === 'tower'
    ? spawnDefinition(state, 0, 'building', FACTIONS[faction].buildings.tower.id, x, y)
    : spawnDefinition(state, 0, 'unit', FACTIONS[faction].units[role].id, x, y);
  reset(entity, x, y); return entity;
}
function write(name: string, state: GameState, ids: Record<string, unknown>, authored: Record<string, unknown>) {
  refreshVisibility(state);
  const file = createSessionFile(state), decoded = decodeSessionFile(file);
  assert.equal(decoded.state.world!.levels.length, 2);
  assert(decoded.state.entities.some(e => e.side === 0 && e.level === 1));
  writeFileSync(resolve(out, `${name}.json`), JSON.stringify(file, null, 2));
  manifest[name] = { file: `${name}.json`, ids, authored, initialTick: state.tick, initialTime: state.time, faction: state.players[0].faction };
}

{
  const { state, soldier, workers } = base('orcs');
  const army = [soldier, spawn(state, 'orcs', 'melee', 13.5, 18.7), spawn(state, 'orcs', 'melee', 15.5, 18.7), spawn(state, 'orcs', 'melee', 14.5, 20)];
  state.factionSystems!.fury[0] = 100;
  soldier.factionState = { trophyKills: 2 };
  write('orcs-formation', state, { army: army.map(e => e.id), bearer: soldier.id, undergroundWorker: workers.at(-1)!.id }, { resources: { wood: 2000, ore: 2000, crystal: 500 }, fury: 100, bearerTrophies: 2, description: 'Four uninjured combat troops. Trophies and Fury are authored starting conditions.' });
}
{
  const { state, soldier, workers } = base('orcs');
  const support = spawn(state, 'orcs', 'melee', 13.5, 18.7);
  const retreater = spawn(state, 'orcs', 'melee', 22.5, 17.5);
  retreater.hp = Math.floor(retreater.maxHp * .45);
  initializeTactics(state, retreater).morale = 28;
  const enemy = state.entities.find(e => e.side === 1 && e.role === 'melee')!;
  reset(enemy, 26.5, 17.5); enemy.cooldown = 100;
  soldier.factionState = { trophyKills: 2 };
  state.factionSystems!.fury[0] = 50;
  write('orcs-rally', state, { bearer: soldier.id, support: support.id, retreater: retreater.id, enemy: enemy.id, undergroundWorker: workers.at(-1)!.id }, { resources: { wood: 2000, ore: 2000, crystal: 500 }, fury: 50, bearerTrophies: 2, retreaterMorale: 28, retreaterHealth: retreater.hp, enemyCooldown: 100, description: 'One wounded isolated warrior near a visible enemy loses morale. A distant friendly band and a player-raised standard provide support during its retreat.' });
}
{
  const { state, workers } = base('dwarves');
  const cannon = spawn(state, 'dwarves', 'siege', 14.5, 17.5);
  cannon.siegeMode = { ammo: 0, deployed: false };
  const bridge = { id: state.nextId++, x: 21.5, y: 17.5, level: 0, hp: 1000, maxHp: 1000, tiles: [17 * state.width + 21], rebuilding: 0, repairSide: null };
  state.world!.bridges.push(bridge);
  state.terrain[bridge.tiles[0]] = 'bridge';
  // A nearby parallel channel makes the crossing visible as a world structure.
  state.terrain[16 * state.width + 21] = 'water'; state.terrain[18 * state.width + 21] = 'water';
  write('dwarves', state, { cannon: cannon.id, bridge: bridge.id, undergroundWorker: workers.at(-1)!.id }, { resources: { wood: 2000, ore: 2000, crystal: 500 }, cannonAmmo: 0, bridgeHealth: 1000, description: 'An unloaded Deepforge cannon faces a neutral world bridge within range. Deployment, ammunition and the stone fitting must be purchased through controls.' });
}
{
  const { state, hq, workers } = base('automata');
  reset(workers[0], 12.5, 16.5);
  const tower = spawn(state, 'automata', 'tower', 20.5, 16.5);
  write('automata', state, { hq: hq.id, worker: workers[0].id, tower: tower.id, undergroundWorker: workers.at(-1)!.id, placement: { x: 13.5, y: 16.5, level: 0 } }, { resources: { wood: 2000, ore: 2000, crystal: 500 }, description: 'A disconnected tower is fourteen tiles from headquarters. A worker can build a Power Relay seven tiles from each endpoint.' });
}
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify({ schema: 1, setup: 'Authored layered encounters, generated and validated with production createSessionFile/decodeSessionFile. No fixture page or browser state mutation.', scenarios: manifest }, null, 2));
console.log(`Validated four authored layered session files in ${out}`);
