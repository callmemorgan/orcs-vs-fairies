import {describe,it,expect} from 'vitest';
import {createMatch,issueCommand,stepGame,captureRuntime} from '/home/morgana/Projects/orcs-vs-Fairies/src/core/simulation.ts';

for(const mode of ['hill','relic'] as const)describe(mode,()=>it('keeps an accepted directive order',()=>{
 const state=createMatch({map:{seed:4127,size:'small'},players:[
  {id:0,teamId:0,factionId:'orcs',controller:'external'},
  {id:1,teamId:0,factionId:'fairies',controller:'ai'},
  {id:2,teamId:1,factionId:'dwarves',controller:'external'},
 ],rules:{mode}});
 const destination={x:state.starts[1].x+2,y:state.starts[1].y+2};
 expect(issueCommand(state,0,{type:'allyDirective',ally:1,directive:'defend',...destination})).toBe(true);
 stepGame(state,.05);
 const directive=captureRuntime(state).teamAI!.directives[0];
 const units=state.entities.filter(e=>directive.assigned.includes(e.id)).map(e=>({id:e.id,order:e.order}));
 console.log(JSON.stringify({mode,hill:state.objectives.hill,relics:state.objectives.relics,destination,directive,units},null,2));
 expect(units.every(({order})=>order.type==='attackMove'&&Math.hypot(order.x-destination.x,order.y-destination.y)<1)).toBe(true);
}));
