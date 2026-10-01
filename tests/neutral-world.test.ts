import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { route, segmentWalkable, walkable } from '../src/core/navigation';
import { createGame } from '../src/core/simulation';
import { fogKey, initializeWorld, sameLevel, terrainLineOfSight } from '../src/core/world-map';
import { initializeWorldSites, issueNeutralWorldCommand, NEUTRAL_RULES, observeNeutralWorld, processNeutralOrder, relicBonus, stepNeutralWorld } from '../src/core/neutral-world';
import type { NeutralWorldHooks } from '../src/core/neutral-world';
import type { Cost, Entity, GameState, Side, UnitRole } from '../src/core/types';
import type { NeutralCreature, WorldMapData, WorldPoint, WorldSite } from '../src/core/world-types';

const kinds=['wood','ore','crystal'] as const;
function fixture(kind:WorldSite['kind'],level=0) {
 const s=createGame('orcs',4127,'orcs',{controllers:['external','external']});s.resources=[];s.terrain.fill('grass');
 const data:WorldMapData={width:s.width,height:s.height,size:s.mapSize,seed:s.seed,
  levels:[0,1].map(id=>({id,title:`Level ${id}`,terrain:[...s.terrain],elevation:s.terrain.map(()=>0)})),
  starts:s.starts.map((p,slot)=>({...p,level:0,slot})),resources:[],sites:[{id:1,kind,x:22.5,y:20.5,level}],transitions:[]};
 initializeWorld(s,data);initializeWorldSites(s);
 const site=s.world!.sites[0],unit=s.entities.find(e=>e.side===0&&e.role==='melee')!;
 unit.x=site.x-3;unit.y=site.y;unit.level=level;
 reveal(s);return {s,site,unit};
}
function reveal(s:GameState) {
 for(let side=0;side<s.players.length;side++)for(let level=0;level<(s.world?.levels.length??1);level++)for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){
  const key=fogKey(s,{x:x+.5,y:y+.5,level});s.visible[side].add(key);s.explored[side].add(key);
 }
}
function addUnit(s:GameState,side:Side,x:number,y:number,level=0):Entity {
 const template=s.entities.find(e=>e.kind==='unit'&&e.role==='melee')!,def=FACTIONS[s.players[side].faction].units.melee;
 const e:Entity={...structuredClone(template),id:s.nextId++,side,x,y,level,hp:def.hp,maxHp:def.hp,cooldown:0,path:[],order:{type:'idle'}};
 s.entities.push(e);return e;
}
function harness(s:GameState) {
 const hits:{source:number;target:number;amount:number}[]=[],equipment:Cost[]=[];
 const hooks:NeutralWorldHooks={
  move(actor,to,dt,reach){
   if(!sameLevel(actor,to))return false;
   const d=Math.hypot(actor.x-to.x,actor.y-to.y);if(d<=reach)return true;
   const side='side' in actor?actor.side:undefined,speed='side' in actor?FACTIONS[s.players[actor.side].faction].units[actor.role as UnitRole].speed:1.8;
   if(!actor.path.length)actor.path=route(s,actor,to,reach,side);
   const next=actor.path[0];if(!next)return false;
   const length=Math.hypot(next.x-actor.x,next.y-actor.y),amount=Math.min(length,speed*dt);
   const p={x:actor.x+(next.x-actor.x)/Math.max(length,1e-9)*amount,y:actor.y+(next.y-actor.y)/Math.max(length,1e-9)*amount,level:actor.level};
   if(!segmentWalkable(s,actor,p)){actor.path=[];return false;}actor.x=p.x;actor.y=p.y;
   if(length<=amount+.02)actor.path.shift();return Math.hypot(actor.x-to.x,actor.y-to.y)<=reach;
  },
  spawn(side,role,x,y,level){
   if(!walkable(s,x,y,level))return undefined;
   const recruit=addUnit(s,side,x,y,level);recruit.role=role;
   equipment.push({...FACTIONS[s.players[side].faction].units[role].cost});return recruit;
  },
  hit(source,target,amount){
   const armor='side' in target?FACTIONS[s.players[target.side].faction].units[target.role as UnitRole]?.armor??3:0;
   const damage=Math.max(1,amount-armor),shield='shield' in target?Math.min(target.shield??0,damage):0;
   if('shield' in target)target.shield=Math.max(0,(target.shield??0)-shield);
   const actual=Math.min(target.hp,damage-shield)+shield;target.hp=Math.max(0,target.hp-(damage-shield));
   hits.push({source:source.id,target:target.id,amount:actual});
   if('side' in target&&target.hp===0){target.animation='death';target.order={type:'idle'};target.path=[];}
  },
  lineOfSight:(from,to)=>terrainLineOfSight(s,from,to),
 };
 function advance(ticks:number,dt=.05){for(let i=0;i<ticks;i++){
  s.tick++;s.time+=dt;s.events=[];
  for(const entity of [...s.entities]){entity.cooldown=Math.max(0,entity.cooldown-dt);if(entity.hp>0)processNeutralOrder(s,entity,dt,hooks);}
  stepNeutralWorld(s,dt,hooks);
 }}
 return {advance,hooks,hits,equipment};
}
function stockTotal(s:GameState,equipment:Cost[]=[]) {
 return Object.fromEntries(kinds.map(kind=>[kind,s.players.reduce((sum,p)=>sum+p[kind],0)+s.world!.sites.reduce((sum,site)=>sum+site.reward[kind],0)+equipment.reduce((sum,cost)=>sum+cost[kind],0)]));
}
function clearDefenders(s:GameState){for(const c of s.world!.creatures){c.hp=0;c.respawnAt=s.time+1000;}}
function settle(s:GameState,side:Side,unit:Entity,site:WorldSite) {
 const h=harness(s);unit.x=site.x-1.8;unit.y=site.y;
 expect(issueNeutralWorldCommand(s,side,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(true);h.advance(1);return h;
}

describe('neutral world encounters',()=>{
 it('allocates ordinary global IDs without another player and initializes only once',()=>{
  const {s,site}=fixture('monster'),ids=[site.id,...s.world!.creatures.map(c=>c.id)],next=s.nextId;
  expect(s.players).toHaveLength(2);expect(site.creatureIds).toHaveLength(2);expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every(id=>id<next)).toBe(true);initializeWorldSites(s);expect(s.nextId).toBe(next);expect(s.world!.creatures).toHaveLength(2);
 });
 it('moves a real squad into combat, deals HP damage, and transfers a finite den reward once',()=>{
  const {s,site,unit}=fixture('monster'),second=addUnit(s,0,unit.x,unit.y+1),third=addUnit(s,0,unit.x,unit.y-1),h=harness(s),total=stockTotal(s);
  const reserve={...site.reward},bank=s.players[0].wood;
  expect(issueNeutralWorldCommand(s,0,{type:'worldAttack',ids:[unit.id,second.id,third.id],target:site.id})).toBe(true);
  for(let ticks=0;ticks<1200&&!site.rewarded.length;ticks++)h.advance(1);
  expect(h.hits.some(hit=>site.creatureIds.includes(hit.target))).toBe(true);
  expect(h.hits.some(hit=>site.creatureIds.includes(hit.source))).toBe(true);
  expect(s.world!.creatures.every(creature=>creature.hp===0)).toBe(true);expect(site.rewarded).toEqual([0]);
  expect(s.players[0].wood).toBe(bank+reserve.wood);expect(site.reward).toEqual({wood:0,ore:0,crystal:0});expect(stockTotal(s)).toEqual(total);
  const firstPayout=s.players[0].wood;h.advance(Math.ceil(NEUTRAL_RULES.monsterRespawnSeconds/.05)+2);
  expect(s.world!.creatures.every(creature=>creature.hp>0)).toBe(true);
  for(const e of [unit,second,third]){e.hp=e.maxHp;e.x=site.x-2;e.y=site.y;}
  expect(issueNeutralWorldCommand(s,0,{type:'worldAttack',ids:[unit.id,second.id,third.id],target:site.id})).toBe(true);
  for(let ticks=0;ticks<1200&&s.world!.creatures.some(c=>c.hp>0);ticks++)h.advance(1);
  expect(s.world!.creatures.every(creature=>creature.hp===0)).toBe(true);expect(s.players[0].wood).toBe(firstPayout);expect(site.rewarded).toEqual([0]);
 });
 it('only pursues visible local targets on its level, and loses targets outside its leash',()=>{
  const {s,site,unit}=fixture('monster',1),h=harness(s);unit.level=0;unit.x=site.x;unit.y=site.y;
  h.advance(30);expect(s.world!.creatures.every(c=>c.target===null)).toBe(true);
  unit.level=1;unit.x=site.x+12;h.advance(30);expect(s.world!.creatures.every(c=>c.target===null)).toBe(true);
  unit.x=site.x-2;unit.y=site.y+.8;
  // A local target behind a solid ridge remains unseen by both creatures.
  for(const creature of s.world!.creatures){creature.x=site.x+1;creature.y=site.y;creature.path=[];}
  for(let y=15;y<26;y++)s.world!.levels[1].terrain[y*s.width+21]='rock';
  h.advance(5);expect(h.hits).toHaveLength(0);
  s.world!.levels[1].terrain.fill('grass');h.advance(50);expect(h.hits.some(hit=>hit.target===unit.id)).toBe(true);
  unit.x=site.x+12;h.advance(5);expect(s.world!.creatures.every(c=>c.target===null)).toBe(true);
 });
 it('rejects hostile ownership, hidden targets, wrong levels and duplicate selections without mutation',()=>{
  const {s,site,unit}=fixture('village'),foreign=s.entities.find(e=>e.side===1&&e.kind==='unit')!;
  const before=JSON.stringify(s.world),order=JSON.stringify(unit.order);
  expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id,foreign.id],target:site.id})).toBe(false);
  expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id,unit.id],target:site.id})).toBe(false);
  unit.level=1;expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(false);unit.level=0;
  s.visible[0].clear();expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(false);
  expect(JSON.stringify(s.world)).toBe(before);expect(JSON.stringify(unit.order)).toBe(order);
 });
});

describe('village services and raids',()=>{
 it('pays a local request once for a selected squad, then transfers bounded supplies once per player',()=>{
  const {s,site,unit}=fixture('village'),second=addUnit(s,0,unit.x,unit.y+1),h=harness(s),total=stockTotal(s),bank={wood:s.players[0].wood,ore:s.players[0].ore,crystal:s.players[0].crystal};
  unit.x=site.x-1.8;
  expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id,second.id],target:site.id})).toBe(true);h.advance(1);
  expect(site.owner).toBe(0);expect(site.loyalty[0]).toBe(60);expect(s.players[0].wood).toBe(bank.wood-site.request.wood);expect(second.order.type).toBe('idle');
  expect(stockTotal(s)).toEqual(total);
  expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(true);h.advance(1);
  expect(s.players[0].wood).toBe(bank.wood-site.request.wood+NEUTRAL_RULES.supplyBundle.wood);expect(site.rewarded).toEqual([0]);expect(stockTotal(s)).toEqual(total);
  expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(false);
 });
 it('requires arrival and rechecks affordability, ownership and population when executing',()=>{
  const {s,site,unit}=fixture('village'),h=harness(s),total=stockTotal(s);unit.x=site.x-10;
  expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(true);h.advance(10);expect(site.owner).toBe(null);expect(stockTotal(s)).toEqual(total);
  s.players[0].wood=0;const stock={...site.reward};h.advance(1);expect(site.reward).toEqual(stock);expect(unit.order.type).toBe('idle');
  s.players[0].wood=420;settle(s,0,unit,site);s.players[0].population=s.players[0].cap;
  expect(issueNeutralWorldCommand(s,0,{type:'recruitVillage',ids:[unit.id],target:site.id})).toBe(false);
  s.players[0].population--;expect(issueNeutralWorldCommand(s,0,{type:'recruitVillage',ids:[unit.id],target:site.id})).toBe(true);
  site.owner=1;h.advance(1);expect(h.equipment).toHaveLength(0);
 });
 it('recruits real owned defenders from finite stock, respects blocked spawn points and conserves equipment cost',()=>{
  const {s,site,unit}=fixture('village'),h=settle(s,0,unit,site),total=stockTotal(s),before=s.entities.length;
  const spawnTile=Math.floor(site.y)*s.width+Math.floor(site.x+1.7);s.world!.levels[0].terrain[spawnTile]='water';
  expect(issueNeutralWorldCommand(s,0,{type:'recruitVillage',ids:[unit.id],target:site.id})).toBe(true);h.advance(1);
  expect(s.entities).toHaveLength(before);expect(stockTotal(s,h.equipment)).toEqual(total);
  s.world!.levels[0].terrain[spawnTile]='grass';
  for(let attempt=0;attempt<10;attempt++)if(issueNeutralWorldCommand(s,0,{type:'recruitVillage',ids:[unit.id],target:site.id}))h.advance(1);
  const recruits=s.entities.slice(before);expect(recruits.length).toBeGreaterThan(0);expect(recruits.every(e=>e.side===0&&e.role==='melee'&&e.hp>0&&e.level===site.level)).toBe(true);
  expect(stockTotal(s,h.equipment)).toEqual(total);expect(kinds.every(kind=>site.reward[kind]>=0)).toBe(true);
  expect(issueNeutralWorldCommand(s,1,{type:'recruitVillage',ids:[s.entities.find(e=>e.side===1&&e.kind==='unit')!.id],target:site.id})).toBe(false);
 });
 it('local defenders retaliate against raids, and hostile raids remove loyalty and transfer finite stock',()=>{
  const {s,site,unit}=fixture('village'),h=settle(s,0,unit,site),raider=addUnit(s,1,site.x+2,site.y),second=addUnit(s,1,site.x+2,site.y+1),third=addUnit(s,1,site.x+2,site.y-1),total=stockTotal(s);
  unit.x=site.x-10;
  expect(issueNeutralWorldCommand(s,0,{type:'worldAttack',ids:[unit.id],target:site.id})).toBe(false);
  expect(issueNeutralWorldCommand(s,1,{type:'worldAttack',ids:[raider.id,second.id,third.id],target:site.id})).toBe(true);
  for(let ticks=0;ticks<500&&site.owner!==null;ticks++)h.advance(1);
  expect(h.hits.some(hit=>site.creatureIds.includes(hit.source)&&[raider.id,second.id,third.id].includes(hit.target))).toBe(true);
  expect(site.owner).toBe(null);expect(site.loyalty[0]).toBeLessThan(60);
  for(let ticks=0;ticks<1000&&kinds.some(kind=>site.reward[kind]>0);ticks++)h.advance(1);
  expect(site.reward).toEqual({wood:0,ore:0,crystal:0});expect(stockTotal(s)).toEqual(total);
  expect(issueNeutralWorldCommand(s,0,{type:'recruitVillage',ids:[unit.id],target:site.id})).toBe(false);
 });
 it('cannot award services through an unpaid or stale request',()=>{
  const {s,site,unit}=fixture('village'),h=harness(s),before={...site.reward};s.players[0].wood=site.request.wood-1;
  expect(issueNeutralWorldCommand(s,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(false);h.advance(20);
  expect(site.owner).toBe(null);expect(site.loyalty[0]).toBe(0);expect(site.reward).toEqual(before);
 });
});

describe('relic capture and observation',()=>{
 it('channels after approaching, stops while contested, and removes the old team bonus after recapture',()=>{
  const {s,site,unit}=fixture('relic',1),h=harness(s);unit.x=site.x-8;
  expect(issueNeutralWorldCommand(s,0,{type:'captureSite',ids:[unit.id],target:site.id})).toBe(true);h.advance(20);expect(site.progress).toBe(0);
  for(let ticks=0;ticks<400&&site.progress===0;ticks++)h.advance(1);expect(site.progress).toBeGreaterThan(0);
  const enemy=addUnit(s,1,site.x+1,site.y,1);h.advance(10);expect(site.progress).toBe(0);expect(site.capturing).toBe(null);
  enemy.level=0;h.advance(201);expect(site.owner).toBe(0);expect(relicBonus(s,0,unit)).toBe(NEUTRAL_RULES.relicDamageBonus);
  expect(relicBonus(s,0,{x:site.x,y:site.y,level:0})).toBe(0);expect(relicBonus(s,0,{x:site.x+9,y:site.y,level:1})).toBe(0);
  s.teams[1]=s.teams[0];expect(relicBonus(s,1,{...site})).toBe(NEUTRAL_RULES.relicDamageBonus);s.teams[1]=1;
  unit.x=site.x-10;enemy.level=1;expect(issueNeutralWorldCommand(s,1,{type:'captureSite',ids:[enemy.id],target:site.id})).toBe(true);h.advance(201);
  expect(site.owner).toBe(1);expect(relicBonus(s,0,site)).toBe(0);expect(relicBonus(s,1,site)).toBe(NEUTRAL_RULES.relicDamageBonus);
 });
 it('continues a partially captured world identically after JSON serialization',()=>{
  const {s,site,unit}=fixture('relic'),h=harness(s);unit.x=site.x-1;
  expect(issueNeutralWorldCommand(s,0,{type:'captureSite',ids:[unit.id],target:site.id})).toBe(true);h.advance(90);
  const restored=structuredClone(s);restored.world=JSON.parse(JSON.stringify(s.world));const resumed=harness(restored);
  for(let i=0;i<160;i++){h.advance(1);resumed.advance(1);expect(restored.world).toEqual(s.world);expect(restored.players).toEqual(s.players);}
  expect(site.owner).toBe(0);expect(restored.world!.sites[0].owner).toBe(0);
 });
 it('returns only visible level-specific records without AI targets, paths or another player loyalty',()=>{
  const {s,site}=fixture('village',1);s.visible[0].clear();s.visible[0].add(fogKey(s,{...site,level:0}));
  expect(observeNeutralWorld(s,0)).toEqual({sites:[],creatures:[]});s.visible[0].add(fogKey(s,site));
  site.loyalty[1]=90;const creature=s.world!.creatures[0];creature.target=s.entities[0].id;creature.path=[{x:10,y:10,level:1}];s.visible[0].add(fogKey(s,creature));
  const view=observeNeutralWorld(s,0);expect(view.sites).toHaveLength(1);expect(view.creatures).toHaveLength(1);expect(view.sites[0].loyalty).toBe(0);
  expect(view.creatures[0]).not.toHaveProperty('target');expect(view.creatures[0]).not.toHaveProperty('path');expect(view.creatures[0]).not.toHaveProperty('cooldown');
  view.sites[0].stock.wood=0;expect(site.reward.wood).toBeGreaterThan(0);
 });
});
