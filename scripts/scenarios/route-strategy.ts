import { length2D } from '../../src/core/geometry';
import { unitFor } from '../../src/core/content-registry';
import { missionAbilityCommand } from './ability-strategy';
import { issueScenarioCommand, type ScenarioSession } from '../../src/core/scenarios';
import { isHostile, isVisible } from '../../src/core/simulation';
import type { Command, Entity, Vec } from '../../src/core/types';

export interface RouteCommandTrace { tick: number; time: number; side: 0; command: Command; accepted: boolean }
const commandTraces = new WeakMap<ScenarioSession, RouteCommandTrace[]>();

/** Copies prevent proof consumers from changing the steering trace. */
export function routeCommands(session: ScenarioSession): readonly RouteCommandTrace[] {
  return (commandTraces.get(session) ?? []).map(entry => ({ ...entry, command: structuredClone(entry.command) }));
}

function issue(session: ScenarioSession, command: Command): boolean {
  const accepted = issueScenarioCommand(session, 0, command);
  const trace = commandTraces.get(session) ?? [];
  trace.push({ tick: session.state.tick, time: session.state.time, side: 0, command: structuredClone(command), accepted });
  commandTraces.set(session, trace);
  return accepted;
}

const distance = (a: Vec, b: Vec) => length2D(a.x - b.x, a.y - b.y);
const own = (session: ScenarioSession) => session.state.entities.filter(e => e.side === 0 && e.hp > 0 && !e.illusion);
const enemies = (session: ScenarioSession) => session.state.entities.filter(e => e.hp > 0 && isHostile(session.state, 0, e.side) && isVisible(session.state, 0, e.x, e.y));
const troops = (session: ScenarioSession) => own(session).filter(e => e.kind === 'unit' && e.role !== 'worker');
const definition = (session: ScenarioSession, e: Entity) => unitFor(session.state, e);
const pausedConvoys = new WeakMap<ScenarioSession, Vec>();

function advance(session: ScenarioSession, unit: Entity, point: Vec, fight = false): void {
  const type = fight ? 'attackMove' : 'move';
  const order = unit.order;
  if (distance(unit, point) <= .7 && order.type === 'idle') return;
  if (order.type === type && distance(order, point) <= .65) return;
  issue(session, { type, ids: [unit.id], x: point.x, y: point.y });
}

function engage(session: ScenarioSession, unit: Entity, target: Entity): void {
  const d = definition(session, unit);
  if (d.ability === 'entrench' && distance(unit, target) <= d.range + (unit.entrenchedAt !== undefined && unit.role === 'special' ? 3 : 0)) {
    if (unit.entrenchedAt === undefined) issue(session, { type: 'ability', ids: [unit.id] });
    return;
  }
  if (unit.order.type !== 'attack' || unit.order.target !== target.id) issue(session, { type: 'attack', ids: [unit.id], target: target.id });
  if (d.ability && d.ability !== 'entrench') {
    const wounded = troops(session).some(ally => distance(unit, ally) < 5 && ally.hp < ally.maxHp - 15);
    const command = missionAbilityCommand(session.state, unit);
    if (command && (d.ability !== 'surge' || wounded)) issue(session, command);
  }
}

/** Follow the authored route, moving the convoy behind its guards during ambushes. */
export function steerEscort(session: ScenarioSession): void {
  if (session.runtime.outcome !== 'playing' || !session.definition.escort || session.state.tick % 10 !== 0) return;
  const convoy = own(session).find(e => e.id === session.runtime.labels[session.definition.escort!.actor]);
  if (!convoy) return;
  const army = troops(session), next = session.definition.escort.route[session.runtime.escort.checkpoint];
  if (!next) return;
  const nearby = enemies(session).filter(e => distance(e, convoy) < 15).sort((a, b) => distance(a, convoy) - distance(b, convoy) || a.id - b.id);
  const target = nearby[0];
  if (target) {
    let safe = pausedConvoys.get(session);
    if (!safe) {
      const length = Math.max(.01, distance(convoy, next));
      safe = { x: convoy.x - (next.x - convoy.x) / length * 3.5, y: convoy.y - (next.y - convoy.y) / length * 3.5 };
      pausedConvoys.set(session, safe);
    }
    advance(session, convoy, safe);
    for (const unit of army) engage(session, unit, target);
    return;
  }
  if (pausedConvoys.has(session) || session.runtime.escort.moving && (convoy.order.type !== 'move' || distance(convoy.order, next) > .7)) {
    // A convoy order issued by the player replaces its automatic route order.
    // Resume that route through the same public move command after the threat dies.
    issue(session, { type: 'move', ids: [convoy.id], ...next });
    pausedConvoys.delete(session);
  }
  const length = Math.max(.01, distance(convoy, next)), dx = (next.x - convoy.x) / length, dy = (next.y - convoy.y) / length;
  for (const [index, unit] of army.entries()) {
    const range = definition(session, unit).range;
    const lead = range < 3 ? 2.5 : -.75, flank = (index % 2 ? 1 : -1) * .75;
    advance(session, unit, { x: convoy.x + dx * lead - dy * flank, y: convoy.y + dy * lead + dx * flank });
  }
}

/** Use the finite reserve, concentrate on visible waves, and repair owned defenses. */
export function steerDefense(session: ScenarioSession): void {
  if (session.runtime.outcome !== 'playing' || session.definition.escort || session.state.tick % 10 !== 0) return;
  const owned = own(session), army = troops(session), commander = owned.find(e => e.id === session.runtime.labels.commander);
  const originalTroops = session.definition.army.filter(e => e.side === 0 && e.kind === 'unit' && e.role !== 'worker');
  if (!commander || !originalTroops.length) return;
  const center = originalTroops.reduce((p, e) => ({ x: p.x + e.x / originalTroops.length, y: p.y + e.y / originalTroops.length }), { x: 0, y: 0 });
  const barracks = owned.find(e => e.kind === 'building' && e.role === 'barracks');
  if (barracks && session.runtime.reinforcementRemaining > 0) {
    issue(session, { type: 'setRally', ids: [barracks.id], ...center });
    issue(session, { type: 'train', id: barracks.id, role: 'ranged' });
  }
  const nearby = enemies(session).sort((a, b) => distance(a, center) - distance(b, center) || a.id - b.id);
  if (nearby.length) {
    const target = nearby[0];
    for (const unit of army) {
      if (unit.id === commander.id && unit.hp < unit.maxHp * .6) {
        const fortress = owned.find(e => e.id === session.runtime.labels.fortress);
        if (fortress) advance(session, unit, { x: fortress.x + 3, y: fortress.y + 2 });
      } else engage(session, unit, target);
    }
  } else {
    for (const unit of army) {
      const original = session.definition.army.find(e => e.label in session.runtime.labels && session.runtime.labels[e.label] === unit.id);
      const point = original ?? center;
      if (distance(unit, point) > 1) advance(session, unit, point);
      else if (definition(session, unit).ability === 'entrench' && unit.entrenchedAt === undefined) issue(session, { type: 'ability', ids: [unit.id] });
      else if (unit.order.type !== 'hold') issue(session, { type: 'hold', ids: [unit.id] });
    }
  }
  const repair = owned.filter(e => e.kind === 'building' && e.hp < e.maxHp && isVisible(session.state, 0, e.x, e.y)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (repair && session.state.players[0].wood > 0) for (const worker of owned.filter(e => e.kind === 'unit' && e.role === 'worker')) {
    if (worker.order.type !== 'build' || worker.order.target !== repair.id) issue(session, { type: 'repair', ids: [worker.id], target: repair.id });
  }
}
