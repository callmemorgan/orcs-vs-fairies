import { describe, expect, it } from 'vitest';
import { availableBuildings, availableUnits, buildingFor, contentHash, createContentBundle, decodeContentPackage, factionFor, unitFor } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { createEconomyState, costTotal, zeroCost } from '../src/core/economy-common';
import { ECONOMY_BUILDINGS, ECONOMY_CARAVAN, economyGatherDepot, initializeEconomySites } from '../src/core/economy';
import { PlayerView } from '../src/core/observation';
import { OnlineView } from '../src/server/views';
import { teamObservation } from '../src/server/team-view';
import { observationToRenderState } from '../src/online/render-state';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { canPlace, createGame, createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { fogKey } from '../src/core/world-map';
import type { Entity, GameState, Side, UnitRole } from '../src/core/types';
import type { WorldState } from '../src/core/world-types';

type MixedState=GameState & {world:WorldState};
const run=(s:GameState,seconds:number)=>{for(let i=0;i<Math.round(seconds*20);i++)stepGame(s,.05);};
function fixture():MixedState {
 const s=createMatch({map:{seed:4127,size:'small',biome:'forest'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:500}}},{id:1,teamId:1,factionId:'fairies',controller:'external'}],rules:{startingAge:3}}) as MixedState;
 s.entities=s.entities.filter(e=>e.role==='hq');s.resources=[];
 for(const level of s.world.levels){level.terrain.fill('grass');level.elevation.fill(0);}
 Object.assign(s.world,{transitions:[],bridges:[],sites:[],creatures:[],fires:[],iceTiles:[],dayLength:10000,seasonLength:100,weatherLength:10000});
 s.economy=createEconomyState(2);initializeEconomySites(s,[{x:18.5,y:18.5,level:0},{x:18.5,y:18.5,level:1}]);
 refreshVisibility(s);return s;
}
function actor(s:GameState,side:Side,role:UnitRole,x:number,y:number,level=0):Entity {
 const d=unitFor(s,side,role),e:Entity={id:s.nextId++,side,kind:'unit',role,x,y,level,hp:d.hp,maxHp:d.hp,order:{type:'idle'},cooldown:0,progress:1,queue:[],trainProgress:0,researchProgress:0,facing:2,animation:'idle',animTime:0,momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[]};
 if(d.shield){e.shield=d.shield;e.maxShield=d.shield;}s.entities.push(e);return e;
}
function hq(s:GameState,side:Side=0){return s.entities.find(e=>e.side===side&&e.role==='hq')!;}
function settlement(s:GameState,x:number,y:number,level=0):Entity {const e={...structuredClone(hq(s)),id:s.nextId++,x,y,level};s.entities.push(e);return e;}
function caravan(s:GameState,x=10.5,y=10.5):Entity {
 expect(issueCommand(s,0,{type:'trainCaravan',id:hq(s).id})).toBe(true);run(s,18.1);
 const e=s.entities.find(e=>e.id===s.economy!.caravans.at(-1))!;e.x=x;e.y=y;refreshVisibility(s);return e;
}
function loadedRoute(s:MixedState){
 const cart=caravan(s),source=settlement(s,10.5,8.5),target=settlement(s,26.5,8.5),wood=s.players[0].wood;
 expect(issueCommand(s,0,{type:'tradeRoute',id:cart.id,source:source.id,target:target.id,kind:'wood',amount:30,repeat:false})).toBe(true);stepGame(s,.05);
 const cargo=s.economy!.cargo.find(c=>c.entityId===cart.id)!;
 expect(cargo.stock.wood).toBe(30);expect(cargo.tradeValue).toBeGreaterThan(0);expect(s.economy!.markets.some(m=>m.level===0&&m.stock.crystal>0)).toBe(true);expect(s.players[0].wood).toBe(wood-30);
 return {cart,cargo,source,target,wood};
}
function continuation(s:GameState){
 const restored=loadGame(saveGame(s));expect(replayChecksum(restored)).toBe(replayChecksum(s));
 for(let i=0;i<20;i++){stepGame(s,.05);stepGame(restored,.05);expect(replayChecksum(restored)).toBe(replayChecksum(s));}
 return restored;
}
function deathAssertions(s:GameState,cart:Entity){
 expect(cart.hp).toBe(0);expect(s.events.filter(e=>e.type==='death'&&e.source===cart.id)).toHaveLength(1);expect(s.corpses.filter(c=>c.id===cart.id)).toHaveLength(1);
 expect(s.economy!.deathClaims.filter(id=>id===cart.id)).toHaveLength(1);expect(s.economy!.cargo.some(c=>c.entityId===cart.id)).toBe(false);
 const drops=s.economy!.salvage.filter(c=>c.x===cart.x&&c.y===cart.y&&c.level===(cart.level??0));expect(drops.filter(c=>c.kind==='cargo')).toHaveLength(1);expect(drops.find(c=>c.kind==='cargo')!.stock.wood).toBe(30);expect(drops.filter(c=>c.kind==='salvage')).toHaveLength(0);expect(s.economy!.paidCosts.some(c=>c.entityId===cart.id)).toBe(false);expect(s.economy!.caravans).not.toContain(cart.id);expect(s.economy!.tasks.some(t=>t.entityId===cart.id)).toBe(false);
 const total=drops.reduce((n,c)=>n+costTotal(c.stock),0);continuation(s);expect(s.economy!.salvage.reduce((n,c)=>n+costTotal(c.stock),0)).toBe(total);
}

describe('assembled world and economy',()=>{
 it('initializes strict economy IDs from real generated world villages and saves them',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],mapSize:'small',biome:'forest'}),village=s.world!.sites.find(site=>site.kind==='village')!;
  expect(s.economy!.villages.find(v=>v.id===village.id)?.level).toBe(village.level);
  const ids=[...s.entities,...s.resources,...s.world!.bridges,...s.world!.sites,...s.world!.creatures,...s.economy!.markets,...s.economy!.contracts,...s.economy!.groves,...s.economy!.salvage].map(e=>e.id);
  expect(new Set(ids).size).toBe(ids.length);expect(Object.keys(s.economy!.markets[0]).sort()).toEqual(['demand','id','level','recoverAt','stock','x','y']);
  expect(loadGame(saveGame(s)).economy).toEqual(s.economy);continuation(s);
  for(const mutate of [()=>{const saved=saveGame(s);saved.state.economy!.markets[0].id=village.id;return saved;},()=>{const saved=saveGame(s);saved.state.economy!.villages[0].id=s.world!.sites.find(site=>site.kind!=='village')!.id;return saved;},()=>{const saved=saveGame(s);saved.state.economy!.markets[0].level=2;return saved;}])expect(()=>loadGame(mutate())).toThrow(/economy/);
 });
 it('cancels loaded trade on a commanded transition, keeps the goods and deposits on the new level',()=>{
  const s=fixture(),{cart,cargo,wood}=loadedRoute(s),crystal=s.players[0].crystal;
  s.world.transitions.push({id:1,from:{x:cart.x,y:cart.y,level:0},to:{x:cart.x,y:cart.y,level:1}});refreshVisibility(s);
  expect(issueCommand(s,0,{type:'traverse',ids:[cart.id],transition:1})).toBe(true);expect(cargo.tradeValue).toBe(0);expect(cargo.origin).toBe('delivery');stepGame(s,.05);
  expect(cart.level).toBe(1);expect(cargo.stock.wood).toBe(30);expect(s.economy!.tasks).toHaveLength(0);continuation(s);
  settlement(s,cart.x,cart.y+2,1);run(s,.1);expect(cargo.stock.wood).toBe(0);expect(s.players[0].wood).toBe(wood);expect(s.players[0].crystal).toBe(crystal);
 });
 it('clears worker warehouse assignment after a real layer transition and preserves save continuation',()=>{
  const s=fixture(),w=actor(s,0,'worker',10.5,10.5);refreshVisibility(s);
  expect(issueCommand(s,0,{type:'buildEconomy',ids:[w.id],kind:'warehouse',x:13.5,y:10.5})).toBe(true);const warehouse=s.entities.at(-1)!;run(s,45);expect(warehouse.progress).toBe(1);
  expect(issueCommand(s,0,{type:'setWarehouse',ids:[w.id],target:warehouse.id})).toBe(true);expect(economyGatherDepot(s,w)).toBe(warehouse);
  s.world.transitions.push({id:1,from:{x:w.x,y:w.y,level:0},to:{x:w.x,y:w.y,level:1}});refreshVisibility(s);expect(issueCommand(s,0,{type:'traverse',ids:[w.id],transition:1})).toBe(true);stepGame(s,.05);
  expect(w.level).toBe(1);expect(s.economy!.workerWarehouses).toEqual([]);expect(economyGatherDepot(s,w)).toBeUndefined();continuation(s);
 });
 it('drops loaded paid cargo once when a commanded fire kills a caravan',()=>{
  const s=fixture(),{cart}=loadedRoute(s),starter=actor(s,0,'worker',9.5,10.5);cart.hp=.01;s.resources.push({id:s.nextId++,x:cart.x,y:cart.y,level:0,kind:'wood',amount:100,maxAmount:100});refreshVisibility(s);
  expect(issueCommand(s,0,{type:'ignite',ids:[starter.id],x:cart.x,y:cart.y})).toBe(true);stepGame(s,.05);deathAssertions(s,cart);
 });
 it('drops loaded paid cargo once when an attacked bridge drowns a caravan',()=>{
  const s=fixture(),{cart}=loadedRoute(s),siege=actor(s,0,'siege',12.5,10.5),tile=10*s.width+10;
  for(let y=2;y<=18;y++)for(let x=2;x<=18;x++)s.terrain[y*s.width+x]='water';const tiles=[];for(let x=2;x<=18;x++){const crossing=10*s.width+x;s.terrain[crossing]='bridge';tiles.push(crossing);}
  const bridge={id:s.nextId++,x:10.5,y:10.5,level:0,hp:1,maxHp:160,tiles,rebuilding:0,repairSide:null};s.world.bridges.push(bridge);
  s.visible[0].add(fogKey(s,bridge));s.explored[0].add(fogKey(s,bridge));expect(issueCommand(s,0,{type:'worldAttack',ids:[siege.id],target:bridge.id})).toBe(true);stepGame(s,.05);
  expect(bridge.hp).toBe(0);deathAssertions(s,cart);
 });
 it('drops loaded cargo once when spring thaw leaves no reachable bank',()=>{
  const s=fixture(),{cart}=loadedRoute(s);s.time=399.95;
  for(let y=4;y<=16;y++)for(let x=4;x<=16;x++){const tile=y*s.width+x;s.terrain[tile]='ice';s.world.iceTiles.push({level:0,tile});}
  stepGame(s,.05);deathAssertions(s,cart);
 });
 it.each(['ignite','firebreak'] as const)('burns grass saplings through %s while keeping another layer intact',command=>{
  const s=fixture(),planter=actor(s,0,'worker',10.5,10.5),starter=actor(s,0,'worker',11.5,9.5),point={x:11.5,y:10.5};refreshVisibility(s);
  expect(issueCommand(s,0,{type:'plantGrove',ids:[planter.id],...point})).toBe(true);const grove=s.economy!.groves[0];
  const underground={...grove,id:s.nextId++,level:1};s.economy!.groves.push(underground);
  expect(issueCommand(s,0,{type:command,ids:[starter.id],...point})).toBe(true);stepGame(s,.05);expect(grove.burned).toBe(true);expect(underground.burned).toBe(false);expect(s.economy!.tasks).toHaveLength(0);continuation(s);
 });
 it('keeps caravans passive before bridge, village and environmental command dispatch',()=>{
  const s=fixture(),cart=caravan(s),tile=10*s.width+10;s.terrain[tile]='bridge';const bridge={id:s.nextId++,x:10.5,y:10.5,level:0,hp:1,maxHp:160,tiles:[tile],rebuilding:0,repairSide:null};s.world.bridges.push(bridge);s.resources.push({id:s.nextId++,x:cart.x,y:cart.y,kind:'wood',amount:100,maxAmount:100});refreshVisibility(s);
  const commands=[{type:'worldAttack',ids:[cart.id],target:bridge.id},{type:'repairBridge',ids:[cart.id],target:bridge.id},{type:'captureSite',ids:[cart.id],target:bridge.id},{type:'supportVillage',ids:[cart.id],target:bridge.id},{type:'recruitVillage',ids:[cart.id],target:bridge.id},{type:'ignite',ids:[cart.id],x:cart.x,y:cart.y},{type:'firebreak',ids:[cart.id],x:cart.x,y:cart.y}] as const;
  for(const c of commands)expect(issueCommand(s,0,{...c,ids:[...c.ids]})).toBe(false);expect(bridge.hp).toBe(1);expect(s.world.fires).toEqual([]);s.resources=[];
  expect(issueCommand(s,0,{type:'move',ids:[cart.id],x:cart.x+3,y:cart.y+3})).toBe(true);run(s,3);expect(cart.x).toBeGreaterThan(10.5);
 });
 it('discloses economy recruitment events and actors only on their observed layer',()=>{
  const s=fixture(),surface=actor(s,0,'worker',18.5,18.5),enemyHQ=hq(s,1);Object.assign(enemyHQ,{x:18.5,y:18.5,level:1});refreshVisibility(s);
  expect(issueCommand(s,1,{type:'trainCaravan',id:enemyHQ.id})).toBe(true);expect(s.events.at(-1)?.level).toBe(1);expect(new PlayerView(1).events(s).some(e=>e.text==='Caravan recruitment started.')).toBe(true);
  let seen=false;for(let i=0;i<400;i++){stepGame(s,.05);const train=s.events.find(e=>e.type==='train');if(!train)continue;seen=true;expect(train.level).toBe(1);const view=new PlayerView(0);expect(view.events(s).some(e=>e.type==='train')).toBe(false);expect(view.observe(s).economy.caravans).toEqual([]);s.visible[0].add(fogKey(s,train));s.explored[0].add(fogKey(s,train));expect(view.events(s).some(e=>e.type==='train')).toBe(true);const before=saveGame(s),observation=view.observe(s),frame=observationToRenderState(new OnlineView(0).observe(s),'player');expect(frame.economy?.caravans[0].stock).toEqual(zeroCost());expect(frame.state.economy).toBeUndefined();expect(saveGame(s)).toEqual(before);break;}
  expect(seen).toBe(true);expect(surface.level).toBe(0);
 });
 it('records world traversal and economic payment in a same-build replay',()=>{
  const s=fixture(),w=actor(s,0,'worker',10.5,10.5);s.world.transitions.push({id:1,from:{x:w.x,y:w.y,level:0},to:{x:w.x,y:w.y,level:1}});refreshVisibility(s);const recorder=new MatchRecorder(s);
  expect(issueCommand(s,0,{type:'traverse',ids:[w.id],transition:1})).toBe(true);run(s,.3);expect(issueCommand(s,0,{type:'plantGrove',ids:[w.id],x:12.5,y:10.5,level:1})).toBe(true);run(s,70);
  const replay=new ReplayPlayer(recorder.export());replay.advance(s.tick);expect(replay.finished).toBe(true);expect(replayChecksum(replay.state)).toBe(replayChecksum(s));expect(s.economy!.groves[0].resourceId).toBeDefined();replay.dispose();recorder.dispose();
 });
});

describe('economic definitions with pinned mod content',()=>{
 it.each(['core','builtin','economy'])('rejects the reserved %s package namespace before registry admission',namespace=>{
  const value=JSON.parse(JSON.stringify(exampleMod()).replaceAll('lantern',namespace)),{hash:_,...body}=value;value.hash=contentHash(body);expect(()=>decodeContentPackage(value)).toThrow('reserved');
 });
 it('uses size-2 economic placement beside a size-6 mod depot and salvages the charged mod siege cost',()=>{
  const p=JSON.parse(JSON.stringify(exampleMod())),f=p.factions[0],baseUnit={...f.units[0],id:'lantern:catapult',role:'siege',ability:undefined,cost:{wood:123,ore:87,crystal:19},trainTime:.1,hp:100,damage:20,range:8};delete baseUnit.ability;f.units.push(baseUnit);p.art[baseUnit.id]={...p.art['lantern:sentinel'],path:'/mods/lantern/catapult.svg'};
  f.buildings.push({...f.buildings[0],id:'lantern:depot',role:'depot',size:6});f.defaultBuildings.depot='lantern:depot';p.art['lantern:depot']={...p.art['lantern:hall'],path:'/mods/lantern/depot.svg'};const {hash:_,...body}=p;p.hash=contentHash(body);
  const content=createContentBundle([p]),s=createMatch({content,map:{seed:4127,size:'small',biome:'forest'},players:[{id:0,teamId:0,factionId:'lantern:keepers',controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:500}}},{id:1,teamId:1,factionId:'orcs',controller:'external'}],rules:{startingAge:3}});for(const l of s.world!.levels){l.terrain.fill('grass');l.elevation.fill(0);}s.resources=[];s.world!.creatures=[];s.world!.sites=[];
  const w=s.entities.find(e=>e.side===0&&e.role==='worker')!;Object.assign(w,{x:10.5,y:10.5});refreshVisibility(s);
  expect(factionFor(s,0).buildings.depot.size).toBe(6);expect(canPlace(s,0,'depot',1.5,10.5,'lantern:depot')).toBe(false);for(let y=8;y<=12;y++)for(let x=0;x<=3;x++){s.visible[0].add(y*s.width+x);s.explored[0].add(y*s.width+x);}expect(canPlace(s,0,'depot',1.5,10.5,'economy:warehouse')).toBe(true);
  expect(issueCommand(s,0,{type:'buildEconomy',ids:[w.id],kind:'warehouse',x:13.5,y:10.5})).toBe(true);const warehouse=s.entities.at(-1)!;expect(buildingFor(s,warehouse)).toBe(ECONOMY_BUILDINGS.warehouse);expect(availableBuildings(s,0).some(d=>d.id.startsWith('economy:'))).toBe(false);expect(availableUnits(s,0).some(d=>d.id==='economy:caravan')).toBe(false);
  const hall={...structuredClone(hq(s)),id:s.nextId++,role:'barracks' as const,definitionId:'lantern:hall',x:22.5,y:10.5};s.entities.push(hall);const before={wood:s.players[0].wood,ore:s.players[0].ore,crystal:s.players[0].crystal};expect(issueCommand(s,0,{type:'train',id:hall.id,role:'siege',definitionId:baseUnit.id})).toBe(true);expect(hall.queuePaidCosts).toEqual([baseUnit.cost]);run(s,.15);const siege=s.entities.find(e=>e.definitionId===baseUnit.id)!;expect(siege).toBeDefined();expect(s.economy!.paidCosts.find(c=>c.entityId===siege.id)?.stock).toEqual(baseUnit.cost);for(const k of ['wood','ore','crystal'] as const)expect(s.players[0][k]).toBe(before[k]-baseUnit.cost[k]);
  siege.hp=.01;Object.assign(siege,{x:24.5,y:12.5});const starter=actor(s,0,'worker',23.5,12.5);s.resources.push({id:s.nextId++,x:siege.x,y:siege.y,kind:'wood',amount:100,maxAmount:100});refreshVisibility(s);expect(issueCommand(s,0,{type:'ignite',ids:[starter.id],x:siege.x,y:siege.y})).toBe(true);stepGame(s,.05);expect(siege.hp).toBe(0);const salvage=s.economy!.salvage.find(c=>c.kind==='salvage'&&c.x===siege.x)!;for(const k of ['wood','ore','crystal'] as const)expect(salvage.stock[k]).toBeCloseTo(baseUnit.cost[k]*.25);expect(unitFor(s,0,'worker','economy:caravan')).toBe(ECONOMY_CARAVAN);continuation(s);
 });
});

it('unions disclosed teammate economy markers while keeping the selected seat private fields',()=>{
 const s=fixture();s.teams[1]=s.teams[0];const market=s.economy!.markets.find(m=>m.level===1)!,ally=actor(s,1,'worker',market.x,market.y,1);ally.definitionId='economy:caravan';s.economy!.caravans.push(ally.id);s.economy!.cargo.push({entityId:ally.id,stock:{wood:40,ore:0,crystal:0},capacity:90,origin:'trade',tradeValue:7,sourceId:hq(s,1).id,destinationId:hq(s).id});s.economy!.tasks.push({entityId:ally.id,kind:'route',sourceId:hq(s,1).id,targetId:hq(s).id,phase:'delivery',amount:{wood:40,ore:0,crystal:0},repeat:false,progress:0});
 s.visible[0].clear();s.visible[1].clear();const key=fogKey(s,market);s.visible[1].add(key);s.explored[1].add(key);s.economy!.ledgers[1].gathered.wood=999;const accepted=s.economy!.contracts.find(c=>c.level===1)!;accepted.side=1;accepted.status='accepted';
 const frames=[new OnlineView(0).observe(s),new OnlineView(1).observe(s)],before=JSON.stringify(frames),merged=teamObservation(frames,0);
 expect(frames[0].economy.markets.some(m=>m.id===market.id)).toBe(false);expect(merged.economy.markets.some(m=>m.id===market.id)).toBe(true);expect(merged.visible).toContain(key);const cargo=merged.economy.caravans.find(c=>c.entityId===ally.id)!;expect(cargo.stock).toEqual(zeroCost());expect(cargo.tradeValue).toBe(0);expect(cargo.task).toBeUndefined();expect(cargo.sourceId).toBeUndefined();expect(merged.economy.ledger.gathered.wood).toBe(0);expect(merged.economy.contracts.some(c=>c.id===accepted.id)).toBe(false);expect(JSON.stringify(frames)).toBe(before);
});
