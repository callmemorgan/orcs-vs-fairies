#!/usr/bin/env node
import { createInterface } from 'node:readline';

// This agent imports no game implementation. Every decision uses the supplied observation.
const styleIndex = process.argv.indexOf('--style');
const style = styleIndex < 0 ? 'push' : process.argv[styleIndex + 1];
if (!['push', 'idle', 'hang', 'crash'].includes(style)) throw new Error('Use --style push, idle, hang or crash.');
if (style === 'hang') { setInterval(() => {}, 1000); process.stdin.resume(); }
else for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const request = JSON.parse(line);
  if (style === 'crash') { process.stderr.write('Intentional tournament crash fixture.\n'); process.exit(7); }
  if (request.protocol !== 'orcs-vs-fairies/tournament-agent' || request.version !== 1 || request.type !== 'turn') throw new Error('Unsupported tournament agent protocol.');
  const commands = style === 'idle' ? [] : decide(request.observation);
  process.stdout.write(JSON.stringify({ requestId: request.requestId, commands }) + '\n');
}

function decide(obs) {
  const own = obs.entities.filter(entity => entity.side === obs.side);
  const workers = own.filter(entity => entity.role === 'worker');
  const buildings = own.filter(entity => entity.kind === 'building');
  const hq = buildings.find(entity => entity.role === 'hq');
  if (!hq) return [];
  const defs = obs.content.faction, bank = { ...obs.player }, commands = [];
  let reserved = buildings.reduce((sum, building) => sum + building.queue.length, 0);
  const afford = cost => ['wood', 'ore', 'crystal'].every(kind => bank[kind] >= cost[kind]);
  const pay = cost => { for (const kind of ['wood', 'ore', 'crystal']) bank[kind] -= cost[kind]; };
  const train = (building, role) => {
    if (bank.population + reserved >= bank.cap || building.queue.length >= 2 || !afford(defs.units[role].cost)) return;
    commands.push({ type: 'train', id: building.id, role }); pay(defs.units[role].cost); reserved++;
  };
  const nodes = obs.resources.filter(node => node.visible && node.amount > 0);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const worker of workers) {
    if (!['idle', 'gather'].includes(worker.order.type)) continue;
    if (worker.order.type === 'gather' && nodes.some(node => node.id === worker.order.target && node.amount > 0)) continue;
    const kind = worker.id % 3 === 0 ? 'ore' : 'wood';
    const node = nodes.filter(node => node.kind === kind).sort((a, b) => distance(worker, a) - distance(worker, b))[0] ?? nodes[0];
    if (node) commands.push({ type: 'gather', ids: [worker.id], target: node.id });
  }
  if (workers.length + hq.queue.filter(role => role === 'worker').length < 9) train(hq, 'worker');
  const barracks = buildings.filter(building => building.role === 'barracks');
  const role = !barracks.length ? 'barracks' : bank.cap - bank.population - reserved < 4 && !buildings.some(building => building.role === 'depot' && building.progress < 1) ? 'depot' : obs.time > 100 && barracks.length < 2 ? 'barracks' : null;
  const available = workers.find(worker => ['idle', 'gather'].includes(worker.order.type));
  if (role && available && afford(defs.buildings[role].cost) && !workers.some(worker => worker.order.type === 'build')) {
    const radius = defs.buildings[role].size / 2, visible = new Set(obs.visible), width = obs.map.width;
    const placeable = (x, y) => {
      if (x - radius < .5 || y - radius < .5 || x + radius > width - .5 || y + radius > obs.map.height - .5) return false;
      for (const dx of [-radius, 0, radius]) for (const dy of [-radius, 0, radius]) if (!visible.has(Math.floor(y + dy) * width + Math.floor(x + dx))) return false;
      for (let ty = Math.floor(y - radius); ty < Math.ceil(y + radius); ty++) for (let tx = Math.floor(x - radius); tx < Math.ceil(x + radius); tx++) if (!['grass', 'road', 'bridge'].includes(obs.map.terrain[ty * width + tx])) return false;
      if (buildings.some(building => Math.abs(building.x - x) < defs.buildings[building.role].size / 2 + radius + .4 && Math.abs(building.y - y) < defs.buildings[building.role].size / 2 + radius + .4)) return false;
      return !nodes.some(node => Math.abs(node.x - x) < radius + .8 && Math.abs(node.y - y) < radius + .8);
    };
    outer: for (const ring of [5, 7, 9]) for (let step = 0; step < 16; step++) {
      const angle = step * Math.PI / 8, x = Math.floor(hq.x + Math.cos(angle) * ring) + .5, y = Math.floor(hq.y + Math.sin(angle) * ring) + .5;
      if (placeable(x, y)) { commands.push({ type: 'build', ids: [available.id], role, x, y }); pay(defs.buildings[role].cost); break outer; }
    }
  }
  for (const building of barracks.filter(building => building.progress === 1)) train(building, building.id % 2 ? 'melee' : 'ranged');
  const army = own.filter(entity => entity.kind === 'unit' && entity.role !== 'worker' && !entity.illusion);
  const enemies = obs.entities.filter(entity => entity.side !== obs.side);
  const target = enemies.find(entity => distance(entity, hq) < 10) ?? enemies.find(entity => entity.role === 'hq') ?? obs.map.starts[obs.opponent.side];
  if (army.length >= 4 || enemies.some(entity => distance(entity, hq) < 10)) {
    const ready = army.filter(entity => entity.order.type === 'idle' || entity.order.type === 'hold' || Math.floor(obs.time) % 30 === 0);
    if (ready.length) commands.push({ type: 'attackMove', ids: ready.map(entity => entity.id).slice(0, 100), x: target.x, y: target.y });
  }
  return commands.slice(0, 64);
}
