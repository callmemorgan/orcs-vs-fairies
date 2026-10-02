import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FACTIONS } from '../src/core/content';
import { NEUTRAL_RULES, relicBonus } from '../src/core/neutral-world';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { RUIN_PILLAR_RADIUS, ruinGeometry } from '../src/core/ruins';
import { loadGame, saveGame } from '../src/core/saves';
import { createSessionFile } from '../src/core/session-storage';
import { createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { initializeTactics } from '../src/core/tactics';
import { SIMULATION_REVISION } from '../src/core/versions';
import { generateWorldMap, validateWorldMap } from '../src/core/world-map';
import type { Entity, GameState, Side, UnitRole } from '../src/core/types';
import type { WorldPoint } from '../src/core/world-types';

const lane:WorldPoint={x:23.5,y:24.5,level:1};
const observations:Record<string,unknown>={};
const downloads:Record<string,unknown>={};
afterAll(()=>{
 const output=process.env.RUIN_COVER_PROOF_DIR;
 if(!output)return;
 mkdirSync(output,{recursive:true});
 writeFileSync(join(output,'observations.json'),JSON.stringify({simulationRevision:SIMULATION_REVISION,runner:'createMatch/issueCommand/stepGame/saveGame/loadGame/MatchRecorder/ReplayPlayer',observations},null,2)+'\n');
 for(const [name,value] of Object.entries(downloads))writeFileSync(join(output,name),JSON.stringify(value,null,2)+'\n');
});

function unit(s:GameState,side:Side,role:UnitRole,point:WorldPoint):Entity {
 const d=FACTIONS.orcs.units[role],e:Entity={id:s.nextId++,side,kind:'unit',role,...point,hp:d.hp,maxHp:d.hp,order:{type:'hold'},cooldown:100,progress:1,queue:[],trainProgress:0,researchProgress:0,facing:4,animation:'idle',animTime:0,momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[]};
 initializeTactics(s,e);s.entities.push(e);return e;
}
function fixture(points:WorldPoint[]=[],options:{reverse?:boolean;melee?:boolean;building?:boolean;owner?:Side;siteOrder?:number[]}={}) {
 const map=generateWorldMap(4127,'small',2,'temperate');
 for(const level of map.levels){level.terrain.fill('grass');level.elevation.fill(0);}
 map.sites=points.map((point,i)=>({...point,id:i+1,kind:'relic'}));
 if(options.siteOrder)map.sites=options.siteOrder.map(i=>map.sites[i]);
 expect(validateWorldMap(map)).toEqual({valid:true,issues:[]});
 const s=createMatch({map:{seed:map.seed,size:map.size,biome:'temperate',world:map},players:[{id:0,teamId:0,factionId:'orcs',controller:'external'},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
 s.resources=[];s.entities=s.entities.filter(e=>e.kind==='building');
 for(const hq of s.entities){hq.x=hq.side?31.5:5.5;hq.y=hq.side?31.5:5.5;s.starts[hq.side]={x:hq.x,y:hq.y,level:0};}
 const source=unit(s,0,options.melee?'spear':'ranged',{x:options.melee?24:options.reverse?25.5:20.5,y:24.5,level:1});
 const target=unit(s,1,'melee',{x:options.reverse?20.5:25.5,y:24.5,level:1});
 source.cooldown=0;target.facing=options.reverse?0:4;
 if(options.owner!==undefined)for(const site of s.world!.sites)site.owner=options.owner;
 if(options.building){const template=s.entities[0],d=FACTIONS.orcs.buildings.depot;s.entities.push({...structuredClone(template),id:s.nextId++,side:1,role:'depot',...lane,hp:d.hp,maxHp:d.hp});}
 refreshVisibility(s);
 const initial=saveGame(s);expect(saveGame(loadGame(initial))).toEqual(initial);
 return {s,source,target,map,initial};
}
function firstHit(name:string,f:ReturnType<typeof fixture>,keepHistory=false) {
 const {s,source,target}=f,hp=target.hp,recorder=new MatchRecorder(s);
 try {
  expect(issueCommand(s,source.side,{type:'attack',ids:[source.id],target:target.id})).toBe(true);
  stepGame(s,.05);
  const attacks=s.events.filter(e=>e.type==='attack'&&e.source===source.id&&e.target===target.id);
  expect(attacks).toHaveLength(1);expect(attacks[0].amount).toBeGreaterThan(0);
  const loss=hp-target.hp;expect(loss).toBeGreaterThan(0);expect(attacks[0].amount).toBeCloseTo(loss);
  observations[name]={tick:s.tick,hpBefore:hp,hpAfter:target.hp,loss,attacks,source:{id:source.id,x:source.x,y:source.y,level:source.level,facing:source.facing},target:{id:target.id,x:target.x,y:target.y,level:target.level,facing:target.facing},geometry:s.world!.sites.map(ruinGeometry)};
  if(keepHistory){downloads[`${name}-input-map.json`]=f.map;downloads[`${name}-initial-save.json`]=f.initial;downloads[`${name}-session.json`]=createSessionFile(s,recorder.export());}
  return loss;
 } finally {recorder.dispose();}
}
function advance(s:GameState,ticks:number){for(let i=0;i<ticks;i++)stepGame(s,.05);}

describe('relic ruin cover through real attacks',()=>{
 it('reduces a neutral ruin lane hit before armor without changing the saved geometry',()=>{
  const control=firstHit('uncovered',fixture(),true),covered=firstHit('covered',fixture([lane]),true);
  expect(control).toBe(12);expect(covered).toBeCloseTo(6.75);expect(covered).toBeLessThan(control);
 });
 it.each<[string,WorldPoint]>([
  ['off-lane',{x:23.5,y:26.5,level:1}],
  ['other-level',{...lane,level:0}],
  ['behind-shooter',{x:19.5,y:24.5,level:1}],
  ['too-far-from-victim',{x:21.5,y:24.5,level:1}],
  ['at-victim',{x:25.5,y:24.5,level:1}],
  ['beyond-victim',{x:25.9,y:24.5,level:1}],
  ['too-close-to-shooter',{x:20.9,y:24.5,level:1}],
 ])('leaves a %s ruin hit uncovered', (name,point)=>{
  expect(firstHit(name,fixture([point]))).toBe(12);
 });
 it('covers a pillar just inside the victim while rejecting the pillar just beyond it',()=>{
  expect(firstHit('near-victim-inside',fixture([{x:25.1,y:24.5,level:1}]))).toBeCloseTo(6.75);
  expect(firstHit('near-victim-outside',fixture([{x:25.9,y:24.5,level:1}]))).toBe(12);
 });
 it('leaves melee damage unchanged',()=>{
  expect(firstHit('melee-covered',fixture([lane],{melee:true}))).toBe(firstHit('melee-control',fixture([],{melee:true})));
 });
 it('uses one cover factor for qualifying ruins and a building in the same lane',()=>{
  const ruin=firstHit('ruin-only',fixture([lane]));
  expect(firstHit('ruin-building',fixture([lane],{building:true}))).toBeCloseTo(ruin);
  expect(firstHit('two-ruins',fixture([lane,{x:24.5,y:24.5,level:1}]))).toBeCloseTo(ruin);
  expect(firstHit('two-ruins-building',fixture([lane,{x:24.5,y:24.5,level:1}],{building:true}))).toBeCloseTo(ruin);
 });
 it('protects the other direction with the same neutral pillar',()=>{
  const control=firstHit('reverse-control',fixture([],{reverse:true})),covered=firstHit('reverse-covered',fixture([lane],{reverse:true}));
  expect(control).toBe(12);expect(covered).toBeCloseTo(6.75);expect(covered).toBeLessThan(control);
 });
 it.each<Side>([0,1])('keeps player %s ownership separate from the cover reduction',owner=>{
  const control=fixture([{...lane,y:26.5}],{owner}),covered=fixture([lane],{owner});
  const bonus=relicBonus(control.s,0,control.source);expect(relicBonus(covered.s,0,covered.source)).toBe(bonus);
  const controlLoss=firstHit(`owner-${owner}-control`,control),coveredLoss=firstHit(`owner-${owner}-covered`,covered);
  expect(controlLoss).toBeCloseTo(15*(1+bonus)-3);expect(coveredLoss).toBeCloseTo(15*(1+bonus)*.65-3);expect(coveredLoss).toBeLessThan(controlLoss);
 });
 it('keeps cover stable when qualifying and irrelevant saved sites are reordered',()=>{
  const sites=[lane,{x:23.5,y:27.5,level:1},{...lane,level:0}];
  expect(firstHit('site-order-012',fixture(sites))).toBe(firstHit('site-order-210',fixture(sites,{siteOrder:[2,1,0]})));
 });
 it('derives only relic geometry and retains it through public capture and save continuation',()=>{
  const f=fixture([lane]),{s,source,target}=f,site=s.world!.sites[0];
  source.x=lane.x-1;source.y=lane.y;source.cooldown=100;target.x=30.5;target.y=30.5;
  refreshVisibility(s);const before=JSON.stringify(site),geometry=ruinGeometry(site);
  expect(geometry).toEqual({site:site.id,...lane,radius:RUIN_PILLAR_RADIUS});expect(JSON.stringify(site)).toBe(before);
  expect(ruinGeometry({...site,kind:'village'})).toBeUndefined();expect(ruinGeometry({...site,kind:'monster'})).toBeUndefined();
  const recorder=new MatchRecorder(s);
  try {
   expect(issueCommand(s,0,{type:'captureSite',ids:[source.id],target:site.id})).toBe(true);advance(s,80);
   expect(site.progress).toBeGreaterThan(0);expect(site.owner).toBeNull();expect(ruinGeometry(site)).toEqual(geometry);
   const checkpoint=saveGame(s),resumed=loadGame(checkpoint);expect(saveGame(resumed)).toEqual(checkpoint);
   for(let tick=0;tick<125;tick++){stepGame(s,.05);stepGame(resumed,.05);expect(saveGame(resumed)).toEqual(saveGame(s));}
   expect(site.owner).toBe(0);expect(relicBonus(s,0,source)).toBe(NEUTRAL_RULES.relicDamageBonus);expect(ruinGeometry(site)).toEqual(geometry);expect(ruinGeometry(resumed.world!.sites[0])).toEqual(geometry);
   const archive=recorder.export(),player=new ReplayPlayer(archive);
   try {player.seek(s.tick);expect(saveGame(player.state)).toEqual(saveGame(s));}finally{player.dispose();}
   observations.capture={initialSite:JSON.parse(before),tick:s.tick,owner:site.owner,geometry,checkpointTick:checkpoint.state.tick,identicalResumedTicks:125};
   downloads['capture-checkpoint.json']=checkpoint;downloads['capture-session.json']=createSessionFile(s,archive);
  }finally{recorder.dispose();}
 });
 it('continues full saves with matching ruin hits and replays the complete 4.0.2 endpoint',()=>{
  const f=fixture([lane]),{s,source,target}=f,resumed=loadGame(f.initial),initialGeometry=ruinGeometry(s.world!.sites[0]);
  expect(saveGame(resumed)).toEqual(f.initial);const originalRecorder=new MatchRecorder(s),resumedRecorder=new MatchRecorder(resumed);
  try {
   for(const state of [s,resumed])expect(issueCommand(state,0,{type:'attack',ids:[source.id],target:target.id})).toBe(true);
   for(let tick=0;tick<40;tick++){stepGame(s,.05);stepGame(resumed,.05);expect(saveGame(resumed)).toEqual(saveGame(s));}
   const archive=originalRecorder.export(),resumedArchive=resumedRecorder.export();expect(archive).toEqual(resumedArchive);expect(archive.simulationRevision).toBe('4.0.2');
   expect(ruinGeometry(resumed.world!.sites[0])).toEqual(initialGeometry);expect(target.hp).toBeLessThan(target.maxHp);
   const player=new ReplayPlayer(archive);
   try {expect(player.advance(40)).toBe(40);expect(player.finished).toBe(true);expect(saveGame(player.state)).toEqual(saveGame(s));expect(replayChecksum(player.state)).toBe(archive.finalChecksum);downloads['ruin-replay-endpoint-save.json']=saveGame(player.state);}finally{player.dispose();}
   downloads['ruin-continuation-initial-save.json']=f.initial;downloads['ruin-continuation-session.json']=createSessionFile(s,archive);downloads['ruin-resumed-session.json']=createSessionFile(resumed,resumedArchive);
   observations.continuation={ticks:40,initialGeometry,finalGeometry:ruinGeometry(s.world!.sites[0]),finalChecksum:archive.finalChecksum,finalTick:s.tick,targetHp:target.hp};
  }finally{originalRecorder.dispose();resumedRecorder.dispose();}
 });
});
