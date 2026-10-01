import { FACTIONS } from '../core/content';
import { walkable } from '../core/navigation';
import { isVisible } from '../core/simulation';
import type { Entity, GameState, UnitRole } from '../core/types';

/** Digit preventDefault is skipped while paused or finished so Ctrl+1-9 still switches browser tabs. */
export function captureDigitHotkeys(paused:boolean,finished:boolean){return !paused&&!finished;}

/** Explain target-dependent actions using the same radii and ownership as gameplay. */
export function abilityTargetReason(state:GameState,casters:Entity[]):string {
  let reason='';
  for(const caster of casters){
    if((caster.abilityReadyAt??0)>state.time)continue;
    const ability=FACTIONS[state.players[caster.side].faction].units[caster.role as UnitRole].ability;
    const nearby=state.entities.filter(e=>e.side===caster.side&&e.hp>0&&e.kind==='unit'&&!e.illusion&&Math.hypot(e.x-caster.x,e.y-caster.y)<5);
    if(ability==='raise'){
      const player=state.players[caster.side];
      const reserved=state.entities.filter(e=>e.side===caster.side&&e.hp>0).reduce((n,e)=>n+e.queue.length,0);
      if(player.population+reserved>=player.cap){reason='Build a depot for supply';continue;}
      const corpse=state.corpses.some(c=>c.expires>state.time&&Math.hypot(c.x-caster.x,c.y-caster.y)<=6&&isVisible(state,caster.side,c.x,c.y)&&walkable(state,c.x,c.y));
      if(!corpse){reason='No usable corpses within 6 tiles';continue;}
    }else if(ability==='ward'&&!nearby.some(e=>(e.shield??0)<(e.maxShield??0))){reason='Nearby shields are full';continue;}
    else if(ability==='heal'&&!nearby.some(e=>e.hp<e.maxHp)){reason='No wounded allies within 5 tiles';continue;}
    return '';
  }
  return reason;
}
