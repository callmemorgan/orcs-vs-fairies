import {describe,expect,it} from 'vitest';
import {buildingFor,unitFor} from '../src/core/content-registry';
import {ECONOMY_RULES,economicState} from '../src/core/economy';
import {MatchRecorder,ReplayPlayer} from '../src/core/replays';
import {loadGame,saveGame,SAVE_VERSION} from '../src/core/saves';
import {createSessionFile,decodeSessionFile} from '../src/core/session-storage';
import {createMatch,issueCommand,refreshVisibility,stepGame} from '../src/core/simulation';
import type {Cost,Entity,GameState,ResourceNode} from '../src/core/types';

const wallet=(s:GameState):Cost=>({wood:s.players[0].wood,ore:s.players[0].ore,crystal:s.players[0].crystal});
const debit=(before:Cost,cost:Cost):Cost=>({wood:before.wood-cost.wood,ore:before.ore-cost.ore,crystal:before.crystal-cost.crystal});
function until(s:GameState,predicate:()=>boolean,limit=2400){let ticks=0;while(!predicate()&&ticks++<limit)stepGame(s,.05);expect(predicate()).toBe(true);}
function setup(local:boolean){
 const s=createMatch({map:{seed:4127,size:'medium'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:12000,ore:12000,crystal:1000},populationCap:100}},{id:1,teamId:1,factionId:'fairies',controller:'external'}],rules:{startingAge:3}});
 // Flat authored ground and a finite ore reserve isolate the path and paid runtime behavior.
 s.terrain.fill('grass');s.resources=[];refreshVisibility(s);
 const start=s.entities.find(e=>e.side===0&&e.kind==='building'&&e.role==='hq')!,worker=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role==='worker')!,definition=buildingFor(s,0,'hq'),x=start.x+20,y=start.y;
 expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:x-2,y:y+3})).toBe(true);until(s,()=>worker.order.type==='idle');refreshVisibility(s);
 const before=wallet(s);expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'hq',definitionId:definition.id,x,y})).toBe(true);expect(wallet(s)).toEqual(debit(before,definition.cost));
 const expansion=s.entities.at(-1)!;expect(expansion.definitionId).toBe(definition.id);until(s,()=>expansion.progress===1);
 expect(economicState(s)!.paidCosts.find(item=>item.entityId===expansion.id)?.stock).toEqual(definition.cost);
 const depot=local?expansion:start,node:ResourceNode={id:s.nextId++,x:depot.x+6,y:depot.y,kind:'ore',amount:600,maxAmount:600};s.resources.push(node);
 expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:node.x-1.4,y:node.y})).toBe(true);until(s,()=>worker.order.type==='idle');refreshVisibility(s);
 expect(unitFor(s,worker).id).toBe('orc-worker');expect(worker.carried).toBe(0);
 return {s,worker,node,expansion,depot};
}
const entity=(s:GameState,id:number):Entity=>s.entities.find(e=>e.id===id)!;
const ore=(s:GameState,id:number)=>s.resources.find(n=>n.id===id)!;

describe('mining specialization through public gather and owned deposits',()=>{
 it('gathers faster on the same path, deposits earlier, conserves physical ore, and resumes full saves and replay',()=>{
  const {s,worker,node,expansion}=setup(true),control=loadGame(saveGame(s)),recorder=new MatchRecorder(s),initial=node.amount;
  const before=saveGame(s);expect(issueCommand(s,1,{type:'specializeSettlement',id:expansion.id,kind:'mining'})).toBe(false);expect(saveGame(s)).toEqual(before);
  const funds=wallet(s);expect(issueCommand(s,0,{type:'specializeSettlement',id:expansion.id,kind:'mining'})).toBe(true);expect(wallet(s)).toEqual(debit(funds,ECONOMY_RULES.specialization.cost));
  const specialized=saveGame(s);expect(issueCommand(s,0,{type:'specializeSettlement',id:expansion.id,kind:'military'})).toBe(false);expect(saveGame(s)).toEqual(specialized);
  const miningBank=s.players[0].ore,ordinaryBank=control.players[0].ore;
  for(const state of [s,control])expect(issueCommand(state,0,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);
  for(let tick=0;tick<10;tick++){stepGame(s,.05);stepGame(control,.05);}
  const mined=initial-node.amount,ordinaryMined=initial-ore(control,node.id).amount;
  expect(ordinaryMined).toBeGreaterThan(0);expect(mined/ordinaryMined).toBeCloseTo(1.3,8);expect(worker.carried).toBeCloseTo(mined,8);expect(entity(control,worker.id).carried).toBeCloseTo(ordinaryMined,8);
  expect(s.players[0].ore).toBe(miningBank);expect(control.players[0].ore).toBe(ordinaryBank);expect({x:worker.x,y:worker.y}).toEqual({x:entity(control,worker.id).x,y:entity(control,worker.id).y});
  const resumed=loadGame(saveGame(s));expect(saveGame(resumed).version).toBe(SAVE_VERSION);
  const startTick=s.tick,first:{mining?:number;ordinary?:number}={},deposits:{mining:number[];ordinary:number[]}={mining:[],ordinary:[]};
  for(let tick=0;tick<800;tick++){
   stepGame(s,.05);stepGame(resumed,.05);stepGame(control,.05);
   for(const [label,state] of [['mining',s],['ordinary',control]] as const)for(const event of state.events.filter(event=>event.type==='gather'&&event.source===worker.id)){
    expect(event.target).toBe(expansion.id);expect(event.resource).toBe('ore');expect(event.amount).toBe(18);deposits[label].push(event.amount!);
    if(label==='mining'&&first.mining===undefined){expect(s.players[0].ore).toBe(miningBank+18);expect(control.players[0].ore).toBe(ordinaryBank);expect(worker.carried).toBe(0);expect(entity(control,worker.id).carried).toBeGreaterThan(0);}
    first[label]??=state.tick-startTick;
   }
   if(tick%100===0)expect(saveGame(resumed)).toEqual(saveGame(s));
  }
  expect(first.mining).toBeDefined();expect(first.ordinary).toBeDefined();expect(first.mining!).toBeLessThan(first.ordinary!);expect(deposits.mining.length).toBeGreaterThanOrEqual(3);expect(deposits.ordinary.length).toBeGreaterThanOrEqual(3);
  const delivered=s.players[0].ore-miningBank,ordinaryDelivered=control.players[0].ore-ordinaryBank;
  expect(delivered).toBe(deposits.mining.reduce((sum,amount)=>sum+amount,0));expect(ordinaryDelivered).toBe(deposits.ordinary.reduce((sum,amount)=>sum+amount,0));expect(delivered).toBeGreaterThanOrEqual(ordinaryDelivered);
  expect(initial-node.amount).toBeCloseTo(delivered+worker.carried,7);expect(initial-ore(control,node.id).amount).toBeCloseTo(ordinaryDelivered+entity(control,worker.id).carried,7);
  expect(economicState(s)!.ledgers[0].gathered.ore).toBe(delivered);expect(s.players[1].ore).toBe(control.players[1].ore);expect(saveGame(resumed)).toEqual(saveGame(s));
  const archive=recorder.export(),session=createSessionFile(s,archive),decoded=decodeSessionFile(session);expect(session.game.version).toBe(SAVE_VERSION);expect(archive.initial.version).toBe(SAVE_VERSION);expect(saveGame(decoded.state)).toEqual(saveGame(s));
  const replay=new ReplayPlayer(archive);replay.seek(s.tick);expect(saveGame(replay.state)).toEqual(saveGame(s));replay.dispose();recorder.dispose();
 });

 it('leaves an ordinary owned HQ resource path and deposit rate unchanged outside the mining region',()=>{
  const {s,worker,node,expansion,depot}=setup(false),control=loadGame(saveGame(s)),funds=wallet(s);expect(issueCommand(s,0,{type:'specializeSettlement',id:expansion.id,kind:'mining'})).toBe(true);expect(wallet(s)).toEqual(debit(funds,ECONOMY_RULES.specialization.cost));
  const miningBank=s.players[0].ore,ordinaryBank=control.players[0].ore;
  for(const state of [s,control])expect(issueCommand(state,0,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);
  const delivered:{specialized:number[];control:number[]}={specialized:[],control:[]};
  for(let tick=0;tick<600;tick++){
   stepGame(s,.05);stepGame(control,.05);expect(ore(s,node.id).amount).toBe(ore(control,node.id).amount);
   const ordinary=entity(control,worker.id);expect({x:worker.x,y:worker.y,carried:worker.carried,order:worker.order}).toEqual({x:ordinary.x,y:ordinary.y,carried:ordinary.carried,order:ordinary.order});
   for(const [label,state] of [['specialized',s],['control',control]] as const)for(const event of state.events.filter(event=>event.type==='gather'&&event.source===worker.id)){expect(event.target).toBe(depot.id);delivered[label].push(event.amount!);}
  }
  expect(delivered.specialized.length).toBeGreaterThan(0);expect(delivered.specialized).toEqual(delivered.control);expect(s.players[0].ore-miningBank).toBe(control.players[0].ore-ordinaryBank);expect(economicState(s)!.ledgers[0].gathered.ore).toBe(economicState(control)!.ledgers[0].gathered.ore);
 });
});
