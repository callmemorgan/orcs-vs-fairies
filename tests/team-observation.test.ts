import { describe, expect, it } from 'vitest';
import { TerminalSession } from '../src/cli/session';
import { FACTIONS } from '../src/core/content';
import { observedHealth, PlayerView } from '../src/core/observation';
import { createMatch, refreshVisibility, stepGame } from '../src/core/simulation';
import type { MatchConfig, Side } from '../src/core/types';

function config(sharedVision=true):MatchConfig {
 return {map:{seed:30981,size:'huge'},players:[
  {id:0,teamId:0,factionId:'orcs',controller:'external'},
  {id:1,teamId:1,factionId:'undead',controller:'external'},
  {id:2,teamId:0,factionId:'fairies',controller:'external'},
  {id:3,teamId:1,factionId:'automata',controller:'external'}
 ],rules:{sharedVision}};
}
const unit=(s:ReturnType<typeof createMatch>,side:Side)=>s.entities.find(e=>e.side===side&&e.role==='melee')!;
const privateFields=['order','orderQueue','queue','rally','trainProgress','research','researchProgress','carried','carriedKind','cooldown','abilityReadyAt','expires','lastDamagedAt','path'];
const observe=(session:TerminalSession)=>(session.handle({op:'observe'}) as {result:ReturnType<PlayerView['observe']>}).result;
function movementSession(blocker:{x:number;y:number},scout={x:16.5,y:10.5}){
 const session=new TerminalSession();session.handle({op:'startMatch',config:config(false),side:0});
 const s=session.state!;s.terrain.fill('grass');s.resources=[];
 for(const e of s.entities)if(e.side===0){e.x=10.5+e.id%7;e.y=10.5;}
 Object.assign(unit(s,0),scout);
 Object.assign(s.entities.find(e=>e.side===1&&e.role==='hq')!,blocker);
 refreshVisibility(s);return session;
}
function resourceMovementSession(location:{x:number;y:number}){
 const session=movementSession({x:80.5,y:80.5}),s=session.state!;
 s.resources.push({id:s.nextId++,...location,kind:'ore',amount:100,maxAmount:100});return session;
}
const movementCases=[['move',false],['move',true],['attackMove',false],['attackMove',true]] as const;

describe('team observations',()=>{
 it('publishes faction and team rosters while keeping all other player data private',()=>{
  const s=createMatch(config()),view=new PlayerView(2),own=unit(s,2);
  own.order={type:'move',x:own.x+2,y:own.y};own.orderQueue=[{type:'move',x:own.x+3,y:own.y}];
  const observation=view.observe(s);
  expect(observation.side).toBe(2);expect(observation.teamId).toBe(0);
  expect(observation.allies).toEqual([{side:0,teamId:0,faction:'orcs'}]);
  expect(observation.opponents).toEqual([{side:1,teamId:1,faction:'undead'},{side:3,teamId:1,faction:'automata'}]);
  expect(observation.opponent).toEqual({side:1,faction:'undead'});
  for(const entry of [...observation.allies,...observation.opponents])expect(Object.keys(entry).sort()).toEqual(['faction','side','teamId']);
  expect(observation).not.toHaveProperty('players');expect(observation.player.faction).toBe('fairies');
  const owned=observation.entities.find(e=>e.id===own.id)!;
  expect(owned).toHaveProperty('orderQueue',own.orderQueue);
  if('orderQueue' in owned)owned.orderQueue![0]={type:'hold'};
  observation.player.upgrades.push('worker-speed');
  expect(own.orderQueue).toEqual([{type:'move',x:own.x+3,y:own.y}]);expect(s.players[2].upgrades).toEqual([]);
 });

 it.each([true,false])('uses shared vision=%s without exposing allied commands or economy',sharedVision=>{
  const s=createMatch(config(sharedVision));s.terrain.fill('grass');s.resources=[];
  const ally=unit(s,2),foe=unit(s,1);
  ally.x=50;ally.y=50;foe.x=51;foe.y=50;
  ally.order={type:'move',x:70,y:70};ally.orderQueue=[{type:'attack',target:foe.id}];ally.carried=17;ally.research='worker-speed';ally.rally={x:60,y:60};
  refreshVisibility(s);const observation=new PlayerView(0).observe(s);
  const seenAlly=observation.entities.find(e=>e.id===ally.id),seenFoe=observation.entities.find(e=>e.id===foe.id);
  if(sharedVision){
   expect(seenAlly).toBeDefined();expect(seenFoe).toBeDefined();
   for(const field of privateFields){expect(seenAlly).not.toHaveProperty(field);expect(seenFoe).not.toHaveProperty(field);}
  }else{expect(seenAlly).toBeUndefined();expect(seenFoe).toBeUndefined();}
 });

 it('shows allied illusions truthfully and disguises them for hostile players',()=>{
  const s=createMatch(config()),clone=unit(s,2),def=FACTIONS.fairies.units.special;
  clone.role='special';clone.illusion=true;clone.maxHp=def.hp*.4;clone.hp=clone.maxHp*.5;
  s.visible[0].add(Math.floor(clone.y)*s.width+Math.floor(clone.x));s.visible[1].add(Math.floor(clone.y)*s.width+Math.floor(clone.x));
  expect(observedHealth(s,0,clone)).toEqual({hp:clone.hp,maxHp:clone.maxHp});
  expect(observedHealth(s,1,clone)).toEqual({hp:def.hp*.5,maxHp:def.hp});
  const ally=new PlayerView(0).observe(s).entities.find(e=>e.id===clone.id)!,foe=new PlayerView(1).observe(s).entities.find(e=>e.id===clone.id)!;
  expect(ally).toHaveProperty('illusion',true);expect(foe).not.toHaveProperty('illusion');
  for(const field of privateFields)expect(ally).not.toHaveProperty(field);
 });

 it.each(movementCases)('does not reveal hidden buildings through %s destinations with queued=%s',(type,queued)=>{
  const requested={x:40.5,y:40.5},sessions=[movementSession(requested),movementSession({x:80.5,y:80.5})];
  const id=unit(sessions[0].state!,0).id;
  for(const session of sessions){
   expect(unit(session.state!,0).id).toBe(id);
   if(queued)expect(session.handle({op:'command',command:{type:'move',ids:[id],x:24.5,y:10.5}})).toMatchObject({result:{accepted:true}});
  }
  const before=sessions.map(observe);expect(before[0]).toEqual(before[1]);
  for(const observation of before)expect(observation.entities.some(e=>e.side===1&&e.role==='hq')).toBe(false);
  const input={op:'command',command:{type,ids:[id],...requested,queued}};
  for(const session of sessions)expect(session.handle(input)).toMatchObject({result:{accepted:true}});
  const after=sessions.map(observe);expect(after[0]).toEqual(after[1]);
  for(const observation of after){
   const owned=observation.entities.find(e=>e.id===id)!;
   expect('order' in owned).toBe(true);
   if('order' in owned)expect(queued?owned.orderQueue?.[0]:owned.order).toEqual({type,...requested});
  }
  for(const session of sessions){
   session.handle({op:'advance',ticks:1});const owned=observe(session).entities.find(e=>e.id===id)!;
   expect('order' in owned).toBe(true);
   if('order' in owned)expect(queued?owned.orderQueue?.[0]:owned.order).toEqual({type,...requested});
  }
 });

 it.each(movementCases)('does not reveal hidden resources through %s destinations with queued=%s',(type,queued)=>{
  const requested={x:40.5,y:40.5},sessions=[resourceMovementSession(requested),resourceMovementSession({x:80.5,y:80.5})];
  const id=unit(sessions[0].state!,0).id,resourceId=sessions[0].state!.resources[0].id;
  for(const session of sessions){
   if(queued)expect(session.handle({op:'command',command:{type:'move',ids:[id],x:24.5,y:10.5}})).toMatchObject({result:{accepted:true}});
  }
  const before=sessions.map(observe);expect(before[0]).toEqual(before[1]);
  for(const observation of before)expect(observation.resources.some(resource=>resource.id===resourceId)).toBe(false);
  const input={op:'command',command:{type,ids:[id],...requested,queued}};
  for(const session of sessions)expect(session.handle(input)).toMatchObject({result:{accepted:true}});
  const after=sessions.map(observe);expect(after[0]).toEqual(after[1]);
  for(const session of sessions){
   session.handle({op:'advance',ticks:1});const owned=observe(session).entities.find(e=>e.id===id)!;
   expect('order' in owned).toBe(true);
   if('order' in owned)expect(queued?owned.orderQueue?.[0]:owned.order).toEqual({type,...requested});
  }
 });

 it.each(movementCases)('avoids a visible building for %s destinations with queued=%s',(type,queued)=>{
  const requested={x:40.5,y:40.5},scout={x:34.5,y:40.5},blocked=movementSession(requested,scout),clear=movementSession({x:80.5,y:80.5},scout);
  const id=unit(blocked.state!,0).id;
  expect(observe(blocked).entities.some(e=>e.side===1&&e.role==='hq')).toBe(true);
  expect(observe(clear).entities.some(e=>e.side===1&&e.role==='hq')).toBe(false);
  for(const session of [blocked,clear]){
   if(queued)expect(session.handle({op:'command',command:{type:'move',ids:[id],x:34.5,y:45.5}})).toMatchObject({result:{accepted:true}});
   expect(session.handle({op:'command',command:{type,ids:[id],...requested,queued}})).toMatchObject({result:{accepted:true}});
  }
  const ownedBlocked=observe(blocked).entities.find(e=>e.id===id)!,ownedClear=observe(clear).entities.find(e=>e.id===id)!;
  expect('order' in ownedBlocked&&'order' in ownedClear).toBe(true);
  if('order' in ownedBlocked&&'order' in ownedClear){
   const destination=queued?ownedBlocked.orderQueue?.[0]:ownedBlocked.order;
   expect(queued?ownedClear.orderQueue?.[0]:ownedClear.order).toEqual({type,...requested});
   expect(destination).toMatchObject({type});expect(destination).not.toEqual({type,...requested});
   expect(destination&&'x' in destination).toBe(true);
   if(destination&&'x' in destination)expect(Math.max(Math.abs(destination.x-requested.x),Math.abs(destination.y-requested.y))).toBeGreaterThan(FACTIONS.undead.buildings.hq.size/2);
  }
 });

 it('redacts unseen source and target references independently and hides private economy events',()=>{
  const s=createMatch(config(false)),own=unit(s,0),visibleFoe=unit(s,1),hiddenFoe=unit(s,3),view=new PlayerView(0);
  own.x=20;own.y=20;visibleFoe.x=21;visibleFoe.y=20;hiddenFoe.x=80;hiddenFoe.y=80;
  s.visible[0]=new Set([20*s.width+20,20*s.width+21]);
  s.events=[
   {type:'attack',side:1,x:21,y:20,source:visibleFoe.id,target:hiddenFoe.id},
   {type:'attack',side:3,x:80,y:80,source:hiddenFoe.id,target:own.id},
   {type:'attack',side:0,x:20,y:20,source:own.id,target:hiddenFoe.id},
   {type:'gather',side:1,x:21,y:20,source:visibleFoe.id,amount:18,resource:'ore'},
   {type:'research',side:2,x:20,y:20,text:'Citadel Age complete'},
   {type:'gather',side:0,x:20,y:20,source:own.id,amount:12,resource:'wood'},
   {type:'attack',side:3,x:80,y:80,source:hiddenFoe.id,target:visibleFoe.id}
  ];
  const events=view.events(s);expect(events).toHaveLength(4);
  expect(events[0]).toHaveProperty('source',visibleFoe.id);expect(events[0]).not.toHaveProperty('target');
  expect(events[1]).not.toHaveProperty('source');expect(events[1]).toMatchObject({target:own.id,x:20,y:20});
  expect(events[2]).toHaveProperty('source',own.id);expect(events[2]).not.toHaveProperty('target');
  expect(events[3]).toMatchObject({type:'gather',source:own.id,amount:12,resource:'wood'});
  events[0].x=999;expect(s.events[0].x).toBe(21);
 });

 it('reports attacks on visible allies without revealing unseen allies or attackers',()=>{
  const s=createMatch(config(false)),ally=unit(s,2),unseenAlly=s.entities.find(e=>e.side===2&&e.role==='worker')!,attacker=unit(s,1);
  ally.x=20;ally.y=20;unseenAlly.x=75;unseenAlly.y=75;attacker.x=80;attacker.y=80;
  s.visible[0]=new Set([20*s.width+20]);
  s.events=[
   {type:'attack',side:1,x:80,y:80,source:attacker.id,target:ally.id,amount:15},
   {type:'attack',side:1,x:80,y:80,source:attacker.id,target:unseenAlly.id},
   {type:'death',side:1,x:20,y:20,source:999},
   {type:'death',side:1,x:80,y:80,source:1000}
  ];
  const events=new PlayerView(0).events(s);expect(events).toHaveLength(2);
  expect(events[0]).toEqual({type:'attack',side:1,x:20,y:20,target:ally.id,amount:15});
  expect(events[1]).toEqual({type:'death',side:1,x:20,y:20,source:999});
 });

 it('retains owned damage timing after an event expires without disclosing other players damage history',()=>{
  const s=createMatch(config(false)),own=unit(s,0),ally=unit(s,2),foe=unit(s,1),view=new PlayerView(0);
  s.terrain.fill('grass');s.resources=[];
  Object.assign(own,{x:20.5,y:20.5,cooldown:100});
  Object.assign(ally,{x:20.5,y:24.5,cooldown:100,lastDamagedAt:7});
  Object.assign(foe,{x:21.5,y:20.5,order:{type:'attack',target:own.id},lastDamagedAt:8});
  refreshVisibility(s);stepGame(s,.05);
  expect(own.hp).toBeLessThan(own.maxHp);expect(own.lastDamagedAt).toBe(s.time);
  const damagedAt=own.lastDamagedAt;
  stepGame(s,.05);expect(s.events.some(event=>event.type==='attack'&&event.target===own.id)).toBe(false);
  s.visible[0]=new Set([20*s.width+20,24*s.width+20]);
  const observation=view.observe(s),seenOwn=observation.entities.find(entity=>entity.id===own.id)!;
  expect(seenOwn).toHaveProperty('lastDamagedAt',damagedAt);
  expect(observation.entities.some(entity=>entity.id===foe.id)).toBe(false);
  expect(observation.entities.find(entity=>entity.id===ally.id)).not.toHaveProperty('lastDamagedAt');
  s.visible[0].add(20*s.width+21);
  expect(view.observe(s).entities.find(entity=>entity.id===foe.id)).not.toHaveProperty('lastDamagedAt');
 });

 it('reports eliminated teammates as winners when their team wins',()=>{
  const s=createMatch(config());
  for(const e of s.entities)if(e.side!==2)e.hp=0;
  stepGame(s,.05);
  expect(s.eliminated).toEqual([true,true,false,true]);expect(s.winningTeam).toBe(0);
  const eliminated=new PlayerView(0).observe(s),survivor=new PlayerView(2).observe(s),loser=new PlayerView(3).observe(s);
  expect(eliminated.result).toMatchObject({finished:true,winningTeam:0,outcome:'win',eliminated:[true,true,false,true]});
  expect(eliminated.winningTeam).toBe(0);expect(survivor.result.outcome).toBe('win');expect(loser.result.outcome).toBe('loss');
 });
});
