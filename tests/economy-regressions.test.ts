import { describe, expect, it } from 'vitest';
import { economicState, economyGatherDepot, observeEconomy } from '../src/core/economy';
import { PlayerView } from '../src/core/observation';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createGame, createMatch, isVisible, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { GameState, Side } from '../src/core/types';

const run=(s:GameState,seconds:number)=>{for(let i=0;i<Math.round(seconds*20);i++)stepGame(s,.05);};
const hooks={visible:(s:GameState,side:Side,p:{x:number;y:number;level?:number})=>isVisible(s,side,p.x,p.y,p.level??0)};
function fixture():GameState {
 const s=createMatch({map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:50000,ore:50000,crystal:50000}}},{id:1,teamId:1,factionId:'fairies',controller:'external'}],rules:{startingAge:3}});
 s.terrain.fill('grass');s.resources=[];refreshVisibility(s);return s;
}

describe('economy integration regressions',()=>{
 it('keeps cancelled grove history bounded across repeated paid planting attempts',()=>{
  const s=fixture(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,hq=s.entities.find(e=>e.side===0&&e.role==='hq')!,wood=s.players[0].wood;
  for(let i=0;i<1601;i++){
   expect(issueCommand(s,0,{type:'plantGrove',ids:[worker.id],x:hq.x+5,y:hq.y+2})).toBe(true);
   expect(issueCommand(s,0,{type:'stop',ids:[worker.id]})).toBe(true);
  }
  expect(s.players[0].wood).toBe(wood-1601*8);expect(s.economy!.groves).toHaveLength(1);expect(s.economy!.groves[0].burned).toBe(true);
  expect(loadGame(saveGame(s)).economy).toEqual(s.economy);
 });
 it('round trips 27 paid recruits across nine constructed headquarters and continues their production',()=>{
  const s=fixture(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
  for(const [x,y] of [[14.5,7.5],[21.5,7.5],[28.5,7.5],[7.5,14.5],[14.5,14.5],[21.5,14.5],[28.5,14.5],[7.5,21.5]]){
   expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:x-2.5,y:y+3})).toBe(true);run(s,15);
   expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'hq',x,y})).toBe(true);const built=s.entities.at(-1)!;run(s,70);expect(built.progress).toBe(1);
  }
  const headquarters=s.entities.filter(e=>e.side===0&&e.kind==='building'&&e.role==='hq'&&e.progress===1);expect(headquarters).toHaveLength(9);
  for(const hq of headquarters)for(let i=0;i<3;i++)expect(issueCommand(s,0,{type:'trainCaravan',id:hq.id})).toBe(true);
  expect(s.economy!.recruits).toHaveLength(27);const restored=loadGame(saveGame(s));
  const invalid=saveGame(s);invalid.state.economy!.recruits[3].producerId=headquarters[0].id;
  expect(()=>loadGame(invalid)).toThrow('recruits');
  run(s,60);run(restored,60);expect(saveGame(restored)).toEqual(saveGame(s));expect(s.economy!.caravans).toHaveLength(27);
 });
 it('rejects worker warehouse assignment across layers and ignores an assignment after the worker changes layers',()=>{
  const s=fixture(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
  expect(issueCommand(s,0,{type:'buildEconomy',ids:[worker.id],kind:'warehouse',x:hq.x+6,y:hq.y+5})).toBe(true);const warehouse=s.entities.at(-1)!;run(s,70);expect(warehouse.progress).toBe(1);
  worker.level=1;expect(issueCommand(s,0,{type:'setWarehouse',ids:[worker.id],target:warehouse.id})).toBe(false);expect(s.economy!.workerWarehouses).toEqual([]);
  worker.level=0;expect(issueCommand(s,0,{type:'setWarehouse',ids:[worker.id],target:warehouse.id})).toBe(true);expect(economyGatherDepot(s,worker)).toBe(warehouse);
  worker.level=1;expect(economyGatherDepot(s,worker)).toBeUndefined();
 });
 it('observes an older state without adding economy state or changing a zero-action replay',()=>{
  const s=createGame('orcs',42,'fairies',{mapSize:'small',controllers:['external','external']});delete s.economy;
  const saved=saveGame(s),checksum=replayChecksum(s),recorder=new MatchRecorder(s);
  for(let i=0;i<3;i++){
   const view=observeEconomy(s,0,hooks);expect(view.structures).toEqual([]);view.ledger.gathered.wood=100;view.groves.push({id:99,side:0,x:1,y:1,plantedAt:0,maturesAt:60,burned:false});
   new PlayerView(0).observe(s);
  }
  expect(s.economy).toBeUndefined();expect(saveGame(s)).toEqual(saved);expect(replayChecksum(s)).toBe(checksum);
  const archive=recorder.export();expect(archive.actions).toEqual([]);const player=new ReplayPlayer(archive);
  expect(player.finished).toBe(true);expect(replayChecksum(player.state)).toBe(archive.finalChecksum);player.dispose();recorder.dispose();
 });
 it('records economy commands and produces the same state after observed playback',()=>{
  const s=fixture(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,hq=s.entities.find(e=>e.side===0&&e.role==='hq')!,recorder=new MatchRecorder(s);
  expect(issueCommand(s,0,{type:'plantGrove',ids:[worker.id],x:hq.x+5,y:hq.y+2})).toBe(true);
  expect(issueCommand(s,0,{type:'trainCaravan',id:hq.id})).toBe(true);
  for(let i=0;i<1800;i++){stepGame(s,.05);observeEconomy(s,0,hooks);}
  const replay=new ReplayPlayer(recorder.export());replay.advance(1800);expect(replay.finished).toBe(true);expect(saveGame(replay.state)).toEqual(saveGame(s));
  expect(s.economy!.groves[0].resourceId).toBeDefined();expect(s.economy!.caravans).toHaveLength(1);replay.dispose();recorder.dispose();
 });
 it('keeps resource memory and foreign economic actors separate by layer',()=>{
  const s=fixture(),own=s.entities.find(e=>e.side===0&&e.role==='worker')!,enemy=s.entities.find(e=>e.side===1&&e.role==='worker')!,view=new PlayerView(0),x=own.x,y=own.y;
  const node={id:s.nextId++,x,y,level:1,kind:'crystal' as const,amount:777,maxAmount:777};s.resources.push(node);enemy.x=x;enemy.y=y;enemy.level=1;
  refreshVisibility(s);expect(isVisible(s,0,x,y,0)).toBe(true);expect(isVisible(s,0,x,y,1)).toBe(false);
  expect(view.resourcesFor(s).some(r=>r.id===node.id)).toBe(false);expect(view.observe(s).entities.some(e=>e.id===enemy.id)).toBe(false);
  const key=s.width*s.height+Math.floor(y)*s.width+Math.floor(x);s.visible[0].add(key);s.explored[0].add(key);
  expect(view.resourcesFor(s).find(r=>r.id===node.id)).toMatchObject({amount:777,visible:true});
  s.visible[0].delete(key);node.amount=10;expect(view.resourcesFor(s).find(r=>r.id===node.id)).toMatchObject({amount:777,visible:false});
 });
 it('returns independent economic ledgers and stocks',()=>{
  const s=fixture(),market=economicState(s)!.markets[0],key=Math.floor(market.y)*s.width+Math.floor(market.x);s.visible[0].add(key);s.explored[0].add(key);
  const before=saveGame(s),view=observeEconomy(s,0,hooks);view.ledger.gathered.wood=100;view.markets[0].stock.wood=100;view.markets[0].demand.wood=100;
  expect(saveGame(s)).toEqual(before);
 });
});
