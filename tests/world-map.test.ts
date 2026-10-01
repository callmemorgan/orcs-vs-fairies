import { describe,it,expect } from 'vitest';
import { createGame,createMatch,issueCommand,refreshVisibility,stepGame } from '../src/core/simulation';
import { generateWorldMap,validateWorldMap,fogKey,levelOf,terrainLineOfSight } from '../src/core/world-map';
import { route,segmentWalkable,walkable } from '../src/core/navigation';
import { terrainAt } from '../src/core/maps';
import { loadGame,saveGame } from '../src/core/saves';
import { replayChecksum,MatchRecorder,ReplayPlayer } from '../src/core/replays';
import { validateCommand } from '../src/core/commands';
import type { GameState,Side } from '../src/core/types';
const advance=(s:GameState,seconds:number)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)stepGame(s,.05);};
const fixture=()=>createGame('orcs',4127,'fairies',{controllers:['human','human'],mapSize:'small',biome:'forest'});

describe('layered world maps',()=>{
 for(const biome of ['desert','marsh','snow','forest'] as const)for(const count of [2,4,6,8])it(`${biome} connected starts and cavern for ${count} players`,()=>{
  for(const seed of [7,4127,9981]){const map=generateWorldMap(seed,'medium',count,biome);expect(validateWorldMap(map)).toEqual({valid:true,issues:[]});expect(map.starts).toHaveLength(count);expect(map.transitions).toHaveLength(count);expect(map.levels).toHaveLength(2);expect(map.sites.every(site=>site.level===1)).toBe(true);expect(map.resources.filter(r=>r.level===1).map(r=>r.amount)).toEqual([1800,3600,3000]);
   const match=createMatch({map:{seed,world:map,biome},players:Array.from({length:count},(_,side)=>({id:side as Side,teamId:side as Side,factionId:'orcs',controller:'human'}))});expect(match.terrain).toEqual(map.levels[0].terrain);expect(match.starts.map(p=>p.level)).toEqual(Array(count).fill(0));expect(match.world!.levels[1].terrain).toEqual(map.levels[1].terrain);expect(match.world!.creatures).toHaveLength(3);
  }
 });
 it('rejects steep disconnected cave and unreachable sites',()=>{
  const map=generateWorldMap(4127,'small',2,'desert');map.transitions=[];expect(validateWorldMap(map).issues).toContain('The cavern has no entrance.');expect(validateWorldMap(map).issues.some(i=>i.startsWith('Site'))).toBe(true);
 });
 it('requires correct level for movement, combat and deposits',()=>{
  const s=fixture(),unit=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role==='melee')!,foe=s.entities.find(e=>e.side===1&&e.kind==='unit')!;foe.x=unit.x+.7;foe.y=unit.y;foe.level=1;refreshVisibility(s);const hp=foe.hp;
  expect(issueCommand(s,0,{type:'attack',ids:[unit.id],target:foe.id})).toBe(false);expect(issueCommand(s,0,{type:'move',ids:[unit.id],x:unit.x+2,y:unit.y,level:1})).toBe(false);advance(s,4);expect(foe.hp).toBe(hp);expect(s.visible[0].has(fogKey(s,foe))).toBe(false);
 });
 it('traverses both real levels and returns through the far entrance',()=>{
  const s=fixture(),actor=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role==='melee')!,entrances=s.world!.transitions;
  expect(issueCommand(s,0,{type:'traverse',ids:[actor.id],transition:entrances[0].id})).toBe(true);advance(s,8);expect(levelOf(actor)).toBe(1);expect(s.visible[0].has(fogKey(s,actor))).toBe(true);expect(s.visible[0].has(fogKey(s,{...actor,level:0}))).toBe(true); // Opening HQ still supplies surface vision.
  expect(issueCommand(s,0,{type:'move',ids:[actor.id],x:entrances[1].to.x,y:entrances[1].to.y,level:1})).toBe(true);advance(s,80);expect(Math.hypot(actor.x-entrances[1].to.x,actor.y-entrances[1].to.y)).toBeLessThan(1);
  expect(issueCommand(s,0,{type:'traverse',ids:[actor.id],transition:entrances[1].id})).toBe(true);advance(s,2);expect(levelOf(actor)).toBe(0);expect(Math.hypot(actor.x-entrances[1].from.x,actor.y-entrances[1].from.y)).toBeLessThan(1);
 });
 it('blocks two-height steps and lower line of sight while retaining graded ramps',()=>{
  const s=fixture();s.entities=[];s.resources=[];s.terrain.fill('grass');s.world!.levels[0].elevation.fill(0);const a={x:10.5,y:10.5,level:0},b={x:12.5,y:10.5,level:0};s.world!.levels[0].elevation[10*s.width+11]=2;
  expect(segmentWalkable(s,a,b)).toBe(false);expect(terrainLineOfSight(s,a,b)).toBe(false);s.world!.levels[0].elevation[10*s.width+11]=1;expect(segmentWalkable(s,a,b)).toBe(true);s.world!.levels[0].elevation[10*s.width+12]=1;expect(terrainLineOfSight(s,a,b)).toBe(true);
 });
 it('destroys, invalidates and rebuilds a targetable bridge through orders',()=>{
  const s=fixture(),bridge=s.world!.bridges[0];expect(bridge).toBeDefined();const actor=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role==='melee')!,tile=bridge.tiles[0];actor.x=tile%s.width+.5;actor.y=Math.floor(tile/s.width)+.5;actor.role='siege';actor.hp=actor.maxHp=500;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'worldAttack',ids:[actor.id],target:bridge.id})).toBe(true);advance(s,50);expect(bridge.hp).toBe(0);expect(terrainAt(s,tile%s.width+.5,Math.floor(tile/s.width)+.5)).toBe('water');expect(walkable(s,tile%s.width+.5,Math.floor(tile/s.width)+.5)).toBe(false);expect(actor.hp).toBeLessThan(500);
  actor.role='worker';const before=s.players[0].wood;refreshVisibility(s);expect(issueCommand(s,0,{type:'repairBridge',ids:[actor.id],target:bridge.id})).toBe(true);expect(s.players[0].wood).toBe(before-60-bridge.tiles.length*2);advance(s,30);expect(bridge.hp).toBe(bridge.maxHp);expect(terrainAt(s,tile%s.width+.5,Math.floor(tile/s.width)+.5)).toBe('bridge');expect(route(s,actor,{x:tile%s.width+.5,y:Math.floor(tile/s.width)+.5,level:0},.4,0).length).toBeGreaterThan(0);
 });
 it('continues world weather and tunnel transit from exact checkpoint',()=>{
  const s=fixture(),actor=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role==='melee')!;issueCommand(s,0,{type:'traverse',ids:[actor.id],transition:s.world!.transitions[0].id});advance(s,.4);const saved=saveGame(s),restored=loadGame(saved);expect(replayChecksum(restored)).toBe(replayChecksum(loadGame(saved)));
  for(let i=0;i<200;i++){stepGame(s,.05);stepGame(restored,.05);expect(replayChecksum(restored)).toBe(replayChecksum(s));}expect(restored.world!.levels[0].terrain).toBe(restored.terrain);
 });
 it('replays normal world commands and seeks across levels',()=>{
  const s=fixture(),actor=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role==='melee')!,recorder=new MatchRecorder(s);expect(issueCommand(s,0,{type:'traverse',ids:[actor.id],transition:s.world!.transitions[0].id})).toBe(true);advance(s,8);const archive=recorder.export(),player=new ReplayPlayer(archive);player.advance(1000);expect(replayChecksum(player.state)).toBe(replayChecksum(s));player.seek(5);player.seek(160);expect(replayChecksum(player.state)).toBe(replayChecksum(s));recorder.dispose();player.dispose();
 });
 it('strictly rejects foreign level fields and corrupted world references',()=>{
  const save=saveGame(fixture());save.state.world!.creatures[0].site=123456;expect(()=>loadGame(save)).toThrow('creature0.site');const other=saveGame(fixture());other.state.entities[0].level=8;expect(()=>loadGame(other)).toThrow('level');const third=saveGame(fixture());third.state.world!.levels[0].terrain[500]='ice';expect(()=>loadGame(third)).toThrow('match surface');
  expect(validateCommand({type:'move',ids:[1],x:1,y:1,level:1})).toBe(true);expect(validateCommand({type:'move',ids:[1],x:1,y:1,level:2})).toBe(false);expect(validateCommand({type:'traverse',ids:[1],transition:1})).toBe(true);expect(validateCommand({type:'worldAttack',ids:[1],target:2,level:0})).toBe(false);
 });
});
