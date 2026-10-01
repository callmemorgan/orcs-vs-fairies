import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { contentHash, createContentBundle, unitFor } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import type { BuiltinFactionId, Entity, GameState, Side } from '../src/core/types';

function match(origin:BuiltinFactionId='dwarves',captor:BuiltinFactionId='tideborn') {
 const s=createMatch({map:{seed:4127,size:'medium'},rules:{startingAge:2},players:[
  {id:0,teamId:0,factionId:origin,controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:5000}}},
  {id:1,teamId:1,factionId:captor,controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:5000}}}
 ]});
 s.terrain.fill('grass');
 for(const e of s.entities){e.order={type:'hold'};e.cooldown=100;}
 return s;
}
function hero(s:GameState,side:Side,x=24.5,y=24.5) {
 const e=spawnDefinition(s,side,'unit',`core:${s.players[side].faction}-commander`,x,y);e.order={type:'hold'};e.cooldown=100;return e;
}
function surround(s:GameState,victim:Entity,side:Side=1) {
 for(const [dx,dy] of [[-1.2,0],[1.2,0],[0,1.2]]){
  const e=spawnDefinition(s,side,'unit',FACTIONS[s.players[side].faction].units.melee.id,victim.x+dx,victim.y+dy);e.order={type:'hold'};e.cooldown=100;
 }
 victim.tactics!.morale=0;refreshVisibility(s);
}
function hall(s:GameState,side:Side=1) {
 const start=s.starts[side];return spawnDefinition(s,side,'building',FACTIONS[s.players[side].faction].buildings.barracks.id,start.x+6,start.y);
}
function kill(s:GameState,victim:Entity) {
 const side=(victim.side===0?1:0) as Side,killer=spawnDefinition(s,side,'unit',unitFor(s,side,'ranged').id,victim.x+3,victim.y);
 victim.hp=1;victim.tactics!.morale=100;refreshVisibility(s);
 expect(issueCommand(s,side,{type:'attack',ids:[killer.id],target:victim.id})).toBe(true);
 for(let i=0;i<20&&victim.hp>0;i++)stepGame(s,.05);
 expect(victim.hp).toBe(0);return killer;
}
function roundTrip(s:GameState) {
 const saved=saveGame(s),restored=loadGame(saved);expect(saveGame(restored)).toEqual(saved);return restored;
}
function importedHero(role:'ranged'|'siege') {
 const pkg=structuredClone(exampleMod()),captain={...FACTIONS.fairies.units[role],id:'lantern:captain',tags:['hero'] as ('hero')[],age:2 as const};
 pkg.factions[0].units.push(captain);pkg.art[captain.id]={...pkg.art['lantern:duelist'],path:'/mods/lantern/captain.svg'};const {hash:_,...body}=pkg;pkg.hash=contentHash(body);
 const s=createMatch({map:{seed:4127,size:'small'},rules:{startingAge:2},content:createContentBundle([pkg]),players:[
  {id:0,teamId:0,factionId:'lantern:keepers',controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:5000}}},
  {id:1,teamId:1,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:5000}}}
 ]});s.terrain.fill('grass');for(const e of s.entities){e.order={type:'hold'};e.cooldown=100;}return {s,captain};
}

describe('commander ownership admission',()=>{
 it.each([
  {size:'medium',tick:8795,own:154,enemy:160},
  {size:'large',tick:12852,own:211,enemy:258}
 ])('keeps the commander slot valid after the natural $size failed-case checkpoint',({size,tick,own,enemy})=>{
  // Captured from ordinary seed4127 AI games at af44da4, with no injected orders/resources.
  const s=loadGame(readFileSync(new URL(`./fixtures/commander-surrender-${size}-save4.json`,import.meta.url),'utf8'));
  expect(s.tick).toBe(tick);expect(s.entities.find(e=>e.id===enemy)?.side).toBe(1);expect(s.entities.find(e=>e.id===own)?.side).toBe(0);
  stepGame(s,.05);
  expect(s.entities.find(e=>e.id===enemy)?.side).toBe(1);
  expect(s.events.some(e=>e.source===enemy&&e.text==='A surrounded unit surrendered')).toBe(false);
  const restored=roundTrip(s);
  for(let i=0;i<20;i++){stepGame(s,.05);stepGame(restored,.05);expect(saveGame(restored)).toEqual(saveGame(s));}
 });
 it.each(['living','queued','recovering'] as const)('blocks commander capture when the captor has a %s commander',condition=>{
  const s=match(),victim=hero(s,0),producer=hall(s);
  if(condition==='living')hero(s,1,40.5,12.5);
  if(condition==='queued')expect(issueCommand(s,1,{type:'train',id:producer.id,role:'special',definitionId:'core:tideborn-commander'})).toBe(true);
  if(condition==='recovering'){const native=hero(s,1,40.5,12.5);kill(s,native);expect(s.players[1].heroRecovery![0].availableAt).toBeCloseTo(s.time+30);}
  surround(s,victim);stepGame(s,.05);
  expect(victim.side).toBe(0);expect(victim.tactics!.surrenderedTo).toBeUndefined();roundTrip(s);
 });
 it('admits a foreign commander into an empty slot, blocks recruitment, then saves its death without an unavailable recovery ID',()=>{
  const s=match(),victim=hero(s,0),producer=hall(s);surround(s,victim);stepGame(s,.05);
  expect(victim.side).toBe(1);expect(victim.definitionFaction).toBe('dwarves');expect(victim.tactics!.surrenderedTo).toBe(1);
  const restored=roundTrip(s),captured=restored.entities.find(e=>e.id===victim.id)!;
  expect(issueCommand(restored,1,{type:'train',id:producer.id,role:'special',definitionId:'core:tideborn-commander'})).toBe(false);
  kill(restored,captured);expect(restored.players[1].heroRecovery).toBeUndefined();roundTrip(restored);
  expect(issueCommand(restored,1,{type:'train',id:producer.id,role:'special',definitionId:'core:tideborn-commander'})).toBe(true);roundTrip(restored);
 });
 it('keeps the existing death recovery for a captured same-faction commander',()=>{
  const s=match('dwarves','dwarves'),victim=hero(s,0),producer=hall(s);surround(s,victim);stepGame(s,.05);
  expect(victim.side).toBe(1);const restored=roundTrip(s),captured=restored.entities.find(e=>e.id===victim.id)!;kill(restored,captured);
  const availableAt=restored.players[1].heroRecovery![0].availableAt;
  expect(availableAt).toBeCloseTo(restored.time+30);expect(restored.players[1].heroRecovery![0].definitionId).toBe('core:dwarves-commander');
  expect(issueCommand(restored,1,{type:'train',id:producer.id,role:'special',definitionId:'core:dwarves-commander'})).toBe(false);roundTrip(restored);
  while(restored.time+1e-9<availableAt)stepGame(restored,Math.min(.25,availableAt-restored.time));
  expect(issueCommand(restored,1,{type:'train',id:producer.id,role:'special',definitionId:'core:dwarves-commander'})).toBe(true);roundTrip(restored);
 });
 it('does not admit a different imported hero while another recruitable commander is recovering',()=>{
  const {s,captain}=importedHero('ranged');
  const native=spawnDefinition(s,0,'unit','core:fairies-commander',24.5,24.5);kill(s,native);
  const producer=spawnDefinition(s,0,'building','lantern:hall',12.5,12.5);
  expect(unitFor(s,0,'ranged',captain.id).tags).toContain('hero');
  expect(issueCommand(s,0,{type:'train',id:producer.id,role:'ranged',definitionId:captain.id})).toBe(false);roundTrip(s);
 });
 it.each(['living','queued','recovering','queued-during-channel','empty'] as const)('applies the commander slot to public capture of an imported siege hero (%s)',condition=>{
  const {s,captain}=importedHero('siege'),engine=spawnDefinition(s,0,'unit',captain.id,24.5,24.5),captor=spawnDefinition(s,1,'unit',unitFor(s,1,'melee').id,23.3,24.5),producer=hall(s);
  engine.order={type:'hold'};engine.cooldown=100;engine.tactics!.siegeCrew!.hp=1;refreshVisibility(s);
  expect(issueCommand(s,1,{type:'attack',ids:[captor.id],target:engine.id})).toBe(true);stepGame(s,.05);expect(engine.tactics!.siegeCrew!.uncrewed).toBe(true);
  expect(issueCommand(s,1,{type:'hold',ids:[captor.id]})).toBe(true);
  if(condition==='living')hero(s,1,12.5,12.5);
  if(condition==='queued')expect(issueCommand(s,1,{type:'train',id:producer.id,role:'special',definitionId:'core:orcs-commander'})).toBe(true);
  if(condition==='recovering')kill(s,hero(s,1,12.5,12.5));
  const admitted=condition==='empty'||condition==='queued-during-channel';
  expect(issueCommand(s,1,{type:'captureSiege',ids:[captor.id],target:engine.id})).toBe(admitted);
  if(condition==='queued-during-channel'){
   for(let i=0;i<20;i++)stepGame(s,.05);
   expect(captor.tactics!.capture!.progress).toBeGreaterThan(0);
   expect(issueCommand(s,1,{type:'train',id:producer.id,role:'special',definitionId:'core:orcs-commander'})).toBe(true);
  }
  for(let i=0;i<85;i++)stepGame(s,.05);
  expect(engine.side).toBe(condition==='empty'?1:0);roundTrip(s);
 });
 it('allows the owner to re-crew its imported siege commander without consuming another commander slot',()=>{
  const {s,captain}=importedHero('siege'),engine=spawnDefinition(s,0,'unit',captain.id,24.5,24.5),captor=spawnDefinition(s,0,'unit',unitFor(s,0,'melee').id,23.3,24.5);
  engine.tactics!.siegeCrew!.hp=0;engine.tactics!.siegeCrew!.uncrewed=true;engine.cooldown=100;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'captureSiege',ids:[captor.id],target:engine.id})).toBe(true);
  for(let i=0;i<85;i++)stepGame(s,.05);
  expect(engine.side).toBe(0);expect(engine.tactics!.siegeCrew!.uncrewed).toBe(false);roundTrip(s);
 });
});
