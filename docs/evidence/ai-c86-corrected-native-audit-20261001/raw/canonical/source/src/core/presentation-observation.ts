import type { GameState } from './types';
// Online render states contain only actors admitted by the server's observation.
// Weak references keep this presentation decision out of saves and replay rules.
const disclosedStates=new WeakSet<GameState>();
export const markServerObservation=(state:GameState):void=>{disclosedStates.add(state);};
export const isServerObservation=(state:GameState):boolean=>disclosedStates.has(state);
