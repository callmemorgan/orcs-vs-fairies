import { describe, expect, it } from 'vitest';
import { TerminalSession, replayMatch, stateHash } from '../src/cli/session';
import { saveGame } from '../src/core/saves';
import { captureRuntime, createMatch, restoreRuntime, stepGame } from '../src/core/simulation';
import type { MatchConfig, Side } from '../src/core/types';

const result=(session:TerminalSession,input:unknown)=>(session.handle(input) as {result:any}).result;
function config():MatchConfig {
 return {schemaVersion:1,map:{seed:18281,size:'huge'},players:[
  {id:0,teamId:0,factionId:'orcs',controller:'external'},
  {id:1,teamId:1,factionId:'undead',controller:'external'},
  {id:2,teamId:0,factionId:'fairies',controller:'external'},
  {id:3,teamId:1,factionId:'automata',controller:'external'}
 ]};
}
const entity=(session:TerminalSession,side:Side,role:string)=>session.state!.entities.find(e=>e.side===side&&e.role===role)!;

describe('team terminal sessions',()=>{
 it('starts and controls side 2 while keeping allied command ownership private',()=>{
  const session=new TerminalSession(),observation=result(session,{op:'startMatch',config:config(),side:2});
  expect(observation).toMatchObject({side:2,teamId:0,controller:'external'});
  const own=entity(session,2,'melee'),ally=entity(session,0,'melee'),enemy=entity(session,1,'melee');
  expect(result(session,{op:'command',command:{type:'move',ids:[own.id],x:own.x+2,y:own.y}}).accepted).toBe(true);
  expect(result(session,{op:'command',command:{type:'move',ids:[ally.id],x:ally.x+2,y:ally.y}}).accepted).toBe(false);
  expect(result(session,{op:'command',command:{type:'move',ids:[enemy.id],x:enemy.x+2,y:enemy.y}}).accepted).toBe(false);
  expect(result(session,{op:'command',command:{type:'attack',ids:[own.id],target:ally.id}}).accepted).toBe(false);
  expect(result(session,{op:'command',command:{type:'train',id:entity(session,0,'hq').id,role:'worker'}}).accepted).toBe(false);
  expect(result(session,{op:'command',command:{type:'train',id:entity(session,2,'hq').id,role:'worker'}}).accepted).toBe(true);
 });

 it.each([undefined,-1,8,1.5,'2'])('requires an explicit valid controlled side (%s)',side=>{
  const session=new TerminalSession();expect(()=>result(session,{op:'startMatch',config:config(),side})).toThrow();
  expect(session.state).toBeUndefined();expect(session.replay).toEqual([]);
 });

 it.each(['human','ai'] as const)('does not authenticate a %s controller as a terminal player',controller=>{
  const session=new TerminalSession(),match=config();match.players[2].controller=controller;
  expect(()=>result(session,{op:'startMatch',config:match,side:2})).toThrow('external player');
  expect(session.state).toBeUndefined();
 });

 it('controls the last side in a full eight-player roster',()=>{
  const match=config(),session=new TerminalSession();
  for(const id of [4,5,6,7] as const)match.players.push({id,teamId:id%2===0?0:1,factionId:'dwarves',controller:'external'});
  const observation=result(session,{op:'startMatch',config:match,side:7}),own=entity(session,7,'hq');
  expect(observation).toMatchObject({side:7,teamId:1});expect(observation.allies).toHaveLength(3);expect(observation.opponents).toHaveLength(4);
  expect(result(session,{op:'command',command:{type:'train',id:own.id,role:'worker'}}).accepted).toBe(true);
  expect(result(session,{op:'command',command:{type:'train',id:entity(session,5,'hq').id,role:'worker'}}).accepted).toBe(false);
 });

 it('supports a single-player match without inventing an opponent and replays its result',()=>{
  const match=config(),session=new TerminalSession();match.players=match.players.slice(0,1);
  const observation=result(session,{op:'startMatch',config:match,side:0});
  expect(observation.opponent).toBeNull();expect(observation.opponents).toEqual([]);expect(observation.allies).toEqual([]);
  result(session,{op:'advance',ticks:1});expect(result(session,{op:'result'})).toMatchObject({finished:false,winner:null,winningTeam:null,outcome:null});
  expect(replayMatch(session.replay).verified).toBe(3);
 });

 it('saves and restores side 7 with identical queued orders, production and subsequent simulation',()=>{
  const match=config(),original=new TerminalSession(),restored=new TerminalSession();
  for(const id of [4,5,6,7] as const)match.players.push({id,teamId:id%2===0?0:1,factionId:'dwarves',controller:'external'});
  result(original,{op:'startMatch',config:match,side:7});
  const own=entity(original,7,'melee'),hq=entity(original,7,'hq');
  expect(result(original,{op:'command',command:{type:'move',ids:[own.id],x:own.x-2,y:own.y}}).accepted).toBe(true);
  expect(result(original,{op:'command',command:{type:'move',ids:[own.id],x:own.x-4,y:own.y,queued:true}}).accepted).toBe(true);
  expect(result(original,{op:'command',command:{type:'train',id:hq.id,role:'worker'}}).accepted).toBe(true);
  result(original,{op:'advance',ticks:37});
  const saved=result(original,{op:'save'}),before=structuredClone(saved),observation=result(restored,{op:'load',save:saved,side:7});
  expect(observation).toMatchObject({side:7,teamId:1,controller:'external'});expect(saved).toEqual(before);
  expect(saveGame(restored.state!)).toEqual(saveGame(original.state!));
  result(original,{op:'advance',ticks:120});result(restored,{op:'advance',ticks:120});
  expect(saveGame(restored.state!)).toEqual(saveGame(original.state!));expect(replayMatch(restored.replay).verified).toBe(2);
 });

 it('converts only other human controllers to AI when loading a selected multiplayer side',()=>{
  const match=config(),session=new TerminalSession();
  for(const id of [4,5,6,7] as const)match.players.push({id,teamId:id%2===0?0:1,factionId:'dwarves',controller:'external'});
  match.players[0].controller='human';match.players[4].controller='human';match.players[5].controller='ai';match.players[6].controller='ai';match.players[7].controller='human';
  const saved=saveGame(createMatch(match));
  expect(result(session,{op:'load',save:saved,side:7})).toMatchObject({side:7,controller:'external'});
  expect(session.state!.controllers).toEqual(['ai','external','external','external','ai','ai','ai','external']);
  expect(saved.state.controllers).toEqual(['human','external','external','external','human','ai','ai','human']);
 });

 it('does not replace an active match or add replay entries for invalid saves or load sides',()=>{
  const session=new TerminalSession();result(session,{op:'startMatch',config:config(),side:2});
  const original=session.state!,saved=result(session,{op:'save'}),before=saveGame(original),replayLength=session.replay.length,invalid=structuredClone(saved);
  invalid.state.players[0].wood=-1;
  const requests=[
   {op:'load',save:invalid,side:2},
   ...[-1,4,7,8,1.5,'2',null].map(side=>({op:'load',save:saved,side})),
   {op:'load',save:saved,side:2,controller:'external'},
   {op:'load',side:2}
  ];
  for(const request of requests){expect(()=>result(session,request)).toThrow();expect(session.state).toBe(original);expect(saveGame(session.state!)).toEqual(before);expect(session.replay).toHaveLength(replayLength);}
  expect(result(session,{op:'observe'})).toMatchObject({side:2,controller:'external'});
 });

 it('preserves two-player load defaults and selects side 0 for a one-player save',()=>{
  const legacy=new TerminalSession();result(legacy,{op:'start'});const saved=result(legacy,{op:'save'}),session=new TerminalSession();
  expect(result(session,{op:'load',save:saved})).toMatchObject({side:1,controller:'external'});expect(session.state!.controllers).toEqual(['ai','external']);
  const one=config();one.players=one.players.slice(0,1);one.players[0].controller='human';
  expect(result(session,{op:'load',save:saveGame(createMatch(one))})).toMatchObject({side:0,controller:'external'});
 });

 it('runs full match validation before accepting the protocol request',()=>{
  const malformed:any[]=[
   {...config(),schemaVersion:2},
   {...config(),map:{seed:NaN}},
   {...config(),players:config().players.map((p,i)=>({...p,id:i===3?2:p.id}))},
   {...config(),rules:{sharedVision:'yes'}},
   {...config(),players:config().players.map(p=>({...p,handicap:{incomeFactor:-1}}))},
   {...config(),unknown:true}
  ];
  for(const match of malformed){const session=new TerminalSession();expect(()=>result(session,{op:'startMatch',config:match,side:2})).toThrow();expect(session.state).toBeUndefined();}
  const session=new TerminalSession();expect(()=>result(session,{op:'startMatch',config:config(),side:2,controller:'external'})).toThrow();
 });

 it('accepts queued waypoints and production reordering but rejects malformed queue payloads',()=>{
  const session=new TerminalSession();result(session,{op:'startMatch',config:config(),side:2});
  const own=entity(session,2,'melee'),hq=entity(session,2,'hq');
  expect(result(session,{op:'command',command:{type:'move',ids:[own.id],x:own.x+2,y:own.y}}).accepted).toBe(true);
  expect(result(session,{op:'command',command:{type:'move',ids:[own.id],x:own.x+4,y:own.y,queued:true}}).accepted).toBe(true);
  expect(own.orderQueue).toHaveLength(1);
  for(let i=0;i<3;i++)expect(result(session,{op:'command',command:{type:'train',id:hq.id,role:'worker'}}).accepted).toBe(true);
  expect(result(session,{op:'command',command:{type:'reorderTrain',id:hq.id,from:1,to:2}}).accepted).toBe(true);
  expect(result(session,{op:'command',command:{type:'reorderTrain',id:hq.id,from:0,to:2}}).accepted).toBe(false);
  for(const command of [
   {type:'move',ids:[own.id],x:own.x,y:own.y,queued:1},
   {type:'move',ids:[own.id],x:own.x,y:own.y,queued:true,side:0},
   {type:'ability',ids:[own.id],queued:true},
   {type:'reorderTrain',id:hq.id,from:1,to:'2'},
   {type:'reorderTrain',id:hq.id,from:1,to:2,queued:true}
  ])expect(()=>result(session,{op:'command',command})).toThrow('Malformed command');
 });

 it('reports a team win to a defeated teammate and loss to the opposing team',()=>{
  for(const side of [0,2,3] as const){
   const session=new TerminalSession();result(session,{op:'startMatch',config:config(),side});
   for(const e of session.state!.entities)if(e.side!==2)e.hp=0;
   stepGame(session.state!,.05);
   expect(result(session,{op:'result'})).toMatchObject({finished:true,winningTeam:0,eliminated:[true,true,false,true],side,teamId:side===3?1:0,outcome:side===3?'loss':'win'});
  }
 });

 it('replays a four-player match and hashes private runtime state',()=>{
  const session=new TerminalSession();result(session,{op:'startMatch',config:config(),side:3});
  const own=entity(session,3,'melee');result(session,{op:'command',command:{type:'move',ids:[own.id],x:own.x-2,y:own.y}});
  result(session,{op:'advance',ticks:120});result(session,{op:'observe'});
  expect(replayMatch(session.replay).verified).toBe(4);
  const direct=createMatch(config()),before=stateHash(direct),runtime=captureRuntime(direct);
  runtime.aiTurns+=1;restoreRuntime(direct,runtime);
  expect(stateHash(direct)).not.toBe(before);
 });
});
