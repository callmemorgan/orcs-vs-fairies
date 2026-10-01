import type { Command, GameState, Side } from './types';

export interface SimulationObserver {
  command?: (side:Side, command:Command)=>void;
  step?: (dt:number)=>void;
}

const observers = new WeakMap<GameState, Set<SimulationObserver>>();

/** Subscribe to accepted external orders and completed simulation steps. */
export function subscribeSimulation(state:GameState, observer:SimulationObserver):()=>void {
  let listeners=observers.get(state);
  if(!listeners){listeners=new Set();observers.set(state,listeners);}
  listeners.add(observer);
  return ()=>{listeners.delete(observer);if(!listeners.size)observers.delete(state);};
}

export function notifyCommand(state:GameState, side:Side, command:Command):void {
  for(const observer of [...(observers.get(state)??[])]) {
    try { observer.command?.(side,structuredClone(command)); }
    catch(error) { console.error('Match command observer failed',error); }
  }
}

export function notifyStep(state:GameState, dt:number):void {
  for(const observer of [...(observers.get(state)??[])]) {
    try { observer.step?.(dt); }
    catch(error) { console.error('Match step observer failed',error); }
  }
}
