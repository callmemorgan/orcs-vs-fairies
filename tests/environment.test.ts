import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/simulation';
import { walkable } from '../src/core/navigation';
import { ENVIRONMENT_RULES, environmentPhase, environmentalMovementFactor, environmentalSightFactor, issueEnvironmentCommand, projectileEnvironment, stepEnvironment } from '../src/core/environment';
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
 it('does not revert an ice tile replaced by a repaired bridge before thaw',()=>{
  const s=scenario();terrain(s,3,4,'water');winter(s);terrain(s,3,4,'bridge');s.time=400;stepEnvironment(s,.25);
  expect(s.terrain[4*16+3]).toBe('bridge');expect(s.world.iceTiles).toEqual([]);
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
