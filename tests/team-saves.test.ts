import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { loadGame, MAX_SAVE_BYTES, SAVE_VERSION, saveGame } from '../src/core/saves';
import { captureRuntime, createGame, createMatch, issueCommand, refreshVisibility, restoreRuntime, runAI, stepGame } from '../src/core/simulation';
import type { Entity, FactionId, GameState, MatchConfig, Side } from '../src/core/types';

const factions=Object.keys(FACTIONS) as FactionId[];
const teamFields=['teams','incomeFactors','populationLimits','sharedVision','eliminated','winningTeam'] as const;
const aiFields=['aiDecisionAt','aiDecisionTurns','knownEnemyUnits','retreating','producedFighters'] as const;
const playerArrays=['aiConfigs','players','controllers','starts','teams','incomeFactors','populationLimits','eliminated','explored','visible'] as const;
const runtimeArrays=[...aiFields,'aiWave','initialScoutDispatched','expansionScout','expansionScoutDispatched','knownEnemyBuildings','enemyStartCleared','searched','clearedEnemyStarts'] as const;
function invalidCases(values:readonly (readonly [string,(save:any)=>unknown])[]) {return values;}
function config(count:number,ai=false):MatchConfig {
 return {map:{seed:4127,size:'small'},players:Array.from({length:count},(_,id)=>({id:id as Side,teamId:(id<count/2?0:1) as Side,factionId:id===count-1?'fairies':factions[id%factions.length],controller:ai?'ai':'external'})),rules:{sharedVision:true}};
}
function good(count=8) {return saveGame(createMatch(config(count)));}
function legacy(state:GameState):any {
 const save:any=saveGame(state);save.version=1;for(const key of ['rules','objectives','draft'])delete save.state[key];
 for(const key of teamFields)delete save.state[key];
 delete save.state.economy;delete save.state.aiConfigs;delete save.runtime.aiBatchTurns;for(const key of aiFields)delete save.runtime[key];
 delete save.runtime.clearedEnemyStarts;
 return save;
}
function advance(state:GameState,ticks:number):void {for(let i=0;i<ticks;i++)stepGame(state,.25);}
function compareContinuation(original:GameState,ticks:number):GameState {
 const before=saveGame(original),restored=loadGame(JSON.stringify(before));
 expect(saveGame(restored)).toEqual(before);
 for(let i=0;i<ticks;i++){
  const dt=[.05,.125,.25][i%3];stepGame(original,dt);stepGame(restored,dt);
  expect(saveGame(restored)).toEqual(saveGame(original));
 }
 return restored;
}
function special(state:GameState,side:Side):Entity {
 const template=state.entities.find(e=>e.side===side&&e.kind==='unit')!,def=FACTIONS[state.players[side].faction].units.special,start=state.starts[side];
 const entity:Entity={...structuredClone(template),id:state.nextId++,kind:'unit',role:'special',x:start.x+(state.width/2>start.x?3:-3),y:start.y+(state.height/2>start.y?3:-3),hp:def.hp,maxHp:def.hp,order:{type:'idle'},queue:[],path:[],illusion:false,raised:false,carried:0,cooldown:0};
 delete entity.orderQueue;delete entity.shield;delete entity.maxShield;delete entity.abilityReadyAt;delete entity.entrenchedAt;
 if(def.shield){entity.shield=def.shield;entity.maxShield=def.shield;}
 state.entities.push(entity);refreshVisibility(state);return entity;
}

describe('team match saves',()=>{
 it.each([1,2,3,4,5,6,7,8])('round-trips all player and runtime arrays for %i players',count=>{
  const state=createMatch(config(count)),save=saveGame(state),loaded=loadGame(save);
  expect(save.version).toBe(SAVE_VERSION);expect(SAVE_VERSION).toBe(3);expect(saveGame(loaded)).toEqual(save);
  for(const key of playerArrays)expect(save.state[key]).toHaveLength(count);
  for(const key of runtimeArrays)expect(save.runtime[key]).toHaveLength(count);
  loaded.teams[0]=7;loaded.incomeFactors[0]=3;loaded.populationLimits[0]=500;loaded.eliminated[0]=true;
  expect(saveGame(state)).toEqual(save);
 });

 it.each([4,6,8])('continues %i-player team matches identically for 500 ticks with AI, queued workers and abilities',count=>{
  const state=createMatch(config(count,true));advance(state,160);
  const side=(count-1) as Side;state.controllers[side]='external';
  const worker=state.entities.find(e=>e.side===side&&e.role==='worker'&&e.hp>0)!;
  const node=state.resources.filter(n=>n.kind==='wood'&&n.amount>0).sort((a,b)=>Math.hypot(a.x-worker.x,a.y-worker.y)-Math.hypot(b.x-worker.x,b.y-worker.y))[0];
  worker.x=node.x+1.1;worker.y=node.y;worker.carried=0;node.amount=5;refreshVisibility(state);
  expect(issueCommand(state,side,{type:'stop',ids:[worker.id]})).toBe(true);
  expect(issueCommand(state,side,{type:'gather',ids:[worker.id],target:node.id,queued:true})).toBe(true);
  expect(issueCommand(state,side,{type:'move',ids:[worker.id],x:state.starts[side].x,y:state.starts[side].y,queued:true})).toBe(true);
  const caster=special(state,side);expect(issueCommand(state,side,{type:'ability',ids:[caster.id]})).toBe(true);
  // Make the AI's observed scouting history nonempty before taking the snapshot.
  const enemyHQ=state.entities.find(e=>e.side!==0&&state.teams[e.side]!==state.teams[0]&&e.role==='hq'&&e.hp>0)!;
  const cell=Math.floor(enemyHQ.y)*state.width+Math.floor(enemyHQ.x);state.visible[0].add(cell);state.explored[0].add(cell);runAI(state,0);refreshVisibility(state);
  const runtime=captureRuntime(state);
  expect(runtime.aiTurns).toBeGreaterThan(0);expect(runtime.knownEnemyBuildings[0].some(([id])=>id===enemyHQ.id)).toBe(true);
  expect(runtime.queuedGather).toContain(worker.id);expect(runtime.abilities.some(([id])=>id===caster.id)).toBe(true);expect(state.entities.some(e=>e.side===side&&e.illusion)).toBe(true);
  const loaded=compareContinuation(state,500);
  expect(loaded.players).toHaveLength(count);expect(captureRuntime(loaded).aiTurns).toBeGreaterThan(runtime.aiTurns);
 },90000);

 it('preserves state and AI memory on the eighth player, including retired IDs and pending hits',()=>{
  const state=createMatch(config(8)),r=captureRuntime(state),worker=state.entities.find(e=>e.side===7&&e.role==='worker')!,enemy=state.entities.find(e=>e.side===0&&e.role==='hq')!;
  state.time=40;state.events=[{type:'attack',x:worker.x,y:worker.y,side:7,source:worker.id,target:enemy.id,amount:5}];
  const retired=state.nextId++;worker.order={type:'gather',target:state.resources[0].id};
  r.fog=.12;r.ai=.7;r.aiTurns=85;r.hits=[{source:worker.id,target:enemy.id,amount:5,event:0}];
  r.routes=[[retired,{key:'10,10,0.5',at:4}]];r.abilities=[[retired,100]];r.returning=[worker.id];r.queuedGather=[worker.id];
  r.aiWave[7]=32;r.initialScoutDispatched[7]=true;r.expansionScout[7]=worker.id;r.expansionScoutDispatched[7]=true;
  r.knownEnemyBuildings[7]=[[enemy.id,{x:enemy.x,y:enemy.y,role:'hq'}]];r.enemyStartCleared[7]=true;r.searched[7]=[120,121];r.clearedEnemyStarts[7]=[0,1];
  restoreRuntime(state,r);const loaded=loadGame(saveGame(state));expect(captureRuntime(loaded)).toEqual(r);expect(saveGame(loaded)).toEqual(saveGame(state));
  stepGame(state,.1);stepGame(loaded,.1);expect(saveGame(loaded)).toEqual(saveGame(state));
 });

 it('accepts a winner and event from side 7 when its team wins',()=>{
  const save=good();save.state.winner=7;save.state.winningTeam=save.state.teams[7];save.state.events=[{type:'message',x:1,y:1,side:7,text:'Team won'}];
  const loaded=loadGame(save);expect(loaded.winner).toBe(7);expect(loaded.events[0].side).toBe(7);expect(saveGame(loaded)).toEqual(save);
 });

 it.each(playerArrays.flatMap(key=>[-1,1].map(delta=>[key,delta] as const)))('rejects mismatched state.%s length (%i)',(key,delta)=>{
  const save:any=good();if(delta<0)save.state[key].pop();else save.state[key].push(structuredClone(save.state[key][0]));
  expect(()=>loadGame(save)).toThrow(/array length/);
 });
 it.each(runtimeArrays.flatMap(key=>[-1,1].map(delta=>[key,delta] as const)))('rejects mismatched runtime.%s length (%i)',(key,delta)=>{
  const save:any=good();if(delta<0)save.runtime[key].pop();else save.runtime[key].push(structuredClone(save.runtime[key][0]));
  expect(()=>loadGame(save)).toThrow(/array length/);
 });
 it.each(teamFields)('requires state.%s in version 2',key=>{
  const save:any=good();delete save.state[key];expect(()=>loadGame(save)).toThrow(/missing field/);
 });

 it.each(invalidCases([
  ['no players',(s:any)=>s.state.players=[]],['nine players',(s:any)=>s.state.players.push(structuredClone(s.state.players[0]))],
  ['entity side 8',(s:any)=>s.state.entities[0].side=8],['negative entity side',(s:any)=>s.state.entities[0].side=-1],
  ['event side 8',(s:any)=>s.state.events=[{type:'message',x:1,y:1,side:8}]],['winner side 8',(s:any)=>{s.state.winner=8;s.state.winningTeam=1;}],
  ['fractional team',(s:any)=>s.state.teams[7]=.5],['team 8',(s:any)=>s.state.teams[7]=8],['negative team',(s:any)=>s.state.teams[7]=-1],
  ['negative income',(s:any)=>s.state.incomeFactors[7]=-.1],['income above 10',(s:any)=>s.state.incomeFactors[7]=10.01],
  ['zero population limit',(s:any)=>s.state.populationLimits[7]=0],['population above 500',(s:any)=>s.state.populationLimits[7]=501],['fractional population limit',(s:any)=>s.state.populationLimits[7]=100.5],
  ['nonboolean shared vision',(s:any)=>s.state.sharedVision=1],['nonboolean eliminated player',(s:any)=>s.state.eliminated[7]=1],
  ['winner outside team',(s:any)=>{s.state.winner=7;s.state.winningTeam=0;}],['winner without team',(s:any)=>s.state.winner=7],['team without winner',(s:any)=>s.state.winningTeam=1],
  ['nonexistent winning team',(s:any)=>{s.state.winner=7;s.state.winningTeam=7;}],['draw winner',(s:any)=>{s.state.winner=7;s.state.winningTeam=1;s.state.draw=true;}],
  ['last player future wave',(s:any)=>s.runtime.aiWave[7]=s.state.time+1],['last player scout flag',(s:any)=>s.runtime.initialScoutDispatched[7]=1],
  ['last player missing scout',(s:any)=>s.runtime.expansionScout[7]=s.state.nextId],['last player duplicate search cell',(s:any)=>s.runtime.searched[7]=[1,1]],
  ['last player search cell outside map',(s:any)=>s.runtime.searched[7]=[s.state.width*s.state.height]],
  ['last player cleared nonexistent start',(s:any)=>s.runtime.clearedEnemyStarts[7]=[8]],['last player duplicate cleared start',(s:any)=>s.runtime.clearedEnemyStarts[7]=[1,1]],
  ['last player bad memory',(s:any)=>s.runtime.knownEnemyBuildings[7]=[[1,{x:1,y:1,role:'worker'}]]],
  ['last player duplicate fog',(s:any)=>s.state.explored[7].push(s.state.explored[7][0])],['last player unexplored visibility',(s:any)=>{s.state.explored[7]=[];s.state.visible[7]=[1];}],
  ['last player completed research',(s:any)=>{const hq=s.state.entities.find((e:any)=>e.side===7&&e.role==='hq');hq.research='worker-speed';s.state.players[7].upgrades=['worker-speed'];}],
  ['last player duplicate research',(s:any)=>{const hq=s.state.entities.find((e:any)=>e.side===7&&e.role==='hq');hq.research='worker-speed';const copy=structuredClone(hq);copy.id=s.state.nextId++;s.state.entities.push(copy);}],
  ['missing finite gather memory',(s:any)=>delete s.runtime.queuedGather],['future route',(s:any)=>s.runtime.routes=[[1,{key:'x',at:s.state.time+1}]]],
 ]))('rejects %s and leaves input unchanged',(_name,mutate)=>{
  const save=good();mutate(save);const before=structuredClone(save);expect(()=>loadGame(save)).toThrow(Error);expect(save).toEqual(before);
 });

 it('accepts income and population limits at their boundaries and teams independent of player indices',()=>{
  const save=good();save.state.teams=[7,7,7,7,2,2,2,2];save.state.incomeFactors[0]=0;save.state.incomeFactors[7]=10;save.state.populationLimits[0]=1;save.state.populationLimits[7]=500;
  save.state.sharedVision=false;save.state.players[7].cap=500;save.state.winner=7;save.state.winningTeam=2;expect(saveGame(loadGame(save))).toEqual(save);
 });

 it('round-trips eight full armies plus buildings above the old 4096-entity limit',()=>{
  const state=createMatch(config(8));
  for(let index=0;index<8;index++){
   const side=index as Side,unit=state.entities.find(e=>e.side===side&&e.role==='melee')!,building=state.entities.find(e=>e.side===side&&e.role==='hq')!;
   for(let i=0;i<494;i++)state.entities.push({...structuredClone(unit),id:state.nextId++});
   for(let i=0;i<50;i++)state.entities.push({...structuredClone(building),id:state.nextId++});
   state.populationLimits[side]=500;state.players[side].population=500;state.players[side].cap=500;
  }
  expect(state.entities.length).toBeGreaterThan(4096);const snapshot=saveGame(state);expect(saveGame(loadGame(snapshot))).toEqual(snapshot);
 },30000);

 it('supports full 256-cell map dimensions with dense fog and search memory for eight players',()=>{
  const save=good(),cells=256*256;save.state.width=256;save.state.height=256;save.state.terrain=Array(cells).fill('grass');
  const all=Array.from({length:cells},(_,i)=>i);save.state.explored=Array.from({length:8},()=>[...all]);save.state.visible=Array.from({length:8},()=>[...all]);save.runtime.searched=Array.from({length:8},()=>[...all]);
  const json=JSON.stringify(save);expect(new TextEncoder().encode(json).byteLength).toBeLessThan(MAX_SAVE_BYTES);
  const loaded=loadGame(json);expect(loaded.explored[7].size).toBe(cells);expect(loaded.visible[7].size).toBe(cells);expect(captureRuntime(loaded).searched[7]).toEqual(all);expect(saveGame(loaded)).toEqual(save);
 },30000);

 it('enforces the UTF-8 byte limit before parsing text',()=>{
  const input='"'+'😀'.repeat(MAX_SAVE_BYTES/4)+'"';expect(input.length).toBeLessThan(MAX_SAVE_BYTES);expect(()=>loadGame(input)).toThrow(/size limit/);
 });

 it('enforces the complete byte limit for numeric object payloads as well as JSON text',()=>{
  const save=good();save.state.width=256;save.state.height=256;save.state.terrain=Array(256*256).fill('grass');
  const unit=save.state.entities.find(e=>e.kind==='unit')!,path=Array.from({length:1000},()=>({x:255.1234567890123,y:255.1234567890123}));
  for(let i=0;i<400;i++)save.state.entities.push({...structuredClone(unit),id:save.state.nextId++,path});
  const text=JSON.stringify(save);expect(new TextEncoder().encode(text).byteLength).toBeGreaterThan(MAX_SAVE_BYTES);
  expect(()=>loadGame(save)).toThrow(/size limit/);expect(()=>loadGame(text)).toThrow(/size limit/);
 },30000);
});

describe('legacy version 1 migration',()=>{
 it('validates a real two-player snapshot before adding team defaults, without losing AI memory',()=>{
  const state=createGame('orcs',4127,'fairies',{controllers:['ai','ai'],mapSize:'small'});advance(state,160);
  const snapshot=legacy(state),before=structuredClone(snapshot),runtime={...structuredClone(snapshot.runtime),clearedEnemyStarts:snapshot.runtime.enemyStartCleared.map((value:boolean,side:number)=>value?[1-side]:[])},loaded=loadGame(snapshot);
  expect(snapshot).toEqual(before);expect(loaded.teams).toEqual([0,1]);expect(loaded.incomeFactors).toEqual([1,1]);expect(loaded.populationLimits).toEqual([100,100]);expect(loaded.sharedVision).toBe(true);expect(loaded.eliminated).toEqual([false,false]);expect(loaded.winningTeam).toBeNull();
  expect(captureRuntime(loaded)).toMatchObject(runtime);expect(saveGame(loaded).version).toBe(SAVE_VERSION);const migrated=captureRuntime(loaded),original=captureRuntime(state);original.aiBatchTurns=migrated.aiBatchTurns;for(const key of aiFields)(original[key] as unknown)=structuredClone(migrated[key]);restoreRuntime(state,original);delete state.economy;expect(saveGame(loaded)).toEqual(saveGame(state));
  for(let i=0;i<500;i++){stepGame(state,.125);stepGame(loaded,.125);expect(saveGame(loaded)).toEqual(saveGame(state));}
 },90000);

 it.each(['missing','unfinished','dead'] as const)('derives eliminated status from a %s HQ',kind=>{
  const state=createGame('orcs',4127,'fairies',{controllers:['external','external']}),snapshot=legacy(state),hq=snapshot.state.entities.find((e:any)=>e.side===1&&e.role==='hq');
  if(kind==='missing')snapshot.state.entities=snapshot.state.entities.filter((e:any)=>e.id!==hq.id);else if(kind==='unfinished')hq.progress=.9;else hq.hp=0;
  snapshot.state.winner=0;const loaded=loadGame(snapshot);expect(loaded.eliminated).toEqual([false,true]);expect(loaded.winner).toBe(0);expect(loaded.winningTeam).toBe(0);expect(saveGame(loaded).version).toBe(SAVE_VERSION);
 });

 it('preserves each cleared enemy base from the legacy two-player scouting flags',()=>{
  const snapshot=legacy(createGame('orcs',4127));snapshot.runtime.enemyStartCleared=[true,true];
  const loaded=loadGame(snapshot);expect(captureRuntime(loaded).enemyStartCleared).toEqual([true,true]);expect(captureRuntime(loaded).clearedEnemyStarts).toEqual([[1],[0]]);
 });

 it.each(teamFields)('rejects a supplied version 2 state.%s field in a legacy save',key=>{
  const state=createGame('orcs',4127),snapshot=legacy(state);snapshot.state[key]=saveGame(state).state[key];expect(()=>loadGame(snapshot)).toThrow(/unknown field/);
 });

 it('retains the old 4096-entity bound when validating legacy saves',()=>{
  const snapshot=legacy(createGame('orcs',4127)),unit=snapshot.state.entities.find((e:any)=>e.kind==='unit');
  while(snapshot.state.entities.length<=4096)snapshot.state.entities.push({...structuredClone(unit),id:snapshot.state.nextId++});
  expect(()=>loadGame(snapshot)).toThrow(/state.entities: invalid array length/);
 });

 it('preserves finite queued gathering, orders and ability state through migration',()=>{
  const state=createGame('fairies',4127,'orcs',{controllers:['external','external']}),worker=state.entities.find(e=>e.side===0&&e.role==='worker')!,node=state.resources.find(n=>n.kind==='wood')!;
  worker.x=node.x+1.1;worker.y=node.y;node.amount=1;refreshVisibility(state);
  expect(issueCommand(state,0,{type:'gather',ids:[worker.id],target:node.id,queued:true})).toBe(true);const caster=special(state,0);expect(issueCommand(state,0,{type:'ability',ids:[caster.id]})).toBe(true);
  const loaded=loadGame(legacy(state));delete state.economy;expect(captureRuntime(loaded).queuedGather).toContain(worker.id);expect(saveGame(loaded)).toEqual(saveGame(state));
  for(let i=0;i<200;i++){stepGame(state,.125);stepGame(loaded,.125);expect(saveGame(loaded)).toEqual(saveGame(state));}
 });

 it.each(invalidCases([
  ['new team field',(s:any)=>s.state.teams=[0,1]],['missing finite gather memory',(s:any)=>delete s.runtime.queuedGather],
  ['third player',(s:any)=>s.state.players.push(structuredClone(s.state.players[0]))],['third controller',(s:any)=>s.state.controllers.push('external')],
  ['third runtime row',(s:any)=>s.runtime.aiWave.push(0)],['side 2 entity',(s:any)=>s.state.entities[0].side=2],
  ['cap above 100',(s:any)=>s.state.players[0].cap=101],['missing ability memory',(s:any)=>delete s.runtime.abilities],
  ['future route',(s:any)=>s.runtime.routes=[[1,{key:'x',at:s.state.time+1}]]],
 ]))('rejects invalid legacy %s before migration',(_name,mutate)=>{
  const snapshot=legacy(createGame('orcs',4127));mutate(snapshot);const before=structuredClone(snapshot);expect(()=>loadGame(snapshot)).toThrow(Error);expect(snapshot).toEqual(before);
 });
});
