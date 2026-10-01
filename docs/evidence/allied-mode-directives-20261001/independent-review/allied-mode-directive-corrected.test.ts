import {describe,expect,it} from 'vitest';
import {factionFor} from '/home/morgana/Projects/orcs-vs-Fairies/src/core/content-registry.ts';
import {captureRuntime,createMatch,issueCommand,spawnDefinition,stepGame} from '/home/morgana/Projects/orcs-vs-Fairies/src/core/simulation.ts';

for(const mode of ['hill','relic'] as const)describe(mode,()=>it('reserves requested troops and releases them to the objective',()=>{
 const state=createMatch({map:{seed:4127,size:'small'},players:[
  {id:0,teamId:0,factionId:'orcs',controller:'external'},
  {id:1,teamId:0,factionId:'fairies',controller:'ai'},
  {id:2,teamId:1,factionId:'dwarves',controller:'external'},
 ],rules:{mode}});
 const starter=state.entities.find(e=>e.side===1&&e.kind==='unit'&&e.role==='melee')!;
 const destination={x:starter.x,y:starter.y};
 const definition=factionFor(state,1).units.melee.id;
 for(let i=0;i<3;i++)spawnDefinition(state,1,'unit',definition,destination.x+(i+1)*.1,destination.y,1,0);
 expect(issueCommand(state,0,{type:'allyDirective',ally:1,directive:'defend',...destination})).toBe(true);
 stepGame(state,.05);
 let directive=captureRuntime(state).teamAI!.directives[0];
 expect(directive).toMatchObject({status:'active',arrivedAt:.05});
 expect(directive.assigned).toHaveLength(3);
 const reserved=new Set(directive.assigned);
 const unreserved=state.entities.find(e=>e.side===1&&e.kind==='unit'&&e.role==='melee'&&!reserved.has(e.id))!;
 for(const id of reserved)expect(state.entities.find(e=>e.id===id)!.order).toEqual({type:'hold'});
 expect(unreserved.order.type).toBe('attackMove');
 if(unreserved.order.type==='attackMove'){
  const targets=mode==='hill'?[state.objectives.hill]:state.objectives.relics;
  expect(targets.some(target=>Math.hypot(unreserved.order.x-target.x,unreserved.order.y-target.y)<1)).toBe(true);
 }
 for(let i=0;i<120;i++){
  stepGame(state,.05); directive=captureRuntime(state).teamAI!.directives[0];
  expect(directive.status).toBe('active');
  for(const id of directive.assigned)expect(state.entities.find(e=>e.id===id)!.order).toEqual({type:'hold'});
 }
 for(let i=0;i<400&&directive.status!=='completed';i++){stepGame(state,.05);directive=captureRuntime(state).teamAI!.directives[0];}
 expect(directive).toMatchObject({status:'completed',assigned:[]});
 for(const id of reserved)expect(state.entities.find(e=>e.id===id)!.order.type).toBe('attackMove');
}));
