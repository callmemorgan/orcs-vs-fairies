import { queuedUnitFor, unitFor } from './content-registry';
import type { GameState, Side } from './types';

/** Recruitment and ownership transfer share one commander slot per player. */
export function commanderAdmissionReason(s:GameState,side:Side):string|undefined {
 for(const e of s.entities)if(e.side===side&&e.hp>0){
  if(e.kind==='unit'&&!e.illusion&&!e.raised&&unitFor(s,e).tags?.includes('hero'))return 'A commander is already alive or queued';
  if(e.kind==='building'&&e.queue.some((_,index)=>queuedUnitFor(s,e,index).tags?.includes('hero')))return 'A commander is already alive or queued';
 }
 const availableAt=Math.max(s.time,...(s.players[side].heroRecovery?.map(r=>r.availableAt)??[]));
 if(availableAt>s.time)return `Commander recovery: ${Math.ceil(availableAt-s.time)}s`;
 return undefined;
}
