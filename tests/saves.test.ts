import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { loadGame, MAX_SAVE_BYTES, saveGame } from '../src/core/saves';
import { captureRuntime, createGame, issueCommand, refreshVisibility, restoreRuntime, runAI, stepGame } from '../src/core/simulation';
import type { Entity, GameState } from '../src/core/types';

function advance(s:GameState,ticks:number,dt=.25) {for(let i=0;i<ticks;i++)stepGame(s,dt);}
function compareContinuation(original:GameState,ticks:number) {
 const restored=loadGame(JSON.stringify(saveGame(original)));
 expect(saveGame(restored)).toEqual(saveGame(original));
 for(let i=0;i<ticks;i++){
  const dt=[.05,.125,.25][i%3];stepGame(original,dt);stepGame(restored,dt);
  expect(saveGame(restored)).toEqual(saveGame(original));
 }
 return restored;
}
function addSpecial(s:GameState,x:number,y:number):Entity {
 const template=s.entities.find(e=>e.side===0&&e.role==='melee')!,def=FACTIONS[s.players[0].faction].units.special;
 const special:Entity={...structuredClone(template),id:s.nextId++,role:'special',x,y,hp:def.hp,maxHp:def.hp,queue:[],path:[],order:{type:'idle'}};
 if(def.shield){special.shield=def.shield;special.maxShield=def.shield;}
 s.entities.push(special);refreshVisibility(s);return special;
}
function good() {return saveGame(createGame('orcs',4127,'fairies',{controllers:['external','external']}));}

describe('versioned match saves',()=>{
 it('round-trips JSON and detaches state, fog sets, paths, queues and runtime maps',()=>{
  const s=createGame('orcs',4127),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
  expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:15,y:12})).toBe(true);
  expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:13,y:15,queued:true})).toBe(true);
  stepGame(s,.25);const save=saveGame(s),restored=loadGame(save);
  expect(restored).not.toBe(s);expect(restored.explored[0]).toBeInstanceOf(Set);expect(restored.visible[1]).toBeInstanceOf(Set);
  expect(saveGame(restored)).toEqual(save);
  const restoredWorker=restored.entities.find(e=>e.id===worker.id)!;
  restoredWorker.orderQueue![0]={type:'hold'};restoredWorker.path.push({x:1,y:1});restored.players[0].wood++;
  restored.explored[0].clear();save.state.entities[0].hp=1;save.runtime.routes.length=0;
  expect(s.players[0].wood).not.toBe(restored.players[0].wood);expect(worker.orderQueue![0].type).toBe('move');
  expect(s.explored[0].size).toBeGreaterThan(0);expect(s.entities[0].hp).toBe(s.entities[0].maxHp);expect(captureRuntime(s).routes.length).toBeGreaterThan(0);
 });

 it('continues two AI players identically for 600 ticks with scouting and economic memory',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['ai','ai'],mapSize:'small'});
  advance(s,280);
  const enemyHQ=s.entities.find(e=>e.side===1&&e.role==='hq')!,cell=Math.floor(enemyHQ.y)*s.width+Math.floor(enemyHQ.x);
  s.visible[0].add(cell);s.explored[0].add(cell);runAI(s,0);refreshVisibility(s);
  const r=captureRuntime(s);
  expect(r.aiTurns).toBeGreaterThan(60);expect(r.knownEnemyBuildings[0].some(([id])=>id===enemyHQ.id)).toBe(true);
  expect(s.entities.some(e=>e.role==='worker'&&e.order.type==='gather')).toBe(true);
  expect(r.routes.length).toBeGreaterThan(0);
  compareContinuation(s,600);
 },30000);

 it('preserves returning workers, partial loads, queued orders and production over 500 ticks',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','ai']});
  const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,node=s.resources.find(n=>n.kind==='wood')!;
  worker.x=node.x+1.1;worker.y=node.y;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);
  expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:15,y:12,queued:true})).toBe(true);
  const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
  expect(issueCommand(s,0,{type:'train',id:hq.id,role:'worker'})).toBe(true);
  for(let i=0;i<100&&!captureRuntime(s).returning.includes(worker.id);i++)stepGame(s,.25);
  expect(captureRuntime(s).returning).toContain(worker.id);expect(worker.carried).toBe(18);expect(hq.trainProgress).toBeGreaterThan(0);
  const restored=compareContinuation(s,500);
  expect(restored.players[0].wood).toBeGreaterThan(370);
 },30000);

 it('preserves active illusions, ability cooldowns, shields, corpses and a paid research project',()=>{
  const s=createGame('fairies',4127,'automata',{controllers:['external','external']});
  const special=addSpecial(s,12,10),hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
  const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;worker.hp-=10;
  expect(issueCommand(s,0,{type:'ability',ids:[special.id]})).toBe(true);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-speed'})).toBe(true);
  s.corpses.push({id:s.nextId++,x:13,y:10,expires:45});
  const r=captureRuntime(s);expect(r.abilities.some(([id,until])=>id===special.id&&until>0)).toBe(true);expect(s.entities.filter(e=>e.illusion)).toHaveLength(2);
  const restored=loadGame(saveGame(s));
  expect(issueCommand(restored,0,{type:'ability',ids:[special.id]})).toBe(false);
  expect(issueCommand(s,0,{type:'ability',ids:[special.id]})).toBe(false);
  for(let i=0;i<450;i++){
   stepGame(s,.1);stepGame(restored,.1);
   if(i===360){expect(issueCommand(s,0,{type:'ability',ids:[special.id]})).toBe(true);expect(issueCommand(restored,0,{type:'ability',ids:[special.id]})).toBe(true);}
   expect(saveGame(restored)).toEqual(saveGame(s));
  }
  expect(restored.players[0].upgrades).toContain('worker-speed');
 });

 it('preserves the final queued gather through save/load after its waiting list is empty',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external']}),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,node=s.resources.find(n=>n.kind==='wood')!,other=s.resources.filter(n=>n.kind==='wood')[1];
  node.amount=1;worker.x=node.x+1.1;worker.y=node.y;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'gather',ids:[worker.id],target:node.id,queued:true})).toBe(true);
  expect(worker.orderQueue).toBeUndefined();expect(captureRuntime(s).queuedGather).toContain(worker.id);
  const wood=s.players[0].wood,remaining=other.amount;
  const restored=compareContinuation(s,200),restoredWorker=restored.entities.find(e=>e.id===worker.id)!;
  expect(restoredWorker.order.type).toBe('idle');expect(restoredWorker.carried).toBe(0);expect(restored.players[0].wood).toBeCloseTo(wood+1);
  expect(restored.resources.find(n=>n.id===other.id)!.amount).toBe(remaining);expect(captureRuntime(restored).queuedGather).toEqual([]);
 });

 it('keeps repair spending nonnegative and saveable when workers exhaust fractional funds',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external']}),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
  worker.x=hq.x+3;worker.y=hq.y;refreshVisibility(s);
  for(let round=0;round<3;round++){
   hq.hp=1;expect(issueCommand(s,0,{type:'repair',ids:[worker.id],target:hq.id})).toBe(true);
   for(let i=0;i<1000&&hq.hp<hq.maxHp&&s.players[0].wood>0;i++)stepGame(s,.25);
   expect(s.players[0].wood).toBeGreaterThanOrEqual(0);expect(()=>loadGame(saveGame(s))).not.toThrow();
  }
  expect(s.players[0].wood).toBe(0);expect(hq.hp).toBeLessThan(hq.maxHp);
 });

 it('restores every runtime field, including historical route IDs and AI search sets',()=>{
  const s=createGame('orcs',4127),r=captureRuntime(s),entity=s.entities[1],enemyHQ=s.entities.find(e=>e.side===1&&e.role==='hq')!;
  r.fog=.12;r.ai=.7;r.aiTurns=8;r.routes=[[entity.id,{key:'10,10,0.5',at:0}]];r.abilities=[[entity.id,25]];r.returning=[entity.id];entity.order={type:'gather',target:s.resources[0].id};r.queuedGather=[entity.id];
  r.aiWave=[0,0];r.initialScoutDispatched=[true,true];r.expansionScout=[entity.id,null];r.expansionScoutDispatched=[true,false];
  r.knownEnemyBuildings=[[[enemyHQ.id,{x:enemyHQ.x,y:enemyHQ.y,role:'hq'}]],[]];r.enemyStartCleared=[true,false];r.searched=[[120,121],[125]];
  restoreRuntime(s,r);expect(captureRuntime(loadGame(saveGame(s)))).toEqual(r);
 });

 it('saves after finished combat and invalid or game-over steps without stale hit references',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];
  const attacker=s.entities.find(e=>e.side===0&&e.role==='melee')!,target=s.entities.find(e=>e.side===1&&e.role==='worker')!;
  attacker.x=20;attacker.y=20;target.x=21;target.y=20;target.hp=1;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'attack',ids:[attacker.id],target:target.id})).toBe(true);stepGame(s,.1);expect(target.hp).toBe(0);
  expect(captureRuntime(s).hits).toEqual([]);stepGame(s,NaN);expect(()=>loadGame(saveGame(s))).not.toThrow();
  s.winner=0;s.winningTeam=0;stepGame(s,.1);expect(loadGame(saveGame(s)).winner).toBe(0);
 });

 it('does not invoke getters or mutate caller data when validating an object',()=>{
  const save=good(),before=structuredClone(save);let reads=0;
  Object.defineProperty(save.state.entities[0],'hp',{enumerable:true,get:()=>{reads++;return 1;}});
  expect(()=>loadGame(save)).toThrow(/accessors/);expect(reads).toBe(0);
  const array=good();Object.defineProperty(array.state.terrain,'0',{enumerable:true,get:()=>{reads++;return 'grass';}});
  expect(()=>loadGame(array)).toThrow(/accessors/);expect(reads).toBe(0);expect(before.state.entities[0].hp).toBeGreaterThan(1);
 });

 it.each([
  ['unsupported version',(s:any):unknown=>s.version=999],['missing runtime',(s:any):unknown=>delete s.runtime],['missing state field',(s:any):unknown=>delete s.state.tick],
  ['bare state',(s:any):unknown=>{delete s.format;delete s.version;return undefined;}],['unknown state field',(s:any):unknown=>s.state.timer=1],
  ['NaN hp',(s:any):unknown=>s.state.entities[0].hp=NaN],['infinite resources',(s:any):unknown=>s.state.players[0].wood=Infinity],
  ['negative resources',(s:any):unknown=>s.state.players[0].ore=-1],['unbounded resources',(s:any):unknown=>s.state.players[0].wood=1e30],
  ['invalid side',(s:any):unknown=>s.state.entities[0].side=2],['wrong unit role',(s:any):unknown=>s.state.entities[1].role='hq'],
  ['unknown faction',(s:any):unknown=>s.state.players[0].faction='unknown'],['unknown upgrade',(s:any):unknown=>s.state.players[0].upgrades=['unknown']],
  ['duplicate entity',(s:any):unknown=>s.state.entities[1].id=s.state.entities[0].id],['duplicate resource',(s:any):unknown=>s.state.resources[0].id=s.state.entities[0].id],
  ['id beyond nextId',(s:any):unknown=>s.state.entities[0].id=s.state.nextId],['bad terrain length',(s:any):unknown=>s.state.terrain.pop()],
  ['unknown terrain',(s:any):unknown=>s.state.terrain[0]='lava'],['unbounded dimensions',(s:any):unknown=>s.state.width=100000],
  ['invalid coordinate',(s:any):unknown=>s.state.entities[0].x=-1],['missing target',(s:any):unknown=>s.state.entities[1].order={type:'attack'}],
  ['unbounded order queue',(s:any):unknown=>s.state.entities[1].orderQueue=Array(33).fill({type:'idle'})],
  ['invalid path',(s:any):unknown=>s.state.entities[1].path=[{x:1,y:Infinity}]],['invalid production',(s:any):unknown=>s.state.entities[0].queue=['melee']],
  ['unbounded queue',(s:any):unknown=>s.state.entities[0].queue=Array(6).fill('worker')],['overfull carried stock',(s:any):unknown=>s.state.entities[1].carried=19],
  ['invalid runtime timer',(s:any):unknown=>s.runtime.ai=NaN],['duplicate route',(s:any):unknown=>s.runtime.routes=[[1,{key:'x',at:0}],[1,{key:'y',at:0}]]],
  ['future route timestamp',(s:any):unknown=>s.runtime.routes=[[2,{key:'10,10,0.5',at:1e12}]]],
  ['completed active research',(s:any):unknown=>{s.state.players[0].upgrades=['worker-speed'];s.state.entities[0].research='worker-speed';return undefined;}],
  ['duplicate active research',(s:any):unknown=>{s.state.entities[0].research='worker-speed';const duplicate=structuredClone(s.state.entities[0]);duplicate.id=s.state.nextId++;s.state.entities.push(duplicate);return undefined;}],
  ['invalid finite gather marker',(s:any):unknown=>s.runtime.queuedGather=[1]],
  ['invalid ability time',(s:any):unknown=>s.runtime.abilities=[[1,Infinity]]],['invalid memory',(s:any):unknown=>s.runtime.knownEnemyBuildings[0]=[[1,{x:1,y:1,role:'worker'}]]],
  ['missing hit entity',(s:any):unknown=>{s.state.events=[{type:'attack',x:1,y:1,side:0}];s.runtime.hits=[{source:999,target:1,amount:1,event:0}];return undefined;}],
  ['missing hit event',(s:any):unknown=>s.runtime.hits=[{source:1,target:2,amount:1,event:0}]],
  ['invalid fog cell',(s:any):unknown=>s.state.visible[0].push(s.state.width*s.state.height)],
  ['duplicate fog cell',(s:any):unknown=>s.state.explored[0].push(s.state.explored[0][0])],
  ['prototype key',(s:any):unknown=>Object.defineProperty(s.state,'__proto__',{value:{polluted:true},enumerable:true})],
 ] as const)('rejects %s without changing a running game',(_name,mutate)=>{
  const running=createGame('orcs',4127),before=saveGame(running),invalid=good();mutate(invalid);
  expect(()=>loadGame(invalid)).toThrow(Error);expect(saveGame(running)).toEqual(before);
 });

 it.each([null,[],{},'not JSON','{',1,true])('rejects malformed input %j',input=>expect(()=>loadGame(input)).toThrow(Error));
 it('rejects oversized, deeply nested and cyclic payloads',()=>{
  expect(()=>loadGame(' '.repeat(MAX_SAVE_BYTES+1))).toThrow(/size/);
  const cyclic:any=good();cyclic.state.entities[0].order=cyclic;expect(()=>loadGame(cyclic)).toThrow(/cyclic/);
  const nested:any=good();let cursor:any=nested;for(let i=0;i<40;i++)cursor=cursor.extra={};expect(()=>loadGame(nested)).toThrow(/deeply nested/);
 });
});
