import { stepScenario } from '../../src/core/scenarios';
import type { ScenarioSession } from '../../src/core/scenario-types';
import { steerPuzzle, steerStealth } from './puzzle-stealth-strategy';
import { steerFinale } from './finale-strategy';
import { steerDefense, steerEscort } from './route-strategy';

/** Issues one bounded player decision; callers retain the authoritative tick loop. */
export function steerMission(session: ScenarioSession): void {
  const definition=session.definition;
  if(definition.boss) steerFinale(session);
  else if(definition.escort) steerEscort(session);
  else if(definition.stealth) steerStealth(session);
  else if(definition.rules.fixedArmy) steerPuzzle(session);
  else steerDefense(session);
}

/** Completes a prepared detachment with normal commands and simulation ticks. */
export function solveMission(session: ScenarioSession): ScenarioSession {
  const lastTick=session.state.tick+Math.ceil(session.definition.rules.timeLimit/.05)+10;
  while(session.runtime.outcome==='playing' && session.state.tick<lastTick) {steerMission(session);stepScenario(session);}
  return session;
}
