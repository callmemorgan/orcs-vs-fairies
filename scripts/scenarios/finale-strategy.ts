import { length2D } from '../../src/core/geometry';
import { FACTIONS } from '../../src/core/content';
import { issueScenarioCommand } from '../../src/core/scenarios';
import { isVisible } from '../../src/core/simulation';
import type { ScenarioSession } from '../../src/core/scenario-types';
import type { Command, Entity, UnitRole, Vec } from '../../src/core/types';

const distance = (a: Vec, b: Vec) => length2D(a.x - b.x, a.y - b.y);
interface Orders { nextDecision: number; dodgeUntil: number; warningAt: number; dodging: Set<number> }
const plans = new WeakMap<ScenarioSession, Orders>();
export interface FinaleCommand { time: number; command: Command; accepted: boolean }
const traces = new WeakMap<ScenarioSession, FinaleCommand[]>();

/** Returns copies so proof readers cannot change the walkthrough's command history. */
export function finaleCommands(session: ScenarioSession): readonly FinaleCommand[] {
  return (traces.get(session) ?? []).map(entry => structuredClone(entry));
}

function issue(session: ScenarioSession, command: Command): boolean {
  const accepted = issueScenarioCommand(session, 0, command);
  const trace = traces.get(session) ?? [];
  trace.push({ time: session.state.time, command: structuredClone(command), accepted });
  traces.set(session, trace);
  return accepted;
}

function move(session: ScenarioSession, unit: Entity, point: Vec): void {
  if (unit.order.type === 'move' && distance(unit.order, point) < .25) return;
  issue(session, { type: 'move', ids: [unit.id], ...point });
}

function attack(session: ScenarioSession, unit: Entity, target: Entity): void {
  if (unit.order.type !== 'attack' || unit.order.target !== target.id) issue(session, { type: 'attack', ids: [unit.id], target: target.id });
}

/** Call before each fixed scenario step. This walkthrough uses player commands and observed actors. */
export function steerFinale(session: ScenarioSession): void {
  const bossDefinition = session.definition.boss;
  if (session.runtime.outcome !== 'playing' || !bossDefinition) return;
  let plan = plans.get(session);
  if (!plan) { plan = { nextDecision: 0, dodgeUntil: 0, warningAt: -1, dodging: new Set() }; plans.set(session, plan); }
  if (session.state.time + 1e-9 < plan.nextDecision) return;
  plan.nextDecision = session.state.time + .25;
  const units = session.state.entities.filter(e => e.side === 0 && e.hp > 0 && e.kind === 'unit' && !e.illusion);
  const bossActor = session.definition.army.find(a => a.label === bossDefinition.actor)!;
  const visible = session.state.entities.filter(e => e.side === 1 && e.hp > 0 && isVisible(session.state, 0, e.x, e.y));
  const boss = visible.find(e => e.id === session.runtime.labels[bossDefinition.actor]);
  const commander = units.find(e => e.id === session.runtime.labels.commander);
  const warning = session.runtime.boss.telegraph;
  // Leave an unanswered warning circle before returning to concentrated fire.
  if (warning && !warning.interrupted && session.runtime.boss.dodged === 0 && session.runtime.boss.interrupted === 0 && warning.resolveAt !== plan.warningAt) {
    plan.warningAt = warning.resolveAt; plan.dodgeUntil = warning.resolveAt + .1;
    plan.dodging.clear();
    // A restored checkpoint retains avoidance orders even though its WeakMap plan is new.
    for (const unit of units) if (distance(unit, warning) > warning.radius + .75 &&
      (unit.order.type === 'hold' || unit.order.type === 'move' && distance(unit.order, warning) > warning.radius + .75)) plan.dodging.add(unit.id);
    for (const unit of units.filter(e => distance(e, warning) <= warning.radius + .75)) {
      plan.dodging.add(unit.id);
      const direction = Math.atan2(unit.y - warning.y, unit.x - warning.x);
      const angle = distance(unit, warning) < .25 ? Math.atan2(unit.y - bossActor.y, unit.x - bossActor.x) : direction;
      move(session, unit, { x: warning.x + Math.cos(angle) * (warning.radius + 1.3), y: warning.y + Math.sin(angle) * (warning.radius + 1.3) });
    }
  }
  for (const unit of units) {
    const definition = FACTIONS[session.definition.faction].units[unit.role as UnitRole];
    if (session.state.time < plan.dodgeUntil && plan.dodging.has(unit.id)) {
      if (unit.order.type !== 'move' && unit.order.type !== 'hold') issue(session, { type: 'hold', ids: [unit.id] });
      continue;
    }
    // Keep the protected melee commander out of the Grave Warden's firing range.
    if (session.definition.faction === 'dwarves') {
      const range = unit.role === 'special' || unit === commander ? 8.3 : definition.range - .2;
      const center = boss ?? bossActor;
      const angle = Math.atan2(session.state.starts[0].y - center.y, session.state.starts[0].x - center.x);
      const index = units.indexOf(unit), offset = (index - (units.length - 1) / 2) * .12;
      const shelf = { x: center.x + Math.cos(angle + offset) * range, y: center.y + Math.sin(angle + offset) * range };
      if (unit.role === 'special' && boss && distance(unit, boss) > 9) { move(session, unit, shelf); continue; }
      if (distance(unit, shelf) > .55 && unit.entrenchedAt === undefined) { move(session, unit, shelf); continue; }
      if (unit.entrenchedAt === undefined && boss) issue(session, { type: 'ability', ids: [unit.id] });
      continue;
    }
    if (unit === commander && unit.hp / unit.maxHp < .3 && boss) {
      const angle = Math.atan2(unit.y - boss.y, unit.x - boss.x);
      move(session, unit, { x: boss.x + Math.cos(angle) * 9, y: boss.y + Math.sin(angle) * 9 });
      continue;
    }
    const adds = visible.filter(e => e.id !== session.runtime.labels[bossDefinition.actor]);
    const close = adds.sort((a, b) => distance(unit, a) - distance(unit, b) || a.id - b.id)[0];
    const target = close && distance(unit, close) < 8 ? close : boss;
    if (target) {
      attack(session, unit, target);
      if (definition.ability && (unit.abilityReadyAt ?? 0) <= session.state.time && distance(unit, target) < 8) issue(session, { type: 'ability', ids: [unit.id] });
    } else if (unit.order.type !== 'attackMove') issue(session, { type: 'attackMove', ids: [unit.id], x: bossActor.x, y: bossActor.y });
  }
}
