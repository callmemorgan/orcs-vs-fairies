import { levelOf } from './world-map';
import type { PlayerView } from './observation';
import type { Cost, Side, UnitDef, UnitRole, Vec } from './types';

export type CoachObservation = ReturnType<PlayerView['observe']>;
export type CoachTopic = 'idle-workers' | 'idle-production' | 'supply-blocked' | 'unused-resources' | 'scouting' | 'army-cohesion';
export interface CoachAdvice {
  id: CoachTopic;
  title: string;
  message: string;
  entityIds: number[];
  point?: Vec;
  priority: number;
}
export interface CoachMemory {
  version: 1;
  side: Side;
  lastTime: number;
  dismissedUntil: Partial<Record<CoachTopic, number>>;
}

export const COACH_TOPIC_TITLES: Record<CoachTopic, string> = {
  'idle-workers': 'Workers need orders',
  'idle-production': 'Production queue is empty',
  'supply-blocked': 'Recruitment needs capacity',
  'unused-resources': 'Resources available to spend',
  scouting: 'Scout more of the map',
  'army-cohesion': 'Troops are spread out',
};

export const COACH_THRESHOLDS = {
  idleGraceSeconds: 30,
  scoutingGraceSeconds: 90,
  scoutingExploredFraction: .35,
  armyMinimum: 5,
  armySpreadTiles: 12,
  recentDamageSeconds: 6,
  bank: { wood: 400, ore: 300, crystal: 100 },
} as const;

const topics: CoachTopic[] = ['idle-workers', 'idle-production', 'supply-blocked', 'unused-resources', 'scouting', 'army-cohesion'];
type SeenEntity = CoachObservation['entities'][number];
type OwnEntity = Extract<SeenEntity, { order: unknown }>;
type Recruitment = { building: OwnEntity; unit: UnitDef };
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const pointOf = (entity: Vec): Vec => ({ x: entity.x, y: entity.y,...(entity.level===undefined?{}:{level:entity.level}) });
const affordable = (bank: Cost, cost: Cost) => bank.wood >= cost.wood && bank.ore >= cost.ore && bank.crystal >= cost.crystal;
const costText = (cost: Cost) => (['wood', 'ore', 'crystal'] as const).filter(kind => cost[kind] > 0).map(kind => `${cost[kind]} ${kind}`).join(', ');
const bankText = (bank: Cost) => `${Math.floor(bank.wood)} wood, ${Math.floor(bank.ore)} ore and ${Math.floor(bank.crystal)} crystal`;
const ready = (entity: OwnEntity) => entity.kind === 'building' && entity.progress === 1;
const waiting = (entity: OwnEntity) => (entity.order.type === 'idle' || entity.order.type === 'hold') && !entity.orderQueue?.length;

export function createCoachMemory(side: Side): CoachMemory {
  if (!Number.isInteger(side) || side < 0 || side > 7) throw new Error('Coach side must be a player side.');
  return { version: 1, side, lastTime: 0, dismissedUntil: {} };
}

/** Dismissal uses simulation seconds, so pausing also pauses the cooldown. */
export function dismissCoachAdvice(memory: CoachMemory, id: CoachTopic, time: number, cooldownSeconds = 60): void {
  if (!topics.includes(id) || !Number.isFinite(time) || time < 0 || !Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) return;
  const expiry = time + cooldownSeconds;
  if (!Number.isFinite(expiry)) return;
  if (time < memory.lastTime) memory.dismissedUntil = {};
  memory.lastTime = time;
  memory.dismissedUntil[id] = expiry;
}

function recruits(view: CoachObservation, owned: OwnEntity[], age: number): Recruitment[] {
  const definitions = Object.values(view.content.faction.units);
  return owned.flatMap(building => {
    if (!ready(building) || building.queue.length >= 5 || (building.role !== 'hq' && building.role !== 'barracks')) return [];
    const unit = definitions.find(definition =>
      (building.role === 'hq' ? definition.role === 'worker' : definition.role !== 'worker') &&
      (definition.age ?? 1) <= age && affordable(view.player, definition.cost));
    return unit ? [{ building, unit }] : [];
  });
}

/** Uses only visible opponents and the owned unit's observed combat timers. */
function inCombat(view: CoachObservation, entity: OwnEntity): boolean {
  if (entity.cooldown > 0 || (entity.lastDamagedAt !== undefined && view.time - entity.lastDamagedAt < COACH_THRESHOLDS.recentDamageSeconds)) return true;
  const opponents = new Set(view.opponents.map(player => player.side));
  const ownRange = entity.kind === 'unit' ? view.content.faction.units[entity.role as UnitRole]?.range ?? 0 : 0;
  // Twelve tiles includes long-range siege and emplaced cannons without reading enemy definitions.
  return view.entities.some(foe => opponents.has(foe.side) && distance(entity, foe) <= Math.max(12, ownRange + 2));
}

function indexAt(view: CoachObservation, point: Vec): number | undefined {
  const x = Math.floor(point.x), y = Math.floor(point.y);
  return x >= 0 && y >= 0 && x < view.map.width && y < view.map.height ? y * view.map.width + x : undefined;
}

function scoutingOrder(view: CoachObservation, entity: OwnEntity, explored: Set<number>): boolean {
  return [entity.order, ...(entity.orderQueue ?? [])].some(order => {
    if (order.type !== 'move' && order.type !== 'attackMove') return false;
    const index = indexAt(view, order);
    return index !== undefined && !explored.has(index);
  });
}

function frontierPoint(view: CoachObservation, explored: Set<number>, origin: Vec): Vec | undefined {
  let best: Vec | undefined, bestDistance = Infinity;
  for (const index of [...explored].sort((a, b) => a - b)) {
    if (index < 0 || index >= view.map.width * view.map.height) continue;
    const terrain = view.map.terrain[index];
    if (!terrain || terrain === 'water' || terrain === 'rock') continue;
    const x = index % view.map.width, y = Math.floor(index / view.map.width);
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    if (!neighbors.some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < view.map.width && ny < view.map.height && !explored.has(ny * view.map.width + nx))) continue;
    const point = { x: x + .5, y: y + .5 }, length = distance(point, origin);
    if (length < bestDistance) { best = point; bestDistance = length; }
  }
  return best;
}

function stationaryScout(view: CoachObservation, entity: OwnEntity, owned: OwnEntity[], explored: Set<number>): boolean {
  const bases = owned.filter(building => ready(building) && building.role === 'hq');
  if (!bases.length || bases.some(base => distance(base, entity) <= COACH_THRESHOLDS.armySpreadTiles)) return false;
  // A unit watching the fog away from its base may be scouting even after its move finishes.
  const radius = (view.content.faction.units[entity.role as UnitRole]?.sight ?? 7) + 1.5;
  for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
    if (Math.hypot(dx, dy) > radius) continue;
    const index = indexAt(view, { x: entity.x + dx, y: entity.y + dy });
    if (index !== undefined && !explored.has(index)) return true;
  }
  return false;
}

/** Advice and its small dismissal clock never read or retain a full match state. */
export function coachAdvice(view: CoachObservation, memory: CoachMemory, maxAdvice = 3): CoachAdvice[] {
  if (!Number.isFinite(view.time) || view.time < 0) return [];
  if (memory.side !== view.side || view.time < memory.lastTime) {
    memory.side = view.side;
    memory.dismissedUntil = {};
  }
  memory.lastTime = view.time;
  for (const id of topics) if ((memory.dismissedUntil[id] ?? Infinity) <= view.time) delete memory.dismissedUntil[id];
  if (view.result.finished || view.eliminated[view.side]) return [];

  const owned = view.entities.filter((entity): entity is OwnEntity => entity.side === view.side && 'order' in entity && Number.isInteger(entity.id) && entity.id > 0 && !entity.illusion && !entity.raised && entity.hp > 0).sort((a, b) => a.id - b.id);
  const army = owned.filter(entity => entity.kind === 'unit' && entity.role !== 'worker');
  const age = view.player.upgrades.includes('citadel-age') ? 3 : view.player.upgrades.includes('town-age') ? 2 : 1;
  const recruitment = recruits(view, owned, age);
  const reserved = owned.reduce((count, entity) => count + entity.queue.length, 0);
  const occupied = view.player.population + reserved;
  const room = occupied < view.player.cap;
  const advice: CoachAdvice[] = [];
  const add = (item: CoachAdvice) => { if ((memory.dismissedUntil[item.id] ?? -Infinity) <= view.time) advice.push(item); };

  if (!room && recruitment.length) {
    const { building, unit } = recruitment[0];
    add({ id: 'supply-blocked', title: COACH_TOPIC_TITLES['supply-blocked'], priority: 100,
      message: `${view.player.population} population and ${reserved} queued recruits use ${occupied}/${view.player.cap} capacity. You can afford ${unit.name} (${costText(unit.cost)}), but need one free population slot to queue it.`,
      entityIds: recruitment.map(item => item.building.id), point: pointOf(building) });
  }

  if (view.time >= COACH_THRESHOLDS.idleGraceSeconds) {
    const workers = owned.filter(entity => entity.kind === 'unit' && entity.role === 'worker' && waiting(entity) && entity.carried === 0 && !inCombat(view, entity));
    if (workers.length) add({ id: 'idle-workers', title: COACH_TOPIC_TITLES['idle-workers'], priority: 90,
      message: `${workers.length} worker${workers.length === 1 ? ' has' : 's have'} no cargo or queued orders. Assign ${workers.length === 1 ? 'it' : 'them'} to gathering or construction.`,
      entityIds: workers.map(entity => entity.id), point: pointOf(workers[0]) });
    const idle = room ? recruitment.filter(item => !item.building.queue.length && !item.building.research) : [];
    if (idle.length) {
      const { building, unit } = idle[0];
      add({ id: 'idle-production', title: COACH_TOPIC_TITLES['idle-production'], priority: 75,
        message: `${idle.length} completed production building${idle.length === 1 ? ' has an' : 's have'} empty ${idle.length === 1 ? 'queue' : 'queues'}. You can recruit ${unit.name} (${costText(unit.cost)}) at ${view.content.faction.buildings[building.role as 'hq' | 'barracks'].name}.`,
        entityIds: idle.map(item => item.building.id), point: pointOf(building) });
    }
  }

  const highBank = (['wood', 'ore', 'crystal'] as const).some(kind => view.player[kind] >= COACH_THRESHOLDS.bank[kind]);
  if (view.time >= COACH_THRESHOLDS.idleGraceSeconds && highBank) {
    const research = owned.flatMap(building => {
      if (!ready(building) || building.research) return [];
      const upgrade = Object.values(view.content.upgrades).find(definition => definition.building === building.role &&
        !view.player.upgrades.includes(definition.id) && !owned.some(other => other.research === definition.id) &&
        (definition.age ?? 1) <= age && (definition.requires ?? []).every(id => view.player.upgrades.includes(id)) && affordable(view.player, definition.cost));
      return upgrade ? [{ building, upgrade }] : [];
    });
    const recruit = room ? recruitment[0] : undefined;
    const expenditure = recruit ? { building: recruit.building, text: `recruit ${recruit.unit.name} (${costText(recruit.unit.cost)})` } :
      research[0] ? { building: research[0].building, text: `research ${research[0].upgrade.name} (${costText(research[0].upgrade.cost)})` } : undefined;
    if (expenditure) add({ id: 'unused-resources', title: COACH_TOPIC_TITLES['unused-resources'], priority: 65,
      message: `You have ${bankText(view.player)}. You can ${expenditure.text} at ${view.content.faction.buildings[expenditure.building.role as 'hq' | 'barracks'].name}.`,
      entityIds: [expenditure.building.id], point: pointOf(expenditure.building) });
  }

  const explored = new Set(view.explored.filter(index => Number.isInteger(index) && index >= 0 && index < view.map.width * view.map.height));
  const coverage = explored.size / (view.map.width * view.map.height);
  if (view.time >= COACH_THRESHOLDS.scoutingGraceSeconds && coverage < COACH_THRESHOLDS.scoutingExploredFraction &&
    !owned.some(entity => entity.kind === 'unit' && scoutingOrder(view, entity, explored))) {
    const scout = army.find(entity => waiting(entity) && !inCombat(view, entity));
    const origin = scout ?? owned.find(entity => ready(entity) && entity.role === 'hq') ?? view.map.starts[view.side];
    const point = origin ? frontierPoint(view, explored, origin) : undefined;
    if (point) add({ id: 'scouting', title: COACH_TOPIC_TITLES.scouting, priority: 50,
      message: `${Math.floor(coverage * 100)}% of the map is explored at ${Math.floor(view.time)} seconds. Scout the known frontier near (${point.x.toFixed(1)}, ${point.y.toFixed(1)}).`,
      entityIds: scout ? [scout.id] : [], point });
  }

  const allWaitingArmy = army.filter(entity => waiting(entity) && !inCombat(view, entity) && !stationaryScout(view, entity, owned, explored));
  const groups=[...new Set(allWaitingArmy.map(levelOf))].map(level=>allWaitingArmy.filter(entity=>levelOf(entity)===level));
  const waitingArmy=groups.sort((a,b)=>b.length-a.length)[0]??[];
  if (waitingArmy.length >= COACH_THRESHOLDS.armyMinimum) {
    let spread = 0;
    for (let first = 0; first < waitingArmy.length; first++) for (let second = first + 1; second < waitingArmy.length; second++) spread = Math.max(spread, distance(waitingArmy[first], waitingArmy[second]));
    if (spread > COACH_THRESHOLDS.armySpreadTiles) {
      const center = { x: waitingArmy.reduce((sum, entity) => sum + entity.x, 0) / waitingArmy.length, y: waitingArmy.reduce((sum, entity) => sum + entity.y, 0) / waitingArmy.length };
      const anchor = [...waitingArmy].sort((a, b) => distance(a, center) - distance(b, center) || a.id - b.id)[0];
      const point = pointOf(anchor);
      add({ id: 'army-cohesion', title: COACH_TOPIC_TITLES['army-cohesion'], priority: 45,
        message: `${waitingArmy.length} waiting troops span ${spread.toFixed(1)} tiles. Group them near (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) if you want them to fight together.`,
        entityIds: waitingArmy.map(entity => entity.id), point });
    }
  }

  const limit = Number.isFinite(maxAdvice) ? Math.max(0, Math.min(topics.length, Math.floor(maxAdvice))) : 3;
  return advice.sort((a, b) => b.priority - a.priority || topics.indexOf(a.id) - topics.indexOf(b.id)).slice(0, limit);
}
