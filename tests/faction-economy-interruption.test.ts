import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createEconomyState } from '../src/core/economy-common';
import { CORPSE_WAGON, FACTION_STRUCTURE_INFO } from '../src/core/faction-systems-content';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { captureRuntime, createMatch, issueCommand, refreshVisibility, spawnDefinition, spawnEntity, stepGame } from '../src/core/simulation';
import type { BuiltinFactionId, Command, Entity, GameState, Side, UnitRole } from '../src/core/types';

function fixture(faction: BuiltinFactionId): GameState {
 const s=createMatch({map:{seed:4127,size:'small'},rules:{startingAge:3},players:[
  {id:0,teamId:0,factionId:faction,controller:'external',handicap:{startingResources:{wood:10000,ore:10000,crystal:1000}}},
  {id:1,teamId:1,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:10000,ore:10000,crystal:1000}}},
 ]});
 s.entities=s.entities.filter(e=>e.role==='hq');s.resources=[];s.terrain.fill('grass');s.economy=createEconomyState(2);
 for(const e of s.entities){e.x=e.side===0?2.5:s.width-2.5;e.y=e.side===0?2.5:s.height-2.5;}
 refreshVisibility(s);return s;
}
function unit(s:GameState,role:UnitRole,x=20.5,y=20.5,side:Side=0):Entity {
 const e=spawnDefinition(s,side,'unit',FACTIONS[s.players[side].faction].units[role].id,x,y);e.order={type:'hold'};e.cooldown=100;return e;
}
function warehouse(s:GameState):Entity {
 const e=spawnEntity(s,1,'building','depot',26.5,20.5,1,'economy:warehouse');
 s.economy!.structures.push({entityId:e.id,kind:'warehouse',stock:{wood:80,ore:0,crystal:0},capacity:900,overcharge:false,nextIncident:12});
 return e;
}
function command(s:GameState,c:Command,side:Side=0):void {expect(issueCommand(s,side,c),JSON.stringify(c)).toBe(true);}
function record(s:GameState):MatchRecorder {refreshVisibility(s);return new MatchRecorder(s);}
function run(s:GameState,seconds:number):void {for(let i=0;i<Math.round(seconds*20);i++)stepGame(s,.05);}
function cargo(s:GameState,e:Entity){return s.economy!.cargo.find(item=>item.entityId===e.id)!;}
function task(s:GameState,e:Entity){return s.economy!.tasks.find(item=>item.entityId===e.id);}
function loadRaid(s:GameState,e:Entity,target:Entity,expectRoute=true):void {
 refreshVisibility(s);command(s,{type:'raidSupply',ids:[e.id],target:target.id});
 for(let i=0;i<400&&!cargo(s,e)?.stock.wood;i++)stepGame(s,.05);
 expect(cargo(s,e).stock).toEqual({wood:24,ore:0,crystal:0});expect(task(s,e)).toMatchObject({kind:'route',phase:'delivery'});
 run(s,.05);if(expectRoute)expect(captureRuntime(s).routes.some(([id])=>id===e.id)).toBe(true);
 e.orderQueue=[{type:'move',x:30.5,y:20.5}];e.entrenchedAt=s.time;
}
function expectInterrupted(s:GameState,e:Entity,stock=24):void {
 expect(task(s,e)).toBeUndefined();expect(e.orderQueue).toBeUndefined();expect(e.entrenchedAt).toBeUndefined();expect(e.path).toEqual([]);
 expect(captureRuntime(s).routes.some(([id])=>id===e.id)).toBe(false);
 expect(cargo(s,e)).toMatchObject({stock:{wood:stock,ore:0,crystal:0},origin:'delivery',tradeValue:0});
 expect(cargo(s,e).destinationId).toBeUndefined();expect(cargo(s,e).contractId).toBeUndefined();
}
function continueAndReplay(s:GameState,recorder:MatchRecorder,seconds=.5):void {
 const saved=saveGame(s),restored=loadGame(JSON.stringify(saved));expect(saveGame(restored)).toEqual(saved);
 run(s,seconds);run(restored,seconds);expect(saveGame(restored)).toEqual(saveGame(s));
 const archive=recorder.export(),player=new ReplayPlayer(archive);player.seek(s.tick);
 expect(replayChecksum(player.state)).toBe(replayChecksum(s));expect(player.state.economy).toEqual(s.economy);
 recorder.dispose();player.dispose();
}

describe('faction commands replace economy work through the public command boundary',()=>{
 it('swaps a loaded raider and clears its old route while retaining cargo',()=>{
  const s=fixture('fairies'),e=unit(s,'melee'),target=warehouse(s),double=unit(s,'melee',30.5,20.5);double.illusion=true;double.expires=100;
  loadRaid(s,e,target);const before={x:e.x,y:e.y},crystal=s.players[0].crystal,recorder=record(s);
  command(s,{type:'illusionSwap',ids:[e.id],target:double.id});
  expect([e.x,e.y,double.x,double.y]).toEqual([30.5,20.5,before.x,before.y]);expect(e.order).toEqual({type:'hold'});
  expect(s.players[0].crystal).toBe(crystal-15);expectInterrupted(s,e);continueAndReplay(s,recorder,2);
 });
 it('a blocked swap leaves its loaded delivery, position and spending unchanged',()=>{
  const s=fixture('fairies'),e=unit(s,'melee'),target=warehouse(s),double=unit(s,'melee',30.5,20.5);double.illusion=true;double.expires=100;
  loadRaid(s,e,target);s.terrain[20*s.width+30]='rock';refreshVisibility(s);const before=saveGame(s);
  expect(issueCommand(s,0,{type:'illusionSwap',ids:[e.id],target:double.id})).toBe(false);expect(saveGame(s)).toEqual(before);
 });
 it('tunnel travel cancels a loaded delivery before installing its channel and survives continuation',()=>{
  const s=fixture('dwarves'),e=unit(s,'melee'),target=warehouse(s);
  spawnDefinition(s,0,'building',FACTION_STRUCTURE_INFO.tunnel.definition.id,26.5,22.5);
  const exit=spawnDefinition(s,0,'building',FACTION_STRUCTURE_INFO.tunnel.definition.id,31.5,23.5);
  loadRaid(s,e,target,false);const recorder=record(s);command(s,{type:'tunnelTravel',ids:[e.id],target:exit.id});
  expectInterrupted(s,e);expect(e.factionState!.tunnel).toEqual({target:exit.id,progress:0});run(s,1.5);
  expect(e.factionState!.tunnel!.progress).toBeCloseTo(.5);continueAndReplay(s,recorder,1.6);
  expect(e.x).toBeGreaterThan(32.5);expect(e.factionState!.tunnel).toBeUndefined();expect(cargo(s,e).stock.wood).toBe(0);expect(s.economy!.ledgers[0].delivered.wood).toBe(24);
 });
 it('an invalid tunnel exit leaves an existing raid channel untouched',()=>{
  const s=fixture('dwarves'),e=unit(s,'melee'),target=warehouse(s),foreign=spawnDefinition(s,0,'building',FACTION_STRUCTURE_INFO.tunnel.definition.id,31.5,23.5,.5);
  refreshVisibility(s);command(s,{type:'raidSupply',ids:[e.id],target:target.id});refreshVisibility(s);const before=saveGame(s);
  expect(issueCommand(s,0,{type:'tunnelTravel',ids:[e.id],target:foreign.id})).toBe(false);expect(saveGame(s)).toEqual(before);
 });
 it('faction construction cancels planting, releases its site and records the paid cost',()=>{
  const s=fixture('undead'),worker=unit(s,'worker'),recorder=record(s),wood=s.players[0].wood;
  command(s,{type:'plantGrove',ids:[worker.id],x:22.5,y:22.5});const grove=s.economy!.groves[0];
  command(s,{type:'buildFactionStructure',ids:[worker.id],structure:'necropolis',x:24.5,y:20.5});
  const building=s.entities.find(e=>e.definitionId===FACTION_STRUCTURE_INFO.necropolis.definition.id)!;
  expect(grove.burned).toBe(true);expect(task(s,worker)).toBeUndefined();expect(worker.order).toEqual({type:'build',target:building.id});
  expect(s.economy!.paidCosts.find(item=>item.entityId===building.id)?.stock).toEqual(FACTION_STRUCTURE_INFO.necropolis.definition.cost);
  expect(s.players[0].wood).toBe(wood-8-120);continueAndReplay(s,recorder,31);expect(building.progress).toBe(1);
 });
 it('a blocked faction foundation leaves the old planting job and wallet untouched',()=>{
  const s=fixture('undead'),worker=unit(s,'worker');refreshVisibility(s);command(s,{type:'plantGrove',ids:[worker.id],x:22.5,y:22.5});
  s.terrain[20*s.width+24]='rock';refreshVisibility(s);const before=saveGame(s);
  expect(issueCommand(s,0,{type:'buildFactionStructure',ids:[worker.id],structure:'necropolis',x:24.5,y:20.5})).toBe(false);expect(saveGame(s)).toEqual(before);
 });
 it.each(['collectCorpses','deliverCorpses'] as const)('%s replaces a wagon raid and leaves failed targets untouched',type=>{
  const s=fixture('undead'),wagon=spawnDefinition(s,0,'unit',CORPSE_WAGON.id,20.5,20.5),target=warehouse(s);
  const body={id:s.nextId++,x:21.5,y:22.5,expires:45},caster=unit(s,'special',30.5,23.5);
  if(type==='collectCorpses')s.corpses.push(body);else wagon.factionState={corpseCargo:[body]};
  refreshVisibility(s);command(s,{type:'raidSupply',ids:[wagon.id],target:target.id});run(s,.05);refreshVisibility(s);const before=saveGame(s),recorder=record(s);
  expect(issueCommand(s,0,{type,ids:[wagon.id],target:999999})).toBe(false);expect(saveGame(s)).toEqual(before);
  command(s,{type,ids:[wagon.id],target:type==='collectCorpses'?body.id:caster.id});expect(task(s,wagon)).toBeUndefined();
  expect(wagon.factionState!.corpseOrder).toMatchObject({type:type==='collectCorpses'?'collect':'deliver'});
  continueAndReplay(s,recorder,10);expect(s.economy!.structures[0].stock.wood).toBe(80);
  expect(wagon.factionState!.corpseOrder).toBeUndefined();
  if(type==='collectCorpses')expect(wagon.factionState!.corpseCargo).toEqual([body]);else {expect(wagon.factionState!.corpseCargo).toEqual([]);expect(s.entities.filter(e=>e.raised)).toHaveLength(1);}
 });
 it.each(['collectCorpses','deliverCorpses'] as const)('%s retains a wagon\'s physical resource cargo when replacing its return route',type=>{
  const s=fixture('undead'),wagon=spawnDefinition(s,0,'unit',CORPSE_WAGON.id,20.5,20.5),target=warehouse(s);
  const body={id:s.nextId++,x:21.5,y:22.5,expires:45},caster=unit(s,'special',30.5,23.5);
  if(type==='collectCorpses')s.corpses.push(body);else wagon.factionState={corpseCargo:[body]};
  loadRaid(s,wagon,target);const recorder=record(s);command(s,{type,ids:[wagon.id],target:type==='collectCorpses'?body.id:caster.id});
  expectInterrupted(s,wagon);expect(wagon.factionState!.corpseOrder).toBeDefined();continueAndReplay(s,recorder,10);
  expect(cargo(s,wagon).stock.wood).toBe(24);expect(s.economy!.structures[0].stock.wood).toBe(56);
 });
});

describe('tactical ownership and orders interrupt economy work',()=>{
 it('a runtime surrender cancels a loaded route before transferring the physical cargo',()=>{
  const s=fixture('dwarves'),e=unit(s,'melee'),target=warehouse(s);loadRaid(s,e,target);
  e.hp=e.maxHp*.5;e.tactics!.morale=0;
  for(const [dx,dy] of [[-1.2,0],[1.2,0],[0,1.2]])unit(s,'melee',e.x+dx,e.y+dy,1);
  refreshVisibility(s);const recorder=record(s);run(s,.05);
  expect(e.side).toBe(1);expect(e.definitionFaction).toBe('dwarves');expect(e.tactics!.surrenderedTo).toBe(1);
  expectInterrupted(s,e);expect(cargo(s,e).sourceId).toBe(target.id);continueAndReplay(s,recorder,.2);
 });
 it('capture cleans up the engine delivery while allowing the captor channel to complete',()=>{
  const s=fixture('dwarves'),engine=unit(s,'siege'),target=warehouse(s);loadRaid(s,engine,target);
  // Author the encounter after the public raid; combat removes this crew before the public capture command.
  const raiders=[-.6,-.4,-.2,.2,.4,.6].map(dy=>unit(s,'melee',engine.x-1.1,engine.y+dy,1));for(const e of raiders)e.cooldown=0;
  const recorder=record(s);command(s,{type:'attack',ids:raiders.map(e=>e.id),target:engine.id},1);run(s,.05);
  expect(engine.tactics!.siegeCrew!.uncrewed).toBe(true);command(s,{type:'stop',ids:raiders.map(e=>e.id)},1);
  command(s,{type:'captureSiege',ids:[raiders[2].id],target:engine.id},1);run(s,1);
  expect(raiders[2].tactics!.capture!.progress).toBeGreaterThan(0);expect(engine.side).toBe(0);expect(task(s,engine)).toBeDefined();
  continueAndReplay(s,recorder,8);expect(engine.side).toBe(1);expect(engine.definitionFaction).toBe('dwarves');expect(engine.tactics!.siegeCrew!.uncrewed).toBe(false);
  expect(raiders[2].tactics!.capture).toBeUndefined();expectInterrupted(s,engine);
 });
 it('starting an economy raid removes a public formation and automatic retreat replaces the job',()=>{
  const s=fixture('orcs'),e=unit(s,'melee'),target=warehouse(s),enemy=unit(s,'melee',24.5,23.5,1);enemy.cooldown=100;
  const recorder=record(s);command(s,{type:'formation',ids:[e.id],formation:'line',spacing:1,facing:2});expect(e.tactics!.formation).toBeDefined();
  refreshVisibility(s);command(s,{type:'raidSupply',ids:[e.id],target:target.id});expect(e.order).toEqual({type:'hold'});expect(e.tactics!.formation).toBeUndefined();
  continueAndReplay(s,recorder,.05);
  e.hp=e.maxHp*.5;e.tactics!.morale=15;refreshVisibility(s);const retreatRecorder=record(s);run(s,.05);
  expect(e.tactics!.retreat).toBeDefined();expect(e.order.type).toBe('move');expect(task(s,e)).toBeUndefined();continueAndReplay(s,retreatRecorder,.2);
 });
 it('formation replaces an economy raid and keeps the commanded formation until the next job',()=>{
  const s=fixture('orcs'),e=unit(s,'melee'),target=warehouse(s),recorder=record(s);
  command(s,{type:'raidSupply',ids:[e.id],target:target.id});expect(task(s,e)).toMatchObject({kind:'raid'});
  command(s,{type:'formation',ids:[e.id],formation:'wedge',spacing:1,facing:2});expect(task(s,e)).toBeUndefined();expect(e.tactics!.formation!.kind).toBe('wedge');
  const before=saveGame(s);expect(issueCommand(s,0,{type:'raidSupply',ids:[e.id],target:999999})).toBe(false);expect(saveGame(s)).toEqual(before);
  continueAndReplay(s,recorder,.2);command(s,{type:'raidSupply',ids:[e.id],target:target.id});expect(e.tactics!.formation).toBeUndefined();
 });
 it('automatic recovery cancels an admitted old raid/retreat combination before holding',()=>{
  const s=fixture('orcs'),e=unit(s,'melee'),target=warehouse(s);refreshVisibility(s);command(s,{type:'raidSupply',ids:[e.id],target:target.id});
  // The previous engine admitted this competing state into saves; resume it through the real runtime.
  e.tactics!.retreat={x:10.5,y:10.5,until:0};e.tactics!.morale=50;const recorder=record(s);run(s,.05);
  expect(e.tactics!.retreat).toBeUndefined();expect(task(s,e)).toBeUndefined();expect(e.order).toEqual({type:'hold'});continueAndReplay(s,recorder,.2);
 });
 it.each(['ambush','capture','retreat'] as const)('an accepted raid clears competing %s state, but a failed raid keeps it',mode=>{
  const s=fixture('orcs'),e=unit(s,'melee'),target=warehouse(s);
  refreshVisibility(s);if(mode==='ambush'){s.terrain[20*s.width+20]='forest';command(s,{type:'ambush',ids:[e.id],radius:3,target:'any'});}
  else if(mode==='capture'){const engine=unit(s,'siege',e.x+1,e.y,1);engine.tactics!.siegeCrew!.uncrewed=true;engine.tactics!.siegeCrew!.hp=0;command(s,{type:'captureSiege',ids:[e.id],target:engine.id});}
  else e.tactics!.retreat={x:10.5,y:10.5,until:8};
  refreshVisibility(s);const before=saveGame(s);expect(issueCommand(s,0,{type:'raidSupply',ids:[e.id],target:999999})).toBe(false);expect(saveGame(s)).toEqual(before);
  refreshVisibility(s);command(s,{type:'raidSupply',ids:[e.id],target:target.id});expect(e.tactics![mode]).toBeUndefined();expect(task(s,e)).toMatchObject({kind:'raid'});expect(e.order).toEqual({type:'hold'});
 });
 it('a paid faction structure drops its recorded salvage once through combat death',()=>{
  const s=fixture('undead'),worker=unit(s,'worker'),attacker=unit(s,'siege',32.5,20.5,1),recorder=record(s);
  command(s,{type:'buildFactionStructure',ids:[worker.id],structure:'necropolis',x:24.5,y:20.5});run(s,31);
  const building=s.entities.find(e=>e.definitionId===FACTION_STRUCTURE_INFO.necropolis.definition.id)!;
  recorder.dispose();building.hp=1;attacker.cooldown=0;const deathRecorder=record(s);
  command(s,{type:'attack',ids:[attacker.id],target:building.id},1);continueAndReplay(s,deathRecorder,2);
  expect(building.hp).toBe(0);expect(s.economy!.deathClaims.filter(id=>id===building.id)).toHaveLength(1);
  const drops=s.economy!.salvage.filter(item=>item.kind==='salvage');expect(drops).toHaveLength(1);expect(drops[0].stock).toEqual({wood:30,ore:12.5,crystal:6.25});
  run(s,1);expect(s.economy!.salvage.filter(item=>item.kind==='salvage')).toHaveLength(1);expect(s.economy!.paidCosts.some(item=>item.entityId===building.id)).toBe(false);
 });
});
