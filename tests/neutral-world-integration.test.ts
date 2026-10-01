import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FACTIONS } from '../src/core/content';
import { issueNeutralWorldCommand, NEUTRAL_RULES, relicBonus } from '../src/core/neutral-world';
import { loadGame, saveGame } from '../src/core/saves';
import { createGame, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { Cost, Entity, GameState, Side } from '../src/core/types';
import type { WorldSite } from '../src/core/world-types';

const evidence:Record<string,unknown>={};
afterAll(()=>{
 const output=process.env.NEUTRAL_PROOF_OUTPUT;
 if(output&&Object.keys(evidence).length===5){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({features:[47,48,49],runner:'normal createGame/issueCommand/stepGame/saveGame/loadGame',scenarios:evidence},null,2)+'\n');}
});

function scenario(kind:WorldSite['kind'],level=0) {
 const map=generateWorldMap(4127,'small',2,'temperate');for(const layer of map.levels){layer.terrain.fill('grass');layer.elevation.fill(0);}
 const center={x:map.width/2+.5,y:map.height/2+.5,level};map.sites=[{...center,id:1,kind}];
 const state=createGame('orcs',map.seed,'orcs',{controllers:['external','external'],world:map});
 expect(state.world).toBeDefined();state.resources=[];
 const site=state.world!.sites[0],unit=state.entities.find(e=>e.side===0&&e.role==='melee')!;
 unit.x=site.x-2;unit.y=site.y;unit.level=level;refreshVisibility(state);return {state,site,unit};
}
function recruitFixtureUnit(s:GameState,side:Side,x:number,y:number,level=0):Entity {
 const template=s.entities.find(e=>e.kind==='unit'&&e.role==='melee')!;
 const entity:Entity={...structuredClone(template),id:s.nextId++,side,x,y,level,hp:FACTIONS.orcs.units.melee.hp,maxHp:FACTIONS.orcs.units.melee.hp,path:[],order:{type:'idle'},cooldown:0};
 s.entities.push(entity);return entity;
}
function advance(state:GameState,ticks:number) {for(let tick=0;tick<ticks;tick++)stepGame(state,.05);}
function resources(state:GameState,equipment:Cost[]=[]) {
 return Object.fromEntries((['wood','ore','crystal'] as const).map(kind=>[kind,state.players.reduce((total,p)=>total+p[kind],0)+state.world!.sites.reduce((total,s)=>total+s.reward[kind],0)+equipment.reduce((total,cost)=>total+cost[kind],0)]));
}

describe('neutral features through normal match commands, ticks and checkpoints',()=>{
 it('completes a real den battle and resumes every subsequent tick with identical HP, reward and AI state',()=>{
  const {state,site,unit}=scenario('monster'),second=recruitFixtureUnit(state,0,unit.x,unit.y+1),third=recruitFixtureUnit(state,0,unit.x,unit.y-1),initial=resources(state);
  refreshVisibility(state);expect(issueCommand(state,0,{type:'worldAttack',ids:[unit.id,second.id,third.id],target:site.id})).toBe(true);
  advance(state,30);expect(state.world!.creatures.some(creature=>creature.hp<creature.maxHp)).toBe(true);
  const restored=loadGame(JSON.stringify(saveGame(state)));expect(saveGame(restored)).toEqual(saveGame(state));
  for(let tick=0;tick<400;tick++){stepGame(state,.05);stepGame(restored,.05);expect(saveGame(restored)).toEqual(saveGame(state));}
  expect(site.rewarded).toEqual([0]);expect(site.reward).toEqual({wood:0,ore:0,crystal:0});expect(state.world!.creatures.every(c=>c.hp===0)).toBe(true);
  expect(resources(state)).toEqual(initial);expect(state.players).toHaveLength(2);
  evidence.den={tick:state.tick,time:state.time,creatures:state.world!.creatures.map(c=>({id:c.id,hp:c.hp,maxHp:c.maxHp,respawnAt:c.respawnAt})),rewarded:[...site.rewarded],reward:{...site.reward},resourcesBefore:initial,resourcesAfter:resources(state),identicalResumedTicks:400};
 },20_000);
 it('delivers a request, collects finite local supplies and recruits actual player units through normal controls',()=>{
  const {state,site,unit}=scenario('village'),initial=resources(state),beforeBank=state.players[0].wood;
  expect(issueCommand(state,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(true);advance(state,1);
  expect(site.owner).toBe(0);expect(site.loyalty[0]).toBe(60);expect(state.players[0].wood).toBe(beforeBank-site.request.wood);expect(resources(state)).toEqual(initial);
  expect(issueCommand(state,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(true);advance(state,1);
  expect(state.players[0].wood).toBe(beforeBank-site.request.wood+NEUTRAL_RULES.supplyBundle.wood);expect(resources(state)).toEqual(initial);
  const before=state.entities.length;expect(issueCommand(state,0,{type:'recruitVillage',ids:[unit.id],target:site.id})).toBe(true);advance(state,1);
  const joined=state.entities.slice(before);expect(joined).toHaveLength(1);expect(joined[0].side).toBe(0);expect(joined[0].role).toBe('melee');expect(joined[0].hp).toBe(FACTIONS.orcs.units.melee.hp);
  expect(resources(state,[FACTIONS.orcs.units.melee.cost])).toEqual(initial);
  const checkpoint=saveGame(state),loaded=loadGame(checkpoint);expect(saveGame(loaded)).toEqual(checkpoint);
  const loadedRepeatedSupplyAccepted=issueCommand(loaded,0,{type:'supportVillage',ids:[unit.id],target:site.id});expect(loadedRepeatedSupplyAccepted).toBe(false);
  evidence.village={tick:state.tick,owner:site.owner,loyalty:[...site.loyalty],suppliesClaimed:[...site.rewarded],stock:{...site.reward},request:{...site.request},recruits:joined.map(e=>({id:e.id,side:e.side,role:e.role,hp:e.hp,level:e.level})),resourcesBefore:initial,resourcesAfterWithEquipment:resources(state,[FACTIONS.orcs.units.melee.cost]),loadedRepeatedSupplyAccepted};
 });
 it('fights local defenders and removes village services after a hostile raid without creating resources',()=>{
  const {state,site,unit}=scenario('village');expect(issueCommand(state,0,{type:'supportVillage',ids:[unit.id],target:site.id})).toBe(true);advance(state,1);
  unit.x=site.x-12;const army=[0,1,2].map(i=>recruitFixtureUnit(state,1,site.x+2,site.y+i-1)),initial=resources(state);refreshVisibility(state);
  expect(issueCommand(state,1,{type:'worldAttack',ids:army.map(e=>e.id),target:site.id})).toBe(true);
  for(let tick=0;tick<1200&&Object.values(site.reward).some(value=>value>0);tick++)stepGame(state,.05);
  expect(site.owner).toBe(null);expect(site.loyalty[0]).toBeLessThan(60);expect(site.reward).toEqual({wood:0,ore:0,crystal:0});expect(resources(state)).toEqual(initial);
  expect(army.some(e=>e.hp<e.maxHp)).toBe(true);expect(issueCommand(state,0,{type:'recruitVillage',ids:[unit.id],target:site.id})).toBe(false);
  evidence.raid={tick:state.tick,owner:site.owner,loyalty:[...site.loyalty],stock:{...site.reward},raiderHp:army.map(e=>({id:e.id,hp:e.hp,maxHp:e.maxHp})),resourcesBefore:initial,resourcesAfter:resources(state)};
 });
 it('captures a cavern relic, changes ordinary combat damage and loses the bonus after enemy recapture',()=>{
  const {state,site,unit}=scenario('relic',1);expect(issueCommand(state,0,{type:'captureSite',ids:[unit.id],target:site.id})).toBe(true);advance(state,205);
  expect(site.owner).toBe(0);expect(relicBonus(state,0,unit)).toBe(NEUTRAL_RULES.relicDamageBonus);
  const defender=recruitFixtureUnit(state,1,unit.x+1.2,unit.y,1);
  expect(issueCommand(state,1,{type:'face',ids:[defender.id],facing:4})).toBe(true);refreshVisibility(state);
  const baseline=loadGame(saveGame(state));baseline.world!.sites[0].owner=null;
  expect(issueCommand(state,0,{type:'attack',ids:[unit.id],target:defender.id})).toBe(true);expect(issueCommand(baseline,0,{type:'attack',ids:[unit.id],target:defender.id})).toBe(true);
  stepGame(state,.05);stepGame(baseline,.05);
  const ordinary=baseline.entities.find(e=>e.id===defender.id)!;expect(defender.hp).toBeLessThan(ordinary.hp);
  expect(ordinary.maxHp-ordinary.hp).toBeCloseTo(FACTIONS.orcs.units.melee.damage-FACTIONS.orcs.units.melee.armor);
  expect(defender.maxHp-defender.hp).toBeCloseTo(FACTIONS.orcs.units.melee.damage*(1+NEUTRAL_RULES.relicDamageBonus)-FACTIONS.orcs.units.melee.armor);
  const damage={ordinary:ordinary.maxHp-ordinary.hp,withRelic:defender.maxHp-defender.hp};
  expect(issueCommand(state,0,{type:'move',ids:[unit.id],x:site.x-10,y:site.y,level:1})).toBe(true);
  expect(issueCommand(state,1,{type:'captureSite',ids:[defender.id],target:site.id})).toBe(true);advance(state,360);
  expect(site.owner).toBe(1);expect(relicBonus(state,0,site)).toBe(0);expect(relicBonus(state,1,site)).toBe(NEUTRAL_RULES.relicDamageBonus);
  evidence.relic={tick:state.tick,level:site.level,ownerAfterRecapture:site.owner,damage,previousOwnerBonus:relicBonus(state,0,site),newOwnerBonus:relicBonus(state,1,site)};
 });
 it('rejects queued, foreign, hidden and wrong-level neutral commands through the public command boundary',()=>{
  const {state,site,unit}=scenario('village'),foreign=state.entities.find(e=>e.side===1&&e.kind==='unit')!;
  const queued=issueCommand(state,0,{type:'supportVillage',ids:[unit.id],target:site.id,queued:true});expect(queued).toBe(false);
  const foreignActor=issueCommand(state,0,{type:'supportVillage',ids:[unit.id,foreign.id],target:site.id});expect(foreignActor).toBe(false);
  unit.level=1;const wrongLevel=issueCommand(state,0,{type:'supportVillage',ids:[unit.id],target:site.id});expect(wrongLevel).toBe(false);unit.level=0;
  state.visible[0].clear();const hiddenTarget=issueCommand(state,0,{type:'supportVillage',ids:[unit.id],target:site.id});expect(hiddenTarget).toBe(false);
  const otherSystemCommand=issueNeutralWorldCommand(state,0,{type:'ignite',ids:[unit.id],x:site.x,y:site.y});expect(otherSystemCommand).toBeUndefined();
  evidence.commands={queuedRejected:!queued,foreignActorRejected:!foreignActor,wrongLevelRejected:!wrongLevel,hiddenTargetRejected:!hiddenTarget,otherSystemCommandDelegated:otherSystemCommand===undefined};
 });
});
