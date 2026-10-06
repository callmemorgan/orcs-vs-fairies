import { FACTIONS } from '../../src/core/content';
import { createGame, issueCommand, refreshVisibility, stepGame } from '../../src/core/simulation';
import type { FactionId, UnitRole } from '../../src/core/types';

export const SAMPLE={budget:1200,terrain:'grass' as const,dt:.05,secondsCap:120,opponents:['fairies','dwarves','undead','tideborn','automata'] as FactionId[],orientations:[0,1] as const,formations:[0,1,2],compositions:[['melee'],['ranged'],['melee','ranged']] as UnitRole[][]};
export function fight(opponent:FactionId,orcSide:0|1,formation:number,roles:UnitRole[]){
 const factions:[FactionId,FactionId]=orcSide===0?['orcs',opponent]:[opponent,'orcs'];
 const game=createGame(factions[0],4127,factions[1],{controllers:['external','external']});
 game.terrain.fill(SAMPLE.terrain);game.resources=[];
 const template=game.entities.find(e=>e.kind==='unit')!;game.entities=game.entities.filter(e=>e.kind==='building');
 const living=(side:number)=>game.entities.filter(e=>e.kind==='unit'&&e.side===side&&e.hp>0);
 const costs=[{wood:0,ore:0,crystal:0},{wood:0,ore:0,crystal:0}];
 for(const side of [0,1] as const){
  let budget=SAMPLE.budget,index=0;
  while(true){const role=roles[index%roles.length],d=FACTIONS[factions[side]].units[role],weighted=d.cost.wood+d.cost.ore+2*d.cost.crystal;if(weighted>budget)break;budget-=weighted;
   game.entities.push({...structuredClone(template),id:game.nextId++,side,role,hp:d.hp,maxHp:d.hp,shield:d.shield,maxShield:d.shield,x:side===0?20:27,y:20+(index-(SAMPLE.budget/weighted)/2)*.7+formation*.13});
   for(const kind of ['wood','ore','crystal'] as const)costs[side][kind]+=d.cost[kind];index++;
  }
 }
 refreshVisibility(game);for(const side of [0,1] as const)issueCommand(game,side,{type:'attackMove',ids:living(side).map(e=>e.id),x:side===0?27:20,y:20+formation*.13});
 for(let tick=0,ticks=Math.round(SAMPLE.secondsCap/SAMPLE.dt);tick<ticks;tick++){stepGame(game,SAMPLE.dt);if([0,1].some(side=>!living(side).length))break;}
 const health=[0,1].map(side=>living(side).reduce((sum,e)=>sum+e.hp+(e.shield??0),0));
 const draw=health[0]===0&&health[1]===0;
 return {opponent,orcSide,formation,roles,costs,health,seconds:game.time,draw,winner:draw?null:health[0]===0?1:health[1]===0?0:null};
}
export function combatSample(){return SAMPLE.opponents.flatMap(opponent=>SAMPLE.orientations.flatMap(side=>SAMPLE.formations.flatMap(offset=>SAMPLE.compositions.map(roles=>fight(opponent,side,offset,roles)))));}
