import { drawFactionOverlay } from './FactionOverlay';
import type Phaser from 'phaser';
import type { Entity, GameState, Side, Vec } from '../core/types';
import { formationDestination, isCrewless, rangedCoverFactor, tacticalUnitDef, TACTICS } from '../core/tactics';

/** Draw tactical state already permitted by the caller's observation. */
export function drawTacticsOverlay(g:Phaser.GameObjects.Graphics,state:GameState,side:Side,selected:readonly number[],visible:(e:Entity)=>boolean,project:(x:number,y:number)=>Vec,hover?:Entity,activeLevel=0):void {
 drawFactionOverlay(g,state,side,selected,visible,project,activeLevel);
 for(const e of state.entities){
  if(e.hp<=0||!visible(e)||e.kind!=='unit')continue;const p=project(e.x,e.y),t=e.tactics,own=e.side===side&&!isCrewless(e),chosen=selected.includes(e.id);
  if(isCrewless(e)){g.lineStyle(2,0xaab4bd,.9).strokeRect(p.x-13,p.y-32,26,22);g.lineBetween(p.x-12,p.y-31,p.x+12,p.y-11);continue;}
  if(!t)continue;
  if(t.ambush?.concealed&&own){g.lineStyle(2,0x76c58e,.8).strokeEllipse(p.x,p.y+2,42,20);g.lineStyle(1,0x76c58e,.3).strokeEllipse(p.x,p.y,t.ambush.radius*64*Math.SQRT2,t.ambush.radius*32*Math.SQRT2);}
  if(own&&chosen){
   if(t.formation){const goal=formationDestination(t.formation,state),slot=project(goal.x,goal.y);g.lineStyle(1,0xe9d28f,.55).lineBetween(p.x,p.y,slot.x,slot.y);g.strokeEllipse(slot.x,slot.y,22,11);}
   const moraleColor=t.morale<22?0xe67c6b:t.morale<45?0xf0c164:0x89c792;g.fillStyle(0x182426,.9).fillRect(p.x-16,p.y+17,32,4);g.fillStyle(moraleColor,.95).fillRect(p.x-15,p.y+18,30*t.morale/100,2);
   const front={x:Math.cos(e.facing*Math.PI/4),y:Math.sin(e.facing*Math.PI/4)},facing=project(e.x+front.x*.85,e.y+front.y*.85);g.lineStyle(2,0xf0e4b2,.85).lineBetween(p.x,p.y,facing.x,facing.y);
   if((t.guard?.value??0)+(e.shield??0)>0){const behind=project(e.x-front.x*TACTICS.shieldReach,e.y-front.y*TACTICS.shieldReach),left=project(e.x-front.x*TACTICS.shieldReach-front.y*TACTICS.shieldWidth,e.y-front.y*TACTICS.shieldReach+front.x*TACTICS.shieldWidth),right=project(e.x-front.x*TACTICS.shieldReach+front.y*TACTICS.shieldWidth,e.y-front.y*TACTICS.shieldReach-front.x*TACTICS.shieldWidth);g.lineStyle(1,0x8ebced,.55).strokeTriangle(p.x,p.y,left.x,left.y,right.x,right.y);g.lineBetween(p.x,p.y,behind.x,behind.y);}
   if(t.charge){g.fillStyle(0x182426,.9).fillRect(p.x-16,p.y+23,32,4);g.fillStyle(0xeab177,.95).fillRect(p.x-15,p.y+24,30*t.charge.distance/TACTICS.chargeDistance,2);}
   if(t.retreat){g.lineStyle(2,0xe67c6b,.8).strokeTriangle(p.x-5,p.y-43,p.x+5,p.y-43,p.x,p.y-36);}
   if(t.capture){g.fillStyle(0x94cee5,.9).fillRect(p.x-15,p.y+28,30*t.capture.progress,3);}
   if(rangedCoverFactor(state,{x:e.x+front.x*6,y:e.y+front.y*6,level:e.level},e)<1)g.lineStyle(2,0x9eaaa6,.85).strokeRect(p.x-19,p.y-39,8,8);
  }
  if(chosen&&t.siegeCrew){g.fillStyle(0x182426,.9).fillRect(p.x-16,p.y+12,32,4);g.fillStyle(0xb2c9dc,.9).fillRect(p.x-15,p.y+13,30*t.siegeCrew.hp/t.siegeCrew.maxHp,2);}
 }
 for(const shell of state.projectiles??[]){if((shell.level??0)!==activeLevel)continue;if(shell.side!==side&&!state.visible[side]?.has((shell.level??0)*state.width*state.height+Math.floor(shell.y)*state.width+Math.floor(shell.x)))continue;const impact=project(shell.x,shell.y);g.lineStyle(1.5,0xe89977,.8).strokeEllipse(impact.x,impact.y,shell.radius*64*Math.SQRT2,shell.radius*32*Math.SQRT2);const origin=(shell as {from?:Vec}).from;if(!origin)continue;const flight=Math.max(0,Math.min(1,1-(shell.impactAt-state.time)/(.25+Math.hypot(origin.x-shell.x,origin.y-shell.y)/12))),from=project(origin.x,origin.y),x=from.x+(impact.x-from.x)*flight,y=from.y+(impact.y-from.y)*flight-32-Math.sin(flight*Math.PI)*45;g.fillStyle(0xf3c377,1).fillCircle(x,y,4);}
 if(hover&&visible(hover)&&state.entities.some(e=>selected.includes(e.id)&&e.side===side&&!isCrewless(e)&&e.role==='siege')){
  const p=project(hover.x,hover.y),friendlyFire=(state as GameState&{rules?:{friendlyFire:boolean}}).rules?.friendlyFire??state.friendlyFire??true,risk=friendlyFire&&state.entities.some(e=>e.hp>0&&state.teams[e.side]===state.teams[side]&&(e.level??0)===(hover.level??0)&&Math.hypot(e.x-hover.x,e.y-hover.y)<=TACTICS.splashRadius+.3);g.lineStyle(2,risk?0xf16f65:0xe5c378,.8).strokeEllipse(p.x,p.y,TACTICS.splashRadius*64*Math.SQRT2,TACTICS.splashRadius*32*Math.SQRT2);
 }
}
