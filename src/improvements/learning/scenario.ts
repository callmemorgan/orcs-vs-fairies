import { FACTIONS } from '../../core/content';
import { refreshVisibility } from '../../core/simulation';
import type { Entity, GameState, Side, UnitRole, Vec } from '../../core/types';

/** Training scenarios use ordinary unit definitions and preserve unique entity IDs. */
export function practiceUnit(game:GameState,side:Side,role:UnitRole,point:Vec):Entity {
 const def=FACTIONS[game.players[side].faction].units[role];
 const unit:Entity={id:game.nextId++,side,kind:'unit',role,...point,hp:def.hp,maxHp:def.hp,order:{type:'hold'},cooldown:0,progress:1,queue:[],trainProgress:0,researchProgress:0,facing:2,animation:'idle',animTime:0,momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[]};
 if(def.shield){unit.maxShield=def.shield;unit.shield=def.shield;}
 game.entities.push(unit);syncPractice(game);return unit;
}
export function syncPractice(game:GameState):void {
 for(const side of [0,1] as Side[]){
  const living=game.entities.filter(e=>e.side===side&&e.hp>0);
  game.players[side].population=living.filter(e=>e.kind==='unit'&&!e.illusion).length;
  game.players[side].cap=Math.min(100,living.filter(e=>e.kind==='building'&&e.progress===1).reduce((sum,e)=>sum+(e.role==='hq'?12:e.role==='depot'?10:0),0));
 }
 refreshVisibility(game);
}
