import type Phaser from 'phaser';
import { factionConcealment, isCorpseWagon } from '../core/faction-systems';
import { FACTION_STRUCTURE_INFO, factionStructureKind } from '../core/faction-systems-content';
import type { Entity, GameState, Side, Vec } from '../core/types';

/** Only draw state belonging to the viewer or an actor the viewer can observe. */
export function drawFactionOverlay(g:Phaser.GameObjects.Graphics,state:GameState,side:Side,selected:readonly number[],visible:(e:Entity)=>boolean,project:(x:number,y:number)=>Vec,activeLevel=0):void {
 const shown=state.entities.filter(e=>e.hp>0&&visible(e));
 for(const e of shown){const own=e.side===side,chosen=selected.includes(e.id),f=e.factionState,p=project(e.x,e.y),kind=factionStructureKind(e.definitionId);
  if(own&&chosen&&kind){const r=FACTION_STRUCTURE_INFO[kind].radius,color=kind==='power-relay'?0xb59fe5:kind==='tunnel'?0xe2bc86:kind==='necropolis'?0xb7a2d9:0x8dd6b0;g.lineStyle(1,color,.3).strokeEllipse(p.x,p.y,r*64*Math.SQRT2,r*32*Math.SQRT2);}
  if(own&&e.kind==='unit'&&factionConcealment(state,e))g.lineStyle(1.5,0x8bd6b0,.75).strokeEllipse(p.x,p.y+2,38,18);
  if(f?.chant&&f.chant.until>state.time)g.lineStyle(2,f.chant.kind==='assault'?0xe7a465:0xa4b9e0,.75).strokeEllipse(p.x,p.y,30,15);
  if(!own||!chosen)continue;
  if(f?.tunnel){g.fillStyle(0x182426,.9).fillRect(p.x-16,p.y+28,32,4);g.fillStyle(0xe2bc86,.95).fillRect(p.x-15,p.y+29,30*f.tunnel.progress,2);const target=shown.find(t=>t.id===f.tunnel!.target);if(target&&(target.level??0)===(e.level??0)){const exit=project(target.x,target.y);g.lineStyle(1,0xe2bc86,.35).lineBetween(p.x,p.y,exit.x,exit.y);}}
  if(f?.corpseOrder){g.fillStyle(0x182426,.9).fillRect(p.x-16,p.y+28,32,4);g.fillStyle(0xc9b2e6,.95).fillRect(p.x-15,p.y+29,30*f.corpseOrder.progress,2);}
  if(isCorpseWagon(e))for(let i=0;i<6;i++)g.fillStyle(i<(f?.corpseCargo?.length??0)?0xc9b2e6:0x384047,.9).fillCircle(p.x-13+i*5,p.y+23,2);
  if(f?.power){g.fillStyle(f.power.connected?0xb9a3e8:0x7e7b84,.95).fillCircle(p.x+18,p.y-37,4);if(f.power.connected)for(const target of shown)if(target.side===side&&target.kind==='building'&&target.id!==e.id&&target.factionState?.power?.connected&&(target.level??0)===(e.level??0)&&Math.hypot(target.x-e.x,target.y-e.y)<=8){const to=project(target.x,target.y);g.lineStyle(1,0xb9a3e8,.35).lineBetween(p.x,p.y,to.x,to.y);}}
 }
 for(const effect of state.factionSystems?.terrainEffects??[])for(const tile of effect.tiles){if(tile.level!==activeLevel||!state.visible[side]?.has(tile.level*state.width*state.height+Math.floor(tile.y)*state.width+Math.floor(tile.x)))continue;const p=project(tile.x,tile.y),alpha=.12+.1*Math.min(1,Math.max(0,effect.until-state.time)/20);g.lineStyle(1,tile.after==='mud'?0xbca886:0x7dbbc9,alpha).strokeEllipse(p.x,p.y,38,17);}
}
