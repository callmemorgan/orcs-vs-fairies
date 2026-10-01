import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import { walkable } from '../src/core/navigation';
import { ENVIRONMENT_RULES, environmentPhase, environmentalMovementFactor, environmentalSightFactor, igniteWorldAt, issueEnvironmentCommand, projectileEnvironment, stepEnvironment } from '../src/core/environment';
import { loadGame, saveGame } from '../src/core/saves';
import { replayChecksum } from '../src/core/replays';
import { emptyObjectives } from '../src/core/objectives';
import type { Entity, GameState, TerrainKind } from '../src/core/types';
import type { WorldState } from '../src/core/world-types';

type TestState=GameState & {world:WorldState};
type LocatedEntity=Entity & {level?:number};
function scenario():TestState {
 const s=createGame('orcs',1977,'undead',{controllers:['human','human'],mapSize:'small'}) as TestState;
 s.width=16;s.height=16;s.terrain=Array(256).fill('grass');s.resources=[];
 s.entities=s.entities.filter(e=>e.role==='worker').slice(0,2);
 s.entities.forEach((e,i)=>{e.side=i as 0|1;e.x=2.5+i;e.y=4.5;e.hp=100;e.maxHp=100;e.order={type:'idle'};});
 s.starts=[{x:1.5,y:1.5},{x:14.5,y:14.5}];
 s.world={version:1,biome:'temperate',levels:[{id:0,title:'Surface',terrain:s.terrain,elevation:Array(256).fill(0)}],transitions:[],bridges:[],fires:[],sites:[],creatures:[],dayLength:240,seasonLength:300,weatherLength:70,nextEnvironmentAt:0,iceTiles:[],thawWarned:false};
 s.objectives=emptyObjectives(s);
 s.visible=s.players.map(()=>new Set(Array.from({length:256},(_,i)=>i)));s.explored=s.visible.map(v=>new Set(v));
 weather(s,'clear');return s;
}
function weather(s:TestState,w:ReturnType<typeof environmentPhase>['weather']):void {
 s.time=0;
 for(let seed=0;seed<10000;seed++){s.seed=seed;if(environmentPhase(s).weather===w)return;}
 throw new Error(`No seeded ${w} fixture`);
}
function terrain(s:TestState,x:number,y:number,kind:string,level=0):void {
 s.world.levels.find(l=>l.id===level)!.terrain[y*s.width+x]=kind as TerrainKind;
}
function tree(s:TestState,x:number,y:number,amount=60,level=0):void {
 terrain(s,Math.floor(x),Math.floor(y),'forest',level);
 s.resources.push({id:s.nextId++,x,y,kind:'wood',amount,maxAmount:amount,level} as GameState['resources'][number]);
}
function advance(s:TestState,seconds:number):void {
 for(let left=seconds;left>1e-8;){const dt=Math.min(.25,left);s.time+=dt;s.tick++;stepEnvironment(s,dt);left-=dt;}
}
function ignite(s:TestState,x=3.5,y=4.5):boolean|undefined {
 return issueEnvironmentCommand(s,0,{type:'ignite',ids:[s.entities[0].id],x,y});
}
function cave(s:TestState):void {
 s.world.levels.push({id:1,title:'Cavern',terrain:Array(256).fill('grass'),elevation:Array(256).fill(0)});
 for(const visible of s.visible)for(let tile=256;tile<512;tile++)visible.add(tile);
}

describe('day, weather and projectile rules',()=>{
 it('preserves ordinary matches without a world',()=>{
  const s=createGame('orcs');
  expect(environmentalSightFactor(s)).toBe(1);expect(environmentalMovementFactor(s)).toBe(1);
  expect(projectileEnvironment(s,{x:1,y:1},{x:4,y:2})).toEqual({damageFactor:1,rangeFactor:1,drift:{x:0,y:0}});
  expect(issueEnvironmentCommand(s,0,{type:'hold'})).toBeUndefined();
  expect(issueEnvironmentCommand(s,0,{type:'ignite',ids:[s.entities[1].id],x:3,y:3})).toBe(false);
 });
 it('changes night visibility and gives undead units a distinct night role',()=>{
  const s=scenario();s.world.weatherLength=10000;s.time=180;
  expect(environmentPhase(s).day).toBe('night');
  expect(environmentalSightFactor(s,s.entities[0])).toBe(.6);
  expect(environmentalSightFactor(s,s.entities[1])).toBe(1);
  const tower={...s.entities[1],kind:'building',role:'tower'} as Entity;
  expect(environmentalSightFactor(s,tower)).toBe(.6);
  s.players[0].faction='tideborn';s.entities[0].role='special';
  expect(environmentalSightFactor(s,s.entities[0])).toBe(.9);
  s.time=144;expect(environmentPhase(s).day).toBe('dusk');
  s.time=228;expect(environmentPhase(s).day).toBe('dawn');
 });
 it('rain slows armies, reduces sight and projectiles, and spares cavern armies',()=>{
  const s=scenario();weather(s,'rain');
  expect(environmentalMovementFactor(s,s.entities[0])).toBe(.85);
  s.players[1].faction='tideborn';expect(environmentalMovementFactor(s,s.entities[1])).toBe(.95);
  expect(environmentalSightFactor(s)).toBe(.9);
  expect(projectileEnvironment(s,{x:1,y:1},{x:5,y:5})).toEqual({damageFactor:.9,rangeFactor:.9,drift:{x:0,y:0}});
  (s.entities[0] as LocatedEntity).level=1;
  expect(environmentalMovementFactor(s,s.entities[0])).toBe(1);expect(environmentalSightFactor(s,s.entities[0])).toBe(1);
  expect(projectileEnvironment(s,{x:1,y:1,level:1},{x:5,y:5,level:1}).damageFactor).toBe(1);
 });
 it('fog limits sight and wind favors downwind shots and deflects crosswind shots',()=>{
  const s=scenario();weather(s,'fog');expect(environmentalSightFactor(s)).toBe(.65);
  weather(s,'wind');const wind=environmentPhase(s).wind,from={x:5,y:5};
  const down=projectileEnvironment(s,from,{x:5+wind.x*8,y:5+wind.y*8}),up=projectileEnvironment(s,from,{x:5-wind.x*8,y:5-wind.y*8});
  expect(down.rangeFactor).toBeCloseTo(1.12);expect(up.rangeFactor).toBeCloseTo(.88);
  const cross=projectileEnvironment(s,from,{x:5-wind.y*8,y:5+wind.x*8});
  expect(cross.damageFactor).toBeCloseTo(.88);expect(Math.hypot(cross.drift.x,cross.drift.y)).toBeCloseTo(.36);
 });
 it('weather reads are deterministic and do not mutate match state',()=>{
  const s=scenario(),before=structuredClone(s);const phases=[];
  for(let t=0;t<1000;t+=13){const at={...s,time:t};phases.push(environmentPhase(at));expect(environmentPhase(at)).toEqual(phases.at(-1));projectileEnvironment(at,{x:2,y:3},{x:8,y:5});}
  expect(s).toEqual(before);expect(new Set(phases.map(p=>p.weather)).size).toBe(4);
  expect(new Set(phases.map(p=>p.season)).size).toBe(4);
 });
});

describe('forest ignition, destruction and firebreaks',()=>{
 it('ignites through a nearby owned worker, consumes paid stock and opens a timber-blocked tile',()=>{
  const s=scenario();tree(s,3.5,4.5,30);const stock={wood:s.players[0].wood,ore:s.players[0].ore};
  expect(walkable(s,3.5,4.5)).toBe(false);
  expect(ignite(s)).toBe(true);expect(s.players[0].wood).toBe(stock.wood-15);expect(s.players[0].ore).toBe(stock.ore-5);
  advance(s,3);expect(s.resources[0].amount).toBe(0);expect(s.terrain[4*16+3]).toBe('grass');
  expect(walkable(s,3.5,4.5)).toBe(true);
  expect(s.entities[1].hp).toBeLessThan(100);expect(s.events.some(e=>e.text==='Forest fire damage')).toBe(true);
 });
 it('rejects unseen, distant, foreign, exhausted and unaffordable actions without charging stock',()=>{
  const s=scenario();tree(s,3.5,4.5);const before=s.players[0].wood;
  s.visible[0].delete(4*16+3);expect(ignite(s)).toBe(false);s.visible[0].add(4*16+3);
  s.entities[0].x=12;expect(ignite(s)).toBe(false);s.entities[0].x=2.5;
  expect(issueEnvironmentCommand(s,0,{type:'ignite',ids:[s.entities[1].id],x:3.5,y:4.5})).toBe(false);
  s.entities[0].cooldown=1;expect(ignite(s)).toBe(false);s.entities[0].cooldown=0;
  s.players[0].ore=4;expect(ignite(s)).toBe(false);expect(s.players[0].wood).toBe(before);
  expect(issueEnvironmentCommand(s,0,{type:'ignite',ids:[s.entities[0].id],x:NaN,y:4.5})).toBe(false);
 });
 it('lets siege ignite within its real weapon range while melee cannot start fires',()=>{
  const s=scenario();tree(s,6.5,4.5);s.entities[0].role='melee';expect(ignite(s,6.5)).toBe(false);
  s.entities[0].role='siege';expect(ignite(s,6.5)).toBe(true);
 });
 it('does not extend command reach by clicking the near edge of a forest tile',()=>{
  const s=scenario();tree(s,4.5,4.5);
  expect(ignite(s,4.29)).toBe(false);expect(s.world.fires).toEqual([]);
  s.entities[0].x=2.75;expect(ignite(s,4.99)).toBe(true);
 });
 it('damages a building when fire reaches its footprint even though its center is farther away',()=>{
  const s=scenario();terrain(s,3,4,'forest');
  const hq={...s.entities[1],id:s.nextId++,x:5.5,y:4.5,kind:'building' as const,role:'hq' as const,hp:100,maxHp:100};s.entities.push(hq);
  expect(ignite(s)).toBe(true);advance(s,3);
  expect(hq.hp).toBeLessThan(100);expect(s.events.some(e=>e.target===hq.id&&e.text==='Forest fire damage')).toBe(true);
 });
 it('checks same-level distance and level-encoded vision',()=>{
  const s=scenario();cave(s);tree(s,3.5,4.5,60,1);
  const c={type:'ignite' as const,ids:[s.entities[0].id],x:3.5,y:4.5,level:1};
  expect(issueEnvironmentCommand(s,0,c)).toBe(false);(s.entities[0] as LocatedEntity).level=1;
  s.visible[0].delete(256+4*16+3);expect(issueEnvironmentCommand(s,0,c)).toBe(false);
  s.visible[0].add(256+4*16+3);expect(issueEnvironmentCommand(s,0,c)).toBe(true);
 });
 it('spreads from real fuel deterministically, never across a cleared firebreak',()=>{
  const s=scenario();for(let x=3;x<8;x++)tree(s,x+.5,4.5,500);
  s.entities[0].x=4.5;expect(issueEnvironmentCommand(s,0,{type:'firebreak',ids:[s.entities[0].id],x:5.5,y:4.5})).toBe(true);
  s.entities[0].x=2.5;s.entities[0].cooldown=0;expect(ignite(s)).toBe(true);
  const twin=structuredClone(s);advance(s,18);advance(twin,18);
  expect(s.world.fires).toEqual(twin.world.fires);expect(s.resources).toEqual(twin.resources);
  expect(s.world.fires.some(f=>f.x===4.5)).toBe(true);expect(s.world.fires.some(f=>f.x>=5.5)).toBe(false);
  expect(s.resources.find(r=>r.x===5.5)!.amount).toBe(0);expect(s.terrain[4*16+5]).toBe('grass');
 });
 it('rain extinguishes fires, prevents spread and burns less wood',()=>{
  const dry=scenario(),wet=scenario();weather(wet,'rain');
  for(const s of [dry,wet]){tree(s,3.5,4.5,500);tree(s,4.5,4.5,500);expect(ignite(s)).toBe(true);advance(s,5);}
  expect(wet.world.fires).toHaveLength(0);expect(wet.resources[0].amount).toBeGreaterThan(dry.resources[0].amount);
  expect(wet.resources[1].amount).toBe(500);
 });
 it('firebreak extinguishes a burning tile and destroys wood rather than awarding it',()=>{
  const s=scenario();tree(s,3.5,4.5);expect(ignite(s)).toBe(true);s.entities[0].cooldown=0;
  const stock=s.players[0].wood;expect(issueEnvironmentCommand(s,0,{type:'firebreak',ids:[s.entities[0].id],x:3.5,y:4.5})).toBe(true);
  expect(s.world.fires).toHaveLength(0);expect(s.resources[0].amount).toBe(0);expect(s.players[0].wood).toBe(stock-5);
  expect(issueEnvironmentCommand(s,0,{type:'firebreak',ids:[s.entities[0].id],x:3.5,y:4.5})).toBe(false);
 });
 it('burns forest vegetation without a harvest node and records deaths for lethal exposure',()=>{
  const s=scenario();terrain(s,3,4,'forest');s.entities[1].hp=2;expect(ignite(s)).toBe(true);advance(s,6);
  expect(s.terrain[4*16+3]).toBe('grass');expect(s.entities[1].hp).toBe(0);
  expect(s.corpses.some(c=>c.id===s.entities[1].id)).toBe(true);expect(s.events.some(e=>e.type==='death')).toBe(true);
 });
});

describe('seasonal lake crossings',()=>{
 function winter(s:TestState):void {s.world.seasonLength=100;s.time=300;stepEnvironment(s,.25);}
 it('freezes surface water only, preserves bridges and leaves desert and underground water alone',()=>{
  const s=scenario();cave(s);terrain(s,4,4,'water');terrain(s,5,4,'bridge');terrain(s,4,4,'water',1);expect(walkable(s,4.5,4.5)).toBe(false);winter(s);
  expect(s.terrain[4*16+4]).toBe('ice');expect(s.terrain[4*16+5]).toBe('bridge');
  expect(walkable(s,4.5,4.5)).toBe(true);
  expect(s.world.levels[1].terrain[4*16+4]).toBe('water');expect(s.world.iceTiles).toEqual([{level:0,tile:4*16+4}]);
  const desert=scenario();desert.world.biome='desert';terrain(desert,4,4,'water');winter(desert);expect(desert.terrain[4*16+4]).toBe('water');
 });
 it('warns every side once before thaw at an affected troop, then restores water',()=>{
  const s=scenario();terrain(s,3,4,'water');winter(s);s.entities[0].x=3.5;s.events=[];
  s.time=390;stepEnvironment(s,.25);
  const warnings=s.events.filter(e=>e.text?.startsWith('Lake ice thaws'));
  expect(warnings).toHaveLength(2);expect(warnings.find(e=>e.side===0)?.x).toBe(3.5);expect(s.world.thawWarned).toBe(true);
  stepEnvironment(s,.25);expect(s.events.filter(e=>e.text?.startsWith('Lake ice thaws'))).toHaveLength(2);
  s.time=400;stepEnvironment(s,.25);expect(s.terrain[4*16+3]).toBe('water');expect(s.world.iceTiles).toHaveLength(0);expect(s.world.thawWarned).toBe(false);
 });
 it('evacuates nearby troops to a legal bank with injury but never kills an injured survivor',()=>{
  const s=scenario();terrain(s,3,4,'water');winter(s);const e=s.entities[0];e.x=3.5;e.hp=8;e.path=[{x:7,y:7}];e.order={type:'move',x:7,y:7};
  s.time=400;stepEnvironment(s,.25);
  expect(e.hp).toBe(1);expect(s.terrain[Math.floor(e.y)*16+Math.floor(e.x)]).toBe('grass');
  expect(e.path).toEqual([]);expect(e.order.type).toBe('idle');expect(s.events.some(e=>e.text?.includes('evacuated to bank'))).toBe(true);
 });
 it('evacuates a troop straddling the bank edge so its collision radius does not become stranded',()=>{
  const s=scenario();terrain(s,4,4,'water');winter(s);const e=s.entities[0];e.x=3.9;e.y=4.5;
  expect(walkable(s,e.x,e.y)).toBe(true);s.time=400;stepEnvironment(s,.25);
  expect(walkable(s,e.x,e.y)).toBe(true);expect(e.x).toBe(3.5);expect(e.hp).toBe(75);
 });
 it('drowns a troop trapped farther than six tiles from any bank and explains the consequence',()=>{
  const s=scenario();s.terrain.fill('water');winter(s);const e=s.entities[0];e.x=8.5;e.y=8.5;
  s.time=400;stepEnvironment(s,.25);
  expect(e.hp).toBe(0);expect(s.corpses.some(c=>c.id===e.id)).toBe(true);
  expect(s.events.some(e=>e.type==='death'&&e.text?.includes('no bank within 6 tiles'))).toBe(true);
 });
 it('finds a narrow legal bank between walls when every bank tile center is blocked',()=>{
  const s=scenario();s.terrain.fill('water');for(let x=5;x<=8;x++)terrain(s,x,4,'grass');
  for(const x of [6,8])s.entities.push({...s.entities[1],id:s.nextId++,x,y:4.5,kind:'building',role:'wall'});
  const e=s.entities[0];e.x=7;e.y=7.5;winter(s);
  expect(walkable(s,7,4.5)).toBe(true);s.time=400;stepEnvironment(s,.25);
  expect(e.hp).toBe(75);expect(walkable(s,e.x,e.y)).toBe(true);expect(e.y).toBeLessThan(5);
  expect(s.events.some(event=>event.source===e.id&&event.text?.includes('evacuated to bank'))).toBe(true);
 });
 it('does not revert an ice tile replaced by a repaired bridge before thaw',()=>{
  const s=scenario();terrain(s,3,4,'water');winter(s);terrain(s,3,4,'bridge');s.time=400;stepEnvironment(s,.25);
  expect(s.terrain[4*16+3]).toBe('bridge');expect(s.world.iceTiles).toEqual([]);
 });
 it('saves a crossing destroyed, rebuilt and destroyed again during the same winter',()=>{
  const s=createGame('orcs',1977,'undead',{controllers:['human','human'],mapSize:'small'}) as TestState;
  s.width=16;s.height=16;s.terrain=Array(256).fill('grass');s.resources=[];delete s.economy;s.starts=[{x:1.5,y:1.5},{x:14.5,y:14.5}];
  const actor=s.entities.find(e=>e.side===0&&e.role==='melee')!,other=s.entities.find(e=>e.side===1&&e.role==='worker')!;
  s.entities=s.entities.filter(e=>e.role==='hq'||e===actor||e===other);
  for(const e of s.entities){e.x=e.side===0?1.5:14.5;e.y=e.side===0?1.5:14.5;e.path=[];e.order={type:'idle'};}
  actor.x=2.5;actor.y=4.5;actor.role='siege';other.x=6.5;other.y=4.5;
  const tiles=[67,68,69];for(const tile of tiles)s.terrain[tile]='bridge';
  const bridge={id:s.nextId++,x:4.5,y:4.5,level:0,hp:1,maxHp:160,tiles,rebuilding:0,repairSide:null};
  s.world={version:1,biome:'temperate',levels:[{id:0,title:'Surface',terrain:s.terrain,elevation:Array(256).fill(0)}],transitions:[],bridges:[bridge],fires:[],sites:[],creatures:[],dayLength:240,seasonLength:100,weatherLength:10000,nextEnvironmentAt:0,iceTiles:[],thawWarned:false};
  s.objectives=emptyObjectives(s);
  s.visible=s.players.map(()=>new Set(Array.from({length:256},(_,i)=>i)));s.explored=s.visible.map(v=>new Set(v));s.players.forEach(p=>{p.wood=10000;p.ore=10000;});s.time=300;
  expect(issueCommand(s,0,{type:'worldAttack',ids:[actor.id],target:bridge.id})).toBe(true);stepGame(s,.25);
  expect(bridge.hp).toBe(1);expect(s.projectiles).toHaveLength(1);expect(s.projectiles![0].impactAt).toBeGreaterThan(s.time);
  for(let i=0;i<12&&bridge.hp>0;i++)stepGame(s,.25);stepGame(s,.25);
  expect(bridge.hp).toBe(0);expect(s.world.iceTiles).toEqual(tiles.map(tile=>({level:0,tile})));
  actor.role='worker';expect(issueCommand(s,0,{type:'repairBridge',ids:[actor.id],target:bridge.id})).toBe(true);
  for(let i=0;i<100&&bridge.hp===0;i++)stepGame(s,.25);
  expect(bridge.hp).toBe(bridge.maxHp);expect(tiles.every(tile=>s.terrain[tile]==='bridge')).toBe(true);
  actor.role='siege';actor.cooldown=0;expect(issueCommand(s,0,{type:'worldAttack',ids:[actor.id],target:bridge.id})).toBe(true);
  for(let i=0;i<100&&bridge.hp>0;i++)stepGame(s,.25);stepGame(s,.25);
  expect(bridge.hp).toBe(0);expect(tiles.every(tile=>s.terrain[tile]==='ice')).toBe(true);
  expect(s.world.iceTiles).toEqual(tiles.map(tile=>({level:0,tile})));
  const restored=loadGame(saveGame(s));expect(replayChecksum(restored)).toBe(replayChecksum(s));
  for(let i=0;i<20;i++){stepGame(s,.05);stepGame(restored,.05);expect(replayChecksum(restored)).toBe(replayChecksum(s));}
 });
 it('continues an active fire and frozen crossing identically after a serialized world checkpoint',()=>{
  const s=scenario();s.world.weatherLength=10000;s.time=930;tree(s,3.5,4.5,500);expect(ignite(s)).toBe(true);terrain(s,6,4,'water');stepEnvironment(s,.25);
  expect(s.world.fires).toHaveLength(1);expect(s.world.iceTiles).toHaveLength(1);
  const twin=structuredClone(s);twin.world=JSON.parse(JSON.stringify(s.world));twin.world.levels[0].terrain=twin.terrain;
  advance(s,8);advance(twin,8);
  expect(twin.world).toEqual(s.world);expect(twin.resources).toEqual(s.resources);expect(twin.entities).toEqual(s.entities);
  expect(s.world.nextEnvironmentAt).toBeGreaterThan(s.time);
 });
});

describe('artillery ignition and simulation interruption hooks',()=>{
 it('ignites a flammable impact once without charging ammunition or requiring fog visibility',()=>{
  const s=scenario();tree(s,8.5,8.5);s.visible[0].clear();const before={wood:s.players[0].wood,ore:s.players[0].ore};
  expect(igniteWorldAt(s,{x:8.8,y:8.1},{side:0,id:s.entities[0].id})).toBe(true);
  expect(s.world.fires).toEqual([{x:8.5,y:8.5,level:0,heat:1,expires:45,nextSpread:2.5}]);
  expect(s.events.at(-1)).toMatchObject({type:'ability',side:0,source:s.entities[0].id,x:8.5,y:8.5,level:0,text:'Incendiary shell ignited timber.'});
  expect(igniteWorldAt(s,{x:8.2,y:8.7},{side:0,id:s.entities[0].id})).toBe(false);
  expect({wood:s.players[0].wood,ore:s.players[0].ore}).toEqual(before);
 });
 it('rejects malformed bounds, absent levels, nonfuel impacts and invalid provenance without events',()=>{
  const s=scenario();tree(s,8.5,8.5);
  for(const p of [{x:-.1,y:8.5},{x:16,y:8.5},{x:8.5,y:16},{x:NaN,y:8.5},{x:8.5,y:8.5,level:1},{x:8.5,y:8.5,level:.5},{x:9.5,y:9.5}])expect(igniteWorldAt(s,p,{side:0})).toBe(false);
  for(const id of [0,-1,.5,s.nextId,Infinity,NaN])expect(igniteWorldAt(s,{x:8.5,y:8.5},{side:0,id})).toBe(false);
  expect(igniteWorldAt(s,{x:8.5,y:8.5},{side:7})).toBe(false);
  expect(s.world.fires).toEqual([]);expect(s.events).toEqual([]);
 });
 it('accepts recorded launch provenance independently of current source ownership',()=>{
  const s=scenario();tree(s,8.5,8.5);const source=s.entities[0],launch={side:source.side,id:source.id};source.side=1;
  // This unit fixture supplies historical provenance directly; public ownership transfers have integration coverage.
  const before=s.players.map(p=>({wood:p.wood,ore:p.ore}));
  expect(igniteWorldAt(s,{x:8.5,y:8.5},launch)).toBe(true);
  expect(s.events.at(-1)).toMatchObject({type:'ability',side:0,source:source.id,text:'Incendiary shell ignited timber.'});
  expect(s.players.map(p=>({wood:p.wood,ore:p.ore}))).toEqual(before);
 });
 it('retains an allocated dead or removed launch source, with same-level impacts on both maps',()=>{
  const s=scenario();cave(s);tree(s,8.5,8.5,60,0);tree(s,8.5,8.5,60,1);const source=s.entities[0];source.hp=0;
  expect(igniteWorldAt(s,{x:8.5,y:8.5},{side:0,id:source.id})).toBe(true);
  s.entities=s.entities.filter(e=>e!==source);
  expect(igniteWorldAt(s,{x:8.5,y:8.5,level:1},{side:0,id:source.id})).toBe(true);
  expect(s.world.fires.map(f=>f.level)).toEqual([0,1]);expect(s.events.map(e=>e.source)).toEqual([source.id,source.id]);
 });
 it('preserves a removed launch source and its fire through the strict save loader',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['human','human'],mapSize:'small',biome:'forest'}),source=s.entities.find(e=>e.side===0&&e.kind==='unit')!,fuel=s.resources.find(r=>r.kind==='wood'&&(r.level??0)===0)!;
  s.entities=s.entities.filter(e=>e!==source);
  expect(igniteWorldAt(s,fuel,{side:0,id:source.id})).toBe(true);
  const restored=loadGame(saveGame(s));expect(restored.world!.fires).toEqual(s.world!.fires);expect(restored.events.at(-1)?.source).toBe(source.id);
  expect(replayChecksum(restored)).toBe(replayChecksum(s));
 });
 it('notifies the simulation after lethal fire clears an interrupted order',()=>{
  const s=scenario(),victim=s.entities[1];tree(s,3.5,4.5);expect(ignite(s)).toBe(true);victim.hp=1;victim.order={type:'gather',target:s.resources[0].id};victim.orderQueue=[{type:'move',x:8,y:8}];victim.path=[{x:8,y:8}];
  const seen:number[]=[];s.time=.25;stepEnvironment(s,.25,{interrupt:e=>{expect(e.order).toEqual({type:'idle'});expect(e.orderQueue).toBeUndefined();expect(e.path).toEqual([]);seen.push(e.id);}});
  expect(victim.hp).toBe(0);expect(seen).toEqual([victim.id]);
 });
 it('notifies the simulation after thaw evacuation and drowning clear interrupted orders',()=>{
  for(const trapped of [false,true]){
   const s=scenario();if(trapped)s.terrain.fill('water');else terrain(s,3,4,'water');s.world.seasonLength=100;s.time=300;stepEnvironment(s,.25);
   const e=s.entities[0];e.x=trapped?8.5:3.5;e.y=trapped?8.5:4.5;e.order={type:'gather',target:99};e.orderQueue=[{type:'move',x:8,y:8}];e.path=[{x:8,y:8}];
   const seen:number[]=[];s.time=400;stepEnvironment(s,.25,{interrupt:actor=>{expect(actor.order).toEqual({type:'idle'});expect(actor.orderQueue).toBeUndefined();expect(actor.path).toEqual([]);seen.push(actor.id);}});
   expect(seen).toContain(e.id);expect(seen.filter(id=>id===e.id)).toHaveLength(1);expect(e.hp).toBe(trapped?0:75);
  }
 });
});
