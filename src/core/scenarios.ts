import { FACTIONS } from './content';
import { validateCommand } from './commands';
import { DIRECTIONS_32, length2D } from './geometry';
import { coneCosine } from './scenario-geometry';
import { MAP_VERSION, TERRAIN, terrainAt } from './maps';
import { openDestination, walkable } from './navigation';
import { loadGame, saveGame } from './saves';
import { applyScenarioDamage, createMatch, isAllied, isHostile, isVisible, issueCommand, refreshVisibility, spawnEntity, stepGame } from './simulation';
import { scenarioJson, validateScenario } from './scenario-validation';
import { fogKey } from './world-map';
import type { Command, Entity, GameState, MatchConfig, Side, UnitRole, Vec } from './types';
import type { ScenarioAction, ScenarioActor, ScenarioBinding, ScenarioCheckpoint, ScenarioCondition, ScenarioDefinition, ScenarioOrder, ScenarioRuntime, ScenarioSession } from './scenario-types';
export { validateScenario } from './scenario-validation';
export type * from './scenario-types';

export const MAX_SCENARIO_ACTIONS_PER_TICK = 128;
const commandListeners = new WeakMap<GameState, Set<(side: Side, command: Command) => void>>();
const commandGeneration = new WeakMap<GameState, number>();
const scriptedCommands = new WeakSet<GameState>();
type BoundState = GameState & { scenario?: ScenarioBinding };
export function bindScenarioState(session: ScenarioSession): void { (session.state as BoundState).scenario = { definition: session.definition, runtime: session.runtime }; }
export function scenarioSessionForState(state: GameState): ScenarioSession | null {
  const binding = (state as BoundState).scenario; return binding ? { ...binding, state } : null;
}
export function isScenarioScriptedCommand(state: GameState): boolean { return scriptedCommands.has(state); }
function scriptedCommand(state: GameState, side: Side, command: Command): boolean {
  const prior = scriptedCommands.has(state); scriptedCommands.add(state);
  try { return issueCommand(state, side, command); } finally { if (!prior) scriptedCommands.delete(state); }
}
export function subscribeScenarioCommands(session: ScenarioSession, listener: (side: Side, command: Command) => void): () => void {
  let listeners = commandListeners.get(session.state); if (!listeners) { listeners = new Set(); commandListeners.set(session.state, listeners); }
  listeners.add(listener); return () => { listeners!.delete(listener); if (!listeners!.size) commandListeners.delete(session.state); };
}
const distance = (a: Vec, b: Vec) => (a.level ?? 0) === (b.level ?? 0) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const actor = (session: ScenarioSession, label: string) => session.state.entities.find(e => e.id === session.runtime.labels[label] && e.hp > 0);
const visible = (state: GameState, side: Side, point: Vec) => !!state.visible[side]?.has(fogKey(state, point));
const variable = (session: ScenarioSession, key: string) => session.runtime.variables[key] ?? 0;
function addVariable(session: ScenarioSession, key: string, value: number): void { session.runtime.variables[key] = Math.max(-1e9, Math.min(1e9, variable(session, key) + value)); }

export function scenarioCondition(session: ScenarioSession, condition: ScenarioCondition): boolean {
  switch (condition.type) {
    case 'alive': return !!actor(session, condition.actor);
    case 'dead': return Object.hasOwn(session.runtime.labels, condition.actor) && !actor(session, condition.actor);
    case 'at': { const entity = actor(session, condition.actor); return !!entity && distance(entity, condition.point) <= condition.radius; }
    case 'time': return session.state.time + 1e-9 >= condition.seconds;
    case 'variable': { const n = variable(session, condition.key); return condition.op === 'eq' ? n === condition.value : condition.op === 'gte' ? n >= condition.value : n <= condition.value; }
    case 'cleared': return !session.state.entities.some(e => e.hp > 0 && e.side === condition.side && !e.illusion && (condition.buildings || e.kind === 'unit'));
    case 'all': return condition.conditions.every(c => scenarioCondition(session, c));
    case 'any': return condition.conditions.some(c => scenarioCondition(session, c));
    case 'not': return !scenarioCondition(session, condition.condition);
  }
}

function message(session: ScenarioSession, text: string, speaker?: string): void {
  const entry = { time: session.state.time, text, ...(speaker ? { speaker } : {}) };
  session.runtime.messages.push(entry); if (session.runtime.messages.length > 128) session.runtime.messages.shift();
  const start = session.state.starts[0];
  session.state.events.push({ type: 'message', side: 0, ...start, text: speaker ? `${speaker}: ${text}` : text });
}

function finish(session: ScenarioSession, outcome: 'won' | 'lost', reason: string): void {
  if (session.runtime.outcome !== 'playing') return;
  session.runtime.outcome = outcome; session.runtime.reason = reason;
  session.state.winner = outcome === 'won' ? 0 : 1; session.state.winningTeam = session.state.teams[session.state.winner]; session.state.draw = false;
  message(session, outcome === 'won' ? session.definition.successText : session.definition.failureText);
}

function updatePopulation(state: GameState): void {
  for (let side = 0; side < state.players.length; side++) {
    const living = state.entities.filter(e => e.side === side && e.hp > 0);
    state.players[side].population = living.filter(e => e.kind === 'unit' && !e.illusion).length;
    state.players[side].cap = Math.min(state.populationLimits[side], living.filter(e => e.kind === 'building' && e.progress === 1).reduce((count, e) => count + (e.role === 'hq' ? 12 : e.role === 'depot' ? 10 : 0), 0));
  }
}

function spawnActors(session: ScenarioSession, actors: ScenarioActor[]): void {
  const spawned: ScenarioActor[] = [];
  for (const definition of actors) {
    if (Object.hasOwn(session.runtime.labels, definition.label)) throw new Error(`Scenario actor ${definition.label} was spawned twice.`);
    if (session.state.entities.length >= 4096) { finish(session, 'lost', 'The scenario exceeded its actor limit.'); return; }
    const desired = { x: definition.x, y: definition.y, ...(definition.level === undefined ? {} : { level: definition.level }) };
    const destination = definition.kind === 'unit' ? (walkable(session.state, desired.x, desired.y, desired.level ?? 0) ? desired : openDestination(session.state, desired, desired)) : desired;
    if (!destination) { finish(session, 'lost', `The spawn point for ${definition.label} became blocked.`); return; }
    const entity = spawnEntity(session.state, definition.side, definition.kind, definition.role, destination.x, destination.y);
    if (definition.level !== undefined) entity.level = definition.level;
    if (definition.hp !== undefined) entity.hp = definition.hp;
    session.runtime.labels[definition.label] = entity.id; spawned.push(definition);
    session.state.events.push({ type: definition.kind === 'unit' ? 'train' : 'build', side: definition.side, source: entity.id, x: entity.x, y: entity.y, ...(entity.level === undefined ? {} : { level: entity.level }), text: definition.label });
  }
  updatePopulation(session.state); refreshVisibility(session.state);
  for (const definition of spawned) if (definition.order) orderActors(session, [definition.label], definition.order);
}

function orderActors(session: ScenarioSession, labels: string[], order: ScenarioOrder): void {
  for (const side of [0, 1] as Side[]) {
    const entities = labels.map(label => actor(session, label)).filter((e): e is Entity => !!e && e.side === side);
    if (!entities.length) continue;
    const ids = entities.map(e => e.id);
    const before = session.state.events.length;
    if (order.type === 'attack') {
      const target = actor(session, order.actor); if (target) scriptedCommand(session.state, side, { type: 'attack', ids, target: target.id });
    } else scriptedCommand(session.state, side, { ...order, ids });
    if (side === 0) recordEvents(session, before);
  }
}

export function createScenario(input: unknown, options: { firstEntityId?: number } = {}): ScenarioSession {
  const definition = validateScenario(input);
  const firstId = options.firstEntityId ?? 1;
  if (!Number.isSafeInteger(firstId) || firstId < 1 || firstId > 0x7fffffff - 8192) throw new Error('Scenario starting entity ID is outside its range.');
  const construct = createMatch as (config: MatchConfig, policy?: { scenario: boolean }) => GameState;
  const state = construct({ map: { seed: definition.seed, size: definition.map?.size ?? 'small', ...(definition.map?.world ? { world: definition.map.world } : {}) }, players: [
    { id: 0, teamId: 0, factionId: definition.faction, controller: 'human' },
    { id: 1, teamId: 1, factionId: definition.opponent, controller: 'external' },
  ], rules: { mode: 'scenario', standardDefeat: false, startingAge: 3, startingResources: definition.rules.resources } }, { scenario: true });
  state.entities = []; state.resources = []; state.events = []; state.corpses = [];
  if (state.world) {
    const offset = firstId - 1;
    for (const bridge of state.world.bridges) bridge.id += offset;
    for (const site of state.world.sites) { site.id += offset; site.creatureIds = site.creatureIds.map(id => id + offset); }
    for (const creature of state.world.creatures) { creature.id += offset; creature.site += offset; if (creature.target !== null) creature.target += offset; }
    state.nextId += offset;
  } else state.nextId = firstId;
  state.explored = [new Set(), new Set()]; state.visible = [new Set(), new Set()];
  if (definition.map) {
    state.width = definition.map.width; state.height = definition.map.height; state.mapSize = definition.map.size; state.mapVersion = MAP_VERSION;
    state.terrain = [...definition.map.terrain]; state.starts = definition.map.starts.map(p => ({ ...p }));
    state.resources = definition.map.resources.map(r => ({ ...r, id: state.nextId++ }));
    if (state.world) state.world.levels[0].terrain = state.terrain;
  }
  const runtime: ScenarioRuntime = {
    version: 1, lastEvaluatedTick: 0, definitionId: definition.id, outcome: 'playing', reason: '', labels: {}, variables: {}, triggers: {}, completed: [], messages: [],
    reinforcementRemaining: definition.rules.reinforcementBudget, escort: { checkpoint: 0, moving: false },
    stealth: { alarms: 0, exposure: {}, detected: [], patrol: {}, distractedUntil: {} },
    boss: { phase: -1, nextAttack: 4, telegraph: null, phasesEntered: [], interrupted: 0, hits: 0, dodged: 0 }, commandCounts: {},
  };
  const session = { definition, state, runtime };
  bindScenarioState(session);
  spawnActors(session, definition.army);
  if (definition.boss) { const boss = actor(session, definition.boss.actor)!; boss.hp = definition.boss.health; boss.maxHp = boss.hp; }
  message(session, definition.briefing); advanceStealth(session, 0); evaluateScenario(session); return session;
}

function action(session: ScenarioSession, value: ScenarioAction): void {
  switch (value.type) {
    case 'spawn': spawnActors(session, value.actors); break;
    case 'order': orderActors(session, value.actors, value.order); break;
    case 'set': session.runtime.variables[value.key] = value.value; break;
    case 'add': addVariable(session, value.key, value.value); break;
    case 'message': message(session, value.text, value.speaker); break;
    case 'reward': { const player = session.state.players[value.side]; for (const key of ['wood', 'ore', 'crystal'] as const) player[key] = Math.min(1e9, player[key] + value.resources[key]); break; }
    case 'alliance': session.state.teams[1] = value.allied ? session.state.teams[0] : session.state.teams[0] === 0 ? 1 : 0; refreshVisibility(session.state); break;
    case 'finish': finish(session, value.outcome, value.reason); break;
  }
}

export function evaluateScenario(session: ScenarioSession): void {
  if (session.runtime.outcome !== 'playing') return;
  let budget = MAX_SCENARIO_ACTIONS_PER_TICK;
  for (const trigger of session.definition.events) {
    const prior = session.runtime.triggers[trigger.id], max = trigger.repeat?.count ?? 1;
    if ((prior?.count ?? 0) >= max || prior && session.state.time - prior.lastTime + 1e-9 < (trigger.repeat?.seconds ?? Infinity) || !scenarioCondition(session, trigger.when)) continue;
    if (budget < trigger.actions.length) break;
    budget -= trigger.actions.length;
    session.runtime.triggers[trigger.id] = { count: (prior?.count ?? 0) + 1, lastTime: session.state.time };
    for (const value of trigger.actions) { action(session, value); if (session.runtime.outcome !== 'playing') return; }
  }
  // A failed protected unit still loses after its individual arrival objective completed.
  for (const objective of session.definition.objectives) if (objective.failure && scenarioCondition(session, objective.failure)) {
    finish(session, 'lost', objective.text); return;
  }
  for (const objective of session.definition.objectives) if (!session.runtime.completed.includes(objective.id) && scenarioCondition(session, objective.success)) {
    session.runtime.completed.push(objective.id); message(session, `Objective completed: ${objective.text}`);
  }
  const actionsDone = (session.definition.requiredActions ?? []).every(required => (session.runtime.commandCounts[required.action] ?? 0) >= required.count);
  if (session.definition.objectives.filter(o => !o.optional).every(o => session.runtime.completed.includes(o.id)) && actionsDone) finish(session, 'won', 'All required objectives completed.');
  else if (session.state.time + 1e-9 >= session.definition.rules.timeLimit) finish(session, 'lost', 'The mission time limit expired.');
}

function advanceEscort(session: ScenarioSession): void {
  const definition = session.definition.escort; if (!definition) return;
  const convoy = actor(session, definition.actor), progress = session.runtime.escort;
  if (!convoy || progress.checkpoint >= definition.route.length) return;
  const destination = definition.route[progress.checkpoint];
  if (distance(convoy, destination) <= definition.radius) {
    progress.checkpoint++; progress.moving = false; session.runtime.variables['escort.checkpoints'] = progress.checkpoint;
    message(session, `Convoy reached checkpoint ${progress.checkpoint} of ${definition.route.length}.`);
    if (progress.checkpoint >= definition.route.length) return;
  }
  const guarded = session.state.entities.some(e => e.hp > 0 && e.id !== convoy.id && e.kind === 'unit' && e.role !== 'worker' && !e.illusion && isAllied(session.state, e.side, convoy.side) && distance(e, convoy) <= definition.escortRadius);
  if (!guarded && progress.moving) { scriptedCommand(session.state, convoy.side, { type: 'stop', ids: [convoy.id] }); progress.moving = false; }
  if (guarded && !progress.moving) {
    const next = definition.route[progress.checkpoint];
    if ((next.level ?? 0) !== (convoy.level ?? 0)) {
      const transition = session.state.world?.transitions.find(t => (t.from.level === (convoy.level ?? 0) && t.to.level === (next.level ?? 0)) || (t.to.level === (convoy.level ?? 0) && t.from.level === (next.level ?? 0)));
      if (transition) progress.moving = scriptedCommand(session.state, convoy.side, { type: 'traverse', ids: [convoy.id], transition: transition.id });
    } else progress.moving = scriptedCommand(session.state, convoy.side, { type: 'move', ids: [convoy.id], ...next });
  }
  if (progress.moving && convoy.order.type === 'idle') progress.moving = false;
}

function detectionLine(state: GameState, from: Vec, to: Vec): boolean {
  const length = distance(from, to), steps = Math.ceil(length * 3);
  for (let step = 1; step < steps; step++) { const t = step / steps; if (terrainAt(state, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.level ?? 0) === 'rock') return false; }
  return true;
}
export function guardDetects(session: ScenarioSession, guard: Entity, target: Entity): boolean {
  const stealth = session.definition.stealth;
  if (!stealth || !isHostile(session.state, guard.side, target.side) || !visible(session.state, guard.side, target) || distance(guard, target) > stealth.radius || !detectionLine(session.state, guard, target)) return false;
  const dx = target.x - guard.x, dy = target.y - guard.y, length = length2D(dx, dy);
  const facing = DIRECTIONS_32[guard.facing * 4];
  return length === 0 || dx * facing[0] + dy * facing[1] >= length * coneCosine(stealth.coneDegrees);
}

function advanceStealth(session: ScenarioSession, dt: number): void {
  const definition = session.definition.stealth; if (!definition) return;
  const progress = session.runtime.stealth;
  for (const label of definition.guards) {
    const guard = actor(session, label); if (!guard) continue;
    const illusion = session.state.entities.filter(e => e.hp > 0 && e.illusion && guardDetects(session, guard, e)).sort((a, b) => distance(a, guard) - distance(b, guard) || a.id - b.id)[0];
    if (illusion) {
      if (guard.order.type !== 'attack' || guard.order.target !== illusion.id) {
        scriptedCommand(session.state, guard.side, { type: 'attack', ids: [guard.id], target: illusion.id });
        message(session, 'A patrol turned toward an illusion.'); addVariable(session, 'stealth.diversions', 1);
      }
      progress.distractedUntil[label] = session.state.time + 1;
    }
    if ((progress.distractedUntil[label] ?? 0) > session.state.time) continue;
    const patrol = definition.patrols.find(p => p.actor === label);
    if (patrol && !progress.detected.length) {
      let index = progress.patrol[label] ?? 0;
      if (distance(guard, patrol.route[index]) <= .65) { index = (index + 1) % patrol.route.length; progress.patrol[label] = index; }
      const next = patrol.route[index];
      if (guard.order.type !== 'move' || guard.order.x !== next.x || guard.order.y !== next.y) scriptedCommand(session.state, guard.side, { type: 'move', ids: [guard.id], ...next });
    }
  }
  for (const label of definition.infiltrators) {
    const infiltrator = actor(session, label); if (!infiltrator) continue;
    const seen = definition.guards.some(guardLabel => {
      const guard = actor(session, guardLabel);
      return !!guard && (progress.distractedUntil[guardLabel] ?? 0) <= session.state.time && guardDetects(session, guard, infiltrator);
    });
    progress.exposure[label] = seen ? Math.min(definition.detectionSeconds, (progress.exposure[label] ?? 0) + dt) : Math.max(0, (progress.exposure[label] ?? 0) - dt * 2);
    if (progress.detected.includes(label)) {
      if (!seen && progress.exposure[label] === 0) { progress.detected = progress.detected.filter(id => id !== label); message(session, 'The patrol lost the infiltrator and resumed its route.'); }
      continue;
    }
    if (progress.exposure[label] + 1e-9 < definition.detectionSeconds) continue;
    progress.detected.push(label); progress.alarms++; session.runtime.variables['stealth.alarms'] = progress.alarms;
    message(session, `Alarm ${progress.alarms}: ${label} was detected.`);
    for (const guardLabel of definition.guards) { const guard = actor(session, guardLabel); if (guard) scriptedCommand(session.state, guard.side, { type: 'attackMove', ids: [guard.id], x: infiltrator.x, y: infiltrator.y }); }
    if (progress.alarms >= definition.alarmLimit) { finish(session, 'lost', 'The infiltrators raised the alarm.'); return; }
  }
}

/** Authored hazards use ordinary entity health, shields, corpses and authoritative events. */
function hazardDamage(session: ScenarioSession, source: Entity, target: Entity, amount: number): void {
  const eventStart = session.state.events.length;
  if (applyScenarioDamage(session.state, source, target, amount, { armorPiercing: true, text: 'Telegraphed boss strike' })) recordEvents(session, eventStart);
}

function advanceBoss(session: ScenarioSession): void {
  const definition = session.definition.boss; if (!definition) return;
  const boss = actor(session, definition.actor), progress = session.runtime.boss;
  if (!boss) {
    const warning = progress.telegraph;
    if (warning && !warning.interrupted && warning.hpAtStart >= definition.phases[warning.phase].interruptDamage) {
      progress.interrupted++; session.runtime.variables['boss.interrupts'] = progress.interrupted;
    }
    session.runtime.variables['boss.defeated'] = 1; progress.telegraph = null; return;
  }
  const fraction = boss.hp / boss.maxHp;
  let phase = progress.phase;
  while (phase + 1 < definition.phases.length && fraction <= definition.phases[phase + 1].below) phase++;
  while (progress.phase < phase) {
    progress.phase++; progress.phasesEntered.push(progress.phase); session.runtime.variables['boss.phases'] = progress.phasesEntered.length;
    const entered = definition.phases[progress.phase]; message(session, `${definition.name}: ${entered.name}.`); spawnActors(session, entered.adds);
  }
  const mechanics = definition.phases[progress.phase];
  if (progress.telegraph) {
    const warning = progress.telegraph;
    // Several ordinary attacks can interrupt the channel. Players must maintain damage during the warning.
    if (!warning.interrupted && warning.hpAtStart - boss.hp >= definition.phases[warning.phase].interruptDamage) {
      warning.interrupted = true; progress.interrupted++; session.runtime.variables['boss.interrupts'] = progress.interrupted;
      message(session, `${definition.name}'s attack was interrupted.`);
    }
    if (session.state.time + 1e-9 < warning.resolveAt) return;
    if (!warning.interrupted) {
      const victims = session.state.entities.filter(e => e.hp > 0 && isHostile(session.state, e.side, boss.side) && e.kind === 'unit' && distance(e, warning) <= warning.radius);
      for (const victim of victims) hazardDamage(session, boss, victim, definition.phases[warning.phase].damage);
      if (victims.some(e => !e.illusion)) progress.hits++; else { progress.dodged++; session.runtime.variables['boss.dodged'] = progress.dodged; }
    }
    progress.telegraph = null; progress.nextAttack = session.state.time + mechanics.cooldown; return;
  }
  if (session.state.time + 1e-9 < progress.nextAttack) return;
  const targets = session.state.entities.filter(e => e.hp > 0 && e.side === 0 && e.kind === 'unit' && !e.illusion && visible(session.state, boss.side, e)).sort((a, b) => distance(a, boss) - distance(b, boss) || a.id - b.id);
  if (!targets.length) { progress.nextAttack = session.state.time + 1; return; }
  const target = targets[0];
  progress.telegraph = { x: target.x, y: target.y, ...(target.level === undefined ? {} : { level: target.level }), radius: mechanics.radius, resolveAt: session.state.time + mechanics.warningSeconds, source: boss.id, phase: progress.phase, hpAtStart: boss.hp, interrupted: false };
  message(session, `${definition.name} marks (${target.x.toFixed(1)}, ${target.y.toFixed(1)}). Move outside ${mechanics.radius} tiles before ${mechanics.warningSeconds} seconds, or interrupt with ${mechanics.interruptDamage} damage.`);
}

function recordEvents(session: ScenarioSession, start = 0): void {
  for (const event of session.state.events.slice(start)) {
    if (event.type === 'ability' && event.side === 0) { session.runtime.commandCounts.ability = (session.runtime.commandCounts.ability ?? 0) + 1; addVariable(session, 'action.ability', 1); }
    if (event.type === 'death') { const dead = session.state.entities.find(e => e.id === event.source); if (dead?.kind === 'unit' && !dead.illusion && !dead.raised) addVariable(session, `deaths.${dead.side}`, 1); }
  }
}

/** Call after the shared simulation step when a client already owns its fixed tick loop. */
export function afterScenarioStep(session: ScenarioSession, dt: number): void {
  if (session.runtime.outcome !== 'playing' || session.runtime.lastEvaluatedTick >= session.state.tick) return;
  session.runtime.lastEvaluatedTick = session.state.tick;
  recordEvents(session); advanceEscort(session); advanceStealth(session, dt); advanceBoss(session); evaluateScenario(session);
}
export function stepScenario(session: ScenarioSession, dt = .05): void {
  if (session.runtime.outcome !== 'playing') return;
  if (Math.abs(dt - .05) > 1e-9) throw new Error('Scenarios advance with the shared 0.05-second tick.');
  stepGame(session.state, dt); afterScenarioStep(session, dt);
}

export function issueScenarioCommand(session: ScenarioSession, side: Side, command: Command): boolean {
  if (!validateCommand(command) || !scenarioCommandPermitted(session.state, side, command)) return false;
  const eventStart = session.state.events.length;
  const before = commandGeneration.get(session.state) ?? 0;
  if (!issueCommand(session.state, side, command)) return false;
  if (before === (commandGeneration.get(session.state) ?? 0)) afterScenarioCommand(session.state, side, command, eventStart);
  return true;
}

export function scenarioCommandPermitted(state: GameState, side: Side, command: Command): boolean {
  const session = scenarioSessionForState(state); if (!session || isScenarioScriptedCommand(state)) return true;
  if (side !== 0 || session.runtime.outcome !== 'playing') return false;
  if (side === 0 && (command.type === 'build' || command.type === 'research') && session.definition.rules.fixedArmy) return false;
  return !(side === 0 && command.type === 'train' && (session.definition.rules.fixedArmy || session.runtime.reinforcementRemaining <= 0));
}

/** Core calls this only for accepted external input, before history notification. */
export function afterScenarioCommand(state: GameState, side: Side, command: Command, eventStart: number): void {
  const session = scenarioSessionForState(state); if (!session || isScenarioScriptedCommand(state)) return;
  commandGeneration.set(state, (commandGeneration.get(state) ?? 0) + 1);
  if (side === 0) {
    if (command.type === 'train') session.runtime.reinforcementRemaining--;
    if (command.type !== 'ability') { session.runtime.commandCounts[command.type] = (session.runtime.commandCounts[command.type] ?? 0) + 1; addVariable(session, `action.${command.type}`, 1); }
    recordEvents(session, eventStart);
  }
  for (const listener of [...(commandListeners.get(state) ?? [])]) {
    try { listener(side, clone(command)); }
    catch (error) { console.error('Scenario command observer failed', error); }
  }
}

export function captureScenario(session: ScenarioSession): ScenarioCheckpoint {
  // This synchronous envelope already stores the binding beside game state.
  // Keep normal saveGame snapshots authoritative without duplicating it here.
  const state = session.state as BoundState, binding = state.scenario;
  delete state.scenario;
  let game: ScenarioCheckpoint['game'];
  try { game = saveGame(state); } finally { if (binding) state.scenario = binding; }
  return { format: 'orcs-vs-fairies-scenario', version: 1, definition: clone(session.definition), runtime: clone(session.runtime), game };
}
export function resetScenario(session: ScenarioSession): ScenarioSession { return createScenario(session.definition); }

export function restoreScenario(input: unknown): ScenarioSession {
  let raw = input;
  if (typeof raw === 'string') { if (raw.length > 18 * 1024 * 1024) throw new Error('Scenario checkpoint exceeds its size limit.'); raw = JSON.parse(raw); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid scenario checkpoint.');
  const envelope = scenarioJson(raw, { maxBytes: 18 * 1024 * 1024, maxNodes: 1000000, maxArrayLength: 100000 }) as ScenarioCheckpoint;
  if (Object.keys(envelope).some(key => !['format', 'version', 'definition', 'runtime', 'game'].includes(key)) || envelope.format !== 'orcs-vs-fairies-scenario' || envelope.version !== 1) throw new Error('Unsupported scenario checkpoint.');
  const definition = validateScenario(envelope.definition), state = loadGame(envelope.game), runtime = scenarioJson(envelope.runtime) as ScenarioRuntime;
  if (runtime && !Object.hasOwn(runtime, 'lastEvaluatedTick')) runtime.lastEvaluatedTick = state.tick;
  validateRuntime(definition, state, runtime);
  const session = { definition, state, runtime }; bindScenarioState(session); return session;
}

export function validateScenarioBinding(input: unknown, state: GameState): ScenarioBinding {
  const binding = scenarioJson(input) as ScenarioBinding;
  if (!binding || typeof binding !== 'object' || Array.isArray(binding) || Object.keys(binding).length !== 2 || !Object.hasOwn(binding, 'definition') || !Object.hasOwn(binding, 'runtime')) throw new Error('Invalid saved scenario binding.');
  const definition = validateScenario(binding.definition); validateRuntime(definition, state, binding.runtime);
  return { definition, runtime: binding.runtime };
}

function validateRuntime(definition: ScenarioDefinition, state: GameState, runtime: ScenarioRuntime): void {
  const fail = (reason: string): never => { throw new Error(`Invalid scenario runtime: ${reason}.`); };
  const fields = ['version', 'lastEvaluatedTick', 'definitionId', 'outcome', 'reason', 'labels', 'variables', 'triggers', 'completed', 'messages', 'reinforcementRemaining', 'escort', 'stealth', 'boss', 'commandCounts'];
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime) || fields.some(key => !Object.hasOwn(runtime, key)) || Object.keys(runtime).some(key => !fields.includes(key))) fail('unknown or missing field');
  if (runtime.version !== 1 || runtime.definitionId !== definition.id || !['playing', 'won', 'lost'].includes(runtime.outcome) || typeof runtime.reason !== 'string' || runtime.reason.length > 4096) fail('identity or outcome');
  if (state.players.length !== 2 || state.players[0].faction !== definition.faction || state.players[1].faction !== definition.opponent || state.seed !== definition.seed || state.rules.mode !== 'scenario' || state.rules.standardDefeat) fail('match identity');
  if (runtime.outcome === 'playing' && (state.winner !== null || state.draw) || runtime.outcome === 'won' && state.winner !== 0 || runtime.outcome === 'lost' && state.winner !== 1) fail('result disagrees with simulation');
  const finite = (n: unknown, min = 0, max = 1e9, integer = false): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isSafeInteger(n));
  if (!finite(runtime.lastEvaluatedTick, 0, state.tick, true)) fail('evaluated tick');
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const exact = (value: unknown, keys: string[]) => record(value) && keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key));
  const counters = (value: unknown, max = 1e9, negative = false) => record(value) && Object.keys(value).length <= 2048 && Object.entries(value).every(([key, n]) => /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(key) && finite(n, negative ? -1e9 : 0, max));
  const actors = [...definition.army, ...definition.events.flatMap(e => e.actions.flatMap(a => a.type === 'spawn' ? a.actors : [])), ...(definition.boss?.phases.flatMap(p => p.adds) ?? [])];
  const labels = new Set(actors.map(a => a.label));
  if (!record(runtime.labels) || Object.entries(runtime.labels).some(([label, id]) => !labels.has(label) || !finite(id, 1, state.nextId - 1, true)) || new Set(Object.values(runtime.labels)).size !== Object.values(runtime.labels).length || definition.army.some(a => !Object.hasOwn(runtime.labels, a.label))) fail('actor references');
  for (const [label, id] of Object.entries(runtime.labels)) { const e = state.entities.find(e => e.id === id), a = actors.find(a => a.label === label)!; if (e && (e.side !== a.side || e.kind !== a.kind || e.role !== a.role)) fail('actor ownership or definition changed'); }
  if (!counters(runtime.variables, 1e9, true) || !counters(runtime.commandCounts) || !finite(runtime.reinforcementRemaining, 0, definition.rules.reinforcementBudget, true)) fail('variables or reinforcement budget');
  if (!record(runtime.triggers)) fail('trigger record');
  for (const [id, entry] of Object.entries(runtime.triggers)) { const e = definition.events.find(e => e.id === id); if (!e || !exact(entry, ['count', 'lastTime']) || !finite(entry.count, 1, e.repeat?.count ?? 1, true) || !finite(entry.lastTime, 0, state.time)) fail('trigger schedule'); }
  if (!Array.isArray(runtime.completed) || runtime.completed.some(id => !definition.objectives.some(o => o.id === id)) || new Set(runtime.completed).size !== runtime.completed.length) fail('objective progress');
  if (!Array.isArray(runtime.messages) || runtime.messages.length > 128 || runtime.messages.some(m => !record(m) || Object.keys(m).some(k => !['time', 'text', 'speaker'].includes(k)) || !finite(m.time, 0, state.time) || typeof m.text !== 'string' || m.text.length > 4096 || m.speaker !== undefined && (typeof m.speaker !== 'string' || m.speaker.length > 96))) fail('messages');
  if (!exact(runtime.escort, ['checkpoint', 'moving']) || !finite(runtime.escort.checkpoint, 0, definition.escort?.route.length ?? 0, true) || typeof runtime.escort.moving !== 'boolean') fail('escort progress');
  const stealth = runtime.stealth;
  if (!exact(stealth, ['alarms', 'exposure', 'detected', 'patrol', 'distractedUntil']) || !finite(stealth.alarms, 0, definition.stealth?.alarmLimit ?? 0, true) || !counters(stealth.exposure, 10) || !counters(stealth.patrol, 31) || !counters(stealth.distractedUntil) || !Array.isArray(stealth.detected) || stealth.detected.some(label => !definition.stealth?.infiltrators.includes(label)) || new Set(stealth.detected).size !== stealth.detected.length) fail('stealth progress');
  if (Object.keys(stealth.patrol).some(label => { const p = definition.stealth?.patrols.find(p => p.actor === label); return !p || !finite(stealth.patrol[label], 0, p.route.length - 1, true); })) fail('patrol waypoint');
  const boss = runtime.boss;
  if (!exact(boss, ['phase', 'nextAttack', 'telegraph', 'phasesEntered', 'interrupted', 'hits', 'dodged']) || !finite(boss.phase, -1, (definition.boss?.phases.length ?? 0) - 1, true) || !finite(boss.nextAttack) || !Array.isArray(boss.phasesEntered) || boss.phasesEntered.some((n, i) => n !== i || n > boss.phase) || !finite(boss.interrupted, 0, 1e6, true) || !finite(boss.hits, 0, 1e6, true) || !finite(boss.dodged, 0, 1e6, true)) fail('boss progress');
  if (boss.telegraph !== null) {
    const t = boss.telegraph;
    const keys = ['x', 'y', 'radius', 'resolveAt', 'source', 'phase', 'hpAtStart', 'interrupted', ...(t.level === undefined ? [] : ['level'])];
    if (!definition.boss || !exact(t, keys) || !finite(t.x, 0, state.width) || !finite(t.y, 0, state.height) || t.level !== undefined && !finite(t.level, 0, (state.world?.levels.length ?? 1) - 1, true) || !finite(t.radius, 1, 16) || !finite(t.resolveAt, 0, state.time + 10) || t.source !== runtime.labels[definition.boss.actor] || !finite(t.phase, 0, boss.phase, true) || !finite(t.hpAtStart, 0, definition.boss.health) || typeof t.interrupted !== 'boolean') fail('boss telegraph');
  }
}
