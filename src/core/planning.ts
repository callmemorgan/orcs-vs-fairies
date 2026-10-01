import { buildingFor, factionFor, isNormalBuildingDefinition } from './content-registry';
import { levelOf,sameLevel } from './world-map';
import { length2D } from './geometry';
import { FACTIONS } from './content';
import { terrainAt, TERRAIN } from './maps';
import { route, segmentWalkable, walkable } from './navigation';
import { AGE_NAMES, buildingAgeRequired, playerAge } from './progression';
import { canPlace, captureRuntime, isGameOver, issueCommand, isVisible } from './simulation';
import type { BuildingRole, Command, Entity, GameState, ResourceKind, ResourceNode, Side, Vec } from './types';

export type WorkerTargets = Record<ResourceKind, number>;
export type PlanningDispatch = (side: Side, command: Command) => boolean;
export interface WorkerAllocationSnapshot {
  targets?: WorkerTargets;
  assigned: WorkerTargets;
  idle: number;
  busy: number;
  total: number;
}
export interface WorkerAllocationResult extends WorkerAllocationSnapshot {
  unmet: WorkerTargets;
  issued: { worker: number; resource: number; kind: ResourceKind }[];
  messages: string[];
}
export interface ConstructionBlueprint extends Vec {
  id: string;
  role: BuildingRole;
  workerIds: number[];
  status: 'planned' | 'building' | 'complete';
  buildingId?: number;
  reason?: string;
}
export interface ConstructionPlan {
  version: 1;
  side: Side;
  nextId: number;
  blueprints: ConstructionBlueprint[];
}
export interface PlanningRuntime {
  version: 1;
  targets: WorkerTargets;
  construction: ConstructionPlan;
}

const KINDS: ResourceKind[] = ['wood', 'ore', 'crystal'];
const MAX_BLUEPRINTS = 100;
const MAX_COORDINATE = 10_000;
const roles = new Set<string>(Object.keys(FACTIONS.orcs.buildings));
const targetMemory = new WeakMap<GameState, Map<number, WorkerTargets>>();
const emptyTargets = (): WorkerTargets => ({ wood: 0, ore: 0, crystal: 0 });
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const distance = (a: Vec, b: Vec) => sameLevel(a,b)?length2D(a.x - b.x, a.y - b.y):Infinity;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const validSideNumber = (side: unknown): side is Side => typeof side === 'number' && Number.isSafeInteger(side) && side >= 0 && side <= 7;

/** Check the live player arrays rather than assuming a two-player match. */
export function validPlanningSide(state: GameState, side: number): side is Side {
  return Number.isSafeInteger(side) && side >= 0 && side < state.players.length && !!state.players[side] && !!state.visible[side] && !!state.explored[side];
}
function requireSide(state: GameState, side: number): asserts side is Side {
  if (!validPlanningSide(state, side)) throw new RangeError('Invalid player side.');
}
export function validateWorkerTargets(input: unknown): input is WorkerTargets {
  return record(input) && Object.keys(input).length === KINDS.length && KINDS.every(kind => own(input, kind) && typeof input[kind] === 'number' && Number.isInteger(input[kind]) && input[kind] >= 0 && input[kind] <= 10_000);
}
function workers(state: GameState, side: Side): Entity[] {
  return state.entities.filter(e => e.side === side && e.hp > 0 && e.kind === 'unit' && e.role === 'worker' && !e.illusion);
}
function freeWorker(worker: Entity, protectedOrders: Set<number>): boolean {
  return !worker.orderQueue?.length && !protectedOrders.has(worker.id) && (worker.order.type === 'idle' || worker.order.type === 'hold' || worker.order.type === 'gather');
}
function regularGatherKind(state: GameState, worker: Entity, finiteGather: Set<number>): ResourceKind | undefined {
  if (worker.order.type !== 'gather' || worker.orderQueue?.length || finiteGather.has(worker.id)) return undefined;
  const target = worker.order.target;
  return state.resources.find(node => node.id === target)?.kind;
}
export function workerAllocation(state: GameState, side: Side): WorkerAllocationSnapshot {
  requireSide(state, side);
  const assigned = emptyTargets(), owned = workers(state, side), queued = protectedWorkerOrders(state, side);
  const finiteGather = new Set(captureRuntime(state).queuedGather);
  let idle = 0, busy = 0;
  for (const worker of owned) {
    const kind = regularGatherKind(state, worker, finiteGather);
    if (kind) { assigned[kind]++; continue; }
    if (!freeWorker(worker, queued)) { busy++; continue; }
    idle++;
  }
  const targets = targetMemory.get(state)?.get(side);
  return { assigned, idle, busy, total: owned.length, ...(targets ? { targets: { ...targets } } : {}) };
}

/** Planning uses only observed obstacles; hidden enemy structures cannot affect its answers. */
function observedMap(state: GameState, side: Side): GameState {
  return {
    ...state,
    entities: state.entities.filter(e => e.side === side || isVisible(state, side, e.x, e.y,levelOf(e))),
    resources: state.resources.filter(node => isVisible(state, side, node.x, node.y,levelOf(node))),
    terrain: state.terrain.map((tile, index) => state.explored[side].has(index) ? tile : 'rock'),
    world:state.world?{...state.world,levels:state.world.levels.map(level=>({...level,terrain:level.terrain.map((tile,index)=>state.explored[side].has(level.id*state.width*state.height+index)?tile:'rock')}))}:undefined,
  };
}
function reachable(view: GameState, worker: Vec, target: Vec, reach: number, side: Side): boolean {
  if(!sameLevel(worker,target))return false;
  const d = distance(worker, target);
  if (d <= reach) return true;
  // Connect to the interaction radius, since a resource center itself is an obstacle.
  const approach = { x: target.x + (worker.x - target.x) / d * reach, y: target.y + (worker.y - target.y) / d * reach,...(target.level===undefined?{}:{level:target.level}) };
  return segmentWalkable(view, worker, approach) || route(view, worker, target, reach, side).length > 0;
}
function harvestPoint(view: GameState, worker: Entity, node: ResourceNode, side: Side): Vec | undefined {
  if(!sameLevel(worker,node))return undefined;
  const d = distance(worker, node);
  if (d <= 1.2 && walkable(view, worker.x, worker.y,levelOf(worker))) return worker;
  const approach = { x: node.x + (worker.x - node.x) / d * 1.1, y: node.y + (worker.y - node.y) / d * 1.1,...(node.level===undefined?{}:{level:node.level}) };
  if (segmentWalkable(view, worker, approach)) return approach;
  const endpoint = route(view, worker, node, 1.1, side).at(-1);
  if (!endpoint) return undefined;
  const remaining = distance(endpoint, node);
  if (remaining <= 1.2) return endpoint;
  const interaction = { x: node.x + (endpoint.x - node.x) / remaining * 1.1, y: node.y + (endpoint.y - node.y) / remaining * 1.1,...(node.level===undefined?{}:{level:node.level}) };
  if (segmentWalkable(view, endpoint, interaction)) return interaction;
  // Navigation allows .2 beyond its requested reach. A tighter fallback ensures
  // the endpoint is within the simulation's 1.2 harvesting distance.
  return route(view, worker, node, 1, side).at(-1);
}
function protectedWorkerOrders(state: GameState, side: Side): Set<number> {
  const memory = captureRuntime(state);
  const protectedOrders = new Set([...memory.queuedGather, ...memory.returning]);
  const loaded = workers(state, side).filter(worker => worker.carried > 0);
  if (!loaded.length) return protectedOrders;
  const view = observedMap(state, side);
  const dropoffs = state.entities.filter(e => e.side === side && e.hp > 0 && e.kind === 'building' && e.progress === 1 && (e.role === 'hq' || e.role === 'depot'));
  for (const worker of loaded) {
    const target = worker.order.type === 'gather' ? worker.order.target : undefined;
    const node = target === undefined ? undefined : state.resources.find(node => node.id === target);
    const dropoff = dropoffs.filter(dropoff=>sameLevel(worker,dropoff)).sort((a, b) => distance(worker, a) - distance(worker, b))[0];
    const pendingDelivery = worker.carried >= 18 || !!node && (node.kind !== worker.carriedKind || isVisible(state, side, node.x, node.y,levelOf(node)) && node.amount <= 0);
    if (pendingDelivery || !dropoff || !reachable(view, worker, dropoff, buildingFor(state,dropoff).size / 2 + 1, side)) protectedOrders.add(worker.id);
  }
  return protectedOrders;
}

export function applyWorkerTargets(state: GameState, side: Side, targets: WorkerTargets, dispatch: PlanningDispatch = (commandSide, command) => issueCommand(state, commandSide, command)): WorkerAllocationResult {
  requireSide(state, side);
  if (!validateWorkerTargets(targets)) throw new RangeError('Worker targets must be integers from 0 to 10000 for wood, ore and crystal.');
  let memory = targetMemory.get(state);
  if (!memory) { memory = new Map(); targetMemory.set(state, memory); }
  memory.set(side, { ...targets });
  const initial = workerAllocation(state, side);
  if (isGameOver(state)) return { ...initial, unmet: Object.fromEntries(KINDS.map(kind => [kind, Math.max(0, targets[kind] - initial.assigned[kind])])) as WorkerTargets, issued: [], messages: ['The match is finished.'] };

  const queued = protectedWorkerOrders(state, side), finiteGather = new Set(captureRuntime(state).queuedGather);
  const owned = workers(state, side), locked = emptyTargets();
  // Protected deliveries still occupy their regular resource slots while
  // periodic allocation runs. Safe partial-cargo reassignment stays available.
  for (const worker of owned) {
    const kind = regularGatherKind(state, worker, finiteGather);
    if (kind && !freeWorker(worker, queued)) locked[kind]++;
  }
  const quotas = Object.fromEntries(KINDS.map(kind => [kind, Math.max(0, targets[kind] - locked[kind])])) as WorkerTargets;
  const available = owned.filter(worker => freeWorker(worker, queued)).sort((a, b) => a.id - b.id);
  const view = observedMap(state, side);
  const nodes = state.resources.filter(node => node.amount > 0 && isVisible(state, side, node.x, node.y,levelOf(node)));
  const dropoffs = state.entities.filter(e => e.side === side && e.hp > 0 && e.kind === 'building' && e.progress === 1 && (e.role === 'hq' || e.role === 'depot'));
  const cached = new Map<number, Partial<Record<ResourceKind, ResourceNode>>>();
  const harvestable = new Map<number, Set<ResourceKind>>();
  const bestNode = (worker: Entity, kind: ResourceKind): ResourceNode | undefined => {
    let options = cached.get(worker.id);
    if (!options) { options = {}; cached.set(worker.id, options); }
    if (own(options, kind)) return options[kind];
    const current = worker.order.type === 'gather' ? worker.order.target : undefined;
    const candidates: { node: ResourceNode; travel: number }[] = [];
    for (const node of nodes.filter(node => node.kind === kind)) {
      const point = harvestPoint(view, worker, node, side);
      if (!point) continue;
      let known = harvestable.get(worker.id);
      if (!known) { known = new Set(); harvestable.set(worker.id, known); }
      known.add(kind);
      // Gathering returns to the closest completed drop-off. A farther reachable
      // depot cannot rescue an order if that automatic destination is blocked.
      const delivery = dropoffs.filter(dropoff=>sameLevel(point,dropoff)).sort((a, b) => distance(point, a) - distance(point, b))[0];
      if (delivery && reachable(view, point, delivery, buildingFor(state,delivery).size / 2 + 1, side)) candidates.push({ node, travel: distance(worker, node) + distance(node, delivery) });
    }
    options[kind] = candidates.sort((a, b) => Number(b.node.id === current) - Number(a.node.id === current) || a.travel - b.travel || a.node.id - b.node.id)[0]?.node;
    return options[kind];
  };
  const retained = new Set<number>();
  const allocation: Record<ResourceKind, Entity[]> = { wood: [], ore: [], crystal: [] };
  for (const worker of available) {
    if (worker.order.type !== 'gather') continue;
    const target = worker.order.target;
    const node = nodes.find(node => node.id === target);
    if (node && allocation[node.kind].length < quotas[node.kind] && bestNode(worker, node.kind)?.id === node.id) { retained.add(worker.id); allocation[node.kind].push(worker); }
  }
  const pool = available.filter(worker => !retained.has(worker.id)).sort((a, b) => Number(a.order.type === 'gather') - Number(b.order.type === 'gather') || a.id - b.id);
  // Capacity matching can move an earlier idle worker to another resource, leaving
  // a reachable slot for a worker with fewer routes.
  const place = (worker: Entity, seenWorkers: Set<number>, seenKinds: Set<ResourceKind>): boolean => {
    if (seenWorkers.has(worker.id)) return false;
    seenWorkers.add(worker.id);
    for (const kind of KINDS) {
      if (seenKinds.has(kind) || quotas[kind] <= 0 || !bestNode(worker, kind)) continue;
      seenKinds.add(kind);
      if (allocation[kind].length < quotas[kind]) { allocation[kind].push(worker); return true; }
      for (let i = 0; i < allocation[kind].length; i++) {
        if (place(allocation[kind][i], seenWorkers, seenKinds)) { allocation[kind][i] = worker; return true; }
      }
    }
    return false;
  };
  for (const worker of pool) place(worker, new Set(), new Set());
  const issued: WorkerAllocationResult['issued'] = [], reassigned = new Set<number>();
  for (const kind of KINDS) for (const worker of allocation[kind]) {
    const node = bestNode(worker, kind)!;
    if (worker.order.type === 'gather' && worker.order.target === node.id) { reassigned.add(worker.id); continue; }
    if (dispatch(side, { type: 'gather', ids: [worker.id], target: node.id })) {
      issued.push({ worker: worker.id, resource: node.id, kind });
      reassigned.add(worker.id);
    }
  }
  for (const worker of available) if (worker.order.type === 'gather' && !reassigned.has(worker.id)) dispatch(side, { type: 'stop', ids: [worker.id] });
  const snapshot = workerAllocation(state, side);
  const unmet = Object.fromEntries(KINDS.map(kind => [kind, Math.max(0, targets[kind] - snapshot.assigned[kind])])) as WorkerTargets;
  const messages: string[] = [];
  for (const kind of KINDS) if (unmet[kind]) {
    if (!nodes.some(node => node.kind === kind)) messages.push(`No visible ${kind} resources are available (${unmet[kind]} workers unmet).`);
    else if (!dropoffs.length) messages.push(`No completed headquarters or depot is available for ${kind} delivery (${unmet[kind]} workers unmet).`);
    else if (!available.length) messages.push(`No available workers for ${kind} (${unmet[kind]} workers unmet).`);
    else if (!available.some(worker => bestNode(worker, kind))) messages.push(available.some(worker => harvestable.get(worker.id)?.has(kind))
      ? `No known delivery route from a visible ${kind} resource to a completed headquarters or depot (${unmet[kind]} workers unmet).`
      : `No known route to a visible ${kind} resource (${unmet[kind]} workers unmet).`);
    else messages.push(`Not enough available workers for ${kind} (${unmet[kind]} workers unmet).`);
  }
  for (const kind of KINDS) if (locked[kind] > targets[kind]) messages.push(`${locked[kind] - targets[kind]} ${kind} worker reductions are deferred until cargo is delivered.`);
  if (messages.length && snapshot.busy) messages.push(`${snapshot.busy} workers have other orders and were left assigned to them.`);
  return { ...snapshot, unmet, issued, messages };
}

export function createConstructionPlan(side: Side): ConstructionPlan {
  if (!validSideNumber(side)) throw new RangeError('Invalid player side.');
  return { version: 1, side, nextId: 1, blueprints: [] };
}
function validPosition(input: Vec, state?: GameState): boolean {
  return (input.level===undefined||Number.isInteger(input.level)&&input.level>=0&&input.level<(state?.world?.levels.length??(state?1:2))) && Number.isFinite(input.x) && Number.isFinite(input.y) && input.x >= 0 && input.y >= 0 && input.x < Math.min(state?.width ?? MAX_COORDINATE, MAX_COORDINATE) && input.y < Math.min(state?.height ?? MAX_COORDINATE, MAX_COORDINATE);
}
function requirePlan(state: GameState, side: Side, plan: ConstructionPlan): void {
  requireSide(state, side);
  if (plan.side !== side || plan.version !== 1 || !Array.isArray(plan.blueprints) || !validId(plan.nextId) || plan.nextId >= Number.MAX_SAFE_INTEGER) throw new RangeError('Invalid construction plan.');
}
export function addBlueprint(state: GameState, side: Side, plan: ConstructionPlan, input: { role: BuildingRole } & Vec): ConstructionBlueprint {
  requirePlan(state, side, plan);
  if (!roles.has(input.role) || !validPosition(input, state)) throw new RangeError('Blueprint must have a building role and a position inside the map.');
  if (!isNormalBuildingDefinition(factionFor(state,side).buildings[input.role])) throw new RangeError('This building requires its specialized placement command.');
  if (plan.blueprints.length >= MAX_BLUEPRINTS) throw new RangeError('A construction plan can contain at most 100 blueprints.');
  const item: ConstructionBlueprint = { id: `blueprint-${plan.nextId++}`, role: input.role, x: input.x, y: input.y,...(input.level===undefined?{}:{level:input.level}), workerIds: [], status: 'planned' };
  plan.blueprints.push(item);
  return item;
}
export function cancelBlueprint(plan: ConstructionPlan, id: string): boolean {
  const index = plan.blueprints.findIndex(item => item.id === id && item.status === 'planned');
  if (index < 0) return false;
  plan.blueprints.splice(index, 1);
  return true;
}
export function assignBlueprintWorkers(state: GameState, side: Side, plan: ConstructionPlan, id: string, workerIds: number[]): boolean {
  requirePlan(state, side, plan);
  const item = plan.blueprints.find(item => item.id === id && item.status !== 'complete');
  if (!item || !Array.isArray(workerIds) || workerIds.length > 100 || new Set(workerIds).size !== workerIds.length || workerIds.some(id => !validId(id))) return false;
  const owned = new Set(workers(state, side).map(worker => worker.id));
  if (workerIds.some(id => !owned.has(id))) return false;
  item.workerIds = [...workerIds];
  delete item.reason;
  return true;
}
function matchingBuilding(state: GameState, side: Side, item: ConstructionBlueprint): Entity | undefined {
  return state.entities.find(e => e.id === item.buildingId && e.side === side && e.kind === 'building' && e.role === item.role && sameLevel(e,item) && Math.abs(e.x - item.x) < .000001 && Math.abs(e.y - item.y) < .000001 && e.hp > 0);
}
function freeAssignedWorkers(state: GameState, side: Side, item: ConstructionBlueprint, queued: Set<number>): Entity[] {
  return workers(state, side).filter(worker => item.workerIds.includes(worker.id) && sameLevel(worker,item) && freeWorker(worker, queued));
}
export function blueprintReason(state: GameState, side: Side, item: ConstructionBlueprint): string {
  if (!validPlanningSide(state, side) || !roles.has(item.role) || !validPosition(item, state)) return 'Invalid blueprint.';
  if (isGameOver(state)) return 'The match is finished.';
  if (item.status === 'complete') return 'Construction is complete.';
  const def = factionFor(state,side).buildings[item.role];
  if (!isNormalBuildingDefinition(def)) return 'This building requires its specialized placement command.';
  const queued = protectedWorkerOrders(state, side);
  const eligible = freeAssignedWorkers(state, side, item, queued);
  if (item.status === 'building') {
    const building = matchingBuilding(state, side, item);
    if (!building) return 'Construction was destroyed.';
    if (state.entities.some(worker => worker.side === side && worker.hp > 0 && worker.role === 'worker' && worker.order.type === 'build' && worker.order.target === building.id)) return '';
    return eligible.length ? '' : 'Assign an available worker to resume construction.';
  }
  const age = buildingAgeRequired(def);
  if (playerAge(state.players[side]) < age) return `Requires ${AGE_NAMES[age]}.`;
  const missing = KINDS.filter(kind => state.players[side][kind] < def.cost[kind]);
  if (missing.length) return `Insufficient ${missing.join(', ')}.`;
  if (!item.workerIds.length) return 'Assign workers before construction.';
  if (!eligible.length) return 'Assigned workers are unavailable or have other orders.';
  const r = def.size / 2;
  if (item.x - r < .5 || item.y - r < .5 || item.x + r > state.width - .5 || item.y + r > state.height - .5) return 'Building footprint is outside the map.';
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) if (!isVisible(state, side, item.x + dx, item.y + dy,levelOf(item))) return 'The entire building site must be visible.';
  for (let y = Math.floor(item.y - r); y < Math.ceil(item.y + r); y++) for (let x = Math.floor(item.x - r); x < Math.ceil(item.x + r); x++) if (!TERRAIN[terrainAt(state, x + .5, y + .5,levelOf(item))].buildable) return 'Terrain cannot support this building.';
  const view = observedMap(state, side);
  if (!canPlace(view, side, item.role, item.x, item.y,undefined,levelOf(item))) return 'Building site overlaps a building, resource or enemy unit.';
  if (!eligible.some(worker => reachable(view, worker, item, r + 1.1, side))) return 'Assigned workers cannot reach this site.';
  return '';
}
export function syncConstructionPlan(state: GameState, plan: ConstructionPlan): void {
  requirePlan(state, plan.side, plan);
  const owned = new Set(workers(state, plan.side).map(worker => worker.id));
  for (const item of plan.blueprints) {
    item.workerIds = item.workerIds.filter(id => owned.has(id));
    if (item.buildingId === undefined) continue;
    const building = matchingBuilding(state, plan.side, item);
    if (!building) {
      item.status = 'planned';
      delete item.buildingId;
      item.reason = 'Construction was destroyed; the blueprint is available to rebuild.';
    } else {
      item.status = building.progress >= 1 ? 'complete' : 'building';
      delete item.reason;
    }
  }
}
export function executeBlueprints(state: GameState, side: Side, plan: ConstructionPlan, dispatch: PlanningDispatch = (commandSide, command) => issueCommand(state, commandSide, command)): { started: string[]; pending: { id: string; reason: string }[] } {
  requirePlan(state, side, plan);
  syncConstructionPlan(state, plan);
  const started: string[] = [], pending: { id: string; reason: string }[] = [], reserved = new Set<number>();
  const queued = protectedWorkerOrders(state, side);
  for (const item of plan.blueprints) {
    if (item.status === 'complete') continue;
    const reason = blueprintReason(state, side, item);
    if (reason) { item.reason = reason; pending.push({ id: item.id, reason }); continue; }
    const view = observedMap(state, side), reach = factionFor(state,side).buildings[item.role].size / 2 + 1.1;
    const assigned = freeAssignedWorkers(state, side, item, queued).filter(worker => !reserved.has(worker.id) && reachable(view, worker, item, reach, side));
    if (!assigned.length) {
      if (item.status === 'building') continue;
      item.reason = 'Assigned workers have other orders.';
      pending.push({ id: item.id, reason: item.reason });
      continue;
    }
    const accepted = item.status === 'building'
      ? dispatch(side, { type: 'repair', ids: assigned.map(worker => worker.id), target: item.buildingId! })
      : dispatch(side, { type: 'build', ids: assigned.map(worker => worker.id), role: item.role, x: item.x, y: item.y,...(item.level===undefined?{}:{level:item.level}) });
    if (!accepted) { item.reason = 'Construction could not start; check the site and assigned workers.'; pending.push({ id: item.id, reason: item.reason }); continue; }
    const order = assigned[0].order;
    if (order.type === 'build') item.buildingId = order.target;
    item.status = 'building';
    delete item.reason;
    for (const worker of assigned) reserved.add(worker.id);
    started.push(item.id);
  }
  return { started, pending };
}

/** External metadata is validated and copied before it can drive simulation commands. */
export function decodeConstructionPlan(input: unknown, state?: GameState, side?: Side): ConstructionPlan | undefined {
  if (!record(input) || Object.keys(input).some(key => !['version', 'side', 'nextId', 'blueprints'].includes(key)) || input.version !== 1 || !validSideNumber(input.side) || !validId(input.nextId) || input.nextId >= Number.MAX_SAFE_INTEGER || !Array.isArray(input.blueprints) || input.blueprints.length > MAX_BLUEPRINTS) return undefined;
  const planSide = input.side;
  if ((side !== undefined && planSide !== side) || (state && !validPlanningSide(state, planSide))) return undefined;
  const ids = new Set<string>(), buildings = new Set<number>(), blueprints: ConstructionBlueprint[] = [];
  for (const value of input.blueprints) {
    if (!record(value) || Object.keys(value).some(key => !['id', 'role', 'x', 'y', 'level', 'workerIds', 'status', 'buildingId', 'reason'].includes(key))) return undefined;
    if (typeof value.id !== 'string' || !/^blueprint-[1-9]\d*$/.test(value.id) || ids.has(value.id) || typeof value.role !== 'string' || !roles.has(value.role) || typeof value.x !== 'number' || typeof value.y !== 'number' || !validPosition({ x: value.x, y: value.y,level:value.level as number|undefined }, state)) return undefined;
    const sequence = Number(value.id.slice('blueprint-'.length));
    if (!Number.isSafeInteger(sequence) || sequence >= input.nextId) return undefined;
    if (!Array.isArray(value.workerIds) || value.workerIds.length > 100 || value.workerIds.some(id => !validId(id)) || new Set(value.workerIds).size !== value.workerIds.length) return undefined;
    if (value.status !== 'planned' && value.status !== 'building' && value.status !== 'complete') return undefined;
    if ((value.buildingId !== undefined && (!validId(value.buildingId) || buildings.has(value.buildingId))) || (value.status === 'planned' ? value.buildingId !== undefined : value.buildingId === undefined)) return undefined;
    if (value.reason !== undefined && (typeof value.reason !== 'string' || value.reason.length > 500)) return undefined;
    const item: ConstructionBlueprint = { id: value.id, role: value.role as BuildingRole, x: value.x, y: value.y,...(value.level===undefined?{}:{level:value.level as number}), workerIds: [...value.workerIds] as number[], status: value.status, ...(value.buildingId === undefined ? {} : { buildingId: value.buildingId as number }), ...(value.reason === undefined ? {} : { reason: value.reason as string }) };
    if (state) {
      if (!isNormalBuildingDefinition(factionFor(state,planSide).buildings[item.role])) return undefined;
      const owned = new Set(workers(state, planSide).map(worker => worker.id));
      if (item.workerIds.some(id => !owned.has(id))) return undefined;
      if (item.buildingId !== undefined) {
        const building = matchingBuilding(state, planSide, item);
        if (!building || item.status !== (building.progress >= 1 ? 'complete' : 'building')) return undefined;
      }
    }
    ids.add(item.id);
    if (item.buildingId !== undefined) buildings.add(item.buildingId);
    blueprints.push(item);
  }
  return { version: 1, side: planSide, nextId: input.nextId, blueprints };
}
export function createPlanningRuntime(side: Side): PlanningRuntime {
  return { version: 1, targets: emptyTargets(), construction: createConstructionPlan(side) };
}
export function decodePlanningRuntime(input: unknown, state?: GameState, side?: Side): PlanningRuntime | undefined {
  if (!record(input) || Object.keys(input).some(key => !['version', 'targets', 'construction'].includes(key)) || input.version !== 1 || !validateWorkerTargets(input.targets)) return undefined;
  const construction = decodeConstructionPlan(input.construction, state, side);
  return construction ? { version: 1, targets: { ...input.targets }, construction } : undefined;
}
