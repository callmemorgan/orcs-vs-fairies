import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createMatch, stepGame, isGameOver, isHostile, playerAge, saveGame } from './frozen.mjs';

const count = Number(process.argv[2]);
if (![4, 6, 8].includes(count)) throw new Error('Run 4, 6, or 8 players.');
const sourceSha = 'c1f22643fc3b73e16e58965f4e31bd10bfc08e04';
const out = new URL(`./${count / 2}v${count / 2}`, import.meta.url).pathname;
const mapSize = count === 4 ? 'large' : 'huge';
const factions = ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata'];
const config = {
  schemaVersion: 1,
  map: { seed: 4127, size: mapSize },
  players: Array.from({ length: count }, (_, id) => ({ id, teamId: id % 2, factionId: factions[id % factions.length], controller: 'ai' })),
  rules: { sharedVision: true, startingAge: 1 },
};
const metrics = Array.from({ length: count }, () => ({ trained: 0, gathered: { wood: 0, ore: 0, crystal: 0 }, attacks: 0, damage: 0, deaths: 0, buildingsCompleted: 0, researchCompleted: 0, abilities: 0, trainedRoles: {}, attackRoles: {}, builtRoles: {}, maxPopulation: 0, maxReserved: 0, maxPopulationPlusReserved: 0, highestAge: 1 }));
const started = performance.now();
const s = createMatch(config);
const checkpoints = [];
let failed = null, lastAttackTime = 0;
const sourceSha256 = Object.fromEntries(['types.ts', 'content.ts', 'simulation.ts', 'maps.ts', 'navigation.ts', 'saves.ts'].map(file => [file, createHash('sha256').update(readFileSync(new URL(`./source/core/${file}`, import.meta.url))).digest('hex')]));
writeFileSync(`${out}-method.json`, JSON.stringify({ sourceSha, sourceSha256, frozenBundleSha256: createHash('sha256').update(readFileSync(new URL('./frozen.mjs', import.meta.url))).digest('hex'), config, stepSeconds: .05, maxMinutes: 45, mutationPolicy: 'No state injection or content overrides; only createMatch and stepGame with AI controllers.', validationPolicy: 'Every tick checks finite player balances, ownership population, population plus reserved queues against hard limits, legal queue lengths, finite in-bounds positions, and hostile-only attack events. Every 5 simulated seconds checks finite entity properties, resource ranges, and completed-building capacity totals. A loss of current housing may pause already-paid queues; it is not a violation of hard limits.' }, null, 2));
const require = (ok, message) => { if (!ok) throw new Error(message); };
function inspect(tick) {
  const reserved = Array(count).fill(0), populations = Array(count).fill(0), capacities = Array(count).fill(0);
  for (const e of s.entities) {
    require(Number.isFinite(e.x) && Number.isFinite(e.y) && e.x >= 0 && e.y >= 0 && e.x < s.width && e.y < s.height, `Invalid position ${e.id} player ${e.side} at tick ${tick}`);
    if (e.hp > 0) {
      if (e.kind === 'unit' && !e.illusion) populations[e.side]++;
      if (e.kind === 'building') {
        require(e.queue.length <= 5, `Invalid queue length ${e.id}`);
        reserved[e.side] += e.queue.length;
        if (e.progress === 1) capacities[e.side] += e.role === 'hq' ? 12 : e.role === 'depot' ? 10 : 0;
      }
    }
    if (tick % 100 === 0) {
      for (const key of ['hp', 'maxHp', 'cooldown', 'progress', 'trainProgress', 'researchProgress', 'carried']) require(Number.isFinite(e[key]), `Nonfinite entity ${e.id}.${key}`);
      require(e.hp >= 0 && e.hp <= e.maxHp + 1e-7 && e.progress >= 0 && e.progress <= 1 && e.carried >= 0 && e.carried <= 18 + 1e-7, `Invalid entity values ${e.id}`);
    }
  }
  for (let side = 0; side < count; side++) {
    const p = s.players[side], m = metrics[side];
    for (const key of ['wood', 'ore', 'crystal', 'population', 'cap']) require(Number.isFinite(p[key]) && p[key] >= 0, `Invalid player ${side}.${key} at tick ${tick}`);
    require(p.population === populations[side], `Population mismatch for player ${side} at tick ${tick}`);
    require(p.population + reserved[side] <= s.populationLimits[side], `Population plus paid queue exceeds hard limit for player ${side} at tick ${tick}`);
    require(p.cap === Math.min(s.populationLimits[side], capacities[side]), `Capacity mismatch for player ${side} at tick ${tick}`);
    m.maxPopulation = Math.max(m.maxPopulation, p.population);
    m.maxReserved = Math.max(m.maxReserved, reserved[side]);
    m.maxPopulationPlusReserved = Math.max(m.maxPopulationPlusReserved, p.population + reserved[side]);
    m.highestAge = Math.max(m.highestAge, playerAge(p));
  }
  if (tick % 100 === 0) for (const r of s.resources) require(Number.isFinite(r.amount) && Number.isFinite(r.maxAmount) && r.amount >= 0 && r.amount <= r.maxAmount && Number.isFinite(r.x) && Number.isFinite(r.y), `Invalid resource ${r.id}`);
}
try {
  inspect(0);
  for (let tick = 1; tick <= 20 * 45 * 60 && !isGameOver(s); tick++) {
    stepGame(s, .05);
    for (const e of s.events) {
      const m = metrics[e.side], source = s.entities.find(u => u.id === e.source);
      require(Number.isFinite(e.x) && Number.isFinite(e.y), `Invalid event position at tick ${tick}`);
      if (e.amount !== undefined) require(Number.isFinite(e.amount) && e.amount >= 0, `Invalid event amount at tick ${tick}`);
      if (e.type === 'train') { m.trained++; if (source) m.trainedRoles[source.role] = (m.trainedRoles[source.role] ?? 0) + 1; }
      if (e.type === 'gather' && e.resource) m.gathered[e.resource] += e.amount ?? 0;
      if (e.type === 'attack') {
        const target = s.entities.find(u => u.id === e.target);
        require(target && isHostile(s, e.side, target.side), `Nonhostile attack at tick ${tick}`);
        m.attacks++; m.damage += e.amount ?? 0; lastAttackTime = s.time;
        if (source) m.attackRoles[source.role] = (m.attackRoles[source.role] ?? 0) + 1;
      }
      if (e.type === 'death') m.deaths++;
      if (e.type === 'ability') m.abilities++;
      if (e.type === 'research' && e.text?.endsWith(' complete')) m.researchCompleted++;
      if (e.type === 'build' && e.text === 'Construction complete') { m.buildingsCompleted++; if (source) m.builtRoles[source.role] = (m.builtRoles[source.role] ?? 0) + 1; }
    }
    inspect(tick);
    if (tick % 1200 === 0) {
      const point = { tick, seconds: s.time, wallSeconds: (performance.now() - started) / 1000, alive: s.entities.filter(e => e.hp > 0).length, eliminated: [...s.eliminated], players: s.players.map((p, side) => ({ side, population: p.population, cap: p.cap, wood: p.wood, ore: p.ore, crystal: p.crystal, age: playerAge(p), attacks: metrics[side].attacks, trained: metrics[side].trained })) };
      checkpoints.push(point);
      appendFileSync(`${out}-progress.jsonl`, JSON.stringify(point) + '\n');
      if (tick % 6000 === 0) console.log(JSON.stringify({ format: `${count / 2}v${count / 2}`, ...point }));
    }
  }
  inspect(s.tick);
  if (isGameOver(s)) {
    const livingTeams = [...new Set(s.entities.filter(e => e.hp > 0 && e.role === 'hq' && e.progress === 1).map(e => s.teams[e.side]))];
    if (s.draw) require(livingTeams.length === 0 && s.winner === null && s.winningTeam === null, 'Draw disagrees with surviving HQs');
    else require(livingTeams.length === 1 && livingTeams[0] === s.winningTeam && s.winner !== null && s.teams[s.winner] === s.winningTeam, 'Winning team disagrees with surviving HQs');
  }
} catch (error) { failed = { message: error.message, stack: error.stack }; }
const result = { sourceSha, format: `${count / 2}v${count / 2}`, config, actualMapSize: s.mapSize, ticks: s.tick, seconds: s.time, wallSeconds: (performance.now() - started) / 1000, status: failed ? 'invalid' : isGameOver(s) ? 'complete' : 'timeout', failed, winner: s.winner, winningTeam: s.winningTeam, draw: s.draw, eliminated: s.eliminated, secondsWithoutCombat: s.time - lastAttackTime, metrics, finalPlayers: s.players, liveHqs: s.entities.filter(e => e.hp > 0 && e.role === 'hq').map(e => ({ id: e.id, side: e.side, team: s.teams[e.side], hp: e.hp, progress: e.progress, x: e.x, y: e.y })), livingEntities: s.entities.filter(e => e.hp > 0).length, checkpointCount: checkpoints.length };
writeFileSync(`${out}-result.json`, JSON.stringify(result, null, 2));
writeFileSync(`${out}-final-save.json`, JSON.stringify(saveGame(s)));
console.log(JSON.stringify({ final: true, ...result }));
if (failed || !isGameOver(s)) process.exitCode = 1;
