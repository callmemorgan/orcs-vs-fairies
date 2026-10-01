import type { Entity, GameState } from './types';
import type { NeutralCreature, WorldBridge } from './world-types';
export type CombatTarget=Entity|NeutralCreature|WorldBridge;
export const isEntityTarget=(target:CombatTarget):target is Entity=>'side' in target;
export const isBridgeTarget=(target:CombatTarget):target is WorldBridge=>'tiles' in target;
export const combatTargets=(s:GameState):CombatTarget[]=>[...s.entities,...s.world?.bridges??[],...s.world?.creatures??[]];
