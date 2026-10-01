import { issueScenarioCommand, stepScenario } from '../../src/core/scenarios';
import { FACTIONS } from '../../src/core/content';
import { length2D } from '../../src/core/geometry';
import { isHostile, isVisible } from '../../src/core/simulation';
import type { ScenarioSession } from '../../src/core/scenario-types';
import type { UnitRole } from '../../src/core/types';

export function steerConquest(session: ScenarioSession): void {
  if (session.state.tick % 10 || session.runtime.outcome !== 'playing') return;
  const units = session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.role !== 'worker' && e.hp > 0);
  const enemies = session.state.entities.filter(e => e.hp > 0 && isHostile(session.state, 0, e.side) && isVisible(session.state, 0, e.x, e.y));
  const commander = units.find(e => e.id === session.runtime.labels.commander);
  const target = enemies.sort((a, b) => length2D(a.x - (commander?.x ?? 8), a.y - (commander?.y ?? 16)) - length2D(b.x - (commander?.x ?? 8), b.y - (commander?.y ?? 16)) || a.id - b.id)[0];
  const building = session.state.entities.find(e => e.side === 0 && e.role === 'barracks' && e.hp > 0);
  if (building && session.runtime.reinforcementRemaining > 0 && session.state.tick < 500) { issueScenarioCommand(session, 0, { type: 'setRally', ids: [building.id], x: 12, y: 16 }); issueScenarioCommand(session, 0, { type: 'train', id: building.id, role: 'ranged' }); }
  for (const unit of units) {
    const d = FACTIONS[session.state.players[0].faction].units[unit.role as UnitRole];
    if (target) {
      if (unit.id === commander?.id && unit.hp < unit.maxHp * .6) {
        if (unit.order.type !== 'move' || unit.order.x !== 13 || unit.order.y !== 16) issueScenarioCommand(session, 0, { type: 'move', ids: [unit.id], x: 13, y: 16 });
        continue;
      }
      if (d.ability === 'entrench' && length2D(unit.x - target.x, unit.y - target.y) <= d.range + (unit.entrenchedAt !== undefined && unit.role === 'special' ? 3 : 0)) {
        if (unit.entrenchedAt === undefined) issueScenarioCommand(session, 0, { type: 'ability', ids: [unit.id] });
      } else if (unit.order.type !== 'attack' || unit.order.target !== target.id) issueScenarioCommand(session, 0, { type: 'attack', ids: [unit.id], target: target.id });
      if (d.ability && d.ability !== 'entrench') issueScenarioCommand(session, 0, { type: 'ability', ids: [unit.id] });
    } else if (unit.order.type !== 'attackMove' || unit.order.x !== 29 || unit.order.y !== 16) issueScenarioCommand(session, 0, { type: 'attackMove', ids: [unit.id], x: 29, y: 16 });
  }
}
export function solveConquest(session: ScenarioSession): ScenarioSession {
  while (session.runtime.outcome === 'playing' && session.state.tick < 3610) { steerConquest(session); stepScenario(session); }
  return session;
}
