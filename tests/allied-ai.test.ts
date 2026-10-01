import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { subscribeSimulation } from '../src/core/history-hooks';
import { PlayerView } from '../src/core/observation';
import { loadGame, saveGame } from '../src/core/saves';
import {
 alliedAiStatus, captureRuntime, createMatch, isVisible, issueCommand,
 refreshVisibility, restoreRuntime, runAI, spawnDefinition, stepGame,
} from '../src/core/simulation';
import type { AllyDirective, TeamAiState } from '../src/core/team-ai';
import type { Command, Controller, Cost, Entity, GameState, Side, UnitRole, Vec } from '../src/core/types';

const banks=(s:GameState)=>s.players.map(({wood,ore,crystal})=>({wood,ore,crystal}));
const total=(s:GameState):Cost=>s.players.reduce((sum,p)=>({wood:sum.wood+p.wood,ore:sum.ore+p.ore,crystal:sum.crystal+p.crystal}),{wood:0,ore:0,crystal:0});
const teamState=(s:GameState):TeamAiState=>captureRuntime(s).teamAI!;
const request=(s:GameState,id=1):AllyDirective=>teamState(s).directives.find(d=>d.id===id)!;
const position=(e:Vec):Vec=>({x:e.x,y:e.y});
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const entity=(s:GameState,id:number)=>s.entities.find(e=>e.id===id)!;

function fixture(controllers:Controller[]=['external','ai','external','external'],rules:{friendlyFire?:boolean}={}):GameState {
 const s=createMatch({map:{seed:4127,size:'medium'},players:controllers.map((controller,id)=>({id:id as Side,teamId:id===3?7:3,factionId:'orcs',controller})),rules:{sharedVision:false,...rules}});
 s.terrain.fill('grass');s.resources=[];s.time=0;
 const starts=[{x:8,y:8},{x:8,y:24},{x:8,y:39},{x:39,y:24}];s.starts=starts;
 s.entities=s.entities.filter(e=>e.role==='hq'||e.side===1&&e.role==='melee');
 for(const e of s.entities){const start=starts[e.side];e.x=start.x+(e.kind==='unit'?3:0);e.y=start.y;e.order={type:'idle'};}
 for(const p of s.players){p.wood=p.ore=p.crystal=0;p.population=0;p.cap=12;}
 s.players[1].population=1;
 refreshVisibility(s);return s;
}

function troop(s:GameState,side:Side,role:UnitRole,point:Vec):Entity {
 const def=FACTIONS[s.players[side].faction].units[role];
 const e:Entity={id:s.nextId++,side,kind:'unit',role,...point,hp:def.hp,maxHp:def.hp,order:{type:'idle'},cooldown:0,progress:1,queue:[],trainProgress:0,researchProgress:0,facing:2,animation:'idle',animTime:0,momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[]};
 if(def.shield){e.shield=def.shield;e.maxShield=def.shield;}
 s.entities.push(e);s.players[side].population++;refreshVisibility(s);return e;
}

function advanceUntil(s:GameState,predicate:()=>boolean,seconds=60):void {
 for(let tick=0;tick<seconds*20&&!predicate();tick++)stepGame(s,.05);
 expect(predicate()).toBe(true);
}

function supportFixture(wood:number):GameState {
 const s=fixture();s.players[0].wood=500;s.players[0].ore=100;s.players[0].crystal=30;
 s.players[1].wood=wood;s.players[1].ore=30;s.players[1].crystal=10;
 // An occupied population slot prevents ordinary worker recruitment from spending
 // the resources under test; the request must still keep a worker's cost in reserve.
 s.populationLimits[1]=1;s.players[1].cap=1;return s;
}

function coordinated():GameState {
 const s=fixture(['external','ai','ai','external']);s.time=70;
 s.aiConfigs[1].difficulty='hard';s.aiConfigs[2].difficulty='normal';
 troop(s,1,'melee',{x:12,y:23});troop(s,1,'melee',{x:12,y:25});
 for(let i=0;i<3;i++)troop(s,2,'melee',{x:11+i,y:38});
 for(const side of [1,2] as Side[]){
  const hq=s.entities.find(e=>e.side===side&&e.role==='hq')!;
  troop(s,side,'worker',{x:hq.x+3,y:hq.y+2});
  s.resources.push({id:s.nextId++,kind:'wood',x:hq.x+5,y:hq.y+2,amount:1000,maxAmount:1000},{id:s.nextId++,kind:'ore',x:hq.x+5,y:hq.y+5,amount:1000,maxAmount:1000});
 }
 refreshVisibility(s);return s;
}

describe('public allied resource transfers',()=>{
 it('conserves every resource and uses the authenticated side, including side zero',()=>{
  const s=fixture();Object.assign(s.players[0],{wood:100,ore:60,crystal:9});Object.assign(s.players[1],{wood:10,ore:20,crystal:4});
  const before=total(s),commands:{side:Side;command:Command}[]=[];subscribeSimulation(s,{command:(side,command)=>commands.push({side,command})});
  const resources={wood:50,ore:21,crystal:3};expect(issueCommand(s,0,{type:'transferResources',recipient:1,resources})).toBe(true);
  expect(banks(s).slice(0,2)).toEqual([{wood:50,ore:39,crystal:6},{wood:60,ore:41,crystal:7}]);expect(total(s)).toEqual(before);
  expect(issueCommand(s,1,{type:'transferResources',recipient:0,resources:{wood:7,ore:5,crystal:1}})).toBe(true);
  expect(total(s)).toEqual(before);expect(commands.map(c=>c.side)).toEqual([0,1]);
  expect(teamState(s).transfers).toEqual([{id:1,sender:0,recipient:1,resources,time:0},{id:2,sender:1,recipient:0,resources:{wood:7,ore:5,crystal:1},time:0}]);
 });

 it.each([
  ['negative amount',{type:'transferResources',recipient:1,resources:{wood:-1,ore:0,crystal:0}}],
  ['NaN amount',{type:'transferResources',recipient:1,resources:{wood:1,ore:Number.NaN,crystal:0}}],
  ['infinite amount',{type:'transferResources',recipient:1,resources:{wood:Infinity,ore:0,crystal:0}}],
  ['unknown resource',{type:'transferResources',recipient:1,resources:{wood:1,ore:0,crystal:0,gold:1}}],
  ['spoofed payer',{type:'transferResources',recipient:1,sender:2,resources:{wood:1,ore:0,crystal:0}}],
  ['unknown player',{type:'transferResources',recipient:7,resources:{wood:1,ore:0,crystal:0}}],
  ['out of range player',{type:'transferResources',recipient:8,resources:{wood:1,ore:0,crystal:0}}],
  ['hostile player',{type:'transferResources',recipient:3,resources:{wood:1,ore:0,crystal:0}}],
  ['self transfer',{type:'transferResources',recipient:0,resources:{wood:1,ore:0,crystal:0}}],
  ['insufficient ore after affordable wood',{type:'transferResources',recipient:1,resources:{wood:10,ore:101,crystal:1}}],
  ['insufficient crystal after affordable wood and ore',{type:'transferResources',recipient:1,resources:{wood:10,ore:10,crystal:21}}],
  ['empty transfer',{type:'transferResources',recipient:1,resources:{wood:0,ore:0,crystal:0}}],
 ] as const)('rejects %s without changing any bank or receipt',(_name,command)=>{
  const s=fixture();Object.assign(s.players[0],{wood:100,ore:100,crystal:20});const before=saveGame(s);
  expect(issueCommand(s,0,command as unknown as Command)).toBe(false);expect(saveGame(s)).toEqual(before);
 });

 it('rolls back the entire transfer when the recipient bank would overflow',()=>{
  const s=fixture();Object.assign(s.players[0],{wood:100,ore:100,crystal:20});s.players[1].ore=1e12;const before=saveGame(s);
  expect(issueCommand(s,0,{type:'transferResources',recipient:1,resources:{wood:10,ore:1,crystal:1}})).toBe(false);expect(saveGame(s)).toEqual(before);
 });

 it('rejects transfers from or to an eliminated ally',()=>{
  for(const side of [0,1] as Side[]){const s=fixture();s.players[0].wood=100;s.eliminated[side]=true;const before=saveGame(s);
   expect(issueCommand(s,0,{type:'transferResources',recipient:1,resources:{wood:1,ore:0,crystal:0}})).toBe(false);expect(saveGame(s)).toEqual(before);
  }
 });
});

describe('allied request authorization and team receipts',()=>{
 it('allows only a living allied requester to address an AI recipient',()=>{
  for(const [issuer,recipient] of [[3,1],[0,2],[1,1],[7,1]] as const){const s=fixture(),before=saveGame(s);
   expect(issueCommand(s,issuer as Side,{type:'allyDirective',ally:recipient,directive:'scout',x:22,y:24})).toBe(false);expect(saveGame(s)).toEqual(before);
  }
  for(const side of [0,1] as Side[]){const s=fixture();s.eliminated[side]=true;expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'defend',x:20,y:24})).toBe(false);}
 });

 it('prevents another requester from replacing or cancelling a request, and allows its issuer to do both',()=>{
  const s=fixture();expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'scout',x:24,y:24})).toBe(true);runAI(s,1);expect(request(s).assigned).toHaveLength(1);
  const before=saveGame(s);
  expect(issueCommand(s,2,{type:'cancelAllyDirective',directiveId:1})).toBe(false);
  expect(issueCommand(s,2,{type:'allyDirective',ally:1,directive:'attack',x:24,y:25})).toBe(false);expect(saveGame(s)).toEqual(before);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'defend',x:18,y:24})).toBe(true);
  expect(request(s)).toMatchObject({status:'cancelled',assigned:[],reason:'Replaced by requester.'});expect(request(s,2)).toMatchObject({issuer:0,recipient:1,status:'accepted'});
  expect(issueCommand(s,0,{type:'cancelAllyDirective',directiveId:2})).toBe(true);expect(request(s,2).status).toBe('cancelled');
  expect(issueCommand(s,0,{type:'cancelAllyDirective',directiveId:2})).toBe(false);expect(issueCommand(s,0,{type:'cancelAllyDirective',directiveId:99})).toBe(false);
 });

 it('exposes copied team receipts without private troop assignments or banks and hides them from opponents',()=>{
  const s=fixture();s.players[0].wood=111;s.players[1].ore=222;
  expect(issueCommand(s,0,{type:'transferResources',recipient:1,resources:{wood:7,ore:0,crystal:0}})).toBe(true);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'scout',x:24,y:24})).toBe(true);runAI(s,1);
  const view=alliedAiStatus(s,0);expect(view.allies).toEqual([{side:1,faction:'orcs'}]);expect(view.directives).toHaveLength(1);expect(view.transfers).toHaveLength(1);
  expect(Object.keys(view)).toEqual(['allies','directives','transfers']);expect(view.directives[0]).not.toHaveProperty('assigned');expect(view).not.toHaveProperty('players');expect(view.allies[0]).not.toHaveProperty('wood');
  expect(alliedAiStatus(s,2)).toEqual(view);expect(alliedAiStatus(s,3)).toEqual({allies:[],directives:[],transfers:[]});
  const opposingView=new PlayerView(3).observe(s),privateIds=new Set(request(s).assigned);
  expect(opposingView.entities.every(e=>!privateIds.has(e.id))).toBe(true);expect(opposingView.player).toEqual(s.players[3]);
  expect(opposingView.opponents.every(p=>!('wood' in p)&&!('ore' in p)&&!('crystal' in p))).toBe(true);
  expect(opposingView.alliedAi).toEqual({allies:[],directives:[],transfers:[]});
  view.directives[0].destination!.x=1;view.transfers[0].resources.wood=999;
  expect(request(s).destination).toEqual({x:24,y:24});expect(teamState(s).transfers[0].resources.wood).toBe(7);
 });

 it('requires the issuer to see an attack target and copies the observed position before it moves into fog',()=>{
  const s=fixture(),target=troop(s,3,'worker',{x:14,y:8});
  expect(isVisible(s,0,target.x,target.y)).toBe(true);expect(isVisible(s,1,target.x,target.y)).toBe(false);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'attack',target:target.id})).toBe(true);
  const destination=position(target);target.x=42;target.y=44;refreshVisibility(s);expect(isVisible(s,0,target.x,target.y)).toBe(false);expect(isVisible(s,1,target.x,target.y)).toBe(false);
  const before=saveGame(s);expect(issueCommand(s,2,{type:'allyDirective',ally:1,directive:'attack',target:target.id})).toBe(false);expect(saveGame(s)).toEqual(before);
  const commands:Command[]=[];subscribeSimulation(s,{command:(side,c)=>{if(side===1)commands.push(c);}});runAI(s,1);
  expect(request(s)).toMatchObject({observedTarget:target.id,destination});expect(commands).toContainEqual({type:'attackMove',ids:request(s).assigned,...destination});
  expect(entity(s,request(s).assigned[0]).order).toEqual({type:'attackMove',...destination});
  for(let tick=0;tick<100;tick++){stepGame(s,.05);expect(request(s).destination).toEqual(destination);const order=entity(s,request(s).assigned[0]).order;if(order.type==='attackMove')expect(distance(order,destination)).toBeLessThan(.01);}
 });
});

describe('allied requests executed by real units',()=>{
 it('sends an owned cavalry scout, moves through the world, observes the destination and completes',()=>{
  const s=fixture(),scout=troop(s,1,'cavalry',{x:12,y:25}),destination={x:26,y:28},origin=position(scout);
  expect(isVisible(s,1,destination.x,destination.y)).toBe(false);expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'scout',...destination})).toBe(true);runAI(s,1);
  expect(request(s).assigned).toEqual([scout.id]);expect(scout.order).toEqual({type:'move',...destination});
  advanceUntil(s,()=>request(s).status==='completed',40);
  expect(distance(scout,origin)).toBeGreaterThan(10);expect(distance(scout,destination)).toBeLessThan(3);expect(isVisible(s,1,destination.x,destination.y)).toBe(true);expect(request(s).assigned).toEqual([]);
 });

 it('moves defenders to the request and holds the area before completing its guard period',()=>{
  const s=fixture(),destination={x:21,y:25},defender=s.entities.find(e=>e.side===1&&e.role==='melee')!;
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'defend',...destination})).toBe(true);runAI(s,1);expect(defender.order.type).toBe('attackMove');
  advanceUntil(s,()=>request(s).arrivedAt!==undefined,20);const arrived=request(s).arrivedAt!;
  expect(defender.order.type).toBe('hold');expect(distance(defender,destination)).toBeLessThan(3);
  for(let tick=0;tick<100;tick++)stepGame(s,.05);expect(request(s).status).toBe('active');expect(defender.order.type).toBe('hold');
  advanceUntil(s,()=>request(s).status==='completed',30);expect(s.time-arrived).toBeGreaterThanOrEqual(20);expect(request(s).assigned).toEqual([]);
 });

 it('expires an unavailable request at its deadline without waiting for another AI decision',()=>{
  const s=fixture();s.entities=s.entities.filter(e=>e.kind==='building');s.players[1].population=0;
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'defend',x:20,y:24})).toBe(true);runAI(s,1);expect(request(s).reason).toBe('Waiting for available troops.');
  const r=captureRuntime(s);r.aiDecisionAt[1]=91;restoreRuntime(s,r);s.time=89.95;stepGame(s,.05);
  expect(s.time).toBe(90);expect(request(s)).toMatchObject({status:'failed',assigned:[],reason:'Request expired.'});expect(()=>loadGame(saveGame(s))).not.toThrow();
 });

 it('attacks a requested enemy with ordinary combat and completes after the cleared area is observed',()=>{
  const s=fixture(),destination={x:24,y:24},target=troop(s,3,'worker',destination);
  troop(s,1,'melee',{x:12,y:23});troop(s,1,'melee',{x:12,y:25});troop(s,1,'melee',{x:13,y:24});
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'attack',...destination})).toBe(true);runAI(s,1);
  const ids=[...request(s).assigned];expect(ids).toHaveLength(4);expect(ids.every(id=>entity(s,id).side===1&&entity(s,id).order.type==='attackMove')).toBe(true);
  const attacks:number[]=[];let died=false;
  for(let tick=0;tick<1200&&request(s).status!=='completed';tick++){
   stepGame(s,.05);for(const event of s.events){if(event.type==='attack'&&event.target===target.id&&event.side===1)attacks.push(event.amount??0);if(event.type==='death'&&event.source===target.id)died=true;}
  }
  expect(attacks.length).toBeGreaterThan(0);expect(attacks.reduce((a,b)=>a+b,0)).toBeGreaterThanOrEqual(target.maxHp);expect(died).toBe(true);expect(target.hp).toBe(0);
  expect(request(s)).toMatchObject({status:'completed',assigned:[],reason:'Requested area observed and cleared.'});expect(isVisible(s,1,destination.x,destination.y)).toBe(true);
 });

 it('moves a 64-fighter public formation into an empty requested area and completes after saving',()=>{
  const s=fixture(),destination={x:26,y:24},original=s.entities.find(e=>e.side===1&&e.role==='melee')!;original.x=14;original.y=18;
  const army=[original,...Array.from({length:63},(_,i)=>troop(s,1,'melee',{x:14+(i+1)%8*.8,y:18+Math.floor((i+1)/8)*.8}))];
  const producer=s.entities.find(e=>e.side===1&&e.role==='hq')!,depot=FACTIONS.orcs.buildings.depot;
  for(let i=0;i<6;i++)s.entities.push({...structuredClone(producer),id:s.nextId++,role:'depot',x:4,y:11+i*5,hp:depot.hp,maxHp:depot.hp});
  s.players[1].cap=72;refreshVisibility(s);const origins=new Map(army.map(e=>[e.id,position(e)]));
  expect(s.players[1].population).toBe(64);expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'attack',...destination})).toBe(true);
  const commands:Command[]=[];subscribeSimulation(s,{command:(side,c)=>{if(side===1)commands.push(c);}});runAI(s,1);
  expect(commands).toContainEqual({type:'attackMove',ids:army.map(e=>e.id),...destination});expect(request(s).assigned).toHaveLength(64);
  expect(army.every(e=>e.order.type==='attackMove')).toBe(true);expect(army.some(e=>e.order.type==='attackMove'&&distance(e.order,destination)>3)).toBe(true);
  const restored=loadGame(saveGame(s));
  for(let tick=0;tick<600&&request(s).status!=='completed';tick++){stepGame(s,.1);stepGame(restored,.1);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}
  expect(request(s)).toMatchObject({status:'completed',assigned:[],reason:'Requested area observed and cleared.'});expect(s.time).toBeLessThan(60);
  expect(request(s).arrivedAt).toBeDefined();expect(s.time-request(s).arrivedAt!).toBeGreaterThanOrEqual(3);
  expect(army.every(e=>distance(e,origins.get(e.id)!)>2)).toBe(true);expect(army.some(e=>distance(e,destination)>3)).toBe(true);expect(isVisible(s,1,destination.x,destination.y)).toBe(true);
 });

 it('sends requested support once through the public transfer command and conserves resources',()=>{
  const s=supportFixture(200),before=total(s),resources={wood:100,ore:5,crystal:2};
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'support',resources})).toBe(true);
  const commands:Command[]=[];subscribeSimulation(s,{command:(side,c)=>{if(side===1)commands.push(c);}});runAI(s,1);
  expect(commands).toContainEqual({type:'transferResources',recipient:0,resources});expect(request(s).status).toBe('completed');expect(total(s)).toEqual(before);
  const after=banks(s);for(let i=0;i<5;i++)runAI(s,1);expect(banks(s)).toEqual(after);expect(teamState(s).transfers).toHaveLength(1);
 });

 it('keeps its worker reserve while support waits and sends only after spare funds arrive',()=>{
  const workerCost=FACTIONS.orcs.units.worker.cost,s=supportFixture(100+workerCost.wood-1),before=total(s),resources={wood:100,ore:0,crystal:0};
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'support',resources})).toBe(true);runAI(s,1);
  expect(request(s)).toMatchObject({status:'active',reason:'Waiting for spare resources.'});expect(teamState(s).transfers).toEqual([]);expect(total(s)).toEqual(before);
  expect(issueCommand(s,0,{type:'transferResources',recipient:1,resources:{wood:1,ore:0,crystal:0}})).toBe(true);runAI(s,1);
  expect(request(s).status).toBe('completed');expect(s.players[1].wood).toBe(workerCost.wood);expect(total(s)).toEqual(before);expect(teamState(s).transfers).toHaveLength(2);
 });

 it.each(['defend','attack'] as const)('restarts the %s arrival timer after an emergency pause',kind=>{
  const s=fixture(undefined,{friendlyFire:false}),fighter=s.entities.find(e=>e.side===1&&e.role==='melee')!,destination={x:20,y:24};fighter.x=20;fighter.y=24;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:kind,...destination})).toBe(true);runAI(s,1);expect(request(s).arrivedAt).toBe(0);
  // A completed hostile barracks makes the home defense last longer than the
  // guard period. It has its faction's normal health and deals no damage.
  const def=FACTIONS.orcs.buildings.barracks,threat=spawnDefinition(s,3,'building',def.id,18,24);refreshVisibility(s);
  stepGame(s,.05);expect(request(s).reason).toBe('Defending the stronghold before continuing the request.');expect(request(s).arrivedAt).toBeUndefined();
  for(let tick=0;tick<500;tick++)stepGame(s,.05);expect(threat.hp).toBeGreaterThan(0);expect(request(s).status).toBe('active');expect(distance(fighter,destination)).toBeLessThan(3);
  // Disable allied splash in this timing fixture so clearing the threat keeps
  // the assigned defender alive. Siege damage is exercised separately.
  // Allied siege troops clear the emergency through normal public attacks.
  const siege=Array.from({length:12},(_,i)=>troop(s,0,'siege',{x:23+i%3,y:23+Math.floor(i/3)*.8}));
  expect(issueCommand(s,0,{type:'attack',ids:siege.map(e=>e.id),target:threat.id})).toBe(true);advanceUntil(s,()=>threat.hp===0,5);expect(fighter.hp).toBe(fighter.maxHp);
  advanceUntil(s,()=>request(s).arrivedAt!==undefined,3);const resumed=request(s).arrivedAt!;
  expect(resumed).toBeGreaterThan(25);expect(request(s).status).toBe('active');
  const required=kind==='defend'?20:3;advanceUntil(s,()=>request(s).status==='completed',required+5);expect(s.time-resumed).toBeGreaterThanOrEqual(required);expect(fighter.hp).toBe(fighter.maxHp);
 });
});

describe('allied armies in the running simulation',()=>{
 it.each(['hq','worker','dead fighter','illusion','enemy fighter'] as const)('rejects an active saved assignment containing a %s',kind=>{
  const s=fixture();expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'scout',x:24,y:24})).toBe(true);runAI(s,1);
  let invalid:Entity;
  if(kind==='hq')invalid=s.entities.find(e=>e.side===1&&e.role==='hq')!;
  else if(kind==='worker')invalid=troop(s,1,'worker',{x:12,y:24});
  else if(kind==='enemy fighter')invalid=troop(s,3,'melee',{x:42,y:40});
  else invalid=s.entities.find(e=>e.side===1&&e.role==='melee')!;
  const saved=saveGame(s),assigned=saved.state.entities.find(e=>e.id===invalid.id)!;saved.runtime.teamAI!.directives[0].assigned=[invalid.id];
  if(kind==='dead fighter'){assigned.hp=0;saved.state.players[1].population=0;}
  if(kind==='illusion'){assigned.illusion=true;saved.state.players[1].population=0;}
  expect(()=>loadGame(saved)).toThrow(/team AI|owner|fighter|troop/i);
 });

 it('answers a teammate help waypoint without revealing the hidden attacker or granting shared vision',()=>{
  const s=fixture(['external','ai','ai','external']),fighter=s.entities.find(e=>e.side===1&&e.role==='melee')!;fighter.x=25;fighter.y=39;
  for(const side of [1,2] as Side[]){const hq=s.entities.find(e=>e.side===side&&e.role==='hq')!;troop(s,side,'worker',{x:hq.x+3,y:hq.y+2});s.resources.push({id:s.nextId++,kind:'wood',x:hq.x+5,y:hq.y+2,amount:1000,maxAmount:1000},{id:s.nextId++,kind:'ore',x:hq.x+5,y:hq.y+5,amount:1000,maxAmount:1000});}
  const attacker=troop(s,3,'ranged',{x:16,y:39});refreshVisibility(s);
  expect(isVisible(s,2,attacker.x,attacker.y)).toBe(true);expect(isVisible(s,1,attacker.x,attacker.y)).toBe(false);
  const before=position(fighter);stepGame(s,.05);
  expect(fighter.order).toEqual({type:'attackMove',x:16,y:39});expect(distance(fighter,before)).toBeGreaterThan(0);
  expect(s.sharedVision).toBe(false);expect(isVisible(s,1,attacker.x,attacker.y)).toBe(false);expect(captureRuntime(s).knownEnemyUnits[1]).toEqual([]);
  const view=new PlayerView(1).observe(s);expect(view.entities.some(e=>e.id===attacker.id)).toBe(false);
  expect(issueCommand(s,1,{type:'attack',ids:[fighter.id],target:attacker.id})).toBe(false);
  expect(alliedAiStatus(s,1).directives).toEqual([]);expect(alliedAiStatus(s,3)).toEqual({allies:[],directives:[],transfers:[]});
 });

 it('keeps one distinct scout and launches both approved armies in the same tick despite different decision cadences',()=>{
  const s=coordinated();stepGame(s,.05);const state=teamState(s),wave=state.coordinator.waves[0],scout=state.coordinator.reservations.find(r=>r.role==='scout')!;
  expect(wave).toBeDefined();expect(wave.launched).toBe(false);expect(wave.participants.map(p=>p.side)).toEqual([1,2]);expect(scout).toBeDefined();
  const attacking=new Set(wave.participants.flatMap(p=>p.ids));expect(attacking.has(scout.ids[0])).toBe(false);expect(entity(s,scout.ids[0]).order.type).toBe('move');
  expect(wave.target).toMatchObject({key:'start:3',x:s.starts[3].x,y:s.starts[3].y});
  for(let tick=0;tick<100&&!teamState(s).coordinator.waves[0]?.launched;tick++){
   const before=saveGame(s),probe=loadGame(before);
   for(const p of wave.participants)expect(issueCommand(probe,p.side,{type:'attackMove',ids:p.ids,x:wave.target.x,y:wave.target.y})).toBe(true);
   stepGame(s,.05);const current=teamState(s).coordinator.waves[0];
   if(current?.launched){
    expect(s.time).toBeGreaterThanOrEqual(wave.launchAt);expect(s.time-.05).toBeLessThan(wave.launchAt);
    for(const p of wave.participants){expect(captureRuntime(s).aiWave[p.side]).toBe(s.time);for(const id of p.ids)expect(entity(s,id).order).toEqual(entity(probe,id).order);}
    expect(entity(s,scout.ids[0]).order.type).toBe('move');
   }else for(const id of attacking)expect(entity(s,id).order.type).toBe('idle');
  }
  expect(teamState(s).coordinator.waves[0].launched).toBe(true);expect(captureRuntime(s).aiWave[1]).toBe(captureRuntime(s).aiWave[2]);
 });

 it('preserves the existing final assault when an allied AI loses its source of reinforcements',()=>{
  const s=fixture(['external','ai','ai','external']);s.time=100;const fighter=s.entities.find(e=>e.side===1&&e.role==='melee')!;fighter.hp=1;s.players[1].wood=22;s.players[1].ore=400;
  const r=captureRuntime(s);r.retreating[1]=[[fighter.id,{until:80,produced:0,afterId:s.nextId-1}]];restoreRuntime(s,r);const before=banks(s);
  const commands:Command[]=[];subscribeSimulation(s,{command:(side,c)=>{if(side===1)commands.push(c);}});runAI(s,1);
  expect(captureRuntime(s).retreating[1]).toEqual([]);expect(commands.some(c=>c.type==='attackMove'&&c.ids.includes(fighter.id))).toBe(true);expect(fighter.order.type).toBe('attackMove');expect(banks(s)).toEqual(before);
  stepGame(s,.05);expect(fighter.order.type).toBe('attackMove');expect(captureRuntime(s).retreating[1]).toEqual([]);expect(banks(s)).toEqual(before);
 });

 it('lets a healthy ally launch its ordinary solo wave when its partner cannot replenish troops',()=>{
  const s=fixture(['external','ai','ai','external']);s.time=100;const stranded=s.entities.find(e=>e.side===1&&e.role==='melee')!;s.players[1].wood=22;s.players[1].ore=400;
  const healthy=Array.from({length:FACTIONS.orcs.ai.armySize},(_,i)=>troop(s,2,'melee',{x:11+i%3,y:37+Math.floor(i/3)}));
  troop(s,2,'worker',{x:11,y:41});s.resources.push({id:s.nextId++,kind:'wood',x:13,y:41,amount:1000,maxAmount:1000});refreshVisibility(s);
  stepGame(s,.05);expect(stranded.order.type).toBe('attackMove');expect(healthy.every(e=>e.order.type==='attackMove')).toBe(true);expect(captureRuntime(s).aiWave[2]).toBe(s.time);
  expect(captureRuntime(s).teamAI?.coordinator.waves??[]).toEqual([]);expect(captureRuntime(s).teamAI?.coordinator.reservations??[]).toEqual([]);
  const before=saveGame(s),restored=loadGame(before);for(let tick=0;tick<40;tick++){stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}
  expect(healthy.every(e=>e.order.type==='attackMove')).toBe(true);
 });

 it('bounds a full army wait when its recoverable allied economy has no fighters',()=>{
  const s=fixture(['external','ai','ai','external']);s.time=100;s.entities=s.entities.filter(e=>e.side!==1||e.kind==='building');s.players[1].population=0;
  troop(s,1,'worker',{x:11,y:26});s.populationLimits[1]=1;s.players[1].cap=1;
  const army=Array.from({length:FACTIONS.orcs.ai.armySize},(_,i)=>troop(s,2,'melee',{x:11+i%3,y:37+Math.floor(i/3)}));
  troop(s,2,'worker',{x:11,y:41});s.populationLimits[2]=10;s.players[2].cap=10;
  for(const side of [1,2] as Side[]){const hq=s.entities.find(e=>e.side===side&&e.role==='hq')!;s.resources.push({id:s.nextId++,kind:'wood',x:hq.x+5,y:hq.y+2,amount:1000,maxAmount:1000},{id:s.nextId++,kind:'ore',x:hq.x+5,y:hq.y+5,amount:1000,maxAmount:1000});}
  refreshVisibility(s);const clock=captureRuntime(s);clock.aiWave[2]=40;restoreRuntime(s,clock);const origins=new Map(army.map(e=>[e.id,position(e)]));
  stepGame(s,.05);expect(s.entities.filter(e=>e.side===1&&e.kind==='unit').map(e=>e.role)).toEqual(['worker']);expect(teamState(s).coordinator.waves).toEqual([]);expect(teamState(s).coordinator.reservations.some(r=>r.side===2&&r.role==='scout')).toBe(true);
  const restored=loadGame(saveGame(s));let launchTime:number|undefined;
  for(let tick=0;tick<400&&launchTime===undefined;tick++){
   stepGame(s,.1);stepGame(restored,.1);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));
   if(army.every(e=>e.order.type==='attackMove'))launchTime=s.time;
  }
  expect(launchTime).toBeDefined();expect(launchTime!-100).toBeLessThanOrEqual(40);expect(captureRuntime(s).aiWave[2]).toBe(launchTime);
  const wave=teamState(s).coordinator.waves.find(w=>w.launched&&w.participants.some(p=>p.side===2))!;
  expect(wave.participants).toEqual([{side:2,ids:army.map(e=>e.id)}]);expect(teamState(s).coordinator.reservations.some(r=>r.ids.some(id=>army.some(e=>e.id===id)))).toBe(false);
  for(let tick=0;tick<50;tick++){stepGame(s,.1);stepGame(restored,.1);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}
  expect(army.filter(e=>distance(e,origins.get(e.id)!)>2)).toHaveLength(9);expect(s.entities.filter(e=>e.side===1&&e.kind==='unit').map(e=>e.role)).toEqual(['worker']);expect(s.players[1].cap).toBe(1);
 });

 it('releases existing scout and wave plans when observed wood is exhausted, then follows each owner cadence',()=>{
  const s=coordinated();stepGame(s,.05);const plan=teamState(s).coordinator;
  expect(plan.reservations.some(r=>r.role==='scout')).toBe(true);expect(plan.waves[0].launched).toBe(false);const launchAt=plan.waves[0].launchAt;
  const soldiers=s.entities.filter(e=>e.kind==='unit'&&e.role!=='worker'&&(e.side===1||e.side===2));
  expect(s.entities.filter(e=>e.role==='worker').every(e=>e.carried===0)).toBe(true);
  for(const resource of s.resources){expect(isVisible(s,1,resource.x,resource.y)||isVisible(s,2,resource.x,resource.y)).toBe(true);resource.amount=0;}
  const restored=loadGame(saveGame(s));
  for(let tick=0;tick<25;tick++){
   stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));
   expect(teamState(s).coordinator.reservations).toEqual([]);expect(teamState(s).coordinator.waves).toEqual([]);
  }
  expect(soldiers.every(e=>e.order.type==='attackMove')).toBe(true);
  expect(captureRuntime(s).aiWave[1]).toBeLessThan(launchAt);expect(captureRuntime(s).aiWave[2]).toBeLessThan(launchAt);expect(captureRuntime(s).aiWave[1]).not.toBe(captureRuntime(s).aiWave[2]);
 });

 it('continues pending directives, support and coordinated plans byte for byte after saving on every tick',()=>{
  const s=coordinated();expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'scout',x:24,y:10})).toBe(true);stepGame(s,.05);
  expect(request(s).status).toBe('active');expect(teamState(s).coordinator.waves[0]?.launched).toBe(false);
  const restored=loadGame(JSON.stringify(saveGame(s)));expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));
  for(let tick=0;tick<240;tick++){stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}
  expect(request(s).status).toBe('completed');expect(teamState(s).coordinator.waves.some(w=>w.launched)).toBe(true);
  const support=supportFixture(149);expect(issueCommand(support,0,{type:'allyDirective',ally:1,directive:'support',resources:{wood:100,ore:0,crystal:0}})).toBe(true);runAI(support,1);
  const supportRestored=loadGame(saveGame(support));
  for(let tick=0;tick<40;tick++){if(tick===10)for(const state of [support,supportRestored])expect(issueCommand(state,0,{type:'transferResources',recipient:1,resources:{wood:1,ore:0,crystal:0}})).toBe(true);stepGame(support,.05);stepGame(supportRestored,.05);expect(JSON.stringify(saveGame(supportRestored))).toBe(JSON.stringify(saveGame(support)));}
  expect(request(support).status).toBe('completed');expect(teamState(support).transfers).toHaveLength(2);
 });

 it('cleans dead assigned troops before a save and continues the same ordinary combat after loading',()=>{
  const s=fixture(),fighter=s.entities.find(e=>e.side===1&&e.role==='melee')!;fighter.x=20;fighter.y=24;fighter.hp=1;
  const enemy=troop(s,3,'melee',{x:21,y:24});expect(issueCommand(s,3,{type:'attack',ids:[enemy.id],target:fighter.id})).toBe(true);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'defend',x:20,y:24})).toBe(true);runAI(s,1);expect(request(s).assigned).toEqual([fighter.id]);
  const restored=loadGame(saveGame(s));let observedDeath=false;
  for(let tick=0;tick<60;tick++){stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));if(s.events.some(e=>e.type==='death'&&e.source===fighter.id)){observedDeath=true;expect(request(s).assigned).toEqual([]);expect(()=>loadGame(saveGame(s))).not.toThrow();}}
  expect(observedDeath).toBe(true);expect(fighter.hp).toBe(0);expect(request(s).assigned).toEqual([]);expect(request(s).arrivedAt).toBeUndefined();
 });

 it('starts a fresh guard period when a replacement arrives before the next recipient decision',()=>{
  const s=fixture(),original=s.entities.find(e=>e.side===1&&e.role==='melee')!;original.x=20;original.y=24;original.hp=1;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'defend',x:20,y:24})).toBe(true);runAI(s,1);expect(request(s).arrivedAt).toBe(0);
  const attacker=troop(s,3,'melee',{x:21,y:24});expect(issueCommand(s,3,{type:'attack',ids:[attacker.id],target:original.id})).toBe(true);stepGame(s,.05);expect(original.hp).toBe(0);
  expect(issueCommand(s,3,{type:'move',ids:[attacker.id],x:39,y:24})).toBe(true);
  const replacement=troop(s,1,'melee',{x:20,y:25}),joinedAt=s.time,restored=loadGame(saveGame(s));
  for(let tick=0;tick<24;tick++){stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}
  expect(request(s).assigned).toEqual([replacement.id]);expect(request(s).status).toBe('active');expect(request(s).arrivedAt).toBeGreaterThan(joinedAt);expect(request(s).arrivedAt).toBeGreaterThanOrEqual(1);
 });

 it('removes eliminated owners from pending saved waves and fails their outstanding request',()=>{
  const s=coordinated();stepGame(s,.05);expect(teamState(s).coordinator.waves[0].participants.some(p=>p.side===1)).toBe(true);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'support',resources:{wood:100,ore:0,crystal:0}})).toBe(true);
  const hq=s.entities.find(e=>e.side===1&&e.role==='hq')!;hq.hp=1;const attacker=troop(s,3,'melee',{x:hq.x+3,y:hq.y});refreshVisibility(s);
  expect(issueCommand(s,3,{type:'attack',ids:[attacker.id],target:hq.id})).toBe(true);const restored=loadGame(saveGame(s));
  for(let tick=0;tick<60&&!s.eliminated[1];tick++){stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}
  expect(s.eliminated[1]).toBe(true);expect(s.events.some(e=>e.type==='death'&&e.source===hq.id)).toBe(true);
  const state=teamState(s);expect(state.coordinator.waves.every(w=>w.participants.every(p=>p.side!==1))).toBe(true);expect(state.coordinator.reservations.every(r=>r.side!==1)).toBe(true);expect(request(s)).toMatchObject({status:'failed',assigned:[]});
  expect(JSON.stringify(saveGame(loadGame(saveGame(s))))).toBe(JSON.stringify(saveGame(s)));
 });
});
