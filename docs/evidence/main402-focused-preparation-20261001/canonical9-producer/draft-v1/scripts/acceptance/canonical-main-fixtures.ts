import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTIONS } from '../../src/core/content';
import { environmentPhase } from '../../src/core/environment';
import { initializeFactionSystems } from '../../src/core/faction-systems';
import { MatchRecorder } from '../../src/core/replays';
import { SAVE_VERSION, saveGame } from '../../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition } from '../../src/core/simulation';
import { canAmbush, initializeTactics, TACTICS } from '../../src/core/tactics';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { generateWorldMap, validateWorldMap } from '../../src/core/world-map';
import type { FormationKind } from '../../src/core/tactics';
import type { BuildingRole, BuiltinFactionId, Entity, GameState, Side, UnitRole } from '../../src/core/types';

/** Setup only. Never advances the simulation; a recorder starts after all authoring. */
export function buildCanonicalMainFixtures(outDirectory:string,sourceCommit:string) {
 assert.match(sourceCommit,/^[0-9a-f]{40}$/);assert.equal(SAVE_VERSION,4);assert.equal(SIMULATION_REVISION,'4.0.2');
 const out=resolve(outDirectory);assert(outDirectory&&!existsSync(out),'Use a new fixture directory');mkdirSync(out,{recursive:true});
 const scenarios:Record<string,any>={};
 const place=(e:Entity,x:number,y:number,level=0,cooldown=1000)=>{
  Object.assign(e,{x,y,level,cooldown,order:{type:'hold'},path:[],facing:4,animation:'idle',animTime:0,momentum:0});delete e.orderQueue;return e;
 };
 function base(faction:BuiltinFactionId,opponent:BuiltinFactionId='orcs') {
  const map=generateWorldMap(0,'medium',2,'forest'),removedSites=structuredClone(map.sites);
  for(const layer of map.levels){layer.terrain.fill('grass');layer.elevation.fill(0);}map.sites=[];
  assert(validateWorldMap(map).valid,'Flattened authored input retains valid resources, starts and entrances');
  const s=createMatch({map:{seed:map.seed,size:map.size,world:map,biome:'forest'},rules:{startingAge:3,friendlyFire:false},players:[
   {id:0,teamId:0,factionId:faction,controller:'human',handicap:{startingResources:{wood:2000,ore:2000,crystal:500}}},
   {id:1,teamId:1,factionId:opponent,controller:'external'}]});
  const removedActors=s.entities.filter(e=>e.kind==='unit'&&e.role!=='worker').map(e=>({id:e.id,role:e.role,side:e.side,definitionId:e.definitionId}));
  const removedResources=s.resources.map(r=>({id:r.id,kind:r.kind,x:r.x,y:r.y,level:r.level??0,amount:r.amount}));
  s.entities=s.entities.filter(e=>e.role==='hq'||e.kind==='unit'&&e.role==='worker');s.resources=[];
  Object.assign(s.world!,{dayLength:1_000_000,seasonLength:1_000_000,weatherLength:1_000_000,bridges:[],fires:[],iceTiles:[]});
  for(const side of [0,1] as Side[]){
   const hq=s.entities.find(e=>e.side===side&&e.role==='hq')!;place(hq,side?42.5:6.5,side?42.5:17.5);s.starts[side]={x:hq.x,y:hq.y,level:0};
   s.entities.filter(e=>e.side===side&&e.role==='worker').forEach((e,i)=>place(e,side?39.5+i*.8:5.5+i*.8,side?39.5:13.5));
  }
  const workers=s.entities.filter(e=>e.side===0&&e.role==='worker'),underground=workers.at(-1)!;place(underground,10.5,10.5,1);
  initializeFactionSystems(s);assert.equal(environmentPhase(s).weather,'clear');assert.equal(environmentPhase(s).day,'day');
  return {s,workers,underground:underground.id,setup:{removedSites,removedActors,removedResources,retainedEntrances:structuredClone(s.world!.transitions)}};
 }
 function unit(s:GameState,side:Side,role:UnitRole,x:number,y:number,cooldown=1000){
  const e=place(spawnDefinition(s,side,'unit',FACTIONS[s.players[side].faction].units[role].id,x,y),x,y,0,cooldown);initializeTactics(s,e);return e;
 }
 const building=(s:GameState,side:Side,role:BuildingRole,x:number,y:number)=>place(spawnDefinition(s,side,'building',FACTIONS[s.players[side].faction].buildings[role].id,x,y),x,y);
 function write(name:string,s:GameState,ids:Record<string,unknown>,authored:Record<string,unknown>){
  s.events=[];refreshVisibility(s);assert.equal(s.tick,0);assert.equal(s.time,0);
  const recorder=new MatchRecorder(s);let file:ReturnType<typeof createSessionFile>;try{file=createSessionFile(s,recorder.export());}finally{recorder.dispose();}
  const decoded=decodeSessionFile(file);assert.deepEqual(saveGame(decoded.state),file.game);assert.deepEqual(decoded.file,file);
  assert.equal(file.replay!.simulationRevision,SIMULATION_REVISION);assert.equal(file.replay!.checksumVersion,4);assert.equal(file.replay!.actions.length,0);assert.equal(file.replay!.finalTick,0);
  assert(decoded.state.entities.some(e=>e.side===0&&e.level===1));
  const bytes=Buffer.from(`${JSON.stringify(file,null,2)}\n`);writeFileSync(resolve(out,`${name}.json`),bytes,{flag:'wx'});
  scenarios[name]={file:`${name}.json`,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,ids,initialTick:0,initialTime:0,faction:s.players[0].faction,authored:{
   map:'Validated seed-zero medium forest input, flat grass/elevation, generated entrances retained; resources and opening combat troops removed before recording.',
   calendar:'Clear daylight, day/season/weather lengths 1000000 seconds.',
   banks:'Side0 starts at age3 with 2000 wood,2000 ore,500 crystal.',
   passiveOrders:'HQs/workers and non-firing targets use hold and cooldown1000; encounter exceptions are listed below.',
   ...authored,actors:s.entities.map(e=>({id:e.id,side:e.side,kind:e.kind,role:e.role,definitionId:e.definitionId,definitionFaction:e.definitionFaction,x:e.x,y:e.y,level:e.level??0,hp:e.hp,maxHp:e.maxHp,cooldown:e.cooldown,facing:e.facing,order:structuredClone(e.order),tactics:structuredClone(e.tactics)}))}};
 }
 for(const kind of ['line','wedge','square','loose'] as FormationKind[]){
  const {s,underground,setup}=base('orcs','fairies'),roles:UnitRole[]=['melee','ranged','spear','cavalry','melee','ranged'];
  const army=roles.map((role,i)=>unit(s,0,role,18.5+i*.7,20.5)),obstacle=building(s,0,'depot',24.5,20.5);
  write(`formation-${kind}`,s,{army:army.map(e=>e.id),roles,obstacle:obstacle.id,undergroundWorker:underground,formation:kind,spacing:.8,facing:0,destination:{x:30.5,y:20.5,level:0}},
   {...setup,description:'Six full-health mixed troops apply the requested shape and move around an owned depot. No wounded victim or hostile casualty order.'});
 }
 for(const direction of ['front','rear']){
  const {s,underground,setup}=base('fairies'),source=unit(s,0,'cavalry',19.5,24.5,0),target=unit(s,1,'spear',26,24.5);
  source.facing=0;target.facing=direction==='front'?4:0;
  write(`charge-pike-${direction}`,s,{source:source.id,target:target.id,undergroundWorker:underground,direction},
   {...setup,description:'Normal Stag Rider attacks a full-health held Pikejaw. Front/rear differs only in Pikejaw facing.',targetFacing:target.facing,targetOrder:'hold',targetCooldown:1000,sourceCooldown:0});
 }
 {
  const {s,workers,underground,setup}=base('fairies'),captor=unit(s,0,'melee',18.4,20.5,0),engine=unit(s,1,'siege',20.5,20.5),target=building(s,1,'depot',37.5,20.5);
  place(workers[0],35.5,23.5);assert.deepEqual(engine.tactics!.siegeCrew,{hp:42,maxHp:42,uncrewed:false});assert.equal(engine.hp,engine.maxHp);
  write('siege-full-crew-capture',s,{captor:captor.id,engine:engine.id,target:target.id,observer:workers[0].id,undergroundWorker:underground,moveDestination:{x:26.5,y:20.5,level:0}},
   {...setup,description:'Native Thornblade attacks full crew, captures the engine, then moves and fires it for its new owner.',engineCrewHealth:TACTICS.crewHp,engineHullHealth:engine.hp,engineDefinitionId:engine.definitionId,targetHealth:target.hp,engineCooldown:1000,captorCooldown:0,
    combatSuppression:'Hostile engine starts at cooldown1000; crew/hull retain production full health. Hostile workers are outside capture contest range.'});
 }
 {
  const {s,underground,setup}=base('fairies'),dryTroop=unit(s,0,'melee',8.5,13.5),ambusher=unit(s,0,'ranged',20.5,20.5,6),wrongTarget=unit(s,1,'worker',22,20.5),trigger=unit(s,1,'melee',40.5,40.5);
  const timber={id:s.nextId++,kind:'wood' as const,x:20.5,y:21.5,level:0,amount:100,maxAmount:100};s.resources.push(timber);
  refreshVisibility(s);assert(issueCommand(s,1,{type:'move',ids:[trigger.id],x:21.8,y:20.5,level:0}));assert(canAmbush(s,ambusher));assert(!canAmbush(s,dryTroop));
  write('ambush-selected-trigger',s,{ambusher:ambusher.id,dryTroop:dryTroop.id,wrongTarget:wrongTarget.id,trigger:trigger.id,timber:timber.id,undergroundWorker:underground},
   {...setup,description:'Standing timber enables the Mothbow; dry troop cannot ambush. Wrong-role worker starts inside radius. Full-health melee has an initial authored march.',radius:2,target:'melee',ambusherCooldown:6,timberAmount:100,wrongTargetHealth:wrongTarget.hp,triggerHealth:trigger.hp,
    exceptionalInitialOrder:{actor:trigger.id,order:structuredClone(trigger.order)},initialOrders:'The hostile move is accepted before the recorder exists. No opponent command is injected after import.'});
 }
 {
  const {s,underground,setup}=base('fairies'),siege=Array.from({length:7},(_,i)=>unit(s,0,'siege',20.5,21.5+i,0));
  const primary=unit(s,1,'cavalry',25.5,24.5),support=unit(s,1,'cavalry',25.5,25.2),ranged=[[24.8,24.5],[26.2,24.5],[24.8,25.2],[26.2,25.2]].map(([x,y])=>unit(s,1,'ranged',x,y));
  for(const e of [primary,support,...ranged]){assert.equal(e.hp,e.maxHp);assert.equal(e.tactics!.morale,100);assert.equal(e.tactics!.recentLoss,0);assert.equal(e.cooldown,1000);}
  assert.equal(primary.maxHp,210);assert.equal(support.maxHp,210);assert(ranged.every(e=>e.maxHp===100));
  for(const e of siege){assert.equal(e.hp,e.maxHp);assert.deepEqual(e.tactics!.siegeCrew,{hp:42,maxHp:42,uncrewed:false});assert.equal(e.factionState?.artillery,undefined);}
  write('morale-supported-full-fight',s,{siege:siege.map(e=>e.id),primary:primary.id,support:support.id,ranged:ranged.map(e=>e.id),squad:[primary.id,support.id,...ranged.map(e=>e.id)],undergroundWorker:underground},
   {...setup,description:'Seven ordinary Fairy engines attack a full-health, morale100 supported Orc squad. Actual wounds and nearby combat deaths must lead to a surviving supported cavalry retreat.',squadHealth:'Normal maximum health, cavalry210 and ranged100; no authored wounds.',squadMorale:100,squadRecentLoss:0,squadCooldown:1000,attackerCooldown:0,
    combatSuppression:'Targets begin at cooldown1000 to prevent return fire. No morale/health edits, hit injection, artillery modification or cooldown reset follows recording.',predictedOutcome:'One volley may kill four ranged allies and leave both cavalry wounded, alive and close enough to support each other. This is an unexecuted prediction, not a generated result.'});
 }
 const manifest={schema:1,sourceCommit,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,setup:'Nine bounded canonical-main encounters. Complete authoring precedes a zero-action/zero-tick current-rule recorder; native UI and ordinary ticks produce every later result.',scenarios};
 writeFileSync(resolve(out,'canonical-main-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx'});return manifest;
}
